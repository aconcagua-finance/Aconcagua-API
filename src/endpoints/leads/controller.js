/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');

const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');

const { CustomError } = require('../../vs-core');

const { Collections } = require('../../types/collectionsTypes');

const schemas = require('./schemas');
const usersSchemas = require('../users/schemas');

const { PaymentStatusType } = require('../../types/paymentStatusTypes');
const { UserStatusTypes } = require('../../types/userStatusTypes');
const { LeadStatusTypes } = require('../../types/leadStatusTypes');

const { createUser } = require('../users/controller');

const {
  find,
  get,
  patch,
  remove,
  fetchSingleItem,
  updateSingleItem,
  getFirebaseUsersByIds,
  getFirebaseUserById,
  getFirebaseUserByEmail,
} = require('../baseEndpoint');

// eslint-disable-next-line camelcase
const { invoke_post_airtable } = require('../../helpers/httpInvoker');

const COLLECTION_NAME = Collections.LEADS;

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME);
};

exports.get = async function (req, res) {
  await get(req, res, COLLECTION_NAME, (item) => {
    if (item.birthDate) item.birthDate = item.birthDate.toDate();

    return item;
  });
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  await patch(req, res, auditUid, COLLECTION_NAME, schemas.update);
};

exports.remove = async function (req, res) {
  await remove(req, res, COLLECTION_NAME);
};

