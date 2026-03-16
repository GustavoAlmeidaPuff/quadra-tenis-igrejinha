import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export const isFirebaseConfigured =
  Boolean(apiKey?.trim() && projectId?.trim());

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: apiKey!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: projectId!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : (getApps()[0] as FirebaseApp);
  _auth = getAuth(app);
  _db = getFirestore(app);
}

// Use apenas quando isFirebaseConfigured === true (layouts fazem essa checagem)
export const auth = _auth as Auth;
export const db = _db as Firestore;

// Analytics only on client side
export const getAnalyticsInstance = () => {
  if (typeof window !== 'undefined' && app) {
    return getAnalytics(app);
  }
  return null;
};

export default app;
