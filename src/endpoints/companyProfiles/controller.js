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
const { areEqualStringLists, areDeepEqualDocuments } = require('../../helpers/coreHelper');

const schemas = require('./schemas');

const {
  MULTIPLE_RELATIONSHIP_SUFFIX,
  sanitizeData,
  find,
  findWithUserRelationship,
  get,
  patch,
  remove,
  create,
  createInner,
  fetchSingleItem,
  fetchItems,
  updateSingleItem,
  filterItems,
  fetchItemsByIds,
  getWithUserRelationshipById,
  listByProp,
  getByProp,
  listByPropInner,
} = require('../baseEndpoint');

const INDEXED_FILTERS = ['companyId', 'state'];

const COMPANY_ENTITY_PROPERTY_NAME = 'companyId';
const COLLECTION_NAME = Collections.COMPANY_PROFILES;

// used by ADMIN
exports.find = async function (req, res) {
  const { companyId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };
  // { staffId: { '$equal': 'oKlebI6i03FAAZHsLWzn' } }

  try {
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
      primaryEntityValue: companyId,
      primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

// used by ADMIN / PRACTITIONER
exports.findByCompany = async function (req, res) {
  const { companyId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };
  // { staffId: { '$equal': 'oKlebI6i03FAAZHsLWzn' } }

  try {
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
      primaryEntityValue: companyId,
      primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
    });
    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  const { id } = req.params;

  await getByProp({
    req,
    res,

    byId: id,

    primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
    primaryEntityCollectionName: Collections.COMPANIES,
    collectionName: COLLECTION_NAME,
  });
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  await patch(req, res, auditUid, COLLECTION_NAME, schemas.update);
};

// solo para este caso el remove es fisico
exports.remove = async function (req, res) {
  await remove(req, res, COLLECTION_NAME);
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const body = req.body;

  await createInner({
    req,
    res,
    body,
    auditUid,
    collectionName: COLLECTION_NAME,
    validationSchema: schemas.create,
  });
};
