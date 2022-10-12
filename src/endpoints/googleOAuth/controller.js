/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');

const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');

const { CustomError } = require('../../vs-core');

const { Collections } = require('../../types/collectionsTypes');

const schemas = require('./schemas');

const {
  find,
  get,
  patch,
  remove,
  create,
  fetchSingleItem,
  updateSingleItem,
  getFirebaseUserByEmail,
  createFirestoreDocument,
} = require('../baseEndpoint');

const { GOOGLE_CALENDAR_EVENT_WEBHOOK_URL } = require('../../config/appConfig');

const oauthHelper = require('../../helpers/oauth');

const COLLECTION_NAME = Collections.OAUTH2_TOKENS;
const CONTROLLER_NAME = 'googleOAuth';

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME);
};

exports.get = async function (req, res) {
  await get(req, res, COLLECTION_NAME);
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  await patch(req, res, auditUid, COLLECTION_NAME, schemas.update);
};

exports.remove = async function (req, res) {
  await remove(req, res, COLLECTION_NAME);
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  await create(req, res, auditUid, COLLECTION_NAME, schemas.create);
};

/**
 * Request an OAuth 2.0 authorization code
 * Only new users (or those who want to refresh
 * their auth data) need visit this page
 */
exports.oauth2init = (req, res) => {
  // Define OAuth2 scopes
  // const scopes = ['https://www.googleapis.com/auth/gmail.modify'];
  const scopes = [
    oauthHelper.SCOPE_GOOGLE_CALENDAR,
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile', // required for tokenInfo.user_id
  ];

  const oauthClient = oauthHelper.getOAuthCleanClient();

  // Generate + redirect to OAuth2 consent form URL
  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Required in order to receive a refresh token every time
  });

  console.log('oauth2init redirecting to ' + authUrl);
  return res.redirect(authUrl);
};

/**
 * Get an access token from the authorization code and store token in Datastore
 */
exports.oauth2callback = (req, res) => {
  // Get authorization code from request
  const code = req.query.code;

  const oauthClient = oauthHelper.getOAuthCleanClient();

  // OAuth2: Exchange authorization code for access token
  return new Promise((resolve, reject) => {
    oauthClient.getToken(code, (err, token) => (err ? reject(err) : resolve(token)));
  })
    .then((token) => {
      return Promise.all([token, oauthClient.getTokenInfo(token.access_token)]);
    })
    .then(([token, tokenInfo]) => {
      // console.log('TOKENNN ESSS', token, tokenInfo);

      console.log('TOKENNN EMAIL', tokenInfo.email);

      // Get user email (to use as a Datastore key)
      oauthClient.credentials = token;

      return Promise.all([token, tokenInfo.email]);
    })
    .then(([token, userEmail]) => {
      if (!userEmail) {
        throw new CustomError.TechnicalError('NO_EMAIL', null, 'emailAddress is undefined', null);
      }
      // Store token in Datastore
      return Promise.all([userEmail, oauthHelper.saveToken(userEmail, token)]);
    })
    .then(([userEmail]) => {
      // res.redirect(`initCalendarWatch?emailAddress=userEmail`);

      // Respond to request
      console.log('Success oauth2callback ' + userEmail);
      res.write('Success authorized, pleas close this window');
      return res.status(200).send();
    })
    .catch((err) => {
      // Handle error
      console.error(err);
      res.status(500).send('Something went wrong; check the logs. ' + err.message);
    });
};
