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
  getWithUserRelationshipById,
  MULTIPLE_RELATIONSHIP_SUFFIX,
} = require('../baseEndpoint');

const COLLECTION_NAME = Collections.USER_DYNAMIC_ATTRIBUTES;
const INDEXED_FILTERS = ['userId', 'attributeType'];
const PRIMARY_ENTITY_PROPERTY_NAME = 'userId';
const SECONDARY_ENTITY_PROPERTY_NAME = 'attributeType';
const TARGET_COLLECTION_NAME = Collections.USER_ATTRIBUTES_TYPES;

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
    primaryEntityPropertyName: PRIMARY_ENTITY_PROPERTY_NAME,
    secondaryEntityPropertyName: SECONDARY_ENTITY_PROPERTY_NAME,
    targetCollectionName: TARGET_COLLECTION_NAME,
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
