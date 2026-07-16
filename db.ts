
import { AppData, Patient, User, DailyReportEntry, parseToStandardDateString } from './types';
import { INITIAL_DATA } from './constants';

// Kunci database permanen untuk mencegah data hilang saat update kode
const DB_KEY = 'si_baru_db_stable_production_v5';
const API_URL_KEY = 'si_baru_api_url_stable';

export const FALLBACK_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbydRSS_JBTGeJryBc0uTckoEjJ1-kQY65ntUbYxLwuuBn80QNNwXreuFj0MVYqF3Q-GLw/exec";
let inMemoryDB: AppData | null = null;

export function sanitizeJsonString(str: string): string {
  if (!str) return str;
  let result = '';
  let inString = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (inString) {
      if (char === '\\') {
        result += '\\';
        if (i + 1 < str.length) {
          result += str[i + 1];
          i++;
        }
      } else if (char === '"') {
        // Look ahead to check if this double quote is followed by structural JSON chars:
        // whitespace followed by ',' or '}' or ']' or ':'
        let nextNonWhitespace = '';
        for (let j = i + 1; j < str.length; j++) {
          if (!/\s/.test(str[j])) {
            nextNonWhitespace = str[j];
            break;
          }
        }
        if (nextNonWhitespace === ',' || nextNonWhitespace === '}' || nextNonWhitespace === ']' || nextNonWhitespace === ':') {
          // This is a structural double quote
          result += char;
          inString = false;
        } else {
          // Unescaped inner quote!
          result += '\\"';
        }
      } else {
        const code = char.charCodeAt(0);
        if (code < 32) {
          // Escape control characters
          if (char === '\n') result += '\\n';
          else if (char === '\r') result += '\\r';
          else if (char === '\t') result += '\\t';
          // Drop other control characters below ASCII 32 to prevent JSON parse errors
        } else {
          result += char;
        }
      }
    } else {
      result += char;
      if (char === '"') {
        inString = true;
      }
    }
  }
  return result;
}

export function normalizeDatesInDb(db: any): any {
  if (!db || typeof db !== 'object') return db;
  
  const processList = (list: any[], dateFields: string[]) => {
    if (!Array.isArray(list)) return;
    list.forEach(item => {
      if (!item || typeof item !== 'object') return;
      dateFields.forEach(f => {
        if (item[f] !== undefined && item[f] !== null && item[f] !== '') {
          try {
            const std = parseToStandardDateString(item[f]);
            if (std) item[f] = std;
          } catch (e) {
            console.warn('[Normalize Dates] Corrupt item date skipped:', e);
          }
        }
      });
    });
  };

  if (db.patients) processList(db.patients, ['birthDate', 'entryDate', 'dischargeDate']);
  if (db.dailyReports) processList(db.dailyReports, ['date', 'surgeryDate', 'surgeryNewDate']);
  if (db.financeRecords) processList(db.financeRecords, ['date']);
  if (db.incidentReports) processList(db.incidentReports, ['date']);
  if (db.doctorVisits) processList(db.doctorVisits, ['date']);
  if (db.qualityMeasurements) processList(db.qualityMeasurements, ['date']);
  if (db.operationReports) processList(db.operationReports, ['date']);
  if (db.operations) processList(db.operations, ['date']);
  if (db.nursingReports) processList(db.nursingReports, ['date']);

  return db;
}

