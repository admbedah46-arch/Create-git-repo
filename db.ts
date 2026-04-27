
import { AppData, Patient, User } from './types';
import { INITIAL_DATA } from './constants';

// Kunci database permanen untuk mencegah data hilang saat update kode
const DB_KEY = 'si_baru_db_stable_production_v5';
const API_URL_KEY = 'si_baru_api_url_stable';

/**
 * Logika Smart Merge (Anti-Loss)
 * Menggabungkan data lokal dan cloud tanpa menghapus yang sudah ada.
 */
export const mergeData = (local: AppData, cloud: AppData): AppData => {
    if (!cloud) return local;

    // Logic: If an item exists in cloud but NOT in local, it might be deleted locally OR added by others.
    // To minimize "reappearing deleted items", we use a simple heuristic: 
    // If the cloud's item is very old (ID is much smaller than local's max ID), it might be a deletion.
    // Actually, a better way for this prototype is: Trust current local list as the "source of structure" 
    // but update existing items with cloud data.
    
    const mergeList = (localList: any[], cloudList: any[], key: string = 'id') => {
        const merged = [...localList];
        if (!cloudList) return merged;

            cloudList.forEach(item => {
            const idx = merged.findIndex(l => l[key] === item[key]);
            if (idx === -1) {
                merged.push(item);
            } else {
                // Priority: Local (merged[idx]) over Cloud (item) to prevent reverts
                merged[idx] = { ...item, ...merged[idx] };
            }
        });
        return merged;
    };

    const mergedPatients = mergeList(local.patients || [], cloud.patients || []);
    
    const mergedDailyReports = [...(local.dailyReports || [])];
    if (cloud.dailyReports) {
        cloud.dailyReports.forEach(cr => {
            const idx = mergedDailyReports.findIndex(lr => lr.patientId === cr.patientId && lr.date === cr.date);
            if (idx === -1) mergedDailyReports.push(cr);
            else {
                // Priority: Local over Cloud
                mergedDailyReports[idx] = { ...cr, ...mergedDailyReports[idx] };
            }
        });
    }

    const mergedIncidentReports = mergeList(local.incidentReports || [], cloud.incidentReports || []);
    const mergedQualityMeasurements = mergeList(local.qualityMeasurements || [], cloud.qualityMeasurements || []);
    const mergedInstruments = mergeList(local.instruments || [], cloud.instruments || []);
    const mergedOperationReports = mergeList(local.operationReports || [], cloud.operationReports || []);
    const mergedFinanceRecords = mergeList(local.financeRecords || [], cloud.financeRecords || []);

    const mergedUsers = [...(local.masterData?.users || [])];
    if (cloud.masterData?.users) {
        cloud.masterData.users.forEach(cu => {
            const idx = mergedUsers.findIndex(lu => lu.username === cu.username);
            if (idx === -1) mergedUsers.push(cu);
            else {
                // Priority: Local over Cloud
                mergedUsers[idx] = { ...cu, ...mergedUsers[idx] };
            }
        });
    }

    return {
        ...INITIAL_DATA,
        ...cloud,
        timestamp: new Date().toISOString(),
        patients: mergedPatients,
        dailyReports: mergedDailyReports,
        incidentReports: mergedIncidentReports,
        qualityMeasurements: mergedQualityMeasurements,
        instruments: mergedInstruments,
        operationReports: mergedOperationReports,
        financeRecords: mergedFinanceRecords,
        masterData: { 
            ...INITIAL_DATA.masterData, 
            ...cloud.masterData, 
            users: mergedUsers 
        }
    };
};

export const cleanAndDeduplicate = (data: AppData): AppData => {
    if (!data) return INITIAL_DATA;
    
    const seenPatients = new Set();
    const patients = data.patients || [];
    const cleanPatients = patients.filter(p => {
        if (!p || !p.id) return false;
        if (seenPatients.has(p.id)) return false;
        seenPatients.add(p.id);
        return true;
    });

    const seenIncidents = new Set();
    const incidents = data.incidentReports || [];
    const cleanIncidents = incidents.filter(i => {
        if (!i || !i.id) return false;
        if (seenIncidents.has(i.id)) return false;
        seenIncidents.add(i.id);
        return true;
    });

    const cleanUsers = (data.masterData?.users || []).filter((u, index, self) => 
        index === self.findIndex((t) => t.username === u.username)
    );

    return { 
        ...data, 
        patients: cleanPatients,
        incidentReports: cleanIncidents,
        masterData: {
            ...data.masterData,
            users: cleanUsers
        }
    };
};

export const getDB = (): AppData => {
  const existing = localStorage.getItem(DB_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      return cleanAndDeduplicate({ ...INITIAL_DATA, ...parsed });
    } catch (e) { return INITIAL_DATA; }
  }
  return INITIAL_DATA;
};

export const saveDB = (data: AppData): void => {
  data.timestamp = new Date().toISOString();
  localStorage.setItem(DB_KEY, JSON.stringify(cleanAndDeduplicate(data)));
};

export const getApiUrl = (): string => localStorage.getItem(API_URL_KEY) || '';
export const saveApiUrl = (url: string): void => localStorage.setItem(API_URL_KEY, url.trim());

export const syncData = async (forceDownload: boolean = false): Promise<{success: boolean, error?: string}> => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&t=${Date.now()}`, { cache: 'no-store' });
    const cloudResponse = await response.json();
    
    if (response.status >= 500 || cloudResponse.error) {
        return { success: false, error: cloudResponse.error || 'Server error' };
    }

    // If we have data from cloud, merge it
    if (cloudResponse && (cloudResponse.status === 'success' || cloudResponse.status === 'ready') && cloudResponse.data) {
        const localData = getDB();
        const merged = mergeData(localData, cloudResponse.data);
        saveDB(merged);
        if (!forceDownload) await uploadData();
        return { success: true };
    }

    // If cloud is empty or unconfigured, we might want to upload our local data
    if (!forceDownload) await uploadData();
    return { success: true };
  } catch (error: any) {
    console.error('Sync error:', error);
    return { success: false, error: error.message };
  }
};

export const uploadData = async (data?: AppData): Promise<{success: boolean, error?: string}> => {
  try {
    const db = data || getDB();
    const apiUrl = getApiUrl();
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: db, url: apiUrl })
    });
    
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { success: false, error: errData.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (e: any) { 
    return { success: false, error: e.message }; 
  }
};

let uploadTimer: any = null;
export const uploadDataBackground = () => {
    if (uploadTimer) clearTimeout(uploadTimer);
    uploadTimer = setTimeout(() => uploadData(), 2000);
};

export const authenticate = (username: string, password: string): User | null => {
  const db = getDB();
  return db.masterData.users.find(u => u.username === username && u.password === password) || null;
};

export const createPatient = async (patient: Omit<Patient, 'id'>): Promise<Patient> => {
  const db = getDB();
  const newPatient: Patient = { ...patient, id: Date.now().toString() };
  db.patients.push(newPatient);
  saveDB(db);
  uploadDataBackground();
  return newPatient;
};

export const updatePatient = async (id: string, updates: Partial<Patient>): Promise<Patient | null> => {
  const db = getDB();
  const idx = db.patients.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return null;
  db.patients[idx] = { ...db.patients[idx], ...updates };
  saveDB(db);
  uploadDataBackground();
  return db.patients[idx];
};
