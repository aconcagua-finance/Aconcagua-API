const {
  find,
  get,
  getCurrentRelationship,
  create,
  patch,
  remove,

  findByCompany,
  findByUser,

  upsertByCompany,
  updateByCompany,
} = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

// const { enumValuesToArray } = require('../../helpers/coreHelper');

exports.companyClientsRoutesConfig = function (app) {
  // busca las relaciones asociadas a una empresa
  app.get('/by-company/:companyId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      isEnterpriseEmployee: true,
    }),
    findByCompany,
  ]);

  // busca las relaciones asociadas a un usuario
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

  // busca una relacion
  app.get('/:companyId/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      // hasEnterpriseRole: enumValuesToArray(Types.EnterpriseRols),
      isEnterpriseEmployee: true,
    }),
    get,
  ]);

  // busca una relacion
  app.get('/:companyId/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      // hasEnterpriseRole: enumValuesToArray(Types.EnterpriseRols),
      isEnterpriseEmployee: true,
    }),
    getCurrentRelationship,
  ]);

  // cuando el lender quiere crear un cliente (o asociarlo)
  app.post('/upsert-by-company/:companyId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      isEnterpriseEmployee: true,
    }),
    upsertByCompany,
  ]);

  // crea un elemento relacionado a la empresa enviada y al usuario enviado
  app.post('/:companyId/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      hasEnterpriseRole: [
        Types.EnterpriseRols.ENTERPRISE_ADMIN,
        Types.EnterpriseRols.ENTERPRISE_RRHH,
      ],
    }),
    create,
  ]);

  // cuando el lender quiere actualizar los datos de un cliente
  app.patch('/update-by-company/:companyId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      isEnterpriseEmployee: true,
    }),
    updateByCompany,
  ]);

  // actualiza un elemento relacionado a la empresa enviada y al usuario enviado
  app.patch('/:companyId/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      hasEnterpriseRole: [
        Types.EnterpriseRols.ENTERPRISE_ADMIN,
        Types.EnterpriseRols.ENTERPRISE_RRHH,
      ],
    }),
    patch,
  ]);

  // elimina un elemento relacionado a la empresa enviada
  app.delete('/:companyId/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      hasEnterpriseRole: [
        Types.EnterpriseRols.ENTERPRISE_ADMIN,
        Types.EnterpriseRols.ENTERPRISE_RRHH,
      ],
    }),
    remove,
  ]);
};
