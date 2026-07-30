import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'SiMANTAP_LocalCache';
const DB_VERSION = 1;

export const initIndexedDB = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sensus_bedah')) {
        db.createObjectStore('sensus_bedah', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('audit_mutu')) {
        db.createObjectStore('audit_mutu', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending_sync')) {
        db.createObjectStore('pending_sync', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

export const saveOfflineData = async (storeName: string, data: any) => {
  const db = await initIndexedDB();
  return db.add(storeName, { ...data, timestamp: new Date().toISOString() });
};

export const getOfflineData = async (storeName: string) => {
  const db = await initIndexedDB();
  return db.getAll(storeName);
};
