const {
  find,
  get,
  create,
  patch,
  remove,

  findByStaff,
  findByUser,
} = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

exports.usersByStaffRoutesConfig = function (app) {
  // busca las relaciones asociadas a un staff
  app.get('/by-staff/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      allowSameUser: true,
    }),
    findByStaff,
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

  app.get('/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      allowStaffRelationship: true,
    }),
    get,
  ]);

  // busca una relacion
  app.get('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    get,
  ]);

  // busca todas las relaciones
  app.get('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER] }),
    find,
  ]);

  // Por ahora hacen lo mismo (create)
  app.post('/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    create,
  ]);

  // Por ahora hacen lo mismo (create)
  app.post('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    create,
  ]);

  // Por ahora hacen lo mismo (patch)
  app.patch('/:userid/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    patch,
  ]);

  // Por ahora hacen lo mismo (patch)
  app.patch('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    patch,
  ]);

  // Por ahora hacen lo mismo (remove)
  app.delete('/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    remove,
  ]);

  // Por ahora hacen lo mismo (remove)
  app.delete('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    remove,
  ]);
};
