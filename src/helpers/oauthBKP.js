/**
 * Copyright 2018, Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const UNKNOWN_USER_MESSAGE = 'Uninitialized email address';
const SCOPE_GOOGLE_CALENDAR = 'https://www.googleapis.com/auth/calendar';

const { Datastore } = require('@google-cloud/datastore');

const datastore = new Datastore();

const { google } = require('googleapis');

const gmail = google.gmail('v1');

const {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URL,
} = require('../config/appConfig');

const { Collections } = require('../types/collectionsTypes');

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URL
  // `${API_BASE_URL}/gmailPubSub/oauth2callback`
);

exports.client = oauth2Client;

/**
 * Helper function to get the current user's email address
 */
exports.getEmailAddress = (t) => {
  return new Promise((resolve, reject) => {
    gmail.users
      .getProfile({
        auth: oauth2Client,
        userId: 'me',
      })
      .then((x) => {
        // eslint-disable-next-line no-console
        console.log('XXXXXX es: ', JSON.stringify(x));
        resolve(x.data.emailAddress);
        return x.data.emailAddress;
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.log('XXXXXX NOOOOO es: ', e.message, e);
      });
  });
};

/**
 * Helper function to fetch a user's OAuth 2.0 access token
 * Can fetch current tokens from Datastore, or create new ones
 */
exports.fetchTokenByEmail = (emailAddress) => {
  return datastore.get(datastore.key([Collections.OAUTH2_TOKENS, emailAddress])).then((tokens) => {
    const token = tokens[0];

    // Check for new users
    if (!token) throw new Error(UNKNOWN_USER_MESSAGE);

    // Validate token
    if (!token.expiry_date || token.expiry_date < Date.now() + 60000) {
      oauth2Client.credentials.refresh_token =
        oauth2Client.credentials.refresh_token || token.refresh_token;

      return new Promise((resolve, reject) => {
        oauth2Client.refreshAccessToken((err) => {
          if (err) return reject(err);

          return resolve(oauth2Client.credentials);
        });
      })
        .then(() => {
          return exports.saveToken(emailAddress);
        })
        .then(() => {
          return Promise.resolve(oauth2Client.credentials);
        });
    }

    oauth2Client.credentials = token;

    return Promise.resolve(oauth2Client.credentials);
  });
};

/**
 * Helper function to save an OAuth 2.0 access token to Datastore
 */
exports.saveToken = (emailAddress) => {
  return datastore.save({
    key: datastore.key([Collections.OAUTH2_TOKENS, emailAddress]),
    data: oauth2Client.credentials,
  });
};

exports.UNKNOWN_USER_MESSAGE = UNKNOWN_USER_MESSAGE;
exports.SCOPE_GOOGLE_CALENDAR = SCOPE_GOOGLE_CALENDAR;
