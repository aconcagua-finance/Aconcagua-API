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

const {
  find,
  get,
  patch,
  remove,
  create,
  fetchSingleItem,
  updateSingleItem,
  sanitizeReqData,
  sanitizeData,
  createFirestoreDocument,
  createFirestoreDocumentId,
  getFirebaseUsersByIds,
  getFirebaseUserById,
  getFirebaseUserByEmail,
} = require('../baseEndpoint');

const { PaymentStatusType } = require('../../types/paymentStatusTypes');
const { UserStatusTypes } = require('../../types/userStatusTypes');

const usersSchemas = require('../users/schemas');
const { createUser, fetchAndUpdateUserAppRols } = require('../users/controller');

const COLLECTION_NAME = Collections.STAFF;

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME, null, async (items) => {
    const allItems = items.items.map((item) => {
      if (item.birthDate) item.birthDate = item.birthDate.toDate();
      return item;
    });

    items.items = allItems;

    return items;
  });
};

exports.get = async function (req, res) {
  await get(req, res, COLLECTION_NAME, async (item) => {
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
  try {
    const { userId } = res.locals;
    const auditUid = userId;

    const { id } = req.params;
    const documentId = id;

    const existentUser = await getFirebaseUserById(documentId);

    const newRols = [];

    existentUser.appRols.forEach((appRol) => {
      if (appRol === Types.AppRols.APP_STAFF) return;

      newRols.push(appRol);
    });
    // tmb borro el rol al usuario asociado
    await fetchAndUpdateUserAppRols({
      auditUid,
      userId: documentId,
      appRols: newRols,
    });
  } catch (e) {
    return ErrorHelper.handleError(req, res, e);
  }

  await remove(req, res, COLLECTION_NAME);
};

const mapUserFromStaff = async function ({ staff, appRols }) {
  const newUserData = {
    ...staff,
    paymentData: {
      type: 'freepass',
      friendlyName: '****',
      identification: '****',
      status: PaymentStatusType.VERIFIED,
    },

    id: staff.id,

    appUserStatus: UserStatusTypes.ACTIVE,

    appRols,
  };

  const itemData = await sanitizeData({ data: newUserData, validationSchema: usersSchemas.create });

  itemData.id = staff.id;

  return itemData;
};

exports.create = async function (req, res) {
  try {
    const { userId } = res.locals;
    const auditUid = userId;

    const validationSchema = schemas.create;
    const collectionName = COLLECTION_NAME;

    console.log('Create args:', req.body);

    const itemData = await sanitizeReqData({ req, validationSchema });

    let documentId = await createFirestoreDocumentId({ collectionName });

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
      existentUser = await getFirebaseUserByEmail(itemData.email);

      documentId = existentUser.uid;
    } catch (e) {}

    // if (existentUser) {
    //   // throw new CustomError.TechnicalError(
    //   //   'ERROR_DUPLICATED_EMAIL',
    //   //   null,
    //   //   'Ya existía el usuario con email ' + itemData.email,
    //   //   null
    //   // );

    //   existentUser.
    // }

    itemData.applicativeUserId = documentId;

    const dbItemData = await createFirestoreDocument({
      collectionName,
      itemData,
      auditUid,
      documentId,
    });

    console.log('Create data:', dbItemData);

    if (existentUser) {
      await fetchAndUpdateUserAppRols({
        auditUid,
        userId: documentId,
        appRols: [Types.AppRols.APP_STAFF],
      });
    } else {
      const newFirebaseUser = await mapUserFromStaff({
        staff: dbItemData,
        appRols: [Types.AppRols.APP_STAFF],
      });

      console.log(
        'Se envia a crear el usuario asociado al staff:',
        JSON.stringify(newFirebaseUser)
      );

      // Creo el usuario de firebase con el mail asociado
      await createUser({
        auditUid,
        userData: newFirebaseUser,
        appUserStatus: newFirebaseUser.appUserStatus,
      });
    }
    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
