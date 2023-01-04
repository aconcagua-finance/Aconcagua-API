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

const { areEqualStringLists, areDeepEqualDocuments } = require('../../helpers/coreHelper');

const { setUserClaims } = require('../admin/controller');

const schemas = require('./schemas');

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

exports.find = async function (req, res) {
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

    // primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
    // primaryEntityCollectionName: Collections.COMPANIES,
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

  const { companyId } = req.params;

  const body = req.body;
  body.companyId = companyId;

  const collectionName = COLLECTION_NAME;
  const validationSchema = schemas.update;

  try {
    const { id } = req.params;

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

exports.create = async function (req, res) {
  const { userId: auditUid } = res.locals;

  const { companyId, userId, vaultId } = req.params;

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
    body.userId = userId;
    body.vaultId = vaultId;
    body.requestStatus = 'pending'; // TODO normalizar, igual a formOptions de TransactionRequests en admin

    const collectionName = COLLECTION_NAME;
    const validationSchema = schemas.create;

    console.log('Create args (' + collectionName + '):', body);

    const itemData = await sanitizeData({ data: body, validationSchema });

    const arsCurrency = Types.CurrencyTypes.ARS;

    let arsDepositsAmount = 0;
    const arsCredit = vault.amount;

    const arsBalanceItem = vault.balances.find((balance) => {
      return balance.currency === arsCurrency;
    });

    if (arsBalanceItem) arsDepositsAmount = arsBalanceItem.balance;

    if (
      itemData.amount > arsDepositsAmount ||
      itemData.amount > arsCredit ||
      arsDepositsAmount - itemData.amount < arsCredit * 1.1
    ) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE_EXCEED_AMOUNT',
        null,
        'Monto de la transacción está excedido',
        null
      );
    } else if (itemData.amount <= 0) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE_INVALID_AMOUNT',
        null,
        'Monto de la transacción no puede ser negativo o cero',
        null
      );
    }

    if (!companyId) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE',
        null,
        'Error creating. Missing args',
        null
      );
    }

    const createArgs = { collectionName, itemData, auditUid };

    const dbItemData = await createFirestoreDocument(createArgs);

    console.log('Create data: (' + collectionName + ')', dbItemData);

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
