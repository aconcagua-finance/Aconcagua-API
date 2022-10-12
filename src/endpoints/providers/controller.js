/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');

const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');

const { CustomError } = require('../../vs-core');

const { uploadFile } = require('../../helpers/storageHelper');

const { Collections } = require('../../types/collectionsTypes');
const providerSchema = require('../../schemas/providerSchema');

const fetchProviders = async function (filterState) {
  try {
    const db = admin.firestore();
    const ref = db.collection(Collections.PROVIDERS);

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
    throw new CustomError.TechnicalError('ERROR_FETCH_PROVIDERS', null, err.message, err);
  }
};

const fetchSingleProvider = async function (id) {
  try {
    const db = admin.firestore();
    const doc = await db.collection(Collections.PROVIDERS).doc(id).get();

    const item = { ...doc.data(), id };

    return item;
  } catch (err) {
    throw new CustomError.TechnicalError('ERROR_FETCH_PROVIDERS', null, err.message, err);
  }
};

const filterProviders = function ({ items, limit = 100, offset = 0, filters }) {
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

exports.all = async function (req, res) {
  try {
    // / movies?filters[movies]=USA&fields[]=id&fields[]=name
    const { limit, offset, filters, state } = req.query;

    let filterState = state;
    if (!filterState) filterState = Types.StateTypes.STATE_ACTIVE;

    const providers = await fetchProviders(filterState);

    console.log('OK - all - fetch: ' + providers.length);

    const filteredProviders = filterProviders({ items: providers, limit, offset, filters });

    if (filteredProviders.items) {
      console.log('OK - all - filter: ' + filteredProviders.items.length);
    }

    return res.send(filteredProviders);
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

    const providers = await fetchSingleProvider(id);

    console.log('OK - get');

    return res.send({ providers });
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.create = async function (req, res) {
  try {
    const { name, description } = req.body;
    const { userId } = res.locals;

    if (!userId || !name || !description) {
      throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);
    }

    const db = admin.firestore();
    const newDoc = db.collection(Collections.PROVIDERS).doc();
    const newDocId = newDoc.id;

    let imageUploadResult = null;

    if (req.files.length && req.files.length !== 0) {
      // Grab the file
      const file = req.files[0];

      // Format the filename
      const timestamp = Date.now();
      const orName = file.originalname.split('.')[0];
      const type = file.originalname.split('.')[1];
      const fileName = `${orName}_${timestamp}.${type}`;

      imageUploadResult = await uploadFile({
        destination: `images/providers/${newDocId}.${type}`,
        buffer: file.buffer,
        isPublic: true,
      });

      // Step 1. Create reference for file name in cloud storage
      // const imageRef = storage.child(fileName);
      // Step 2. Upload the file in the bucket storage
      // const snapshot = await imageRef.put(file.buffer);
      // Step 3. Grab the public url
      // profileImageUrl = await snapshot.ref.getDownloadURL();
    }

    const itemData = {
      state: Types.StateTypes.STATE_ACTIVE,
      name,
      description,
      images: imageUploadResult ? [{ type: 'profile', ...imageUploadResult }] : null,
      relevant: true,

      ...creationStruct(userId),
      ...updateStruct(userId),
    };

    const docData = await providerSchema.validateAsync(itemData);

    // Add a new document with a generated id.
    await db.collection(Collections.PROVIDERS).doc(newDocId).set(docData);

    console.log('Creating provider ' + JSON.stringify(docData));
    return res.status(201).send(newDocId);
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

    const db = admin.firestore();

    const data = {
      name,
      description,
      iconName,
    };
    const updates = { ...data, ...updateStruct(userId) };

    // Update document.
    const updatedDoc = await db.collection(Collections.PROVIDERS).doc(id).update(updates);

    return res.status(204).send(updatedDoc);
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
    const updatedDoc = await db.collection(Collections.PROVIDERS).doc(id).update(updates);

    return res.status(204).send(updatedDoc);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
