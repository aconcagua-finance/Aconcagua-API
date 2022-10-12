import { get, create, patch, remove, findByCompany, findByUserPendingSurveys } from './controller';

import { Audit } from '../../vs-core-firebase';
import { Auth } from '../../vs-core-firebase';
import { Types } from '../../vs-core';

// const { enumValuesToArray } = require('../../helpers/coreHelper');

export function companySurveysRoutesConfig(app) {
  // TODO MICHEL
  // busca las surveys pendientes de realizar que esten asociadas al usuario
  app.post('/:companyId/:surveyId/typeform-survey-submitted/:typeformId/:typeformResponseId', [
    Audit.logger,
    // Auth.isAuthenticated,
    // Auth.isAuthorized({
    //   hasAppRole: [Types.AppRols.APP_ADMIN],
    //   isEnterpriseEmployee: true,
    // }),
  ]);

  // busca las surveys pendientes de realizar que esten asociadas al usuario
  app.get('/user-pending-surveys/:userId', [
    Audit.logger,
    Auth.isAuthenticated,

    findByUserPendingSurveys,
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
}
