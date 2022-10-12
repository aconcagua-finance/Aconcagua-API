import {
  FIREB_API_KEY,
  FIREB_AUTH_DOMAIN,
  FIREB_PROJECT_ID,
  FIREB_STORAGE_BUCKET,
  FIREB_MESSAGING_SENDER_ID,
  FIREB_APP_ID,
  FIREB_MEASURAMENT_ID,
} from './appConfig';

const config = {
  apiKey: FIREB_API_KEY,
  authDomain: FIREB_AUTH_DOMAIN,
  projectId: FIREB_PROJECT_ID,
  storageBucket: FIREB_STORAGE_BUCKET,
  messagingSenderId: FIREB_MESSAGING_SENDER_ID,
  appId: FIREB_APP_ID,
  measurementId: FIREB_MEASURAMENT_ID,
};

export const FirebaseConfig = config;
