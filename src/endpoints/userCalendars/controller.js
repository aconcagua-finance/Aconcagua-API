/* eslint-disable no-console */
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
  getFirebaseUserByEmail,
  fetchItemsByIds,
  sanitizeData,
  findWithUserRelationshipInner,
  findWithUserRelationship,
  getFirebaseUsersByIds,
  getWithUserRelationshipById,
  MULTIPLE_RELATIONSHIP_SUFFIX,
  getFirebaseUserById,
} = require('../baseEndpoint');

const { GOOGLE_CALENDAR_EVENT_WEBHOOK_URL } = require('../../config/appConfig');

const oauthHelper = require('../../helpers/oauth');

const COLLECTION_NAME = Collections.USER_CALENDARS;
const INDEXED_FILTERS = ['userId'];
const PRIMARY_ENTITY_PROPERTY_NAME = 'userId';

const { google } = require('googleapis');

const calendarSdk = google.calendar('v3');

exports.isCalendarIntegrationAuthorized = async function (req, res) {
  const { userId, email } = res.locals;
  const auditUid = userId;

  try {
    const oauth2Response = await oauthHelper.fetchTokenByEmail(email);

    if (
      oauth2Response &&
      oauth2Response.storedCredentials &&
      oauth2Response.storedCredentials &&
      oauth2Response.storedCredentials.scope.indexOf(oauthHelper.SCOPE_GOOGLE_CALENDAR) !== -1
    ) {
      console.log('Scope existente');

      return res.status(200).send({ authorized: true });
    }

    console.log('Scope inexistente', JSON.stringify(oauth2Response));
    return res.status(200).send({ authorized: false });
  } catch (e) {
    if (e.message === oauthHelper.UNKNOWN_USER_MESSAGE) {
      console.log('Scope inexistente');

      return res.status(200).send({ authorized: false });
    }

    return ErrorHelper.handleError(req, res, e);
  }
};

/**
 * Removes a watch on the user's calendar
 * recibe el id del doc que a la vez es el id del channel de google
 */
exports.stopCalendarWatch = async (req, res) => {
  try {
    const { userId } = res.locals; // always use the currentUserId
    const auditUid = userId;

    const documentID = req.params.id;

    if (!userId || !documentID) {
      return res.status(400).send('No userId or documentID specified.');
    }

    console.log('Stop calendar watch:', userId, documentID);

    const user = await getFirebaseUserById(userId);
    const userEmail = user.email;

    // Retrieve the stored OAuth 2.0 access token
    const oauth2Response = await oauthHelper.fetchTokenByEmail(userEmail);

    console.log('Stop calendar watch, OK Token');

    const calendarDocument = await fetchSingleItem({
      collectionName: COLLECTION_NAME,
      id: documentID,
    });

    console.log('Stop calendar watch, OK calendarDocument', calendarDocument.channelId);

    // Initialize a watch
    const watchStopResponse = await calendarSdk.channels.stop({
      auth: oauth2Response.oauth2Client,

      // Request body metadata
      requestBody: {
        id: calendarDocument.channelId, // Your channel ID. // tmb viene en X-Goog-Channel-ID del evento
        resourceId: calendarDocument.resourceId, // la respuesta del watch viene con este dato, sino tmb en el evento en el header X-Goog-Resource-ID
        // address: GOOGLE_CALENDAR_EVENT_WEBHOOK_URL,
      },
    });

    await updateSingleItem({
      collectionName: Collections.USER_CALENDARS,
      data: { state: Types.StateTypes.STATE_INACTIVE, synced: false },
      auditUid,
      id: documentID,
    });

    console.log('OK calendar stop watch');
    return res.send(watchStopResponse);
  } catch (e) {
    // if (e.message === oauthHelper.UNKNOWN_USER_MESSAGE) {
    //   res.redirect(`oauth2init`);
    // } else {
    //   console.error(e);
    //   res.status(500).send('Something went wrong; check the logs.');
    // }

    return ErrorHelper.handleError(req, res, e);
  }
};

/**
 * Initialize a watch on the user's calendar
 */
