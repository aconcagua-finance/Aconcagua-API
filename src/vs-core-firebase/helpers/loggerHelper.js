/* eslint-disable no-console */
const fs = require('fs');

const { Logging } = require('@google-cloud/logging');
const httpContext = require('express-http-context');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const COLLECTION_NAME = 'logs';

const { GMAIL_EMAIL, GMAIL_EMAIL_BCC, WEBSITE_DOMAIN_URL, ENVIRONMENT } = process.env;
const { sendEmail } = require('../email/email');
const { CustomError } = require('../../vs-core');
const { SYS_ADMIN_EMAIL } = require('../../config/appConfig');

const SEVERITY_ERROR = 'error';
const SEVERITY_INFO = 'info';
const SEVERITY_WARNING = 'warning';

const circularReplacer = () => {
  // Creating new WeakSet to keep
  // track of previously seen objects
  const seen = new WeakSet();

  return (key, value) => {
    // If type of value is an
    // object or value is null
    if (typeof value === 'object' && value !== null) {
      // If it has been seen before
      if (seen.has(value)) {
        return 'Object';
      }

      // Add current value to the set
      seen.add(value);
    }

    // return the value
    return value;
  };
};

const logger = {
  info: (data) => {
    logger.writeLog(data, functions.logger.log);
  },
  error: (data) => {
    logger.writeLog(data, functions.logger.error);
  },

  transformData: (object) => {
    const jsonString = JSON.stringify(object, circularReplacer());

    return JSON.parse(jsonString);
  },

  writeLog: (data, logFn) => {
    if (ENVIRONMENT === 'local') {
      if (data.message) console.log('Log Msj:', data.message);
      if (data.error) console.log('Log Err:', data.error);
      if (data.response) console.log('Log Response:', data.response);

      return;
    }

    try {
      logFn(data.message, {
        message: data.message,
        msg: data.message,
        textPayload: data.message,
        ...logger.transformData(data),
      });
    } catch (err) {
      console.error('Error escribiendo el log: ' + data.message);
    }

    if (process.env.NODE_ENV === 'production') return;

    console.log('ENVIRONMENT ES:', ENVIRONMENT, 'NODE_ENV:', process.env.NODE_ENV);

    // Instantiate the StackDriver Logging SDK. The project ID will
    // be automatically inferred from the Cloud Functions environment.
    const logging = new Logging();
    const log = logging.log('localhost-functions');

    // This metadata is attached to each log entry. This specifies a fake
    // Cloud Function called 'Custom Metrics' in order to make your custom
    // log entries appear in the Cloud Functions logs viewer.
    const METADATA = {
      severity: data.severity === SEVERITY_INFO ? 200 : 500,
      resource: {
        type: 'cloud_function',
        labels: {
          function_name: 'localLog',
          region: 'us-central1',
        },
      },
    };

    // Data to write to the log. This can be a JSON object with any properties
    // of the event you want to record.
    const logData = {
      message: data.message,
      msg: data.message,
      env: ENVIRONMENT,
      ...logger.transformData(data),
    };

    // Write to the log. The log.write() call returns a Promise if you want to
    // make sure that the log was written successfully.
    const entry = log.entry(METADATA, logData);
    log.write(entry);
  },
};

exports.SEVERITY_ERROR = SEVERITY_ERROR;
exports.SEVERITY_INFO = SEVERITY_INFO;
exports.SEVERITY_WARNING = SEVERITY_WARNING;

const EVENT_TYPE_TRACE = 'trace';
const EVENT_TYPE_NAVIGATION = 'navigation';
const EVENT_TYPE_APP = 'app';
const EVENT_TYPE_ACCESS = 'access';
const EVENT_TYPE_CHANGELOG = 'changelog';
const EVENT_TYPE_CRON = 'cron';

exports.EVENT_TYPE_TRACE = EVENT_TYPE_TRACE;
exports.EVENT_TYPE_NAVIGATION = EVENT_TYPE_NAVIGATION;
exports.EVENT_TYPE_APP = EVENT_TYPE_APP;

const schemaVersion = '1.0';

