const { find, get, create, patch, remove, oauth2init, oauth2callback } = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

exports.googleOAuthRoutesConfig = function (app) {
  app.get('/oauth2init', [
    Audit.logger,
    // Auth.isAuthenticated,
    // Auth.isAuthorized({
    //   hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER, Types.AppRols.APP_STAFF],
    // }),
    oauth2init,
  ]);
  app.get('/oauth2callback', [
    Audit.logger,
    // Auth.isAuthenticated,
    // Auth.isAuthorized({
    //   hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER, Types.AppRols.APP_STAFF],
    // }),
    oauth2callback,
  ]);

  app.get('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER, Types.AppRols.APP_STAFF],
    }),
    get,
  ]);

  app.get('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER, Types.AppRols.APP_STAFF],
    }),
    find,
  ]);

  app.post('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER] }),
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
