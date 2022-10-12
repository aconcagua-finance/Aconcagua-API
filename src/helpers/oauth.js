const UNKNOWN_USER_MESSAGE = 'Uninitialized email address';
const SCOPE_GOOGLE_CALENDAR = 'https://www.googleapis.com/auth/calendar';

const admin = require('firebase-admin');

const { google } = require('googleapis');

const {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URL,
} = require('../config/appConfig');

const { Collections } = require('../types/collectionsTypes');

const COLLECTION_NAME = Collections.OAUTH2_TOKENS;

exports.getOAuthCleanClient = () => {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URL
    // `${API_BASE_URL}/gmailPubSub/oauth2callback`
  );

  return oauth2Client;
};

/**
 * Helper function to fetch a user's OAuth 2.0 access token
 * Can fetch current tokens from Datastore, or create new ones
 */
exports.fetchTokenByEmail = async (emailAddress) => {
  const db = admin.firestore();
  const credentialsDoc = await db.collection(COLLECTION_NAME).doc(emailAddress).get();

  if (!credentialsDoc.exists) throw new Error(UNKNOWN_USER_MESSAGE);

  let storedCredentials = { ...credentialsDoc.data(), id: emailAddress };

  const oauth2Client = exports.getOAuthCleanClient();

  oauth2Client.credentials.refresh_token = storedCredentials.refresh_token;

  if (!storedCredentials.expiry_date || storedCredentials.expiry_date < Date.now() + 60000) {
    await oauth2Client.refreshAccessToken();
    console.log('AFTER REFRESHHH !!:', JSON.stringify(oauth2Client.credentials));

    exports.saveToken(emailAddress, oauth2Client.credentials);

    storedCredentials = oauth2Client.credentials;
  }

  // oauth2Client.credentials.refresh_token = storedCredentials.refresh_token;

  // oauth2Client.setCredentials(storedCredentials);

  console.log('Querying token by email address: ' + emailAddress);

  return { oauth2Client, storedCredentials };
};

/**
 * Helper function to save an OAuth 2.0 access token to Datastore
 */
exports.saveToken = async (emailAddress, newCredentials) => {
  const db = admin.firestore();
  const doc = await db
    .collection(COLLECTION_NAME)
    .doc(emailAddress)
    .set({ ...newCredentials });
};

exports.UNKNOWN_USER_MESSAGE = UNKNOWN_USER_MESSAGE;
exports.SCOPE_GOOGLE_CALENDAR = SCOPE_GOOGLE_CALENDAR;
