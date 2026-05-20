
import { AppData, Patient, User, DailyReportEntry } from './types';
import { INITIAL_DATA } from './constants';

// Kunci database permanen untuk mencegah data hilang saat update kode
const DB_KEY = 'si_baru_db_stable_production_v5';
const API_URL_KEY = 'si_baru_api_url_stable';

/**
 * Registry for deleted record IDs to prevent resurrection during sync
 */
export const registerDeletedId = (id: string): void => {
    if (typeof window === 'undefined') return;
    try {
        const deleted = JSON.parse(localStorage.getItem('surgihub_deleted_ids') || '[]');
        if (!deleted.includes(id)) {
            deleted.push(id);
            localStorage.setItem('surgihub_deleted_ids', JSON.stringify(deleted));
        }
    } catch (e) {
        console.error('Failed to register deleted ID:', e);
    }
};

export const getDeletedIds = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem('surgihub_deleted_ids') || '[]');
    } catch (e) {
        return [];
    }
};

export const clearDeletedIds = (ids: string[]): void => {
    if (typeof window === 'undefined') return;
    try {
        const deleted = getDeletedIds();
        const filtered = deleted.filter(id => !ids.includes(id));
        localStorage.setItem('surgihub_deleted_ids', JSON.stringify(filtered));
    } catch (e) {
        console.error('Failed to clear deleted IDs:', e);
    }
};

/**
 * Migration logic for old schema fields
 */
const migrateSettings = (s: any) => {
    if (!s) return s;
    const newS = { ...s };
    if (s.wallpaperUrl && !s.appWallpaperUrl) newS.appWallpaperUrl = s.wallpaperUrl;
    if (s.wallpaperUrl && !s.loginWallpaperUrl) newS.loginWallpaperUrl = s.wallpaperUrl;
    if (!newS.settingsTimestamp) newS.settingsTimestamp = '2020-01-01T00:00:00.000Z';
    return newS;
};

/**
 * Logika Smart Merge (Anti-Loss)
 * Menggabungkan data lokal dan cloud tanpa menghapus yang sudah ada.
 */