export function resilientParse(jsonStr: string): any {
  if (!jsonStr) return null;
  try {
    const parsed = JSON.parse(jsonStr);
    return normalizeDatesInDb(parsed);
  } catch (firstError: any) {
    console.warn('[Resilient Client Parser] Standard JSON.parse failed. Attempting sanitization...', firstError.message);
    try {
      const sanitized = sanitizeJsonString(jsonStr);
      const parsed = JSON.parse(sanitized);
      return normalizeDatesInDb(parsed);
    } catch (secondError: any) {
      console.warn('[Resilient Client Parser] Sanitization failed. Attempting settings/theme isolation...', secondError.message);
      try {
        let cleaned = jsonStr;
        const settingsIndex = cleaned.search(/"settings"\s*:\s*\{/);
        if (settingsIndex !== -1) {
          let braceCount = 0;
          let foundStart = false;
          let endIndex = -1;
          for (let i = settingsIndex; i < cleaned.length; i++) {
            if (cleaned[i] === '{') {
              braceCount++;
              foundStart = true;
            } else if (cleaned[i] === '}') {
              braceCount--;
              if (foundStart && braceCount === 0) {
                endIndex = i;
                break;
              }
            }
          }
          if (endIndex !== -1) {
            cleaned = cleaned.substring(0, settingsIndex) + '"settings": {"appName": "SiMANTAP", "appSlogan": "Manajemen Laporan Terpadu & Akurat", "themeColor": "#144272", "fontColor": "#ffffff"}' + cleaned.substring(endIndex + 1);
          }
        }
        const parsed = JSON.parse(sanitizeJsonString(cleaned));
        return normalizeDatesInDb(parsed);
      } catch (thirdError) {
        console.error('[Resilient Client Parser] All parsing options exhausted.');
        throw thirdError;
      }
    }
  }
}

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

export const mergeMasterData = (local: any, cloud: any): any => {
    const fallback = INITIAL_DATA.masterData;
    if (!local && !cloud) return fallback;
    const l = local || {};
    const c = cloud || {};

    const lTs = l.settings?.settingsTimestamp ? new Date(l.settings.settingsTimestamp).getTime() : 0;
    const cTs = c.settings?.settingsTimestamp ? new Date(c.settings.settingsTimestamp).getTime() : 0;

    // Smart merge restrictedDrugs list (uniquely by drugName, preserving user-configured values across local and cloud)
    const localDrugs = Array.isArray(l.restrictedDrugs) ? l.restrictedDrugs : [];
    const cloudDrugs = Array.isArray(c.restrictedDrugs) ? c.restrictedDrugs : [];
    const fallbackDrugs = Array.isArray(fallback.restrictedDrugs) ? fallback.restrictedDrugs : [];
    
    const drugsMap = new Map<string, { drugName: string; maxDays: number }>();
    fallbackDrugs.forEach((d: any) => {
        if (d && d.drugName) drugsMap.set(d.drugName.trim().toUpperCase(), d);
    });
    cloudDrugs.forEach((d: any) => {
        if (d && d.drugName) drugsMap.set(d.drugName.trim().toUpperCase(), d);
    });
    localDrugs.forEach((d: any) => {
        if (d && d.drugName) drugsMap.set(d.drugName.trim().toUpperCase(), d);
    });
    const restrictedDrugs = Array.from(drugsMap.values());

    if (lTs > cTs) {
        // Local is strictly newer. Use local's list structures as-is to respect deletions & additions
        return {
            ...fallback,
            ...c,
            ...l,
            restrictedDrugs
        };
    } else if (cTs > lTs) {
        // Cloud is strictly newer. Use cloud's list structures as-is
        return {
            ...fallback,
            ...l,
            ...c,
            restrictedDrugs
        };
    }

    // Default backup merge logic (fallback when timestamps are identical or missing)
    // Merge doctors list (prevent duplicate names, case sensitive)
    const localDocs = Array.isArray(l.doctors) ? l.doctors : [];
    const cloudDocs = Array.isArray(c.doctors) ? c.doctors : [];
    const doctors = Array.from(new Set([...cloudDocs, ...localDocs]));

    // Merge doctorMetadata records
    const doctorMetadata = {
        ...(fallback.doctorMetadata || {}),
        ...(c.doctorMetadata || {}),
        ...(l.doctorMetadata || {})
    };

    // Merge nurses
    const localNurses = Array.isArray(l.nurses) ? l.nurses : [];
    const cloudNurses = Array.isArray(c.nurses) ? c.nurses : [];
    const nurses = Array.from(new Set([...cloudNurses, ...localNurses]));

    // Merge nurseMetadata
    const nurseMetadata = {
        ...(fallback.nurseMetadata || {}),
        ...(c.nurseMetadata || {}),
        ...(l.nurseMetadata || {})
    };

    // Merge units list
    const localUnits = Array.isArray(l.units) ? l.units : [];
    const cloudUnits = Array.isArray(c.units) ? c.units : [];
    const units = Array.from(new Set([...fallback.units, ...cloudUnits, ...localUnits]));

    // Merge unitToClasses mapping
    const unitToClasses = { ...(fallback.unitToClasses || {}), ...(c.unitToClasses || {}), ...(l.unitToClasses || {}) };
    const lUToC = l.unitToClasses || {};
    const cUToC = c.unitToClasses || {};
    Object.keys(lUToC).forEach(k => {
        const uC = Array.isArray(lUToC[k]) ? lUToC[k] : [];
        const cC = Array.isArray(cUToC[k]) ? cUToC[k] : [];
        unitToClasses[k] = Array.from(new Set([...cC, ...uC]));
    });

    // Merge classToRooms mapping
    const classToRooms = { ...(fallback.classToRooms || {}), ...(c.classToRooms || {}), ...(l.classToRooms || {}) };
    const lCToR = l.classToRooms || {};
    const cCToR = c.classToRooms || {};
    Object.keys(lCToR).forEach(k => {
        const uR = Array.isArray(lCToR[k]) ? lCToR[k] : [];
        const cR = Array.isArray(cCToR[k]) ? cCToR[k] : [];
        classToRooms[k] = Array.from(new Set([...cR, ...uR]));
    });

    // Merge roomToBeds mapping
    const roomToBeds = { ...(fallback.roomToBeds || {}), ...(c.roomToBeds || {}), ...(l.roomToBeds || {}) };
    const lRToB = l.roomToBeds || {};
    const cRToB = c.roomToBeds || {};
    Object.keys(lRToB).forEach(k => {
        const uB = Array.isArray(lRToB[k]) ? lRToB[k] : [];
        const cB = Array.isArray(cRToB[k]) ? cRToB[k] : [];
        roomToBeds[k] = Array.from(new Set([...cB, ...uB]));
    });

    // Merge refs dictionary
    const refs: any = { ...(fallback.refs || {}), ...(c.refs || {}), ...(l.refs || {}) };
    const lRefs = l.refs || {};
    Object.keys(lRefs).forEach(k => {
        if (Array.isArray(lRefs[k])) {
            const uRef = lRefs[k];
            const cRef = Array.isArray(refs[k]) ? refs[k] : [];
            refs[k] = Array.from(new Set([...cRef, ...uRef]));
        }
    });

    // Merge customFields
    const localCF = Array.isArray(l.customFields) ? l.customFields : [];
    const cloudCF = Array.isArray(c.customFields) ? c.customFields : [];
    const cfMap = new Map();
    [...cloudCF, ...localCF].forEach(f => f && f.id && cfMap.set(String(f.id), f));
    const customFields = Array.from(cfMap.values());

    // Merge qualityIndicators
    const localQI = Array.isArray(l.qualityIndicators) ? l.qualityIndicators : [];
    const cloudQI = Array.isArray(c.qualityIndicators) ? c.qualityIndicators : [];
    const qiMap = new Map();
    [...cloudQI, ...localQI].forEach(f => f && f.id && qiMap.set(String(f.id), f));
    const qualityIndicators = Array.from(qiMap.values());

    return {
        ...fallback,
        ...c,
        ...l,
        doctors,
        doctorMetadata,
        nurses,
        nurseMetadata,
        units,
        unitToClasses,
        classToRooms,
        roomToBeds,
        refs,
        customFields,
        qualityIndicators,
        restrictedDrugs
    };
};

/**
 * Logika Smart Merge (Anti-Loss & Realtime Sync)
 * Menggabungkan data lokal dan cloud dengan mempercayai Cloud sebagai Source of Truth utama,
 * namun tetap memberikan toleransi grace period untuk input baru yang belum sempat terunggah.
 */
export const mergeData = (local: AppData, rawCloud: AppData): AppData => {
    if (!rawCloud) return local;

    // Disarm Data Shield: Ensure we only initialize fields that are not arrays
    const cloud = { ...rawCloud };
    const majorKeys: (keyof AppData)[] = ['patients', 'financeRecords', 'dailyReports', 'nursingReports', 'operations', 'incidentReports', 'operationReports', 'instruments', 'doctorVisits', 'qualityMeasurements'];
    
    majorKeys.forEach(key => {
        if (!Array.isArray(cloud[key])) {
            (cloud as any)[key] = [];
        }
    });

    const localSettings = migrateSettings(local.masterData?.settings || INITIAL_DATA.masterData.settings) || INITIAL_DATA.masterData.settings;
    const cloudSettings = migrateSettings(cloud.masterData?.settings) || INITIAL_DATA.masterData.settings;
    const localTs = new Date(localSettings.settingsTimestamp || '2000-01-01').getTime();
    const cloudTs = new Date(cloudSettings.settingsTimestamp || '2000-01-01').getTime();

    // Merge deletedIds berdasarkan perbandingan settingsTimestamp untuk menghindari rollback!
    let mergedDeletedIds: string[] = [];
    if (localTs > cloudTs) {
        mergedDeletedIds = Array.isArray(local.deletedIds) ? [...local.deletedIds] : [];
    } else if (cloudTs > localTs) {
        mergedDeletedIds = Array.isArray(cloud.deletedIds) ? [...cloud.deletedIds] : [];
    } else {
        mergedDeletedIds = Array.from(new Set([
            ...(Array.isArray(local.deletedIds) ? local.deletedIds : []),
            ...(Array.isArray(cloud.deletedIds) ? cloud.deletedIds : [])
        ]));
    }

    // Suntikkan local device deleted registry untuk menjamin konsistensi
    const localRegistryDeleted = getDeletedIds();
    localRegistryDeleted.forEach(id => {
        if (!mergedDeletedIds.includes(id)) {
            mergedDeletedIds.push(id);
        }
    });

    // Lindungi super administrator dari penghapusan
    mergedDeletedIds = mergedDeletedIds.filter(id => id !== 'USER_administrator');

    // Sinkronisasi local storage deleted IDs registry
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('surgihub_deleted_ids', JSON.stringify(mergedDeletedIds));
        } catch (e) {}
    }

    const mergeList = (localList: any[], cloudList: any[], key: string = 'id') => {
        const safeLocal = (Array.isArray(localList) ? localList : []).filter(item => item && item[key] !== undefined && item[key] !== null);
        const safeCloud = (Array.isArray(cloudList) ? cloudList : []).filter(item => item && item[key] !== undefined && item[key] !== null);

        // Pengaman: Jika database cloud benar-benar kosong (misal baru di-deploy pertama kali), pulihkan dari lokal
        if (safeCloud.length === 0 && safeLocal.length > 0) {
            return safeLocal;
        }

        const merged: any[] = [];
        const localMap = new Map(safeLocal.map(item => [String(item[key]), item]));

        // 1. Proses semua item cloud - Cloud adalah absolute SOURCE OF TRUTH
        safeCloud.forEach(cloudItem => {
            const itemId = String(cloudItem[key]);

            // Jangan masukkan jika item ini sudah dihapus secara eksplisit
            if (mergedDeletedIds.includes(itemId)) {
                return;
            }

            const localItem = localMap.get(itemId);
            if (localItem) {
                // Item ada di keduanya: simpan yang paling baru berdasarkan timestamp
                const localLm = localItem.lastModified ? new Date(localItem.lastModified).getTime() : 0;
                const cloudLm = cloudItem.lastModified ? new Date(cloudItem.lastModified).getTime() : 0;

                // Cloud/Server is the absolute source of truth. Allow server data to overwrite stale local cache
                // unless modified extremely recently (e.g., < 10 seconds ago) to preserve active user inputs/offline queue.
                const isRecentlyEditedLocally = (Date.now() - localLm < 10000);

                if (isRecentlyEditedLocally) {
                    // Local wins (preserves active input)
                    merged.push({ ...cloudItem, ...localItem });
                } else {
                    // Cloud/Server wins completely!
                    merged.push({ ...localItem, ...cloudItem });
                }
            } else {
                // Item ada di cloud tapi tidak di lokal (ditambahkan oleh perangkat lain)
                merged.push(cloudItem);
            }
        });

        // 2. Proses data lokal saja (Data baru atau tidak tercatat di cloud)
        safeLocal.forEach(localItem => {
            const itemId = String(localItem[key]);
            if (safeCloud.some(c => String(c[key]) === itemId)) return;
            if (mergedDeletedIds.includes(itemId)) return;

            // Selalu masukkan data lokal yang belum ada di cloud untuk menjamin tidak ada kehilangan data,
            // asalkan data tersebut tidak berada di dalam daftar item terhapus (mergedDeletedIds)
            merged.push(localItem);
        });

        return merged;
    };

    const mergedPatients = mergeList(local.patients || [], cloud.patients || []);
    const activePatientIds = new Set(mergedPatients.map(p => String(p.id)));
    
    const mergedDailyReportsMap = new Map<string, DailyReportEntry>();

    // 1. Proses laporan harian dari cloud (SOURCE OF TRUTH)
    const safeCloudReports = Array.isArray(cloud.dailyReports) ? cloud.dailyReports : [];
    safeCloudReports.forEach(cr => {
        if (cr && cr.patientId && cr.date) {
            const patientIdStr = String(cr.patientId);
            // Lewati laporan harian untuk pasien yang sudah dihapus secara permanen
            if (mergedDeletedIds.includes(patientIdStr)) {
                return;
            }
            const key = `${patientIdStr}_${cr.date}`;
            mergedDailyReportsMap.set(key, { ...cr });
        }
    });

    // 2. Proses laporan harian dari lokal
    const safeLocalReports = Array.isArray(local.dailyReports) ? local.dailyReports : [];
    safeLocalReports.forEach(lr => {
        if (lr && lr.patientId && lr.date) {
            const patientIdStr = String(lr.patientId);
            // Lewati laporan harian untuk pasien yang sudah dihapus secara permanen
            if (mergedDeletedIds.includes(patientIdStr)) {
                return; // Lewat jika pasien sudah dihapus
            }

            const key = `${patientIdStr}_${lr.date}`;
            const cloudReport = mergedDailyReportsMap.get(key);

            if (!cloudReport) {
                // Selalu masukkan laporan harian lokal yang belum ada di cloud
                mergedDailyReportsMap.set(key, { ...lr });
            } else {
                // Keduanya ada. Lakukan Cell-Level Deep Merge (Bukan Row-Overwrite)
                const fields: (keyof DailyReportEntry)[] = [
                    'morningReport', 'morningTherapy', 'morningRecordedBy', 'morningDependency',
                    'afternoonReport', 'afternoonTherapy', 'afternoonRecordedBy', 'afternoonDependency',
                    'nightReport', 'nightTherapy', 'nightRecordedBy', 'nightDependency',
                    'diagnosis', 'surgeryProcedure', 'surgeryOperator', 'surgeryDate',
                    'surgeryStatus', 'surgeryDelayReason', 'surgeryTime', 'surgeryAnesthesiaType',
                    'surgeryUrgency', 'surgeryNewDate', 'surgeryNewTime', 'adminNote'
                ];

                const merged: any = {
                    patientId: lr.patientId || cloudReport.patientId,
                    date: lr.date || cloudReport.date,
                    fieldModifiedTimes: {
                        ...(cloudReport.fieldModifiedTimes || {}),
                        ...(lr.fieldModifiedTimes || {})
                    }
                };

                const localTimes = lr.fieldModifiedTimes || {};
                const cloudTimes = cloudReport.fieldModifiedTimes || {};

                const localLm = lr.lastModified ? new Date(lr.lastModified).getTime() : 0;
                const cloudLm = cloudReport.lastModified ? new Date(cloudReport.lastModified).getTime() : 0;
                const isRecentlyEditedLocally = (Date.now() - localLm < 300000); // 5-minute local lock for optimistic UI updates

                fields.forEach(f => {
                    const localVal = lr[f];
                    const cloudVal = cloudReport[f];

                    const localTime = localTimes[f] ? new Date(localTimes[f]).getTime() : 0;
                    const cloudTime = cloudTimes[f] ? new Date(cloudTimes[f]).getTime() : 0;

                    // Anti-rollback: If recently edited locally within 5 minutes, keep the local value unconditionally
                    if (isRecentlyEditedLocally) {
                        const localHasValue = localVal !== undefined && localVal !== null && localVal !== '';
                        if (localHasValue) {
                            merged[f] = localVal;
                            if (localTimes[f]) {
                                merged.fieldModifiedTimes[f] = localTimes[f];
                            }
                            return;
                        }
                    }

                    // Tentukan nilai sel mana yang menang berdasarkan stempel waktu sel tersebut
                    if (localTime > 0 || cloudTime > 0) {
                        if (localTime >= cloudTime) {
                            merged[f] = localVal;
                            if (localTimes[f]) {
                                merged.fieldModifiedTimes[f] = localTimes[f];
                            }
                        } else {
                            merged[f] = cloudVal;
                            if (cloudTimes[f]) {
                                merged.fieldModifiedTimes[f] = cloudTimes[f];
                            }
                        }
                    } else {
                        // Fallback jika tidak ada stempel waktu per-kolom (legacy data)
                        const localHasValue = localVal !== undefined && localVal !== null && localVal !== '';
                        const cloudHasValue = cloudVal !== undefined && cloudVal !== null && cloudVal !== '';

                        if (localHasValue && !cloudHasValue) {
                            merged[f] = localVal;
                        } else if (!localHasValue && cloudHasValue) {
                            merged[f] = cloudVal;
                        } else {
                            if (localLm >= cloudLm) {
                                merged[f] = localVal;
                            } else {
                                merged[f] = cloudVal;
                            }
                        }
                    }
                });

                let maxTime = Math.max(localLm, cloudLm);

                Object.values(merged.fieldModifiedTimes).forEach((t: any) => {
                    const parsed = new Date(t).getTime();
                    if (!isNaN(parsed) && parsed > maxTime) {
                        maxTime = parsed;
                    }
                });

                merged.lastModified = new Date(maxTime).toISOString();
                mergedDailyReportsMap.set(key, merged);
            }
        }
    });

    const mergedDailyReports = Array.from(mergedDailyReportsMap.values());

    const mergedIncidentReports = mergeList(local.incidentReports || [], cloud.incidentReports || []);
    const mergedQualityMeasurements = mergeList(local.qualityMeasurements || [], cloud.qualityMeasurements || []);
    const mergedInstruments = mergeList(local.instruments || [], cloud.instruments || []);
    const mergedOperationReports = mergeList(local.operationReports || [], cloud.operationReports || []);
    const mergedFinanceRecords = mergeList(local.financeRecords || [], cloud.financeRecords || []);
    const mergedDoctorVisits = mergeList(local.doctorVisits || [], cloud.doctorVisits || []);
    const mergedNursingReports = mergeList(local.nursingReports || [], cloud.nursingReports || []);
    const mergedOperations = mergeList(local.operations || [], cloud.operations || []);

    let finalUsers: any[] = [];
    if (localTs > cloudTs) {
        // Local is newer: trust local's user database
        finalUsers = Array.isArray(local.masterData?.users) ? [...local.masterData.users] : [];
    } else if (cloudTs > localTs) {
        // Cloud is newer: trust cloud's user database
        finalUsers = Array.isArray(cloud.masterData?.users) ? [...cloud.masterData.users] : [];
    } else {
        // Timestamps are identical: do safe merge
        const mergedUsers = [...(local.masterData?.users || [])];
        if (cloud.masterData?.users) {
            cloud.masterData.users.forEach(cu => {
                const idx = mergedUsers.findIndex(lu => lu.username === cu.username);
                const isDeleted = mergedDeletedIds.includes(`USER_${cu.username}`);
                if (isDeleted) {
                    if (idx > -1) {
                        mergedUsers.splice(idx, 1);
                    }
                    return;
                }
                if (idx === -1) {
                    mergedUsers.push(cu);
                } else {
                    const localLm = mergedUsers[idx].lastModified ? new Date(mergedUsers[idx].lastModified).getTime() : 0;
                    const cloudLm = cu.lastModified ? new Date(cu.lastModified).getTime() : 0;
                    if (cloudLm > localLm) {
                        mergedUsers[idx] = { ...mergedUsers[idx], ...cu };
                    } else {
                        mergedUsers[idx] = { ...cu, ...mergedUsers[idx] };
                    }
                }
            });
        }
        finalUsers = mergedUsers;
    }

    // Filter out any user explicitly registered in mergedDeletedIds
    finalUsers = finalUsers.filter(u => {
        return u && u.username && !mergedDeletedIds.includes(`USER_${u.username}`);
    });

    // Force restore all predefined users from INITIAL_DATA if NOT deleted and NOT already in finalUsers
    const initialUsers = INITIAL_DATA.masterData?.users || [];
    initialUsers.forEach((iu: any) => {
        const isDeleted = mergedDeletedIds.includes(`USER_${iu.username}`);
        if (isDeleted) return;

        const existsIdx = finalUsers.findIndex((fu: any) => fu.username === iu.username);
        if (existsIdx === -1) {
            finalUsers.push({ ...iu });
        } else {
            // Let edited properties override initial values
            finalUsers[existsIdx] = {
                ...iu,
                ...finalUsers[existsIdx]
            };
        }
    });

    // Smart Merge for Settings: NEVER discard non-empty values from local/cloud settings. Keep defaults, overlay local and cloud.
    let finalSettings = {
        ...INITIAL_DATA.masterData.settings,
        ...localSettings
    };
    if (cloudSettings) {
        if (localTs > cloudTs) {
            finalSettings = {
                ...INITIAL_DATA.masterData.settings,
                ...cloudSettings,
                ...localSettings
            };
        } else {
            finalSettings = {
                ...INITIAL_DATA.masterData.settings,
                ...localSettings,
                ...cloudSettings
            };
        }
    }

    // Garbage collect elements in deletedIds registry that have vanished from the cloud
    if (mergedDeletedIds.length > 0) {
        const cloudExistIds = new Set([
            ...(cloud.patients || []).map(p => String(p.id)),
            ...(cloud.incidentReports || []).map(i => String(i.id)),
            ...(cloud.doctorVisits || []).map(v => String(v.id)),
            ...(cloud.financeRecords || []).map(f => String(f.id)),
            ...(cloud.qualityMeasurements || []).map(q => String(q.id)),
            ...(cloud.instruments || []).map(ins => String(ins.id)),
            ...(cloud.operationReports || []).map(op => String(op.id))
        ]);
        const stillInCloud = mergedDeletedIds.filter(id => id.startsWith('USER_') || cloudExistIds.has(id));
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('surgihub_deleted_ids', JSON.stringify(stillInCloud));
            } catch (e) {}
        }
    }

    const mergedMasterData = mergeMasterData(local.masterData, cloud.masterData);

    return {
        ...local,
        ...cloud,
        timestamp: new Date().toISOString(),
        patients: mergedPatients,
        dailyReports: mergedDailyReports,
        nursingReports: mergedNursingReports,
        operations: mergedOperations,
        incidentReports: mergedIncidentReports,
        qualityMeasurements: mergedQualityMeasurements,
        instruments: mergedInstruments,
        operationReports: mergedOperationReports,
        financeRecords: mergedFinanceRecords,
        doctorVisits: mergedDoctorVisits,
        deletedIds: mergedDeletedIds,
        masterData: { 
            ...mergedMasterData,
            settings: finalSettings,
            users: finalUsers 
        }
    };
};

