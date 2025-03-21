const {
  find,
  get,
  create,
  patch,
  remove,
  findByUser,
  isCalendarIntegrationAuthorized,
  initCalendarWatch,
  stopCalendarWatch,
  freeBusy,
  freeBusyCalendarAssistant,
} = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

exports.userCalendarsRoutesConfig = function (app) {
  app.get('/freeBusy/calendarAssistant', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_STAFF],
    }),
    freeBusyCalendarAssistant,
  ]);

  app.get('/freeBusy/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_STAFF],
      allowSameUser: true,
    }),
    freeBusy,
  ]);

  app.get('/is-calendar-integration-authorized/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_STAFF],
      allowSameUser: true,
    }),
    isCalendarIntegrationAuthorized,
  ]);

  app.post('/init-calendar-watch/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      allowSameUser: true,
    }),
    initCalendarWatch,
  ]);

  app.post('/stop-calendar-watch/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      allowSameUser: true,
    }),
    stopCalendarWatch,
  ]);

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
