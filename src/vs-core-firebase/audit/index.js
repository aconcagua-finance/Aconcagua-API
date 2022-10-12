/* eslint-disable @typescript-eslint/no-var-requires */
const admin = require('firebase-admin');

const {
  accessLogger,
  changeLogLogger,
  SEVERITY_ERROR,
  SEVERITY_INFO,
} = require('../helpers/loggerHelper');

const { ENVIRONMENT } = process.env;

exports.logger = async function (req, res, next) {
  let body = [];
  let requestErrorMessage = null;

  const getChunk = (chunk) => body.push(chunk);
  const assembleBody = () => {
    body = Buffer.concat(body).toString();
  };
  const getError = (error) => {
    requestErrorMessage = error.message;
  };

  const removeHandlers = () => {
    // request.off("data", getChunk);
    // request.off("end", assembleBody);
    req.off('error', getError);
    res.off('close', logClose);
    res.off('error', logError);
    res.off('finish', logFinish);
  };

  const log = (request, response, errorMessage, responseData) => {
    if (ENVIRONMENT === 'local') return;

    const { statusCode, statusMessage } = response;

    // if (statusCode === 200 || statusCode === 201) {
    const requestStart = Date.now();
    const { httpVersion, method, socket, url } = request;
    const { remoteAddress, remoteFamily } = socket;

    // const responseHeaders = response.getHeaders();
    const responseHeaders = null;

    const requestHeaders = {
      originHeader: request.header('origin'),
      referer: request.header('referer'),
    };

    // TODO michel - Cuando el request viene desde otra api de fns entonces el originalUrl me viene vacio, no se como obtener el dato
    const fullUrl =
      request.protocol +
      '://' +
      request.get('host') +
      // JSON.stringify(request.params) +
      // JSON.stringify(request.query) +
      // url +
      request.originalUrl;

    const severity = statusCode && statusCode >= 400 ? SEVERITY_ERROR : SEVERITY_INFO;

    const errorMsgAux = errorMessage || '';

    accessLogger({
      severity,
      message:
        'Access log: ' +
        '(' +
        statusCode +
        ')' +
        ' [' +
        method +
        '] ' +
        fullUrl +
        ' ' +
        errorMsgAux,

      error: errorMessage,

      service: fullUrl,

      elapsedTime: Date.now() - requestStart,

      data: { body: responseData },

      request: {
        requestHeaders,
        method,
        remoteAddress,
        remoteFamily,
        fullUrl,
        connection: {
          ip: request.headers['x-forwarded-for'] || request.connection.remoteAddress,
          // connection: request.connection,
        },
      },
      response: {
        statusCode,
        statusMessage,
        responseHeaders,
      },
    });
  };

  req.on('data', getChunk);
  req.on('end', assembleBody);

  req.on('error', getError);

  const logClose = () => {
    removeHandlers();
    log(req, res, 'Client aborted.', body);
  };
  const logError = (error) => {
    removeHandlers();

    log(req, res, error.message, body);
  };
  const logFinish = () => {
    removeHandlers();
    log(req, res, requestErrorMessage, body);
  };
  res.on('close', logClose);
  res.on('error', logError);
  res.on('finish', logFinish);

  // process(request, response);

  return next();
};

exports.creationStruct = function (userId) {
  return {
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: userId,
  };
};

exports.updateStruct = function (userId) {
  return {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: userId,
  };
};

/**
 * Creates a new document in the Firebase collection.
 * Additionally appends `uid` and `createdAt` fields
 * to the data. Once the document has been created,
 * it returns the final document object that has been stored
 * in the firestore collection.
 *
 * @param {String} collection Firebase collection name
 * @param {Object} data The document object data
 * @return {Object} The document object with its uid field
 */
async function createDocument(collection, data) {
  if (!collection || !data) {
    return null;
  }
  const db = admin.firestore();
  const newDocumentRef = db.collection(collection).doc();
  const uid = newDocumentRef.id;
  // const createdAt = Date.now();
  const createdAt = admin.firestore.FieldValue.serverTimestamp();

  const finalData = { ...data, uid, createdAt };

  await newDocumentRef.set(finalData);

  return finalData;
}

/**
 * The method allows enabling changelog for any document
 * in firestore collection. The ideal usage is adding this
 * to the cloud function trigger for the document
 * where the changelog needs to be added.
 *
 * @example
 *  await addChangelogToDocument({
 *    documentPath: 'orders/xxxx',
 *    before: {...}, // data before
 *    after: {...}, // data after
 *  })
 *
 * // when using cloud functions
 * exports.onOrderUpdate = functions.firestore
 *   .document('orders/{orderId}')
 *   .onUpdate(async (change, context) => {
 *     const {orderId} = context.params
 *     const documentPath = `orders/${orderId}`
 *     const before = change.before.data()
 *     const after = change.after.data()
 *
 *     try {
 *       await addChangelogToDocument({documentPath, before, after})
 *     } catch (err) {
 *        // log errors
 *     }
 *  }
 *
 * @param {String} documentPath The root path of the document for tracking changelog
 * @param {Object} before The data before the changes have been written
 * @param {Object} after The data after the changes have been written
 * @param {String} collectionName The sub collection name for writing the changelog to, defaults to `changelog`
 */
exports.addToChangelog = async function (documentPath, documentId, before, after) {
  const collectionName = 'changelog';
  if (!documentPath || !collectionName) {
    // skip writing, no document path provided
    return null;
  }

  let userId = null;

  // Only logical deletes allowed
  if (after.updatedBy) {
    // UPDATE
    userId = after.updatedBy;
  } else if (after.createdBy) {
    // CREATE
    userId = after.createdBy;
  }

  // let user = userId
  //   ? {
  //       uid: userDetails.uid || null,
  //     }
  //   : null;

  changeLogLogger({ uid: userId, documentPath, documentId, before, after });
  // const changeLogDocument = await createDocument(collectionName, data);

  // dummy pq no quiero cambair a todos los await de los consumidores...
  await new Promise((resolve, reject) => {
    resolve();
  });

  return null;
  // return changeLogDocument;
};
