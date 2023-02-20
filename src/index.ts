/* eslint-disable camelcase */
/* eslint-disable no-console */
// import { Config } from '@abdalamichel/vs-core';

import * as functions from 'firebase-functions';
import * as express from 'express';
import * as httpContext from 'express-http-context';
import * as cors from 'cors';

import * as admin from 'firebase-admin';
import { FirebaseConfig } from './config/firebaseConfig';

const puppeteer = require('puppeteer');

const { scrapperRoutesConfig } = require('./endpoints/scrapper/routes-config');

const { usersRoutesConfig } = require('./endpoints/users/routes-config');
const { adminRoutesConfig } = require('./endpoints/admin/routes-config');

const { leadsRoutesConfig } = require('./endpoints/leads/routes-config');
const { productsRoutesConfig } = require('./endpoints/products/routes-config');

const { staffRoutesConfig } = require('./endpoints/staff/routes-config');
const { attachmentsRoutesConfig } = require('./endpoints/attachments/routes-config');
const { usersByStaffRoutesConfig } = require('./endpoints/usersByStaff/routes-config');
const { userTouchpointsRoutesConfig } = require('./endpoints/userTouchpoints/routes-config');
const { hookedEventsRoutesConfig } = require('./endpoints/hookedEvents/routes-config');
const { insightsRoutesConfig } = require('./endpoints/insights/routes-config');
const { userProductsRoutesConfig } = require('./endpoints/userProducts/routes-config');
const { marketCapRoutesConfig } = require('./endpoints/marketCap/routes-config');
const { emailTemplatesRoutesConfig } = require('./endpoints/emailTemplates/routes-config');

const { googleOAuthRoutesConfig } = require('./endpoints/googleOAuth/routes-config');
const { userCalendarsRoutesConfig } = require('./endpoints/userCalendars/routes-config');
const { userCalendarEventsRoutesConfig } = require('./endpoints/userCalendarEvents/routes-config');
const { companiesRoutesConfig } = require('./endpoints/companies/routes-config');
const { companyEmployeesRoutesConfig } = require('./endpoints/companyEmployees/routes-config');
const { companyClientsRoutesConfig } = require('./endpoints/companyClients/routes-config');

const { companyProfilesRoutesConfig } = require('./endpoints/companyProfiles/routes-config');
const { companyDepartmentsRoutesConfig } = require('./endpoints/companyDepartments/routes-config');

const { vaultInstallmentsRoutesConfig } = require('./endpoints/vaultInstallments/routes-config');
const { vaultTransactionsRoutesConfig } = require('./endpoints/vaultTransactions/routes-config');
const {
  transactionRequestsRoutesConfig,
} = require('./endpoints/transactionRequests/routes-config');

const { remindersRoutesConfig } = require('./endpoints/reminders/routes-config');

const { cronUpdateUSDValuation } = require('./endpoints/marketCap/controller');

const {
  onUserTouchpointCreate,
  onUserTouchpointUpdate,
} = require('./endpoints/userTouchpoints/controller');

const { onUserCalendarEventBronzeCreate } = require('./endpoints/userCalendarEvents/controller');

const { onHookedEventCreate, onHookedEventUpdate } = require('./endpoints/hookedEvents/controller');
const {
  onVaultCreate_ThenCreateCompanyClientRelationship,
} = require('./endpoints/companyClients/controller');

console.log('NODE_ENV:', process.env.NODE_ENV, 'ENVIRONMENT:', process.env.ENVIRONMENT);

admin.initializeApp(FirebaseConfig);

function addSpanId(req, res, next) {
  let spanId = req.headers.spanid;
  if (!spanId) spanId = Math.floor(Math.random() * 10000).toString();
  httpContext.set('span-id', spanId);
  next();
}

function onlyLocalLoadEnv(req, res, next) {
  // if (process.env.NODE_ENV !== 'production') {
  // Config.loadConfigSync();
  // }

  console.log(
    'NODE_ENV EN MIDDLEWARE (2):',
    process.env.NODE_ENV,
    'ENVIRONMENT EN MIDDLEWARE (2):',
    process.env.ENVIRONMENT
  );

  if (next) next();
}

function configureApp(app) {
  app.use(cors({ origin: true }));

  app.use(httpContext.middleware);

  // Se agrega el middleware en la aplicación.
  app.use(addSpanId);
  app.use(onlyLocalLoadEnv);
}

const createExpressWithPuppeteerApp = () => {
  const app = express();

  /**
   * This function not works on Spark Plan (firebase)
   */

  /**
   * Middleware: Get all routes and request to load browser
   */
  app.all('*', async (req, res, next) => {
    // note: --no-sandbox is required in this env.
    // Could also launch chrome and reuse the instance
    // using puppeteer.connect();

    res.locals.browser = await puppeteer.launch({
      args: ['--no-sandbox'],
    });
    next();
  });

  return app;
};

const scrapperApp = createExpressWithPuppeteerApp();

