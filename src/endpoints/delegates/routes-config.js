const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const {
  createDelegate,
  removeDelegate,
  listDelegates,
  find,
  findDelegatesByCompany,
  findDelegatesByUser,
  findByDelegateId
} = require('./controller');

exports.delegatesRoutesConfig = function (app) {
  // busca los documentos por filtros
  app.get('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER] }),
    find,
  ]);

  // List delegates by company
  app.get('/by-company/:companyId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true
    }),
    findDelegatesByCompany
  ]);

  // List delegates by user in company
  app.get('/:companyId/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true,
      allowSameUser: true
    }),
    findDelegatesByUser
  ]);

  // List delegates for a specific vault
  app.get('/:companyId/:userId/:vaultId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true,
      allowSameUser: true
    }),
    listDelegates
  ]);

  // List vaults where user is a delegate
  app.get('/by-delegate/:delegateId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      allowDelegateAccess: true
    }),
    findByDelegateId
  ]);

  // Create delegate access
  app.post('/:companyId/:userId/:vaultId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true,
      allowSameUser: true
    }),
    createDelegate
  ]);

  // Remove delegate access
  app.delete('/:companyId/:userId/:vaultId/:delegateId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true,
      allowSameUser: true
    }),
    removeDelegate
  ]);
};

