const { find, findByUser, get, create, patch, remove, upsert } = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

exports.userTasksRoutesConfig = function (app) {
  // busca una relacion
  app.get('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER] }),
    get,
  ]);

  // busca todas las relaciones
  app.get('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER] }),
    find,
  ]);

  // busca las relaciones asociadas a un usuario
  app.get('/by-user/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      allowSameUser: true,
      allowStaffRelationship: true,
    }),
    findByUser,
  ]);

  // agrega relacion tasks-usuario, solo admins o staff granteado
  app.post('/upsert/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN], allowStaffRelationship: true }),
    upsert,
  ]);

  app.post('/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN], allowStaffRelationship: true }),
    create,
  ]);

  app.patch('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN], allowStaffRelationship: true }),
    patch,
  ]);

  app.delete('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN], allowStaffRelationship: true }),
    remove,
  ]);
};
