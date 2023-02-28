/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');
const { EmailSender } = require('../../vs-core-firebase');

const { CustomError } = require('../../vs-core');

const { UserStatusTypes } = require('../../types/userStatusTypes');

const { Collections } = require('../../types/collectionsTypes');
const { areEqualStringLists, areDeepEqualDocuments } = require('../../helpers/coreHelper');

const { setUserClaims } = require('../admin/controller');

const userSchemas = require('../users/schemas');
const { createUser } = require('../users/controller');

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

exports.find = async function (req, res) {
  const { companyId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
      primaryEntityValue: companyId,
      primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: Collections.COMPANY_CLIENTS,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findByCompany = async function (req, res) {
  const { companyId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
      primaryEntityValue: companyId,
      primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: Collections.COMPANY_CLIENTS,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
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
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: USER_ENTITY_PROPERTY_NAME,
      primaryEntityValue: userId,
      primaryEntityCollectionName: Collections.USERS,
      listByCollectionName: Collections.COMPANY_CLIENTS,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  const { id, companyId, userId } = req.params;

  await getByProp({
    req,
    res,

    byId: id,

    primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
    primaryEntityCollectionName: Collections.COMPANIES,
    collectionName: Collections.COMPANY_CLIENTS,

    relationships: [{ collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME }],
    postProcessor: async (item) => {
      if (!item) return null;

      // Importante para validar permisos - complementario a routes-config
      if (userId && item.userId !== userId) throw new Error('userId missmatch');
      if (companyId && item.companyId !== companyId) throw new Error('companyId missmatch');

      return item;
    },
  });
};

const getCurrentRelationshipInner = async ({ companyId, userId }) => {
  const filters = {};
  // no filtro por estado pq puede estar consultando por una relacion pasada
  // if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };
  filters.companyId = { $equal: companyId };
  // filters.userId = { $equal: companyId }; // ya se filtra por el primaryEntityPropName

  const result = await listByPropInner({
    filters,

    primaryEntityPropName: USER_ENTITY_PROPERTY_NAME,
    primaryEntityValue: userId,

    listByCollectionName: Collections.COMPANY_CLIENTS,
    indexedFilters: INDEXED_FILTERS,
    relationships: [
      { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
      { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
    ],
  });

  let relationshipToReturn = null;
  if (result && result.items && result.items.length) {
    const activeRelationship = result.items.find((item) => {
      return item.state === Types.StateTypes.STATE_ACTIVE;
    });
    if (activeRelationship) relationshipToReturn = activeRelationship;
    else relationshipToReturn = result.items[0];
  }

  console.log('relationship to return: ' + JSON.stringify(relationshipToReturn));
  return relationshipToReturn;
};

exports.getCurrentRelationship = async function (req, res) {
  const { id, companyId, userId } = req.params;
  try {
    const currentRelationship = await getCurrentRelationshipInner({ companyId, userId });

    return res.send(currentRelationship);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const { userId: targetUserId, companyId } = req.params;

  const body = req.body;
  body.companyId = companyId;

  const collectionName = Collections.COMPANY_CLIENTS;
  const validationSchema = schemas.update;

  try {
    const { id } = req.params;

    if (!id) throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);

    console.log('Patch args (' + collectionName + '):', JSON.stringify(body));

    const itemData = await sanitizeData({ data: body, validationSchema });

    if (!companyId || !targetUserId) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE_COMPANY_CLIENT',
        null,
        'Error creating company client. Missing args',
        null
      );
    }

    const doc = await updateSingleItem({ collectionName, id, auditUid, data: itemData });

    console.log('Patch data: (' + collectionName + ')', JSON.stringify(itemData));

    return res.status(204).send(doc);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

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

  await remove(req, res, Collections.COMPANY_CLIENTS);
};

const createCompanyClientRelationship = async ({ auditUid, data }) => {
  const collectionName = Collections.COMPANY_CLIENTS;
  const validationSchema = schemas.create;

  const itemData = await sanitizeData({ data, validationSchema });

  if (!itemData.companyId || !itemData.userId) {
    throw new CustomError.TechnicalError(
      'ERROR_CREATE_COMPANY_CLIENT',
      null,
      'Error creating company client. Missing args',
      null
    );
  }

  const createArgs = { collectionName, itemData, auditUid };

  // creo la relacion empresa-empleado
  const dbItemData = await createFirestoreDocument(createArgs);

  return dbItemData;
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;
  const { userId: targetUserId, companyId } = req.params;

  const body = req.body;
  body.userId = targetUserId;
  body.companyId = companyId;

  const collectionName = Collections.COMPANY_CLIENTS;

  console.log('Create args (' + collectionName + '):', body);
  try {
    const dbItemData = await createCompanyClientRelationship({ auditUid, data: body });

    console.log('Create data: (' + collectionName + ') ' + JSON.stringify(dbItemData));

    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

const getUserById = async (id) => {
  try {
    const firestoreUser = await admin.auth().getUser(id);
    return firestoreUser;
  } catch (e) {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  }
};

const getUserByEmail = async (email) => {
  try {
    const firestoreUser = await admin.auth().getUserByEmail(email);
    return firestoreUser;
  } catch (e) {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  }
};

exports.upsertByCompany = async function (req, res) {
  const { userId: auditUid } = res.locals;
  const { companyId } = req.params;

  console.log('UpsertByCompany args (' + Collections.COMPANY_CLIENTS + '):', req.body);

  const {
    email,
    // firstName, lastName, company, phoneNumber
  } = req.body;

  try {
    // 1. user exists by Email ?
    // 1.1. Si: Creo relacion y omito el nombre demas datos recibidos
    // 1.2. No: Creo usuario y luego creo relacion

    let existentUser = await getUserByEmail(email);

    // si no existe entonces creo el usuario
    if (!existentUser) {
      console.log('No existia el usuario, se creara. (' + email + ')');

      const data = {
        ...req.body,

        appUserStatus: UserStatusTypes.ACTIVE,

        appRols: [Types.AppRols.APP_STAFF],
      };

      const newUserData = await sanitizeData({
        data,
        validationSchema: userSchemas.create,
      });

      console.log('Se procede a crear el usuario con los datos: ' + JSON.stringify(newUserData));
      // creo el usuario
      existentUser = await createUser({
        auditUid,
        userData: newUserData,
        appUserStatus: newUserData.appUserStatus,
      });

      // Envio mail de bienvenida al usuario recien creado
      await EmailSender.send({
        to: newUserData.email,
        message: null,
        template: {
          name: 'mail-welcome',
          data: {
            username: newUserData.firstName + ' ' + newUserData.lastName,
          },
        },
      });

      console.log('Usario creado con éxito');
    }

    const targetUserId = existentUser.id ? existentUser.id : existentUser.uid;

    console.log(
      'Se consulta la relacion existente para ver si se crea o no (' +
        companyId +
        '), (' +
        targetUserId +
        ')'
    );
    const currentRelationship = await getCurrentRelationshipInner({
      companyId,
      userId: targetUserId,
    });

    // console.log('Resultado busqueda Relacion :' + JSON.stringify(currentRelationship));

    // exite la relacion pero esta inactiva
    if (currentRelationship && currentRelationship.state !== Types.StateTypes.STATE_ACTIVE) {
      console.log('Se encontro una relacion con estado inactiva, se procede a reactivarla');
      await updateSingleItem({
        collectionName: Collections.COMPANY_CLIENTS,
        id: currentRelationship.id,
        auditUid,
        data: { state: Types.StateTypes.STATE_ACTIVE },
      });
      console.log('Reactivacion OK');
    }
    // no existe la relacion
    else if (!currentRelationship) {
      const body = req.body;
      body.userId = targetUserId;
      body.companyId = companyId;

      const collectionName = Collections.COMPANY_CLIENTS;

      console.log('No existe la relacion, se creara con args (' + collectionName + '):', body);

      const dbItemData = await createCompanyClientRelationship({ auditUid, data: body });
    } else {
      console.log('La relacion ya existia !, no se hace nada');
    }

    return res.status(201).send({});
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

// por definicion de CTO se habilita a una empresa que tiene una relacion con un cliente a editarle sus datos personales
exports.updateByCompany = async function (req, res) {
  try {
    const { userId: auditUid } = res.locals;

    const { companyId, id } = req.params;

    const collectionName = Collections.COMPANY_CLIENTS;
    const validationSchema = userSchemas.update;

    if (!id) throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);

    console.log('Patch args (' + collectionName + '):', JSON.stringify(req.body));

    // solo lo dejo editar estos campos, no roles ni mail nada raro
    let {
      firstName,
      lastName,
      company,
      phoneNumber,
      identificationNumber,
      companyIdentificationNumber,
    } = req.body;

    if (!company) company = '';
    if (!phoneNumber) phoneNumber = '';

    let itemData = await sanitizeData({
      data: {
        firstName,
        lastName,
        company,
        phoneNumber,
        identificationNumber,
        companyIdentificationNumber,
      },
      validationSchema,
    });

    itemData = { ...itemData, ...updateStruct(auditUid) };

    const currentRelationship = await fetchSingleItem({
      collectionName: Collections.COMPANY_CLIENTS,
      id,
    });

    console.log('Resultado busqueda Relacion :' + JSON.stringify(currentRelationship));

    // existe la relacion pero esta inactiva
    if (!currentRelationship || currentRelationship.state !== Types.StateTypes.STATE_ACTIVE) {
      throw new CustomError.TechnicalError(
        'ERROR_BAD_RELATIONSHIP',
        null,
        'La relacion se encuentra inactiva o inexistente',
        null
      );
    }

    if (currentRelationship.companyId !== companyId) {
      throw new CustomError.TechnicalError(
        'ERROR_WRONG_COMPANY',
        null,
        'Se esta intentando editar una relacion de otra compañia',
        null
      );
    }

    await updateSingleItem({
      collectionName: Collections.USERS,
      id: currentRelationship.userId,
      auditUid,
      data: itemData,
    });

    return res.status(201).send({});
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

// eslint-disable-next-line camelcase
exports.onVaultCreate_ThenCreateCompanyClientRelationship = functions.firestore
  .document(Collections.VAULTS + '/{docId}')
  .onCreate(async (snapshot, context) => {
    const { docId } = context.params;
    // const docId = snapshot.key;
    const documentPath = `${Collections.VAULTS}/${docId}`;
    try {
      const before = null;
      const after = snapshot.data();

      console.log('onVaultCreate_ThenCreateCompanyClientRelationship ' + documentPath);

      const userId = after.userId;
      const companyId = after.companyId;
      const updatedBy = after.updatedBy;

      const collectionName = Collections.COMPANY_CLIENTS;

      // TODO MICHEL - validar si no existe ya la relacion
      console.log('Obtengo si existe una relacion actualmente');
      const db = admin.firestore();
      const ref = db.collection(collectionName);

      const querySnapshot = await ref
        .where('userId', '==', userId)
        .where('companyId', '==', companyId)
        .get();

      if (!querySnapshot.docs) return [];

      const items = querySnapshot.docs.map((doc) => {
        const id = doc.id;
        const data = doc.data();

        if (data.createdAt) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt) data.updatedAt = data.updatedAt.toDate();

        return { ...data, id };
      });

      // ya existia la relacion
      if (!items.length) {
        const dbItemData = await createCompanyClientRelationship({
          auditUid: updatedBy,
          data: { userId, companyId },
        });

        console.log('Created relationship');
      } else {
        console.log('Relationship pre existent');
      }

      console.log('onVaultCreate_ThenCreateCompanyClientRelationship success ' + documentPath);
    } catch (err) {
      console.error('error onUpdate document', documentPath, err);

      return null;
    }
  });
