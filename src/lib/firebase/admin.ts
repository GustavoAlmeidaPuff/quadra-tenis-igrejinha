import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK (for API routes)
let adminApp;

if (getApps().length === 0) {
  // If service account key is provided via env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // Fallback: use Application Default Credentials
    adminApp = initializeApp();
  }
} else {
  adminApp = getApps()[0];
}

export const adminDb = getFirestore(adminApp);
export default adminApp;
