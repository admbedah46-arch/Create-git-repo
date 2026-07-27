import { doc, collection, onSnapshot, setDoc, deleteDoc, getDocs, serverTimestamp, disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from './firebase';
import { AppData } from './types';
import { getDB, saveDB, mergeData, cleanAndDeduplicate, hasAppDataChanged, TAB_ID } from './db';

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

const PRIMARY_COLLECTIONS: { firestoreName: string; appDataKey: keyof AppData }[] = [
  { firestoreName: 'patients', appDataKey: 'patients' },
  { firestoreName: 'booking_ruangan', appDataKey: 'roomBookings' },
  { firestoreName: 'roomBookings', appDataKey: 'roomBookings' },
  { firestoreName: 'financial_reports', appDataKey: 'financeRecords' },
  { firestoreName: 'financeRecords', appDataKey: 'financeRecords' },
  { firestoreName: 'quality_indicators', appDataKey: 'qualityMeasurements' },
  { firestoreName: 'qualityMeasurements', appDataKey: 'qualityMeasurements' }
];

export const DATA_SYNC_CHANNEL_NAME = 'simantap_data_sync';
let simantapDataSyncBc: BroadcastChannel | null = null;

const getSimantapDataSyncChannel = (): BroadcastChannel | null => {
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    if (!simantapDataSyncBc) {
      try {
        simantapDataSyncBc = new BroadcastChannel(DATA_SYNC_CHANNEL_NAME);
        simantapDataSyncBc.onmessage = (event) => {
          if (event.data && event.data.senderId !== TAB_ID) {
            const payloadData = event.data.data;
            if (payloadData) {
              const localData = getDB();
              const merged = mergeData(localData, payloadData);
              if (hasAppDataChanged(merged)) {
                saveDB(merged, true, undefined, true);
                notifyDataCallbacks(merged);
              }
            } else {
              notifyDataCallbacks(getDB());
            }
          }
        };
      } catch (e) {}
    }
  }
  return simantapDataSyncBc;
};

export const broadcastCrossTabHydration = (data?: AppData, extraInfo?: any) => {
  const bc = getSimantapDataSyncChannel();
  if (bc) {
    try {
      bc.postMessage({
        type: 'SIMANTAP_DATA_NOTIFY',
        senderId: TAB_ID,
        timestamp: Date.now(),
        data: data || getDB(),
        extraInfo
      });
    } catch (e) {}
  }
};

const CHUNK_SIZE = 100;

const loadPushedHashes = (): Record<string, string> => {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('surgihub_last_pushed_hashes') || sessionStorage.getItem('surgihub_last_pushed_hashes');
      if (stored) return JSON.parse(stored);
    }
  } catch (e) {}
  return {};
};

const savePushedHashes = (hashes: Record<string, string>) => {
  try {
    if (typeof window !== 'undefined') {
      const str = JSON.stringify(hashes);
      localStorage.setItem('surgihub_last_pushed_hashes', str);
      sessionStorage.setItem('surgihub_last_pushed_hashes', str);
    }
  } catch (e) {}
};

const checkInitialQuotaExceeded = (): boolean => {
  try {
    if (typeof window !== 'undefined') {
      const val = localStorage.getItem('simantap_firestore_quota_exceeded') || sessionStorage.getItem('simantap_firestore_quota_exceeded');
      if (val) {
        const timestamp = parseInt(val, 10);
        if (Date.now() - timestamp < 12 * 3600 * 1000) {
          return true;
        } else {
          localStorage.removeItem('simantap_firestore_quota_exceeded');
          sessionStorage.removeItem('simantap_firestore_quota_exceeded');
        }
      }
    }
  } catch (e) {}
  return false;
};

const isResourceOrQuotaError = (err: any): boolean => {
  if (!err) return false;
  const str = (String(err?.code || '') + ' ' + String(err?.message || '') + ' ' + String(err || '')).toLowerCase();
  return (
    str.includes('resource-exhausted') ||
    str.includes('quota') ||
    str.includes('exhausted') ||
    str.includes('overloading') ||
    str.includes('write stream') ||
    str.includes('limit exceeded') ||
    str.includes('free daily write') ||
    str.includes('359469612868')
  );
};

let unsubscribeChunksListener: (() => void) | null = null;
let unsubscribeLegacyListener: (() => void) | null = null;
let primaryUnsubscribes: (() => void)[] = [];
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

const lastPushedHashes: Record<string, string> = loadPushedHashes();
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
let lastProcessedSnapshotHash = '';

const processSnapshotDocs = (docs: any[]) => {
  const metaDoc = docs.find((d) => d.type === 'meta');
  if (!metaDoc) return;

  const docVersionHash = `${metaDoc.timestamp || metaDoc.updatedAt || ''}_${docs.length}`;
  if (docVersionHash === lastProcessedSnapshotHash) {
    return;
  }

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

  lastProcessedSnapshotHash = docVersionHash;

  if (hasAppDataChanged(mergedData)) {
    saveDB(mergedData, true, undefined, true);
    notifyDataCallbacks(mergedData);
    broadcastCrossTabHydration(mergedData, { source: 'chunks' });
  }
};

