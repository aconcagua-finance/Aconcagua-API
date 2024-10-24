/* eslint-disable no-console */
const admin = require('firebase-admin');

const { createFirestoreDocument } = require('../baseEndpoint');
const { SYS_ADMIN_EMAIL } = require('../../config/appConfig');
const { Collections } = require('../../types/collectionsTypes');
const { Types } = require('../../vs-core');
const { UserStatusTypes } = require('../../types/userStatusTypes');

const { ErrorHelper } = require('../../vs-core-firebase');

exports.showEnv = async function (req, res) {
  try {
    return res.status(201).send({ env: process.env });
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

const setUserClaims = async function ({ userId, appRols, enterpriseRols, appUserStatus }) {
  // appRols: decodedToken.appRols, // [APP_ADMIN]

  console.log(
    'setUserAppRolsClaim: ',
    JSON.stringify({ userId, appRols, enterpriseRols, appUserStatus })
  );
  await admin.auth().setCustomUserClaims(userId, { appRols, enterpriseRols, appUserStatus });
};

exports.setUserClaims = setUserClaims;

exports.setUserClaimsByReq = async function (req, res) {
  try {
    const { userId, appRols, enterpriseRols, appUserStatus } = req.body;

    let user = null;

    if (!userId) {
      return res.status(400).send({ message: 'Missing fields' });
    }

    await setUserClaims({ userId, appRols, enterpriseRols, appUserStatus });

    if (!user) user = await admin.auth().getUser(userId);

    return res.status(204).send({ user });
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.setUserProps = async function (req, res) {
  try {
    const { uid, password, displayName, email } = req.body;
    await admin.auth().updateUser(uid, {
      displayName,

      password,
      email,
    });

    return res.status(200).send();
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.setUserPassword = async function (req, res) {
  try {
    const { uId, password } = req.body;

    await admin.auth().updateUser(uId, {
      password,
    });

    return res.status(200).send();
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.switchMagic = async function (req, res) {
  try {
    const db = admin.firestore();

    const PARAMS_COLLECTION = 'params';

    const doc = await db.collection(PARAMS_COLLECTION).doc('magic').get();

    if (!doc.exists) {
      await db.collection(PARAMS_COLLECTION).doc('magic').set({ value: true });
    } else {
      const actualValue = { ...doc.data() };

      await db.collection(PARAMS_COLLECTION).doc('magic').update({ value: !actualValue.value });
    }

    return res.status(200).send();
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.createSysAdmin = async function (req, res) {
  try {
    const uId = 'sys-admin';
    console.log('Creating sys admin user (' + SYS_ADMIN_EMAIL + ')');

    let user = null;

    try {
      user = await admin.auth().getUserByEmail(SYS_ADMIN_EMAIL);
    } catch (e) {
      console.log('User not found, proceed');
    }

    if (user) {
      throw new Error('Duplicated user');
    }

    const newUserdata = await admin.auth().createUser({
      uid: uId,
      displayName: uId,
      email: SYS_ADMIN_EMAIL,
    });

    console.log('Firebase Auth User created ok');

    await createFirestoreDocument({
      collectionName: Collections.USERS,
      itemData: { email: SYS_ADMIN_EMAIL },
      auditUid: uId,
      documentId: uId,
    });

    console.log('Firestore User created ok');
    try {
      await setUserClaims({
        userId: uId,
        appRols: [Types.AppRols.APP_ADMIN],
        orgRoles: [],
        userDefinedRoles: [],
        enterpriseRoles: [],
        appUserStatus: UserStatusTypes.USER_STATUS_TYPE_ACTIVE,
      });
      console.log('User claims set successfully');
    } catch (err) {
      console.error('Error setting user claims', err);
      throw new Error('Failed to set user claims');
    }
    console.log('Return');
    return res.status(200).send(newUserdata);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
