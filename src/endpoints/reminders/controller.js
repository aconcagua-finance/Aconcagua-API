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

  fetchItems,
  fetchItemsByIds,
  filterItems,
  listByPropInner,
  getByProp,
  sanitizeData,
  createFirestoreDocument,
} = require('../baseEndpoint');

const INDEXED_FILTERS = ['userId', 'state'];

const USER_ENTITY_PROPERTY_NAME = 'userId';
const COLLECTION_NAME = Collections.REMINDERS;

const getDynamicReminders = async ({ userId }) => {
  const filters = {};
  filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };
  filters.userId = { $equal: userId };

  const vaults = await fetchItems({
    collectionName: Collections.VAULTS,
    filterState: Types.StateTypes.STATE_ACTIVE,
    filters,
    indexedFilters: ['userId', 'state'],
  });

  const reminderTitle = 'Próximo vencimiento';

  const reminders = [];
  vaults.forEach((vault) => {
    let vaultDueDate = null;
    const nowDate = new Date(Date.now());
    nowDate.setUTCHours(0, 0, 0, 0);

    if (vault.dueDate) {
      vaultDueDate = vault.dueDate.toDate();
    }

    if (
      vault.creditType === Types.CreditTypes.CREDIT_TYPE_INSTALLMENT &&
      vault.creditType === Types.CreditTypes.CREDIT_TYPE_BULLET_ADVANCED &&
      vault.creditType === Types.CreditTypes.CREDIT_TYPE_BULLET_EXPIRATION &&
      vaultDueDate &&
      nowDate.getTime() <= vaultDueDate.getTime()
    ) {
      reminders.push({
        title: reminderTitle,
        startDate: nowDate,
        eventDate: vaultDueDate,
        amount: vault.amount,
      });
    }
  });

  return reminders;
};

exports.findByUser = async function (req, res) {
  const { userId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    console.log('GET BY USER ' + userId);

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
      ],

      postProcessor: async (items) => {
        const allItems = items.items.map((item) => {
          if (item.startDate) item.startDate = item.startDate.toDate();
          if (item.eventDate) item.eventDate = item.eventDate.toDate();
          return item;
        });

        items.items = allItems;

        return items;
      },
    });
    const dynamicReminders = await getDynamicReminders({ userId });

    result.items = [...result.items, ...dynamicReminders];

    result.items = result.items.sort((aa, bb) => {
      return aa.eventDate >= bb.eventDate;
    });

    result.total = result.items.length;

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  const { id, userId } = req.params;

  console.log('GET BY ID ' + id);
  await getByProp({
    req,
    res,

    byId: id,

    // primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
    // primaryEntityCollectionName: Collections.COMPANIES,
    collectionName: COLLECTION_NAME,

    relationships: [{ collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME }],
    postProcessor: async (item) => {
      if (!item) return null;

      // Importante para validar permisos - complementario a routes-config
      if (userId && item.userId !== userId) throw new Error('userId missmatch');

      return item;
    },
  });
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const { userId: targetUserId, companyId } = req.params;

  const body = req.body;
  body.companyId = companyId;

  const collectionName = COLLECTION_NAME;
  const validationSchema = schemas.update;

  try {
    const { id } = req.params;

    if (!id) throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);

    console.log('Patch args (' + collectionName + '):', JSON.stringify(body));

    const itemData = await sanitizeData({ data: body, validationSchema });

    if (!targetUserId) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE',
        null,
        'Error creating. Missing args',
        null
      );
    }

    const doc = await updateSingleItem({
      collectionName,
      id,
      auditUid,
      data: itemData,
      secureArgs: { userId: targetUserId },
    });

    console.log('Patch data: (' + collectionName + ')', JSON.stringify(itemData));

    return res.status(204).send(doc);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.remove = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const { userId: targetUserId } = req.params;

  if (!targetUserId) {
    throw new CustomError.TechnicalError(
      'ERROR_REMOVE',
      null,
      'Error removing. Missing args',
      null
    );
  }

  await remove(req, res, COLLECTION_NAME, { userId: targetUserId });
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;
  const { userId: targetUserId, vaultId } = req.params;

  const body = req.body;
  body.userId = targetUserId;

  body.vaultId = vaultId;

  const collectionName = COLLECTION_NAME;
  const validationSchema = schemas.create;

  try {
    console.log('Create args (' + collectionName + '):', body);

    const itemData = await sanitizeData({ data: body, validationSchema });

    if (!targetUserId) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE',
        null,
        'Error creating. Missing args',
        null
      );
    }

    const createArgs = { collectionName, itemData, auditUid };

    // creo la relacion empresa-empleado
    const dbItemData = await createFirestoreDocument(createArgs);

    console.log('Create data: (' + collectionName + ')', dbItemData);

    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