export const mergeData = (local: AppData, cloud: AppData): AppData => {
    if (!cloud) return local;

    const mergeList = (localList: any[], cloudList: any[], key: string = 'id') => {
        if (!cloudList) return localList;

        const deletedIds = getDeletedIds();
        const merged: any[] = [];

        const localMap = new Map((localList || []).map(item => [String(item[key]), item]));
        const cloudMap = new Map((cloudList || []).map(item => [String(item[key]), item]));

        // 1. Process all cloud items
        cloudList.forEach(cloudItem => {
            const itemId = String(cloudItem[key]);

            // Skip if this item was explicitly deleted locally
            if (deletedIds.includes(itemId)) {
                return;
            }

            const localItem = localMap.get(itemId);
            if (localItem) {
                // Item exists in both local and cloud. Keep the newest one!
                const localLm = localItem.lastModified ? new Date(localItem.lastModified).getTime() : 0;
                const cloudLm = cloudItem.lastModified ? new Date(cloudItem.lastModified).getTime() : 0;

                if (localLm > cloudLm) {
                    merged.push(localItem);
                } else {
                    merged.push(cloudItem);
                }
            } else {
                // Item in cloud but not local
                merged.push(cloudItem);
            }
        });

        // 2. Process all local items not in cloud
        localList.forEach(localItem => {
            const itemId = String(localItem[key]);
            if (cloudMap.has(itemId)) return;

            // Skip if it was deleted
            if (deletedIds.includes(itemId)) return;

            // Decide if we keep this un-uploaded local item or if it was deleted on another device.
            // If local item’s update time is newer than cloud database stamp, we keep it as pending!
            // Otherwise, we discard it because it was deleted in the cloud.
            const cloudTs = cloud.timestamp ? new Date(cloud.timestamp).getTime() : 0;
            const localLm = localItem.lastModified ? new Date(localItem.lastModified).getTime() : 0;

            const idNum = parseInt(itemId.replace(/\D/g, ''));
            const isVeryRecent = !isNaN(idNum) && (Date.now() - idNum < 14400000); // 4 hours safety window

            if (localLm > cloudTs || isVeryRecent) {
                merged.push(localItem);
            }
        });

        return merged;
    };

    const mergedPatients = mergeList(local.patients || [], cloud.patients || []);
    
    const mergedDailyReports = (cloud.dailyReports || []).map(cr => {
        const localReport = (local.dailyReports || []).find(lr => lr.patientId === cr.patientId && lr.date === cr.date);
        if (!localReport) return cr;

        // Start with cloud data as the baseline
        const merged = { ...cr };
        
        // Merge specific fields from local if they are empty in cloud
        const fields: (keyof DailyReportEntry)[] = [
            'morningReport', 'morningTherapy', 'morningRecordedBy', 'morningDependency',
            'afternoonReport', 'afternoonTherapy', 'afternoonRecordedBy', 'afternoonDependency',
            'nightReport', 'nightTherapy', 'nightRecordedBy', 'nightDependency',
            'diagnosis'
        ];
        
        fields.forEach(f => {
            if (!cr[f] && localReport[f]) (merged as any)[f] = localReport[f];
        });
        
        return merged;
    });

    const mergedIncidentReports = mergeList(local.incidentReports || [], cloud.incidentReports || []);
    const mergedQualityMeasurements = mergeList(local.qualityMeasurements || [], cloud.qualityMeasurements || []);
    const mergedInstruments = mergeList(local.instruments || [], cloud.instruments || []);
    const mergedOperationReports = mergeList(local.operationReports || [], cloud.operationReports || []);
    const mergedFinanceRecords = mergeList(local.financeRecords || [], cloud.financeRecords || []);
    const mergedDoctorVisits = mergeList(local.doctorVisits || [], cloud.doctorVisits || []);

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

    const localSettings = migrateSettings(local.masterData?.settings || INITIAL_DATA.masterData.settings);
    const cloudSettings = migrateSettings(cloud.masterData?.settings);

    // Smart Merge for Settings based on timestamp & proactive sync
    let finalSettings = { ...localSettings };
    const localTs = new Date(localSettings.settingsTimestamp || '2000-01-01').getTime();
    const cloudTs = new Date(cloudSettings?.settingsTimestamp || '2000-01-01').getTime();

    // To prevent clock drift, timezone mismatches, or stale local configurations,
    // we check if the user on this device edited the theme very recently (last 15 seconds).
    // If not, we always adopt the cloud settings to guarantee 100% theme consistency across devices.
    const wasLocallyEditedJustNow = Math.abs(Date.now() - localTs) < 15000;

    if (cloudSettings) {
        if (wasLocallyEditedJustNow && localTs > cloudTs) {
            // User on this device just updated theme; keep local until upload completes
            finalSettings = { ...localSettings };
        } else {
            // Adopt cloud settings as the single global source of truth
            finalSettings = { ...cloudSettings };
        }
    }

    // Garbage collect elements in deletedIds registry that have vanished from the cloud
    const deletedIds = getDeletedIds();
    if (deletedIds.length > 0) {
        const cloudExistIds = new Set([
            ...(cloud.patients || []).map(p => String(p.id)),
            ...(cloud.incidentReports || []).map(i => String(i.id)),
            ...(cloud.doctorVisits || []).map(v => String(v.id))
        ]);
        const stillInCloud = deletedIds.filter(id => cloudExistIds.has(id));
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('surgihub_deleted_ids', JSON.stringify(stillInCloud));
            } catch (e) {}
        }
    }

    return {
        ...local,
        ...cloud,
        timestamp: new Date().toISOString(),
        patients: mergedPatients,
        dailyReports: mergedDailyReports,
        incidentReports: mergedIncidentReports,
        qualityMeasurements: mergedQualityMeasurements,
        instruments: mergedInstruments,
        operationReports: mergedOperationReports,
        financeRecords: mergedFinanceRecords,
        doctorVisits: mergedDoctorVisits,
        masterData: { 
            ...local.masterData,
            ...cloud.masterData, 
            settings: finalSettings,
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

    const seenUsers = new Set();
    const cleanUsers = (data.masterData?.users || []).filter(u => {
        if (!u || !u.username) return false;
        if (seenUsers.has(u.username)) return false;
        seenUsers.add(u.username);
        return true;
    });

    const seenVisits = new Set();
    const visits = data.doctorVisits || [];
    const cleanVisits = visits.filter(v => {
        if (!v || !v.id) return false;
        if (seenVisits.has(v.id)) return false;
        seenVisits.add(v.id);
        return true;
    });

    return { 
        ...data, 
        patients: cleanPatients,
        incidentReports: cleanIncidents,
        doctorVisits: cleanVisits,
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
      // Deep merge basic structure
      const baseData = { 
        ...INITIAL_DATA, 
        ...parsed,
        masterData: {
          ...INITIAL_DATA.masterData,
          ...parsed.masterData,
          settings: migrateSettings({
            ...INITIAL_DATA.masterData.settings,
            ...(parsed.masterData?.settings || {})
          })
        }
      };
      return cleanAndDeduplicate(baseData);
    } catch (e) { return INITIAL_DATA; }
  }
  return INITIAL_DATA;
};

