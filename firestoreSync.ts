import { doc, collection, onSnapshot, setDoc, deleteDoc, getDocs, serverTimestamp, disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from './firebase';
import { AppData } from './types';
import { getDB, saveDB, mergeData, cleanAndDeduplicate, hasAppDataChanged } from './db';

const FIRESTORE_DOC_PATH = doc(db, 'appData', 'shared_state');
const CHUNKS_COLLECTION = collection(db, 'appData_chunks');

const ARRAY_COLLECTIONS: (keyof AppData)[] = [
  'patients',
  'dailyReports',
  'nursingReports',
  'operations',
  'doctorVisits',
  'financeRecords',
  'incidentReports',
  'qualityMeasurements',
  'instruments',
  'operationReports',
  'roomBookings'
];

const CHUNK_SIZE = 100;

const checkInitialQuotaExceeded = (): boolean => {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const val = sessionStorage.getItem('simantap_firestore_quota_exceeded');
      if (val) {
        const timestamp = parseInt(val, 10);
        if (Date.now() - timestamp < 12 * 3600 * 1000) {
          return true;
        } else {
          sessionStorage.removeItem('simantap_firestore_quota_exceeded');
        }
      }
    }
  } catch (e) {}
  return false;
};

let unsubscribeChunksListener: (() => void) | null = null;
let unsubscribeLegacyListener: (() => void) | null = null;
let isConnected = false;
let isQuotaExceeded = checkInitialQuotaExceeded();

if (isQuotaExceeded) {
  try {
    disableNetwork(db).catch(() => {});
  } catch (e) {}
}

let pendingDataToPush: AppData | null = null;
let pushDebounceTimer: any = null;
let isWriting = false;

// Store stringified hashes of last pushed chunks to prevent redundant Firestore writes
const lastPushedHashes: Record<string, string> = {};
let previousChunkCounts: Record<string, number> = {};

type DataCallback = (data: AppData) => void;
type ConnectionCallback = (isConnected: boolean, quotaExceeded?: boolean) => void;

const dataCallbacks: Set<DataCallback> = new Set();
const connectionCallbacks: Set<ConnectionCallback> = new Set();

export const subscribeDataChange = (cb: DataCallback) => {
  dataCallbacks.add(cb);
  return () => {
    dataCallbacks.delete(cb);
  };
};

export const subscribeConnectionStatus = (cb: ConnectionCallback) => {
  connectionCallbacks.add(cb);
  cb(isConnected, isQuotaExceeded);
  return () => {
    connectionCallbacks.delete(cb);
  };
};

const notifyDataCallbacks = (data: AppData) => {
  dataCallbacks.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.error('[Firestore Sync] Callback error:', e);
    }
  });
};

const notifyConnectionCallbacks = (status: boolean) => {
  isConnected = status;
  connectionCallbacks.forEach((cb) => {
    try {
      cb(status, isQuotaExceeded);
    } catch (e) {
      console.error('[Firestore Sync] Connection callback error:', e);
    }
  });
};

let snapshotDebounceTimer: any = null;
let latestSnapshotDocs: any[] | null = null;

const processSnapshotDocs = (docs: any[]) => {
  const metaDoc = docs.find((d) => d.type === 'meta');
  if (!metaDoc) return;

  const reconstructedData: any = {
    masterData: metaDoc.masterData,
    deletedIds: metaDoc.deletedIds || [],
    timestamp: metaDoc.timestamp
  };

  ARRAY_COLLECTIONS.forEach((colKey) => {
    const colDocs = docs
      .filter((d) => d.type === colKey)
      .sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));

    const allItems: any[] = [];
    colDocs.forEach((cd) => {
      if (Array.isArray(cd.items)) {
        allItems.push(...cd.items);
      }
    });
    reconstructedData[colKey] = allItems;
  });

  const localData = getDB();
  const mergedData = mergeData(localData, reconstructedData as AppData);

  // Save locally to IndexedDB & RAM without triggering duplicate loop
  saveDB(mergedData, true);

  // Notify UI listeners ONLY if data actually changed
  if (hasAppDataChanged(mergedData)) {
    notifyDataCallbacks(mergedData);
  }
};

/**
 * Initializes real-time listener for Firestore chunked state
 */
