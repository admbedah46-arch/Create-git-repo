import { doc, collection, onSnapshot, setDoc, deleteDoc, getDocs, getDoc, serverTimestamp, disableNetwork, enableNetwork } from 'firebase/firestore';
import { db, dbPasien, dbMutu, dbMaster, enableFirestoreNetwork, disableFirestoreNetwork } from './firebase';
import { AppData } from './types';
import { getDB, saveDB, mergeData, cleanAndDeduplicate, hasAppDataChanged, TAB_ID, syncData } from './db';

export const getDbForCollection = (colName: string) => {
  if (['patients', 'booking_ruangan', 'roomBookings', 'dailyReports', 'operations', 'nursingReports'].includes(colName)) {
    return dbPasien;
  }
  if (['qualityMeasurements', 'quality_indicators', 'doctorVisits', 'incidentReports', 'operationReports', 'financial_reports', 'financeRecords'].includes(colName)) {
    return dbMutu;
  }
  if (['masterData', 'master_data', 'users', 'instruments', 'appData_chunks', 'appData'].includes(colName)) {
    return dbMaster;
  }
  return dbPasien;
};

const FIRESTORE_DOC_PATH = doc(dbMaster, 'appData', 'shared_state');
const CHUNKS_COLLECTION = collection(dbMaster, 'appData_chunks');

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
  'roomBookings',
  'booking_ruangan'
];

const UNIQUE_COLLECTIONS: { firestoreName: string; appDataKeys: (keyof AppData)[] }[] = [
  { firestoreName: 'patients', appDataKeys: ['patients'] },
  { firestoreName: 'booking_ruangan', appDataKeys: ['booking_ruangan', 'roomBookings'] },
  { firestoreName: 'roomBookings', appDataKeys: ['roomBookings', 'booking_ruangan'] },
  { firestoreName: 'financial_reports', appDataKeys: ['financeRecords'] },
  { firestoreName: 'financeRecords', appDataKeys: ['financeRecords'] },
  { firestoreName: 'quality_indicators', appDataKeys: ['qualityMeasurements'] },
  { firestoreName: 'qualityMeasurements', appDataKeys: ['qualityMeasurements'] },
  { firestoreName: 'dailyReports', appDataKeys: ['dailyReports'] },
  { firestoreName: 'nursingReports', appDataKeys: ['nursingReports'] },
  { firestoreName: 'operations', appDataKeys: ['operations'] },
  { firestoreName: 'doctorVisits', appDataKeys: ['doctorVisits'] },
  { firestoreName: 'incidentReports', appDataKeys: ['incidentReports'] },
  { firestoreName: 'operationReports', appDataKeys: ['operationReports'] },
  { firestoreName: 'instruments', appDataKeys: ['instruments'] },
  { firestoreName: 'masterData', appDataKeys: ['masterData'] },
  { firestoreName: 'master_data', appDataKeys: ['masterData'] }
];

const uniqueCollectionMap = new Map<string, (keyof AppData)[]>();
UNIQUE_COLLECTIONS.forEach(({ firestoreName, appDataKeys }) => {
  const existing = uniqueCollectionMap.get(firestoreName) || [];
  uniqueCollectionMap.set(firestoreName, Array.from(new Set([...existing, ...appDataKeys])));
});

const PRIMARY_COLLECTIONS: { firestoreName: string; appDataKey: keyof AppData }[] = UNIQUE_COLLECTIONS.flatMap(
  item => item.appDataKeys.map(appDataKey => ({ firestoreName: item.firestoreName, appDataKey }))
);

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
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('simantap_firestore_quota_exceeded');
      sessionStorage.removeItem('simantap_firestore_quota_exceeded');
    } catch (e) {}
  }
  return false;
};

