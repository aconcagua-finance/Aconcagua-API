const {
  find,
  get,
  create,
  patch,
  remove,

  findByCompany,
} = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

// const { enumValuesToArray } = require('../../helpers/coreHelper');

exports.companyDepartmentsRoutesConfig = function (app) {
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

  // busca una relacion
  app.get('/:companyId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      // hasEnterpriseRole: enumValuesToArray(Types.EnterpriseRols),
      isEnterpriseEmployee: true,
    }),
    get,
  ]);

  // crea un elemento relacionado a la empresa enviada
  app.post('/:companyId', [
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

  // actualiza un elemento relacionado a la empresa enviada
  app.patch('/:companyId/:id', [
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
  app.delete('/:companyId/:id', [
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