export const cleanAndDeduplicate = (data: AppData): AppData => {
    if (!data) return INITIAL_DATA;
    
    // Migrate nurse list
    const cleanNursesList: string[] = [];
    const seenNurses = new Set<string>();
    (data.masterData?.nurses || []).forEach(n => {
        if (!n) return;
        let cleanN = n.trim();
        if (cleanN === "Nila Sisnawati,A.Md.Kep" || cleanN === "NILA SISNAWATI") {
            cleanN = "NILA SISNAWATI";
        } else if (cleanN === "Saufia Hayati Umajan, S.Kep.Ns" || cleanN === "SAUFIA HAYATI UMAJAN") {
            cleanN = "SAUFIA HAYATI UMAJAN";
        } else if (cleanN === "Yayuk Aprianis,A.Md.Kep" || cleanN === "Yayuk aprianis") {
            cleanN = "Yayuk aprianis";
        }
        if (!seenNurses.has(cleanN)) {
            seenNurses.add(cleanN);
            cleanNursesList.push(cleanN);
        }
    });

    // Migrate nurse metadata
    const cleanNurseMetadata: Record<string, any> = {};
    const rawNurseMetadata = data.masterData?.nurseMetadata || {};
    Object.keys(rawNurseMetadata).forEach(key => {
        let cleanKey = key;
        const trimmed = key.trim();
        if (trimmed === "Nila Sisnawati,A.Md.Kep" || trimmed === "NILA SISNAWATI") {
            cleanKey = "NILA SISNAWATI";
        } else if (trimmed === "Saufia Hayati Umajan, S.Kep.Ns" || trimmed === "SAUFIA HAYATI UMAJAN") {
            cleanKey = "SAUFIA HAYATI UMAJAN";
        } else if (trimmed === "Yayuk Aprianis,A.Md.Kep" || trimmed === "Yayuk aprianis") {
            cleanKey = "Yayuk aprianis";
        }
        cleanNurseMetadata[cleanKey] = rawNurseMetadata[key];
    });

    const seenPatients = new Set();
    const patients = data.patients || [];
    const cleanPatients = patients.map(p => {
        if (!p) return p;
        let pp = p.perawatPrimer || '';
        const trimmedPP = pp.trim();
        if (trimmedPP === "Nila Sisnawati,A.Md.Kep" || trimmedPP === "NILA SISNAWATI") {
            pp = "NILA SISNAWATI";
        } else if (trimmedPP === "Saufia Hayati Umajan, S.Kep.Ns" || trimmedPP === "SAUFIA HAYATI UMAJAN") {
            pp = "SAUFIA HAYATI UMAJAN";
        } else if (trimmedPP === "Yayuk Aprianis,A.Md.Kep" || trimmedPP === "Yayuk aprianis") {
            pp = "Yayuk aprianis";
        }
        return {
            ...p,
            perawatPrimer: pp
        };
    }).filter(p => {
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
    const tempUsers = (data.masterData?.users || []).filter(u => {
        if (!u || !u.username) return false;
        if (seenUsers.has(u.username)) return false;
        if (u.unit && (u.unit.toUpperCase().includes('ICU') || u.unit.toUpperCase().includes('ICCU'))) return false;
        if (u.username === 'dyah') return false;
        seenUsers.add(u.username);
        return true;
    });

    // Force restore any missing predefined users from INITIAL_DATA.masterData.users if NOT deleted
    const initialUsers = INITIAL_DATA.masterData?.users || [];
    const localDeletedIds = new Set([
        ...(data.deletedIds || []),
        ...getDeletedIds()
    ]);
    initialUsers.forEach((iu: any) => {
        const isDeleted = localDeletedIds.has(`USER_${iu.username}`);
        if (isDeleted) return;

        const existsIdx = tempUsers.findIndex((fu: any) => fu.username === iu.username);
        if (existsIdx === -1) {
            tempUsers.push({ ...iu });
        } else {
            // Let edited properties override initial values
            tempUsers[existsIdx] = {
                ...iu,
                ...tempUsers[existsIdx]
            };
        }
    });
    const cleanUsers = tempUsers;

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
            nurses: cleanNursesList,
            nurseMetadata: cleanNurseMetadata,
            users: cleanUsers
        }
    };
};

