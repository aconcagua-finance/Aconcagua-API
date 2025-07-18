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

const {
  find,
  get,
  patch,
  remove,
  create,
  fetchSingleItem,
  updateSingleItem,
  createInner,
  fetchItemsByIds,
  fetchItems,
  filterItems,
} = require('../baseEndpoint');

const COLLECTION_NAME = Collections.EMAIL_TEMPLATES;

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME);
};

exports.findGranted = async function (req, res) {
  try {
    const collectionName = COLLECTION_NAME;

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
  try {
    const { userId } = res.locals;
    const auditUid = userId;

    // const {templateName} = req.body.documentId;
    console.log('El nombre de documento es: ' + req.body.documentId);
    await createInner({
      req,
      res,
      body: req.body,
      auditUid,
      collectionName: COLLECTION_NAME,
      validationSchema: schemas.create,
      documentId: req.body.documentId,
    });
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