// const usersApp = express();
configureApp(scrapperApp);
scrapperRoutesConfig(scrapperApp);
exports.scrapper = functions
  .runWith({
    memory: '2GB',
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(scrapperApp);

const usersApp = express();
configureApp(usersApp);
usersRoutesConfig(usersApp);
exports.users = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(usersApp);

const adminApp = express();
configureApp(adminApp);
adminRoutesConfig(adminApp);
exports.admin = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(adminApp);

const leadsApp = express();
configureApp(leadsApp);
leadsRoutesConfig(leadsApp);
exports.leads = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(leadsApp);

const productsApp = express();
configureApp(productsApp);
productsRoutesConfig(productsApp);
exports.products = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(productsApp);

const staffApp = express();
configureApp(staffApp);
staffRoutesConfig(staffApp);
exports.staff = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(staffApp);

const attachmentsApp = express();
configureApp(attachmentsApp);
attachmentsRoutesConfig(attachmentsApp);
exports.attachments = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(attachmentsApp);

const usersByStaffApp = express();
configureApp(usersByStaffApp);
usersByStaffRoutesConfig(usersByStaffApp);
exports.usersByStaff = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(usersByStaffApp);

const userTouchpointsApp = express();
configureApp(userTouchpointsApp);
userTouchpointsRoutesConfig(userTouchpointsApp);
exports.userTouchpoints = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(userTouchpointsApp);

const hookedEventsApp = express();
configureApp(hookedEventsApp);
hookedEventsRoutesConfig(hookedEventsApp);
exports.hookedEvents = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(hookedEventsApp);

const insightsApp = express();
configureApp(insightsApp);
insightsRoutesConfig(insightsApp);
exports.insights = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(insightsApp);

const userProductsApp = express();
configureApp(userProductsApp);
userProductsRoutesConfig(userProductsApp);
exports.userProducts = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(userProductsApp);

const marketCapApp = express();
configureApp(marketCapApp);
marketCapRoutesConfig(marketCapApp);
exports.marketCap = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(marketCapApp);

  const emailTemplatesApp = express();
  configureApp(emailTemplatesApp);
  emailTemplatesRoutesConfig(emailTemplatesApp);
  exports.emailTemplates = functions
    .runWith({
      // memory: "2GB",
      // Keep 5 instances warm for this latency-critical function
      // in production only. Default to 0 for test projects.
      // minInstances: envProjectId === "my-production-project" ? 5 : 0,
    })
    .https.onRequest(emailTemplatesApp);

const googleOAuthApp = express();
configureApp(googleOAuthApp);
googleOAuthRoutesConfig(googleOAuthApp);
exports.googleOAuth = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(googleOAuthApp);

const userCalendarsApp = express();
configureApp(userCalendarsApp);
userCalendarsRoutesConfig(userCalendarsApp);
exports.userCalendars = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(userCalendarsApp);

const userCalendarEventsApp = express();
configureApp(userCalendarEventsApp);
userCalendarEventsRoutesConfig(userCalendarEventsApp);
exports.userCalendarEvents = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(userCalendarEventsApp);

const companiesApp = express();
configureApp(companiesApp);
companiesRoutesConfig(companiesApp);
exports.companies = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(companiesApp);

const companyEmployeesApp = express();
configureApp(companyEmployeesApp);
companyEmployeesRoutesConfig(companyEmployeesApp);
exports.companyEmployees = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(companyEmployeesApp);

const companyClientsApp = express();
configureApp(companyClientsApp);
companyClientsRoutesConfig(companyClientsApp);
exports.companyClients = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(companyClientsApp);

const companyProfilesApp = express();
configureApp(companyProfilesApp);
companyProfilesRoutesConfig(companyProfilesApp);
exports.companyProfiles = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(companyProfilesApp);

const companyDepartmentsApp = express();
configureApp(companyDepartmentsApp);
companyDepartmentsRoutesConfig(companyDepartmentsApp);
exports.companyDepartments = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(companyDepartmentsApp);

const vaultInstallmentsApp = express();
configureApp(vaultInstallmentsApp);
vaultInstallmentsRoutesConfig(vaultInstallmentsApp);
exports.vaultInstallments = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(vaultInstallmentsApp);

const vaultTransactionsApp = express();
configureApp(vaultTransactionsApp);
vaultTransactionsRoutesConfig(vaultTransactionsApp);
exports.vaultTransactions = functions
  .runWith({
    memory: '2GB',
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(vaultTransactionsApp);

const transactionRequestsApp = express();
configureApp(transactionRequestsApp);
transactionRequestsRoutesConfig(transactionRequestsApp);
exports.transactionRequests = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(transactionRequestsApp);

const remindersApp = express();
configureApp(remindersApp);
remindersRoutesConfig(remindersApp);
exports.reminders = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(remindersApp);

exports.onUserTouchpointCreate = onUserTouchpointCreate;
exports.onUserTouchpointUpdate = onUserTouchpointUpdate;

exports.onHookedEventCreate = onHookedEventCreate;
exports.onHookedEventUpdate = onHookedEventUpdate;

exports.onUserCalendarEventBronzeCreate = onUserCalendarEventBronzeCreate;

exports.onVaultCreate_ThenCreateCompanyClientRelationship =
  onVaultCreate_ThenCreateCompanyClientRelationship;

exports.cronUpdateUSDValuation = cronUpdateUSDValuation;
