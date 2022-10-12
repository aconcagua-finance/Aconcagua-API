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

const schemas = require('./schemas');

const {
  find,
  get,
  patch,
  remove,
  create,
  createInner,
  fetchSingleItem,
  updateSingleItem,
  fetchItemsByIds,
  sanitizeData,
  createFirestoreDocument,
  findWithUserRelationship,
  getWithUserRelationshipById,
  MULTIPLE_RELATIONSHIP_SUFFIX,
} = require('../baseEndpoint');

const COLLECTION_NAME = Collections.USER_TOUCHPOINTS;
const INDEXED_FILTERS = ['userId'];
const PRIMARY_ENTITY_PROPERTY_NAME = 'userId';
const SECONDARY_ENTITY_PROPERTY_NAME = 'staff';
const TARGET_COLLECTION_NAME = Collections.STAFF;

exports.findByUser = async function (req, res) {
  await findWithUserRelationship({
    req,
    res,
    collectionName: COLLECTION_NAME,
    indexedFilters: INDEXED_FILTERS,
    primaryEntityPropertyName: PRIMARY_ENTITY_PROPERTY_NAME,
    secondaryEntityPropertyName: SECONDARY_ENTITY_PROPERTY_NAME,
    targetCollectionName: TARGET_COLLECTION_NAME,
    postProcessor: async (item) => {
      if (item && item.touchpointDate) item.touchpointDate = item.touchpointDate.toDate();

      return item;
    },
  });
};

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME);
};

exports.get = async function (req, res) {
  const { id } = req.params;

  await getWithUserRelationshipById({
    req,
    res,
    collectionName: COLLECTION_NAME,
    indexedFilters: INDEXED_FILTERS,
    primaryEntityPropertyName: PRIMARY_ENTITY_PROPERTY_NAME,
    secondaryEntityPropertyName: SECONDARY_ENTITY_PROPERTY_NAME,
    targetCollectionName: TARGET_COLLECTION_NAME,
    byId: id,
    postProcessor: async (item) => {
      if (item && item.touchpointDate) item.touchpointDate = item.touchpointDate.toDate();

      return item;
    },
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

exports.createUserTouchpoint = async function ({ body, auditUid }) {
  const validationSchema = schemas.create;
  const collectionName = COLLECTION_NAME;

  console.log('createUserTouchpoint body: ' + JSON.stringify(body));

  const itemData = await sanitizeData({ data: body, validationSchema });

  const dbItemData = await createFirestoreDocument({ collectionName, itemData, auditUid });

  console.log('Create data: (' + collectionName + ')', dbItemData);
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;
  const { userId: targetUserId } = req.params;

  const body = req.body;
  body.userId = targetUserId;

  // if (!body.touchpointDate) body.touchpointDate = new Date(Date.now());

  await createInner({
    req,
    res,
    body,
    auditUid,
    collectionName: COLLECTION_NAME,
    validationSchema: schemas.create,
  });
};

exports.onUserTouchpointUpdate = functions.firestore
  .document(COLLECTION_NAME + '/{docId}')
  .onUpdate(async (change, context) => {
    const { docId } = context.params;
    const documentPath = `${COLLECTION_NAME}/${docId}`;
    const before = change.before.data();
    const after = change.after.data();

    console.log('UPDATED ' + documentPath);
  });

exports.onUserTouchpointCreate = functions.firestore
  .document(COLLECTION_NAME + '/{docId}')
  .onCreate(async (snapshot, context) => {
    const { docId } = context.params;
    // const docId = snapshot.key;
    const documentPath = `${COLLECTION_NAME}/${docId}`;
    try {
      const before = null;
      const after = snapshot.data();

      console.log('CREATED ' + documentPath);

      const auditUid = after.updatedBy;

      if (!after.userId) return;

      const updateData = {
        lastTouchpoint: admin.firestore.FieldValue.serverTimestamp(), // new Date(Date.now())

        ...updateStruct(auditUid),
      };

      // TODO MICHEL - VALIDATE SCHEMA

      const db = admin.firestore();
      const doc = await db.collection(Collections.USERS).doc(after.userId).update(updateData);
    } catch (err) {
      console.error('error onCreate document', documentPath, err);

      return null;
    }
  });