const isResourceOrQuotaError = (err: any): boolean => {
  if (!err) return false;
  const str = (String(err?.code || '') + ' ' + String(err?.message || '') + ' ' + String(err || '') + ' ' + String(err?.stack || '')).toLowerCase();
  return (
    str.includes('resource-exhausted') ||
    str.includes('resource_exhausted') ||
    str.includes('quota') ||
    str.includes('exhausted') ||
    str.includes('overloading') ||
    str.includes('write stream') ||
    str.includes('limit exceeded') ||
    str.includes('free daily write') ||
    str.includes('359469612868') ||
    str.includes('429') ||
    str.includes('unexpected state') ||
    str.includes('c050') ||
    str.includes('b815') ||
    str.includes('ca9') ||
    str.includes('assertion') ||
    str.includes('targetstate')
  );
};

let unsubscribeChunksListener: (() => void) | null = null;
let unsubscribeLegacyListener: (() => void) | null = null;
let primaryUnsubscribes: (() => void)[] = [];
let isConnected = false;
let isQuotaExceeded = checkInitialQuotaExceeded();

enableFirestoreNetwork().catch(() => {});

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

const notifyConnectionCallbacks = (status: boolean, quotaExceeded?: boolean) => {
  isConnected = status;
  if (quotaExceeded !== undefined) {
    isQuotaExceeded = quotaExceeded;
  }
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
  if (typeof window !== 'undefined') {
    try {
      if (sessionStorage.getItem('simantap_firestore_quota_exceeded') === 'true') {
        isQuotaExceeded = true;
      }
    } catch (e) {}
  }
  enableFirestoreNetwork().catch(() => {});

  getSimantapDataSyncChannel();

  if (unsubscribeChunksListener) {
    return unsubscribeChunksListener;
  }

  console.log('[Firestore Sync] Starting real-time snapshot listeners...');

  primaryUnsubscribes.forEach((unsub) => {
    try { unsub(); } catch (e) {}
  });
  primaryUnsubscribes = [];

  let isFirstBatch = true;

  // 1. Chunks listener
  unsubscribeChunksListener = onSnapshot(
    CHUNKS_COLLECTION,
    (snapshot) => {
      try {
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

        if (snapshot.metadata?.hasPendingWrites) {
          return;
        }

        latestSnapshotDocs = snapshot.docs.map((d) => d.data());

        if (snapshotDebounceTimer) clearTimeout(snapshotDebounceTimer);
        snapshotDebounceTimer = setTimeout(() => {
          if (latestSnapshotDocs) {
            processSnapshotDocs(latestSnapshotDocs);
            latestSnapshotDocs = null;
          }
        }, 600);
      } catch (e) {
        console.warn('[Firestore Sync] Chunk snapshot callback error:', e);
      }
    },
    (error: any) => {
      console.warn('[Firestore Sync] Chunks snapshot error:', error);
      if (isResourceOrQuotaError(error)) {
        handleQuotaExceeded(error);
      } else {
        notifyConnectionCallbacks(false);
      }
    }
  );

  // 2. Primary collections deduplicated listeners
  const collectionDebounceTimers = new Map<string, any>();
  uniqueCollectionMap.forEach((appDataKeys, firestoreName) => {
    try {
      const targetDb = getDbForCollection(firestoreName);
      const colRef = collection(targetDb, firestoreName);
      const unsub = onSnapshot(
        colRef,
        (snapshot) => {
          try {
            notifyConnectionCallbacks(true);
            if (snapshot.empty) return;
            if (snapshot.metadata?.hasPendingWrites) return;

            const items: any[] = [];
            snapshot.docs.forEach((d) => {
              const item = d.data();
              if (item) {
                items.push({ id: d.id, ...item });
              }
            });

            if (items.length > 0) {
              const existingTimer = collectionDebounceTimers.get(firestoreName);
              if (existingTimer) clearTimeout(existingTimer);

              collectionDebounceTimers.set(
                firestoreName,
                setTimeout(() => {
                  try {
                    const localData = getDB();
                    const incomingPartial: any = {};
                    appDataKeys.forEach((key) => {
                      incomingPartial[key] = items;
                    });
                    const mergedData = mergeData(localData, incomingPartial as AppData);

                    if (hasAppDataChanged(mergedData)) {
                      saveDB(mergedData, true, undefined, true);
                      notifyDataCallbacks(mergedData);
                      broadcastCrossTabHydration(mergedData, { sourceCollection: firestoreName });
                    }
                  } catch (e) {
                    console.warn(`[Firestore Sync] Error merging collection ${firestoreName}:`, e);
                  }
                }, 600)
              );
            }
          } catch (e) {
            console.warn(`[Firestore Sync] Callback error on ${firestoreName}:`, e);
          }
        },
        (error: any) => {
          if (isResourceOrQuotaError(error)) {
            handleQuotaExceeded(error);
          } else {
            console.warn(`[Firestore Sync] Realtime listener error on ${firestoreName}:`, error?.message || error);
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
    (snapshot) => {
      try {
        if (!isFirstBatch || !snapshot.exists()) return;
        if (snapshot.metadata?.hasPendingWrites) return;

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
      } catch (e) {
        console.warn('[Firestore Sync] Legacy snapshot callback error:', e);
      }
    },
    (err: any) => {
      if (isResourceOrQuotaError(err)) {
        handleQuotaExceeded(err);
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
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('simantap_firestore_quota_exceeded');
      sessionStorage.removeItem('simantap_firestore_quota_exceeded');
    } catch (e) {}
  }
  isQuotaExceeded = false;
  enableFirestoreNetwork().catch(() => {});

  try {
    console.log('[Firestore Sync] Force reading and reconciling all collections and chunks from Cloud Firestore...');
    const combinedData: Partial<AppData> = {};

    // 1. Read single document shared_state fallback if present
    try {
      const singleDocSnap = await getDoc(FIRESTORE_DOC_PATH);
      if (singleDocSnap.exists()) {
        const singleData = singleDocSnap.data() as AppData;
        if (singleData && typeof singleData === 'object') {
          ARRAY_COLLECTIONS.forEach((colKey) => {
            if (Array.isArray(singleData[colKey]) && singleData[colKey].length > 0) {
              const existing = (combinedData as any)[colKey] || [];
              const map = new Map(existing.map((x: any) => [x.id || JSON.stringify(x), x]));
              singleData[colKey].forEach((it: any) => {
                if (it) {
                  const key = it.id || JSON.stringify(it);
                  map.set(key, { ...((map.get(key) as any) || {}), ...it });
                }
              });
              (combinedData as any)[colKey] = Array.from(map.values());
            }
          });
          if (singleData.masterData) {
            combinedData.masterData = { ...(combinedData.masterData || {}), ...singleData.masterData } as any;
          }
        }
      }
    } catch (singleErr) {
      console.warn('[Firestore Sync] Single doc read notice:', singleErr);
    }

    // 2. Read chunks
    try {
      const snapshot = await getDocs(CHUNKS_COLLECTION);
      if (!snapshot.empty) {
        const docs = snapshot.docs.map((d) => d.data());
        const metaDoc = docs.find((d) => d.type === 'meta');
        if (metaDoc) {
          combinedData.masterData = { ...(combinedData.masterData || {}), ...metaDoc.masterData };
          combinedData.deletedIds = metaDoc.deletedIds || [];
          combinedData.timestamp = metaDoc.timestamp;
        }

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
          if (allItems.length > 0) {
            const existing = (combinedData as any)[colKey] || [];
            const map = new Map(existing.map((x: any) => [x.id || JSON.stringify(x), x]));
            allItems.forEach((it: any) => {
              if (it) {
                const key = it.id || JSON.stringify(it);
                map.set(key, { ...((map.get(key) as any) || {}), ...it });
              }
            });
            (combinedData as any)[colKey] = Array.from(map.values());
          }
        });
      }
    } catch (chunkErr) {
      console.warn('[Firestore Sync] Chunks read notice:', chunkErr);
    }

    // 2. Read directly from primary collections
    const primaryFetchTasks = PRIMARY_COLLECTIONS.map(async ({ firestoreName, appDataKey }) => {
      try {
        const targetDb = getDbForCollection(firestoreName);
        const colRef = collection(targetDb, firestoreName);
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const items: any[] = [];
          snap.docs.forEach((d) => {
            const item = d.data();
            if (item) {
              items.push({ id: d.id, ...item });
            }
          });

          if (items.length > 0) {
            if (firestoreName === 'masterData' || firestoreName === 'master_data') {
              const firstData = snap.docs[0].data();
              if (firstData && typeof firstData === 'object') {
                combinedData.masterData = { ...(combinedData.masterData || {}), ...firstData } as any;
              }
            } else {
              const existing = (combinedData as any)[appDataKey] || [];
              const existingMap = new Map(existing.map((x: any) => [x.id, x]));
              items.forEach((it: any) => existingMap.set(it.id, { ...((existingMap.get(it.id) as any) || {}), ...it }));
              (combinedData as any)[appDataKey] = Array.from(existingMap.values());

              if (firestoreName === 'booking_ruangan' || firestoreName === 'roomBookings') {
                combinedData.booking_ruangan = Array.from(existingMap.values()) as any;
                combinedData.roomBookings = Array.from(existingMap.values()) as any;
              }
            }
          }
        }
      } catch (colErr) {
        console.warn(`[Firestore Sync] Direct fetch notice for ${firestoreName}:`, colErr);
      }
    });

    await Promise.allSettled(primaryFetchTasks);

    // Also fetch from Google Sheets Primary Server to ensure full historical patient data (28-30 July 2026) is complete
    try {
      await syncData(true);
    } catch (sheetErr) {
      console.warn('[Firestore Sync] Secondary Sheet hydration notice:', sheetErr);
    }

    const localData = getDB();
    const mergedData = mergeData(localData, combinedData as AppData);

    saveDB(mergedData, true, undefined, true);
    notifyDataCallbacks(mergedData);
    broadcastCrossTabHydration(mergedData, { source: 'loadFromFirestore' });
    notifyConnectionCallbacks(true);
    return mergedData;
  } catch (err: any) {
    console.warn('[Firestore Sync] loadFromFirestore error:', err);
    return getDB();
  }
};

export const fetchInitialStateFromFirestore = loadFromFirestore;

let quotaExceededTimer: any = null;

const handleQuotaExceeded = (err?: any) => {
  console.warn('[Firestore Sync] Quota limit or write stream capacity reached. Pausing Firestore push writes temporarily while preserving local IndexedDB, Supabase, and Sheets operations.', err);
  isQuotaExceeded = true;
  notifyConnectionCallbacks(true, true);

  if (quotaExceededTimer) clearTimeout(quotaExceededTimer);
  quotaExceededTimer = setTimeout(() => {
    isQuotaExceeded = false;
    console.log('[Firestore Sync] Quota backoff window cleared. Retrying Firestore sync.');
  }, 45000);
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
    }, 2500);
  });
};

