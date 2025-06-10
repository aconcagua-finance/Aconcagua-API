const {
  get,
  patch,
  remove,

  createBorrowerTransactionRequest,
  createTransactionRequest,
  lenderApproveTransactionRequest,
  borrowerApproveTransactionRequest,
  delegateApproveTransactionRequest,
  find,
  findByCompany,
  findByVault,
  trustApproveTransactionRequest,
  findTransactionRequestsByDelegateId,
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
      hasAppRole: [Types.AppRols.APP_ADMIN],
    }),
    find,
  ]);

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

  app.get('/by-vault/:companyId/:userId/:vaultId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      isEnterpriseEmployee: true,
      allowSameUser: true,
    }),
    findByVault,
  ]);

  // Get transaction requests for vaults where user is a delegate
  app.get('/by-delegate/:userId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_VIEWER],
      allowSameUser: true,
    }),
    findTransactionRequestsByDelegateId,
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

  // crea un elemento relacionado a la empresa, usuario y vault enviados de acción borrower.
  app.post('/borrower/:companyId/:userId/:id/:transactionId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      allowSameUser: true,
      allowDelegateAccess: true,
    }),
    createBorrowerTransactionRequest,
  ]);

  // crea un elemento relacionado a la empresa, usuario y vault enviados de acción borrower.
  app.post('/borrower-approve/:companyId/:userId/:id/:transactionId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      allowSameUser: true,
      allowDelegateAccess: true,
    }),
    borrowerApproveTransactionRequest,
  ]);

  // crea un elemento relacionado a la empresa, usuario y vault enviados de acción lender.
  app.post('/:companyId/:userId/:vaultId', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      isEnterpriseEmployee: true,
      allowSameUser: true,
    }),
    createTransactionRequest,
  ]);

  // crea un elemento relacionado a la empresa, usuario y vault enviados de acción lender.
  app.post('/lender-approve/:companyId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      isEnterpriseEmployee: true,
    }),
    lenderApproveTransactionRequest,
  ]);

  // crea un elemento relacionado a la empresa, usuario y vault enviados de acción lender.
  app.post('/trust-approve/:companyId/:id', [
    Audit.logger,
    Auth.isAuthenticated,
    Auth.isAuthorized({
      hasAppRole: [Types.AppRols.APP_ADMIN],
      isEnterpriseEmployee: true,
    }),
    trustApproveTransactionRequest,
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
