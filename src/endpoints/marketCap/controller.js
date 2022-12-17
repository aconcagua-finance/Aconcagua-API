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

// eslint-disable-next-line camelcase
const { invoke_get_api } = require('../../helpers/httpInvoker');

const { API_USD_VALUATION } = require('../../config/appConfig');

const {
  find,
  get,
  patch,
  remove,
  create,
  fetchSingleItem,
  updateSingleItem,

  fetchItemsByIds,
  filterItems,
} = require('../baseEndpoint');

const COLLECTION_NAME = Collections.MARKET_CAP;

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME);
};

exports.findGranted = async function (req, res) {
  try {
    const collectionName = COLLECTION_NAME;

    // / movies?filters[movies]=USA&fields[]=id&fields[]=name
    let { limit, offset, filters, state } = req.query;

    if (limit) limit = parseInt(limit);

    const { enterpriseRols } = res.locals;

    let ids = [];
    if (enterpriseRols) {
      ids = enterpriseRols.map((entRol) => {
        return entRol.companyId;
      });
    }
    console.log(
      'enterpriseRols: ' + JSON.stringify(enterpriseRols) + '. ids: ' + JSON.stringify(ids)
    );
    let items = [];

    if (ids.length !== 0) {
      items = await fetchItemsByIds({ collectionName, ids });

      console.log('OK - all - fetch (' + collectionName + '): ' + items.length);
    }

    const filteredItems = filterItems({ items, limit, offset, filters });

    if (filteredItems.items) {
      console.log('OK - all - filter (' + collectionName + '): ' + filteredItems.items.length);
    }

    return res.send(filteredItems);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
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

  await create(req, res, auditUid, COLLECTION_NAME, schemas.create);
};

const fetchAndUpdateUSDValuation = async function ({ auditUid }) {
  const apiResponse = await invoke_get_api({ endpoint: API_USD_VALUATION });

  if (!apiResponse || !apiResponse.data || !apiResponse.data.buy) {
    throw new CustomError.TechnicalError(
      'ERROR_USD_VALUATION_INVALID_RESPONSE',
      null,
      'Respuesta inválida del servicio de valuacion de USD',
      null
    );
  }

  const valuation = apiResponse.buy;

  // consulto id de item que como currency = ARS y targetCurrency = USD
  // update de la valuation de ese registro
  // updateSingleItem({collectionName: Collections.MARKET_CAP, id})
};

exports.fetchAndUpdateUSDValuation = async function (req, res) {
  const { userId: auditUid } = req.locals;

  try {
    await fetchAndUpdateUSDValuation({ auditUid });

    return res.send({});
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.cronUpdateUSDValuation = functions
  .runWith({
    memory: '2GB',
    // timeoutSeconds: 540,
  })
  .pubsub.schedule('every 60 minutes')
  .timeZone('America/New_York') // Users can choose timezone - default is America/Los_Angeles
  .onRun(async (context) => {
    try {
      await fetchAndUpdateUSDValuation({ auditUid: 'admin' });

      LoggerHelper.appLogger({
        message: 'CRON cronUpdateUSDValuation - OK',
        data: null,

        notifyAdmin: true,
      });
    } catch (err) {
      ErrorHelper.handleCronError({
        message: 'CRON cronUpdateUSDValuation - ERROR: ' + err.message,
        error: err,
      });
    }
  });
