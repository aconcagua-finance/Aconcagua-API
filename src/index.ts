/* eslint-disable no-console */
// import { Config } from '@abdalamichel/vs-core';

import * as functions from 'firebase-functions';
import * as express from 'express';
import * as httpContext from 'express-http-context';
import * as cors from 'cors';

import * as admin from 'firebase-admin';
import { FirebaseConfig } from './config/firebaseConfig';

const { usersRoutesConfig } = require('./endpoints/users/routes-config');
const { adminRoutesConfig } = require('./endpoints/admin/routes-config');

const { leadsRoutesConfig } = require('./endpoints/leads/routes-config');
const { productsRoutesConfig } = require('./endpoints/products/routes-config');
const { packagesRoutesConfig } = require('./endpoints/packages/routes-config');
const { staffRoutesConfig } = require('./endpoints/staff/routes-config');
const { aspectsRoutesConfig } = require('./endpoints/aspects/routes-config');
const { levelsRoutesConfig } = require('./endpoints/levels/routes-config');
const { tasksRoutesConfig } = require('./endpoints/tasks/routes-config');
const { userTasksRoutesConfig } = require('./endpoints/userTasks/routes-config');
const { attachmentsRoutesConfig } = require('./endpoints/attachments/routes-config');
const { usersByStaffRoutesConfig } = require('./endpoints/usersByStaff/routes-config');
// const { usersByCompanyRoutesConfig } = require('./endpoints/usersByCompany/routes-config');
const { progressOptionsRoutesConfig } = require('./endpoints/progressOptions/routes-config');
const { userTouchpointsRoutesConfig } = require('./endpoints/userTouchpoints/routes-config');
const { hookedEventsRoutesConfig } = require('./endpoints/hookedEvents/routes-config');
const { insightsRoutesConfig } = require('./endpoints/insights/routes-config');
const {
  userDynamicAttributesRoutesConfig,
} = require('./endpoints/userDynamicAttributes/routes-config');
const {
  userAttributesTypesRoutesConfig,
} = require('./endpoints/userAttributesTypes/routes-config');
const { userProductsRoutesConfig } = require('./endpoints/userProducts/routes-config');
const {
  userWellBeingAttributesRoutesConfig,
} = require('./endpoints/userWellBeingAttributes/routes-config');

const { googleOAuthRoutesConfig } = require('./endpoints/googleOAuth/routes-config');
const { userCalendarsRoutesConfig } = require('./endpoints/userCalendars/routes-config');
const { userCalendarEventsRoutesConfig } = require('./endpoints/userCalendarEvents/routes-config');
const { companiesRoutesConfig } = require('./endpoints/companies/routes-config');
const { companyEmployeesRoutesConfig } = require('./endpoints/companyEmployees/routes-config');
const { companyClientsRoutesConfig } = require('./endpoints/companyClients/routes-config');

const { companyProfilesRoutesConfig } = require('./endpoints/companyProfiles/routes-config');
const { companyDepartmentsRoutesConfig } = require('./endpoints/companyDepartments/routes-config');
const { companySurveysRoutesConfig } = require('./endpoints/companySurveys/routes-config');
const {
  companySurveyQuestionsRoutesConfig,
} = require('./endpoints/companySurveyQuestions/routes-config');

const {
  onUserTouchpointCreate,
  onUserTouchpointUpdate,
} = require('./endpoints/userTouchpoints/controller');

const { onUserTaskCreate, onUserTaskUpdate } = require('./endpoints/userTasks/controller');

const { onUserCalendarEventBronzeCreate } = require('./endpoints/userCalendarEvents/controller');

const { onHookedEventCreate, onHookedEventUpdate } = require('./endpoints/hookedEvents/controller');

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

const packagesApp = express();
configureApp(packagesApp);
packagesRoutesConfig(packagesApp);
exports.packages = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(packagesApp);

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

const aspectsApp = express();
configureApp(aspectsApp);
aspectsRoutesConfig(aspectsApp);
exports.aspects = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(aspectsApp);

const levelsApp = express();
configureApp(levelsApp);
levelsRoutesConfig(levelsApp);
exports.levels = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(levelsApp);

const tasksApp = express();
configureApp(tasksApp);
tasksRoutesConfig(tasksApp);
exports.tasks = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(tasksApp);

const userTasksApp = express();
configureApp(userTasksApp);
userTasksRoutesConfig(userTasksApp);
exports.userTasks = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(userTasksApp);

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

// const usersByCompanyApp = express();
// configureApp(usersByCompanyApp);
// usersByCompanyRoutesConfig(usersByCompanyApp);
// exports.usersByCompany = functions
//   .runWith({
//     // memory: "2GB",
//     // Keep 5 instances warm for this latency-critical function
//     // in production only. Default to 0 for test projects.
//     // minInstances: envProjectId === "my-production-project" ? 5 : 0,
//   })
//   .https.onRequest(usersByCompanyApp);

const progressOptionsApp = express();
configureApp(progressOptionsApp);
progressOptionsRoutesConfig(progressOptionsApp);
exports.progressOptions = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(progressOptionsApp);

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

const userDynamicAttributesApp = express();
configureApp(userDynamicAttributesApp);
userDynamicAttributesRoutesConfig(userDynamicAttributesApp);
exports.userDynamicAttributes = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(userDynamicAttributesApp);

const userAttributesTypesApp = express();
configureApp(userAttributesTypesApp);
userAttributesTypesRoutesConfig(userAttributesTypesApp);
exports.userAttributesTypes = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(userAttributesTypesApp);

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

const userWellBeingAttributesApp = express();
configureApp(userWellBeingAttributesApp);
userWellBeingAttributesRoutesConfig(userWellBeingAttributesApp);
exports.userWellBeingAttributes = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(userWellBeingAttributesApp);

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

const companySurveysApp = express();
configureApp(companySurveysApp);
companySurveysRoutesConfig(companySurveysApp);
exports.companySurveys = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(companySurveysApp);

const companySurveyQuestionsApp = express();
configureApp(companySurveyQuestionsApp);
companySurveyQuestionsRoutesConfig(companySurveyQuestionsApp);
exports.companySurveyQuestions = functions
  .runWith({
    // memory: "2GB",
    // Keep 5 instances warm for this latency-critical function
    // in production only. Default to 0 for test projects.
    // minInstances: envProjectId === "my-production-project" ? 5 : 0,
  })
  .https.onRequest(companySurveyQuestionsApp);

exports.onUserTouchpointCreate = onUserTouchpointCreate;
exports.onUserTouchpointUpdate = onUserTouchpointUpdate;

exports.onUserTaskCreate = onUserTaskCreate;
exports.onUserTaskUpdate = onUserTaskUpdate;

exports.onHookedEventCreate = onHookedEventCreate;
exports.onHookedEventUpdate = onHookedEventUpdate;

exports.onUserCalendarEventBronzeCreate = onUserCalendarEventBronzeCreate;
