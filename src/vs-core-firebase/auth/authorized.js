/* eslint-disable no-console */

// grants[ {companyId, rols: [ENTERPRISE_SALES, ENTERPRISE_ADMIN]}]
// appRols: decodedToken.appRols, // [APP_ADMIN]
const admin = require('firebase-admin');
const { Types } = require('../../vs-core');

export const userIsGranted = function ({
  userAppRols,
  userEnterpriseRols,
  targetAppRols,
  targetEnterpriseRols,
  companyId,
}) {
  if (
    userAppRols &&
    targetAppRols &&
    userAppRols.find((element) => {
      return targetAppRols.includes(element);
    })
  ) {
    return true;
  }

  if (targetEnterpriseRols) {
    const userEnterpriseRol = userEnterpriseRols.find((rol) => {
      return rol.companyId === companyId;
    });

    if (userEnterpriseRol) {
      const rol = userEnterpriseRol.rols.find((element) => {
        return targetEnterpriseRols.includes(element);
      });

      if (rol) return true;
    }
  }

  return false;
};

export const isAuthorized = function ({
  allowSameUser,
  hasAppRole,
  hasEnterpriseRole,
  isEnterpriseEmployee,
  allowStaffRelationship,
}) {
  return async (req, res, next) => {
    const SYS_ADMIN_EMAIL = process.env.SYS_ADMIN_EMAIL;

    const { enterpriseRols, appRols, email, userId } = res.locals;
    const { companyId, userId: paramUserId } = req.params;

    if (email === SYS_ADMIN_EMAIL) return next();

    // console.log('userId: ', userId, 'paramUserId: ', paramUserId);
    if (allowSameUser && paramUserId && userId === paramUserId) return next();

    if (
      isEnterpriseEmployee &&
      companyId &&
      enterpriseRols &&
      enterpriseRols.find((erol) => {
        return erol.companyId === companyId;
      })
    ) {
      return next();
    }

    if (
      userIsGranted({
        userAppRols: appRols,
        userEnterpriseRols: enterpriseRols,
        targetAppRols: hasAppRole,
        targetEnterpriseRols: hasEnterpriseRole,
        companyId,
      })
    ) {
      return next();
    }

    if (
      allowStaffRelationship &&
      paramUserId &&
      appRols &&
      appRols.includes(Types.AppRols.APP_STAFF)
    ) {
      const db = admin.firestore();
      const querySnapshot = await db
        .collection(Types.StaffUsersRelationshipTypes.COLLECTION_NAME)
        .where(Types.StaffUsersRelationshipTypes.STAFF_ID_PROP_NAME, '==', userId)
        .where(Types.StaffUsersRelationshipTypes.USER_ID_PROP_NAME, '==', paramUserId)
        .get();

      if (querySnapshot.docs && querySnapshot.docs.length && querySnapshot.docs[0].exists) {
        const doc = querySnapshot.docs[0];

        console.log('staff relationship founded');
        // console.log('allowStaffRelationship: ', JSON.stringify(doc));
        return next();
        // eslint-disable-next-line no-else-return
      } else {
        console.log('staff relationship NOT founded');
        // console.log('allowStaffRelationship: ', JSON.stringify({ userId, paramUserId }));
      }
    }

    // eslint-disable-next-line no-console
    console.error(
      'ERROR: role required',
      'role :',
      enterpriseRols,
      'appRols: ',
      appRols,
      'hasAppRole: ',
      hasAppRole
    );

    return res.status(403).send({ message: 'role required' });
  };
};
