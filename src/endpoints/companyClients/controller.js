/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');

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
  getByProp,
  getFirebaseUserById,
  createFirestoreDocument,
} = require('../baseEndpoint');

const INDEXED_FILTERS = ['userId', 'companyId'];

// La fn findWithUserRelationship pretende recibir como value de PRIMARY_ENTITY_PROPERTY_NAME el id de usuario del staff.
// En la fn findWithUserRelationship se recibi por param 'userId' y desde el front se envia el id del staff... medio raro, TODO FIX
const COMPANY_ENTITY_PROPERTY_NAME = 'companyId';
const USER_ENTITY_PROPERTY_NAME = 'userId';

exports.find = async function (req, res) {
  const { companyId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
      primaryEntityValue: companyId,
      primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: Collections.COMPANY_CLIENTS,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
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
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
      primaryEntityValue: companyId,
      primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: Collections.COMPANY_CLIENTS,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findByUser = async function (req, res) {
  const { userId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: USER_ENTITY_PROPERTY_NAME,
      primaryEntityValue: userId,
      primaryEntityCollectionName: Collections.USERS,
      listByCollectionName: Collections.COMPANY_CLIENTS,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  const { id } = req.params;

  await getByProp({
    req,
    res,

    byId: id,

    primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
    primaryEntityCollectionName: Collections.COMPANIES,
    collectionName: Collections.COMPANY_CLIENTS,

    relationships: [{ collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME }],
  });
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const { userId: targetUserId, companyId } = req.params;

  const body = req.body;
  body.companyId = companyId;

  const collectionName = Collections.COMPANY_CLIENTS;
  const validationSchema = schemas.update;

  try {
    const { id } = req.params;

    if (!id) throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);

    console.log('Patch args (' + collectionName + '):', JSON.stringify(body));

    const itemData = await sanitizeData({ data: body, validationSchema });

    if (!companyId || !targetUserId) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE_COMPANY_CLIENT',
        null,
        'Error creating company client. Missing args',
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
  const { userId } = res.locals;
  const auditUid = userId;

  const { userId: targetUserId, companyId } = req.params;

  if (!companyId || !targetUserId) {
    throw new CustomError.TechnicalError(
      'ERROR_REMOVE_COMPANY_CLIENT',
      null,
      'Error removing company client. Missing args',
      null
    );
  }

  await remove(req, res, Collections.COMPANY_CLIENTS);
};

const createCompanyClientRelationship = async ({ auditUid, data }) => {
  const collectionName = Collections.COMPANY_CLIENTS;
  const validationSchema = schemas.create;

  const itemData = await sanitizeData({ data, validationSchema });

  if (!itemData.companyId || !itemData.userId) {
    throw new CustomError.TechnicalError(
      'ERROR_CREATE_COMPANY_CLIENT',
      null,
      'Error creating company client. Missing args',
      null
    );
  }

  const createArgs = { collectionName, itemData, auditUid };

  // creo la relacion empresa-empleado
  const dbItemData = await createFirestoreDocument(createArgs);

  return dbItemData;
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;
  const { userId: targetUserId, companyId } = req.params;

  const body = req.body;
  body.userId = targetUserId;
  body.companyId = companyId;

  const collectionName = Collections.COMPANY_CLIENTS;
  const validationSchema = schemas.create;

  console.log('Create args (' + collectionName + '):', body);
  try {
    const dbItemData = await createCompanyClientRelationship({ auditUid, data: body });

    console.log('Create data: (' + collectionName + ')', dbItemData);

    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

// eslint-disable-next-line camelcase
exports.onVaultCreate_ThenCreateCompanyClientRelationship = functions.firestore
  .document(Collections.VAULTS + '/{docId}')
  .onUpdate(async (change, context) => {
    const { docId } = context.params;
    const documentPath = `${Collections.VAULTS}/${docId}`;
    const before = change.before.data();
    const after = change.after.data();

    try {
      console.log('onVaultCreate_ThenCreateCompanyClientRelationship ' + documentPath);

      const userId = after.userId;
      const companyId = after.companyId;
      const updatedBy = after.updatedBy;

      const collectionName = Collections.COMPANY_CLIENTS;

      // TODO MICHEL - validar si no existe ya la relacion
      console.log('Obtengo si existe una relacion actualmente');
      const db = admin.firestore();
      const ref = db.collection(collectionName);

      const querySnapshot = await ref
        .where('userId', '==', userId)
        .where('companyId', '==', companyId)
        .get();

      if (!querySnapshot.docs) return [];

      const items = querySnapshot.docs.map((doc) => {
        const id = doc.id;
        const data = doc.data();

        if (data.createdAt) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt) data.updatedAt = data.updatedAt.toDate();

        return { ...data, id };
      });

      // ya existia la relacion
      if (!items.length) {
        const dbItemData = await createCompanyClientRelationship({
          auditUid: updatedBy,
          data: { userId, companyId },
        });

        console.log('Created relationship');
      } else {
        console.log('Relationship pre existent');
      }

      console.log('onVaultCreate_ThenCreateCompanyClientRelationship success ' + documentPath);
    } catch (err) {
      console.error('error onUpdate document', documentPath, err);

      return null;
    }
  });
