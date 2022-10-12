/* eslint-disable no-console */
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

const { toDateObject } = require('../../helpers/coreHelper');

const { v4: uuidv4 } = require('uuid');

const schemas = require('./schemas');

const {
  find,
  get,
  patch,
  remove,
  create,
  fetchSingleItem,
  updateSingleItem,
  createFirestoreDocument,
  createInner,
  fetchItems,
  fetchItemsByIds,
  sanitizeData,

  findWithUserRelationshipInner,
  findWithUserRelationship,
  getWithUserRelationshipById,
  getFirebaseUserById,
  MULTIPLE_RELATIONSHIP_SUFFIX,
  getFirebaseUserByEmail,
} = require('../baseEndpoint');

const oauthHelper = require('../../helpers/oauth');
const { google } = require('googleapis');

const calendarSdk = google.calendar('v3');

const COLLECTION_NAME = Collections.USER_CALENDAR_EVENTS;
const COLLECTION_NAME_BRONZE = Collections.USER_CALENDAR_EVENTS + '_BRONZE';
const INDEXED_FILTERS = ['userId'];
const PRIMARY_ENTITY_PROPERTY_NAME = 'userId';

exports.googleCalendarEventWebhook = async function (req, res) {
  console.log('ENTRO googleCalendarEventWebhook');

  const dbItemData = await createFirestoreDocument({
    collectionName: COLLECTION_NAME_BRONZE,
    itemData: { body: req.body, params: req.params, query: req.query, headers: req.headers },
    auditUid: 'googleWebhook',
  });

  return res.status(200).send(null);
};

