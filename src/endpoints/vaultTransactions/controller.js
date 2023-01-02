/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');
// Probando prs
const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');

const { CustomError } = require('../../vs-core');

const { Collections } = require('../../types/collectionsTypes');
const { areEqualStringLists, areDeepEqualDocuments } = require('../../helpers/coreHelper');

const { setUserClaims } = require('../admin/controller');

const schemas = require('./schemas');

const {
  MULTIPLE_RELATIONSHIP_SUFFIX,
  sanitizeData,
  find,
  findWithUserRelationship,
  get,
  patch,
  patchInner,
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
  listByPropInner,
  getByProp,
  getFirebaseUserById,
  createFirestoreDocument,
} = require('../baseEndpoint');

const INDEXED_FILTERS = ['userId', 'companyId', 'state'];

// La fn findWithUserRelationship pretende recibir como value de PRIMARY_ENTITY_PROPERTY_NAME el id de usuario del staff.
// En la fn findWithUserRelationship se recibi por param 'userId' y desde el front se envia el id del staff... medio raro, TODO FIX
const COMPANY_ENTITY_PROPERTY_NAME = 'companyId';
const USER_ENTITY_PROPERTY_NAME = 'userId';
const VAULT_ENTITY_PROPERTY_NAME = 'vaultId';
const COLLECTION_NAME = Collections.VAULT_TRANSACTIONS;

exports.findByCompany = async function (req, res) {
  const { companyId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    console.log('GET VAULT TRANSACTIONS BY COMPANY ' + companyId);

    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
      primaryEntityValue: companyId,
      // primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.VAULTS, propertyName: VAULT_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findByVault = async function (req, res) {
  const { vaultId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    console.log('GET VAULT TRANSACTIONS BY VAULT ' + vaultId);

    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: VAULT_ENTITY_PROPERTY_NAME,
      primaryEntityValue: vaultId,
      // primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.VAULTS, propertyName: VAULT_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findByUser = async function (req, res) {
  const { userId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    console.log('GET VAULT TRANSACTIONS BY USER ' + userId);

    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: USER_ENTITY_PROPERTY_NAME,
      primaryEntityValue: userId,
      // primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
        { collectionName: Collections.VAULTS, propertyName: VAULT_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  const { id, companyId, userId } = req.params;

  console.log('GET VAULT BY ID ' + id);
  await getByProp({
    req,
    res,

    byId: id,

    // primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
    // primaryEntityCollectionName: Collections.COMPANIES,
    collectionName: COLLECTION_NAME,

    relationships: [
      { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
      { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
      { collectionName: Collections.VAULTS, propertyName: VAULT_ENTITY_PROPERTY_NAME },
    ],
    postProcessor: async (item) => {
      if (!item) return null;

      // Importante para validar permisos - complementario a routes-config
      if (userId && item.userId !== userId) throw new Error('userId missmatch');
      if (companyId && item.companyId !== companyId) throw new Error('companyId missmatch');

      return item;
    },
  });
};

// exports.patch = async function (req, res) {
//   const { userId } = res.locals;
//   const auditUid = userId;

//   const { userId: targetUserId, companyId } = req.params;

//   const body = req.body;
//   body.companyId = companyId;

//   const collectionName = COLLECTION_NAME;
//   const validationSchema = schemas.update;

//   try {
//     const { id } = req.params;

//     if (!id) throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);

//     console.log('Patch args (' + collectionName + '):', JSON.stringify(body));

//     const itemData = await sanitizeData({ data: body, validationSchema });

//     if (!companyId || !targetUserId) {
//       throw new CustomError.TechnicalError(
//         'ERROR_CREATE_COMPANY_CLIENT',
//         null,
//         'Error creating company client. Missing args',
//         null
//       );
//     }

//     const doc = await updateSingleItem({ collectionName, id, auditUid, data: itemData });

//     console.log('Patch data: (' + collectionName + ')', JSON.stringify(itemData));

//     return res.status(204).send(doc);
//   } catch (err) {
//     return ErrorHelper.handleError(req, res, err);
//   }
// };

// exports.create = async function (req, res) {
//   const { userId } = res.locals;
//   const auditUid = userId;
//   const { userId: targetUserId, companyId, vaultId } = req.params;

//   const body = req.body;
//   body.userId = targetUserId;
//   body.companyId = companyId;
//   body.vaultId = vaultId;

//   const collectionName = COLLECTION_NAME;
//   const validationSchema = schemas.create;

//   try {
//     console.log('Create args (' + collectionName + '):', body);

//     const itemData = await sanitizeData({ data: body, validationSchema });

//     if (!companyId || !targetUserId) {
//       throw new CustomError.TechnicalError(
//         'ERROR_CREATE_COMPANY_CLIENT',
//         null,
//         'Error creating company client. Missing args',
//         null
//       );
//     }

//     const createArgs = { collectionName, itemData, auditUid };

//     // creo la relacion empresa-empleado
//     const dbItemData = await createFirestoreDocument(createArgs);

//     console.log('Create data: (' + collectionName + ')', dbItemData);

//     return res.status(201).send(dbItemData);
//   } catch (err) {
//     return ErrorHelper.handleError(req, res, err);
//   }
// };

exports.remove = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const { userId: targetUserId, companyId } = req.params;

  if (!companyId || !targetUserId) {
    throw new CustomError.TechnicalError(
      'ERROR_REMOVE_COMPANY_CLIENT',
      null,
      'Error removing company client. Missing args',
      null
    );
  }

  await remove(req, res, COLLECTION_NAME);
};
