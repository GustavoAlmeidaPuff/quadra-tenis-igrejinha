import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function getServiceAccount(): Record<string, unknown> | null {
  // Preferir JSON em variável de ambiente (obrigatório na Vercel - arquivos locais não existem)
  const keyJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (keyJson) {
    try {
      return JSON.parse(keyJson) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  // PATH só funciona em ambiente local (na Vercel não use - defina FIREBASE_SERVICE_ACCOUNT_KEY)
  const isVercel = process.env.VERCEL === '1';
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (keyPath && !isVercel) {
    try {
      const absolutePath = resolve(process.cwd(), keyPath);
      const content = readFileSync(absolutePath, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch (e) {
      console.error('Firebase Admin: erro ao ler chave em FIREBASE_SERVICE_ACCOUNT_PATH:', e);
      return null;
    }
  }
  if (isVercel && keyPath) {
    console.warn(
      'Firebase Admin: FIREBASE_SERVICE_ACCOUNT_PATH não funciona na Vercel. Use FIREBASE_SERVICE_ACCOUNT_KEY ou FIREBASE_SERVICE_ACCOUNT_JSON com o JSON da chave.'
    );
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
      'Firebase Admin: defina FIREBASE_SERVICE_ACCOUNT_KEY (ou FIREBASE_SERVICE_ACCOUNT_JSON) com o JSON da chave, ou FIREBASE_SERVICE_ACCOUNT_PATH (caminho para o .json, só local). Sem isso, a API de reservas não funciona.'
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
