const { scrappDolarHoyDolarCripto } = require('./controller');

const { Audit } = require('../../vs-core-firebase');
const { Auth } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');

exports.scrapperRoutesConfig = function (app) {
  app.get('/dolar-cripto', [
    Audit.logger,
    // Auth.isAuthenticated,
    // Auth.isAuthorized({
    //   hasAppRole: [Types.AppRols.APP_ADMIN, Types.AppRols.APP_STAFF],
    // }),
    scrappDolarHoyDolarCripto,
  ]);
};
