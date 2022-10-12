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
const { areEqualStringLists } = require('../../helpers/coreHelper');

const schemas = require('./schemas');

const { createUserTouchpoint } = require('../userTouchpoints/controller');

const {
  find,
  get,
  patch,
  remove,
  create,
  createInner,
  fetchSingleItem,
  fetchItems,
  updateSingleItem,
  filterItems,
  findWithUserRelationship,
} = require('../baseEndpoint');

const COLLECTION_NAME = Collections.USER_TASKS;
const HISTORY_COLLECTION_NAME = Collections.USER_TASKS_HISTORY;

const INDEXED_FILTERS = ['userId', 'taskId'];
const PRIMARY_ENTITY_PROPERTY_NAME = 'userId';
const SECONDARY_ENTITY_PROPERTY_NAME = 'taskId';
const TARGET_COLLECTION_NAME = Collections.TASKS;

exports.findByUser = async function (req, res) {
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

exports.findByUser2 = async function (req, res) {
  try {
    const { userId } = req.params;

    // / movies?filters[movies]=USA&fields[]=id&fields[]=name
    let { limit, offset, filters, state, indexedFilters } = req.query;

    if (limit) limit = parseInt(limit);

    let filterState = state;
    if (!filterState) filterState = Types.StateTypes.STATE_ACTIVE;

    if (!filters) filters = [];

    filters.push({ key: 'userId', operator: '==', value: userId });

    const items = await fetchItems({
      collectionName: COLLECTION_NAME,
      filterState,
      filters,
      indexedFilters: INDEXED_FILTERS,
    });

    console.log('OK - all - fetch: ' + items.length, filters, items);

    const filteredItems = filterItems({ items, limit, offset, filters });

    if (filteredItems.items) console.log('OK - all - filter: ' + filteredItems.items.length);

    return res.send(filteredItems);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME);
};

exports.get = async function (req, res) {
  await get(req, res, COLLECTION_NAME);
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
  const { userId } = res.locals;
  const auditUid = userId;
  const { userId: targetUserId } = req.params;

  const body = req.body;
  body.userId = targetUserId;

  await createInner({
    req,
    res,
    body,
    auditUid,
    collectionName: COLLECTION_NAME,
    validationSchema: schemas.create,
  });
};

exports.upsert = async function (req, res) {
  try {
    const { userId } = res.locals;
    const { userId: targetUserId } = req.params;

    const auditUid = userId;

    const _validationOptions = {
      abortEarly: false, // abort after the last validation error
      allowUnknown: true, // allow unknown keys that will be ignored
      stripUnknown: true, // remove unknown keys from the validated data
    };

    const requestData = await schemas.upsert.validateAsync(req.body, _validationOptions);

    if (!targetUserId || requestData.userId !== targetUserId) {
      throw new CustomError.TechnicalError('ERROR_UPSERT_USER_TASKS', null, 'invalid args', null);
    }

    console.log('Upsert user tasks', JSON.stringify(requestData));

    const databaseItems = await fetchItems({
      collectionName: COLLECTION_NAME,
      filters: {
        [PRIMARY_ENTITY_PROPERTY_NAME]: { $equal: targetUserId },
      },

      indexedFilters: ['userId'], // [{ key: 'userId', operator: '==', value: targetUserId }],
    });

    console.log('Items existentes: ' + JSON.stringify(databaseItems));

    // return res.send(databaseItems);

    const db = admin.firestore();

    const toAddUserTasks = [];
    const toUpdateUserTasks = [];
    const toRemoveUserTasks = [];

    requestData.tasks.forEach((userTask) => {
      const existentDatabaseUserTask = databaseItems.find((item) => {
        return item.taskId === userTask.taskId;
      });

      if (!existentDatabaseUserTask) {
        toAddUserTasks.push(userTask);
        return;
      }

      if (
        existentDatabaseUserTask.status !== userTask.status ||
        existentDatabaseUserTask.rate !== userTask.rate ||
        existentDatabaseUserTask.notes !== userTask.notes
      ) {
        toUpdateUserTasks.push({ ...existentDatabaseUserTask, ...userTask });
        // eslint-disable-next-line no-useless-return
        return;
      }
    });

    databaseItems.filter((databaseItem) => {
      // si hay un item en la base de datos que no encuentro en el request, entonces debería eliminarlo
      const foundedTask = requestData.tasks.find((t) => {
        return t.taskId === databaseItem.taskId;
      });

      if (!foundedTask) toRemoveUserTasks.push(databaseItem);
    });

    const batch = db.batch();

    toUpdateUserTasks.forEach((t) => {
      const updateData = { ...t, ...updateStruct(auditUid) };

      const ref = db.collection(COLLECTION_NAME).doc(t.id);
      batch.update(ref, updateData);
    });

    toAddUserTasks.forEach((t) => {
      const newDocData = {
        ...t,
        userId: targetUserId,
        state: Types.StateTypes.STATE_ACTIVE,

        ...creationStruct(auditUid),
        ...updateStruct(auditUid),
      };
      const ref = db.collection(COLLECTION_NAME).doc();
      batch.set(ref, newDocData);
    });

    toRemoveUserTasks.forEach((t) => {
      const ref = db.collection(COLLECTION_NAME).doc(t.id);
      batch.delete(ref);
    });

    await batch.commit();

    return res.send(databaseItems);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

const onCreateThenCreateHistoryData = async function ({ docId, documentPath, before, after }) {
  try {
    // const auditUid = after.updatedBy;

    const updateData = {
      ...after,
      docId,
    };

    const db = admin.firestore();
    const doc = await db.collection(HISTORY_COLLECTION_NAME).doc().set(updateData);

    console.log('Done onCreateThenCreateHistoryData');
  } catch (err) {
    console.error('error onCreateThenCreateHistoryData document', documentPath, err);

    return null;
  }
};

const onUpdateThenCreateHistoryData = async function ({ docId, documentPath, before, after }) {
  try {
    // const auditUid = after.updatedBy;

    const updateData = {
      ...after,
      docId,
    };

    const db = admin.firestore();
    const doc = await db.collection(HISTORY_COLLECTION_NAME).doc().set(updateData);

    console.log('Done onUpdateThenCreateHistoryData');
  } catch (err) {
    console.error('error onUpdateThenCreateHistoryData', documentPath, err);

    return null;
  }
};

const onCreateThenCreateUserTouchpoint = async function ({ docId, documentPath, before, after }) {
  try {
    const auditUid = after.createdBy;

    const body = {
      userId: after.userId,
      channelType: 'automation',
      message: 'Habits follow up',
      staff: auditUid,
      touchpointDate: new Date(Date.now()),
    };

    await createUserTouchpoint({ body, auditUid });

    console.log('Done onCreateThenCreateUserTouchpoint');
  } catch (err) {
    console.error('error onCreateThenCreateUserTouchpoint document', documentPath, err);

    return null;
  }
};

const onUpdateThenCreateUserTouchpoint = async function ({ docId, documentPath, before, after }) {
  try {
    const auditUid = after.createdBy;

    const body = {
      userId: after.userId,
      channelType: 'automation',
      message: 'Habits follow up',
      staff: auditUid,
      touchpointDate: new Date(Date.now()),
    };

    await createUserTouchpoint({ body, auditUid });

    console.log('Done onUpdateThenCreateUserTouchpoint');
  } catch (err) {
    console.error('error onUpdateThenCreateUserTouchpoint', documentPath, err);

    return null;
  }
};

exports.onUserTaskCreate = functions.firestore
  .document(COLLECTION_NAME + '/{docId}')
  .onCreate(async (snapshot, context) => {
    const { docId } = context.params;
    // const docId = snapshot.key;
    const documentPath = `${COLLECTION_NAME}/${docId}`;

    const before = null;
    const after = snapshot.data();

    console.log('CREATED ' + documentPath);

    await onCreateThenCreateHistoryData({ docId, documentPath, before, after });

    await onCreateThenCreateUserTouchpoint({ docId, documentPath, before, after });

    return null;
  });

exports.onUserTaskUpdate = functions.firestore
  .document(COLLECTION_NAME + '/{docId}')
  .onUpdate(async (change, context) => {
    const { docId } = context.params;
    const documentPath = `${COLLECTION_NAME}/${docId}`;
    const before = change.before.data();
    const after = change.after.data();

    console.log('UPDATED ' + documentPath);

    await onUpdateThenCreateHistoryData({ docId, documentPath, before, after });

    await onUpdateThenCreateUserTouchpoint({ docId, documentPath, before, after });

    return null;
  });
