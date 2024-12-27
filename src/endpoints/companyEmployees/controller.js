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

const INDEXED_FILTERS = ['userId', 'companyId'];

// La fn findWithUserRelationship pretende recibir como value de PRIMARY_ENTITY_PROPERTY_NAME el id de usuario del staff.
// En la fn findWithUserRelationship se recibi por param 'userId' y desde el front se envia el id del staff... medio raro, TODO FIX
const COMPANY_ENTITY_PROPERTY_NAME = 'companyId';
const USER_ENTITY_PROPERTY_NAME = 'userId';
const PROFILE_ENTITY_PROPERTY_NAME = 'employeeProfile';
const DEPARTMENT_ENTITY_PROPERTY_NAME = 'employeeDepartment';

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
      listByCollectionName: Collections.COMPANY_EMPLOYEES,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
        {
          collectionName: Collections.COMPANY_PROFILES,
          propertyName: PROFILE_ENTITY_PROPERTY_NAME,
        },
        {
          collectionName: Collections.COMPANY_DEPARTMENTS,
          propertyName: DEPARTMENT_ENTITY_PROPERTY_NAME,
        },
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
      listByCollectionName: Collections.COMPANY_EMPLOYEES,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
        {
          collectionName: Collections.COMPANY_PROFILES,
          propertyName: PROFILE_ENTITY_PROPERTY_NAME,
        },
        {
          collectionName: Collections.COMPANY_DEPARTMENTS,
          propertyName: DEPARTMENT_ENTITY_PROPERTY_NAME,
        },
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
      listByCollectionName: Collections.COMPANY_EMPLOYEES,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
        {
          collectionName: Collections.COMPANY_PROFILES,
          propertyName: PROFILE_ENTITY_PROPERTY_NAME,
        },
        {
          collectionName: Collections.COMPANY_DEPARTMENTS,
          propertyName: DEPARTMENT_ENTITY_PROPERTY_NAME,
        },
      ],
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
    collectionName: Collections.COMPANY_EMPLOYEES,

    relationships: [
      { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
      { collectionName: Collections.COMPANY_PROFILES, propertyName: PROFILE_ENTITY_PROPERTY_NAME },
      {
        collectionName: Collections.COMPANY_DEPARTMENTS,
        propertyName: DEPARTMENT_ENTITY_PROPERTY_NAME,
      },
    ],
  });
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  const { userId: targetUserId, companyId } = req.params;

  const body = req.body;
  body.companyId = companyId;

  const collectionName = Collections.COMPANY_EMPLOYEES;
  const validationSchema = schemas.update;

  try {
    const { id } = req.params;

    if (!id) throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);

    console.log('Patch args (' + collectionName + '):', JSON.stringify(body));

    const itemData = await sanitizeData({ data: body, validationSchema });

    if (
      !itemData.employeeRols ||
      !Array.isArray(itemData.employeeRols) ||
      !companyId ||
      !targetUserId
    ) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE_EMPLOYEE',
        null,
        'Error creating employee. Missing args',
        null
      );
    }

    await fetchAndUpdateUserEnterpriseRols({
      auditUid,
      userId: targetUserId,
      companyId,
      enterpriseRols: itemData.employeeRols,
    });

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
      'ERROR_REMOVE_EMPLOYEE',
      null,
      'Error removing employee. Missing args',
      null
    );
  }

  try {
    // Actualizar roles empresariales
    await fetchAndUpdateUserEnterpriseRols({
      auditUid,
      userId: targetUserId,
      companyId,
      enterpriseRols: null, // Indica que la relación con esta empresa se elimina
    });

    // Remover la relación
    await remove(req, res, Collections.COMPANY_EMPLOYEES);

    // Verificar si el usuario tiene más relaciones activas
    const activeRelationships = await listByPropInner({
      filters: {
        userId: { $equal: targetUserId },
        state: { $equal: Types.StateTypes.STATE_ACTIVE },
      },
      listByCollectionName: Collections.COMPANY_EMPLOYEES,
    });

    // Si no hay relaciones activas, eliminar el rol APP_LENDER
    if (!activeRelationships.items.length) {
      const targetUser = await getFirebaseUserById(targetUserId);

      if (targetUser.appRols.includes(Types.AppRols.APP_LENDER)) {
        targetUser.appRols = targetUser.appRols.filter((rol) => rol !== Types.AppRols.APP_LENDER);

        // Actualizar los roles del usuario
        await updateSingleItem({
          collectionName: Collections.USERS,
          auditUid,
          id: targetUserId,
          data: { appRols: targetUser.appRols },
        });

        console.log('APP_LENDER role removed from user:', targetUserId);
      }
    }

    res.status(204).send();
  } catch (err) {
    console.error('Error in remove COMPANY_EMPLOYEES:', err);
    return ErrorHelper.handleError(req, res, err);
  }
};