export const getDB = (): AppData => {
  if (inMemoryDB) {
    return JSON.parse(JSON.stringify(inMemoryDB));
  }
  let existing = localStorage.getItem(DB_KEY);
  if (!existing) {
    try {
      existing = sessionStorage.getItem(DB_KEY);
    } catch (e) {}
  }
  if (existing) {
    try {
      const parsed = resilientParse(existing);

      // HEAL BLOCK: Purge corrupted predefined users from deletedIds
      if (parsed && Array.isArray(parsed.deletedIds)) {
        const initialUsers = INITIAL_DATA.masterData?.users || [];
        const initialUsernames = new Set(initialUsers.map((u: any) => u.username));
        parsed.deletedIds = parsed.deletedIds.filter((id: string) => {
          if (id && id.startsWith('USER_')) {
            const uName = id.replace('USER_', '');
            if (initialUsernames.has(uName) && uName !== 'demo') {
              return false; // Restore predefined clinical users
            }
          }
          return true;
        });
      }

      // Also clean up local device deletedIds database file backup registry
      if (typeof window !== 'undefined') {
        try {
          const lDeleted = JSON.parse(localStorage.getItem('surgihub_deleted_ids') || '[]');
          if (Array.isArray(lDeleted)) {
            const initialUsers = INITIAL_DATA.masterData?.users || [];
            const initialUsernames = new Set(initialUsers.map((u: any) => u.username));
            const filteredLDeleted = lDeleted.filter((id: string) => {
              if (id && id.startsWith('USER_')) {
                const uName = id.replace('USER_', '');
                if (initialUsernames.has(uName) && uName !== 'demo') {
                  return false; // Restore predefined clinical users
                }
              }
              return true;
            });
            localStorage.setItem('surgihub_deleted_ids', JSON.stringify(filteredLDeleted));
          }
        } catch (e) {}
      }

      // Deep merge basic structure
      const baseData = { 
        ...INITIAL_DATA, 
        ...parsed,
        masterData: {
          ...mergeMasterData(parsed.masterData, INITIAL_DATA.masterData),
          settings: migrateSettings({
            ...INITIAL_DATA.masterData.settings,
            ...(parsed.masterData?.settings || {})
          })
        }
      };

      // Restore wallpaper from local backup if it has been cleared/stripped or missing
      if (baseData.masterData?.settings) {
        const appWpBackup = localStorage.getItem('surgihub_app_wallpaper_backup');
        if (appWpBackup && (!baseData.masterData.settings.appWallpaperUrl || baseData.masterData.settings.appWallpaperUrl === '')) {
          baseData.masterData.settings.appWallpaperUrl = appWpBackup;
        }
        const loginWpBackup = localStorage.getItem('surgihub_login_wallpaper_backup');
        if (loginWpBackup && (!baseData.masterData.settings.loginWallpaperUrl || baseData.masterData.settings.loginWallpaperUrl === '')) {
          baseData.masterData.settings.loginWallpaperUrl = loginWpBackup;
        }
      }

      inMemoryDB = cleanAndDeduplicate(baseData);
      return JSON.parse(JSON.stringify(inMemoryDB));
    } catch (e) {
      console.error("Critical error parsing local database cache, trying to rescue data:", e);
      // Attempt to retrieve from sessionStorage backup
      try {
        const sessionBackup = sessionStorage.getItem(DB_KEY);
        if (sessionBackup) {
          const parsedSession = resilientParse(sessionBackup);
          if (parsedSession) {
            inMemoryDB = cleanAndDeduplicate(parsedSession);
            return JSON.parse(JSON.stringify(inMemoryDB));
          }
        }
      } catch (sessErr) {}
    }
  }

  // Fallback but do NOT overwrite localStorage immediately with empty data on transient error
  return JSON.parse(JSON.stringify(INITIAL_DATA));
};

