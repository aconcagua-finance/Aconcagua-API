const {
  find,
  get,
  create,
  patch,
  remove,
  fetchAndUpdateUSDValuation,
  fetchAndUpdateTokensValuations,
} = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

exports.marketCapRoutesConfig = function (app) {
  app.get('/valuation', [
    // Audit.logger,
    // Auth.isAuthenticated,
    // Auth.isAuthorized({
    //   hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_STAFF],
    // }),
    fetchAndUpdateUSDValuation,
  ]);

  app.get('/tokensValuations', [
    // Audit.logger,
    // Auth.isAuthenticated,
    // Auth.isAuthorized({
    //   hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_STAFF],
    // }),
    fetchAndUpdateTokensValuations,
  ]);

  app.get('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [
        Types.AppRols.APP_ADMIN,
        Types.AppRols.APP_VIEWER,
        Types.AppRols.APP_STAFF,
        Types.AppRols.APP_CLIENT,
      ],
    }),
    get,
  ]);

  app.get('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [
        Types.AppRols.APP_ADMIN,
        Types.AppRols.APP_VIEWER,
        Types.AppRols.APP_STAFF,
        Types.AppRols.APP_CLIENT,
      ],
    }),
    find,
  ]);

  // MRM Jun 2024 saco app_viewer
  app.post('/', [
    Audit.logger,
    Auth.isAuthenticated,
    // Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    create,
  ]);

  app.patch('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    patch,
  ]);

  app.delete('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    remove,
  ]);
};
