/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper, EmailSender } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');

const { SYS_ADMIN_EMAIL } = require('../../config/appConfig');

const { CustomError } = require('../../vs-core');

const { Collections } = require('../../types/collectionsTypes');

const {
  areEqualStringLists,
  areDeepEqualDocuments,
  formatMoneyWithCurrency,
} = require('../../helpers/coreHelper');

const { setUserClaims } = require('../admin/controller');

const schemas = require('./schemas');

const { TransactionRequestStatusTypes } = require('../../types/transactionRequestStatusTypes');

const { findByCompany: findByCompanyEmployees } = require('../companyEmployees/controller');

const {
  MULTIPLE_RELATIONSHIP_SUFFIX,
  sanitizeData,
  find,
  findWithUserRelationship,

  get,
  patch,
  patchInner,
  remove,
  create,
  createInner,
  fetchSingleItem,
  fetchItems,
  updateSingleItem,
  filterItems,
  fetchItemsByIds,
  getWithUserRelationshipById,
  listByProp,
  listByPropInner,
  listWithRelationships,
  getByProp,
  getFirebaseUserById,
  createFirestoreDocument,
} = require('../baseEndpoint');
const { invoke } = require('lodash');

const INDEXED_FILTERS = ['vaultId', 'companyId', 'userId', 'state'];

const COMPANY_ENTITY_PROPERTY_NAME = 'companyId';
const USER_ENTITY_PROPERTY_NAME = 'userId';
const VAULT_ENTITY_PROPERTY_NAME = 'vaultId';
const COLLECTION_NAME = Collections.TRANSACTION_REQUESTS;

async function validateRequest(itemData, vault = null) {
  if (!vault) {
    vault = await fetchSingleItem({
      collectionName: Collections.VAULTS,
      id: itemData.vaultId,
    });
  }

  const arsCurrency = Types.CurrencyTypes.ARS;

  let arsDepositsAmount = 0;
  const arsCredit = vault.amount || 0;
  let requestArsValue = 0;
  const creditAmount = itemData.creditAmount || 0;

  const arsBalanceItem = vault.balances.find((balance) => {
    return balance.currency === arsCurrency && balance.isValuation;
  });

  if (arsBalanceItem) arsDepositsAmount = arsBalanceItem.balance;

  const requestAmount = itemData.amount;
  let requestCurrency = itemData.currency;

  if (!itemData.currency) {
    requestCurrency = arsCurrency;
  }

  // Calculate ARS value of request
  if (requestCurrency.toLowerCase() !== arsCurrency.toLowerCase()) {
    const tokenBalance = vault.balances.find((balance) => {
      return balance.currency.toLowerCase() === requestCurrency.toLowerCase();
    });
    if (tokenBalance) {
      const tokenArsValue = tokenBalance.valuations.find(
        (valuation) => valuation.currency.toLowerCase() === 'ars'
      )?.value;
      const lastARStokenPrice = tokenArsValue / tokenBalance.balance;
      requestArsValue = requestAmount * lastARStokenPrice;
    }
  } else {
    requestArsValue = requestAmount;
  }

  // Validaciones
  // 1. Valido que el monto de la transacción en ARS no exceda el saldo disponible
  if (
    requestCurrency.toLowerCase() === arsCurrency.toLowerCase() &&
    requestAmount > arsDepositsAmount
  ) {
    throw new CustomError.TechnicalError(
      'ERROR_CREATE_EXCEED_AMOUNT',
      null,
      'Monto de la transacción excede el saldo disponible',
      null
    );
  }

  // 2. Si la moneda es un token, valido que el monto no exceda el saldo de ese token en la bóveda
  if (requestCurrency !== arsCurrency) {
    const balance = vault.balances.find((balance) => {
      return balance.currency.toLowerCase() === requestCurrency.toLowerCase();
    });
    if (!balance) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE_EXCEED_AMOUNT',
        null,
        'No hay saldo disponible del token solicitado en la bóveda',
        null
      );
    }
    if (itemData.amount > balance.balance) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE_EXCEED_AMOUNT',
        null,
        'El monto del token solicitado excede el saldo disponible de ese token en la bóveda',
        null
      );
    }
  }

  // 3. Valido que el monto de la transacción no sea negativo o cero
  if (requestAmount <= 0) {
    throw new CustomError.TechnicalError(
      'ERROR_CREATE_INVALID_AMOUNT',
      null,
      'Monto de la transacción no puede ser negativo o cero',
      null
    );
  }

  // 4. Valido que el monto de la transacción no deje la bóveda sin colateral
  if (arsDepositsAmount - requestArsValue < arsCredit) {
    throw new CustomError.TechnicalError(
      'ERROR_CREATE_INVALID_AMOUNT',
      null,
      'Monto de la transacción no puede dejar la bóveda sin colateral',
      null
    );
  }

  // 5. Si es una liquidación, valido que el monto de la transacción no exceda el crédito
  if (itemData.transactionType === 'liquidate' && creditAmount > arsCredit) {
    throw new CustomError.TechnicalError(
      'ERROR_CREATE_EXCEED_AMOUNT',
      null,
      'Monto de la transacción de liquidación excede el crédito',
      null
    );
  }

  return { requestArsValue, requestCurrency };
}

