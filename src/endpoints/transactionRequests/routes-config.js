const {
  get,
  create,
  patch,
  remove,

  find,
  findByCompany,
  findByVault,
} = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

// const { enumValuesToArray } = require('../../helpers/coreHelper');

exports.transactionRequestsRoutesConfig = function (app) {
  app.get('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
    }),
    find,
  ]);

  // busca las relaciones asociadas a una empresa
  app.get('/by-company/:companyId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true,
    }),
    findByCompany,
  ]);

  app.get('/by-vault/:companyId/:userId/:vaultId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true,
      allowSameUser: true,
    }),
    findByVault,
  ]);

  // busca una relacion
  app.get('/:companyId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      // hasEnterpriseRole: enumValuesToArray(Types.EnterpriseRols),
      isEnterpriseEmployee: true,
    }),
    get,
  ]);

  // crea un elemento relacionado a la empresa enviada y al usuario enviado y al vault enviado
  app.post('/:companyId/:userId/:vaultId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      allowSameUser: true, // quien solicita un rescate
      isEnterpriseEmployee: true, // quien solicita una liquidacion
    }),
    create,
  ]);

  // actualiza un elemento relacionado a la empresa enviada
  app.patch('/:companyId/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN], // solo el admin puede actualizar
    }),
    patch,
  ]);

  // elimina un elemento relacionado a la empresa enviada
  app.delete('/:companyId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
    }),
    remove,
  ]);
};
