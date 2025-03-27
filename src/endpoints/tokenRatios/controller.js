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
  createInner,
  fetchItemsByIds,
  fetchItems,
  filterItems,
} = require('../baseEndpoint');

const COLLECTION_NAME = Collections.TOKEN_RATIOS;

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME);
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
    console.log('TokenRatios Create - Request body:', req.body);
    console.log('TokenRatios Create - Schema:', schemas.create);
    console.log('TokenRatios Create - Schema validate:', typeof schemas.create?.validate);
    console.log('TokenRatios Create - Schema validateAsync:', typeof schemas.create?.validateAsync);

    const { userId } = res.locals;
    const auditUid = userId;

    // Try creating a test validation before passing to create
    try {
      const testValidation = await schemas.create.validateAsync(req.body, {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true,
      });
      console.log('TokenRatios Create - Test validation passed:', testValidation);
    } catch (validationError) {
      console.error('TokenRatios Create - Test validation failed:', validationError);
      throw validationError;
    }

    await create(req, res, auditUid, COLLECTION_NAME, schemas.create);
  } catch (error) {
    console.error('TokenRatios Create - Error:', error);
    throw error;
  }
};