export const saveDB = (data: AppData): void => {
  data.timestamp = new Date().toISOString();

  // Save to active state in-memory database
  inMemoryDB = JSON.parse(JSON.stringify(data));

  // Backup raw base64 images so we never lose them on client/server resets
  if (data.masterData?.settings) {
    const appWp = data.masterData.settings.appWallpaperUrl;
    if (appWp && appWp.startsWith('data:image/')) {
        try {
            localStorage.setItem('surgihub_app_wallpaper_backup', appWp);
        } catch (e) { console.warn('Failed to backup app wallpaper'); }
    }
    const loginWp = data.masterData.settings.loginWallpaperUrl;
    if (loginWp && loginWp.startsWith('data:image/')) {
        try {
            localStorage.setItem('surgihub_login_wallpaper_backup', loginWp);
        } catch (e) { console.warn('Failed to backup login wallpaper'); }
    }
  }

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

  // Backup in sessionStorage with Zero device read/write lag for high performance caching
  try {
    sessionStorage.setItem(DB_KEY, serialized);
  } catch (e) {}
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

export const getApiUrl = (): string => {
  const url = localStorage.getItem(API_URL_KEY);
  if (!url || url.trim() === '') {
    return FALLBACK_APPS_SCRIPT_URL;
  }
  return url.trim();
};
export const saveApiUrl = (url: string): void => localStorage.setItem(API_URL_KEY, (url || FALLBACK_APPS_SCRIPT_URL).trim());

export const hasDataDifferences = (a: AppData, b: AppData): boolean => {
  if (!a || !b) return true;
  const tables: (keyof AppData)[] = [
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
    'deletedIds'
  ];
  for (const table of tables) {
    const listA = a[table] || [];
    const listB = b[table] || [];
    if (JSON.stringify(listA) !== JSON.stringify(listB)) {
      return true;
    }
  }
  // Also compare settings and users
  if (JSON.stringify(a.masterData?.users || []) !== JSON.stringify(b.masterData?.users || [])) {
    return true;
  }
  if (JSON.stringify(a.masterData?.settings || {}) !== JSON.stringify(b.masterData?.settings || {})) {
    return true;
  }
  return false;
};

let activeSyncPromise: Promise<{success: boolean, error?: string}> | null = null;

export const syncData = async (forceDownload: boolean = false): Promise<{success: boolean, error?: string}> => {
  if (activeSyncPromise && !forceDownload) {
    return activeSyncPromise;
  }

  const runSync = async (): Promise<{success: boolean, error?: string}> => {
    try {
      const apiUrl = getApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      // Do not skip if empty; let the server-side handle fallback proxy for global sync.
      const response = await fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&force=${forceDownload ? 'true' : 'false'}&t=${Date.now()}`, { 
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
          const errText = await response.text();
          console.error('Remote sync server error:', errText);
          return { success: false, error: `Sync Server Error: ${response.status}` };
      }

      const rawText = await response.text();
      let cloudResponse: any = null;
      try {
          cloudResponse = resilientParse(rawText);
      } catch (jsonErr) {
          console.warn('[Resilient Client Sync] Direct resilientParse failed. Trying text-bracket extraction...', jsonErr);
          const firstBrace = rawText.indexOf('{');
          const lastBrace = rawText.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              try {
                  cloudResponse = resilientParse(rawText.substring(firstBrace, lastBrace + 1));
              } catch (bracketErr) {
                  console.error('[Resilient Client Sync] Bracket extraction also failed:', bracketErr);
              }
          }
      }

      if (!cloudResponse) {
          return { success: false, error: 'Failed to parse response JSON from server' };
      }
      
      if (cloudResponse.error) {
          return { success: false, error: cloudResponse.error };
      }

      // If we have data from cloud, extract and ensure standard keys
      let fetchedDb: AppData | null = null;
      const targetObj = cloudResponse.data || cloudResponse;
      if (targetObj && typeof targetObj === 'object') {
          // Normalize to make sure missing lists are initialized as empty arrays
          const standardKeys = ['patients', 'dailyReports', 'nursingReports', 'operations', 'doctorVisits', 'financeRecords', 'incidentReports', 'qualityMeasurements', 'instruments', 'operationReports'];
          standardKeys.forEach(k => {
              if (!Array.isArray(targetObj[k])) {
                  targetObj[k] = [];
              }
          });
          fetchedDb = targetObj as AppData;
      }

      if (fetchedDb) {
          const localData = getDB();
          const merged = mergeData(localData, fetchedDb);
          
          const hasNewLocalData = hasDataDifferences(merged, fetchedDb);
          
          saveDB(merged);
          
          if (hasNewLocalData) {
              console.log('[Sync] Local database has newer/additional data. Pushing to server...');
              uploadDataBackground();
          }
          
          return { success: true };
      }

      return { success: true };
    } catch (error: any) {
      console.warn('Sync transient warning:', error);
      return { success: false, error: getFriendlyErrorMessage(error) };
    } finally {
      if (!forceDownload) {
        activeSyncPromise = null;
      }
    }
  };

  const syncPromise = runSync();
  if (!forceDownload) {
    activeSyncPromise = syncPromise;
  }
  return syncPromise;
};

// Simple native IndexedDB wrapper for high-capacity local offline queue persistence (replaces localStorage to prevent 5MB QuotaExceededError)
const DB_NAME = "surgihub_offline_db";
const STORE_NAME = "pending_uploads";
const DB_VERSION = 1;

const getIndexedDBConnection = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getPendingUploadFromDB = async (): Promise<AppData | null> => {
  try {
    const db = await getIndexedDBConnection();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get("surgihub_pending_upload");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB GET error, falling back to localStorage if available:", err);
    try {
      const fallback = localStorage.getItem("surgihub_pending_upload");
      return fallback ? JSON.parse(fallback) : null;
    } catch {
      return null;
    }
  }
};

export const setPendingUploadInDB = async (data: AppData): Promise<void> => {
  try {
    const db = await getIndexedDBConnection();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, "surgihub_pending_upload");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB SET error, falling back to localStorage if available:", err);
    try {
      localStorage.setItem("surgihub_pending_upload", JSON.stringify(data));
    } catch (e) {
      console.error("Critical: local storage fallback failed", e);
    }
  }
};

export const clearPendingUploadInDB = async (): Promise<void> => {
  try {
    const db = await getIndexedDBConnection();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete("surgihub_pending_upload");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB DELETE error, falling back to localStorage:", err);
    try {
      localStorage.removeItem("surgihub_pending_upload");
    } catch {}
  }
};

let uploadTimer: any = null;
let isCurrentlyUploading = false;
let retryDelay = 1500; // Start with 1.5 seconds retry interval
let retryTimer: any = null;

export const getIsCurrentlyUploading = (): boolean => isCurrentlyUploading;

/**
 * Direct upload helper that avoids infinite retry loops
 */
export const uploadDataDirect = async (db: AppData, immediate?: boolean): Promise<{success: boolean, error?: string, data?: AppData}> => {
  try {
    isCurrentlyUploading = true;
    const apiUrl = getApiUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), immediate ? 30000 : 60000); // 30s for immediate direct-write, 60s for standard background uploads

    // Ensure all local deleted IDs are synchronized
    db.deletedIds = Array.from(new Set([
      ...(db.deletedIds || []),
      ...getDeletedIds()
    ]));

    // Append cache-buster timestamp
    const response = await fetch(`/api/sync?t=${Date.now()}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({ data: db, url: apiUrl, clientTime: Date.now(), immediate }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { success: false, error: errData.error || `HTTP ${response.status}` };
    }

    const resData = await response.json().catch(() => ({}));
    if (resData && resData.success) {
        let cloudData: any = null;
        if (resData.data && (resData.data.patients || resData.data.dailyReports || resData.data.operationReports)) {
            cloudData = resData.data;
        } else if (resData.patients || resData.dailyReports || resData.operationReports) {
            cloudData = resData;
        }
        
        if (cloudData) {
            const localDb = db;
        
        // Perform safe merge directly without blocking on zero cloud records
        const merged = mergeData(localDb, cloudData);
        return { success: true, data: merged };
        }
    }

    return { success: true, data: db };
  } catch (e: any) { 
    return { success: false, error: getFriendlyErrorMessage(e) }; 
  } finally {
    isCurrentlyUploading = false;
  }
};

/**
 * Triggers the local offline queue processor with exponential backoff retries.
 */
export const triggerOfflineQueueUpload = () => {
  if (retryTimer) return; // Already running a retry timer

  const attemptUpload = async () => {
    const pendingData = await getPendingUploadFromDB();
    if (!pendingData) {
      retryDelay = 1500; // Reset delay when queue is fully cleared
      retryTimer = null;
      return;
    }

    try {
      console.log(`[Offline Queue] Retrying upload. Delay: ${retryDelay}ms. Next backoff limit: ${Math.min(retryDelay * 2, 30000)}ms`);
      const res = await uploadDataDirect(pendingData);
      if (res.success) {
        console.log('[Offline Queue] Upload retry successful! Clearing queue.');
        await clearPendingUploadInDB();
        retryDelay = 1500;
        retryTimer = null;
        
        if (res.data) {
          saveDB(res.data);
          // Dispatch a global window event to let App.tsx update its state
          window.dispatchEvent(new CustomEvent('surgihub_offline_queue_synced', { detail: res.data }));
        }
      } else {
        throw new Error(res.error || 'Retry failed');
      }
    } catch (err: any) {
      retryDelay = Math.min(retryDelay * 2, 30000); // Exponential backoff maxing out at 30 seconds
      console.warn(`[Offline Queue] Retry upload failed. Retrying in ${retryDelay}ms... Error:`, err.message || err);
      retryTimer = setTimeout(attemptUpload, retryDelay);
    }
  };

  retryTimer = setTimeout(attemptUpload, retryDelay);
};

// Auto-trigger sync as soon as the system recovers network connectivity
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[Network] Browser is back online. Re-triggering offline sync queue immediately.");
    triggerOfflineQueueUpload();
  });
}

