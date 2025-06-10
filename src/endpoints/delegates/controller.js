const admin = require('firebase-admin');
const { ErrorHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { DelegateRelationshipTypes } = require('../../vs-core/types/delegateRelationshipTypes');
const { TransactionRequestStatusTypes } = require('../../types/transactionRequestStatusTypes');
const { createUser } = require('../users/controller');
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
const { CustomError } = require('../../vs-core-firebase');

exports.createDelegateRelationship = async function (req, res) {
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
      validationSchema: schemas.createDelegateRelationship,
    });
    const { delegateId } = itemData;

    // Get the vault to verify ownership and company
    const vault = await fetchSingleItem({
      collectionName: Collections.VAULTS,
      id: vaultId,
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
        status: 'active',
      },
      auditUid,
    };

    const dbItemData = await createFirestoreDocument(createArgs);

    return res.status(201).send({ message: 'Delegate access granted' });
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.createDelegateFromUser = async function (req, res) {
  try {
    console.log('[createDelegateFromUser] Starting delegate creation process');
    const { userId: auditUid } = res.locals; // Current user
    const { companyId, userId, vaultId } = req.params;
    const { ...userData } = req.body;

    console.log('[createDelegateFromUser] Request parameters:', {
      auditUid,
      companyId,
      userId,
      vaultId,
      userDataKeys: Object.keys(userData),
    });

    if (!userId || !companyId || !vaultId) {
      console.error('[createDelegateFromUser] Missing required parameters:', {
        userId,
        companyId,
        vaultId,
      });
      throw new Error('User ID, Company ID, and Vault ID are required');
    }

    console.log('[createDelegateFromUser] Creating new user with data:', {
      ...userData,
      appRols: [Types.AppRols.APP_CLIENT],
    });

    // First create the user with the provided information
    const newUserData = await createUser({
      auditUid,
      userData: {
        ...userData,
        appRols: [Types.AppRols.APP_CLIENT], // Set default role as client
      },
      appUserStatus: Types.UserStatusTypes.USER_STATUS_TYPE_ACTIVE,
    });

    console.log('[createDelegateFromUser] New user created successfully:', {
      userId: newUserData.id,
      email: newUserData.email,
    });

    console.log('[createDelegateFromUser] Verifying vault:', vaultId);
    // Get the vault to verify ownership and company
    const vault = await fetchSingleItem({
      collectionName: Collections.VAULTS,
      id: vaultId,
    });

    if (!vault) {
      console.error('[createDelegateFromUser] Vault not found:', vaultId);
      throw new Error('Vault not found');
    }
    console.log('[createDelegateFromUser] Vault verified successfully:', {
      vaultId,
      vaultOwner: vault.userId,
    });

    console.log('[createDelegateFromUser] Creating delegate relationship');
    // Now create the delegate relationship using the newly created user's ID
    const createArgs = {
      collectionName: DelegateRelationshipTypes.COLLECTION_NAME,
      itemData: {
        [DelegateRelationshipTypes.USER_ID_PROP_NAME]: userId,
        [DelegateRelationshipTypes.VAULT_ID_PROP_NAME]: vaultId,
        [DelegateRelationshipTypes.DELEGATE_ID_PROP_NAME]: newUserData.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auditUid,
        status: userData.status || 'inactive',
      },
      auditUid,
    };

    console.log('[createDelegateFromUser] Relationship creation args:', {
      collection: createArgs.collectionName,
      userId,
      vaultId,
      delegateId: newUserData.id,
      status: userData.status || 'inactive',
    });

    const dbItemData = await createFirestoreDocument(createArgs);
    console.log('[createDelegateFromUser] Delegate relationship created successfully:', {
      relationshipId: dbItemData.id,
    });

    console.log('[createDelegateFromUser] Process completed successfully');
    return res.status(201).send({
      message: 'Delegate user created and access granted',
      user: newUserData,
      delegateRelationship: dbItemData,
    });
  } catch (err) {
    console.error('[createDelegateFromUser] Error in delegate creation:', {
      error: err.message,
      stack: err.stack,
    });
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.removeDelegate = async function (req, res) {
  try {
    const { companyId, userId, id } = req.params;
    console.log('[removeDelegate] Params:', { companyId, userId, id });

    if (!id) {
      throw new Error('Delegate relationship id is required');
    }

    if (!companyId || !userId) {
      throw new CustomError.TechnicalError(
        'ERROR_REMOVE_DELEGATE',
        null,
        'Error removing delegate. Missing required parameters',
        null
      );
    }

    // First verify the delegate relationship exists and belongs to the correct user/company
    const delegate = await fetchSingleItem({
      collectionName: DelegateRelationshipTypes.COLLECTION_NAME,
      id,
    });

    if (!delegate) {
      throw new Error('Delegate relationship not found');
    }

    if (delegate.userId !== userId || delegate.companyId !== companyId) {
      throw new Error('Unauthorized to remove this delegate relationship');
    }

    // Use the base endpoint's remove function with proper parameters
    // The base endpoint's remove function will handle sending the response
    await remove(req, res, DelegateRelationshipTypes.COLLECTION_NAME);
  } catch (err) {
    console.error('[removeDelegate] Error:', err);
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.listDelegates = async function (req, res) {
  try {
    const { companyId, userId, delegateId } = req.params;
    console.log('[listDelegates] Starting with params:', { companyId, userId, delegateId });

    const db = admin.firestore();
    console.log('[listDelegates] Querying Firestore for delegates...');

    const querySnapshot = await db
      .collection(DelegateRelationshipTypes.COLLECTION_NAME)
      .where(DelegateRelationshipTypes.COMPANY_ID_PROP_NAME, '==', companyId)
      .where(DelegateRelationshipTypes.DELEGATE_ID_PROP_NAME, '==', delegateId)
      .where('status', '==', 'active')
      .get();

    console.log('[listDelegates] Query completed. Found', querySnapshot.size, 'delegates');

    const delegates = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log('[listDelegates] Successfully returning delegates');
    return res.status(200).send(delegates);
  } catch (err) {
    console.error('[listDelegates] Error:', err);
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findDelegatesByUser = async function (req, res) {
  try {
    console.log('[findDelegatesByUser] Starting with params:', req.params);
    console.log('[findDelegatesByUser] Query params:', req.query);

    const { userId } = req.params;
    const { filters } = req.query;

    if (!userId) {
      console.error('[findDelegatesByUser] Missing userId parameter');
      throw new Error('User ID is required');
    }

    console.log('[findDelegatesByUser] Building query for userId:', userId);

    const db = admin.firestore();
    let query = db
      .collection(DelegateRelationshipTypes.COLLECTION_NAME)
      .where(DelegateRelationshipTypes.USER_ID_PROP_NAME, '==', userId);

    // Apply additional filters if provided
    if (filters) {
      console.log('[findDelegatesByUser] Applying filters:', filters);
      // Handle filters with operators
      Object.entries(filters).forEach(([field, conditions]) => {
        if (field && conditions) {
          if (conditions.$equal) {
            // Convert state to number if it's the state field
            const value = field === 'state' ? parseInt(conditions.$equal) : conditions.$equal;
            console.log(
              `[findDelegatesByUser] Adding filter - field: ${field}, operator: $equal, value: ${value}`
            );
            query = query.where(field, '==', value);
          }
        }
      });
    }

    console.log('[findDelegatesByUser] Executing query...');
    const querySnapshot = await query.get();
    console.log('[findDelegatesByUser] Query completed. Found', querySnapshot.size, 'delegates');

    const delegates = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Manual enrichment: fetch user info for each delegateId using fetchItemsByIds
    const delegateIds = delegates.map((delegate) => delegate.delegateId).filter(Boolean);
    const usersMap = {};
    if (delegateIds.length > 0) {
      const userRecords = await fetchItemsByIds({
        collectionName: Collections.USERS,
        ids: delegateIds,
      });
      userRecords.forEach((userData) => {
        usersMap[userData.id] = {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          identificationNumber: userData.identificationNumber,
          phoneNumber: userData.phoneNumber,
        };
      });
    }

    // Combine delegate data with user details
    const enrichedDelegates = delegates.map((delegate) => ({
      ...delegate,
      delegate: usersMap[delegate.delegateId] || {
        firstName: 'Unknown',
        lastName: 'User',
        email: null,
        identificationNumber: null,
        phoneNumber: null,
      },
    }));

    console.log(
      '[findDelegatesByUser] Successfully returning response with',
      enrichedDelegates.length,
      'items'
    );
    return res.status(200).send({
      items: enrichedDelegates,
      total: enrichedDelegates.length,
    });
  } catch (err) {
    console.error('[findDelegatesByUser] Error:', {
      message: err.message,
      stack: err.stack,
      params: req.params,
      query: req.query,
    });
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findDelegatesByCompany = async function (req, res) {
  try {
    console.log('[findDelegatesByCompany] Starting with params:', req.params);
    console.log('[findDelegatesByCompany] Query params:', req.query);

    const { companyId } = req.params;
    const { limit, offset } = req.query;
    let { filters } = req.query;

    console.log('[findDelegatesByCompany] Processing request for companyId:', companyId);

    if (!filters) {
      console.log(
        '[findDelegatesByCompany] No filters provided, initializing empty filters object'
      );
      filters = {};
    }

    // Convert state to number if it exists
    if (filters.state && filters.state.$equal) {
      console.log(
        '[findDelegatesByCompany] Converting state filter to number:',
        filters.state.$equal
      );
      filters.state.$equal = parseInt(filters.state.$equal, 10);
    }

    if (!filters.status) {
      console.log('[findDelegatesByCompany] No status filter, setting default to active');
      filters.status = { $equal: 'active' };
    }

    console.log('[findDelegatesByCompany] Final filters:', filters);
    console.log('[findDelegatesByCompany] Pagination params - limit:', limit, 'offset:', offset);

    console.log('[findDelegatesByCompany] Calling listByPropInner with companyId:', companyId);
    const result = await listByPropInner({
      limit,
      offset,
      filters,
      primaryEntityPropName: DelegateRelationshipTypes.COMPANY_ID_PROP_NAME,
      primaryEntityValue: companyId,
      primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: DelegateRelationshipTypes.COLLECTION_NAME,
      indexedFilters: ['userId', 'companyId', 'vaultId', 'delegateId', 'status'],
      relationships: [
        {
          collectionName: Collections.USERS,
          propertyName: DelegateRelationshipTypes.USER_ID_PROP_NAME,
        },
        {
          collectionName: Collections.USERS,
          propertyName: DelegateRelationshipTypes.DELEGATE_ID_PROP_NAME,
        },
        {
          collectionName: Collections.VAULTS,
          propertyName: DelegateRelationshipTypes.VAULT_ID_PROP_NAME,
        },
      ],
    });

    // Manual enrichment: fetch user info for each delegateId using fetchItemsByIds
    const delegates = result.items || [];
    const delegateIds = delegates.map((delegate) => delegate.delegateId).filter(Boolean);
    const usersMap = {};
    if (delegateIds.length > 0) {
      const userRecords = await fetchItemsByIds({
        collectionName: Collections.USERS,
        ids: delegateIds,
      });
      userRecords.forEach((userData) => {
        usersMap[userData.id] = {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          identificationNumber: userData.identificationNumber,
          phoneNumber: userData.phoneNumber,
        };
      });
    }
    // Combine delegate data with user details
    const enrichedDelegates = delegates.map((delegate) => ({
      ...delegate,
      delegate: usersMap[delegate.delegateId] || {
        firstName: 'Unknown',
        lastName: 'User',
        email: null,
        identificationNumber: null,
        phoneNumber: null,
      },
    }));
    // Return enriched result
    const enrichedResult = {
      ...result,
      items: enrichedDelegates,
    };

    console.log(
      '[findDelegatesByCompany] Successfully enriched and returning delegates. Count:',
      enrichedDelegates.length
    );
    return res.send(enrichedResult);
  } catch (err) {
    console.error('[findDelegatesByCompany] Error:', {
      message: err.message,
      stack: err.stack,
      params: req.params,
      query: req.query,
    });
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findByDelegateId = async function (req, res) {
  try {
    const { delegateId } = req.params;
    const { limit: limitStr, offset: offsetStr } = req.query;

    // Parse limit and offset as integers, with fallback values
    const limit = limitStr ? parseInt(limitStr, 10) : 1000;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    const db = admin.firestore();
    const querySnapshot = await db
      .collection(DelegateRelationshipTypes.COLLECTION_NAME)
      .where(DelegateRelationshipTypes.DELEGATE_ID_PROP_NAME, '==', delegateId)
      .where('status', '==', 'active')
      .limit(limit)
      .offset(offset)
      .get();

    const delegates = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
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
        {
          collectionName: Collections.USERS,
          propertyName: DelegateRelationshipTypes.USER_ID_PROP_NAME,
        },
        {
          collectionName: Collections.USERS,
          propertyName: DelegateRelationshipTypes.DELEGATE_ID_PROP_NAME,
        },
        {
          collectionName: Collections.COMPANIES,
          propertyName: DelegateRelationshipTypes.COMPANY_ID_PROP_NAME,
        },
        {
          collectionName: Collections.VAULTS,
          propertyName: DelegateRelationshipTypes.VAULT_ID_PROP_NAME,
        },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.getDelegateById = async function (req, res) {
  try {
    const { id } = req.params;

    const db = admin.firestore();
    const docRef = db.collection(DelegateRelationshipTypes.COLLECTION_NAME).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error('Delegate relationship not found');
    }

    const delegate = {
      id: doc.id,
      ...doc.data(),
    };

    return res.status(200).send(delegate);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
