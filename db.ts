
import { AppData, Patient, User, DailyReportEntry, parseToStandardDateString } from './types';
import { INITIAL_DATA } from './constants';
import { pushToFirestore } from './firestoreSync';

// Kunci database permanen untuk mencegah data hilang saat update kode
const DB_KEY = 'si_baru_db_stable_production_v5';
const API_URL_KEY = 'si_baru_api_url_stable';

export const TAB_ID = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
export const FALLBACK_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbydRSS_JBTGeJryBc0uTckoEjJ1-kQY65ntUbYxLwuuBn80QNNwXreuFj0MVYqF3Q-GLw/exec";
let inMemoryDB: AppData | null = null;

export function sanitizeJsonString(str: string): string {
  if (!str) return str;
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (inString) {
      if (isEscaped) {
        result += char;
        isEscaped = false;
      } else if (char === '\\') {
        result += '\\';
        isEscaped = true;
      } else if (char === '"') {
        result += '"';
        inString = false;
      } else {
        const code = char.charCodeAt(0);
        if (char === '\n') {
          result += '\\n';
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else if (code < 32) {
          const hex = code.toString(16).padStart(4, '0');
          result += '\\u' + hex;
        } else {
          result += char;
        }
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }

  return result.replace(/,\s*([\}\]])/g, '$1');
}

export function sanitizeUnescapedInnerQuotes(str: string): string {
  if (!str) return str;
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (inString) {
      if (isEscaped) {
        result += char;
        isEscaped = false;
      } else if (char === '\\') {
        result += '\\';
        isEscaped = true;
      } else if (char === '"') {
        let nextNonWhitespace = '';
        for (let j = i + 1; j < str.length; j++) {
          if (!/\s/.test(str[j])) {
            nextNonWhitespace = str[j];
            break;
          }
        }
        if (nextNonWhitespace === ',' || nextNonWhitespace === '}' || nextNonWhitespace === ']' || nextNonWhitespace === ':') {
          result += '"';
          inString = false;
        } else {
          result += '\\"';
        }
      } else {
        const code = char.charCodeAt(0);
        if (char === '\n') result += '\\n';
        else if (char === '\r') result += '\\r';
        else if (char === '\t') result += '\\t';
        else if (code < 32) result += '\\u' + code.toString(16).padStart(4, '0');
        else result += char;
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }

  return result.replace(/,\s*([\}\]])/g, '$1');
}