exports.userActivityLogger = async function ({
  uid,

  eventType,
  message,
  data,

  storeActivity,
}) {
  if (!uid) {
    const locals = httpContext.get('locals');

    if (locals) uid = locals.uid;
  }

  const severity = SEVERITY_INFO;
  if (!eventType) eventType = EVENT_TYPE_NAVIGATION;
  try {
    logger.info({
      uid: uid || null,

      message,
      spanId: httpContext.get('span-id'),
      schemaVersion,
      eventType,
      env: ENVIRONMENT,

      severity,
      data: data || null,
    });

    if (storeActivity) {
      const db = admin.firestore();
      await db.collection(COLLECTION_NAME).add({
        uid: uid || null,
        data: data ? JSON.stringify(data) : null,

        message: message || null,
        env: ENVIRONMENT,

        severity,
        eventType,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    console.error(
      'Error in appLogger (1): ',
      uid,

      severity,
      eventType,
      message,
      data,
      'INNER ERROR:',
      err
    );
  }
};

exports.errorLogger = async function ({
  uid,

  eventType,
  message,
  error,

  errorCode,
  data,
  notifyAdmin,
}) {
  const severity = SEVERITY_ERROR;

  if (!uid) {
    const locals = httpContext.get('locals');

    if (locals) uid = locals.uid;
  }

  if (!errorCode) {
    if (error && error instanceof CustomError.CustomError) {
      errorCode = error.code ? error.code : null;
    } else errorCode = null;
  }

  try {
    logger.error({
      uid: uid || null,

      message,
      spanId: httpContext.get('span-id'),
      schemaVersion,
      eventType: eventType || null,
      env: ENVIRONMENT,
      errorCode,
      severity: severity || null,
      data: data || null,
      error: error ? errorToJSON(error) : null,
    });
  } catch (err) {
    console.error(
      'Error in appLogger (1): ',
      uid,
      errorCode,
      severity,
      eventType,
      message,
      data,
      'INNER ERROR:',
      err
    );
  }

  try {
    if (notifyAdmin && ENVIRONMENT !== 'local') {
      await notifyError(message, errorCode, JSON.stringify(message), uid);
    }
  } catch (err) {}
};

exports.serviceLogger = async function ({
  uid,

  severity,

  message,
  data,
  error,
  errorCode,

  service,
  elapsedTime,
  request,
  response,
  notifyAdmin,
}) {
  const eventType = EVENT_TYPE_TRACE;

  if (!uid) {
    const locals = httpContext.get('locals');

    if (locals) uid = locals.uid;
  }

  if (!errorCode) {
    if (error && error instanceof CustomError.CustomError) {
      errorCode = error.code ? error.code : null;
    } else errorCode = null;
  }

  try {
    const logData = {
      uid: uid || null,

      message,
      spanId: httpContext.get('span-id'),
      schemaVersion,
      eventType: eventType || null,
      env: ENVIRONMENT,

      errorCode,
      severity: severity || null,
      data: data || null,
      error: error ? errorToJSON(error) : null,
      service: service || null,
      elapsedTime: elapsedTime || null,
      request: request || null,
      response: getServiceResponseOrErrorJSON(response, error),
    };

    if (severity === SEVERITY_ERROR) {
      logger.error(logData);
    } else {
      logger.info(logData);
    }
  } catch (err) {
    console.error(
      'Error in appLogger (1): ',
      uid,
      errorCode,
      severity,
      eventType,
      message,
      data,
      'INNER ERROR:',
      err
    );
  }
  try {
    if (notifyAdmin && ENVIRONMENT !== 'local') {
      await notifyError(message, errorCode, JSON.stringify(message), uid);
    }
  } catch (err) {}
};

exports.appLogger = async function ({ uid, message, data, notifyAdmin }) {
  const eventType = EVENT_TYPE_APP;
  const severity = SEVERITY_INFO;

  if (!uid) {
    const locals = httpContext.get('locals');

    if (locals) uid = locals.uid;
  }
  try {
    logger.info({
      uid: uid || null,

      message,
      data: data || null,
      spanId: httpContext.get('span-id'),
      schemaVersion,
      eventType: eventType || null,
      env: ENVIRONMENT,

      severity: severity || null,
    });

    try {
      if (notifyAdmin && ENVIRONMENT !== 'local') {
        await notifyError(message, 'OK', JSON.stringify(message), uid);
      }
    } catch (err) {
      return;
    }
  } catch (err) {
    console.error(
      'Error in appLogger (1): ',
      uid,

      severity,
      eventType,
      message,
      data,
      'INNER ERROR:',
      err
    );
  }
};

exports.accessLogger = async function ({
  severity,
  message,
  data,
  error,
  errorCode,

  service,
  elapsedTime,
  request,
  response,
  notifyAdmin,
}) {
  const eventType = EVENT_TYPE_ACCESS;

  const locals = httpContext.get('locals');

  let uid = null;
  if (locals) uid = locals.uid;

  if (!errorCode) {
    if (error && error instanceof CustomError.CustomError) {
      errorCode = error.code ? error.code : null;
    } else errorCode = null;
  }

  try {
    const logData = {
      uid: uid || null,

      message,

      spanId: httpContext.get('span-id'),
      schemaVersion,
      eventType: eventType || null,
      env: ENVIRONMENT,

      errorCode,
      severity: severity || null,

      data: data || null,
      error: error ? errorToJSON(error) : null,
      service: service || null,
      elapsedTime: elapsedTime || null,
      request: request || null,
      response: response || null,
    };
    if (severity === SEVERITY_ERROR) {
      logger.error(logData);
    } else {
      logger.info(logData);
    }
  } catch (err) {
    console.error(
      'Error in appLogger (1): ',
      uid,
      errorCode,
      severity,
      eventType,
      message,
      data,
      'INNER ERROR:',
      err
    );
  }
  try {
    if (notifyAdmin && ENVIRONMENT !== 'local') {
      await notifyError(message, errorCode, JSON.stringify(message), uid);
    }
  } catch (err) {}
};

exports.changeLogLogger = async function ({ uid, documentPath, documentId, before, after }) {
  const eventType = EVENT_TYPE_CHANGELOG;
  const severity = SEVERITY_INFO;

  const message = 'Changelog ' + documentPath;

  const locals = httpContext.get('locals');

  if (!uid && locals) uid = locals.uid;

  try {
    logger.error({
      uid: uid || null,

      message,
      severity,
      spanId: httpContext.get('span-id'),
      schemaVersion,
      eventType: eventType || null,
      env: ENVIRONMENT,

      documentId: documentId || null,
      documentPath: documentPath || null,
      before: before || null,
      after: after || null,
    });
  } catch (err) {
    console.error(
      'Error in appLogger (1): ',
      uid,

      severity,
      eventType,
      message,

      'INNER ERROR:',
      err
    );
  }
};

const getServiceResponseJSON = function (serviceResponse) {
  try {
    if (!serviceResponse) return null;

    return {
      status: serviceResponse.status,
      statusText: serviceResponse.statusText,
      data: serviceResponse.data,
    };
  } catch (err) {
    console.log('Error in getServiceResponseJSON: ', serviceResponse, 'INNER ERROR:', err);

    return null;
  }
};

const getServiceResponseOrErrorJSON = function (serviceResponse, error) {
  try {
    const result = {};

    if (serviceResponse) {
      result.status = serviceResponse.status;
      result.statusText = serviceResponse.statusText;
      result.data = serviceResponse.data;
    }

    if (error) {
      if (error && error.isAxiosError && error.response) {
        result.status = error.response.status;
        result.statusText = error.message;
        result.data = error.response.data;
      }
    }

    if (!result.data) result.data = serviceResponse;

    return result;
  } catch (err) {
    console.log('Error in getServiceResponseOrErrorJSON: ', serviceResponse, 'INNER ERROR:', err);

    return null;
  }
};

exports.getServiceResponseJSON = getServiceResponseJSON;

async function notifyError(eventName, code, message, docId) {
  // console.log(eventName, code, message, docId);

  const HEADER_TITLE = 'ERROR - ' + eventName;
  const HEADER_BODY = 'Ocurrió un error - ' + code;
  const CONTENT_TITLE = code;
  const CONTENT_BODY = message;
  const BUTTON_TEXT = 'Ir al sitio';
  const BUTTON_LINK = WEBSITE_DOMAIN_URL;
  const emailTo = SYS_ADMIN_EMAIL;
  const SUBJECT = HEADER_TITLE;

  await sendTemplateEmail(
    'email/emailTemplates/welcome.html',
    HEADER_TITLE,
    HEADER_BODY,
    CONTENT_TITLE,
    CONTENT_BODY,
    BUTTON_TEXT,
    BUTTON_LINK,
    emailTo,
    SUBJECT
  );
}

async function sendTemplateEmail(
  template,
  HEADER_TITLE,
  HEADER_BODY,
  CONTENT_TITLE,
  CONTENT_BODY,
  BUTTON_TEXT,
  BUTTON_LINK,
  emailTo,
  SUBJECT
) {
  try {
    let html = fs.readFileSync(template, {
      encoding: 'utf-8',
    });

    html = html.replace('%%HEADER_TITLE%%', HEADER_TITLE);
    html = html.replace('%%HEADER_BODY%%', HEADER_BODY);
    html = html.replace('%%CONTENT_TITLE%%', CONTENT_TITLE);
    // html = html.replace("%%CONTENT_BODY%%", emailCsv);
    html = html.replace('%%CONTENT_BODY%%', CONTENT_BODY);

    html = html.replace('%%BUTTON_TEXT%%', BUTTON_TEXT);
    html = html.replace('%%BUTTON_LINK%%', BUTTON_LINK);

    const mailResponse = await sendEmail({
      from: '"TrendArt" <' + GMAIL_EMAIL + '>',
      to: emailTo,
      bcc: GMAIL_EMAIL_BCC,
      subject: SUBJECT,
      text: null,
      html,
    });

    // console.log("Mail OK: " + JSON.stringify(mailResponse));
  } catch (e) {
    console.log('Mail not sended:', e.message, e.code, e.response, e.responseCode, e.command);
    throw e;
  }
}

const errorToJSON = function (error) {
  try {
    if (error && error instanceof CustomError.CustomError) {
      const newError = {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack ? error.stack : null,
      };
      if (error.innerException && error.innerException.message) {
        newError.innerExceptionMessage = error.innerException.message;
        newError.innerExceptionStack = error.innerException.stack ?
          error.innerException.stack :
          null;
      }

      return newError;
    }
    return {
      message: error.message,
      stack: error.stack ? error.stack : null,
    };
  } catch (e) {
    console.log('Error en fn errorObjectToJSON', e);
    return error;
  }
};
