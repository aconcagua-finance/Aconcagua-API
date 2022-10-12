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
const { areEqualStringLists, areDeepEqualDocuments } = require('../../helpers/coreHelper');

const schemas = require('./schemas');

const {
  MULTIPLE_RELATIONSHIP_SUFFIX,
  sanitizeData,
  find,
  findWithUserRelationship,
  get,
  patch,
  remove,
  create,
  createInner,
  fetchSingleItem,
  fetchItems,
  updateSingleItem,
  filterItems,
  fetchItemsByIds,
  getWithUserRelationshipById,
} = require('../baseEndpoint');

const COLLECTION_NAME = Collections.USERS_BY_STAFF;
const INDEXED_FILTERS = ['userId', 'staffId'];

// La fn findWithUserRelationship pretende recibir como value de PRIMARY_ENTITY_PROPERTY_NAME el id de usuario del staff.
// En la fn findWithUserRelationship se recibi por param 'userId' y desde el front se envia el id del staff... medio raro, TODO FIX
const PRIMARY_ENTITY_PROPERTY_NAME = 'staffId';
const SECONDARY_ENTITY_PROPERTY_NAME = 'userId';
const TARGET_COLLECTION_NAME = Collections.USERS;

// used by ADMIN
exports.find = async function (req, res) {
  await findWithUserRelationship({
    req,
    res,
    collectionName: COLLECTION_NAME,
    indexedFilters: INDEXED_FILTERS,
    primaryEntityPropertyName: PRIMARY_ENTITY_PROPERTY_NAME,
    secondaryEntityPropertyName: SECONDARY_ENTITY_PROPERTY_NAME,
    targetCollectionName: TARGET_COLLECTION_NAME,
  });
};

// used by ADMIN / PRACTITIONER
exports.findByStaff = async function (req, res) {
  await findWithUserRelationship({
    req,
    res,
    collectionName: COLLECTION_NAME,
    indexedFilters: INDEXED_FILTERS,
    primaryEntityPropertyName: PRIMARY_ENTITY_PROPERTY_NAME,
    secondaryEntityPropertyName: SECONDARY_ENTITY_PROPERTY_NAME,
    targetCollectionName: TARGET_COLLECTION_NAME,
  });
};

exports.findByUser = async function (req, res) {
  await findWithUserRelationship({
    req,
    res,
    collectionName: COLLECTION_NAME,
    indexedFilters: INDEXED_FILTERS,
    primaryEntityPropertyName: SECONDARY_ENTITY_PROPERTY_NAME,
    secondaryEntityPropertyName: PRIMARY_ENTITY_PROPERTY_NAME,
    targetCollectionName: Collections.STAFF,
  });
};

exports.get = async function (req, res) {
  const { id } = req.params;

  await getWithUserRelationshipById({
    req,
    res,
    collectionName: COLLECTION_NAME,
    indexedFilters: INDEXED_FILTERS,
    primaryEntityPropertyName: 'userId',
    secondaryEntityPropertyName: 'staffId',
    targetCollectionName: Collections.STAFF,
    byId: id,
    // postProcessor: async (item) => {
    //   if (item.dueDate) item.dueDate = item.dueDate.toDate();
    //   return item;
    // },
  });
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  await patch(req, res, auditUid, COLLECTION_NAME, schemas.update);
};

// solo para este caso el remove es fisico
exports.remove = async function (req, res) {
  try {
    const { id } = req.params;
    const { userId } = res.locals; // user id

    const db = admin.firestore();

    // remove document.
    await db.collection(COLLECTION_NAME).doc(id).delete();

    return res.status(204).send(id);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;
  const { userId: targetUserId } = req.params;

  const body = req.body;
  body.userId = targetUserId;
  // body.staffId = body.staffId;

  body.grants = ['creator', Collections.USER_TASKS + '.all']; // TODO MICHEL

  await createInner({
    req,
    res,
    body,
    auditUid,
    collectionName: COLLECTION_NAME,
    validationSchema: schemas.create,
  });
};