exports.findByUser = async function (req, res) {
  await findWithUserRelationship({
    req,
    res,
    collectionName: COLLECTION_NAME,
    indexedFilters: INDEXED_FILTERS,
    primaryEntityPropertyName: PRIMARY_ENTITY_PROPERTY_NAME,
    // secondaryEntityPropertyName: SECONDARY_ENTITY_PROPERTY_NAME,
    // targetCollectionName: TARGET_COLLECTION_NAME,
    postProcessor: async (items) => {
      const allItems = items.items.map((item) => {
        if (item.dueDate) item.dueDate = item.dueDate.toDate();
        return item;
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
    // secondaryEntityPropertyName: SECONDARY_ENTITY_PROPERTY_NAME,
    // targetCollectionName: TARGET_COLLECTION_NAME,
    byId: id,
    postProcessor: async (item) => {
      if (item.dueDate) item.dueDate = item.dueDate.toDate();
      return item;
    },
  });
};

exports.patch = async function (req, res) {
  try {
    const { userId } = res.locals;
    const auditUid = userId;
    const { userId: targetUserId } = req.params;

    const dbItemData = await exports.updateUserCalendarEvent({
      body: req.body,
      auditUid,
      calendarId: 'primary',
    });

    return res.status(200).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.remove = async function (req, res) {
  await remove(req, res, COLLECTION_NAME);
};

const createFirebaseUserCalendarEvent = async function ({ body, auditUid, documentId }) {
  const validationSchema = schemas.create;
  const collectionName = COLLECTION_NAME;

  console.log('createUserCalendarEventGolden body: ' + JSON.stringify(body));

  const itemData = await sanitizeData({ data: body, validationSchema });

  const createArgs = { collectionName, itemData, auditUid };
  if (documentId) createArgs.documentId = documentId;

  const dbItemData = await createFirestoreDocument(createArgs);

  console.log('Create data: (' + collectionName + ')', dbItemData);

  return dbItemData;
};

const updateFirebaseUserCalendarEvent = async function ({ body, auditUid, id }) {
  const validationSchema = schemas.update;
  const collectionName = COLLECTION_NAME;

  console.log('updateFirebaseUserCalendarEvent body: ' + JSON.stringify(body));

  const itemData = await sanitizeData({ data: body, validationSchema });

  const dbItemData = await updateSingleItem({ collectionName, id, auditUid, data: itemData });

  console.log('Update data: (' + collectionName + ')', dbItemData);

  return dbItemData;
};

const getGoogleCalendarId = async (defaultCalendarId, userId) => {
  if (!defaultCalendarId) {
    const userCalendars = await findWithUserRelationshipInner({
      limit: 1000,
      offset: 0,

      primaryEntityId: userId,
      collectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
      primaryEntityPropertyName: PRIMARY_ENTITY_PROPERTY_NAME,
      // secondaryEntityPropertyName: SECONDARY_ENTITY_PROPERTY_NAME,
      // targetCollectionName: TARGET_COLLECTION_NAME,
    });

    if (!userCalendars.items.length) {
      throw new CustomError.TechnicalError(
        'ERROR_CALENDAR_AUTHORIZATION_REQUIRED_2',
        null,
        'No se autorizó ningún calendario del usuario',
        null
      );
    }

    const appPrimaryCalendar = userCalendars.items.filter((item) => {
      return item.isAppPrimary;
    });

    if (appPrimaryCalendar) defaultCalendarId = appPrimaryCalendar.calendarId;
    else defaultCalendarId = 'primary';
  }

  return defaultCalendarId;
};

const getOAuth2 = async ({ userId, userEmail }) => {
  if (!userEmail) {
    const user = await getFirebaseUserById(userId);
    userEmail = user.email;
  }
  // get oauth token
  try {
    // Retrieve the stored OAuth 2.0 access token
    const oauth2Response = await oauthHelper.fetchTokenByEmail(userEmail);

    return oauth2Response;
  } catch (e) {
    if (e.message === oauthHelper.UNKNOWN_USER_MESSAGE) {
      throw new CustomError.TechnicalError(
        'ERROR_CALENDAR_AUTHORIZATION_REQUIRED_1',
        null,
        'No se autorizó ningún calendario del usuario',
        e
      );
    }

    throw e;
  }
};

// Crea el evento en el calendario de google del usuario y tmb lo storea en firebase
exports.createUserCalendarEvent = async function ({ body, auditUid, calendarId }) {
  const { userId, startDate, endDate, summary, description, attendeesEmails } = body;

  console.log('Requesting createUserCalendarEvent with args: ' + JSON.stringify(body));

  if (
    !userId ||
    !startDate ||
    !endDate ||
    !summary ||
    !attendeesEmails ||
    !attendeesEmails.length
  ) {
    throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'missing args.', null);
  }

  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  const oauth2Response = await getOAuth2({ userId });

  console.log('OK Token');

  calendarId = await getGoogleCalendarId(calendarId, userId);

  console.log('Insert event data: ', startDate, endDate, calendarId);

  const insertEventResponse = await calendarSdk.events.insert({
    auth: oauth2Response.oauth2Client,
    calendarId,
    sendUpdates: 'all',
    conferenceDataVersion: 1,
    requestBody: {
      summary,
      // location: '800 Howard St., San Francisco, CA 94103',
      description: description || '',
      start: {
        dateTime: startDateObj.toISOString(),
        // dateTime: '2015-05-28T09:00:00-07:00',
        // timeZone: 'America/Los_Angeles',
      },
      end: {
        dateTime: endDateObj.toISOString(),
        // dateTime: '2015-05-28T17:00:00-07:00',
        // timeZone: 'America/Los_Angeles',
      },
      // recurrence: ['RRULE:FREQ=DAILY;COUNT=2'],
      // attendees: [{ email: 'lpage@example.com' }, { email: 'sbrin@example.com' }],
      attendees: attendeesEmails.map((attendeeEmail) => {
        return { email: attendeeEmail };
      }),
      reminders: {
        useDefault: true,
        // overrides: [
        //   { method: 'email', minutes: 24 * 60 },
        //   { method: 'popup', minutes: 10 },
        // ],
      },
      conferenceData: {
        createRequest: {
          requestId: uuidv4(),
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    },
  });

  if (!insertEventResponse || !insertEventResponse.data || !insertEventResponse.data.id) {
    throw new CustomError.TechnicalError(
      'ERROR_INVALID_INSERT_EVENT_RESPONSE',
      null,
      'Respuesta invalida de insert de evento de calendario',
      null
    );
  }

  body.calendarData = insertEventResponse.data;

  const documentId = insertEventResponse.data.id;

  console.log('created google calendar event with id: ' + documentId);

  const dbItemData = await createFirebaseUserCalendarEvent({
    body: { ...body, userCalendarId: calendarId, startDate: startDateObj, endDate: endDateObj },
    auditUid,
    documentId,
  });

  return dbItemData;
};

// actualiza el google calendar event y el evento en firebase. NO actualiza HookedEvents...
// Se usa desde el controlador de hookedEvents
exports.updateUserCalendarEvent = async ({ id, auditUid, data }) => {
  const { userId, startDate, endDate } = data;

  console.log('Requesting updateUserCalendarEvent with args: ' + JSON.stringify(data));

  if (!userId || !startDate || !endDate) {
    throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'missing args.', null);
  }

  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  const existentUserCalendarEvent = await fetchSingleItem({ collectionName: COLLECTION_NAME, id });

  const oauth2Response = await getOAuth2({ userId });

  console.log('OK Token');

  console.log('Update event data: ', startDate, endDate);

  const updateEventResponse = await calendarSdk.events.update({
    auth: oauth2Response.oauth2Client,
    eventId: id,
    calendarId: existentUserCalendarEvent.userCalendarId,
    sendUpdates: 'all',
    conferenceDataVersion: 1,
    requestBody: {
      // ...existentUserCalendarEvent.calendarData,
      summary: existentUserCalendarEvent.calendarData.summary,
      // location: '800 Howard St., San Francisco, CA 94103',
      description: existentUserCalendarEvent.calendarData.description,
      attendees: existentUserCalendarEvent.calendarData.attendees,
      reminders: existentUserCalendarEvent.calendarData.reminders,
      conferenceData: existentUserCalendarEvent.calendarData.conferenceData,
      // conferenceData: {
      //   createRequest: {
      //     // requestId: uuidv4(),
      //     requestId: existentUserCalendarEvent.conferenceData.requestId,
      //     conferenceSolutionKey: {
      //       type: 'hangoutsMeet',
      //     },
      //   },
      // },
      start: {
        dateTime: startDateObj.toISOString(),
        // dateTime: '2015-05-28T09:00:00-07:00',
        // timeZone: 'America/Los_Angeles',
      },
      end: {
        dateTime: endDateObj.toISOString(),
        // dateTime: '2015-05-28T17:00:00-07:00',
        // timeZone: 'America/Los_Angeles',
      },
    },
  });

  if (!updateEventResponse || !updateEventResponse.data) {
    throw new CustomError.TechnicalError(
      'ERROR_INVALID_UPDATE_EVENT_RESPONSE',
      null,
      'Respuesta invalida de update event de calendario',
      null
    );
  }

  const dbItemData = await updateFirebaseUserCalendarEvent({
    body: { startDate: startDateObj, endDate: endDateObj },
    auditUid,
    id,
  });

  return dbItemData;
};

exports.create = async function (req, res) {
  try {
    const { userId } = res.locals;
    const auditUid = userId;
    const { userId: targetUserId } = req.params;

    const dbItemData = await exports.createUserCalendarEvent({
      body: req.body,
      auditUid,
      calendarId: 'primary',
    });

    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

const bronzeToGolden = async ({ docId, doc }) => {
  try {
    const auditUid = doc.createdBy;
    const resourceIdPropName = 'x-goog-resource-id';

    if (!doc.headers || !doc.headers[resourceIdPropName]) {
      throw new CustomError.TechnicalError(
        'ERROR_MISSING_PROP_NAME',
        null,
        'No se encontró la prop ' + resourceIdPropName + ' en los headers',
        null
      );
    }

    const resourceId = doc.headers[resourceIdPropName];

    const db = admin.firestore();
    const ref = db.collection(Collections.USER_CALENDARS);

    // busco por el id de recurso de google, que se almacena al momento de iniciar el watch
    // seria el id del calendario pero interno de google
    const calendarsQuerySnapshot = await ref
      .where('state', '==', Types.StateTypes.STATE_ACTIVE)
      .where('resourceId', '==', resourceId)
      .get();

    if (!calendarsQuerySnapshot.docs) {
      throw new CustomError.TechnicalError(
        'ERROR_NOT_FOUND',
        null,
        'No se encontró el resourceID ' + resourceId,
        null
      );
    }

    const calendars = calendarsQuerySnapshot.docs.map((docItem) => {
      const id = docItem.id;
      const data = docItem.data();

      if (data.createdAt) data.createdAt = data.createdAt.toDate();
      if (data.updatedAt) data.updatedAt = data.updatedAt.toDate();

      return { ...data, id };
    });

    if (!calendars.length) {
      throw new CustomError.TechnicalError(
        'ERROR_NOT_FOUND',
        null,
        'No se encontró el resourceID ' + resourceId,
        null
      );
    }

    const calendar = calendars[0];

    const userEmail = calendar.email;

    // Retrieve the stored OAuth 2.0 access token
    const oauth2Response = await oauthHelper.fetchTokenByEmail(userEmail);

    console.log('OK Retrieving token, OK fetching token');

    // get the calendar event list from calendar watched
    // trato de obtener los proximos eventos para ver si alguno corresponde con uno generado desde la aplicacion y entonces evaluar si cambio algo
    const calendarEvents = await calendarSdk.events.list({
      auth: oauth2Response.oauth2Client,
      calendarId: calendar.calendarId,
      singleEvents: true,
      orderBy: 'startTime',
      timeMin: new Date().toISOString(), // from now
      maxResults: 100, // default 250
    });

    console.log(
      'CALENDAR EVENTS: ',

      JSON.stringify(calendarEvents)
    );

    // create the dynamic channel / document id

    // const body = {
    //   userId: after.userId,
    //   channelType: 'automation',
    //   message: 'Habits follow up',
    //   staff: auditUid,
    // };

    // await createUserCalendarEventGolden({ body, auditUid });

    console.log('Done onCreateBronzeThenCreateGolden');
  } catch (err) {
    console.error('error onCreateBronzeThenCreateGolden', doc, err);

    return null;
  }
};

exports.bronzeToGoldenById = async function (req, res) {
  try {
    const docId = req.query.id;

    const doc = await fetchSingleItem({ collectionName: COLLECTION_NAME_BRONZE, id: docId });

    const response = await onCreateBronzeThenSyncUserCalendarEvents({ docId, after: doc });

    return res.status(200).send({ response });
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

// Ante un insert en collection_BRONZE
// se obtiene calendario de google por resource id
// luego se obtienen todos los eventos asociados al calendario y se comparan con los hookedEvents que están guardados en la firestore
// Si hay alguno distinto en startDate / dueDate, entonces se actualiza el registro de firestore tanto de hookedEvent como de userCalendarEvents
const onCreateBronzeThenSyncUserCalendarEvents = async function ({
  docId,
  documentPath,
  before,
  after,
}) {
  if (!after.headers) {
    console.error('No se encontro la prop headers');
    return;
  }

  const resourceId = after.headers['x-goog-resource-id'];
  const channelToken = after.headers['x-goog-channel-token'];
  const channelId = after.headers['x-goog-channel-id'];
  const resourceState = after.headers['x-goog-resource-state'];

  // Use the channel token to validate the webhook
  // if (channelToken !== webhookToken) {
  //   return reply.status(403).send('Invalid webhook token');
  // }

  if (resourceState === 'sync') return;

  let userCalendarDoc = null;
  try {
    userCalendarDoc = await fetchSingleItem({
      collectionName: Collections.USER_CALENDARS,
      id: channelId,
    });

    console.log('Ok fectching userCalendarDoc ' + channelId);
  } catch (e) {
    console.error(
      'Se recibe un evento de google calendar que no está almacenado. ',
      JSON.stringify(after)
    );

    throw e;
  }

  const userId = userCalendarDoc.userId;
  const userEmail = userCalendarDoc.email;
  const calendarId = userCalendarDoc.calendarId;

  console.log('User ID: ' + userId, 'email: ' + userEmail);
  if (resourceId !== userCalendarDoc.resourceId) {
    throw new Error(
      'El resource id es distinto (' + resourceId + ' vs ' + userCalendarDoc.resourceId + ')'
    );
  }

  // obtengo las credenciales del usuario para acceder a su calendario
  let oauth2Response = null;
  // get oauth token
  try {
    // Retrieve the stored OAuth 2.0 access token
    oauth2Response = await oauthHelper.fetchTokenByEmail(userEmail);
  } catch (e) {
    if (e.message === oauthHelper.UNKNOWN_USER_MESSAGE) {
      throw new CustomError.TechnicalError(
        'ERROR_CALENDAR_AUTHORIZATION_REQUIRED_1',
        null,
        'No se autorizó ningún calendario del usuario',
        e
      );
    }

    throw e;
  }
  console.log('OK Token');

  // listo los eventos de google relacionados al calendario del usuario
  const googleCalendarEvents = await calendarSdk.events.list({
    auth: oauth2Response.oauth2Client,
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime',
  });

  if (!googleCalendarEvents || !googleCalendarEvents.data || !googleCalendarEvents.data.items) {
    throw new Error('Se recibio un calendario vacio sin items');
  }

  const googleCalendarEventsItems = googleCalendarEvents.data.items;
  console.log('Se recibieron ' + googleCalendarEventsItems.length + ' eventos de google');

  if (googleCalendarEvents.data.items === 0) {
    console.error('Se recibieron cero items de google');
    return;
  }

  // filtro por el usuario
  // const filters = { userId: { $equal: userId } };
  // console.log({ collectionName, filterState, filters, indexedFilters });
  const hookedEventsByCalendarId = await fetchItemsByIds({
    collectionName: Collections.HOOKED_EVENTS,
    ids: googleCalendarEvents.data.items.map((googleCalendarItem) => {
      return googleCalendarItem.id;
    }),
    // filterState,
    // filters,
    // indexedFilters,
  });

  console.log('Se recibieron ' + hookedEventsByCalendarId.length + ' eventos de firebase');

  const db = admin.firestore();
  const batch = db.batch();

  let updateCount = 0;
  hookedEventsByCalendarId.forEach((hookedEventItem) => {
    // logueo pero dejo seguir
    if (hookedEventItem.assignedTo !== userId) {
      console.warn('Error algo raro aca... user id es distinto en item ' + hookedEventItem.id);
    }

    const googleCalendarItem = googleCalendarEventsItems.find((item) => {
      return item.id === hookedEventItem.id;
    });

    if (!googleCalendarItem) {
      throw new Error(
        'Error algo raro aca... id no encontrado de google y hooked events ' + hookedEventItem.id
      );
    }

    if (
      !googleCalendarItem.start ||
      !googleCalendarItem.start.dateTime ||
      !googleCalendarItem.end ||
      !googleCalendarItem.end.dateTime
    ) {
      throw new Error(
        'Error algo raro aca... google no devolvio el datetime en las fechas ' + hookedEventItem.id
      );
    }

    console.log(
      'Procesando: ',
      // JSON.stringify(hookedEventItem),
      // JSON.stringify(googleCalendarItem)
      hookedEventItem.startDate
    );

    if (hookedEventItem.startDate) hookedEventItem.startDate = hookedEventItem.startDate.toDate();
    if (hookedEventItem.dueDate) hookedEventItem.dueDate = hookedEventItem.dueDate.toDate();

    const googleCalendarItemStartDate = toDateObject(googleCalendarItem.start.dateTime);
    const googleCalendarItemEndDate = toDateObject(googleCalendarItem.end.dateTime);

    console.log(
      'Las fechas: ',
      hookedEventItem.startDate,
      googleCalendarItemStartDate,
      hookedEventItem.dueDate,
      googleCalendarItemEndDate
    );
    if (
      hookedEventItem.startDate.toISOString() !== googleCalendarItemStartDate.toISOString() ||
      hookedEventItem.dueDate.toISOString() !== googleCalendarItemEndDate.toISOString()
    ) {
      const hookedEventsUpdateData = {
        startDate: googleCalendarItemStartDate,
        dueDate: googleCalendarItemEndDate,
      };

      // utilizo el id del hookedEvent porque cuando se crea con calendar se reutiliza el id del envento
      const refHookedEvents = db.collection(Collections.HOOKED_EVENTS).doc(hookedEventItem.id);
      batch.update(refHookedEvents, hookedEventsUpdateData);

      const userCalendarEventsUpdateData = {
        startDate: googleCalendarItemStartDate,
        endDate: googleCalendarItemEndDate,
      };

      const refUserCalendarEvents = db
        .collection(Collections.USER_CALENDAR_EVENTS)
        .doc(hookedEventItem.id);
      batch.update(refUserCalendarEvents, userCalendarEventsUpdateData);

      console.log('Se actualizara ' + hookedEventItem.id);
      updateCount++;
    }
  });

  if (updateCount !== 0) await batch.commit();
  else console.log('nada para updatear...');
};

// Son los eventos que se persisten directamente por la invocacion del webhook en userCalendars.
// Se inserta por medio de googleCalendarEventWebhook
// Esto es un evento asociado al calendario y no al evento. La info que se recibe es el resource id del calendario
exports.onUserCalendarEventBronzeCreate = functions.firestore
  .document(COLLECTION_NAME_BRONZE + '/{docId}')
  .onCreate(async (snapshot, context) => {
    const { docId } = context.params;
    // const docId = snapshot.key;
    const documentPath = `${COLLECTION_NAME_BRONZE}/${docId}`;

    const before = null;
    const after = snapshot.data();

    console.log('CREATED BRONZE' + documentPath);

    try {
      await onCreateBronzeThenSyncUserCalendarEvents({ docId, documentPath, before, after });
    } catch (e) {
      console.error('Error onCreateBronzeThenSyncUserCalendarEvents', e);
      throw e;
    }
    return null;
  });
