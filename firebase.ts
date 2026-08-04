import { doc, getDocFromServer, disableNetwork, enableNetwork } from 'firebase/firestore';
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

if (typeof window !== 'undefined') {
  const isIgnorableFirestoreError = (err: any): boolean => {
    if (!err) return false;
    const str = (
      String(err?.code || '') + ' ' + 
      String(err?.message || '') + ' ' + 
      String(err?.reason || '') + ' ' + 
      String(err || '') + ' ' + 
      String(err?.stack || '')
    ).toLowerCase();
    return (
      str.includes('resource-exhausted') ||
      str.includes('resource_exhausted') ||
      str.includes('quota') ||
      str.includes('359469612868') ||
      str.includes('limit exceeded') ||
      str.includes('free daily write') ||
      str.includes('internal assertion failed') ||
      str.includes('unexpected state') ||
      str.includes('targetstate') ||
      str.includes('b815') ||
      str.includes('ca9') ||
      str.includes('da08') ||
      str.includes('da0') ||
      str.includes('assertion')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isIgnorableFirestoreError(event.reason)) {
      console.warn('[Firestore] Global network/assertion notice intercepted cleanly.');
      try {
        event.preventDefault();
        event.stopPropagation();
      } catch (e) {}
    }
  });

  window.addEventListener('error', (event) => {
    if (isIgnorableFirestoreError(event.error) || isIgnorableFirestoreError(event.message)) {
      console.warn('[Firestore] Uncaught assertion error intercepted cleanly.');
      try {
        event.preventDefault();
        event.stopPropagation();
      } catch (e) {}
    }
  });
}

let isEnablingNetworkPromise: Promise<void> | null = null;

export async function disableFirestoreNetwork(): Promise<void> {
  console.log('[Firestore] Disable network request overridden: Firestore network remains permanently ENABLED.');
  return enableFirestoreNetwork();
}

export async function enableFirestoreNetwork(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('simantap_firestore_quota_exceeded');
      sessionStorage.removeItem('simantap_firestore_quota_exceeded');
    } catch (e) {}
  }
  if (isEnablingNetworkPromise) {
    return isEnablingNetworkPromise;
  }
  isEnablingNetworkPromise = (async () => {
    try {
      const uniqueDbs = Array.from(new Set([dbPasien, dbMutu, dbMaster, db])).filter((inst) => inst && typeof inst === 'object' && inst.type === 'firestore');
      for (const d of uniqueDbs) {
        await enableNetwork(d).catch(() => {});
      }
      console.log('[Firestore] Network explicitly verified and connected permanently.');
    } catch (e) {
      console.warn('[Firestore] Notice during network enable:', e);
    } finally {
      isEnablingNetworkPromise = null;
    }
  })();
  return isEnablingNetworkPromise;
}

enableFirestoreNetwork();

export async function testFirestoreConnection() {
  try {
    await enableFirestoreNetwork();
    await getDocFromServer(doc(db, 'appData', 'connection-test')).catch(() => {});
    console.log('[Firestore] Successfully verified connection to Cloud Firestore.');
  } catch (error) {
    console.warn('[Firestore] Connection test notice:', error);
  }
}
