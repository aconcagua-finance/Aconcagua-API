const {
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

exports.companySurveyQuestionsRoutesConfig = function (app) {
  // busca las relaciones asociadas a una empresa
  app.get('/by-company/:companyId/:surveyId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true,
    }),
    findByCompany,
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

  // crea un elemento relacionado a la empresa enviada
  app.post('/:companyId/:surveyId', [
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

  // TODO MICHEL - LOS PATCHS NINGUNO VALIDA QUE EL ID ESTE VINCULADO A LA EMPRESA
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

  // TODO MICHEL - LOS DELETE NINGUNO VALIDA QUE EL ID ESTE VINCULADO A LA EMPRESA
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
