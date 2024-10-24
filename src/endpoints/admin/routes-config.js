const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');

const {
  showEnv,
  setUserClaimsByReq,
  setUserProps,
  setUserPassword,
  switchMagic,
  createSysAdmin,
} = require('./controller');

const { Types } = require('../../vs-core');

const { ENVIRONMENT } = require('../../config/appConfig');

// APP_ADMIN, APP_VIEWER, APP_APROVER
// ENTERPRISE_ADMIN,
//   ENTERPRISE_SALES,
//   ENTERPRISE_MKT,
//   ENTERPRISE_AUDIT,
//   ENTERPRISE_OPERATOR,

exports.adminRoutesConfig = function (app) {
  app.get('/env', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    showEnv,
  ]);

  app.get('/magic', [Audit.logger, switchMagic]);

  if (ENVIRONMENT === 'local') {
    app.post('/set-user-claims', [Audit.logger, setUserClaimsByReq]);
  } else {
    app.post('/set-user-claims', [
      Audit.logger,
      // Auth.isAuthenticated,
      // Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
      setUserClaimsByReq,
    ]);
  }

  app.post('/set-user-props', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    setUserProps,
  ]);

  app.post('/set-user-pw', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    setUserPassword,
  ]);

  // Función para crear el primer admin
  app.get('/create-sys-admin', [Audit.logger, createSysAdmin]);
};
