const {
  find,
  get,
  create,
  createByStaff,
  patch,
  normalizePermissions,
  remove,
  signUp,
} = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

exports.usersRoutesConfig = function (app) {
  app.post('/normalizePermissions', [
    Audit.logger,
    // Auth.isAuthenticated,
    // Auth.isAuthorized({
    //   hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
    //   allowStaffRelationship: true,
    //   allowSameUser: true,
    // }),
    normalizePermissions,
  ]);

  // devuelve un usuario
  app.get('/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      allowStaffRelationship: true,
      allowSameUser: true,
    }),
    get,
  ]);

  // devuelve todos los usuarios
  app.get('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER] }),
    find,
  ]);

  // Cualquier staff puede crear una relacion, dps en el controller se define si puede o no o que tipo de relacion
  app.post('/by-staff', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_STAFF] }),
    createByStaff,
  ]);

  app.post('/sign-up', [Audit.logger, signUp]);

  app.post('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    create,
  ]);

  // allowStaffRelationship se habilita pero en el controller se evalua el perfil y en base a eso se actualizan uno u otros datos
  app.patch('/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      allowStaffRelationship: true,
    }),
    patch,
  ]);

  // separo en este endpoint para discriminar cuales campos
  // app.patch('/by-Staff/:userId', [
  //   Audit.logger,
  //   Auth.isAuthenticated,
  //   Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN], allowStaffRelationship: true }),
  //   patchByStaff,
  // ]);

  // aca siempre va con ID
  app.delete('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN] }),
    remove,
  ]);
};
