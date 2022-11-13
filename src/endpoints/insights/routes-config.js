const { findByCompany } = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

exports.insightsRoutesConfig = function (app) {
  app.get('/by-company/:companyId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_STAFF],
      isEnterpriseEmployee: true,
    }),
    findByCompany,
  ]);
};