const processPushQueue = async () => {
  if (isWriting || !pendingDataToPush || isQuotaExceeded) return;
  isWriting = true;
  const currentData = pendingDataToPush;
  pendingDataToPush = null;

  try {
    const cleanData = cleanAndDeduplicate(currentData);
    let writtenCount = 0;
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

    if (lastPushedHashes['meta'] !== metaHash && !isQuotaExceeded) {
      const nowIso = new Date().toISOString();
      const metaRef = doc(dbMaster, 'appData_chunks', 'meta');
      try {
        await setDoc(
          metaRef,
          {
            ...metaPayloadForHash,
            timestamp: nowIso,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        lastPushedHashes['meta'] = metaHash;
        writtenCount++;
      } catch (err: any) {
        if (isResourceOrQuotaError(err)) {
          handleQuotaExceeded();
          return;
        }
      }
    }

    for (const colKey of ARRAY_COLLECTIONS) {
      if (isQuotaExceeded) break;
      const arr = (cleanData[colKey] as any[]) || [];
      const chunkCount = manifest[colKey];
      const targetDb = getDbForCollection(colKey);

      for (let i = 0; i < chunkCount; i++) {
        if (isQuotaExceeded) break;
        const chunkItems = arr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkKey = `${colKey}_${i}`;
        const chunkHash = JSON.stringify(chunkItems);

        if (lastPushedHashes[chunkKey] !== chunkHash) {
          const chunkRef = doc(targetDb, 'appData_chunks', chunkKey);
          try {
            await setDoc(
              chunkRef,
              {
                type: colKey,
                chunkIndex: i,
                totalChunks: chunkCount,
                items: chunkItems,
                updatedAt: serverTimestamp()
              },
              { merge: true }
            );
            lastPushedHashes[chunkKey] = chunkHash;
            writtenCount++;
          } catch (err: any) {
            if (isResourceOrQuotaError(err)) {
              handleQuotaExceeded();
              break;
            }
          }
        }
      }

      const prevCount = previousChunkCounts[colKey] || 0;
      for (let i = chunkCount; i < prevCount; i++) {
        if (isQuotaExceeded) break;
        const obsoleteKey = `${colKey}_${i}`;
        const obsoleteRef = doc(targetDb, 'appData_chunks', obsoleteKey);
        try {
          await deleteDoc(obsoleteRef);
          delete lastPushedHashes[obsoleteKey];
        } catch (err: any) {
          if (isResourceOrQuotaError(err)) {
            handleQuotaExceeded();
            break;
          }
        }
      }
    }

    previousChunkCounts = newChunkCounts;
    savePushedHashes(lastPushedHashes);

    if (writtenCount > 0) {
      console.log(`[Firestore Sync] Smart push executed: ${writtenCount} changed chunk(s) written.`);
    }

    if (!isQuotaExceeded) {
      notifyConnectionCallbacks(true);
      broadcastCrossTabHydration(cleanData, { source: 'push' });
    }
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
    const targetDb = getDbForCollection(collectionName);
    const itemRef = doc(targetDb, collectionName, itemId);
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

/**
 * Hard delete entity from Cloud Firestore collection
 */
export const deleteItemFromFirestoreCollection = async (
  collectionName: string,
  itemId: string
): Promise<void> => {
  if (isQuotaExceeded || !itemId) return;
  try {
    const targetDb = getDbForCollection(collectionName);
    const itemRef = doc(targetDb, collectionName, itemId);
    await deleteDoc(itemRef);

    if (collectionName === 'booking_ruangan' || collectionName === 'roomBookings') {
      const aliasName = collectionName === 'booking_ruangan' ? 'roomBookings' : 'booking_ruangan';
      const aliasRef = doc(getDbForCollection(aliasName), aliasName, itemId);
      await deleteDoc(aliasRef).catch(() => {});
    } else if (collectionName === 'qualityMeasurements' || collectionName === 'quality_indicators') {
      const aliasName = collectionName === 'qualityMeasurements' ? 'quality_indicators' : 'qualityMeasurements';
      const aliasRef = doc(getDbForCollection(aliasName), aliasName, itemId);
      await deleteDoc(aliasRef).catch(() => {});
    } else if (collectionName === 'financeRecords' || collectionName === 'financial_reports') {
      const aliasName = collectionName === 'financeRecords' ? 'financial_reports' : 'financeRecords';
      const aliasRef = doc(getDbForCollection(aliasName), aliasName, itemId);
      await deleteDoc(aliasRef).catch(() => {});
    }
  } catch (err: any) {
    if (isResourceOrQuotaError(err)) {
      handleQuotaExceeded();
    } else {
      console.warn(`[Firestore Sync] Failed to delete ${collectionName}/${itemId}:`, err);
    }
  }
};

export const fetchLatestFromFirestore = loadFromFirestore;
