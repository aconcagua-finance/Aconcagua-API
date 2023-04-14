/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');

const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { EmailSender } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');
const { NEW_USERS_TEMP_PASSWORD } = require('../../config/appConfig');

const { CustomError } = require('../../vs-core');

const { Collections } = require('../../types/collectionsTypes');

const schemas = require('./schemas');
const usersByStaffschemas = require('../usersByStaff/schemas');
const leadsSchemas = require('../leads/schemas');

const { LeadStatusTypes } = require('../../types/leadStatusTypes');
const {
  sanitizeData,
  find,
  get,
  patch,
  remove,
  create,
  fetchItems,
  fetchSingleItem,
  updateSingleItem,
  filterItems,
  getFirebaseUsersByIds,
  getFirebaseUserById,
  getFirebaseUserByEmail,
  deleteLogicalSingleItem,
  createFirestoreDocumentId,
} = require('../baseEndpoint');

const { setUserClaims } = require('../admin/controller');

const { PaymentStatusType } = require('../../types/paymentStatusTypes');
const { UserStatusTypes } = require('../../types/userStatusTypes');

const COLLECTION_NAME = Collections.USERS;

const INDEXED_FILTERS = ['state'];

const createUser = async function ({ auditUid, userData, appUserStatus, password }) {
  let userId = userData.id;

  console.log('createUser: ' + JSON.stringify(userData));

  // TODO MICHEL escenarios de existencia de uid o de email
  if (userId) {
    const CREATE_USER_INVALID_EMAIL_OR_ID_ERROR_CODE = 'CREATE_USER_INVALID_EMAIL_OR_ID';

    try {
      console.log('Se busca usuario con id ' + userId);

      const firestoreUser = await admin.auth().getUser(userId);
      console.log('usuario con id ' + userId + ' encontrado con éxito');

      if (firestoreUser.email !== userData.email) {
        const errorMessage =
          'El usuario con id ' +
          userId +
          ' ya existía, pero el email es distinto al informado (' +
          firestoreUser.email +
          ' != ' +
          userData.email +
          ')';
        console.error(errorMessage);

        throw new CustomError.TechnicalError(
          CREATE_USER_INVALID_EMAIL_OR_ID_ERROR_CODE,
          null,
          errorMessage,
          null
        );
      }
    } catch (e) {
      if (e.code === CREATE_USER_INVALID_EMAIL_OR_ID_ERROR_CODE) {
        throw e;
      }

      console.log('El usuario con id ' + userId + ' no existia, se procede a crearlo');
      // si no existe intento crearlo
      await admin.auth().createUser({
        uid: userId,
        displayName: userData.firstName + ' ' + userData.lastName,

        password: NEW_USERS_TEMP_PASSWORD,
        email: userData.email,
      });

      console.log('Usuario creado con éxito ' + userId);
    }
  } else {
    try {
      console.log('Se busca usuario con email ' + userData.email);
      const firestoreUser = await admin.auth().getUserByEmail(userData.email);
      console.log(
        'El usuario con el email ' +
          userData.email +
          ' ya existía, se utiliza este id ' +
          firestoreUser.uid
      );

      userId = firestoreUser.uid;
    } catch (e) {
      console.log(
        'El usuario con mail: ' +
          userData.email +
          ' no existia, se procede a crearlo y se autogenera un uid'
      );

      const firestoreUser = await admin.auth().createUser({
        displayName: userData.firstName + ' ' + userData.lastName,

        password: password || NEW_USERS_TEMP_PASSWORD,
        email: userData.email,
      });

      console.log('Se generó el usuario:' + firestoreUser.uid);
      userId = firestoreUser.uid;
    }
  }

  const newUserData = {
    ...userData,
    appUserStatus,
    state: Types.StateTypes.STATE_ACTIVE,
    id: userId,

    ...creationStruct(auditUid),
    ...updateStruct(auditUid),
  };

  console.log('appRols:', newUserData.appRols);

  if (!newUserData.appRols) {
    throw new CustomError.TechnicalError('ERROR_PATCH_USER_3', null, 'Missing rols', null);
  }

  if (!newUserData.enterpriseRols) newUserData.enterpriseRols = [];

  // el campo appUserStatus es clave para que el front sepa si el usuario está activo o moroso sin consultar servicios adicionales
  await setUserClaims({
    userId,
    appRols: newUserData.appRols,
    enterpriseRols: newUserData.enterpriseRols,
    appUserStatus,
  });

  const db = admin.firestore();

  await db.collection(COLLECTION_NAME).doc(userId).set(newUserData);

  return newUserData;
};