const fetchAndUpdateUserEnterpriseRols = async ({
  auditUid,
  userId,
  companyId,
  enterpriseRols,
}) => {
  // 1. obtengo el usuario asociado al empleado
  const targetUser = await getFirebaseUserById(userId);

  if (!targetUser.enterpriseRols) targetUser.enterpriseRols = [];

  console.log(
    'OK fetching user ' + userId,
    'user enterpriseExistentRols: ' + JSON.stringify(targetUser.enterpriseRols)
  );

  const newEnterpriseRols = [];

  // 2. agrego todos los roles excepto el recibido a un array vacio
  targetUser.enterpriseRols.forEach((targetUserEnterpriseRol) => {
    if (targetUserEnterpriseRol.companyId === companyId) return;

    newEnterpriseRols.push(targetUserEnterpriseRol);
  });

  // 3. agrego el rol recibido
  // cuando es remove viene null
  if (enterpriseRols) newEnterpriseRols.push({ companyId, rols: enterpriseRols });

  console.log('New user enterpriseRols ' + JSON.stringify(newEnterpriseRols));

  // 3.1 le agrego el appRol LENDER
  // TODO si queda desvinculado de todas las empresas sacarle el appRol
  if (!targetUser.appRols.includes(Types.AppRols.APP_LENDER)) {
    targetUser.appRols.push(Types.AppRols.APP_LENDER);
  }

  // 4. atualizo el usuario
  updateSingleItem({
    collectionName: Collections.USERS,
    auditUid,
    id: userId,
    data: { enterpriseRols: newEnterpriseRols, appRols: targetUser.appRols },
  });

  console.log('ok updating user document');

  // 5. actualizo los claims del usuario en el motor de autenticacion
  await setUserClaims({
    userId,
    appRols: targetUser.appRols,
    enterpriseRols: newEnterpriseRols,
    appUserStatus: targetUser.appUserStatus,
  });

  console.log('ok updating user claims');
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;
  const { userId: targetUserId, companyId } = req.params;

  const body = req.body;
  body.userId = targetUserId;
  body.companyId = companyId;

  const collectionName = Collections.COMPANY_EMPLOYEES;
  const validationSchema = schemas.create;

  try {
    console.log('Create args (' + collectionName + '):', body);

    const itemData = await sanitizeData({ data: body, validationSchema });

    if (
      !itemData.employeeRols ||
      !Array.isArray(itemData.employeeRols) ||
      !companyId ||
      !targetUserId
    ) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE_EMPLOYEE',
        null,
        'Error creating employee. Missing args',
        null
      );
    }

    await fetchAndUpdateUserEnterpriseRols({
      auditUid,
      userId: targetUserId,
      companyId,
      enterpriseRols: itemData.employeeRols,
    });

    const createArgs = { collectionName, itemData, auditUid };

    // creo la relacion empresa-empleado
    const dbItemData = await createFirestoreDocument(createArgs);

    console.log('Create data: (' + collectionName + ') ' + JSON.stringify(dbItemData));

    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
