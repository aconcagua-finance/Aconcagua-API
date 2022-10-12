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

const { fetchItems: fetchProducts } = require('../products/controller');

const COLLECTION_NAME = Collections.PACKAGES;

const fetchItems = async function (filterState) {
  try {
    const db = admin.firestore();
    const ref = db.collection(COLLECTION_NAME);

    const querySnapshot = await ref
      .where('state', '==', filterState)
      .limit(100)
      .orderBy('createdAt', 'asc')
      .get();

    if (!querySnapshot.docs) return [];

    const items = querySnapshot.docs.map((doc) => {
      const id = doc.id;
      const data = doc.data();

      if (data.createdAt) data.createdAt = data.createdAt.toDate();
      if (data.updatedAt) data.updatedAt = data.updatedAt.toDate();

      return { ...data, id };
    });

    return items;
  } catch (err) {
    throw new CustomError.TechnicalError('ERROR_FETCH', null, err.message, err);
  }
};

const fetchSingleItem = async function (id) {
  try {
    const db = admin.firestore();
    const doc = await db.collection(COLLECTION_NAME).doc(id).get();

    const item = { ...doc.data(), id };

    if (item.createdAt) item.createdAt = item.createdAt.toDate();
    if (item.updatedAt) item.updatedAt = item.updatedAt.toDate();

    const products = await fetchProducts(Types.StateTypes.STATE_ACTIVE);

    item.subProducts.forEach((subProduct) => {
      const product = products.find((prd) => {
        return prd.id === subProduct.id;
      });

      if (product) subProduct = { ...product };
    });

    return item;
  } catch (err) {
    throw new CustomError.TechnicalError('ERROR_FETCH_SINGLE', null, err.message, err);
  }
};

const updateSingleItem = async function (id, auditUid, data) {
  try {
    const updates = { ...data, ...updateStruct(auditUid) };

    const db = admin.firestore();

    // Update document.
    const updatedDoc = await db.collection(COLLECTION_NAME).doc(id).update(updates);

    return updatedDoc;
  } catch (err) {
    throw new CustomError.TechnicalError('ERROR_UPDATE_SINGLE', null, err.message, err);
  }
};

const filterItems = function ({ items, limit = 100, offset = 0, filters }) {
  if (!items || items.length === 0) return { items: [], hasMore: false, total: 0, pageSize: limit };

  offset = parseInt(offset);
  let filteredItems = items;

  // los que puede ver son sus totales, no todos
  const totalItems = filteredItems.length;

  // Text filter
  if (filters && filters.searchText && filters.searchText !== '') {
    const fuse = new Fuse(items, {
      threshold: 0.3,
      minMatchCharLength: 2,
      keys: ['name', 'description'],
    });

    const auxFilteredItems = fuse.search(filters.searchText);

    filteredItems = [];
    auxFilteredItems.forEach((element) => {
      filteredItems.push(element.item);
    });
  }

  // filtro por tipo
  if (filters && filters.type) {
    filteredItems = filteredItems.filter((item) => {
      return item.type && item.type === filters.type;
    });
  }

  // filtro por relevancia
  if (filters && filters.relevant) {
    filteredItems = filteredItems.filter((item) => {
      return item.relevant;
    });
  }

  const hasMore = offset + limit < filteredItems.length;

  filteredItems = filteredItems.slice(offset, offset + limit);

  return { items: filteredItems, hasMore, total: totalItems, pageSize: limit };
};

exports.find = async function (req, res) {
  try {
    // / movies?filters[movies]=USA&fields[]=id&fields[]=name
    const { limit, offset, filters, state } = req.query;

    let filterState = state;
    if (!filterState) filterState = Types.StateTypes.STATE_ACTIVE;

    const items = await fetchItems(filterState);

    console.log('OK - all - fetch: ' + items.length);

    const filteredItems = filterItems({ items, limit, offset, filters });

    if (filteredItems.items) console.log('OK - all - filter: ' + filteredItems.items.length);

    return res.send(filteredItems);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Id not recived', null);
    }

    const item = await fetchSingleItem(id);

    console.log('OK - get');

    return res.send(item);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.create = async function (req, res) {
  try {
    const { userId } = res.locals;

    let auditUid = userId;

    if (!auditUid) auditUid = 'admin';

    console.log('Create args:', req.body);

    const _validationOptions = {
      abortEarly: false, // abort after the last validation error
      allowUnknown: true, // allow unknown keys that will be ignored
      stripUnknown: true, // remove unknown keys from the validated data
    };

    const itemData = await schemas.create.validateAsync(req.body, _validationOptions);

    const db = admin.firestore();

    const newDoc = db.collection(COLLECTION_NAME).doc();
    const itemId = newDoc.id;

    const dbItemData = {
      ...itemData,
      id: itemId,

      state: Types.StateTypes.STATE_ACTIVE,
      ...creationStruct(auditUid),
      ...updateStruct(auditUid),
    };

    console.log('Create data:', dbItemData);

    const doc = await db.collection(COLLECTION_NAME).doc(itemId).set(dbItemData);

    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.patch = async function (req, res) {
  try {
    const { id } = req.params;
    const { name, description, iconName } = req.body;
    const { userId } = res.locals; // user id

    if (!name || !description || !iconName) {
      throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);
    }

    const data = {
      name,
      description,
      iconName,
    };

    const doc = await updateSingleItem(id, userId, data);

    return res.status(204).send(doc);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.remove = async function (req, res) {
  try {
    const { id } = req.params;
    const { userId } = res.locals; // user id

    const db = admin.firestore();

    const data = {
      state: Types.StateTypes.STATE_INACTIVE,
    };
    const updates = { ...data, ...updateStruct(userId) };

    // Update document.
    const updatedDoc = await db.collection(COLLECTION_NAME).doc(id).update(updates);

    return res.status(204).send(updatedDoc);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