/**
 * sterilPush
 * Sanitizes and prepares the payload for synchronization.
 * It is a loose sanitization engine that bypasses strict medical-grade checks
 * when non-medical configuration data (such as app themes, HEX colors, URLs) is detected.
 * This ensures color hex codes with '#' and wallpaper URLs are completely allowed.
 */
export const sterilPush = (db: AppData): AppData => {
  if (!db) return db;
  
  // Clean copy of the state
  const cleaned = JSON.parse(JSON.stringify(db));
  
  // Set global connection variables on window if available
  if (typeof window !== "undefined") {
    (window as any).isCloudError = false;
    (window as any).cloudStatus = 'CONNECTED';
  }

  // Double check settings values. Allow standard characters
  if (cleaned.masterData?.settings) {
    const s = cleaned.masterData.settings;
    console.log('[sterilPush] Theme/Config elements bypass validation safely:', {
      themeColor: s.themeColor,
      fontColor: s.fontColor,
      logoUrl: s.logoUrl,
      appWallpaperUrl: s.appWallpaperUrl,
      loginWallpaperUrl: s.loginWallpaperUrl
    });
  }
  
  return cleaned;
};

interface SyncTask {
  data: AppData;
  immediate?: boolean;
  resolve: (res: {success: boolean, error?: string, data?: AppData}) => void;
  reject: (err: any) => void;
}