exports.initCalendarWatch = async (req, res) => {
  try {
    const { userId } = res.locals; // always use the currentUserId
    const auditUid = userId;

    // este es el nombre del calendario que se vé en el lateral de la UI de google calendar
    const calendarId = req.query.calendarId;

    if (!userId || !calendarId) {
      return res.status(400).send('No userId or calendarId specified.');
    }

    console.log('Init calendar watch:', userId, calendarId);

    const user = await getFirebaseUserById(userId);
    const userEmail = user.email;

    // Retrieve the stored OAuth 2.0 access token
    const oauth2Response = await oauthHelper.fetchTokenByEmail(userEmail);

    console.log('Init calendar watch, OK fetching token');

    // get the calendar from google
    const calendarItem = await calendarSdk.calendarList.get({
      auth: oauth2Response.oauth2Client,

      calendarId,
    });

    console.log('Init calendar watch, OK fetching calendarItem', JSON.stringify(calendarItem));

    // create the dynamic channel / document id
    const channelId = uuidv4();

    // Initialize a watch
    const watchResponse = await calendarSdk.events.watch({
      auth: oauth2Response.oauth2Client,

      // Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.
      // calendarId: 'primary',
      calendarId,
      // Request body metadata
      requestBody: {
        id: channelId, // Your channel ID.
        type: 'web_hook',
        address: GOOGLE_CALENDAR_EVENT_WEBHOOK_URL,
      },
    });

    console.log('Init calendar watch, OK WATCH', JSON.stringify(watchResponse));

    await createFirestoreDocument({
      collectionName: Collections.USER_CALENDARS,
      itemData: {
        ...calendarItem.data,
        id: channelId,
        userId,
        email: userEmail,
        channelId,
        calendarId,
        synced: true,
        name:
          calendarItem.data && calendarItem.data.summary ? calendarItem.data.summary : calendarId,
        resourceId: watchResponse.data.resourceId,
        watchResponse: { ...watchResponse.data },
        watchAddress: GOOGLE_CALENDAR_EVENT_WEBHOOK_URL,
      },
      auditUid: user.uid,
      documentId: channelId,
    });

    console.log('OK calendar watch');
    return res.send(watchResponse);
  } catch (e) {
    // if (e.message === oauthHelper.UNKNOWN_USER_MESSAGE) {
    //   res.redirect(`oauth2init`);
    // } else {
    //   console.error(e);
    //   res.status(500).send('Something went wrong; check the logs.');
    // }

    return ErrorHelper.handleError(req, res, e);
  }
};

