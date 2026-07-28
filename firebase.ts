import { doc, getDocFromServer } from 'firebase/firestore';
import { 
  dbPasien, 
  dbMutu, 
  dbMaster, 
  db, 
  auth, 
  firebaseConfig, 
  supabase, 
  CLOUDFLARE_D1_API, 
  POCKETBASE_URL, 
  APPS_SCRIPT_URL,
  uploadToPocketBase,
  syncToGoogleAppsScript,
  fetchFromCloudflareD1
} from './services/databaseConfig';

export const APP_VERSION = '2.0.0-HYBRID-CLEAN';

export { 
  dbPasien, 
  dbMutu, 
  dbMaster, 
  db, 
  auth, 
  firebaseConfig, 
  supabase, 
  CLOUDFLARE_D1_API, 
  POCKETBASE_URL, 
  APPS_SCRIPT_URL,
  uploadToPocketBase,
  syncToGoogleAppsScript,
  fetchFromCloudflareD1
};


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
    const isQuotaExceeded = typeof window !== 'undefined' && 
      (localStorage.getItem('simantap_firestore_quota_exceeded') || sessionStorage.getItem('simantap_firestore_quota_exceeded'));
    if (isQuotaExceeded) {
      console.log('[Firestore] Quota exceeded flag set. Operating in offline Local IndexedDB mode.');
      return;
    }
    await getDocFromServer(doc(db, 'appData', 'connection-test'));
    console.log('[Firestore] Successfully verified connection to Cloud Firestore.');
  } catch (error) {
    const msg = String(error || '').toLowerCase();
    if (msg.includes('offline') || msg.includes('quota') || msg.includes('resource-exhausted')) {
      console.log('[Firestore] Network offline or quota limit reached; operating in local mode.');
    } else {
      console.warn('[Firestore] Connection test notice:', error);
    }
  }
}
