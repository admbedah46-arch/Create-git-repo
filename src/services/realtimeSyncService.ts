import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, off } from 'firebase/database';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { DATABASE_CONFIG, dbPasien } from './databaseConfig';

// Inisialisasi Firebase App
const app = !getApps().length ? initializeApp(DATABASE_CONFIG.FIREBASE) : getApps()[0];

// Safe Realtime Database instance creation
let db: ReturnType<typeof getDatabase> | null = null;
try {
  const dbUrl = (DATABASE_CONFIG.FIREBASE as any).databaseURL || 
    `https://${DATABASE_CONFIG.FIREBASE.projectId}-default-rtdb.firebaseio.com`;
  db = getDatabase(app, dbUrl);
} catch (e) {
  try {
    db = getDatabase(app);
  } catch (err) {
    console.warn('[Realtime Sync] Realtime Database fallback notice:', err);
  }
}

// Map cache string payload per path to prevent infinite loop re-renders
const lastReceivedCache: Record<string, string> = {};

// Map to store active debounce timers per path node
const debounceTimers: Record<string, any> = {};

/**
 * Mendengarkan perubahan data secara Realtime antar Perangkat (Primary WebSocket + Hybrid Fallbacks)
 * @param path Node database (misal: 'sensus_bedah')
 * @param callback Function yang dipanggil saat data berubah
 * @returns Unsubscribe cleanup function
 */
export const subscribeToRealtimeData = (
  path: string, 
  callback: (data: any) => void
): (() => void) => {
  const cleanups: (() => void)[] = [];

  // 1. Primary Realtime WebSocket Listener (Firebase Realtime Database)
  if (db) {
    try {
      const dataRef = ref(db, path);
      onValue(dataRef, (snapshot) => {
        try {
          const data = snapshot.val();
          if (data !== null && data !== undefined) {
            const strPayload = JSON.stringify(data);
            if (lastReceivedCache[path] !== strPayload) {
              lastReceivedCache[path] = strPayload;
              callback(data);
            }
          }
        } catch (err) {
          console.error(`[Realtime Sync Callback Error] Path ${path}:`, err);
        }
      }, (error) => {
        console.error(`[Realtime Sync Error] Path ${path}:`, error);
      });

      cleanups.push(() => {
        try {
          off(dataRef);
        } catch (e) {
          console.warn(`[Realtime Sync Cleanup Warning] Path ${path}:`, e);
        }
      });
    } catch (e) {
      console.warn(`[Realtime DB Setup Error] Path ${path}:`, e);
    }
  }

  // 2. Hybrid Broadcast Fallback: Firestore document snapshot listener for multi-device sync
  if (dbPasien) {
    try {
      const sanitizedDocId = path.replace(/\//g, '_');
      const fsDocRef = doc(dbPasien, 'realtime_nodes', sanitizedDocId);
      const unsubFs = onSnapshot(fsDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const payload = data?.payload || data;
          if (payload !== undefined && payload !== null) {
            const strPayload = JSON.stringify(payload);
            if (lastReceivedCache[path] !== strPayload) {
              lastReceivedCache[path] = strPayload;
              callback(payload);
            }
          }
        }
      }, (err) => {
        // Ignored if document doesn't exist or offline
      });
      cleanups.push(() => unsubFs());
    } catch (e) {}
  }

  // 3. Multi-Tab BroadcastChannel listener for instantaneous tab-to-tab sync
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      const bcName = `simantap_rt_${path.replace(/\//g, '_')}`;
      const bc = new BroadcastChannel(bcName);
      const handleBcMessage = (event: MessageEvent) => {
        if (event.data && event.data.payload) {
          const strPayload = JSON.stringify(event.data.payload);
          if (lastReceivedCache[path] !== strPayload) {
            lastReceivedCache[path] = strPayload;
            callback(event.data.payload);
          }
        }
      };
      bc.addEventListener('message', handleBcMessage);
      cleanups.push(() => {
        try {
          bc.removeEventListener('message', handleBcMessage);
          bc.close();
        } catch (e) {}
      });
    } catch (e) {}
  }

  // Return Unsubscribe Cleanup Function to prevent memory leaks
  return () => {
    cleanups.forEach(cleanup => {
      try {
        cleanup();
      } catch (e) {}
    });
  };
};

/**
 * Mendorong perubahan data instan ke seluruh perangkat
 * @param path Node database
 * @param data Payload data
 */
export const pushRealtimeUpdate = async (path: string, data: any) => {
  const payload = {
    ...data,
    updatedAt: new Date().toISOString()
  };

  const payloadStr = JSON.stringify(payload);
  if (lastReceivedCache[path] === payloadStr) {
    return; // Prevent infinite sync loops
  }
  lastReceivedCache[path] = payloadStr;

  // 1. Immediate BroadcastChannel dispatch for multi-tab optimistic UI
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      const bcName = `simantap_rt_${path.replace(/\//g, '_')}`;
      const bc = new BroadcastChannel(bcName);
      bc.postMessage({ payload, timestamp: Date.now() });
      bc.close();
    } catch (e) {}
  }

  // 2. Primary: Push to Firebase Realtime Database
  if (db) {
    try {
      const dataRef = ref(db, path);
      await set(dataRef, payload);
    } catch (error) {
      console.error(`[Push Realtime Error] Path ${path}:`, error);
    }
  }

  // 3. Hybrid Backup: Push to Firestore Document
  if (dbPasien) {
    try {
      const sanitizedDocId = path.replace(/\//g, '_');
      const fsDocRef = doc(dbPasien, 'realtime_nodes', sanitizedDocId);
      await setDoc(fsDocRef, { payload, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {}
  }
};

/**
 * Push Realtime Update dengan Debounce (300ms - 500ms)
 * Mencegah spam request saat input cepat pada tabel/grid
 */
export const pushRealtimeUpdateDebounced = (path: string, data: any, delayMs: number = 300): Promise<void> => {
  if (debounceTimers[path]) {
    clearTimeout(debounceTimers[path]);
  }

  return new Promise<void>((resolve) => {
    debounceTimers[path] = setTimeout(async () => {
      try {
        await pushRealtimeUpdate(path, data);
      } catch (err) {
        console.error(`[Debounced Push Error] Path ${path}:`, err);
      } finally {
        delete debounceTimers[path];
        resolve();
      }
    }, delayMs);
  });
};

/**
 * Listener status koneksi jaringan (Auto-Reconnect & Keep-Alive Listener)
 */
export const subscribeConnectionStatus = (callback: (isConnected: boolean) => void): (() => void) => {
  const cleanups: (() => void)[] = [];

  if (db) {
    try {
      const connectedRef = ref(db, '.info/connected');
      onValue(connectedRef, (snapshot) => {
        const isConnected = snapshot.val() === true;
        callback(isConnected);
      }, (error) => {
        console.warn('[Realtime Sync] Connection listener notice:', error);
        callback(typeof navigator !== 'undefined' ? navigator.onLine : true);
      });

      cleanups.push(() => {
        try {
          off(connectedRef);
        } catch (e) {}
      });
    } catch (e) {
      callback(typeof navigator !== 'undefined' ? navigator.onLine : true);
    }
  } else {
    callback(typeof navigator !== 'undefined' ? navigator.onLine : true);
  }

  if (typeof window !== 'undefined') {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    cleanups.push(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  }

  return () => {
    cleanups.forEach(c => {
      try {
        c();
      } catch (e) {}
    });
  };
};