exports.find = async function (req, res) {
  console.log('find');
  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    console.log('GET ALL ');

    const result = await listWithRelationships({
      limit,
      offset,
      filters,

      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.VAULTS, propertyName: VAULT_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findByCompany = async function (req, res) {
  const { companyId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    console.log('GET BY COMPANY ' + companyId);

    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
      primaryEntityValue: companyId,
      // primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.VAULTS, propertyName: VAULT_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findByVault = async function (req, res) {
  const { companyId, userId, vaultId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    console.log('GET BY Vault ' + companyId + ' - ' + vaultId);

    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: VAULT_ENTITY_PROPERTY_NAME,
      primaryEntityValue: vaultId,
      // primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.VAULTS, propertyName: VAULT_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
      ],
    });

    if (
      result.items.find((item) => {
        item.companyId !== companyId || item.userId !== userId;
      })
    ) {
      throw new CustomError.TechnicalError(
        'ERROR_NOW_ALLOWED',
        null,
        'Se está consultando una vault que no corresponde a los args recibidos de company o user',
        null
      );
    }

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  const { id } = req.params;

  console.log('GET BY ID ' + id);
  await getByProp({
    req,
    res,
    byId: id,
    collectionName: COLLECTION_NAME,
    relationships: [
      { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
      { collectionName: Collections.VAULTS, propertyName: VAULT_ENTITY_PROPERTY_NAME },
      { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
    ],
  });
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const { companyId, userId: entityUserId } = req.params;
  const body = req.body;
  body.companyId = companyId;
  body.userId = entityUserId;

  const collectionName = COLLECTION_NAME;
  const validationSchema = schemas.update;

  try {
    const { id } = req.params;

    const requestToPatch = await fetchSingleItem({
      collectionName,
      id,
    });

    if (!id) throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);

    console.log('Patch args (' + collectionName + '):', JSON.stringify(body));

    const itemData = await sanitizeData({ data: body, validationSchema });

    if (!companyId) {
      throw new CustomError.TechnicalError(
        'ERROR_UPDATE',
        null,
        'Error updating. Missing args',
        null
      );
    }

    const doc = await updateSingleItem({ collectionName, id, auditUid, data: itemData });
    console.log('requestToPatch ', requestToPatch);
    console.log('Patch data: (' + collectionName + ')', JSON.stringify(itemData));

    return res.status(204).send(doc);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.remove = async function (req, res) {
  const { id: requestId, companyId } = req.params;

  if (!companyId || !requestId) {
    throw new CustomError.TechnicalError(
      'ERROR_REMOVE_COMPANY_CLIENT',
      null,
      'Error removing company client. Missing args',
      null
    );
  }

  await remove(req, res, COLLECTION_NAME);
};

exports.createLenderTransactionRequest = async function (req, res) {
  const { userId: auditUid } = res.locals;

  const { companyId, userId, vaultId } = req.params;
  if (!companyId || !userId || !vaultId) {
    throw new CustomError.TechnicalError(
      'ERROR_CREATE',
      null,
      'Error creating. Missing args',
      null
    );
  }

  try {
    const vault = await fetchSingleItem({
      collectionName: Collections.VAULTS,
      id: vaultId,
    });

    if (vault.userId !== userId || vault.companyId !== companyId) {
      throw new CustomError.TechnicalError(
        'ERROR_WRONG_ARGS',
        null,
        'Se recibio una solicitud de un usuario / empresa distintos a las del vault asociado',
        null
      );
    }

    const body = req.body;

    body.companyId = companyId;
    body.userId = vault.userId;
    body.vaultId = vaultId;
    body.requestStatus = TransactionRequestStatusTypes.REQUESTED;

    const collectionName = COLLECTION_NAME;
    const validationSchema = schemas.create;

    console.log('Create args (' + collectionName + '):', body);

    const itemData = await sanitizeData({ data: body, validationSchema });

    await validateRequest(itemData, vault);

    const createArgs = { collectionName, itemData, auditUid };
    const dbItemData = await createFirestoreDocument(createArgs);

    console.log('Create data: (' + collectionName + ') ' + JSON.stringify(dbItemData));

    const mailResponse = await EmailSender.send({
      // from: '"TrendArt" <' + GMAIL_EMAIL + '>',
      to: SYS_ADMIN_EMAIL,

      // bcc: SYS_ADMIN_EMAIL,
      message: { subject: 'Se creo una solicitud', text: null, html: 'Vault: ' + itemData.vaultId },
    });

    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.createBorrowerTransactionRequest = async function (req, res) {
  const { userId: auditUid } = res.locals;

  const { companyId, userId, vaultId } = req.params;
  if (!companyId || !userId || !vaultId) {
    throw new CustomError.TechnicalError(
      'ERROR_CREATE',
      null,
      'Error creating. Missing args',
      null
    );
  }

  try {
    const vault = await fetchSingleItem({
      collectionName: Collections.VAULTS,
      id: vaultId,
    });

    if (vault.userId !== userId || vault.companyId !== companyId) {
      throw new CustomError.TechnicalError(
        'ERROR_WRONG_ARGS',
        null,
        'Se recibio una solicitud de un usuario / empresa distintos a las del vault asociado',
        null
      );
    }

    const body = req.body;

    body.companyId = companyId;
    body.userId = vault.userId;
    body.vaultId = vaultId;
    body.requestStatus = TransactionRequestStatusTypes.REQUESTED;

    const collectionName = COLLECTION_NAME;
    const validationSchema = schemas.create;

    console.log('Create args (' + collectionName + '):', body);

    const itemData = await sanitizeData({ data: body, validationSchema });

    await validateRequest(itemData, vault);

    const createArgs = { collectionName, itemData, auditUid };
    const dbItemData = await createFirestoreDocument(createArgs);

    console.log('Create data: (' + collectionName + ') ' + JSON.stringify(dbItemData));

    const mailResponse = await EmailSender.send({
      // from: '"TrendArt" <' + GMAIL_EMAIL + '>',
      to: SYS_ADMIN_EMAIL,

      // bcc: SYS_ADMIN_EMAIL,
      message: { subject: 'Se creo una solicitud', text: null, html: 'Vault: ' + itemData.vaultId },
    });

    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.lenderApproveTransactionRequest = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const { companyId, id } = req.params;
  const body = req.body;

  if (!body.safeMainTransaction) throw new Error('missing safeMainTransaction');
  const collectionName = COLLECTION_NAME;
  const validationSchema = schemas.update;
  console.log('lenderApproveTransactionRequest args (' + collectionName + '):', body);
  const itemData = await sanitizeData({ data: body, validationSchema });

  try {
    if (!companyId || !id) {
      throw new CustomError.TechnicalError(
        'lenderApproveTransactionRequest - ERROR_MISSING_ARGS',
        null,
        'Invalid args',
        null
      );
    }

    const existentTransactionRequest = await fetchSingleItem({ collectionName, id });

    console.log('existentTransactionRequest es ', existentTransactionRequest);

    if (!existentTransactionRequest) {
      throw new CustomError.TechnicalError(
        'lenderApproveTransactionRequest - ERROR_MISSING_ARGS2',
        null,
        'Invalid args',
        null
      );
    }

    if (existentTransactionRequest.companyId !== companyId) {
      throw new CustomError.TechnicalError(
        'lenderApproveTransactionRequest - MISSING_PERMISSIONS',
        null,
        'Invalid args',
        null
      );
    }

    console.log('Patch args (' + collectionName + '):', JSON.stringify(body));

    // Set requestStatus based on current status
    if (existentTransactionRequest.requestStatus === TransactionRequestStatusTypes.REQUESTED) {
      itemData.requestStatus = TransactionRequestStatusTypes.PENDING_APPROVE;
    } else {
      itemData.requestStatus = TransactionRequestStatusTypes.APPROVED;
    }

    const doc = await updateSingleItem({ collectionName, id, auditUid, data: itemData });

    // actualiza el prestamo (vault) descontando del crédito el monto ingresado por el operador de aconcagua

    if (
      existentTransactionRequest.requestConversion &&
      existentTransactionRequest.requestConversion.creditAmount &&
      existentTransactionRequest.vaultId &&
      existentTransactionRequest.transactionType === 'liquidate' // si es rescate no resta al credito
    ) {
      const existentVault = await fetchSingleItem({
        collectionName: Collections.VAULTS,
        id: existentTransactionRequest.vaultId,
      });

      const doc = await updateSingleItem({
        collectionName: Collections.VAULTS,
        id: existentTransactionRequest.vaultId,
        auditUid,
        data: {
          amount: existentVault.amount - existentTransactionRequest.requestConversion.creditAmount,
        },
      });
    }

    // MRM envío de nueva notificación

    if (
      existentTransactionRequest.requestStatus == TransactionRequestStatusTypes.PENDING_APPROVE &&
      itemData.requestStatus == TransactionRequestStatusTypes.APPROVED
    ) {
      console.log(
        'Estado de la transacción era ',
        existentTransactionRequest.requestStatus,
        ' y ahora es ',
        itemData.requestStatus,
        ' - Transacción Firmada y Aprobada'
      );

      const userOriginator = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: existentTransactionRequest.createdBy,
      });

      const userActive = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: userId,
      });

      const userBorrower = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: existentTransactionRequest.userId,
      });

      // companyId
      const company = await fetchSingleItem({
        collectionName: Collections.COMPANIES,
        id: companyId,
      });

      console.log('userOriginator es ', userOriginator);
      console.log('userActive es ', userActive);
      console.log('userBorrower es ', userBorrower);
      console.log('companyId es ', companyId);

      const amountUSD = formatMoneyWithCurrency(
        existentTransactionRequest.requestConversion.amountInUSD,
        0,
        undefined,
        undefined,
        'usd'
      );

      const message =
        company.name +
        '.  Cliente ' +
        userBorrower.lastName +
        ' ' +
        userBorrower.lastName +
        '.  Bóveda: ' +
        existentTransactionRequest.vaultId +
        '. Transacción por USD ' +
        amountUSD +
        ' firmada y aprobada por ' +
        userActive.firstName +
        ' ' +
        userActive.lastName;

      EmailSender.send({
        to: SYS_ADMIN_EMAIL,
        message: null,
        template: {
          name: 'mail-approved',
          data: {
            useroriginator: userOriginator.firstName,
            cliente: userBorrower.firstName + ' ' + userBorrower.lastName,
            monto: amountUSD.toFixed(2),
            lender: company.name,
            vaultid: existentTransactionRequest.vaultId,
            transactiontype: existentTransactionRequest.transactionType,
          },
        },
      });

      EmailSender.send({
        to: userOriginator.email,
        message: null,
        template: {
          name: 'mail-approved',
          data: {
            useroriginator: userOriginator.firstName,
            cliente: userBorrower.firstName + ' ' + userBorrower.lastName,
            monto: amountUSD.toFixed(2),
            lender: company.name,
            vaultid: existentTransactionRequest.vaultId,
            transactiontype: existentTransactionRequest.transactionType,
          },
        },
      });

      console.log(message);
    }
    // Fin nueva notificación

    return res.status(204).send(doc);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.borrowerApproveTransactionRequest = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const { companyId, id } = req.params;
  const body = req.body;
  console.log('borrowerApproveTransactionRequest - body es ', body);

  // Modified validation to check for either safeTransaction or safeConfirmation
  if (!body || (!body.safeMainTransaction && !body.safeConfirmation && !body.executionResult)) {
    throw new CustomError.TechnicalError(
      'ERROR_MISSING_ARGS',
      null,
      'Missing safeMainTransaction or safeConfirmation or executionResult data',
      null
    );
  }

  const collectionName = COLLECTION_NAME;
  const validationSchema = schemas.update;
  console.log('borrowerApproveTransactionRequest args (' + collectionName + '):', body);
  const itemData = await sanitizeData({ data: body, validationSchema });

  try {
    if (!companyId || !id) {
      throw new CustomError.TechnicalError(
        'borrowerApproveTransactionRequest - ERROR_MISSING_ARGS',
        null,
        'Invalid args',
        null
      );
    }

    const existentTransactionRequest = await fetchSingleItem({ collectionName, id });

    console.log(
      'borrowerApproveTransactionRequest - existentTransactionRequest es ',
      existentTransactionRequest
    );

    if (!existentTransactionRequest) {
      throw new CustomError.TechnicalError(
        'borrowerApproveTransactionRequest - ERROR_MISSING_ARGS2',
        null,
        'Invalid args',
        null
      );
    }

    if (existentTransactionRequest.companyId !== companyId) {
      throw new CustomError.TechnicalError(
        'borrowerApproveTransactionRequest - MISSING_PERMISSIONS for Company',
        null,
        'Invalid args',
        null
      );
    }

    console.log(
      'borrowerApproveTransactionRequest - Patch args (' + collectionName + '):',
      JSON.stringify(body)
    );

    // Handle both safeTransaction and safeConfirmation
    if (body.safeMainTransaction) {
      itemData.safeMainTransaction = body.safeMainTransaction;
    }
    if (body.safeConfirmation) {
      const currentConfirmations = existentTransactionRequest.safeConfirmations || [];
      itemData.safeConfirmations = [...currentConfirmations, body.safeConfirmation];
    }

    // Set requestStatus based on current status
    if (existentTransactionRequest.requestStatus === TransactionRequestStatusTypes.REQUESTED) {
      itemData.requestStatus = TransactionRequestStatusTypes.PENDING_APPROVE;
    } else {
      itemData.requestStatus = TransactionRequestStatusTypes.APPROVED;
    }

    const doc = await updateSingleItem({ collectionName, id, auditUid, data: itemData });

    // MRM envío de nueva notificación
    if (
      existentTransactionRequest.requestStatus == TransactionRequestStatusTypes.PENDING_APPROVE &&
      itemData.requestStatus == TransactionRequestStatusTypes.APPROVED
    ) {
      console.log(
        'Estado de la transacción era ',
        existentTransactionRequest.requestStatus,
        ' y ahora es ',
        itemData.requestStatus,
        ' - Transacción Firmada y Aprobada'
      );

      const userOriginator = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: existentTransactionRequest.createdBy,
      });

      const userActive = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: userId,
      });

      const userBorrower = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: existentTransactionRequest.userId,
      });

      // companyId
      const company = await fetchSingleItem({
        collectionName: Collections.COMPANIES,
        id: companyId,
      });

      console.log('userOriginator es ', userOriginator);
      console.log('userActive es ', userActive);
      console.log('userBorrower es ', userBorrower);
      console.log('companyId es ', companyId);

      const message =
        company.name +
        '.  Cliente ' +
        userBorrower.lastName +
        ' ' +
        userBorrower.lastName +
        '.  Bóveda: ' +
        existentTransactionRequest.vaultId +
        '. Transacción por ' +
        existentTransactionRequest.currency +
        ' ' +
        existentTransactionRequest.amount +
        ' firmada y aprobada por ' +
        userActive.firstName +
        ' ' +
        userActive.lastName;

      EmailSender.send({
        to: SYS_ADMIN_EMAIL,
        message: null,
        template: {
          name: 'mail-approved',
          data: {
            useroriginator: userOriginator.firstName,
            cliente: userBorrower.firstName + ' ' + userBorrower.lastName,
            monto: existentTransactionRequest.amount.toFixed(2),
            lender: company.name,
            vaultid: existentTransactionRequest.vaultId,
            transactiontype: existentTransactionRequest.transactionType,
          },
        },
      });

      EmailSender.send({
        to: userOriginator.email,
        message: null,
        template: {
          name: 'mail-approved',
          data: {
            useroriginator: userOriginator.firstName,
            cliente: userBorrower.firstName + ' ' + userBorrower.lastName,
            monto: existentTransactionRequest.amount.toFixed(2),
            lender: company.name,
            vaultid: existentTransactionRequest.vaultId,
            transactiontype: existentTransactionRequest.transactionType,
          },
        },
      });

      console.log(message);
    }
    // Fin nueva notificación

    return res.status(204).send(doc);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.trustApproveTransactionRequest = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const { companyId, id } = req.params;
  const body = req.body;
  console.log('trustApproveTransactionRequest - body es ', body);

  // Modified validation to check for either safeTransaction or safeConfirmation
  if (!body || (!body.safeTransaction && !body.safeConfirmation)) {
    throw new CustomError.TechnicalError(
      'ERROR_MISSING_ARGS',
      null,
      'Missing safeTransaction or safeConfirmation data',
      null
    );
  }

  const collectionName = COLLECTION_NAME;
  const validationSchema = schemas.update;
  console.log('trustApproveTransactionRequest args (' + collectionName + '):', body);
  const itemData = await sanitizeData({ data: body, validationSchema });

  try {
    if (!companyId || !id) {
      throw new CustomError.TechnicalError(
        'trustApproveTransactionRequest - ERROR_MISSING_ARGS',
        null,
        'Invalid args',
        null
      );
    }

    const existentTransactionRequest = await fetchSingleItem({ collectionName, id });

    console.log(
      'trustApproveTransactionRequest - existentTransactionRequest es ',
      existentTransactionRequest
    );

    if (!existentTransactionRequest) {
      throw new CustomError.TechnicalError(
        'trustApproveTransactionRequest - ERROR_MISSING_ARGS2',
        null,
        'Invalid args',
        null
      );
    }

    if (existentTransactionRequest.companyId !== companyId) {
      throw new CustomError.TechnicalError(
        'trustApproveTransactionRequest - MISSING_PERMISSIONS for Company',
        null,
        'Invalid args',
        null
      );
    }

    console.log(
      'trustApproveTransactionRequest - Patch args (' + collectionName + '):',
      JSON.stringify(body)
    );

    // Handle both safeTransaction and safeConfirmation
    if (body.safeMainTransaction) {
      itemData.safeMainTransaction = body.safeMainTransaction;
    }
    if (body.safeConfirmation) {
      const currentConfirmations = existentTransactionRequest.safeConfirmations || [];
      itemData.safeConfirmations = [...currentConfirmations, body.safeConfirmation];
    }

    // Set requestStatus based on current status
    if (existentTransactionRequest.requestStatus === TransactionRequestStatusTypes.REQUESTED) {
      itemData.requestStatus = TransactionRequestStatusTypes.PENDING_APPROVE;
    } else {
      itemData.requestStatus = TransactionRequestStatusTypes.APPROVED;
    }

    const doc = await updateSingleItem({ collectionName, id, auditUid, data: itemData });

    // MRM envío de nueva notificación
    if (
      existentTransactionRequest.requestStatus == TransactionRequestStatusTypes.PENDING_APPROVE &&
      itemData.requestStatus == TransactionRequestStatusTypes.APPROVED
    ) {
      console.log(
        'Estado de la transacción era ',
        existentTransactionRequest.requestStatus,
        ' y ahora es ',
        itemData.requestStatus,
        ' - Transacción Firmada y Aprobada'
      );

      const userOriginator = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: existentTransactionRequest.createdBy,
      });

      const userActive = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: userId,
      });

      const userBorrower = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: existentTransactionRequest.userId,
      });

      // companyId
      const company = await fetchSingleItem({
        collectionName: Collections.COMPANIES,
        id: companyId,
      });

      console.log('userOriginator es ', userOriginator);
      console.log('userActive es ', userActive);
      console.log('userBorrower es ', userBorrower);
      console.log('companyId es ', companyId);

      const message =
        company.name +
        '.  Cliente ' +
        userBorrower.lastName +
        ' ' +
        userBorrower.lastName +
        '.  Bóveda: ' +
        existentTransactionRequest.vaultId +
        '. Transacción por ' +
        existentTransactionRequest.currency +
        ' ' +
        existentTransactionRequest.amount +
        ' firmada y aprobada por ' +
        userActive.firstName +
        ' ' +
        userActive.lastName;

      EmailSender.send({
        to: SYS_ADMIN_EMAIL,
        message: null,
        template: {
          name: 'mail-approved',
          data: {
            useroriginator: userOriginator.firstName,
            cliente: userBorrower.firstName + ' ' + userBorrower.lastName,
            monto: existentTransactionRequest.amount.toFixed(2),
            lender: company.name,
            vaultid: existentTransactionRequest.vaultId,
            transactiontype: existentTransactionRequest.transactionType,
          },
        },
      });

      EmailSender.send({
        to: userOriginator.email,
        message: null,
        template: {
          name: 'mail-approved',
          data: {
            useroriginator: userOriginator.firstName,
            cliente: userBorrower.firstName + ' ' + userBorrower.lastName,
            monto: existentTransactionRequest.amount.toFixed(2),
            lender: company.name,
            vaultid: existentTransactionRequest.vaultId,
            transactiontype: existentTransactionRequest.transactionType,
          },
        },
      });

      console.log(message);
    }
    // Fin nueva notificación

    return res.status(204).send(doc);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.onRequestUpdate = functions.firestore
  .document(COLLECTION_NAME + '/{docId}')
  .onUpdate(async (change, context) => {
    const { docId } = context.params;
    const before = change.before.data();
    const after = change.after.data();
    console.log(
      'onRequestUpdate Estado de la transacción era ',
      before.requestStatus,
      ' y ahora es ',
      after.requestStatus
    );

    if (
      before.requestStatus === TransactionRequestStatusTypes.PENDING_APPROVE &&
      after.requestStatus === TransactionRequestStatusTypes.APPROVED &&
      after.transactionType === 'liquidate'
    ) {
      console.log('withdraw - mando mails de liquidación ' + docId);

      // const employee = await fetchSingleItem({ collectionName: Collections.USERS, id: after.auditUid });
      // const lender = await fetchSingleItem({ collectionName: Collections.COMPANIES, id: after.companyId });
      const borrower = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: after.userId,
      });
      const vault = await fetchSingleItem({
        collectionName: Collections.VAULTS,
        id: after.vaultId,
      });

      const company = await fetchSingleItem({
        collectionName: Collections.COMPANIES,
        id: after.companyId,
      });

      await EmailSender.send({
        to: borrower.email,
        message: null,
        template: {
          name: 'mail-liquidate',
          data: {
            username: borrower.firstName + ' ' + borrower.lastName,
            vaultId: vault.id,
            lender: company.name,
            value: after.amount.toFixed(2),
            currency: after.currency,
            vaultType: vault.vaultType,
            creditType: vault.creditType,
            serviceLevel: vault.serviceLevel,
          },
        },
      });

      await EmailSender.send({
        to: SYS_ADMIN_EMAIL,
        message: null,
        template: {
          name: 'mail-liquidate',
          data: {
            username: borrower.firstName + ' ' + borrower.lastName,
            vaultId: vault.id,
            lender: company.name,
            value: after.amount.toFixed(2),
            currency: after.currency,
            vaultType: vault.vaultType,
            creditType: vault.creditType,
            serviceLevel: vault.serviceLevel,
          },
        },
      });

      // Envio aviso al empleado que pidió la liquidación
      const userOriginator = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: after.createdBy,
      });

      await EmailSender.send({
        to: userOriginator.email,
        message: null,
        template: {
          name: 'mail-liquidate',
          data: {
            username: userOriginator.firstName + ' ' + userOriginator.lastName,
            vaultId: vault.id,
            lender: company.name,
            value: after.amount.toFixed(2),
            currency: after.currency,
            vaultType: vault.vaultType,
            creditType: vault.creditType,
            serviceLevel: vault.serviceLevel,
          },
        },
      });
    }

    if (
      before.requestStatus === TransactionRequestStatusTypes.PENDING_APPROVE &&
      after.requestStatus === TransactionRequestStatusTypes.APPROVED &&
      after.transactionType === 'rescue'
    ) {
      console.log('rescue - mando mails de rescate ' + docId);

      // const employee = await fetchSingleItem({ collectionName: Collections.USERS, id: after.auditUid });
      // const lender = await fetchSingleItem({ collectionName: Collections.COMPANIES, id: after.companyId });
      const borrower = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: after.userId,
      });
      const vault = await fetchSingleItem({
        collectionName: Collections.VAULTS,
        id: after.vaultId,
      });

      const company = await fetchSingleItem({
        collectionName: Collections.COMPANIES,
        id: after.companyId,
      });

      await EmailSender.send({
        to: borrower.email,
        message: null,
        template: {
          name: 'mail-rescue',
          data: {
            username: borrower.firstName + ' ' + borrower.lastName,
            vaultId: vault.id,
            lender: company.name,
            value: after.amount.toFixed(2),
            currency: after.currency,
          },
        },
      });

      await EmailSender.send({
        to: SYS_ADMIN_EMAIL,
        message: null,
        template: {
          name: 'mail-rescue',
          data: {
            username: borrower.firstName + ' ' + borrower.lastName,
            vaultId: vault.id,
            lender: company.name,
            value: after.amount.toFixed(2),
            currency: after.currency,
          },
        },
      });

      // Envio aviso al empleado que firmó la transacción
      const userSigner = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: after.updatedBy,
      });

      await EmailSender.send({
        to: userSigner.email,
        message: null,
        template: {
          name: 'mail-rescue',
          data: {
            username: userSigner.firstName + ' ' + userSigner.lastName,
            vaultId: vault.id,
            lender: company.name,
            value: after.amount.toFixed(2),
            currency: after.currency,
          },
        },
      });
    }

    // Primera firma
    if (
      before.requestStatus == TransactionRequestStatusTypes.REQUESTED &&
      after.requestStatus == TransactionRequestStatusTypes.PENDING_APPROVE
    ) {
      console.log(
        'Estado de la transacción era ',
        after.requestStatus,
        ' y ahora es ',
        after.requestStatus,
        ' - Transacción Firmada'
      );

      const userOriginator = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: after.createdBy,
      });

      const company = await fetchSingleItem({
        collectionName: Collections.COMPANIES,
        id: after.companyId,
      });

      const borrower = await fetchSingleItem({
        collectionName: Collections.USERS,
        id: after.userId,
      });

      // Envío mail a admin y al lender
      EmailSender.send({
        to: SYS_ADMIN_EMAIL,
        message: null,
        template: {
          name: 'mail-signature',
          data: {
            useroriginator: userOriginator.firstName,
            cliente: borrower.firstName + ' ' + borrower.lastName,
            monto: after.amount.toFixed(2),
            current: after.currency,
            lender: company.name,
            vaultid: after.vaultId,
            tipodetransaccion: after.transactionType,
          },
        },
      });
      // TODO Esto debe ser al borrower
      EmailSender.send({
        to: userOriginator.email,
        message: null,
        template: {
          name: 'mail-signature',
          data: {
            useroriginator: userOriginator.firstName,
            cliente: borrower.firstName + ' ' + borrower.lastName,
            monto: after.amount.toFixed(2),
            current: after.currency,
            lender: company.name,
            vaultid: after.vaultId,
            tipodetransaccion: after.transactionType,
          },
        },
      });
    }

    return null;
  });
