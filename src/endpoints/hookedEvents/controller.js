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

const { createUserTouchpoint } = require('../userTouchpoints/controller');
const { HookedEventStatusTypes } = require('../../types/hookedEventStatusTypes');

const { toDateObject } = require('../../helpers/coreHelper');

const {
  createUserCalendarEvent,
  updateUserCalendarEvent,
} = require('../userCalendarEvents/controller');

const schemas = require('./schemas').default;

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
  getFirebaseUserById,
  getWithUserRelationshipById,
  MULTIPLE_RELATIONSHIP_SUFFIX,
  sanitizeReqData,
} = require('../baseEndpoint');

const COLLECTION_NAME = Collections.HOOKED_EVENTS;
const INDEXED_FILTERS = ['userId', 'assignedTo', 'eventStatus'];
const PRIMARY_ENTITY_PROPERTY_NAME = 'userId';
const SECONDARY_ENTITY_PROPERTY_NAME = 'assignedTo';
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
    postProcessor: async (items) => {
      const allItems = items.items.map((item) => {
        if (item.startDate) item.startDate = item.startDate.toDate();
        if (item.dueDate) item.dueDate = item.dueDate.toDate();
        return item;
      });

      items.items = allItems;

      return items;
    },
  });
};

// used by ADMIN / PRACTITIONER
exports.findByStaff = async function (req, res) {
  await findWithUserRelationship({
    req,
    res,
    collectionName: COLLECTION_NAME,
    indexedFilters: INDEXED_FILTERS,
    primaryEntityPropertyName: SECONDARY_ENTITY_PROPERTY_NAME,
    secondaryEntityPropertyName: PRIMARY_ENTITY_PROPERTY_NAME,
    targetCollectionName: Collections.USERS,
    postProcessor: async (items) => {
      const allItems = items.items.map((item) => {
        if (item.startDate) item.startDate = item.startDate.toDate();
        if (item.dueDate) item.dueDate = item.dueDate.toDate();
        return item;
      });

      allItems.sort((aa, bb) => {
        return aa.startDate - bb.startDate;
      });

      items.items = allItems;

      return items;
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
      if (item.startDate) item.startDate = item.startDate.toDate();
      if (item.dueDate) item.dueDate = item.dueDate.toDate();
      return item;
    },
  });
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;
  const { userId: targetUserId } = req.params;

  try {
    const { id } = req.params;

    if (!id) throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);

    const existentHookedEventDoc = await fetchSingleItem({ collectionName: COLLECTION_NAME, id });

    // TODO MICHEL - Esta validacion deberia estar en todos los que son por usuario
    if (existentHookedEventDoc[PRIMARY_ENTITY_PROPERTY_NAME] !== targetUserId) {
      throw new CustomError.TechnicalError(
        'ERROR_MISSING_ARGS_002',
        null,
        'Invalid args (002)',
        null
      );
    }

    console.log('Updating ' + id, JSON.stringify(existentHookedEventDoc));

    existentHookedEventDoc.startDate = existentHookedEventDoc.startDate.toDate();
    existentHookedEventDoc.dueDate = existentHookedEventDoc.dueDate.toDate();

    const receivedItemData = await sanitizeReqData({ req, validationSchema: schemas.update });

    if (existentHookedEventDoc.withCalendar && existentHookedEventDoc.userCalendarEventId) {
      // convierto el dato fecha existente y el recibido a un formato unificado

      const receivedStartDateObj = toDateObject(receivedItemData.startDate);
      const receivedDueDateObj = toDateObject(receivedItemData.dueDate);

      if (receivedStartDateObj && receivedDueDateObj) {
        const areEqualDates =
          receivedStartDateObj.getTime() === existentHookedEventDoc.startDate.getTime() &&
          receivedDueDateObj.getTime() === existentHookedEventDoc.dueDate.getTime();

        if (!areEqualDates) {
          // actualizo los eventos en userCalendarEvents y consecuentemente en google calendar

          console.log('Pre updateUserCalendarEvent');

          await updateUserCalendarEvent({
            id: existentHookedEventDoc.userCalendarEventId,
            auditUid,
            data: {
              userId: existentHookedEventDoc.assignedTo,
              startDate: receivedStartDateObj,
              endDate: receivedDueDateObj,
            },
          });

          console.log('updateUserCalendarEvent success');
        }
      }
    }

    const doc = await updateSingleItem({
      collectionName: COLLECTION_NAME,
      id,
      auditUid,
      data: receivedItemData,
    });

    return res.status(204).send(doc);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }

  // await patch(req, res, auditUid, COLLECTION_NAME, schemas.update);
};

exports.remove = async function (req, res) {
  await remove(req, res, COLLECTION_NAME);
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;
  const { userId: targetUserId } = req.params;

  const withCalendar = req.body.withCalendar;

  let docId = null;

  try {
    console.log('withCalendar:', withCalendar);

    if (withCalendar) {
      const user = await getFirebaseUserById(targetUserId);
      const targetUserEmail = user.email;

      const { startDate, dueDate, assignedTo, title, message } = req.body;

      const createUserCalendarEventBody = {
        userId: assignedTo, // este seria el staff, dueño del calendario
        startDate,
        endDate: dueDate,
        summary: title,
        description: message,
        attendeesEmails: [targetUserEmail],
      };

      const createdUserCalendarEventDoc = await createUserCalendarEvent({
        body: createUserCalendarEventBody,
        auditUid,
        calendarId: 'primary', // si se pasa vacio busca el por defecto
      });

      docId = createdUserCalendarEventDoc.id;
      console.log('successful created user calendar event (' + docId + ')');
    }
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }

  const body = req.body;
  body.userId = targetUserId;
  body.userCalendarEventId = docId;

  await createInner({
    req,
    res,
    body,
    auditUid,
    collectionName: COLLECTION_NAME,
    validationSchema: schemas.create,
    documentId: docId,
  });
};

const onCreateThenCreateUserTouchpoint = async function ({ docId, documentPath, before, after }) {
  try {
    const auditUid = after.updatedBy;

    const body = {
      userId: after.userId,
      channelType: 'automation',
      message: 'Event done (' + after.eventType + ')',
      staff: auditUid,
      touchpointDate: new Date(Date.now()),
      notes: after.notes,
    };

    await createUserTouchpoint({ body, auditUid });

    console.log('Done onCreateThenCreateUserTouchpoint');
  } catch (err) {
    console.error('error onCreateThenCreateUserTouchpoint document', documentPath, err);

    return null;
  }
};

exports.onHookedEventUpdate = functions.firestore
  .document(COLLECTION_NAME + '/{docId}')
  .onUpdate(async (change, context) => {
    const { docId } = context.params;
    const documentPath = `${COLLECTION_NAME}/${docId}`;

    try {
      const before = change.before.data();
      const after = change.after.data();

      console.log('UPDATED ' + documentPath);

      if (after.eventStatus === HookedEventStatusTypes.DONE) {
        await onCreateThenCreateUserTouchpoint({ docId, documentPath, before, after });
      }
    } catch (err) {
      console.error('error onCreate document', documentPath, err);

      return null;
    }
  });

exports.onHookedEventCreate = functions.firestore
  .document(COLLECTION_NAME + '/{docId}')
  .onCreate(async (snapshot, context) => {
    const { docId } = context.params;
    const documentPath = `${COLLECTION_NAME}/${docId}`;

    try {
      const before = null;
      const after = snapshot.data();

      console.log('CREATED ' + documentPath);
    } catch (err) {
      console.error('error onCreate document', documentPath, err);

      return null;
    }
  });
