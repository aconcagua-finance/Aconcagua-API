const { find, get, create, patch, remove, findByUser } = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

exports.userProductsRoutesConfig = function (app) {
  // busca los documentos asociados a un usuario
  app.get('/by-user/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      allowSameUser: true,
      allowStaffRelationship: true,
    }),
    findByUser,
  ]);

  // busca un documento por ID, el userId es para validacion de permisos del staff
  app.get('/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      allowStaffRelationship: true,
    }),
    get,
  ]);

  // busca los documentos por filtros
  app.get('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    find,
  ]);

  // crea un documento,  el userId es para validacion de permisos del staff
  app.post('/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      allowStaffRelationship: true,
    }),
    create,
  ]);

  // update un documento,  el userId es para validacion de permisos del staff
  app.patch('/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN], allowStaffRelationship: true }),
    patch,
  ]);

  // borra un documento,  el userId es para validacion de permisos del staff
  app.delete('/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN], allowStaffRelationship: true }),
    remove,
  ]);
};