export const initFirestoreRealtimeSync = (): (() => void) => {
  if (isQuotaExceeded) {
    return () => {};
  }

  if (unsubscribeChunksListener) {
    return unsubscribeChunksListener;
  }

  console.log('[Firestore Sync] Starting real-time snapshot listener on /appData_chunks...');

  let isFirstBatch = true;

  unsubscribeChunksListener = onSnapshot(
    CHUNKS_COLLECTION,
    (snapshot) => {
      notifyConnectionCallbacks(true);

      if (snapshot.empty) {
        console.log('[Firestore Sync] appData_chunks is empty. Initializing with local DB...');
        if (!isQuotaExceeded) {
          const localData = getDB();
          pushToFirestore(localData).catch((err) =>
            console.warn('[Firestore Sync] Initial chunk push failed:', err)
          );
        }
        return;
      }

      // Avoid infinite write-back loop when local device produced the write
      if (snapshot.metadata.hasPendingWrites) {
        return;
      }

      latestSnapshotDocs = snapshot.docs.map((d) => d.data());

      if (isFirstBatch) {
        isFirstBatch = false;
        processSnapshotDocs(latestSnapshotDocs);
        latestSnapshotDocs = null;
      } else {
        if (snapshotDebounceTimer) clearTimeout(snapshotDebounceTimer);
        snapshotDebounceTimer = setTimeout(() => {
          if (latestSnapshotDocs) {
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
              window.requestIdleCallback(() => {
                if (latestSnapshotDocs) processSnapshotDocs(latestSnapshotDocs);
                latestSnapshotDocs = null;
              });
            } else {
              processSnapshotDocs(latestSnapshotDocs);
              latestSnapshotDocs = null;
            }
          }
        }, 300);
      }
    },
    (error: any) => {
      console.warn('[Firestore Sync] Chunks snapshot error:', error);
      if (error?.code === 'resource-exhausted' || error?.message?.includes('quota')) {
        handleQuotaExceeded();
      } else {
        notifyConnectionCallbacks(false);
      }
    }
  );

  // Fallback legacy listener on shared_state doc for initial migration
  unsubscribeLegacyListener = onSnapshot(
    FIRESTORE_DOC_PATH,
    (snapshot) => {
      if (!isFirstBatch || !snapshot.exists()) return;
      if (snapshot.metadata.hasPendingWrites) return;

      const remoteData = snapshot.data() as AppData;
      if (!remoteData || typeof remoteData !== 'object') return;

      console.log('[Firestore Sync] Legacy shared_state snapshot received for migration.');
      const localData = getDB();
      const mergedData = mergeData(localData, remoteData);
      saveDB(mergedData, true);
      if (hasAppDataChanged(mergedData)) {
        notifyDataCallbacks(mergedData);
      }
    },
    (err: any) => {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('quota')) {
        handleQuotaExceeded();
      } else {
        console.warn('[Firestore Sync] Legacy snapshot warning:', err);
      }
    }
  );

  return () => {
    if (snapshotDebounceTimer) clearTimeout(snapshotDebounceTimer);
    if (unsubscribeChunksListener) {
      try { unsubscribeChunksListener(); } catch (e) {}
      unsubscribeChunksListener = null;
    }
    if (unsubscribeLegacyListener) {
      try { unsubscribeLegacyListener(); } catch (e) {}
      unsubscribeLegacyListener = null;
    }
  };
};

/**
 * Force load and reconcile all chunks directly on application load or manual trigger
 */
export const loadFromFirestore = async (): Promise<AppData | null> => {
  if (isQuotaExceeded) return getDB();
  try {
    console.log('[Firestore Sync] Force reading and reconciling all chunks from /appData_chunks...');
    const snapshot = await getDocs(CHUNKS_COLLECTION);
    if (snapshot.empty) {
      console.log('[Firestore Sync] appData_chunks is empty. Initializing with local DB...');
      const localData = getDB();
      if (!isQuotaExceeded) {
        pushToFirestore(localData).catch(() => {});
      }
      return localData;
    }

    const docs = snapshot.docs.map((d) => d.data());
    const metaDoc = docs.find((d) => d.type === 'meta');
    if (!metaDoc) return getDB();

    const reconstructedData: any = {
      masterData: metaDoc.masterData,
      deletedIds: metaDoc.deletedIds || [],
      timestamp: metaDoc.timestamp
    };

    ARRAY_COLLECTIONS.forEach((colKey) => {
      const colDocs = docs
        .filter((d) => d.type === colKey)
        .sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));

      const allItems: any[] = [];
      colDocs.forEach((cd) => {
        if (Array.isArray(cd.items)) {
          allItems.push(...cd.items);
        }
      });
      reconstructedData[colKey] = allItems;
    });

    const localData = getDB();
    const mergedData = mergeData(localData, reconstructedData as AppData);

    // Save merged result locally without echo broadcast
    saveDB(mergedData, true);

    // Upload merged result back to cloud if local had newer/additional records
    if (!isQuotaExceeded) {
      pushToFirestore(mergedData).catch((err) =>
        console.warn('[Firestore Sync] Force load push error:', err)
      );
    }

    if (hasAppDataChanged(mergedData)) {
      notifyDataCallbacks(mergedData);
    }
    notifyConnectionCallbacks(true);
    return mergedData;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('quota')) {
      handleQuotaExceeded();
    } else {
      console.warn('[Firestore Sync] loadFromFirestore error:', err);
    }
    return getDB();
  }
};

const handleQuotaExceeded = () => {
  if (!isQuotaExceeded) {
    console.warn('[Firestore Sync] Firestore daily write/read quota reached. Switched to 100% safe Local IndexedDB & Broadcast Sync Mode.');
    isQuotaExceeded = true;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('simantap_firestore_quota_exceeded', Date.now().toString());
      }
    } catch (e) {}

    if (unsubscribeChunksListener) {
      try { unsubscribeChunksListener(); } catch (e) {}
      unsubscribeChunksListener = null;
    }
    if (unsubscribeLegacyListener) {
      try { unsubscribeLegacyListener(); } catch (e) {}
      unsubscribeLegacyListener = null;
    }

    // Disable Firestore network connectivity to silence retry loops
    disableNetwork(db).catch(() => {});
    notifyConnectionCallbacks(false);
  }
};

