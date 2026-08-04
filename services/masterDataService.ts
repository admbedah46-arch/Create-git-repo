import { MasterData, User } from '../types';
import { getDB, saveDB, registerDeletedId, uploadDataBackground } from '../db';
import { pushItemToFirestoreCollection, deleteItemFromFirestoreCollection } from '../firestoreSync';
import { googleAppsScriptService } from './googleAppsScriptService';

/**
 * Master Data Service with Zero Data Loss 3-Layer Hybrid Persistence Architecture
 * Manages Clinical Users, Settings, Doctor/Nurse Directories, Units & Rooms
 */

import { INITIAL_DATA } from '../constants';

export const masterDataService = {
  // 1. Get current Master Data
  getMasterData(): MasterData {
    const db = getDB();
    return db.masterData || INITIAL_DATA.masterData;
  },

  // 2. Save / Merge Master Data updates
  async updateMasterData(updates: Partial<MasterData>): Promise<MasterData> {
    const db = getDB();
    const currentMaster = db.masterData || INITIAL_DATA.masterData;

    const updatedMaster: MasterData = {
      ...INITIAL_DATA.masterData,
      ...currentMaster,
      ...updates,
      settings: {
        ...(INITIAL_DATA.masterData.settings || {}),
        ...(currentMaster.settings || {}),
        ...(updates.settings || {}),
        settingsTimestamp: new Date().toISOString()
      }
    };

    db.masterData = updatedMaster;

    // Lapis 2: Save to Local Cache
    saveDB(db);

    // Lapis 1: Realtime write to Firestore
    try {
      await pushItemToFirestoreCollection('master_data', 'config', updatedMaster);
    } catch (err) {
      console.warn('[MasterDataService] Firestore write queued:', err);
    }

    // Lapis 3: Background sync queue
    uploadDataBackground();

    // Auto-Backup
    googleAppsScriptService.triggerBackupToSheets(db).catch(() => {});

    return updatedMaster;
  },

  // 3. User Management (Clinical Users)
  getUsers(): User[] {
    const master = this.getMasterData();
    return master.users || [];
  },

  async saveUser(userData: User): Promise<User> {
    const db = getDB();
    if (!db.masterData) db.masterData = {} as MasterData;
    if (!Array.isArray(db.masterData.users)) db.masterData.users = [];

    const nowIso = new Date().toISOString();
    const userToSave: User = {
      ...userData,
      lastModified: nowIso
    };

    const idx = db.masterData.users.findIndex((u) => u.username === userToSave.username);
    if (idx > -1) {
      db.masterData.users[idx] = userToSave;
    } else {
      db.masterData.users.push(userToSave);
    }

    saveDB(db);

    try {
      await pushItemToFirestoreCollection('users', userToSave.username, userToSave);
    } catch (err) {
      console.warn('[MasterDataService] User write queued:', err);
    }

    uploadDataBackground();
    return userToSave;
  },

  async deleteUser(username: string): Promise<boolean> {
    const db = getDB();
    if (!db.masterData || !Array.isArray(db.masterData.users)) return false;

    registerDeletedId(`USER_${username}`);

    db.masterData.users = db.masterData.users.filter((u) => u.username !== username);
    saveDB(db);

    try {
      await deleteItemFromFirestoreCollection('users', username);
    } catch (err) {
      console.warn('[MasterDataService] Cloud user deletion warning:', err);
    }

    uploadDataBackground();
    return true;
  }
};