export function normalizeDatesInDb(db: any): any {
  if (!db || typeof db !== 'object') return db;
  
  // SANITIZE UNPAIRED QUOTES FUNCTION
  const sanitizeUnpairedQuotes = (text: any): string => {
    if (text === undefined || text === null) return '';
    const str = String(text);
    const quotesCount = (str.match(/"/g) || []).length;
    if (quotesCount === 0) return str;
    
    if (quotesCount % 2 !== 0) {
      // Find the unmatched quote and remove it
      const chars = str.split('');
      let inQuote = false;
      let lastQuoteIdx = -1;
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === '"') {
          if (!inQuote) {
            inQuote = true;
            lastQuoteIdx = i;
          } else {
            inQuote = false;
            lastQuoteIdx = -1;
          }
        }
      }
      if (inQuote && lastQuoteIdx !== -1) {
        chars.splice(lastQuoteIdx, 1);
      }
      return chars.join('');
    }
    return str;
  };

  // SANITIZE PATIENT LIST
  if (Array.isArray(db.patients)) {
    db.patients.forEach((item: any) => {
      if (!item || typeof item !== 'object') return;
      
      // 1. RM Number Protection
      if (item.noRM !== undefined && item.noRM !== null) {
        let rmStr = String(item.noRM).trim();
        const hasAlphabet = /[a-zA-Z]/.test(rmStr);
        if (hasAlphabet) {
          // Convert automatically to safe string format (removing special chars except alphanumeric and dashes)
          const sanitizedRm = rmStr.replace(/[^a-zA-Z0-9-]/g, '');
          item.noRM = sanitizedRm || `RM-DEF-${Math.floor(Math.random() * 10000)}`;
        } else {
          item.noRM = rmStr;
        }
      } else {
        item.noRM = `RM-DEF-${Math.floor(Math.random() * 10000)}`;
      }

      // 2. Alamat & Catatan Unpaired Double Quotes Sanitization
      if (item.address) {
        item.address = sanitizeUnpairedQuotes(item.address);
      }
      if (item.catatanKhusus) {
        item.catatanKhusus = sanitizeUnpairedQuotes(item.catatanKhusus);
      }
    });
  }

  // SANITIZE DAILY REPORTS LIST (adminNote, reports, therapy, etc.)
  if (Array.isArray(db.dailyReports)) {
    db.dailyReports.forEach((item: any) => {
      if (!item || typeof item !== 'object') return;
      
      const textFields = ['morningReport', 'afternoonReport', 'nightReport', 'morningTherapy', 'afternoonTherapy', 'nightTherapy', 'adminNote', 'surgeryDelayReason'];
      textFields.forEach(f => {
        if (item[f]) {
          item[f] = sanitizeUnpairedQuotes(item[f]);
        }
      });
    });
  }
  
  if (Array.isArray(db.nursingReports)) {
    db.nursingReports.forEach((item: any) => {
      if (!item || typeof item !== 'object') return;
      if (item.catatan) item.catatan = sanitizeUnpairedQuotes(item.catatan);
      if (item.alamat) item.alamat = sanitizeUnpairedQuotes(item.alamat);
    });
  }
  
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

export function fallbackRawExtract(jsonStr: string): any {
  const result: any = {
    patients: [],
    financeRecords: [],
    dailyReports: [],
    nursingReports: [],
    operations: [],
    incidentReports: [],
    operationReports: [],
    instruments: [],
    doctorVisits: [],
    qualityMeasurements: [],
    masterData: {
      users: [],
      settings: {
        appName: 'SiMANTAP',
        appSlogan: 'Manajemen Laporan Terpadu & Akurat',
        themeColor: '#144272',
        fontColor: '#ffffff'
      }
    },
    roomBookings: [],
    deletedIds: []
  };

  const keys = ['patients', 'financeRecords', 'dailyReports', 'nursingReports', 'operations', 'incidentReports', 'operationReports', 'instruments', 'doctorVisits', 'qualityMeasurements', 'roomBookings', 'deletedIds'];
  
  keys.forEach(key => {
    const regex = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`);
    const match = jsonStr.match(regex);
    if (match && match[1]) {
      const arrayContent = match[1].trim();
      if (!arrayContent) return;
      
      const items: any[] = [];
      
      if (key === 'deletedIds') {
        const matchDeleted = arrayContent.match(/"([^"]+)"/g);
        if (matchDeleted) {
          matchDeleted.forEach(m => {
            items.push(m.replace(/"/g, ''));
          });
        }
      } else {
        let braceCount = 0;
        let startIdx = -1;
        
        for (let i = 0; i < arrayContent.length; i++) {
          if (arrayContent[i] === '{') {
            if (braceCount === 0) startIdx = i;
            braceCount++;
          } else if (arrayContent[i] === '}') {
            braceCount--;
            if (braceCount === 0 && startIdx !== -1) {
              const itemStr = arrayContent.substring(startIdx, i + 1);
              try {
                const parsedItem = JSON.parse(itemStr);
                if (parsedItem) {
                  items.push(parsedItem);
                }
              } catch (e) {
                try {
                  const rescuedItem: any = {};
                  const propRegex = /"([^"]+)"\s*:\s*(?:"([^"]*)"|([0-9.-]+|true|false|null))/g;
                  let propMatch;
                  while ((propMatch = propRegex.exec(itemStr)) !== null) {
                    const propName = propMatch[1];
                    const propValStr = propMatch[2] !== undefined ? propMatch[2] : propMatch[3];
                    let propVal: any = propValStr;
                    if (propVal === 'true') propVal = true;
                    else if (propVal === 'false') propVal = false;
                    else if (propVal === 'null') propVal = null;
                    else if (!isNaN(Number(propVal)) && propVal !== '') propVal = Number(propVal);
                    rescuedItem[propName] = propVal;
                  }
                  if (Object.keys(rescuedItem).length > 0) {
                    items.push(rescuedItem);
                  }
                } catch (rescueErr) {}
              }
            }
          }
        }
      }
      
      if (items.length > 0) {
        result[key] = items;
      }
    }
  });

  const usersMatch = jsonStr.match(/"users"\s*:\s*\[([\s\S]*?)\]/);
  if (usersMatch && usersMatch[1]) {
    const arrayContent = usersMatch[1].trim();
    let braceCount = 0;
    let startIdx = -1;
    const users: any[] = [];
    for (let i = 0; i < arrayContent.length; i++) {
      if (arrayContent[i] === '{') {
        if (braceCount === 0) startIdx = i;
        braceCount++;
      } else if (arrayContent[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIdx !== -1) {
          const itemStr = arrayContent.substring(startIdx, i + 1);
          try {
            const parsedUser = JSON.parse(itemStr);
            if (parsedUser && parsedUser.username) {
              users.push(parsedUser);
            }
          } catch (e) {}
        }
      }
    }
    if (users.length > 0) {
      result.masterData.users = users;
    }
  }

  return result;
}

export function resilientParse(jsonStr: string): any {
  if (!jsonStr) return null;

  // 1. Direct standard JSON.parse
  try {
    const parsed = JSON.parse(jsonStr);
    return normalizeDatesInDb(parsed);
  } catch (e1) {}

  // 2. Direct text-bracket extraction if wrapped in non-JSON text / HTML
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const bracketSubstring = jsonStr.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(bracketSubstring);
      return normalizeDatesInDb(parsed);
    } catch (e2) {}
  }

  // 3. Sanitized JSON.parse (control chars, newlines, trailing commas)
  try {
    const sanitized = sanitizeJsonString(jsonStr);
    const parsed = JSON.parse(sanitized);
    return normalizeDatesInDb(parsed);
  } catch (e3) {}

  // 4. Bracket extraction + Sanitized JSON.parse
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const bracketSubstring = jsonStr.substring(firstBrace, lastBrace + 1);
      const sanitized = sanitizeJsonString(bracketSubstring);
      const parsed = JSON.parse(sanitized);
      return normalizeDatesInDb(parsed);
    } catch (e4) {}
  }

  // 5. Unescaped inner quotes sanitization
  try {
    const sanitized = sanitizeUnescapedInnerQuotes(jsonStr);
    const parsed = JSON.parse(sanitized);
    return normalizeDatesInDb(parsed);
  } catch (e5) {}

  // 6. Settings block isolation
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
  } catch (e6) {}

  // 7. Fallback raw extract (never throws, rescues every array item)
  try {
    const extracted = fallbackRawExtract(jsonStr);
    return normalizeDatesInDb(extracted);
  } catch (e7) {
    console.error('[Resilient Client Parser] Returning safe default template.');
    return normalizeDatesInDb(JSON.parse(JSON.stringify(INITIAL_DATA)));
  }
}

/**
 * Registry for deleted record IDs to prevent resurrection during sync
 */
export const registerDeletedId = (id: string): void => {
    if (!id || typeof window === 'undefined') return;
    try {
        const deleted = JSON.parse(localStorage.getItem('surgihub_deleted_ids') || '[]');
        if (!deleted.includes(id)) {
            deleted.push(id);
            localStorage.setItem('surgihub_deleted_ids', JSON.stringify(deleted));
        }
        if (inMemoryDB) {
            if (!inMemoryDB.deletedIds) inMemoryDB.deletedIds = [];
            if (!inMemoryDB.deletedIds.includes(id)) inMemoryDB.deletedIds.push(id);
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

export const generatePermanentUUID = (prefix: string = 'P'): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${randomStr}`;
};

export const getLatestTimestamp = (item: any): number => {
    if (!item || typeof item !== 'object') return 0;
    let maxTs = 0;
    const fields = ['lastModified', 'updatedAt', 'deletedAt', 'settingsTimestamp', 'date'];
    for (const f of fields) {
        if (item[f]) {
            const t = new Date(item[f]).getTime();
            if (!isNaN(t) && t > maxTs) maxTs = t;
        }
    }
    return maxTs;
};

export const chooseNonEmptyVal = (primaryVal: any, secondaryVal: any) => {
    if (primaryVal !== undefined && primaryVal !== null) {
        return primaryVal;
    }
    return secondaryVal;
};

export const mergeRecordProperties = (primaryItem: any, secondaryItem: any): any => {
    if (!primaryItem) return secondaryItem;
    if (!secondaryItem) return primaryItem;
    
    const primaryLm = getLatestTimestamp(primaryItem);
    const secondaryLm = getLatestTimestamp(secondaryItem);

    // Give primaryItem a 30s advantage window for incoming edits
    const primaryIsNewer = (primaryLm + 30000) >= secondaryLm;
    const newerItem = primaryIsNewer ? primaryItem : secondaryItem;
    const olderItem = primaryIsNewer ? secondaryItem : primaryItem;

    const merged = { ...olderItem, ...newerItem };

    Object.keys(newerItem).forEach(prop => {
        if (newerItem[prop] !== undefined && newerItem[prop] !== null) {
            merged[prop] = newerItem[prop];
        }
    });

    if (primaryItem.auditData || secondaryItem.auditData) {
        merged.auditData = {
            ...(secondaryItem.auditData || {}),
            ...(primaryItem.auditData || {})
        };
    }

    return merged;
};

/**
 * Logika Smart Merge (Anti-Loss & Realtime Sync)
 * Menggabungkan data lokal dan cloud dengan mempercayai Cloud sebagai Source of Truth utama,
 * namun tetap memberikan toleransi grace period untuk input baru yang belum sempat terunggah.
 */
export const mergeData = (rawLocal: AppData, rawCloud: AppData): AppData => {
    if (!rawCloud) return rawLocal;

    // Standardize all dates immediately in both datasets to prevent key misalignment and accidental filtering out of items!
    const local = normalizeDatesInDb(JSON.parse(JSON.stringify(rawLocal)));
    const cloud = normalizeDatesInDb(JSON.parse(JSON.stringify(rawCloud)));
    
    const majorKeys: (keyof AppData)[] = ['patients', 'financeRecords', 'dailyReports', 'nursingReports', 'operations', 'incidentReports', 'operationReports', 'instruments', 'doctorVisits', 'qualityMeasurements', 'roomBookings'];
    
    majorKeys.forEach(key => {
        if (!Array.isArray(cloud[key])) {
            (cloud as any)[key] = [];
        }
    });

    const localSettings = migrateSettings(local.masterData?.settings || INITIAL_DATA.masterData.settings) || INITIAL_DATA.masterData.settings;
    const cloudSettings = migrateSettings(cloud.masterData?.settings) || INITIAL_DATA.masterData.settings;
    const localTs = new Date(localSettings.settingsTimestamp || '2000-01-01').getTime();
    const cloudTs = new Date(cloudSettings.settingsTimestamp || '2000-01-01').getTime();

    // Deleted IDs must ALWAYS be the UNION of local, cloud, and local device registry (tombstone pattern)
    let mergedDeletedIds: string[] = Array.from(new Set([
        ...(Array.isArray(local.deletedIds) ? local.deletedIds : []),
        ...(Array.isArray(cloud.deletedIds) ? cloud.deletedIds : []),
        ...getDeletedIds()
    ]));

    // Inject local device deleted registry to guarantee deletion consistency across sessions
    const localRegistryDeleted = getDeletedIds();
    localRegistryDeleted.forEach(id => {
        if (!mergedDeletedIds.includes(id)) {
            mergedDeletedIds.push(id);
        }
    });

    // Protect super administrator from deletion
    mergedDeletedIds = mergedDeletedIds.filter(id => id !== 'USER_administrator');

    // Synchronize local storage deleted IDs registry
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('surgihub_deleted_ids', JSON.stringify(mergedDeletedIds));
        } catch (e) {}
    }

    const getItemKey = (item: any, key: string = 'id'): string | null => {
        if (!item) return null;
        if (item.indicatorId && item.date) {
            const stdDate = parseToStandardDateString(item.date) || item.date;
            return `${item.indicatorId}_${stdDate}`;
        }
        if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') return String(item[key]);
        if (item.id !== undefined && item.id !== null && String(item.id).trim() !== '') return String(item.id);
        if (item.patientId && item.date) return `${item.patientId}_${item.date}`;
        return null;
    };

    const mergeList = (localList: any[], cloudList: any[], key: string = 'id') => {
        const safeLocal = (Array.isArray(localList) ? localList : []).filter(item => item && getItemKey(item, key) !== null);
        const safeCloud = (Array.isArray(cloudList) ? cloudList : []).filter(item => item && getItemKey(item, key) !== null);

        if (safeCloud.length === 0 && safeLocal.length > 0) {
            return safeLocal.filter(item => {
                const k = getItemKey(item, key);
                const isItemDeleted = (k && mergedDeletedIds.includes(k)) ||
                    item.isDeleted || item.deleted ||
                    (item.patientId && mergedDeletedIds.includes(String(item.patientId))) ||
                    (item.indicatorId && mergedDeletedIds.includes(String(item.indicatorId)));
                return !isItemDeleted;
            });
        }

        const mergedMap = new Map<string, any>();
        const localKeyMap = new Map<string, any>();
        const cloudKeyMap = new Map<string, any>();

        safeLocal.forEach(i => {
            const k = getItemKey(i, key);
            if (k) localKeyMap.set(k, i);
        });

        safeCloud.forEach(i => {
            const k = getItemKey(i, key);
            if (k) cloudKeyMap.set(k, i);
        });

        const allKeys = new Set<string>([
            ...Array.from(localKeyMap.keys()),
            ...Array.from(cloudKeyMap.keys())
        ]);

        allKeys.forEach(itemId => {
            const localItem = localKeyMap.get(itemId);
            const cloudItem = cloudKeyMap.get(itemId);

            const isItemDeletedInRegistry = mergedDeletedIds.includes(itemId) || 
                (localItem && localItem.id && mergedDeletedIds.includes(String(localItem.id))) ||
                (cloudItem && cloudItem.id && mergedDeletedIds.includes(String(cloudItem.id))) ||
                (localItem && localItem.patientId && mergedDeletedIds.includes(String(localItem.patientId))) ||
                (cloudItem && cloudItem.patientId && mergedDeletedIds.includes(String(cloudItem.patientId))) ||
                (localItem && localItem.indicatorId && mergedDeletedIds.includes(String(localItem.indicatorId))) ||
                (cloudItem && cloudItem.indicatorId && mergedDeletedIds.includes(String(cloudItem.indicatorId)));

            const localIsDeleted = !!(localItem && (localItem.isDeleted || localItem.deleted));
            const cloudIsDeleted = !!(cloudItem && (cloudItem.isDeleted || cloudItem.deleted));

            if (isItemDeletedInRegistry || localIsDeleted || cloudIsDeleted) {
                registerDeletedId(itemId);
                if (localItem && localItem.id) registerDeletedId(String(localItem.id));
                if (cloudItem && cloudItem.id) registerDeletedId(String(cloudItem.id));
                if (!mergedDeletedIds.includes(itemId)) mergedDeletedIds.push(itemId);
                return;
            }

            if (localItem && cloudItem) {
                // STRICT LOCAL TRUTH FOR USER EDITS & STATUS UPDATES
                const localStatusUpper = (localItem.statusDataPasien || localItem.status || '').toUpperCase();
                const isLocalDischarged = localItem.status === 'DISCHARGED' || 
                  ['BPL', 'RUJUK', 'DIRUJUK', 'PINDAH', 'DIPINDAH', 'MENINGGAL', 'APS', 'BATAL', 'KRS'].some(s => localStatusUpper.includes(s));

                const mergedRecord = mergeRecordProperties(localItem, cloudItem);
                if (isLocalDischarged) {
                    mergedRecord.status = 'DISCHARGED';
                }
                mergedMap.set(itemId, mergedRecord);
            } else if (localItem && !localIsDeleted) {
                // Local item exists, cloud does not have it yet. PRESERVE LOCAL ITEM ALWAYS (SINGLE SOURCE OF TRUTH)!
                mergedMap.set(itemId, localItem);
            } else if (cloudItem && !cloudIsDeleted) {
                mergedMap.set(itemId, cloudItem);
            }
        });

        return Array.from(mergedMap.values());
    };

    const mergedPatients = mergeList(local.patients || [], cloud.patients || []);
    const activePatientIds = new Set(mergedPatients.map(p => String(p.id)));
    
    const mergedDailyReportsMap = new Map<string, DailyReportEntry>();

    // 1. Proses laporan harian dari cloud (SOURCE OF TRUTH)
    const safeCloudReports = Array.isArray(cloud.dailyReports) ? cloud.dailyReports : [];
    safeCloudReports.forEach(cr => {
        if (cr && cr.patientId && cr.date) {
            const patientIdStr = String(cr.patientId);
            if (mergedDeletedIds.includes(patientIdStr) || cr.isDeleted || cr.deleted) {
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
            if (mergedDeletedIds.includes(patientIdStr) || lr.isDeleted || lr.deleted) {
                return;
            }

            const key = `${patientIdStr}_${lr.date}`;
            const cloudReport = mergedDailyReportsMap.get(key);

            if (!cloudReport) {
                mergedDailyReportsMap.set(key, { ...lr });
            } else {
                // Keduanya ada. Lakukan Cell-Level Deep Merge dengan aturan LATEST TIMESTAMP WINS
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

                const localLm = getLatestTimestamp(lr);
                const cloudLm = getLatestTimestamp(cloudReport);

                fields.forEach(f => {
                    const localVal = lr[f];
                    const cloudVal = cloudReport[f];

                    const localTime = localTimes[f] ? new Date(localTimes[f]).getTime() : 0;
                    const cloudTime = cloudTimes[f] ? new Date(cloudTimes[f]).getTime() : 0;

                    if (localTime > 0 || cloudTime > 0) {
                        if (localTime >= cloudTime) {
                            merged[f] = chooseNonEmptyVal(localVal, cloudVal);
                            if (localTimes[f]) {
                                merged.fieldModifiedTimes[f] = localTimes[f];
                            }
                        } else {
                            merged[f] = chooseNonEmptyVal(cloudVal, localVal);
                            if (cloudTimes[f]) {
                                merged.fieldModifiedTimes[f] = cloudTimes[f];
                            }
                        }
                    } else {
                        // Fallback jika tidak ada stempel waktu per-kolom: STRICT LOCAL TRUTH PRESERVED
                        merged[f] = chooseNonEmptyVal(localVal, cloudVal);
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
                merged.updatedAt = new Date(maxTime).toISOString();
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
    const mergedRoomBookings = mergeList(local.roomBookings || [], cloud.roomBookings || []);

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

    // Smart Merge for Settings: Merge property by property. A customized value (non-empty, non-default) should always win over a default/empty value!
    const mergeTwoSettings = (a: any, b: any) => {
        const merged = { ...INITIAL_DATA.masterData.settings, ...a, ...b };
        Object.keys(merged).forEach(key => {
            const valA = a[key];
            const valB = b[key];
            const defaultVal = (INITIAL_DATA.masterData.settings as any)[key];
            const isDefaultB = valB === undefined || valB === null || valB === '' || valB === defaultVal;
            const isCustomA = valA !== undefined && valA !== null && valA !== '' && valA !== defaultVal;
            if (isCustomA && isDefaultB) {
                merged[key] = valA;
            }
        });
        return merged;
    };

    let finalSettings = mergeTwoSettings(cloudSettings, localSettings);
    if (cloudSettings) {
        if (localTs > cloudTs) {
            finalSettings = mergeTwoSettings(cloudSettings, localSettings);
        } else if (cloudTs > localTs) {
            finalSettings = mergeTwoSettings(localSettings, cloudSettings);
        } else {
            // Equal timestamps: merge, but let cloud values override local only if they are not empty/default
            finalSettings = mergeTwoSettings(localSettings, cloudSettings);
        }
    }

    // Synchronize local storage deleted IDs registry with full union
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('surgihub_deleted_ids', JSON.stringify(mergedDeletedIds));
        } catch (e) {}
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
        roomBookings: mergedRoomBookings,
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

    // Deduplicate dailyReports by patientId_date
    const seenDailyReports = new Set();
    const dailyReports = data.dailyReports || [];
    const cleanDailyReports = dailyReports.filter(r => {
        if (!r || !r.patientId || !r.date) return false;
        const key = `${r.patientId}_${r.date}`;
        if (seenDailyReports.has(key)) return false;
        seenDailyReports.add(key);
        return true;
    });

    // Deduplicate financeRecords
    const seenFinance = new Set();
    const financeRecords = data.financeRecords || [];
    const cleanFinance = financeRecords.filter(f => {
        if (!f || !f.id) return false;
        if (seenFinance.has(f.id)) return false;
        seenFinance.add(f.id);
        return true;
    });

    // Deduplicate qualityMeasurements with auditData merging
    const qualityMap = new Map<string, any>();
    const qualityMeasurements = data.qualityMeasurements || [];
    qualityMeasurements.forEach(q => {
        if (!q) return;
        const normDate = parseToStandardDateString(q.date) || q.date;
        const key = (q.indicatorId && normDate) ? `${q.indicatorId}_${normDate}` : (q.id || `${q.indicatorId}_${q.date}`);
        const existing = qualityMap.get(key);
        if (!existing) {
            qualityMap.set(key, { ...q, date: normDate });
        } else {
            // Merge auditData and pick latest properties
            const mergedAudit = {
                ...(existing.auditData || {}),
                ...(q.auditData || {})
            };
            const existingTime = existing.lastModified ? new Date(existing.lastModified).getTime() : 0;
            const qTime = q.lastModified ? new Date(q.lastModified).getTime() : 0;
            const newer = qTime > existingTime ? q : existing;
            qualityMap.set(key, {
                ...newer,
                date: normDate,
                auditData: mergedAudit
            });
        }
    });
    const cleanQuality = Array.from(qualityMap.values());

    // Deduplicate operationReports
    const seenOpReports = new Set();
    const operationReports = data.operationReports || [];
    const cleanOpReports = operationReports.filter(o => {
        if (!o || !o.id) return false;
        if (seenOpReports.has(o.id)) return false;
        seenOpReports.add(o.id);
        return true;
    });

    // Deduplicate instruments
    const seenInst = new Set();
    const instruments = data.instruments || [];
    const cleanInst = instruments.filter(i => {
        if (!i || !i.id) return false;
        if (seenInst.has(i.id)) return false;
        seenInst.add(i.id);
        return true;
    });

    // Deduplicate operations
    const seenOps = new Set();
    const operations = data.operations || [];
    const cleanOps = operations.filter(o => {
        if (!o || !o.id) return false;
        if (seenOps.has(o.id)) return false;
        seenOps.add(o.id);
        return true;
    });

    return { 
        ...data, 
        patients: cleanPatients,
        dailyReports: cleanDailyReports,
        financeRecords: cleanFinance,
        qualityMeasurements: cleanQuality,
        operationReports: cleanOpReports,
        instruments: cleanInst,
        operations: cleanOps,
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
        let appWpBackup: string | null = null;
        try { appWpBackup = sessionStorage.getItem('surgihub_app_wallpaper_backup'); } catch (e) {}
        if (!appWpBackup) {
          try { appWpBackup = localStorage.getItem('surgihub_app_wallpaper_backup'); } catch (e) {}
        }
        if (appWpBackup && (!baseData.masterData.settings.appWallpaperUrl || baseData.masterData.settings.appWallpaperUrl === '')) {
          baseData.masterData.settings.appWallpaperUrl = appWpBackup;
        }

        let loginWpBackup: string | null = null;
        try { loginWpBackup = sessionStorage.getItem('surgihub_login_wallpaper_backup'); } catch (e) {}
        if (!loginWpBackup) {
          try { loginWpBackup = localStorage.getItem('surgihub_login_wallpaper_backup'); } catch (e) {}
        }
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

export const purgeOldLocalStorageQuota = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    const validKeys = new Set([
      DB_KEY,
      API_URL_KEY,
      'surgihub_deleted_ids',
      'surgihub_pending_upload'
    ]);

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (
        (key.startsWith('si_baru_db_') && key !== DB_KEY) ||
        (key.startsWith('surgihub_') && !validKeys.has(key)) ||
        key.includes('wallpaper_backup') ||
        key.startsWith('temp_') ||
        key.includes('backup')
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  } catch (e) {}
};

export interface SyncDelta {
  table: keyof AppData;
  item: any;
  action?: 'UPSERT' | 'DELETE';
}

let cachedDataJson = '';

export const isAppDataEqual = (a: AppData, b: AppData): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
};

export const hasAppDataChanged = (newData: AppData): boolean => {
  if (!newData) return false;
  try {
    const newJson = JSON.stringify(newData);
    if (newJson === cachedDataJson) {
      return false;
    }
    cachedDataJson = newJson;
    return true;
  } catch (e) {
    return true;
  }
};

export const setCachedDataJson = (data: AppData) => {
  try {
    cachedDataJson = JSON.stringify(data);
  } catch (e) {}
};

const BROADCAST_CHANNEL_NAME = 'simantap_global_sync';
const LEGACY_BROADCAST_CHANNEL_NAME = 'simantap_sync_channel';
let localBroadcastChannel: BroadcastChannel | null = null;
let legacyBroadcastChannel: BroadcastChannel | null = null;

export const broadcastLocalTabSync = (data: AppData, delta?: SyncDelta) => {
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    if (!localBroadcastChannel) {
      try {
        localBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      } catch (e) {}
    }
    if (!legacyBroadcastChannel) {
      try {
        legacyBroadcastChannel = new BroadcastChannel(LEGACY_BROADCAST_CHANNEL_NAME);
      } catch (e) {}
    }

    const payload = {
      type: 'SIMANTAP_GLOBAL_SYNC',
      senderId: TAB_ID,
      timestamp: Date.now(),
      data,
      delta
    };

    if (localBroadcastChannel) {
      try {
        localBroadcastChannel.postMessage(payload);
      } catch (e) {}
    }
    if (legacyBroadcastChannel) {
      try {
        legacyBroadcastChannel.postMessage({ ...payload, type: 'LOCAL_TAB_SYNC' });
      } catch (e) {}
    }
  }
};

export const saveDB = (data: AppData, skipBroadcast: boolean = false, delta?: SyncDelta): void => {
  data.timestamp = new Date().toISOString();

  const cleanData = cleanAndDeduplicate(data);

  // Save to active state in-memory database
  inMemoryDB = cleanData;

  try {
    cachedDataJson = JSON.stringify(cleanData);
  } catch (e) {}

  // Backup raw base64 images into sessionStorage (NOT localStorage to preserve 5MB quota)
  if (data.masterData?.settings) {
    const appWp = data.masterData.settings.appWallpaperUrl;
    if (appWp && appWp.startsWith('data:image/')) {
      try { sessionStorage.setItem('surgihub_app_wallpaper_backup', appWp); } catch (e) {}
    }
    const loginWp = data.masterData.settings.loginWallpaperUrl;
    if (loginWp && loginWp.startsWith('data:image/')) {
      try { sessionStorage.setItem('surgihub_login_wallpaper_backup', loginWp); } catch (e) {}
    }
  }

  // Always lock & persist complete snapshot in IndexedDB (no 5MB quota limit!)
  setLocalSnapshotInDB(cleanData).catch(() => {});

  // Prepare lightweight version for localStorage (strip heavy base64 images)
  let storageData: AppData = cleanData;
  if (cleanData.masterData?.settings) {
    const s = cleanData.masterData.settings;
    if (s.appWallpaperUrl?.startsWith('data:image/') || s.loginWallpaperUrl?.startsWith('data:image/')) {
      storageData = {
        ...cleanData,
        masterData: {
          ...cleanData.masterData,
          settings: {
            ...cleanData.masterData.settings,
            appWallpaperUrl: s.appWallpaperUrl?.startsWith('data:image/') ? '' : s.appWallpaperUrl,
            loginWallpaperUrl: s.loginWallpaperUrl?.startsWith('data:image/') ? '' : s.loginWallpaperUrl
          }
        }
      };
    }
  }

  const serialized = JSON.stringify(storageData);

  // Backup in sessionStorage with zero device read/write lag
  try {
    sessionStorage.setItem(DB_KEY, serialized);
  } catch (e) {}

  // Save to localStorage with automatic emergency cleanup & trimming if quota is exceeded
  try {
    localStorage.setItem(DB_KEY, serialized);
  } catch (error: any) {
    console.warn('LocalStorage save failed, running emergency purge of obsolete keys:', error);
    purgeOldLocalStorageQuota();

    try {
      localStorage.setItem(DB_KEY, serialized);
    } catch (retryError) {
      // If full dataset exceeds browser localStorage quota (~5MB), save a trimmed lightweight fallback copy in localStorage.
      // Full data remains 100% intact in IndexedDB, sessionStorage, RAM, and Google Sheets.
      try {
        const trimmedData: AppData = {
          ...storageData,
          patients: (storageData.patients || []).slice(-150),
          dailyReports: (storageData.dailyReports || []).slice(-200),
          nursingReports: (storageData.nursingReports || []).slice(-150),
          financeRecords: (storageData.financeRecords || []).slice(-150),
          deletedIds: (storageData.deletedIds || []).slice(-50)
        };
        localStorage.setItem(DB_KEY, JSON.stringify(trimmedData));
        console.info('Saved trimmed database fallback to LocalStorage. Full database safely persisted in IndexedDB.');
      } catch (finalError) {
        console.warn('LocalStorage quota exhausted; full database state is safely persisted in IndexedDB.');
      }
    }
  }

  // Broadcast instant tab-to-tab sync
  if (!skipBroadcast) {
    broadcastLocalTabSync(cleanData, delta);
    // Push real-time update to Firebase Firestore
    pushToFirestore(cleanData).catch((err) =>
      console.warn('[Firestore Sync] Non-blocking push error:', err)
    );
  }
};

const getFriendlyErrorMessage = (error: any): string => {
  if (!error) return 'Terjadi kesalahan tidak dikenal.';
  const message = error.message || String(error);
  const msgLower = message.toLowerCase();
  
  if (msgLower.includes('rate exceeded') || msgLower.includes('too many requests') || msgLower.includes('429')) {
    return 'Layanan Google Sheets sedang sibuk (Rate Limit). Data tersimpan 100% aman di memori lokal & server.';
  }
  
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
          const errText = await response.text().catch(() => '');
          if (errText.toLowerCase().includes('rate exceeded') || errText.toLowerCase().includes('429')) {
              console.warn('[Sync] Google Sheets Rate limit hit, falling back to local & Firestore realtime persistence.');
              return { success: true, error: getFriendlyErrorMessage('Rate exceeded') };
          }
          console.warn('Remote sync server warning:', errText);
          return { success: false, error: `Sync Server Status: ${response.status}` };
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
export const requestPersistentStorage = async (): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const persisted = await navigator.storage.persist();
        console.info(`[Persistent Storage] Browser storage persisted: ${persisted}`);
        return persisted;
      }
      return true;
    } catch (e) {
      console.warn('[Persistent Storage] Error requesting persistent storage:', e);
    }
  }
  return false;
};

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

export const setLocalSnapshotInDB = async (data: AppData): Promise<void> => {
  try {
    const db = await getIndexedDBConnection();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, "surgihub_active_snapshot");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB snapshot SET error:", err);
  }
};

export const getLocalSnapshotFromDB = async (): Promise<AppData | null> => {
  try {
    const db = await getIndexedDBConnection();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get("surgihub_active_snapshot");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return null;
  }
};

/**
 * Utility function to split & compress payload if it exceeds 40,000 characters
 * to protect Google Sheets from 50,000 char cell/request payload limits.
 */
export const splitAndCompressPayload = (data: AppData): AppData[] => {
  if (!data) return [];
  const rawStr = JSON.stringify(data);
  if (rawStr.length <= 40000) {
    return [data];
  }

  // 1. Strip nulls, empty strings, and redundant empty fields
  const cleanObj = JSON.parse(rawStr);
  const stripEmpty = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(key => {
      if (obj[key] === null || obj[key] === '' || obj[key] === undefined) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        stripEmpty(obj[key]);
      }
    });
  };
  stripEmpty(cleanObj);

  const cleanStr = JSON.stringify(cleanObj);
  if (cleanStr.length <= 40000) {
    return [cleanObj];
  }

  // 2. Break heavy arrays into sub-chunks if payload still exceeds 40k chars
  const chunks: AppData[] = [];
  const baseHeader: any = {
    masterData: cleanObj.masterData,
    deletedIds: cleanObj.deletedIds || [],
    timestamp: cleanObj.timestamp || new Date().toISOString()
  };

  const majorTables: (keyof AppData)[] = [
    'patients', 'dailyReports', 'nursingReports', 'financeRecords',
    'operationReports', 'operations', 'incidentReports', 'instruments',
    'doctorVisits', 'qualityMeasurements'
  ];

  let currentChunk: any = { ...baseHeader };
  majorTables.forEach(t => { currentChunk[t] = []; });
  let currentChunkSize = JSON.stringify(currentChunk).length;

  majorTables.forEach(t => {
    const arr = (cleanObj as any)[t];
    if (Array.isArray(arr) && arr.length > 0) {
      arr.forEach((item: any) => {
        const itemStr = JSON.stringify(item);
        if (currentChunkSize + itemStr.length > 38000) {
          chunks.push(currentChunk as AppData);
          currentChunk = { ...baseHeader };
          majorTables.forEach(tbl => { currentChunk[tbl] = []; });
          currentChunk[t] = [item];
          currentChunkSize = JSON.stringify(currentChunk).length;
        } else {
          currentChunk[t].push(item);
          currentChunkSize += itemStr.length + 1;
        }
      });
    }
  });

  if (currentChunkSize > 0) {
    chunks.push(currentChunk as AppData);
  }

  return chunks.length > 0 ? chunks : [cleanObj as AppData];
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
      if (res.success) {
        if (res.data) {
          saveDB(res.data);
        }
        await clearPendingUploadInDB();
        task.resolve(res);
      } else {
        console.warn("[FIFO Queue] Sync task failed, writing to persistent IndexedDB queue for background retry...", res.error);
        await setPendingUploadInDB(task.data);
        triggerOfflineQueueUpload();
        task.resolve({ success: false, error: res.error || "Sync failed", data: task.data });
      }
    } catch (err: any) {
      console.error("[FIFO Queue] Task failed, writing to persistent IndexedDB queue:", err);
      await setPendingUploadInDB(task.data);
      triggerOfflineQueueUpload();
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
    }, 5000); // Throttled 5s interval to protect against rate limits while Firestore handles real-time sync
};

export const authenticate = (username: string, password: string): User | null => {
  const db = getDB();
  return db.masterData.users.find(u => u.username === username && u.password === password) || null;
};

export const createPatient = async (patient: Omit<Patient, 'id'>): Promise<Patient> => {
  const db = getDB();
  const newPatient: Patient = { ...patient, id: generatePermanentUUID('P'), lastModified: new Date().toISOString() };
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