/**
 * Asynchronously pushes local updates to Firestore with chunking, smart hash diffing, and quota protection
 */
export const pushToFirestore = (data: AppData): Promise<void> => {
  pendingDataToPush = data;

  if (isQuotaExceeded) {
    return Promise.resolve();
  }

  if (pushDebounceTimer) {
    clearTimeout(pushDebounceTimer);
  }

  return new Promise((resolve) => {
    pushDebounceTimer = setTimeout(async () => {
      await processPushQueue();
      resolve();
    }, 1000); // 1s debounce to conserve quota and prevent UI stutter
  });
};

const processPushQueue = async () => {
  if (isWriting || !pendingDataToPush || isQuotaExceeded) return;
  isWriting = true;
  const currentData = pendingDataToPush;
  pendingDataToPush = null;

  try {
    const cleanData = cleanAndDeduplicate(currentData);
    cleanData.timestamp = new Date().toISOString();

    const writeOperations: Promise<void>[] = [];
    const newChunkCounts: Record<string, number> = {};
    const manifest: Record<string, number> = {};

    // 1. Calculate chunk counts
    ARRAY_COLLECTIONS.forEach((colKey) => {
      const arr = (cleanData[colKey] as any[]) || [];
      const chunkCount = Math.ceil(arr.length / CHUNK_SIZE) || 1;
      manifest[colKey] = chunkCount;
      newChunkCounts[colKey] = chunkCount;
    });

    // 2. Check if 'meta' chunk actually changed
    const metaPayload = {
      type: 'meta',
      masterData: cleanData.masterData,
      deletedIds: cleanData.deletedIds || [],
      timestamp: cleanData.timestamp,
      chunkManifest: manifest
    };
    const metaHash = JSON.stringify(metaPayload);

    if (lastPushedHashes['meta'] !== metaHash) {
      const metaRef = doc(db, 'appData_chunks', 'meta');
      writeOperations.push(
        setDoc(
          metaRef,
          {
            ...metaPayload,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        )
      );
      lastPushedHashes['meta'] = metaHash;
    }

    // 3. Write ONLY array collection chunks that have actually changed
    ARRAY_COLLECTIONS.forEach((colKey) => {
      const arr = (cleanData[colKey] as any[]) || [];
      const chunkCount = manifest[colKey];

      for (let i = 0; i < chunkCount; i++) {
        const chunkItems = arr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkKey = `${colKey}_${i}`;
        const chunkHash = JSON.stringify(chunkItems);

        // Diff check: Only issue setDoc if items in this chunk changed
        if (lastPushedHashes[chunkKey] !== chunkHash) {
          const chunkRef = doc(db, 'appData_chunks', chunkKey);
          writeOperations.push(
            setDoc(
              chunkRef,
              {
                type: colKey,
                chunkIndex: i,
                totalChunks: chunkCount,
                items: chunkItems,
                updatedAt: serverTimestamp()
              },
              { merge: true }
            )
          );
          lastPushedHashes[chunkKey] = chunkHash;
        }
      }

      // Clean up obsolete chunk documents if count decreased
      const prevCount = previousChunkCounts[colKey] || 0;
      for (let i = chunkCount; i < prevCount; i++) {
        const obsoleteKey = `${colKey}_${i}`;
        const obsoleteRef = doc(db, 'appData_chunks', obsoleteKey);
        writeOperations.push(deleteDoc(obsoleteRef).catch(() => {}));
        delete lastPushedHashes[obsoleteKey];
      }
    });

    previousChunkCounts = newChunkCounts;

    if (writeOperations.length > 0) {
      await Promise.all(writeOperations);
      console.log(`[Firestore Sync] Smart push executed: ${writeOperations.length} changed chunk(s) written.`);
    }

    notifyConnectionCallbacks(true);
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('quota')) {
      handleQuotaExceeded();
    } else {
      console.warn('[Firestore Sync] Push to Firestore chunks failed:', err);
      notifyConnectionCallbacks(false);
    }
  } finally {
    isWriting = false;
    if (pendingDataToPush && !isQuotaExceeded) {
      processPushQueue();
    }
  }
};

/**
 * Partial update for specific entities
 */
export const pushItemToFirestoreCollection = async (
  collectionName: string,
  itemId: string,
  itemData: any
): Promise<void> => {
  if (isQuotaExceeded) return;
  try {
    const itemRef = doc(db, collectionName, itemId);
    await setDoc(
      itemRef,
      {
        ...itemData,
        lastModified: new Date().toISOString(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('quota')) {
      handleQuotaExceeded();
    } else {
      console.warn(`[Firestore Sync] Failed to update ${collectionName}/${itemId}:`, err);
    }
  }
};