export const saveDB = (data: AppData): void => {
  data.timestamp = new Date().toISOString();
  const cleanData = cleanAndDeduplicate(data);
  
  // Make a deep clone for localStorage to prevent mutating the in-memory/in-flight dataset
  let storageData: AppData;
  try {
    storageData = JSON.parse(JSON.stringify(cleanData));
  } catch (err) {
    storageData = { ...cleanData };
  }
  
  // Always strip raw/heavy base64 images from localStorage to prevent QuotaExceededError. 
  // Small public permanent URLs (like Drive links) are extremely small and safely stored.
  if (storageData.masterData?.settings) {
    if (storageData.masterData.settings.appWallpaperUrl?.startsWith('data:image/')) {
      storageData.masterData.settings.appWallpaperUrl = '';
    }
    if (storageData.masterData.settings.loginWallpaperUrl?.startsWith('data:image/')) {
      storageData.masterData.settings.loginWallpaperUrl = '';
    }
  }

  const serialized = JSON.stringify(storageData);
  
  try {
    localStorage.setItem(DB_KEY, serialized);
  } catch (error: any) {
    console.warn('LocalStorage save failed, running emergency clear:', error);
    if (storageData.masterData?.settings) {
      storageData.masterData.settings.appWallpaperUrl = '';
      storageData.masterData.settings.loginWallpaperUrl = '';
    }
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(storageData));
    } catch (retryError) {
      console.error('Critical Failure: Could not save even after emergency clearing.', retryError);
    }
  }
};

const getFriendlyErrorMessage = (error: any): string => {
  if (!error) return 'Terjadi kesalahan tidak dikenal.';
  const message = error.message || String(error);
  const msgLower = message.toLowerCase();
  
  if (
    msgLower.includes('failed to fetch') || 
    msgLower.includes('fetch failed') || 
    msgLower.includes('load failed') || 
    msgLower.includes('networkerror') || 
    msgLower.includes('network error')
  ) {
    return 'Koneksi ke server gagal. Pastikan jaringan internet aktif dan url sinkronisasi benar.';
  }
  
  if (msgLower.includes('timeout') || msgLower.includes('aborted')) {
    return 'Waktu koneksi habis (Timeout). Koneksi ke server terlalu lambat.';
  }
  
  return message;
};

export const getApiUrl = (): string => localStorage.getItem(API_URL_KEY) || '';
export const saveApiUrl = (url: string): void => localStorage.setItem(API_URL_KEY, url.trim());

export const syncData = async (forceDownload: boolean = false): Promise<{success: boolean, error?: string}> => {
  try {
    const apiUrl = getApiUrl();
    // Do not skip if empty; let the server-side handle fallback proxy for global sync.
    const response = await fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&t=${Date.now()}`, { 
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
        const errText = await response.text();
        console.error('Remote sync server error:', errText);
        return { success: false, error: `Sync Server Error: ${response.status}` };
    }

    const cloudResponse = await response.json();
    
    if (cloudResponse.error) {
        return { success: false, error: cloudResponse.error };
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
    return { success: false, error: getFriendlyErrorMessage(error) };
  }
};

export const uploadData = async (data?: AppData): Promise<{success: boolean, error?: string, data?: AppData}> => {
  try {
    const apiUrl = getApiUrl();
    // Do not skip if empty; let the server-side handle writing to the database cache cache.
    const db = data || getDB();
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: db, url: apiUrl })
    });
    
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { success: false, error: errData.error || `HTTP ${response.status}` };
    }

    const resData = await response.json().catch(() => ({}));
    if (resData && resData.success && resData.data) {
        saveDB(resData.data);
        return { success: true, data: resData.data };
    }

    return { success: true, data: db };
  } catch (e: any) { 
    console.error('Upload error:', e);
    return { success: false, error: getFriendlyErrorMessage(e) }; 
  }
};

let uploadTimer: any = null;
let isCurrentlyUploading = false;

export const uploadDataBackground = () => {
    if (uploadTimer) clearTimeout(uploadTimer);
    uploadTimer = setTimeout(async () => {
        if (isCurrentlyUploading) {
            // Re-schedule if already busy
            uploadDataBackground();
            return;
        }
        isCurrentlyUploading = true;
        try {
            await uploadData();
        } catch (e) {
            console.error('Background upload failed');
        } finally {
            isCurrentlyUploading = false;
        }
    }, 1000); // Reduce delay to 1 second for more responsive sync
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