exports.fetchAndUpdateUserAppRols = async ({ auditUid, userId, appRols }) => {
  // 1. obtengo el usuario asociado al empleado
  const targetUser = await getFirebaseUserById(userId);

  console.log('OK fetching user ' + userId, 'user appRols: ' + JSON.stringify(targetUser.appRols));

  // 4. atualizo el usuario
  updateSingleItem({
    collectionName: Collections.USERS,
    auditUid,
    id: userId,
    data: { appRols },
  });

  console.log('ok updating user document');

  // 5. actualizo los claims del usuario en el motor de autenticacion
  await setUserClaims({
    userId,
    appRols,
    enterpriseRols: targetUser.enterpriseRols,
    appUserStatus: targetUser.appUserStatus,
  });

  console.log('ok updating user claims');
};

const patchUser = async function ({ auditUid, userData, appUserStatus }) {
  console.log('patchUser: ' + JSON.stringify(userData));

  if (userData.firstName && userData.lastName) {
    try {
      await admin.auth().updateUser(userData.id, {
        displayName: userData.firstName + ' ' + userData.lastName,

        // email: userData.email,
      });
    } catch (e) {
      throw new CustomError.TechnicalError('ERROR_PATCH_USER_1', null, e.message, e);
    }
  }

  try {
    // el campo appUserStatus es clave para que el front sepa si el usuario está activo o moroso sin consultar servicios adicionales
    if (userData.appRols) {
      const currentFirebaseUser = await getFirebaseUserById(userData.id);

      console.log(
        'Actualizando roles: ',
        JSON.stringify(userData.appRols),
        JSON.stringify(currentFirebaseUser.appRols)
      );
      // AHORA NO Staff >> ANTES SI Staff
      if (
        !userData.appRols.includes(Types.AppRols.APP_STAFF) &&
        currentFirebaseUser.appRols.includes(Types.AppRols.APP_STAFF)
      ) {
        console.log('Se elimina el STAFF dado que se borró su rol previo');

        // elimino el staff de la coleccion de staffs
        await deleteLogicalSingleItem({
          id: userData.id,
          collectionName: Collections.STAFF,
          auditUid,
        });
      }

      // AHORA SI Staff >> ANTES NO Staff
      else if (
        userData.appRols.includes(Types.AppRols.APP_STAFF) &&
        !currentFirebaseUser.appRols.includes(Types.AppRols.APP_STAFF)
      ) {
        const existentStaff = await fetchSingleItem({
          collectionName: Collections.STAFF,
          id: userData.id,
        });

        console.log('LRPM !', userData.id, existentStaff);

        // si existia simplemente lo reactivo
        // si no existia lanzo un error para que lo cree desde el modulo de staff
        if (existentStaff) {
          console.log('Se actualiza el STAFF dado que se agrego el rol');

          await updateSingleItem({
            collectionName: Collections.STAFF,
            id: userData.id,
            auditUid,
            data: { state: Types.StateTypes.STATE_ACTIVE },
          });
        } else {
          throw new CustomError.TechnicalError(
            'ERROR_PATCH_USER_AS_STAFF',
            null,
            'For new staffs create it from the staff module',
            null
          );
        }
      }

      if (!appUserStatus) appUserStatus = currentFirebaseUser.appUserStatus;
      if (!userData.appRols) userData.appRols = currentFirebaseUser.appRols;
      if (!userData.enterpriseRols) userData.enterpriseRols = currentFirebaseUser.enterpriseRols;

      console.log('Setting claims' + JSON.stringify(userData.appRols));
      await setUserClaims({
        userId: userData.id,
        appRols: userData.appRols,
        enterpriseRols: userData.enterpriseRols,
        appUserStatus,
      });
    }

    userData = {
      ...userData,

      state: Types.StateTypes.STATE_ACTIVE,

      ...updateStruct(auditUid),
    };

    if (appUserStatus) userData.appUserStatus = appUserStatus;

    const db = admin.firestore();

    await db.collection(Collections.USERS).doc(userData.id).update(userData);

    return userData;
  } catch (e) {
    throw new CustomError.TechnicalError('ERROR_PATCH_USER_2', null, e.message, e);
  }
};

exports.createUser = createUser;

const filterUsers = function ({ items, limit = 100, offset = 0, filters }) {
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

  const hasMore = offset + limit < filteredItems.length;

  filteredItems = filteredItems.slice(offset, offset + limit);

  return { items: filteredItems, hasMore, total: totalItems, pageSize: limit };
};

