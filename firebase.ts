import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfigJson from './firebase-applet-config.json';

// Explicit Auto-embedded Firebase configuration (Single Source of Truth for Vercel, Cloud Run, Mobile & Web)
export const firebaseConfig = {
  projectId: "gen-lang-client-0234581338",
  appId: "1:359469612868:web:0bc4678953dc87e42da111",
  apiKey: "AIzaSyC-IQHifzM2wjL6wjM1v-uN52-M6yws-Oo",
  authDomain: "gen-lang-client-0234581338.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-simantapbedah-c6a38a36-4082-4d85-9040-78110b8f6ff4",
  storageBucket: "gen-lang-client-0234581338.firebasestorage.app",
  messagingSenderId: "359469612868",
  measurementId: firebaseConfigJson?.measurementId || "",
  oAuthClientId: firebaseConfigJson?.oAuthClientId || "359469612868-5j1nvgfd6um2vjaqa81pvcnpblvgipbu.apps.googleusercontent.com",
  recaptchaSiteKey: firebaseConfigJson?.recaptchaSiteKey || ""
};

const app = initializeApp(firebaseConfig);
const dbId = firebaseConfig.firestoreDatabaseId;
export const db = getFirestore(app, dbId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'appData', 'connection-test'));
    console.log('[Firestore] Successfully verified connection to Cloud Firestore.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.log('[Firestore] Network offline or initializing Firestore connection.');
    } else {
      console.warn('[Firestore] Connection test notice:', error);
    }
  }
}