exports.freeBusy = async (req, res) => {
  try {
    const { userId } = res.locals;
    const auditUid = userId;

    const { limit, offset, filters, state } = req.query;

    const { userId: targetUserId } = req.params;

    const { startDate, endDate } = req.query;

    if (!targetUserId || !startDate || !endDate) {
      return res.status(400).send('No userId specified.');
    }

    console.log(
      'Requesting free busy with args: ' + JSON.stringify({ targetUserId, startDate, endDate })
    );

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    const user = await getFirebaseUserById(targetUserId);
    const userEmail = user.email;

    let oauth2Response = null;
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

    const userCalendars = await findWithUserRelationshipInner({
      limit,
      offset,
      filters,
      state,
      primaryEntityId: targetUserId,
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

    const calendarIds = userCalendars.items.map((item) => {
      return { id: item.calendarId };
    });

    console.log('Freebusy query: ', startDateObj, endDateObj, calendarIds);

    const freeBusyResponse = await calendarSdk.freebusy.query({
      auth: oauth2Response.oauth2Client,
      requestBody: {
        timeMin: startDateObj,
        timeMax: endDateObj,
        items: calendarIds,
      },
    });

    if (!freeBusyResponse || !freeBusyResponse.data || !freeBusyResponse.data.calendars) {
      throw new CustomError.TechnicalError(
        'ERROR_INVALID_FREEBUSY_RESPONSE',
        null,
        'Respuesta invalida de calendarios',
        null
      );
    }

    const calendarIdsResponse = Object.keys(freeBusyResponse.data.calendars);

    if (calendarIdsResponse.length === 0) {
      throw new CustomError.TechnicalError(
        'ERROR_INVALID_FREEBUSY_RESPONSE',
        null,
        'Respuesta invalida de calendarios',
        null
      );
    }

    const busySlots = [];
    calendarIdsResponse.forEach((calendarIdResponse) => {
      const calendarFreeBusyData = freeBusyResponse.data.calendars[calendarIdResponse];

      calendarFreeBusyData.busy.forEach((busyItem) => {
        busySlots.push(busyItem);
      });
    });

    console.log('OK freeBusyResponse', JSON.stringify(freeBusyResponse.data.calendars));

    return res.status(200).send({
      user: { id: targetUserId, email: user.email, displayName: user.displayName },
      busySlots,
    });
  } catch (e) {
    // if (e.message === oauthHelper.UNKNOWN_USER_MESSAGE) {
    //   res.redirect(`oauth2init`);
    // } else {
    //   console.error(e);
    //   res.status(500).send('Something went wrong; check the logs.');
    // }

    return ErrorHelper.handleError(req, res, e);
  }
};

// NOT IMPLEMENTED
exports.freeBusyCalendarAssistant = async (req, res) => {
  try {
    const { userId } = res.locals;
    const auditUid = userId;

    const { limit, offset, filters, state } = req.query;

    const { startDate, endDate, attendees } = req.query;

    if (!attendees || !startDate || !endDate) {
      return res.status(400).send('missing args');
    }

    console.log(
      'Requesting freeBusyCalendarAssistant with args: ' +
        JSON.stringify({ attendees, startDate, endDate })
    );

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    const platformAttendees = attendees.filter((attendee) => {
      return !attendee.external;
    });

    const platformUsers = await getFirebaseUsersByIds(
      platformAttendees.map((at) => {
        return at.id;
      })
    );

    // let oauth2Response = null;
    const oauth2Response = null;
    try {
      // Retrieve the stored OAuth 2.0 access token
      // oauth2Response = await oauthHelper.fetchTokenByEmail(userEmail);
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

    const userCalendars = await findWithUserRelationshipInner({
      limit,
      offset,
      filters,
      state,
      // primaryEntityId: targetUserId,
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

    const calendarIds = userCalendars.items.map((item) => {
      return { id: item.calendarId };
    });

    console.log('Freebusy query: ', startDateObj, endDateObj, calendarIds);

    const freeBusyResponse = await calendarSdk.freebusy.query({
      auth: oauth2Response.oauth2Client,
      requestBody: {
        timeMin: startDateObj,
        timeMax: endDateObj,
        items: calendarIds,
      },
    });

    if (!freeBusyResponse || !freeBusyResponse.data || !freeBusyResponse.data.calendars) {
      throw new CustomError.TechnicalError(
        'ERROR_INVALID_FREEBUSY_RESPONSE',
        null,
        'Respuesta invalida de calendarios',
        null
      );
    }

    const calendarIdsResponse = Object.keys(freeBusyResponse.data.calendars);

    if (calendarIdsResponse.length === 0) {
      throw new CustomError.TechnicalError(
        'ERROR_INVALID_FREEBUSY_RESPONSE',
        null,
        'Respuesta invalida de calendarios',
        null
      );
    }

    const busySlots = [];
    calendarIdsResponse.forEach((calendarIdResponse) => {
      const calendarFreeBusyData = freeBusyResponse.data.calendars[calendarIdResponse];

      calendarFreeBusyData.busy.forEach((busyItem) => {
        busySlots.push(busyItem);
      });
    });

    console.log('OK freeBusyResponse', JSON.stringify(freeBusyResponse.data.calendars));

    return res.status(200).send({ busySlots });
  } catch (e) {
    // if (e.message === oauthHelper.UNKNOWN_USER_MESSAGE) {
    //   res.redirect(`oauth2init`);
    // } else {
    //   console.error(e);
    //   res.status(500).send('Something went wrong; check the logs.');
    // }

    return ErrorHelper.handleError(req, res, e);
  }
};

exports.findByUser = async function (req, res) {
  try {
    // / movies?filters[movies]=USA&fields[]=id&fields[]=name
    const { limit, offset, filters, state } = req.query;

    const { userId: primaryEntityId } = req.params;

    console.log('searching for user calendars by user with id: ' + primaryEntityId);

    const result = await findWithUserRelationshipInner({
      limit,
      offset,
      filters,
      state,
      primaryEntityId,
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

    console.log('stored calendars: ' + JSON.stringify(result));

    const user = await getFirebaseUserById(primaryEntityId);

    const oauth2Response = await oauthHelper.fetchTokenByEmail(user.email);

    console.log('oauth token fetched ok with email: ' + user.email, oauth2Response);

    const googleCalendars = await calendarSdk.calendarList.list({
      auth: oauth2Response.oauth2Client,
    });

    if (!googleCalendars || !googleCalendars.data) {
      throw new CustomError.TechnicalError(
        'ERROR_GOOGLE_CALENDAR_BAD_RESPONSE',
        null,
        'No data in google calendar list respones',
        null
      );
    }

    console.log('google calendars response: ' + JSON.stringify(googleCalendars.data));

    if (googleCalendars.data.items) {
      const googleCalendarItems = googleCalendars.data.items;

      // [{
      //   "kind": "calendar#calendarListEntry",
      //   "etag": "\"1660759264782000\"",
      //   "id": "miche@sandboxinc.io",
      //   "summary": "miche@sandboxinc.io",
      //   "timeZone": "America/Argentina/Cordoba",
      //   "colorId": "8",
      //   "backgroundColor": "#16a765",
      //   "foregroundColor": "#000000",
      //   "selected": true,
      //   "accessRole": "owner",
      //   "defaultReminders": [],
      //   "conferenceProperties": {
      //     "allowedConferenceSolutionTypes": ["hangoutsMeet"]
      //   }
      // }]

      googleCalendarItems.forEach((googleItem) => {
        const databaseItem = result.items.find((dbItem) => {
          return dbItem.calendarId === googleItem.id;
        });

        if (!databaseItem) {
          result.items.push({
            ...googleItem,
            synced: false,
            name: googleItem.summary,
            calendarId: googleItem.id,
          });
        }
      });

      result.total = result.items.length;
    }

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
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