/**
 * Initializes real-time listener for Firestore global state with includeMetadataChanges: true
 */
export const initFirestoreRealtimeSync = (): (() => void) => {
  if (isQuotaExceeded) {
    return () => {};
  }

  getSimantapDataSyncChannel();

  if (unsubscribeChunksListener) {
    return unsubscribeChunksListener;
  }

  console.log('[Firestore Sync] Starting real-time snapshot listeners with includeMetadataChanges: true...');

  let isFirstBatch = true;

  // 1. Chunks listener
  unsubscribeChunksListener = onSnapshot(
    CHUNKS_COLLECTION,
    { includeMetadataChanges: true },
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

      if (snapshot.metadata.hasPendingWrites) {
        return;
      }

      latestSnapshotDocs = snapshot.docs.map((d) => d.data());

      if (snapshotDebounceTimer) clearTimeout(snapshotDebounceTimer);
      snapshotDebounceTimer = setTimeout(() => {
        if (latestSnapshotDocs) {
          processSnapshotDocs(latestSnapshotDocs);
          latestSnapshotDocs = null;
        }
      }, 400);
    },
    (error: any) => {
      console.warn('[Firestore Sync] Chunks snapshot error:', error);
      if (isResourceOrQuotaError(error)) {
        handleQuotaExceeded();
      } else {
        notifyConnectionCallbacks(false);
      }
    }
  );

  // 2. Primary collections global listeners (patients, booking_ruangan, roomBookings, financial_reports, quality_indicators, etc.)
  PRIMARY_COLLECTIONS.forEach(({ firestoreName, appDataKey }) => {
    try {
      const colRef = collection(db, firestoreName);
      const unsub = onSnapshot(
        colRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          notifyConnectionCallbacks(true);
          if (snapshot.empty) return;
          if (snapshot.metadata.hasPendingWrites) return;

          const items: any[] = [];
          snapshot.docs.forEach((d) => {
            const item = d.data();
            if (item) {
              items.push({ id: d.id, ...item });
            }
          });

          if (items.length > 0) {
            const localData = getDB();
            const incomingPartial: any = { [appDataKey]: items };
            const mergedData = mergeData(localData, incomingPartial as AppData);

            if (hasAppDataChanged(mergedData)) {
              saveDB(mergedData, true, undefined, true);
              notifyDataCallbacks(mergedData);
              broadcastCrossTabHydration(mergedData, { sourceCollection: firestoreName });
            }
          }
        },
        (error: any) => {
          if (isResourceOrQuotaError(error)) {
            handleQuotaExceeded();
          } else {
            console.warn(`[Firestore Sync] Realtime listener error on ${firestoreName}:`, error);
          }
        }
      );
      primaryUnsubscribes.push(unsub);
    } catch (e) {
      console.warn(`[Firestore Sync] Failed to attach listener to ${firestoreName}:`, e);
    }
  });

  // 3. Fallback legacy listener on shared_state doc
  unsubscribeLegacyListener = onSnapshot(
    FIRESTORE_DOC_PATH,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!isFirstBatch || !snapshot.exists()) return;
      if (snapshot.metadata.hasPendingWrites) return;

      const remoteData = snapshot.data() as AppData;
      if (!remoteData || typeof remoteData !== 'object') return;

      console.log('[Firestore Sync] Legacy shared_state snapshot received.');
      const localData = getDB();
      const mergedData = mergeData(localData, remoteData);
      saveDB(mergedData, true, undefined, true);
      if (hasAppDataChanged(mergedData)) {
        notifyDataCallbacks(mergedData);
        broadcastCrossTabHydration(mergedData, { source: 'legacy' });
      }
    },
    (err: any) => {
      if (isResourceOrQuotaError(err)) {
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
    primaryUnsubscribes.forEach((unsub) => {
      try { unsub(); } catch (e) {}
    });
    primaryUnsubscribes = [];
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

    if (hasAppDataChanged(mergedData)) {
      saveDB(mergedData, true, undefined, true);
      notifyDataCallbacks(mergedData);
      broadcastCrossTabHydration(mergedData, { source: 'loadFromFirestore' });
    }
    notifyConnectionCallbacks(true);
    return mergedData;
  } catch (err: any) {
    if (isResourceOrQuotaError(err)) {
      handleQuotaExceeded();
    } else {
      console.warn('[Firestore Sync] loadFromFirestore error:', err);
    }
    return getDB();
  }
};

export const fetchInitialStateFromFirestore = loadFromFirestore;