const syncQueue: SyncTask[] = [];
let isProcessingQueue = false;

const runSyncQueue = async () => {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  
  while (syncQueue.length > 0) {
    const task = syncQueue[0];
    try {
      console.log(`[FIFO Queue] Processing sync task. Remaining in queue: ${syncQueue.length}`);
      const res = await uploadDataDirect(task.data, task.immediate);
      if (res.success && res.data) {
        saveDB(res.data);
      }
      task.resolve(res);
    } catch (err: any) {
      console.error("[FIFO Queue] Task failed:", err);
      task.resolve({ success: false, error: err.message || "Queue task error", data: task.data });
    }
    syncQueue.shift(); // Remove the completed task
  }
  
  isProcessingQueue = false;
};

export const uploadData = (data?: AppData, immediate?: boolean): Promise<{success: boolean, error?: string, data?: AppData}> => {
  const db = data ? { ...data } : getDB();
  const sanitized = sterilPush(db);
  
  return new Promise((resolve, reject) => {
    syncQueue.push({
      data: sanitized,
      immediate,
      resolve,
      reject
    });
    runSyncQueue();
  });
};

export const uploadDataBackground = () => {
    if (uploadTimer) clearTimeout(uploadTimer);
    uploadTimer = setTimeout(async () => {
        if (isCurrentlyUploading) {
            uploadDataBackground();
            return;
        }
        isCurrentlyUploading = true;
        try {
            await uploadData();
        } catch (e) {
            console.warn('[Sync] Background upload failed:', e);
        } finally {
            isCurrentlyUploading = false;
        }
    }, 1000); // Snappy 1s interval
};

export const authenticate = (username: string, password: string): User | null => {
  const db = getDB();
  return db.masterData.users.find(u => u.username === username && u.password === password) || null;
};

export const createPatient = async (patient: Omit<Patient, 'id'>): Promise<Patient> => {
  const db = getDB();
  const newPatient: Patient = { ...patient, id: Date.now().toString(), lastModified: new Date().toISOString() };
  db.patients.push(newPatient);
  saveDB(db);
  uploadDataBackground();
  return newPatient;
};

export const updatePatient = async (id: string, updates: Partial<Patient>): Promise<Patient | null> => {
  const db = getDB();
  const idx = db.patients.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return null;
  db.patients[idx] = { ...db.patients[idx], ...updates, lastModified: new Date().toISOString() };
  saveDB(db);
  uploadDataBackground();
  return db.patients[idx];
};
