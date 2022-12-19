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

const schemas = require('./schemas');

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
  fetchItems,
} = require('../baseEndpoint');

const COLLECTION_NAME = Collections.COMPANIES;

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME);
};

const getGrantedIds = async ({ enterpriseRols, userId }) => {
  let ids = [];
  if (enterpriseRols) {
    ids = enterpriseRols.map((entRol) => {
      return entRol.companyId;
    });
  } else {
    const companyClientsRelationships = await fetchItems({
      collectionName: Collections.COMPANY_CLIENTS,
      limit: 1000,
      filterState: Types.StateTypes.STATE_ACTIVE,
      filters: { userId: { $equal: userId } },
    });

    if (companyClientsRelationships && companyClientsRelationships.length) {
      companyClientsRelationships.forEach((element) => {
        if (!ids.includes(element.companyId)) ids.push(element.companyId);
      });
    }
  }

  return ids;
};

exports.findGranted = async function (req, res) {
  try {
    const { userId, enterpriseRols } = res.locals;

    const collectionName = COLLECTION_NAME;

    const ids = await getGrantedIds({ enterpriseRols, userId });

    console.log(
      'enterpriseRols: ' + JSON.stringify(enterpriseRols) + '. ids: ' + JSON.stringify(ids)
    );
    let items = [];

    if (ids.length !== 0) {
      items = await fetchItemsByIds({ collectionName, ids });

      console.log('OK - all - fetch (' + collectionName + '): ' + items.length);
    }

    // / movies?filters[movies]=USA&fields[]=id&fields[]=name
    let { limit, offset, filters, state } = req.query;

    if (limit) limit = parseInt(limit);

    const filteredItems = filterItems({ items, limit, offset, filters });

    if (filteredItems.items) {
      console.log('OK - all - filter (' + collectionName + '): ' + filteredItems.items.length);
    }

    return res.send(filteredItems);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.getGranted = async function (req, res) {
  try {
    const { userId, enterpriseRols } = res.locals;

    const collectionName = COLLECTION_NAME;

    const { id } = req.params;

    const ids = await getGrantedIds({ enterpriseRols, userId });

    if (!ids.includes(id)) {
      throw new CustomError.TechnicalError(
        'ERROR_NOT_ALLOWED',
        null,
        'se esta consultando por un id que no está habilitado',
        null
      );
    }

    console.log(
      'enterpriseRols: ' + JSON.stringify(enterpriseRols) + '. ids: ' + JSON.stringify(ids)
    );

    const item = await fetchSingleItem({ collectionName, id });
    return res.send(item);
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