const handleQuotaExceeded = () => {
  if (!isQuotaExceeded) {
    console.warn('[Firestore Sync] Firestore quota reached. Switched to safe Local IndexedDB & Broadcast Sync Mode.');
    isQuotaExceeded = true;
    try {
      if (typeof window !== 'undefined') {
        const nowStr = Date.now().toString();
        localStorage.setItem('simantap_firestore_quota_exceeded', nowStr);
        sessionStorage.setItem('simantap_firestore_quota_exceeded', nowStr);
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
    primaryUnsubscribes.forEach((unsub) => {
      try { unsub(); } catch (e) {}
    });
    primaryUnsubscribes = [];

    disableNetwork(db).catch(() => {});
    notifyConnectionCallbacks(false);
  }
};

/**
 * Asynchronously pushes local updates to Firestore with chunking and entity push
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
    }, 1500);
  });
};

const processPushQueue = async () => {
  if (isWriting || !pendingDataToPush || isQuotaExceeded) return;
  isWriting = true;
  const currentData = pendingDataToPush;
  pendingDataToPush = null;

  try {
    const cleanData = cleanAndDeduplicate(currentData);

    const writeOperations: Promise<void>[] = [];
    const newChunkCounts: Record<string, number> = {};
    const manifest: Record<string, number> = {};

    ARRAY_COLLECTIONS.forEach((colKey) => {
      const arr = (cleanData[colKey] as any[]) || [];
      const chunkCount = Math.ceil(arr.length / CHUNK_SIZE) || 1;
      manifest[colKey] = chunkCount;
      newChunkCounts[colKey] = chunkCount;
    });

    const metaPayloadForHash = {
      type: 'meta',
      masterData: cleanData.masterData,
      deletedIds: cleanData.deletedIds || [],
      chunkManifest: manifest
    };
    const metaHash = JSON.stringify(metaPayloadForHash);

    if (lastPushedHashes['meta'] !== metaHash) {
      const nowIso = new Date().toISOString();
      const metaRef = doc(db, 'appData_chunks', 'meta');
      writeOperations.push(
        setDoc(
          metaRef,
          {
            ...metaPayloadForHash,
            timestamp: nowIso,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        )
      );
      lastPushedHashes['meta'] = metaHash;
    }

    ARRAY_COLLECTIONS.forEach((colKey) => {
      const arr = (cleanData[colKey] as any[]) || [];
      const chunkCount = manifest[colKey];

      for (let i = 0; i < chunkCount; i++) {
        const chunkItems = arr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkKey = `${colKey}_${i}`;
        const chunkHash = JSON.stringify(chunkItems);

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

      const prevCount = previousChunkCounts[colKey] || 0;
      for (let i = chunkCount; i < prevCount; i++) {
        const obsoleteKey = `${colKey}_${i}`;
        const obsoleteRef = doc(db, 'appData_chunks', obsoleteKey);
        writeOperations.push(deleteDoc(obsoleteRef).catch(() => {}));
        delete lastPushedHashes[obsoleteKey];
      }
    });

    // Write individual docs for primary collections ONLY if hash changed
    const pushIfItemChanged = (colName: string, id: string, itemData: any) => {
      const key = `${colName}_item_${id}`;
      const hash = JSON.stringify(itemData);
      if (lastPushedHashes[key] !== hash) {
        lastPushedHashes[key] = hash;
        writeOperations.push(
          pushItemToFirestoreCollection(colName, id, itemData).catch(() => {})
        );
      }
    };

    if (cleanData.roomBookings && Array.isArray(cleanData.roomBookings)) {
      const recentBookings = cleanData.roomBookings.slice(-20);
      recentBookings.forEach((b) => {
        if (b && b.id) {
          pushIfItemChanged('roomBookings', b.id, b);
          pushIfItemChanged('booking_ruangan', b.id, b);
        }
      });
    }
    if (cleanData.patients && Array.isArray(cleanData.patients)) {
      const recentPatients = cleanData.patients.slice(-20);
      recentPatients.forEach((p) => {
        if (p && p.id) {
          pushIfItemChanged('patients', p.id, p);
        }
      });
    }
    if (cleanData.financeRecords && Array.isArray(cleanData.financeRecords)) {
      const recentFinance = cleanData.financeRecords.slice(-20);
      recentFinance.forEach((f) => {
        if (f && f.id) {
          pushIfItemChanged('financeRecords', f.id, f);
          pushIfItemChanged('financial_reports', f.id, f);
        }
      });
    }
    if (cleanData.qualityMeasurements && Array.isArray(cleanData.qualityMeasurements)) {
      const recentQuality = cleanData.qualityMeasurements.slice(-20);
      recentQuality.forEach((q) => {
        if (q && q.id) {
          pushIfItemChanged('qualityMeasurements', q.id, q);
          pushIfItemChanged('quality_indicators', q.id, q);
        }
      });
    }

    previousChunkCounts = newChunkCounts;
    savePushedHashes(lastPushedHashes);

    if (writeOperations.length > 0) {
      await Promise.all(writeOperations);
      console.log(`[Firestore Sync] Smart push executed: ${writeOperations.length} changed chunk(s) written.`);
    }

    notifyConnectionCallbacks(true);
    broadcastCrossTabHydration(cleanData, { source: 'push' });
  } catch (err: any) {
    if (isResourceOrQuotaError(err)) {
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
    if (isResourceOrQuotaError(err)) {
      handleQuotaExceeded();
    } else {
      console.warn(`[Firestore Sync] Failed to update ${collectionName}/${itemId}:`, err);
    }
  }
};
