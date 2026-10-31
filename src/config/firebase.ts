import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { FIREBASE_CLIENT_CONFIG } from './constants';

export const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CLIENT_CONFIG);

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
  });
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