exports.find = async function (req, res) {
  try {
    // / movies?filters[movies]=USA&fields[]=id&fields[]=name
    let { limit, offset, filters } = req.query;

    if (limit) limit = parseInt(limit);

    if (!limit) limit = 1000;

    if (limit && limit > 1000) {
      throw new CustomError.TechnicalError(
        'ERROR_ARGS',
        null,
        'Limit must be less or equal 1000',
        null
      );
    }

    console.log('Filters - ' + COLLECTION_NAME + ' - ' + JSON.stringify(filters));
    const items = await fetchItems({
      collectionName: COLLECTION_NAME,
      limit,
      filters,
      indexedFilters: INDEXED_FILTERS,
    });

    items.forEach((item) => {
      if (item.birthDate) item.birthDate = item.birthDate.toDate();
      if (item.lastTouchpoint) item.lastTouchpoint = item.lastTouchpoint.toDate();
    });

    console.log('OK - all - fetch (' + COLLECTION_NAME + '): ' + items.length);

    const filteredItems = filterItems({ items, limit, offset, filters });

    if (filteredItems.items) console.log('OK - all - filter: ' + filteredItems.items.length);

    const firebaseUsers = await getFirebaseUsersByIds(
      filteredItems.items.map((user) => {
        return user.id;
      })
    );

    // TODO MICHEL - Acá hay dos props, appRols y grants que se pisan al item. O sea que siempre devuelve lo que está en firebase
    // estaría bueno analizar si esto está bien o no
    filteredItems.items = filteredItems.items.map((item) => {
      const firebaseUser = firebaseUsers.find((fbUser) => {
        return fbUser.uid === item.id;
      });

      if (firebaseUser) return { ...item, ...firebaseUser };

      return { ...item };
    });

    return res.send(filteredItems);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Id not recived', null);
    }

    const item = await fetchSingleItem({ collectionName: COLLECTION_NAME, id: userId });

    if (!item) return res.send(null);

    if (item.birthDate) item.birthDate = item.birthDate.toDate();
    if (item.lastTouchpoint) item.lastTouchpoint = item.lastTouchpoint.toDate();

    const firebaseUser = await getFirebaseUserById(userId);

    // TODO MICHEL - Acá hay dos props, appRols y grants que se pisan al item. O sea que siempre devuelve lo que está en firebase
    // estaría bueno analizar si esto está bien o no
    // creo storageAppRols para poder visualizar la data almacenada
    let user = null;
    if (firebaseUser) {
      user = {
        storageEnterpriseRols: item.enterpriseRols,
        storageAppRols: item.appRols,
        ...item,
        ...firebaseUser,
      };
    } else user = { ...item };

    console.log('OK - get (' + COLLECTION_NAME + ')' + JSON.stringify(user));

    return res.send(user);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

const validatePatchUser = async function ({ req, res, validationSchema }) {
  try {
    const { userId } = res.locals;
    const auditUid = userId;

    const { userId: targetUserId } = req.params;

    if (!targetUserId) {
      throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'Invalid args', null);
    }

    const itemData = await sanitizeData({ data: req.body, validationSchema });

    const appRols = itemData.appRols ? itemData.appRols : null;
    const enterpriseRols = itemData.enterpriseRols ? itemData.enterpriseRols : [];

    itemData.id = targetUserId;

    const updatedUser = await patchUser({
      auditUid,
      userData: itemData,
      appUserStatus: itemData.appUserStatus,
      appRols,
      enterpriseRols,
    });

    console.log('Updated user: ', updatedUser);
    return res.status(200).send(updatedUser);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

// desde aca se pueden editar todos los valores, solo los admins deberian poder
exports.patch = async function (req, res) {
  if (
    !res.locals ||
    !res.locals.appRols ||
    !res.locals.appRols.length ||
    res.locals.appRols.length === 0
  ) {
    throw new CustomError.TechnicalError(
      'ERROR_NO_AUTH',
      null,
      'El request no tiene los permisos del usuario',
      null
    );
  }

  // si es admin le dejo updatear todos los campos, sino solo los permitidos para un staff
  if (res.locals.appRols.includes(Types.AppRols.APP_ADMIN)) {
    console.log('updating as ADMIN');
    await validatePatchUser({ req, res, validationSchema: schemas.update });
    return;
  } else if (res.locals.appRols.includes(Types.AppRols.APP_STAFF)) {
    console.log('updating as STAFF');
    await validatePatchUser({ req, res, validationSchema: schemas.updateByStaff });
    return;
  }

  console.log('updating as CURRENT USER');
  await validatePatchUser({ req, res, validationSchema: schemas.updateCurrentUser });
};

// OBSOLETO, NO SE USA
// solo hago un metodo aparte y no juego con el decorador 'allowStaffRelationship' porque no quiero que pueda editar todos los valores
exports.patchByStaff = async function (req, res) {
  await validatePatchUser({ req, res, validationSchema: schemas.updateByStaff });
};

exports.remove = async function (req, res) {
  await remove(req, res, COLLECTION_NAME);
};

exports.create = async function (req, res) {
  try {
    const { userId } = res.locals;
    const auditUid = userId;

    console.log('Create args:', req.body);

    const itemData = await sanitizeData({ data: req.body, validationSchema: schemas.create });

    const appUserStatus = itemData.appUserStatus;

    const userData = await createUser({
      auditUid,
      userData: itemData,
      appUserStatus: appUserStatus || null,
    });

    return res.status(201).send(userData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
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

const getFirestoreUserByEmail = async (email) => {
  const firestoreUsersByEmail = await fetchItems({
    collectionName: COLLECTION_NAME,
    filters: { email: { $equal: email } },
    indexedFilters: ['email'],
  });

  if (!firestoreUsersByEmail || firestoreUsersByEmail.length === 0) {
    return null;
  }

  if (firestoreUsersByEmail.length !== 1) {
    throw new Error('Se encontro más de un usuario con el mismo mail (' + email + ')');
  }

  const user = firestoreUsersByEmail[0];

  return user;
};

const createLeadFromUser = async ({ auditUid, userId, user }) => {
  const itemData = await sanitizeData({ data: user, validationSchema: leadsSchemas.create });
  itemData.leadStatus = LeadStatusTypes.CONVERTED;

  const db = admin.firestore();

  const dbItemData = {
    ...itemData,
    id: userId,

    state: Types.StateTypes.STATE_ACTIVE,

    ...creationStruct(auditUid),
    ...updateStruct(auditUid),
  };

  console.log('Create lead data:', dbItemData);

  const doc = await db.collection(Collections.LEADS).doc(userId).set(dbItemData);
};

// Se utiliza desde el registro de usuarios (webUsers). Solo cuando ingresa con usuario y contraseña
exports.signUp = async function (req, res) {
  try {
    // const documentId = await createFirestoreDocumentId({ collectionName: COLLECTION_NAME });

    const auditUid = 'admin';

    console.log('Create args:', req.body.email);

    const body = req.body;
    body.appUserStatus = Types.UserStatusTypes.USER_STATUS_TYPE_ACTIVE;
    body.appRols = [Types.AppRols.APP_CLIENT];

    const itemData = await sanitizeData({ data: body, validationSchema: schemas.create });

    // valido que aún no exista
    const firestoreUser = await getUserByEmail(itemData.email);

    if (firestoreUser) {
      throw new CustomError.TechnicalError(
        'ERROR_DUPLICATED_EMAIL',
        null,
        'Ya existía el usuario con email ' + itemData.email,
        null
      );
    }

    const appUserStatus = itemData.appUserStatus;

    const userData = await createUser({
      auditUid,
      userData: itemData,
      appUserStatus: appUserStatus || null,
      password: req.body.password,
    });

    // Envio mail de bienvenida al usuario recien creado
    await EmailSender.send({
      to: itemData.email,
      message: null,
      template: {
        name: 'mail-welcome',
        data: {
          username: itemData.firstName + ' ' + itemData.lastName,
        },
      },
    });

    try {
      await createLeadFromUser({ auditUid, userId: userData.id, user: userData });
    } catch (e) {
      console.error('Error creando lead' + e.message);
    }

    return res.status(201).send(userData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

// Se utiliza desde el registro de usuarios (webUsers). Luego de haberse registrado con Google u otra autenticacion federada
exports.signUpFederatedAuth = async function (req, res) {
  try {
    const { userId: auditUid, email } = res.locals;

    const firebaseUser = await getFirebaseUserById(auditUid);

    let firstName = '';
    let lastName = '';

    try {
      if (firebaseUser.displayName) {
        firstName = firebaseUser.displayName.split(' ')[0];
        lastName = firebaseUser.displayName.split(' ')[1];
      }
    } catch (e) {
      console.error('Error parseando displayName: ', e.message, firebaseUser.displayName);
      // dejo seguir
    }

    const userInputData = {
      firstName,
      lastName,
      email,
      identificationNumber: 'n/a', // tiene que tener un valor, si quisieramos algo distinto deberíamos poner un form en el medio
      appUserStatus: Types.UserStatusTypes.USER_STATUS_TYPE_ACTIVE,
      appRols: [Types.AppRols.APP_CLIENT],
    };

    const itemData = await sanitizeData({ data: userInputData, validationSchema: schemas.create });

    // valido que aún no exista en firestore, si tiene que existir en auth
    const firestoreUser = await getFirestoreUserByEmail(itemData.email);

    console.log('Usuario consultado: ' + itemData.email, firestoreUser);

    if (firestoreUser) {
      throw new CustomError.TechnicalError(
        'ERROR_DUPLICATED_EMAIL',
        null,
        'Ya existía el usuario con email ' + itemData.email,
        null
      );
    }

    console.log('previo a crear usuario unicamente en firestore');

    const userData = await createUser({
      id: auditUid, // si le mando el id entonces no intenta crear el user en el motor de autenticación
      auditUid,
      userData: itemData,
      appUserStatus: itemData.appUserStatus,
      password: req.body.password,
    });

    // Se envia un mail luego de crear el usuario
    await EmailSender.send({
      to: itemData.email,
      message: null,
      template: {
        name: 'mail-welcome',
        data: {
          username: itemData.firstName + ' ' + itemData.lastName,
        },
      },
    });

    try {
      await createLeadFromUser({ auditUid, userId: userData.id, user: userData });
    } catch (e) {
      console.error('Error creando lead' + e.message);
    }

    console.log('Usuario creado OK');

    return res.status(201).send(userData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.createByStaff = async function (req, res) {
  try {
    const { userId } = res.locals;
    const auditUid = userId;

    console.log('Create args:', req.body);

    // obtengo los datos del request
    let itemData = await sanitizeData({
      data: req.body,
      validationSchema: schemas.createByStaff,
    });

    console.log('Validated request OK');
    // valido que no exista el email ya como usuario
    let existentUser = null;
    try {
      existentUser = await getFirebaseUserByEmail(itemData.email);
    } catch (e) {}

    if (existentUser) {
      throw new CustomError.TechnicalError(
        'ERROR_DUPLICATED_EMAIL',
        null,
        'Ya existía el usuario con email ' + itemData.email,
        null
      );
    }

    // completo la informacion obligatoria, que no viene en el request
    itemData.paymentData = {
      status: [PaymentStatusType.NONE],
    };

    itemData.appUserStatus = [UserStatusTypes.ACTIVE];

    itemData.appRols = [Types.AppRols.APP_CLIENT];

    console.log('Validation data to main creation schema');

    itemData = await sanitizeData({ data: itemData, validationSchema: schemas.create });

    console.log('Validation main creation schema OK');

    const appUserStatus = itemData.appUserStatus;

    // Creo usuario en firebase y en firestore
    const userData = await createUser({
      auditUid,
      userData: itemData,
      appUserStatus: appUserStatus || null,
    });

    console.log('OK creating user');

    // Creo relacion staff-usuario

    let relationshipItem = {
      staffId: userId,
      userId: userData.id,
      relationshipType: ['patient'],
      grants: ['creator', Collections.USER_TASKS + '.all'], // TODO MICHEL
    };

    console.log('Validatin relatinship data');

    relationshipItem = await sanitizeData({
      data: relationshipItem,
      validationSchema: usersByStaffschemas.create,
    });

    console.log('OK Validatin relatinship data');

    const newDocData = {
      ...relationshipItem,

      state: Types.StateTypes.STATE_ACTIVE,
      ...creationStruct(auditUid),
      ...updateStruct(auditUid),
    };
    const db = admin.firestore();

    console.log('Creating relatinship');
    await db.collection(Types.StaffUsersRelationshipTypes.COLLECTION_NAME).doc().set(newDocData);
    console.log('OK Creating relatinship');

    return res.status(201).send(userData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.normalizePermissions = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  try {
    const items = await fetchItems({ collectionName: COLLECTION_NAME, limit: 1000 });

    const firebaseUsers = await getFirebaseUsersByIds(
      items.map((user) => {
        return user.id;
      })
    );

    const db = admin.firestore();

    const batch = db.batch();

    firebaseUsers.forEach((updateItem) => {
      const updateData = {
        permissions: admin.firestore.FieldValue.delete(),
        appRols: updateItem.appRols,
        enterpriseRols: updateItem.enterpriseRols,
      };

      const ref = db.collection(COLLECTION_NAME).doc(updateItem.uid);
      batch.update(ref, updateData);
    });

    await batch.commit();

    const notFound = [];
    items.forEach((item) => {
      const founded = firebaseUsers.find((fbUser) => {
        return fbUser.uid === item.id;
      });

      if (!founded) notFound.push(item);
    });

    return res.status(201).send({ success: true, users: firebaseUsers, notFound });
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
