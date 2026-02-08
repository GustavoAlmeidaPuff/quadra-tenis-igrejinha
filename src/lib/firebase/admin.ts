import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function getServiceAccount(): Record<string, unknown> | null {
  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    try {
      return JSON.parse(keyJson) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (keyPath) {
    try {
      const absolutePath = resolve(process.cwd(), keyPath);
      const content = readFileSync(absolutePath, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch (e) {
      console.error('Firebase Admin: erro ao ler chave em FIREBASE_SERVICE_ACCOUNT_PATH:', e);
      return null;
    }
  }
  return null;
}

// Initialize Firebase Admin SDK (for API routes)
let adminApp;
const serviceAccount = getServiceAccount();

if (getApps().length === 0) {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (serviceAccount) {
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: (projectId as string) || (serviceAccount.project_id as string),
    });
  } else {
    console.warn(
      'Firebase Admin: defina FIREBASE_SERVICE_ACCOUNT_KEY (JSON em uma linha) ou FIREBASE_SERVICE_ACCOUNT_PATH (caminho para o arquivo .json) no .env.local. Sem isso, a API de reservas não funciona em ambiente local.'
    );
    if (!projectId) {
      console.warn(
        'Firebase Admin: defina também FIREBASE_PROJECT_ID ou NEXT_PUBLIC_FIREBASE_PROJECT_ID.'
      );
    }
    adminApp = initializeApp({ projectId: projectId || undefined });
  }
} else {
  adminApp = getApps()[0];
}

/** Indica se o Admin SDK foi inicializado com chave de serviço (necessário para Firestore). */
export const hasAdminCredentials = !!serviceAccount;

export const adminDb = getFirestore(adminApp);
export default adminApp;
