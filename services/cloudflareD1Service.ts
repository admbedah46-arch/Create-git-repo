import { CLOUDFLARE_D1_API, fetchFromCloudflareD1 } from './databaseConfig';
import { getDB, saveDB } from '../db';
import { MasterData, RoomBooking, InventoryItem } from '../types';

/**
 * Cloudflare D1 + Workers Service
 * High-Traffic Read-Heavy API Endpoint (Master ICD-10, Katalog Kamar Bedah, Daftar DPJP, & Master Inventaris)
 * Leverages free 5 Million Read Requests/day tier with local IndexedDB Cache-First layer
 */

const CACHE_KEYS = {
  ICD10: 'simantap_cache_icd10',
  DPJP: 'simantap_cache_dpjp',
  ROOMS: 'simantap_cache_rooms',
  INSTRUMENTS: 'simantap_cache_instruments',
};

export const cloudflareD1Service = {
  // 1. Fetch Master ICD-10 Catalog (Cache-First)
  async getIcd10Master(): Promise<{ code: string; name: string }[]> {
    // Check IndexedDB / Local Cache First
    const db = getDB();
    if (db.masterData?.icd10List && db.masterData.icd10List.length > 0) {
      console.log('[Cloudflare D1 Cache] Loaded ICD-10 from local cache');
      this.refreshIcd10Background();
      return db.masterData.icd10List;
    }

    // Try API Fetch
    const data = await fetchFromCloudflareD1('/api/icd10');
    if (data && Array.isArray(data.items)) {
      db.masterData.icd10List = data.items;
      saveDB(db);
      return data.items;
    }

    return db.masterData?.icd10List || [];
  },

  async refreshIcd10Background() {
    try {
      const data = await fetchFromCloudflareD1('/api/icd10');
      if (data && Array.isArray(data.items)) {
        const db = getDB();
        db.masterData.icd10List = data.items;
        saveDB(db);
      }
    } catch (e) {
      // Silent cache refresh fail
    }
  },

  // 2. Fetch DPJP List (Doctors)
  async getDpjpList(): Promise<string[]> {
    const db = getDB();
    if (db.masterData?.dpjpList && db.masterData.dpjpList.length > 0) {
      return db.masterData.dpjpList;
    }

    const data = await fetchFromCloudflareD1('/api/dpjp');
    if (data && Array.isArray(data.items)) {
      db.masterData.dpjpList = data.items;
      saveDB(db);
      return data.items;
    }

    return db.masterData?.dpjpList || [];
  },

  // 3. Fetch Operating Room Catalog (Katalog Kamar Bedah)
  async getRoomsCatalog(): Promise<string[]> {
    const db = getDB();
    if (db.masterData?.kamarList && db.masterData.kamarList.length > 0) {
      return db.masterData.kamarList;
    }

    const data = await fetchFromCloudflareD1('/api/rooms');
    if (data && Array.isArray(data.items)) {
      db.masterData.kamarList = data.items;
      saveDB(db);
      return data.items;
    }

    return db.masterData?.kamarList || ['OK 1 (Major)', 'OK 2 (Major)', 'OK 3 (Minor)', 'OK 4 (Emergency)'];
  },

  // 4. Fetch Master Surgical Instruments (Inventaris Alat)
  async getInstrumentsCatalog(): Promise<InventoryItem[]> {
    const db = getDB();
    if (db.instruments && db.instruments.length > 0) {
      return db.instruments;
    }

    const data = await fetchFromCloudflareD1('/api/instruments');
    if (data && Array.isArray(data.items)) {
      db.instruments = data.items;
      saveDB(db);
      return data.items;
    }

    return db.instruments || [];
  }
};
