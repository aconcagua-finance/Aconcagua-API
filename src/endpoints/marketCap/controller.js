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

const { API_USD_VALUATION, API_TOKENS_VALUATIONS } = require('../../config/appConfig');

const {
  find,
  get,
  patch,
  remove,
  create,
  fetchSingleItem,
  updateSingleItem,

  fetchItemsByIds,
  fetchItems,
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
  const valuation = apiResponse.data.buy;
  // armo los filtros para conseguir el registro de la db correcto
  const filters = { currency: { $equal: 'ars' } };
  const indexedFilters = ['currency'];

  // // consulto id de item que como currency = ARS y targetCurrency = USD
  const items = await fetchItems({
    collectionName: COLLECTION_NAME,

    filters,
    indexedFilters,
  });
  // Valido que me devuelva solo un elemento
  if (items.length !== 1) {
    throw new CustomError.TechnicalError(
      'ERROR_USD_VALUATION_INVALID_RESPONSE',
      null,
      'Se encontraron 0 o mas de 1 elemento',
      null
    );
  }
  // actualizo el valor de value con la nueva valuacion
  items[0].value = valuation;
  // // update de la valuation de ese registro
  await updateSingleItem({
    collectionName: COLLECTION_NAME,
    id: items[0].id,
    auditUid,
    data: items[0],
  });
  return { valuation };
};

exports.fetchAndUpdateUSDValuation = async function (req, res) {
  const { userId: auditUid } = req.locals;
  try {
    const valuation = await fetchAndUpdateUSDValuation({ auditUid });

    return res.send(valuation);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

const fetchAndUpdateTokensValuations = async function ({ auditUid }) {
  const apiResponse = await invoke_get_api({ endpoint: API_TOKENS_VALUATIONS });
  if (!apiResponse || apiResponse.errors[0]) {
    throw new CustomError.TechnicalError(
      'ERROR_TOKENS_VALUATIONS_INVALID_RESPONSE',
      null,
      'Respuesta inválida del servicio de cotización de Tokens',
      null
    );
  }

  const valuations = apiResponse.data.quotes;
  const tokens = Object.keys(valuations);

  for (const symbol of tokens) {
    // Filtro para conseguir el marketCap del token
    const filters = { currency: { $equal: symbol } };
    const indexedFilters = ['currency'];

    // Consulto id de item para currency = symbol y targetCurrency = USD
    const items = await fetchItems({
      collectionName: COLLECTION_NAME,

      filters,
      indexedFilters,
    });

    // Valido
    if (items.length !== 1) {
      throw new CustomError.TechnicalError(
        'ERROR_TOKENS_VALUATIONS_INVALID_RESPONSE',
        null,
        'Se encontraron 0 o mas de 1 elemento',
        null
      );
    }

    // actualizo el valor de value con la nueva valuacion
    items[0].value = valuations[symbol];

    // update de la valuation de ese registro
    await updateSingleItem({
      collectionName: COLLECTION_NAME,
      id: items[0].id,
      auditUid,
      data: items[0],
    });
  }

  return { valuations };
};

exports.fetchAndUpdateTokensValuations = async function (req, res) {
  const auditUid = 'admin'; // const { userId: auditUid } = req.locals;
  try {
    const valuations = await fetchAndUpdateTokensValuations({ auditUid });
    return res.send(valuations);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.cronUpdateValuations = functions
  .runWith({
    memory: '2GB',
    // timeoutSeconds: 540,
  })
  .pubsub.schedule('every 60 minutes')
  .timeZone('America/New_York') // Users can choose timezone - default is America/Los_Angeles
  .onRun(async (context) => {
    try {
      const promises = [
        fetchAndUpdateTokensValuations({ auditUid: 'admin' }),
        fetchAndUpdateUSDValuation({ auditUid: 'admin' }),
      ];
      const results = await Promise.allSettled(promises);

      const errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason);

      if (errors.length > 0) {
        errors.forEach((err) =>
          ErrorHelper.handleCronError({
            message: 'CRON cronUpdateValuations - ERROR: ' + err.message,
            error: err,
          })
        );
      } else {
        LoggerHelper.appLogger({
          message: 'CRON cronUpdateValuations - OK',
          data: null,
          notifyAdmin: true,
        });
      }
    } catch (err) {
      ErrorHelper.handleCronError({
        message: 'CRON cronUpdateValuations - ERROR: ' + err.message,
        error: err,
      });
    }
  });
