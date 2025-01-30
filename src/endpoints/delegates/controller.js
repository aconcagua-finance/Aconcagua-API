const admin = require('firebase-admin');
const { ErrorHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { DelegateRelationshipTypes } = require('../../vs-core/types/delegateRelationshipTypes');
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
  listWithRelationships,
  getByProp,
  getFirebaseUserById,
  createFirestoreDocument,
} = require('../baseEndpoint');
const schemas = require('./schemas');
const { Collections } = require('../../types/collectionsTypes');

exports.createDelegate = async function (req, res) {
  try {
    const { userId: auditUid } = res.locals; // Current user
    const { vaultId } = req.params;
    console.log('userId', auditUid);
    console.log('vaultId', vaultId);
    console.log('req.body', req.body);
    console.log('req.params', req.params);

    // Validate request body
    const itemData = await sanitizeData({
      data: req.body,
      validationSchema: schemas.create
    });
    const { delegateId } = itemData;

    // Get the vault to verify ownership and company
    const vault = await fetchSingleItem({
      collectionName: Collections.VAULTS,
      id: vaultId
    });

    if (!vault) {
      throw new Error('Vault not found');
    }

    // Create delegate relationship
    const createArgs = {
      collectionName: DelegateRelationshipTypes.COLLECTION_NAME,
      itemData: {
        [DelegateRelationshipTypes.USER_ID_PROP_NAME]: vault.userId,
        [DelegateRelationshipTypes.COMPANY_ID_PROP_NAME]: vault.companyId,
        [DelegateRelationshipTypes.VAULT_ID_PROP_NAME]: vaultId,
        [DelegateRelationshipTypes.DELEGATE_ID_PROP_NAME]: delegateId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auditUid,
        status: 'active'
      },
      auditUid
    };

    const dbItemData = await createFirestoreDocument(createArgs);

    return res.status(201).send({ message: 'Delegate access granted' });
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.removeDelegate = async function (req, res) {
  try {
    const { vaultId, delegateId } = req.params;

    const db = admin.firestore();
    const querySnapshot = await db
      .collection(DelegateRelationshipTypes.COLLECTION_NAME)
      .where(DelegateRelationshipTypes.VAULT_ID_PROP_NAME, '==', vaultId)
      .where(DelegateRelationshipTypes.DELEGATE_ID_PROP_NAME, '==', delegateId)
      .get();

    if (querySnapshot.empty) {
      throw new Error('Delegate relationship not found');
    }

    // Delete the relationship
    const batch = db.batch();
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return res.status(200).send({ message: 'Delegate access removed' });
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.listDelegates = async function (req, res) {
  try {
    const { companyId, userId, vaultId } = req.params;

    const db = admin.firestore();
    const querySnapshot = await db
      .collection(DelegateRelationshipTypes.COLLECTION_NAME)
      .where(DelegateRelationshipTypes.COMPANY_ID_PROP_NAME, '==', companyId)
      .where(DelegateRelationshipTypes.USER_ID_PROP_NAME, '==', userId)
      .where(DelegateRelationshipTypes.VAULT_ID_PROP_NAME, '==', vaultId)
      .where('status', '==', 'active')
      .get();

    const delegates = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.status(200).send(delegates);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findDelegatesByUser = async function (req, res) {
  try {
    const { companyId, userId } = req.params;
    const { limit, offset } = req.query;

    const db = admin.firestore();
    const querySnapshot = await db
      .collection(DelegateRelationshipTypes.COLLECTION_NAME)
      .where(DelegateRelationshipTypes.COMPANY_ID_PROP_NAME, '==', companyId)
      .where(DelegateRelationshipTypes.USER_ID_PROP_NAME, '==', userId)
      .where('status', '==', 'active')
      .limit(limit || 1000)
      .offset(offset || 0)
      .get();

    const delegates = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.status(200).send(delegates);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findDelegatesByCompany = async function (req, res) {
  try {
    const { companyId } = req.params;
    const { limit, offset } = req.query;

    const db = admin.firestore();
    const querySnapshot = await db
      .collection(DelegateRelationshipTypes.COLLECTION_NAME)
      .where(DelegateRelationshipTypes.COMPANY_ID_PROP_NAME, '==', companyId)
      .where('status', '==', 'active')
      .limit(limit || 1000)
      .offset(offset || 0)
      .get();

    const delegates = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.status(200).send(delegates);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findByDelegateId = async function (req, res) {
  try {
    const { delegateId } = req.params;
    const { limit, offset } = req.query;

    const db = admin.firestore();
    const querySnapshot = await db
      .collection(DelegateRelationshipTypes.COLLECTION_NAME)
      .where(DelegateRelationshipTypes.DELEGATE_ID_PROP_NAME, '==', delegateId)
      .where('status', '==', 'active')
      .limit(limit || 1000)
      .offset(offset || 0)
      .get();

    const delegates = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.status(200).send(delegates);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

const COLLECTION_NAME = DelegateRelationshipTypes.COLLECTION_NAME;
const INDEXED_FILTERS = ['userId', 'companyId', 'vaultId', 'delegateId', 'status'];

exports.find = async function (req, res) {
  try {
    console.log('HOLA QUE PASA');
    const { limit, offset } = req.query;
    let { filters } = req.query;

    if (!filters) filters = {};
    if (!filters.status) filters.status = { $equal: 'active' };

    const result = await listByPropInner({
      limit,
      offset,
      filters,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.USERS, propertyName: DelegateRelationshipTypes.USER_ID_PROP_NAME },
        { collectionName: Collections.USERS, propertyName: DelegateRelationshipTypes.DELEGATE_ID_PROP_NAME },
        { collectionName: Collections.COMPANIES, propertyName: DelegateRelationshipTypes.COMPANY_ID_PROP_NAME },
        { collectionName: Collections.VAULTS, propertyName: DelegateRelationshipTypes.VAULT_ID_PROP_NAME }
      ]
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
