const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const {
  createDelegateFromUser,
  createDelegateRelationship,
  removeDelegate,
  listDelegates,
  find,
  findDelegatesByCompany,
  findDelegatesByUser,
  findByDelegateId,
  getDelegateById,
} = require('./controller');
const { findTransactionRequestsByDelegateId } = require('../transactionRequests/controller');

exports.delegatesRoutesConfig = function (app) {
  // List delegates by company
  app.get('/by-company/:companyId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      isEnterpriseEmployee: true,
    }),
    findDelegatesByCompany,
  ]);

  // List vaults where user is a delegate
  app.get('/by-delegate/:delegateId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      allowDelegateAccess: true,
    }),
    findByDelegateId,
  ]);

  // List transaction requests for vaults where user is a delegate
  app.get('/delegated-transactions/:delegateId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      allowDelegateAccess: true,
    }),
    findTransactionRequestsByDelegateId,
  ]);

  // List delegates for a specific user and delegate
  app.get('/:companyId/:userId/:delegateId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true,
      allowSameUser: true,
    }),
    listDelegates,
  ]);

  // List delegates by user in company
  app.get('/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true,
      allowSameUser: true,
      allowDelegateAccess: true,
    }),
    findDelegatesByUser,
  ]);

  // Get delegate by ID
  app.get('/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      allowDelegateAccess: true,
    }),
    getDelegateById,
  ]);

  // busca los documentos por filtros
  app.get('/', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({ hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER] }),
    find,
  ]);

  // Create delegate from user information
  app.post('/:companyId/:userId/:vaultId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      isEnterpriseEmployee: true,
      allowSameUser: true,
    }),
    createDelegateFromUser,
  ]);

  // Create delegate from user information
  app.post('/:companyId/:userId/:vaultId/create-delegate-relationship', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
    }),
    createDelegateRelationship,
  ]);

  // Remove delegate access
  app.delete('/:companyId/:userId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      isEnterpriseEmployee: true,
      allowSameUser: true,
    }),
    removeDelegate,
  ]);
};