exports.create = async function (req, res) {
  try {
    const { userId } = res.locals;

    let auditUid = userId;

    if (!auditUid) auditUid = 'admin';

    console.log('Create args:', req.body);

    const _validationOptions = {
      abortEarly: false, // abort after the last validation error
      allowUnknown: true, // allow unknown keys that will be ignored
      stripUnknown: true, // remove unknown keys from the validated data
    };

    const itemData = await schemas.create.validateAsync(req.body, _validationOptions);

    const db = admin.firestore();

    const newDoc = db.collection(COLLECTION_NAME).doc();
    const itemId = newDoc.id;

    const dbItemData = {
      ...itemData,
      id: itemId,

      state: Types.StateTypes.STATE_ACTIVE,
      ...creationStruct(auditUid),
      ...updateStruct(auditUid),
    };

    console.log('Create data:', dbItemData);

    // try {
    //   await invoke_post_airtable({
    //     endpoint: '/Users',
    //     payload: {
    //       records: [
    //         {
    //           fields: {
    //             Name: itemData.firstName + ' ' + itemData.lastName,
    //             'Phone Number': itemData.phoneNumber,
    //             Progress: 'Sin contactar / sin prototipo',
    //           },
    //         },
    //       ],
    //     },
    //   });
    // } catch (e) {
    //   console.error('Error al invocar a airtable');
    //   throw e;
    // }

    const doc = await db.collection(COLLECTION_NAME).doc(itemId).set(dbItemData);

    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

const payment = async function ({
  creditCardNumber,
  creditCardExpirity,
  creditCardHolder,
  creditCardCode,
  packageId,
  priceType,
}) {
  if (
    // !uid ||
    !creditCardNumber ||
    !creditCardExpirity ||
    !creditCardHolder ||
    !creditCardCode ||
    !packageId ||
    !priceType
  ) {
    throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);
  }

  console.log('TODO MICHEL - Aca hacer el pago, si todo esta OK avanzar con la creacion del lead');

  const lastFourDigits = creditCardNumber.substring(
    creditCardNumber.length,
    creditCardNumber.length - 4
  );

  return { lastFourDigits };
};

const mapUserFromLead = async function ({ lead, paymentResult, appRols }) {
  const newUserData = {
    ...lead,
    paymentData: {
      status: PaymentStatusType.PENDING,
    },

    id: lead.id,

    appUserStatus: UserStatusTypes.ACTIVE,

    appRols,
  };

  if (paymentResult) {
    newUserData.paymentData = {
      type: ['credit-card'],
      friendlyName: '**** **** **** ' + paymentResult.lastFourDigits,
      identification: paymentResult.lastFourDigits,
      status: [PaymentStatusType.VERIFIED],
    };
  }

  const _validationOptions = {
    abortEarly: false, // abort after the last validation error
    allowUnknown: true, // allow unknown keys that will be ignored
    stripUnknown: true, // remove unknown keys from the validated data
  };
  const itemData = await usersSchemas.create.validateAsync(newUserData, _validationOptions);

  itemData.id = lead.id;

  return itemData;
};

exports.checkout = async function (req, res) {
  try {
    const _validationOptions = {
      abortEarly: false, // abort after the last validation error
      allowUnknown: true, // allow unknown keys that will be ignored
      stripUnknown: true, // remove unknown keys from the validated data
    };

    // sanitize input
    const itemData = await schemas.create.validateAsync(req.body, _validationOptions);

    // get audit user id
    const { userId } = res.locals;
    let auditUid = userId;
    if (!auditUid) auditUid = itemData.id; // si el creador es un usuario autenticado dejo ese, sino asumo que es un lead y el mismo se dio de alta

    const db = admin.firestore();

    // Fetch lead
    const lead = fetchSingleItem(itemData.id);

    if (lead.birthDate) lead.birthDate = lead.birthDate.toDate();

    // make payment
    const paymentResult = await payment(itemData);

    const newFirebaseUser = await mapUserFromLead({
      lead,
      paymentResult,

      appRols: [Types.AppRols.APP_CLIENT],
    });

    if (!newFirebaseUser.email) {
      throw new CustomError.TechnicalError(
        'ERROR_MISSING_EMAIL',
        null,
        'Previus to user creations lead must have an email',
        null
      );
    }

    const documentId = newFirebaseUser.id;

    let existentUser = null;
    try {
      existentUser = await getFirebaseUserById(documentId);
    } catch (e) {}

    if (existentUser) {
      throw new CustomError.TechnicalError(
        'ERROR_DUPLICATED_ID',
        null,
        'Ya existía el usuario con id ' + documentId,
        null
      );
    }

    try {
      existentUser = await getFirebaseUserByEmail(newFirebaseUser.email);
    } catch (e) {}

    if (existentUser) {
      throw new CustomError.TechnicalError(
        'ERROR_DUPLICATED_EMAIL',
        null,
        'Ya existía el usuario con email ' + newFirebaseUser.email,
        null
      );
    }

    console.log('Se envia a crear el usuario asociado al lead:', JSON.stringify(newFirebaseUser));

    // Creo el usuario de firebase con el mail asociado
    await createUser({
      auditUid,
      userData: newFirebaseUser,
      appUserStatus: newFirebaseUser.appUserStatus,
    });

    await updateSingleItem({
      collectionName: COLLECTION_NAME,
      id: lead.id,
      auditUid,
      data: { leadStatus: [LeadStatusTypes.CONVERTED] },
    });

    console.log('Checkout OK');

    return res.status(201).send(newFirebaseUser);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.convert = async function (req, res) {
  try {
    const { id: leadId } = req.params;

    console.log('Convert lead to user: ' + leadId);

    const _validationOptions = {
      abortEarly: false, // abort after the last validation error
      allowUnknown: true, // allow unknown keys that will be ignored
      stripUnknown: true, // remove unknown keys from the validated data
    };

    // sanitize input
    // const itemData = await schemas.create.validateAsync(req.body, _validationOptions);

    // get audit user id
    const { userId } = res.locals;
    let auditUid = userId;
    if (!auditUid) auditUid = leadId; // si el creador es un usuario autenticado dejo ese, sino asumo que es un lead y el mismo se dio de alta

    const db = admin.firestore();

    // Fetch lead
    const lead = await fetchSingleItem({ collectionName: COLLECTION_NAME, id: leadId });

    if (lead.birthDate) lead.birthDate = lead.birthDate.toDate();

    const leadToUserData = await mapUserFromLead({ lead, appRols: [Types.AppRols.APP_CLIENT] });

    if (!leadToUserData.email) {
      throw new CustomError.TechnicalError(
        'ERROR_MISSING_EMAIL',
        null,
        'Previus to user creations lead must have an email',
        null
      );
    }

    const documentId = leadToUserData.id;

    let existentUser = null;
    try {
      existentUser = await getFirebaseUserById(documentId);
    } catch (e) {}

    if (existentUser) {
      throw new CustomError.TechnicalError(
        'ERROR_DUPLICATED_ID',
        null,
        'Ya existía el usuario con id ' + documentId,
        null
      );
    }

    try {
      existentUser = await getFirebaseUserByEmail(leadToUserData.email);
    } catch (e) {}

    if (existentUser) {
      throw new CustomError.TechnicalError(
        'ERROR_DUPLICATED_EMAIL',
        null,
        'Ya existía el usuario con email ' + leadToUserData.email,
        null
      );
    }

    console.log('Se envia a crear el usuario asociado al lead:', JSON.stringify(leadToUserData));

    // Creo el usuario de firebase con el mail asociado
    const newUser = await createUser({
      auditUid,
      userData: leadToUserData,
      appUserStatus: leadToUserData.appUserStatus,
    });

    await updateSingleItem({
      collectionName: COLLECTION_NAME,
      id: lead.id,
      auditUid,
      data: { leadStatus: LeadStatusTypes.CONVERTED },
    });

    console.log('Convert OK');

    return res.status(201).send(newUser);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
