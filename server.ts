
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

import { INITIAL_DATA } from './constants';

dotenv.config();

const app = express();
const PORT = 3000;
const CONFIG_PATH = path.join(process.cwd(), 'server-config.json');
const CACHE_PATH = path.join(process.cwd(), 'app-data-cache.json');

const FALLBACK_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbydRSS_JBTGeJryBc0uTckoEjJ1-kQY65ntUbYxLwuuBn80QNNwXreuFj0MVYqF3Q-GLw/exec";

// Initialize config from file or environment
let serverConfig = {
  appsScriptUrl: process.env.VITE_APPS_SCRIPT_URL || FALLBACK_APPS_SCRIPT_URL,
  enableGoogleSheets: true,
  googleSpreadsheetId: process.env.GOOGLE_SHEET_ID || '1R2yjyUUPJheGomLpSWnUW3FvkIlLsZxoCHn_bGaqPDw/edit?gid=80730661#gid=80730661',
  appName: 'SiMANTAP',
  appSlogan: 'Manajemen Laporan Terpadu & Akurat',
  logoUrl: '',
  logoLetterLeftUrl: '',
  logoLetterRightUrl: '',
  loginWallpaperUrl: '',
  appWallpaperUrl: '',
  themeColor: '#144272',
  fontColor: '#ffffff',
  isSidebarAutohide: false
};

const getIsolatedAppsScriptUrl = (rawUrl: string): string => {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.startsWith('http')) return rawUrl;
  try {
    const urlObj = new URL(rawUrl);
    if (!urlObj.searchParams.has('sheetName')) {
      urlObj.searchParams.set('sheetName', 'DATABASE_BEDAH');
    }
    if (!urlObj.searchParams.has('appId')) {
      urlObj.searchParams.set('appId', 'bedah');
    }
    return urlObj.toString();
  } catch (e) {
    return rawUrl;
  }
};

function sanitizeJsonString(str: string): string {
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

function sanitizeUnescapedInnerQuotes(str: string): string {
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

function normalizeDatesInDb(db: any): any {
  if (!db || typeof db !== 'object') return db;
  
  const parseToStandardDateString = (dateStr: any): string => {
    try {
      if (dateStr === null || dateStr === undefined) return '';
      if (dateStr instanceof Date) {
        if (!isNaN(dateStr.getTime())) {
          const y = dateStr.getFullYear();
          const m = String(dateStr.getMonth() + 1).padStart(2, '0');
          const d = String(dateStr.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        return '';
      }
      let clean = String(dateStr).trim();
      if (!clean) return '';
      if (clean.includes('T')) {
        clean = clean.split('T')[0];
      } else if (clean.includes(' ')) {
        const parts = clean.split(' ');
        const monthNamesIndo = [
          'januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
          'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'agu', 'agt', 'sep', 'okt', 'nov', 'des'
        ];
        const hasIndoMonth = parts.some(p => monthNamesIndo.includes(p.toLowerCase()));
        if (hasIndoMonth) {
          clean = parts.slice(0, 3).join(' ');
        } else if (parts[0].includes('-') || parts[0].includes('/')) {
          clean = parts[0];
        }
      }
      let match = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (match) {
        const y = match[1];
        const m = match[2].padStart(2, '0');
        const d = match[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      match = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (match) {
        const d = match[1].padStart(2, '0');
        const m = match[2].padStart(2, '0');
        const y = match[3];
        return `${y}-${m}-${d}`;
      }
      const lowerClean = clean.toLowerCase();
      const monthsMap: Record<string, string> = {
        januari: '01', jan: '01',
        februari: '02', feb: '02',
        maret: '03', mar: '03',
        april: '04', apr: '04',
        mei: '05',
        juni: '06', jun: '06',
        juli: '07', jul: '07',
        agustus: '08', agu: '08', agt: '08',
        september: '09', sep: '09',
        oktober: '10', okt: '10',
        november: '11', nov: '11',
        desember: '12', des: '12'
      };
      const textMatch1 = lowerClean.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
      if (textMatch1) {
        const day = textMatch1[1].padStart(2, '0');
        const monthName = textMatch1[2];
        const year = textMatch1[3];
        const monthNum = monthsMap[monthName];
        if (monthNum) return `${year}-${monthNum}-${day}`;
      }
      const textMatch2 = lowerClean.match(/^([a-z]+)\s+(\d{1,2})[,\s]+(\d{4})/);
      if (textMatch2) {
        const monthName = textMatch2[1];
        const day = textMatch2[2].padStart(2, '0');
        const year = textMatch2[3];
        const monthNum = monthsMap[monthName];
        if (monthNum) return `${year}-${monthNum}-${day}`;
      }
      const parsed = new Date(clean);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      const num = Math.floor(Number(clean));
      if (!isNaN(num) && num > 0) {
        if (num > 100000000000) {
          const dObj = new Date(num);
          if (!isNaN(dObj.getTime())) {
            const y = dObj.getFullYear();
            const m = String(dObj.getMonth() + 1).padStart(2, '0');
            const d = String(dObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          }
        } else if (num > 10000 && num < 60000) {
          const excelEpoch = new Date(1899, 11, 30);
          const dObj = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
          if (!isNaN(dObj.getTime())) {
            const y = dObj.getFullYear();
            const m = String(dObj.getMonth() + 1).padStart(2, '0');
            const d = String(dObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          }
        }
      }
      return clean;
    } catch {
      return '';
    }
  };

  // SANITIZE UNPAIRED QUOTES FUNCTION
  const sanitizeUnpairedQuotes = (text: any): string => {
    if (text === undefined || text === null) return '';
    const str = String(text);
    const quotesCount = (str.match(/"/g) || []).length;
    if (quotesCount === 0) return str;
    
    if (quotesCount % 2 !== 0) {
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

  // SANITIZE DAILY REPORTS LIST
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
          const std = parseToStandardDateString(item[f]);
          if (std) item[f] = std;
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

function resilientParse(jsonStr: string): any {
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
    console.error('[Resilient Parser Server] All recovery steps failed. Returning initial template.');
    return normalizeDatesInDb(JSON.parse(JSON.stringify(INITIAL_DATA)));
  }
}

function fallbackRawExtract(jsonStr: string): any {
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
    deletedIds: []
  };

  const keys = ['patients', 'financeRecords', 'dailyReports', 'nursingReports', 'operations', 'incidentReports', 'operationReports', 'instruments', 'doctorVisits', 'qualityMeasurements', 'deletedIds'];
  
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

let cachedData: any = null;
let lastCloudFetchTime = 0;
let isBackgroundFetchingCloud = false; // Prevent overlapping background syncs
let activeCloudFetchPromise: Promise<any> | null = null; // Shared promise to deduplicate parallel Google Sheets fetches
const CLOUD_CACHE_TTL = 20000; // 20 seconds in-memory TTL to prevent Google Apps Script quota exhaustion

// Global Rate Exceeded Shield Variables
let sheetsRateLimitedUntil = 0;
let sheetsBackoffMs = 5000;

function handleSheetsRateLimitError(errStr: string): boolean {
  const lower = (errStr || '').toLowerCase();
  if (
    lower.includes('rate exceeded') || 
    lower.includes('exceeded rate') || 
    lower.includes('too many requests') || 
    lower.includes('429') || 
    lower.includes('quota exceeded')
  ) {
    sheetsRateLimitedUntil = Date.now() + sheetsBackoffMs;
    console.warn(`[Rate Limit Shield] Google Sheets rate limit reached ("${errStr.trim()}"). Pausing Apps Script requests for ${sheetsBackoffMs / 1000}s. Local server cache is 100% active and preserved.`);
    sheetsBackoffMs = Math.min(sheetsBackoffMs * 2, 60000);
    return true;
  }
  return false;
}

function handleSheetsSuccess() {
  sheetsRateLimitedUntil = 0;
  sheetsBackoffMs = 5000;
}

// Helper to load latest backup from disk if cache is empty/corrupt
function loadLatestBackup() {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir);
      const backupFiles = files.filter(f => f.startsWith('app-data-backup-') && f.endsWith('.json'));
      if (backupFiles.length > 0) {
        backupFiles.sort((a, b) => b.localeCompare(a));
        const newestFile = path.join(backupsDir, backupFiles[0]);
        console.log(`[Heal Cache Startup] Loading newest backup on startup fallback: ${newestFile}`);
        const content = JSON.parse(fs.readFileSync(newestFile, 'utf8'));
        if (content && content.data) {
          return content.data;
        }
      }
    }
  } catch (err: any) {
    console.error('[Heal Cache Startup] Failed to load latest backup:', err.message);
  }
  return null;
}

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    serverConfig = { ...serverConfig, ...savedConfig };
    if (serverConfig.appsScriptUrl && serverConfig.appsScriptUrl.trim() !== '') {
      serverConfig.enableGoogleSheets = true;
    }
  } catch (e) {
    console.error('Failed to parse server-config.json');
  }
}

if (fs.existsSync(CACHE_PATH)) {
  try {
    let rawCache = resilientParse(fs.readFileSync(CACHE_PATH, 'utf8'));
    if (rawCache) {
      // HEAL BLOCK: Purge corrupted predefined clinical users from deletedIds
      if (rawCache && Array.isArray(rawCache.deletedIds)) {
        const initialUsers = INITIAL_DATA.masterData?.users || [];
        const initialUsernames = new Set(initialUsers.map((u: any) => u.username));
        rawCache.deletedIds = rawCache.deletedIds.filter((id: string) => {
          if (id && id.startsWith('USER_')) {
            const uName = id.replace('USER_', '');
            if (initialUsernames.has(uName) && uName !== 'demo') {
              return false; // Restore predefined clinical users
            }
          }
          return true;
        });
      }
      cachedData = serverMergeData(rawCache, INITIAL_DATA);
      // Persist the merged data back to disk to heal the cached json file immediately
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cachedData, null, 2));
    }
  } catch (e) {
    console.error('Failed to parse app-data-cache.json');
  }
}

// Fallback to latest backup if cachedData is still empty or has no patients/reports
const hasClinicalData = cachedData && (
  (cachedData.patients && cachedData.patients.length > 0) ||
  (cachedData.dailyReports && cachedData.dailyReports.length > 0)
);

if (!hasClinicalData) {
  const latestBackup = loadLatestBackup();
  if (latestBackup) {
    console.log('[Heal Cache Startup] Populating server cache from latest backup.');
    cachedData = serverMergeData(latestBackup, INITIAL_DATA);
    try {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cachedData, null, 2));
    } catch (e) {}
  }
}

const APP_WALLPAPER_PATH = path.join(process.cwd(), 'app-wallpaper-base64.txt');
const LOGIN_WALLPAPER_PATH = path.join(process.cwd(), 'login-wallpaper-base64.txt');
const LOGO_PATH = path.join(process.cwd(), 'logo-base64.txt');

let appWallpaperBase64 = '';
let loginWallpaperBase64 = '';
let logoBase64 = '';

if (fs.existsSync(APP_WALLPAPER_PATH)) {
  try {
    appWallpaperBase64 = fs.readFileSync(APP_WALLPAPER_PATH, 'utf8');
  } catch (e) {
    console.error('Failed to read app-wallpaper-base64.txt');
  }
}
if (fs.existsSync(LOGIN_WALLPAPER_PATH)) {
  try {
    loginWallpaperBase64 = fs.readFileSync(LOGIN_WALLPAPER_PATH, 'utf8');
  } catch (e) {
    console.error('Failed to read login-wallpaper-base64.txt');
  }
}
if (fs.existsSync(LOGO_PATH)) {
  try {
    logoBase64 = fs.readFileSync(LOGO_PATH, 'utf8');
  } catch (e) {
    console.error('Failed to read logo-base64.txt');
  }
}

// Recovery lookups
if (!appWallpaperBase64 && cachedData?.masterData?.settings?.appWallpaperUrl?.startsWith('data:image/')) {
  appWallpaperBase64 = cachedData.masterData.settings.appWallpaperUrl;
  fs.writeFile(APP_WALLPAPER_PATH, appWallpaperBase64, () => {});
}
if (!loginWallpaperBase64 && cachedData?.masterData?.settings?.loginWallpaperUrl?.startsWith('data:image/')) {
  loginWallpaperBase64 = cachedData.masterData.settings.loginWallpaperUrl;
  fs.writeFile(LOGIN_WALLPAPER_PATH, loginWallpaperBase64, () => {});
}
if (!logoBase64 && cachedData?.masterData?.settings?.logoUrl?.startsWith('data:image/')) {
  logoBase64 = cachedData.masterData.settings.logoUrl;
  fs.writeFile(LOGO_PATH, logoBase64, () => {});
}

const ensureWallpaperUrls = (data: any) => {
  if (!data) return data;
  if (data.masterData?.settings) {
    const num = Date.now();
    
    // Check appWallpaperUrl
    if (data.masterData.settings.appWallpaperUrl && typeof data.masterData.settings.appWallpaperUrl === 'string') {
      const url = data.masterData.settings.appWallpaperUrl.trim();
      if (url.startsWith('data:image/')) {
        appWallpaperBase64 = url;
        fs.writeFile(APP_WALLPAPER_PATH, appWallpaperBase64, () => {});
        data.masterData.settings.appWallpaperUrl = `/api/wallpaper/app?t=${num}`;
      } else if (url.includes('drive.google.com')) {
        const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                            url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          const fileId = fileIdMatch[1];
          data.masterData.settings.appWallpaperUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        }
      }
    }
    
    // Check loginWallpaperUrl
    if (data.masterData.settings.loginWallpaperUrl && typeof data.masterData.settings.loginWallpaperUrl === 'string') {
      const url = data.masterData.settings.loginWallpaperUrl.trim();
      if (url.startsWith('data:image/')) {
        loginWallpaperBase64 = url;
        fs.writeFile(LOGIN_WALLPAPER_PATH, loginWallpaperBase64, () => {});
        data.masterData.settings.loginWallpaperUrl = `/api/wallpaper/login?t=${num}`;
      } else if (url.includes('drive.google.com')) {
        const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                            url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          const fileId = fileIdMatch[1];
          data.masterData.settings.loginWallpaperUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        }
      }
    }

    // Check logoUrl
    if (data.masterData.settings.logoUrl && typeof data.masterData.settings.logoUrl === 'string') {
      const url = data.masterData.settings.logoUrl.trim();
      if (url.startsWith('data:image/')) {
        logoBase64 = url;
        fs.writeFile(LOGO_PATH, logoBase64, () => {});
        data.masterData.settings.logoUrl = `/api/wallpaper/logo?t=${num}`;
      } else if (url.includes('drive.google.com')) {
        const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                            url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          const fileId = fileIdMatch[1];
          data.masterData.settings.logoUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        }
      }
    }
  }
  return data;
};

function serverMergeData(rawLocal: any, rawCloud: any): any {
  if (!rawCloud) return rawLocal;
  if (!rawLocal) return rawCloud;

  // Standardize all dates immediately in both datasets to prevent key misalignment and accidental filtering out of items!
  const local = normalizeDatesInDb(JSON.parse(JSON.stringify(rawLocal)));
  const cloud = normalizeDatesInDb(JSON.parse(JSON.stringify(rawCloud)));

  // Loosened Data Shield on server-side: only guard if cloudList is completely missing or not an array.
  // If the cloudList is present as an array (even if empty), we accept it as-is!
  const majorKeys = ['patients', 'financeRecords', 'dailyReports', 'nursingReports', 'operations', 'incidentReports', 'operationReports', 'instruments', 'doctorVisits', 'qualityMeasurements', 'roomBookings', 'booking_ruangan'];
  majorKeys.forEach(key => {
    const localList = local[key];
    const cloudList = cloud[key];
    if (Array.isArray(localList) && localList.length > 0) {
      if (!cloudList || !Array.isArray(cloudList)) {
        console.warn(`[SERVER DATA SHIELD] Missing field "${key}". Recovering from cached state.`);
        cloud[key] = [...localList];
      }
    }
  });

  const localSettings = local.masterData?.settings || {};
  const cloudSettings = cloud.masterData?.settings || {};
  const localTs = new Date(localSettings.settingsTimestamp || '2000-01-01').getTime();
  const cloudTs = new Date(cloudSettings.settingsTimestamp || '2000-01-01').getTime();

  // Merge deletedIds as permanent UNION across local and cloud (tombstone pattern) to prevent rollback of deletions!
  let mergedDeletedIds: string[] = Array.from(new Set([
    ...(Array.isArray(local.deletedIds) ? local.deletedIds : []),
    ...(Array.isArray(cloud.deletedIds) ? cloud.deletedIds : [])
  ]));
  // Protect super administrator from deletion
  mergedDeletedIds = mergedDeletedIds.filter(id => id !== 'USER_administrator');

  const getItemKeyServer = (item: any, key: string = 'id'): string | null => {
    if (!item) return null;
    if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') return String(item[key]);
    if (item.id !== undefined && item.id !== null && String(item.id).trim() !== '') return String(item.id);
    if (item.patientId && item.date) return `${item.patientId}_${item.date}`;
    if (item.indicatorId && item.date) return `${item.indicatorId}_${item.date}`;
    if (item.noRM && item.bookingDate) return `${item.noRM}_${item.bookingDate}`;
    return null;
  };

  const getLatestTimestampServer = (item: any): number => {
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

  const chooseNonEmptyVal = (primaryVal: any, secondaryVal: any) => {
    if (primaryVal !== undefined && primaryVal !== null) {
      return primaryVal;
    }
    return secondaryVal;
  };

  const mergeRecordProperties = (primaryItem: any, secondaryItem: any): any => {
    if (!primaryItem) return secondaryItem;
    if (!secondaryItem) return primaryItem;
    
    const merged = { ...secondaryItem, ...primaryItem };
    Object.keys(primaryItem).forEach(prop => {
      if (primaryItem[prop] !== undefined && primaryItem[prop] !== null) {
        merged[prop] = primaryItem[prop];
      }
    });
    return merged;
  };

  const mergeList = (localList: any, cloudList: any, key: string = 'id') => {
    const safeLocal = (Array.isArray(localList) ? localList : []).filter(item => item && getItemKeyServer(item, key) !== null);
    const safeCloud = (Array.isArray(cloudList) ? cloudList : []).filter(item => item && getItemKeyServer(item, key) !== null);

    if (safeCloud.length === 0 && safeLocal.length > 0) {
      return safeLocal.filter(item => {
        const k = getItemKeyServer(item, key);
        return k && !mergedDeletedIds.includes(k) && !item.isDeleted && !item.deleted;
      });
    }

    const mergedMap = new Map<string, any>();
    const localKeyMap = new Map<string, any>();
    const cloudKeyMap = new Map<string, any>();

    safeLocal.forEach(i => {
      const k = getItemKeyServer(i, key);
      if (k) localKeyMap.set(k, i);
    });

    safeCloud.forEach(i => {
      const k = getItemKeyServer(i, key);
      if (k) cloudKeyMap.set(k, i);
    });

    const allKeys = new Set<string>([
      ...Array.from(localKeyMap.keys()),
      ...Array.from(cloudKeyMap.keys())
    ]);

    allKeys.forEach(itemId => {
      const localItem = localKeyMap.get(itemId);
      const cloudItem = cloudKeyMap.get(itemId);

      // Thorough tombstone check against item ID, patientId, indicatorId
      const isDeletedInRegistry = mergedDeletedIds.includes(itemId) ||
        (localItem && localItem.id && mergedDeletedIds.includes(String(localItem.id))) ||
        (cloudItem && cloudItem.id && mergedDeletedIds.includes(String(cloudItem.id))) ||
        (localItem && localItem.patientId && mergedDeletedIds.includes(String(localItem.patientId))) ||
        (cloudItem && cloudItem.patientId && mergedDeletedIds.includes(String(cloudItem.patientId))) ||
        (localItem && localItem.indicatorId && mergedDeletedIds.includes(String(localItem.indicatorId))) ||
        (cloudItem && cloudItem.indicatorId && mergedDeletedIds.includes(String(cloudItem.indicatorId)));

      if (isDeletedInRegistry) {
        if (!mergedDeletedIds.includes(itemId)) mergedDeletedIds.push(itemId);
        return;
      }

      const localIsDeleted = !!(localItem && (localItem.isDeleted || localItem.deleted));
      const cloudIsDeleted = !!(cloudItem && (cloudItem.isDeleted || cloudItem.deleted));

      const localLm = getLatestTimestampServer(localItem);
      const cloudLm = getLatestTimestampServer(cloudItem);

      if (localIsDeleted || cloudIsDeleted) {
        if (localIsDeleted) {
          if (!mergedDeletedIds.includes(itemId)) mergedDeletedIds.push(itemId);
          return;
        }
        if (cloudIsDeleted && cloudLm > localLm) {
          if (!mergedDeletedIds.includes(itemId)) mergedDeletedIds.push(itemId);
          return;
        }
      }

      if (localItem && cloudItem) {
        // Favor localItem (client payload) unless cloudItem is strictly newer with a > 30s gap
        if (cloudLm - localLm > 30000) {
          mergedMap.set(itemId, mergeRecordProperties(cloudItem, localItem));
        } else {
          mergedMap.set(itemId, mergeRecordProperties(localItem, cloudItem));
        }
      } else if (localItem && !localIsDeleted) {
        mergedMap.set(itemId, localItem);
      } else if (cloudItem && !cloudIsDeleted) {
        mergedMap.set(itemId, cloudItem);
      }
    });

    return Array.from(mergedMap.values());
  };

  const mergedPatients = mergeList(local.patients || [], cloud.patients || []).map((p: any) => {
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
  });
  const activePatientIds = new Set(mergedPatients.map(p => String(p.id)));
  
  // Merge dailyReports
  const mergedDailyReportsMap = new Map();

  // 1. Process cloud reports (SOURCE OF TRUTH)
  const safeCloudReports = Array.isArray(cloud.dailyReports) ? cloud.dailyReports : [];
  safeCloudReports.forEach((cr: any) => {
    if (cr && cr.patientId && cr.date) {
      const patientIdStr = String(cr.patientId);
      if (mergedDeletedIds.includes(patientIdStr) || cr.isDeleted || cr.deleted) {
        return;
      }
      const key = `${patientIdStr}_${cr.date}`;
      mergedDailyReportsMap.set(key, { ...cr });
    }
  });

  // 2. Process and merge local reports safely
  const safeLocalReports = Array.isArray(local.dailyReports) ? local.dailyReports : [];
  safeLocalReports.forEach((lr: any) => {
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
        const fields = [
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

        const localLm = getLatestTimestampServer(lr);
        const cloudLm = getLatestTimestampServer(cloudReport);

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
            // Fallback jika tidak ada stempel waktu per-kolom: LATEST ENTRY TIMESTAMP WINS or NON-EMPTY CONTENT PRESERVED
            if (localLm >= cloudLm) {
              merged[f] = chooseNonEmptyVal(localVal, cloudVal);
            } else {
              merged[f] = chooseNonEmptyVal(cloudVal, localVal);
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

  const localBookings = [
    ...(Array.isArray(local.roomBookings) ? local.roomBookings : []),
    ...(Array.isArray(local.booking_ruangan) ? local.booking_ruangan : [])
  ];
  const cloudBookings = [
    ...(Array.isArray(cloud.roomBookings) ? cloud.roomBookings : []),
    ...(Array.isArray(cloud.booking_ruangan) ? cloud.booking_ruangan : [])
  ];
  const mergedRoomBookings = mergeList(localBookings, cloudBookings);

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
      cloud.masterData.users.forEach((cu: any) => {
        const idx = mergedUsers.findIndex((lu: any) => lu.username === cu.username);
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
  finalUsers = finalUsers.filter((u: any) => {
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
      // Let edited properties in finalUsers override the initial user constants properties
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

function serverMergeMasterData(local: any, cloud: any): any {
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

  // Pre-calculate merged doctor list and metadata using fallback definitions as base, ensuring hardcoded doctors never get deleted
  const doctors = Array.from(new Set([
    ...(fallback.doctors || []),
    ...(c.doctors || []),
    ...(l.doctors || [])
  ]));

  const doctorMetadata = {
    ...(fallback.doctorMetadata || {}),
    ...(c.doctorMetadata || {}),
    ...(l.doctorMetadata || {})
  };

  // Pre-calculate merged nurse list and metadata using fallback definitions as base, ensuring hardcoded nurses never get deleted
  const rawNurses = [
    ...(fallback.nurses || []),
    ...(c.nurses || []),
    ...(l.nurses || [])
  ];
  const migratedNurses: string[] = [];
  const seenNurses = new Set<string>();
  rawNurses.forEach(n => {
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
        migratedNurses.push(cleanN);
    }
  });
  const nurses = migratedNurses;

  const rawMetadata = {
    ...(fallback.nurseMetadata || {}),
    ...(c.nurseMetadata || {}),
    ...(l.nurseMetadata || {})
  };
  const nurseMetadata: Record<string, any> = {};
  Object.keys(rawMetadata).forEach(key => {
    let cleanKey = key;
    const trimmed = key.trim();
    if (trimmed === "Nila Sisnawati,A.Md.Kep" || trimmed === "NILA SISNAWATI") {
        cleanKey = "NILA SISNAWATI";
    } else if (trimmed === "Saufia Hayati Umajan, S.Kep.Ns" || trimmed === "SAUFIA HAYATI UMAJAN") {
        cleanKey = "SAUFIA HAYATI UMAJAN";
    } else if (trimmed === "Yayuk Aprianis,A.Md.Kep" || trimmed === "Yayuk aprianis") {
        cleanKey = "Yayuk aprianis";
    }
    nurseMetadata[cleanKey] = rawMetadata[key];
  });

  if (lTs > cTs) {
    // Local is strictly newer. Use local's list structures as-is to respect deletions & additions, but retain hardcoded fallback doctors & nurses
    return {
      ...fallback,
      ...c,
      ...l,
      doctors,
      doctorMetadata,
      nurses,
      nurseMetadata,
      restrictedDrugs
    };
  } else if (cTs > lTs) {
    // Cloud is strictly newer. Use cloud's list structures as-is, but retain hardcoded fallback doctors & nurses
    return {
      ...fallback,
      ...l,
      ...c,
      doctors,
      doctorMetadata,
      nurses,
      nurseMetadata,
      restrictedDrugs
    };
  }

  // Default backup merge logic (fallback when timestamps are identical or missing)
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
}

  const mergedMasterData = serverMergeMasterData(local.masterData, cloud.masterData);

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
    booking_ruangan: mergedRoomBookings,
    deletedIds: mergedDeletedIds,
    masterData: { 
      ...mergedMasterData,
      settings: finalSettings,
      users: finalUsers 
    }
  };
}

app.use(cors());
app.use(bodyParser.json({ limit: '100mb' })); // Increase body limit for large images
// Keep payload parsing fully aligned
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

// Helper for Google Sheets integration
const getDoc = async () => {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!serviceAccountEmail || !privateKey || !sheetId) {
    return null;
  }

  const auth = new JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  return doc;
};

// --- API ROUTES ---

app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

// Auto Backup Engine supporting Daily, Weekly, Monthly, and Yearly intervals
function runAutoBackup(data: any) {
  if (!data) return;
  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Calculate week of year
    const getWeekNumber = (d: Date) => {
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
      }
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    };
    const weekStr = `${now.getFullYear()}-W${getWeekNumber(now)}`;
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yearStr = `${now.getFullYear()}`;

    // Evaluate and trigger backup if out-of-date or missing
    const evaluateBackup = (type: string, keyString: string) => {
      const filePath = path.join(backupsDir, `auto_${type}.json`);
      let shouldBackup = false;
      
      if (!fs.existsSync(filePath)) {
        shouldBackup = true;
      } else {
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (content.backupKey !== keyString) {
            shouldBackup = true;
          }
        } catch (e) {
          shouldBackup = true;
        }
      }
      
      if (shouldBackup) {
        const backupPayload = {
          backupType: type,
          backupKey: keyString,
          timestamp: now.toISOString(),
          data: data
        };
        fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2));
        console.log(`[BACKUP] Auto ${type} backup created for key ${keyString}`);
      }
    };

    evaluateBackup('daily', dateStr);
    evaluateBackup('weekly', weekStr);
    evaluateBackup('monthly', monthStr);
    evaluateBackup('yearly', yearStr);
  } catch (err) {
    console.error('Failed to write auto backup:', err);
  }
}

// Lazy initialization of Gemini API Client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is not defined on the server container');
    }
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return geminiClient;
}

// AI Route 1: Automatically split and clean patient diagnoses
app.post('/api/split-diagnoses', async (req, res) => {
  try {
    const { diagnosisText } = req.body;
    if (!diagnosisText || typeof diagnosisText !== 'string' || diagnosisText.trim() === '') {
      return res.json({ success: true, results: [] });
    }

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Anda adalah asisten AI medis rumah sakit senior. Tugas Anda adalah menganalisis, memecahkan, dan menyaring teks diagnosa medis pasien menjadi kumpulan nama penyakit tunggal (single primary / secondary diagnosis) yang formal dan terstandar (misal: ICD-10).

Teks Diagnosa Gabungan: "${diagnosisText}"

ATURAN STRUKTUR & KEBERSIHAN DIAGNOSA (SANGAT PENTING):
1. Abaikan/buang qualifier tindakan operasi, debridement atau prosedur sekunder seperti "post op...", "ec post laparatomi...", "pro debridement", "on planning", atau status rehabilitasi. Ambil hanya nama penyakit utamanya (contoh: "post debridement ec Ulkus DM" dipotong hanya menjadi "Diabetes Melitus" atau "Ulkus Diabetikum").
2. Jika ada singkatan, urutkan menjadi nama resmi yang dipahami umum (Contoh: "CKR" menjadi "Cedera Kepala Ringan (CKR)", "HT" menjadi "Hipertensi", "DM" menjadi "Diabetes Melitus", "CKD" menjadi "Chronic Kidney Disease (CKD)", "CHF" menjadi "Congestive Heart Failure (CHF)", "APP" menjadi "Apendisitis").
3. Jangan pernah memasukkan keterangan penyebab eksternal yang tidak formal, seperti "ec jatuh", "ec kecelakaan", "ec tabrakan" sebagai diagnosa sendiri. Hubungkan menjadi satu diagnosa bersih (misal: "Cedera Kepala Ringan (CKR)") atau abaikan bagian "ec jatuh" nya sepenuhnya.
4. Pastikan teks akhir yang dikembalikan adalah frasa penyakit tunggal, formal, dan bersih dari simbol aneh.

Kembalikan hasilnya dalam format JSON murni dengan schema:
{
  "results": ["Nama Penyakit Resmi 1", "Nama Penyakit Resmi 2"]
}
Pastikan hanya mengembalikan JSON valid, tanpa markdown backticks (\`\`\`), tanpa penjelasan tambahan, murni JSON.`,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const parsed = JSON.parse(text.trim());
    return res.json({ success: true, results: parsed.results || [] });
  } catch (error: any) {
    console.error('AI Split Diagnoses Error:', error);
    // Graceful fallback split
    const fallback = (req.body.diagnosisText || '')
      .split(/[,;+/]|\s+dan\s+|\s+with\s+/i)
      .map((v: string) => v.trim())
      .filter((v: string) => v.length > 1);
    return res.json({ success: true, results: fallback, warning: error.message });
  }
});

// AI Route 2: Automatically detect and analyze drug restrictions from therapy text
app.post('/api/analyze-therapy', async (req, res) => {
  try {
    const { therapyText } = req.body;
    if (!therapyText || typeof therapyText !== 'string' || therapyText.trim() === '') {
      return res.json({ success: true, analysis: 'Terapi kosong. Masukkan daftar terapi terlebih dahulu.' });
    }

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Anda adalah apoteker klinis rumah sakit senior. Tugas Anda adalah membaca daftar terapi/obat berikut dan memberikan analisis pembatasan/restriksi waktu penggunaan obat (restriksi durasi penggunaan obat, misalnya Ketorolac maksimal 3 hari, antibiotik golongan tinggi 5-7 hari, NSAID, kortikosteroid, dll.).
Daftar Terapi Medis: "${therapyText}"

Jelaskan dengan bahasa Indonesia yang sangat sopan, profesional, ringkas dan mudah dipahami:
1. Obat apa saja yang terjadwal yang memiliki restriksi penggunaan obat.
2. Rekomendasi/durasi aman penggunaan obat tersebut.
3. Tindakan lanjut atau peringatan jika penggunaan terus ditingkatkan.
Rancang keluaran Anda dengan rapi menggunakan poin-poin/list-item.`
    });

    return res.json({ success: true, analysis: response.text || '' });
  } catch (error: any) {
    console.error('AI Analyze Therapy Error:', error);
    return res.json({ success: true, analysis: 'Gagal menganalisis terapi secara real-time dengan AI: ' + error.message });
  }
});

// AI Route 3: AI-Driven Self Healing and Data Sanity Guard
app.post('/api/ai-self-heal', async (req, res) => {
  try {
    let appDataToHeal = cachedData || INITIAL_DATA;
    const logs: string[] = [];

    logs.push('[START] Menginisiasi proses autodiagnostik & pemulihan sistem oleh AI...');

    // 1. Check patients structure
    if (appDataToHeal.patients && Array.isArray(appDataToHeal.patients)) {
      const initialCount = appDataToHeal.patients.length;
      appDataToHeal.patients = appDataToHeal.patients.filter((p: any) => p && p.id && (p.name || p.noRM));
      const afterCount = appDataToHeal.patients.length;
      if (initialCount !== afterCount) {
        logs.push(`[REPAIR] Menghapus ${initialCount - afterCount} rekam medis kosong/corrupted.`);
      }

      // Deduplicate by noRM
      const seenRMs = new Set<string>();
      const dedupPatients: any[] = [];
      appDataToHeal.patients.forEach((p: any) => {
        const rm = p.noRM ? p.noRM.trim() : '';
        if (rm === '') {
          dedupPatients.push(p);
        } else if (!seenRMs.has(rm)) {
          seenRMs.add(rm);
          dedupPatients.push(p);
        } else {
          // Merge duplicates
          const originalIdx = dedupPatients.findIndex((orig: any) => orig.noRM === rm);
          if (originalIdx !== -1) {
            dedupPatients[originalIdx] = {
              ...dedupPatients[originalIdx],
              ...p,
              id: dedupPatients[originalIdx].id,
              lastModified: new Date().toISOString()
            };
          }
        }
      });
      if (appDataToHeal.patients.length !== dedupPatients.length) {
        logs.push(`[OPTIMIZE] Melakukan de-duplikasi & merging rekam medis ganda. Berhasil memadukan ${appDataToHeal.patients.length - dedupPatients.length} duplikat.`);
        appDataToHeal.patients = dedupPatients;
      }

      // Set missing lastModified on patients
      let backfilledPatients = 0;
      appDataToHeal.patients.forEach((p: any) => {
        if (!p.lastModified) {
          p.lastModified = new Date().toISOString();
          backfilledPatients++;
        }
      });
      if (backfilledPatients > 0) {
        logs.push(`[REPAIR] Memberikan stempel waktu lastModified pada ${backfilledPatients} pasien.`);
      }
    }

    // 2. Check and repair dailyReports
    if (appDataToHeal.dailyReports && Array.isArray(appDataToHeal.dailyReports)) {
      appDataToHeal.dailyReports = appDataToHeal.dailyReports.filter((r: any) => r && r.patientId && r.date);
      let modifiedReports = 0;
      appDataToHeal.dailyReports.forEach((r: any) => {
        if (!r.lastModified) {
          r.lastModified = new Date().toISOString();
          modifiedReports++;
        }
      });
      if (modifiedReports > 0) {
        logs.push(`[REPAIR] Memperbaiki stempel sinkronisasi lastModified pada ${modifiedReports} catatan harian keperawatan.`);
      }
    }

    // 3. Auto-fix / Backfill "ketergantungan-pasien-1" missing audits from dailyReports
    if (appDataToHeal.qualityMeasurements && Array.isArray(appDataToHeal.qualityMeasurements)) {
      let repairAuditCount = 0;
      appDataToHeal.qualityMeasurements = appDataToHeal.qualityMeasurements.map((m: any) => {
        if (m.indicatorId === 'ketergantungan-pasien-1') {
          const dateStr = m.date;
          const reportsForDate = (appDataToHeal.dailyReports || []).filter((r: any) => r.date === dateStr);
          const activePatients = (appDataToHeal.patients || []).filter((p: any) => {
            const hasReport = (appDataToHeal.dailyReports || []).some((r: any) => r.patientId === p.id && r.date === dateStr);
            const isDischarged = p.status === 'DISCHARGED' || (p.statusDataPasien && (
              p.statusDataPasien.toUpperCase().includes('BPL') ||
              p.statusDataPasien.toUpperCase().includes('PULANG') ||
              p.statusDataPasien.toUpperCase().includes('APS')
            ));
            return !isDischarged || hasReport;
          });

          const currentAuditData = m.auditData || [];
          let auditChanged = false;

          const mergedAudits = activePatients.map((p: any) => {
            const matchedReport = reportsForDate.find((r: any) => r.patientId === p.id);
            const existingAudit = currentAuditData.find((a: any) => {
              const hasRm = p.noRM && p.noRM.trim() !== '';
              if (hasRm) return a.patientName.includes(p.noRM);
              return p.name && p.name.trim() !== '' && a.patientName.includes(p.name);
            });

            const mDep = matchedReport?.morningDependency || existingAudit?.morning || '';
            const aDep = matchedReport?.afternoonDependency || existingAudit?.afternoon || '';
            const nDep = matchedReport?.nightDependency || existingAudit?.night || '';
            const isCompliant = !!(mDep || aDep || nDep);

            if (!existingAudit || (!existingAudit.morning && mDep) || (!existingAudit.afternoon && aDep) || (!existingAudit.night && nDep)) {
              auditChanged = true;
            }

            return {
              id: existingAudit?.id || (Date.now() + Math.random()),
              patientName: `${p.name} (${p.noRM})`,
              roomBed: `${p.ruangan || '-'} / ${p.nomorBed || '-'}`,
              morning: mDep,
              afternoon: aDep,
              night: nDep,
              compliant: isCompliant
            };
          });

          if (auditChanged) {
            repairAuditCount++;
            const den = mergedAudits.length;
            const num = mergedAudits.filter((d: any) => !!(d.morning || d.afternoon || d.night)).length;
            
            return {
              ...m,
              numeratorValue: num,
              denominatorValue: den,
              auditData: mergedAudits,
              lastModified: new Date().toISOString()
            };
          }
        }
        return m;
      });

      if (repairAuditCount > 0) {
        logs.push(`[AI SELF-HEAL] Menyelaraskan kembali ${repairAuditCount} kertas kerja tingkat ketergantungan pasien dari laporan keperawatan.`);
      }
    }

    // Save final healed data back to server database cache and disk
    cachedData = appDataToHeal;
    try {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cachedData, null, 2));
      logs.push('[SUCCESS] Integrasi Data Cache server telah disterilkan & diperbarui pada disk.');
      runAutoBackup(cachedData); 
    } catch (saveErr: any) {
      logs.push('[ERROR] Gagal menulis data pemulihan ke disk: ' + saveErr.message);
    }

    // 4. Involve Gemini to write a self-repair diagnosis report and advice
    let aiExplanation = '';
    try {
      const ai = getGemini();
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Anda adalah pengawas kecerdasan buatan (System Operator AI) untuk aplikasi Simantap ICU. Sistem baru saja menjalankan prosedur otomatis pencegahan kehilangan data, deduplikasi, dan perataan kertas kerja mutu.
        
Log audit perbaikan eksternal:
${logs.join('\n')}

Silakan berikan ulasan ringkas dan sangat ramah dengan gaya bahasa Indonesia yang formal mengenai tindakan yang sudah diambil di server, jaminan integritas data yang masuk ke server serta saran praktis agar rekam medis yang dicatat perawat tetap sinkron di banyak perangkat medis.`
      });
      aiExplanation = geminiResponse.text || '';
    } catch (gem_err: any) {
      aiExplanation = `Autodiagnostik sukses. Sistem database cache dinamis dibersihkan tipe-tipenya, stempel sinkronisasi lastModified ditambahkan, duplikat RM diselesaikan. (Saran Ops: Pastikan semua tablet ICU menggunakan login akun resmi yang sama dan menekan tombol Tarik Laporan secara berkala).`;
    }

    return res.json({
      success: true,
      logs,
      aiExplanation,
      data: appDataToHeal
    });
  } catch (err: any) {
    console.error('AI Self Heal Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET all backups on server (auto and manual)
app.get('/api/backups', (req, res) => {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.json'));
    const backupList = files.map(file => {
      const filePath = path.join(backupsDir, file);
      const stats = fs.statSync(filePath);
      try {
        const meta = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          filename: file,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          timestamp: meta.timestamp || stats.mtime.toISOString(),
          backupType: meta.backupType || (file.startsWith('auto_') ? file.replace('auto_', '').replace('.json', '') : 'manual'),
          backupKey: meta.backupKey || file,
          note: meta.note || ''
        };
      } catch (e) {
        return {
          filename: file,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          timestamp: stats.mtime.toISOString(),
          backupType: 'corrupted',
          backupKey: file,
          note: 'File backup corrupt atau tidak valid'
        };
      }
    });

    // Sort backups by timestamp descending
    backupList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({ success: true, backups: backupList });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST to create a manual backup on server
app.post('/api/backups/create', (req, res) => {
  try {
    const { note } = req.body;
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const now = new Date();
    // Safe timestamp format for filenames
    const timestampStr = now.toISOString().replace(/[:.]/g, '-');
    const filename = `manual_${timestampStr}.json`;
    const filePath = path.join(backupsDir, filename);

    const backupPayload = {
      backupType: 'manual',
      backupKey: filename,
      timestamp: now.toISOString(),
      note: note || 'Pencadangan manual oleh Administrator',
      data: cachedData || INITIAL_DATA
    };

    fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2));
    return res.json({ success: true, filename, timestamp: now.toISOString() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST to restore a backup file to server memory & disk
app.post('/api/backups/restore', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Nama file backup diperlukan' });
    }
    const backupsDir = path.join(process.cwd(), 'backups');
    const filePath = path.join(backupsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File backup tidak ditemukan' });
    }

    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!payload || !payload.data) {
      return res.status(400).json({ success: false, error: 'Konten data backup tidak valid' });
    }

    // Replace server cache
    cachedData = payload.data;
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cachedData, null, 2));
    broadcastEvent({ type: 'data-update' });

    return res.json({ success: true, message: `Berhasil merestore data database dari file cadangan: ${filename}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST to delete a backup file on server
app.post('/api/backups/delete', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Nama file backup diperlukan' });
    }
    const backupsDir = path.join(process.cwd(), 'backups');
    const filePath = path.join(backupsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return res.json({ success: true, message: `Backup file ${filename} berhasil dihapus.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST to compile a patient's entire medical record and shift reports into a unified diagnosis summary using AI
app.post('/api/compile-patient-diagnosis', async (req, res) => {
  try {
    const { patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ success: false, error: 'patientId is required' });
    }

    const currentData = cachedData || INITIAL_DATA;
    const patientObj = (currentData.patients || []).find((p: any) => p.id === patientId);
    if (!patientObj) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Accumulate all clinical entries
    const diagnosisAwal = patientObj.diagnosaUtama || '';
    const patientReports = (currentData.dailyReports || []).filter((r: any) => r.patientId === patientId);
    
    const dailyNotes: string[] = [];
    patientReports.forEach((r: any) => {
      if (r.diagnosis && r.diagnosis.trim() !== '') {
        dailyNotes.push(`- Tanggal Laporan ${r.date}: Diagnosa Shift: ${r.diagnosis.trim()}`);
      }
      if (r.surgeryProcedure && r.surgeryProcedure.trim() !== '') {
        dailyNotes.push(`- Tanggal Operasi ${r.date}: Prosedur Tindakan Bedah: ${r.surgeryProcedure.trim()} (Operator: ${r.surgeryOperator || '-'})`);
      }
      if (r.morningReport && r.morningReport.trim() !== '') {
        dailyNotes.push(`- Catatan Shift Pagi: ${r.morningReport.trim()}`);
      }
      if (r.afternoonReport && r.afternoonReport.trim() !== '') {
        dailyNotes.push(`- Catatan Shift Sore: ${r.afternoonReport.trim()}`);
      }
      if (r.nightReport && r.nightReport.trim() !== '') {
        dailyNotes.push(`- Catatan Shift Malam: ${r.nightReport.trim()}`);
      }
    });

    const aiInput = `PASIEN MATRIKS KEPERAWATAN:
ID Pasien: ${patientObj.id}
Nama Pasien: ${patientObj.name}
No Rekam Medis: ${patientObj.noRM}
Jenis Kelamin: ${patientObj.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
Ruangan/Bed: ${patientObj.ruangan || '-'} / ${patientObj.nomorBed || '-'}

DIAGNOSA AWAL / UTAMA SAAT MASUK:
"${BREAK_TAG(diagnosisAwal)}"

CATATAN DAILY REPORTS & NARASI SHIFT PERAWAT DI ICU/BEDAH:
${dailyNotes.length > 0 ? dailyNotes.join('\n') : '(Tidak ada catatan harian shift)'}

TUGAS ANDA:
Analisislah semua teks medis di atas secara holistik (dari diagnosa awal, catatan harian shift keperawatan, hingga diagnosa pasca-prosedur operasi) untuk membuat "Kompilasi Diagnosa Medis Akhir Terintegrasi".

ATURAN KRITIS (STANDAR KEILMUAN MEDIS / ICD-10):
1. GUNAKAN STANDAR DIAGNOSA YANG SESUAI STANDAR KEILMUAN KEDOKTERAN (seperti standar ICD-10). Diagnosa harus menunjukkan keadaan klinis/patologis yang jelas, BUKAN HANYA nama regio tubuh atau nama tindakan/prosedur bedah.
2. JANGAN PERNAH menyajikan nama prosedur operasi saja (seperti "ORIF", "ORIF MANDIBULA", "ORIF CLAVICULA", "APENDEKTOMI", "LAPARATOMI") sebagai diagnosa. Konversikan ke diagnosa ilmiah yang sesuai, contoh: "FRAKTUR FEMUR DEXTRA DENGAN TINDAKAN POST-ORIF", "APENDISITIS ACUTA DENGAN TINDAKAN POST-APENDEKTOMI".
3. JANGAN PERNAH menyajikan deskripsi/nama regio anatomi tubuh saja atau deskripsi trauma mentah (seperti "THORACAL ANTERIOR", "EKSTREMITAS SUPERIOR", "TRAUMA EKSTREMITAS SUPERIOR BILATERAL") sebagai diagnosa. Anda wajib memetakan atau melengkapinya menjadi diagnosa ilmiah yang berfaedah klinis, seperti: "TRAUMA THORAKS / CHEST TRAUMA", "FRAKTUR DUMP REGIO EKSTREMITAS SUPERIOR BILATERAL", "VULNUS LACERATUM REGIO THORACAL ANTERIOR".
4. Untuk diagnosa seperti abses ("ABSES"), pertahankan dengan jelas regio anatomi asalnya (misal: "ABSES SUBMANDIBULA", "ABSES GLUTEUS") agar bernilai klinis tinggi.

Berikan hasil yang ringkas, formal, terstruktur dalam Bahasa Indonesia medis, berisi:
1. DIAGNOSA UTAMA (Hasil sintesis akhir kondisi primer pasien sesuai standar keilmuan).
2. DIAGNOSA SEKUNDER & KOMPLIKASI AKTIF (Jika terdeteksi di laporan harian, tulis dengan penomoran/poin).
3. PROSEDUR TINDAKAN TERIKAT (Sebutkan operasi atau intervensi klinis utama yang telah dilakukan).

Format output harus bersih, ringkas, profesional, mudah dibaca cepat oleh dokter & perawat di ICU. Jangan menulis intro panjang lebar, mulailah langsung dengan hasil kompilasi.`;

    function BREAK_TAG(str: string) {
       return str.replace(/<[^>]*>/g, '');
    }

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: aiInput
    });

    const compiledText = result.text || 'Gagal menghasilkan kompilasi otomatis dari AI.';
    return res.json({ success: true, compiledDiagnosis: compiledText });
  } catch (err: any) {
    console.error('Error compiling patient diagnosis:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST to take a list of raw diagnoses and output standardized, clinical entries using AI
app.post('/api/standardize-diagnoses-ai', async (req, res) => {
  try {
    const rawDiagnosisList = req.body.rawDiagnosisList || req.body.diagnosesList;
    if (!rawDiagnosisList || !Array.isArray(rawDiagnosisList)) {
      return res.status(400).json({ success: false, error: 'rawDiagnosisList atau diagnosesList harus berupa array yang valid' });
    }

    const aiInput = `Anda adalah Medical Data Analyst AI yang ahli dalam standardisasi klasifikasi diagnosis klinis sesuai dengan standar kualifikasi keilmuan medis.
Berikut adalah daftar entri diagnosis medis mentah yang diinput oleh dokter dan perawat di unit ICU/Bedah dari database kami (beserta jumlah frekuensinya):

${JSON.stringify(rawDiagnosisList, null, 2)}

TUGAS PENTING & STRIK:
1. ELIMINASI PROSEDUR & DIAGNOSA KEPERAWATAN (WAJIB):
   - Anda harus mendeteksi, menyaring, membuang, dan MENGABAIKAN seluruh Tindakan/Prosedur Medis Operasi (Contoh yang HARUS DIHAPUS: ORIF, OREF, Debridement, Appendectomy, Apendektomi, Amputasi, Laparotomi, Hernioplasti, Sectio, SC, TURP, dll.). Jangan memasukkannya ke dalam daftar akhir.
   - Anda harus mendeteksi, menyaring, membuang, dan MENGABAIKAN seluruh Diagnosa Keperawatan (Contoh yang HARUS DIHAPUS: Nyeri Akut, Bersihan Jalan Napas Tidak Efektif, Gangguan Mobilitas Fisik, Ansietas, Gangguan Pola Tidur, Risiko Infeksi, Defisit Nutrisi, dll.). Jangan memasukkannya ke dalam daftar akhir.

2. BERSIHKAN KODE ANGKA ICD-10:
   - Bersihkan dan buang semua kode angka ICD-10 (seperti K59.0, M84.1, A09, K35, N18, dll.) dari nama diagnosis. Ambil nama penyakit/kondisi medisnya saja (misal: "K35 - Acute Appendicitis" atau "K35" menjadi "Appendicitis").

3. STANDARISASI & PENGELOMPOKAN ISTILAH KLINIS UMUM:
   - Petakan/kelompokkan entri-entri diagnosis mentah yang bermakna sama atau sinonim ke dalam satu kategori utama medis yang standar, profesional, ilmiah, bersih, dan ditulis dalam Title Case / Huruf Kapital wajar (contoh: "CKR", "CEDERA KEPALA RINGAN", "POST CKR" harus digabungkan ke kategori "Cedera Kepala Ringan (CKR)").
   - Selesaikan inkonsistensi penulisan, singkatan (seperti HT -> Hipertensi, DM -> Diabetes Melitus), typo kecil, atau tambahan prosedur yang menempel.
   - Contoh luaran diagnosa medis yang harus bersih, terkelompok, dan terhitung dengan benar: "Cedera Kepala Ringan (CKR)", "Abdominal Pain", "Appendicitis", "Batu Buli", "Batu Ureter", "Hernia Inguinalis", "Benign Prostatic Hyperplasia (BPH)", "Fracture Femur", "Struma / Goitre", dll.

4. Jumlahkan total kemunculan (frekuensi) setelah pengelompokan yang cerdas, klinis, ilmiah, dan sangat akurat ini.
5. Kembalikan data dalam format JSON murni terstruktur berupa array of objects yang rapi:
[
  { "name": "Nama Diagnosa Standar Ilmiah", "count": jumlah_total_kumulatif, "matchedOriginals": ["istilah_mentah1", "istilah_mentah2"] }
]
6. Hanya kembalikan array JSON murni, jangan ada markdown block \`\`\`json atau penjelasan tambahan apa pun.`;

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: aiInput,
      config: {
        responseMimeType: 'application/json'
      }
    });

    try {
      const parsed = JSON.parse(result.text || '[]');
      return res.json({ success: true, standardizedList: parsed });
    } catch (parseErr) {
      console.error('Failed to parse AI output as JSON, attempting cleanup:', result.text);
      let cleanText = (result.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedFallback = JSON.parse(cleanText || '[]');
      return res.json({ success: true, standardizedList: parsedFallback });
    }
  } catch (err: any) {
    console.error('Error standardizing diagnoses with AI:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    hasAppsScriptUrl: !!(serverConfig.appsScriptUrl || process.env.VITE_APPS_SCRIPT_URL),
    appsScriptUrl: serverConfig.appsScriptUrl || process.env.VITE_APPS_SCRIPT_URL || null,
    enableGoogleSheets: !!serverConfig.enableGoogleSheets,
    googleSpreadsheetId: serverConfig.googleSpreadsheetId || process.env.GOOGLE_SHEET_ID || null,
    appName: serverConfig.appName || 'SiMANTAP',
    appSlogan: serverConfig.appSlogan || 'Manajemen Laporan Terpadu & Akurat',
    logoUrl: serverConfig.logoUrl || '',
    logoLetterLeftUrl: serverConfig.logoLetterLeftUrl || '',
    logoLetterRightUrl: serverConfig.logoLetterRightUrl || '',
    loginWallpaperUrl: serverConfig.loginWallpaperUrl || '',
    appWallpaperUrl: serverConfig.appWallpaperUrl || '',
    themeColor: serverConfig.themeColor || '#144272',
    fontColor: serverConfig.fontColor || '#ffffff',
    isSidebarAutohide: !!serverConfig.isSidebarAutohide
  });
});

// --- CONCURRENCY LOCK ENGINE ---
let patientLocks: { [patientId: string]: { username: string; lockedAt: number } } = {};

app.get('/api/patients/locks', (req, res) => {
  const now = Date.now();
  // Clear locks older than 10 minutes
  Object.keys(patientLocks).forEach(id => {
    if (now - patientLocks[id].lockedAt >= 10 * 60 * 1000) {
      delete patientLocks[id];
    }
  });
  res.json({ success: true, locks: patientLocks });
});

app.post('/api/patients/:id/lock', (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, error: 'Username is required' });
  }

  const now = Date.now();
  // Clear locks older than 10 minutes
  Object.keys(patientLocks).forEach(pid => {
    if (now - patientLocks[pid].lockedAt >= 10 * 60 * 1000) {
      delete patientLocks[pid];
    }
  });

  const existingLock = patientLocks[id];
  if (existingLock) {
    if (existingLock.username !== username && (now - existingLock.lockedAt < 10 * 60 * 1000)) {
      return res.json({
        success: false,
        lockedBy: existingLock.username,
        lockedAt: existingLock.lockedAt,
        message: `Pasien sedang diedit oleh ${existingLock.username}`
      });
    }
  }

  patientLocks[id] = { username, lockedAt: now };
  broadcastEvent({ type: 'patient-locks', locks: patientLocks });
  res.json({ success: true, locks: patientLocks });
});

app.post('/api/patients/:id/unlock', (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  const existingLock = patientLocks[id];
  if (existingLock && existingLock.username === username) {
    delete patientLocks[id];
    broadcastEvent({ type: 'patient-locks', locks: patientLocks });
  }
  res.json({ success: true, locks: patientLocks });
});

// --- REAL-TIME SERVER-SENT EVENTS (SSE) SYSTEM CONFIG ---
let sseClients: any[] = [];

export function broadcastEvent(data: any) {
  sseClients.forEach(client => {
    try {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
      if (typeof (client as any).flush === 'function') {
        (client as any).flush();
      }
    } catch (e) {
      // closed connection is fine
    }
  });
}

const SERVER_APP_VERSION = "2.3.0-zero-lag-vercel-sync";

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial handshake with system version
  res.write(`data: ${JSON.stringify({ type: 'handshake', version: SERVER_APP_VERSION })}\n\n`);
  if (typeof (res as any).flush === 'function') {
    (res as any).flush();
  }

  sseClients.push(res);

  // Periodic active heartbeat ping
  const pingInterval = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
    } catch (e) {}
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients = sseClients.filter(client => client !== res);
  });
});

app.post('/api/config', (req, res) => {
  const { 
    appsScriptUrl, enableGoogleSheets, googleSpreadsheetId,
    appName, appSlogan, logoUrl, loginWallpaperUrl, appWallpaperUrl,
    themeColor, fontColor, isSidebarAutohide,
    logoLetterLeftUrl, logoLetterRightUrl
  } = req.body;
  
  if (typeof appsScriptUrl === 'string') {
    serverConfig.appsScriptUrl = appsScriptUrl;
  }
  if (typeof enableGoogleSheets === 'boolean') {
    serverConfig.enableGoogleSheets = enableGoogleSheets;
  } else if (enableGoogleSheets === undefined && typeof appsScriptUrl === 'string') {
    // preserve/infer based on whether URL was provided or cleared
    serverConfig.enableGoogleSheets = appsScriptUrl.trim() !== '';
  }
  if (typeof googleSpreadsheetId === 'string') {
    serverConfig.googleSpreadsheetId = googleSpreadsheetId;
  }

  // Theme settings
  if (typeof appName === 'string') serverConfig.appName = appName;
  if (typeof appSlogan === 'string') serverConfig.appSlogan = appSlogan;
  if (typeof themeColor === 'string') serverConfig.themeColor = themeColor;
  if (typeof fontColor === 'string') serverConfig.fontColor = fontColor;
  if (typeof isSidebarAutohide === 'boolean') serverConfig.isSidebarAutohide = isSidebarAutohide;
  if (typeof logoLetterLeftUrl === 'string') serverConfig.logoLetterLeftUrl = logoLetterLeftUrl;
  if (typeof logoLetterRightUrl === 'string') serverConfig.logoLetterRightUrl = logoLetterRightUrl;

  const num = Date.now();
  if (typeof logoUrl === 'string') {
    if (logoUrl.startsWith('data:image/')) {
      logoBase64 = logoUrl;
      fs.writeFileSync(LOGO_PATH, logoBase64);
      serverConfig.logoUrl = `/api/wallpaper/logo?t=${num}`;
    } else {
      serverConfig.logoUrl = logoUrl;
    }
  }
  if (typeof appWallpaperUrl === 'string') {
    if (appWallpaperUrl.startsWith('data:image/')) {
      appWallpaperBase64 = appWallpaperUrl;
      fs.writeFileSync(APP_WALLPAPER_PATH, appWallpaperBase64);
      serverConfig.appWallpaperUrl = `/api/wallpaper/app?t=${num}`;
    } else {
      serverConfig.appWallpaperUrl = appWallpaperUrl;
    }
  }
  if (typeof loginWallpaperUrl === 'string') {
    if (loginWallpaperUrl.startsWith('data:image/')) {
      loginWallpaperBase64 = loginWallpaperUrl;
      fs.writeFileSync(LOGIN_WALLPAPER_PATH, loginWallpaperBase64);
      serverConfig.loginWallpaperUrl = `/api/wallpaper/login?t=${num}`;
    } else {
      serverConfig.loginWallpaperUrl = loginWallpaperUrl;
    }
  }

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(serverConfig, null, 2));

    // Sync back into cachedData too so that general queries are always updated with newest settings
    if (cachedData && cachedData.masterData) {
      if (!cachedData.masterData.settings) cachedData.masterData.settings = {};
      cachedData.masterData.settings = {
        ...cachedData.masterData.settings,
        appName: serverConfig.appName,
        appSlogan: serverConfig.appSlogan,
        logoUrl: serverConfig.logoUrl,
        logoLetterLeftUrl: serverConfig.logoLetterLeftUrl,
        logoLetterRightUrl: serverConfig.logoLetterRightUrl,
        loginWallpaperUrl: serverConfig.loginWallpaperUrl,
        appWallpaperUrl: serverConfig.appWallpaperUrl,
        themeColor: serverConfig.themeColor,
        fontColor: serverConfig.fontColor,
        isSidebarAutohide: serverConfig.isSidebarAutohide,
        settingsTimestamp: new Date().toISOString()
      };
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cachedData, null, 2));
    }

    // Broadcast theme update globally across all connected devices reactively
    broadcastEvent({ 
      type: 'theme-update', 
      settings: {
        appName: serverConfig.appName,
        appSlogan: serverConfig.appSlogan,
        logoUrl: serverConfig.logoUrl,
        loginWallpaperUrl: serverConfig.loginWallpaperUrl,
        appWallpaperUrl: serverConfig.appWallpaperUrl,
        themeColor: serverConfig.themeColor,
        fontColor: serverConfig.fontColor,
        isSidebarAutohide: serverConfig.isSidebarAutohide
      } 
    });

    // Push updated cachedData to Google Sheets immediately in background to synchronize across restarts
    const envUrl = serverConfig.appsScriptUrl || process.env.VITE_APPS_SCRIPT_URL;
    const appsScriptUrl = getIsolatedAppsScriptUrl(envUrl || '');
    const shouldSyncGoogleSheets = serverConfig.enableGoogleSheets && appsScriptUrl && appsScriptUrl.startsWith('http');

    if (shouldSyncGoogleSheets && cachedData) {
      // Execute fire-and-forget background push to update central Sheets config state
      (async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          const sanitizedLocalData = ensureWallpaperUrls(JSON.parse(JSON.stringify(cachedData)));
          
          console.log('[Sync Config] Pushing updated theme settings to Google Sheets in background...');
          const sheetsRes = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'text/plain',
              'Accept': 'application/json'
            },
            body: JSON.stringify(sanitizedLocalData),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (sheetsRes.ok) {
            console.log('[Sync Config] Theme settings successfully written to Google Sheets!');
          } else {
            console.warn('[Sync Config] Theme settings write to Google Sheets returned status:', sheetsRes.status);
          }
        } catch (err: any) {
          console.warn('[Sync Config] Background Google Sheets sync failed:', err.message);
        }
      })();
    }

    return res.json({ success: true, config: serverConfig });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to write config file' });
  }
});

// Simple Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Check against users in master data (prefer cachedData over INITIAL_DATA)
  const activeData = cachedData || INITIAL_DATA;
  const user = activeData.masterData.users.find(
    (u: any) => u.username === username && u.password === password
  );

  if (user) {
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return res.json({
      success: true,
      user: userWithoutPassword
    });
  }

  // Demo / Guest login for recovery or trial (if not found in master data)
  if (username === 'demo' && password === 'demo123') {
    return res.json({
      success: true,
      user: {
        username: 'demo',
        name: 'Demo Visitor',
        role: 'STAFF',
        position: 'Tamu'
      }
    });
  }

  res.status(401).json({ success: false, message: 'Username atau password salah.' });
});

// Data Sync API
app.get('/api/data', async (req, res) => {
  try {
    // Prevent any caching of data sync
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    // No truncation - return full data to prevent loss and missing historical records
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      return originalJson(body);
    };

    // Support paginated chunked table requests
    if (req.query.chunkTable) {
      const table = req.query.chunkTable as string;
      const page = parseInt(req.query.chunkPage as string || '1', 10);
      const size = parseInt(req.query.chunkSize as string || '200', 10);
      const db = cachedData || INITIAL_DATA;
      const fullArray = db[table] || [];
      const start = (page - 1) * size;
      const chunk = fullArray.slice(start, start + size);
      return res.json({
        status: 'ready',
        table,
        data: chunk,
        page,
        size,
        total: fullArray.length,
        hasMore: start + size < fullArray.length
      });
    }

    const queryUrl = req.query.url as string;
    const isForce = req.query.force === 'true';
    
    // Propagate appsScriptUrl globally if passed by any connected device
    // CRITICAL SECURITY FLIGHT SHIELD: Never let a client start-up fallback URL overwrite a custom Sheets URL configured on the server!
    const isQueryFallback = queryUrl === FALLBACK_APPS_SCRIPT_URL;
    const isServerFallback = !serverConfig.appsScriptUrl || serverConfig.appsScriptUrl === FALLBACK_APPS_SCRIPT_URL;
    
    if (queryUrl && queryUrl.startsWith('http') && !isQueryFallback && (isServerFallback || serverConfig.appsScriptUrl !== queryUrl)) {
      serverConfig.appsScriptUrl = queryUrl;
      serverConfig.enableGoogleSheets = true;
      try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(serverConfig, null, 2));
      } catch (e) {}
    }

    const envUrl = serverConfig.appsScriptUrl || process.env.VITE_APPS_SCRIPT_URL;
    const rawAppsScriptUrl = (queryUrl && queryUrl.trim() !== '') ? queryUrl.trim() : envUrl;
    const appsScriptUrl = getIsolatedAppsScriptUrl(rawAppsScriptUrl);
    
    const shouldSyncGoogleSheets = serverConfig.enableGoogleSheets && appsScriptUrl && appsScriptUrl.startsWith('http');
    
    // If Apps Script URL is provided and enabled, behave as a proxy
    if (shouldSyncGoogleSheets) {
      const now = Date.now();
      const isFresh = cachedData && (now - lastCloudFetchTime < CLOUD_CACHE_TTL);

      // FORCE PULL (Synchronous blocking, used for primary connect / manual sync paksa)
      if (isForce) {
        const isBypass = req.query.bypass === 'true';
        if (isBypass) {
          console.log('[Resilient Parser Server] Performing raw text-plain bypass fetch...');
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
            const response = await fetch(appsScriptUrl, { 
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const rawText = await response.text();
              const extracted = fallbackRawExtract(rawText);
              
              // Count clinical items
              const clinicalCount = (extracted.patients?.length || 0) + 
                                    (extracted.dailyReports?.length || 0) + 
                                    (extracted.operationReports?.length || 0);
              
              if (clinicalCount > 0) {
                console.log(`[Resilient Parser Server] Raw bypass fetch successfully extracted ${clinicalCount} records.`);
                cachedData = serverMergeData(cachedData || INITIAL_DATA, extracted);
                lastCloudFetchTime = Date.now();
                fs.writeFileSync(CACHE_PATH, JSON.stringify(cachedData, null, 2));
                return res.json({
                  status: 'ready',
                  data: ensureWallpaperUrls(cachedData),
                  message: 'Source of truth: Google Sheets (Raw Bypass Extracted)'
                });
              } else {
                console.warn('[Resilient Parser Server] Bypass fetch extracted 0 clinical records. Not updating cachedData.');
              }
            }
          } catch (err: any) {
            console.error('[Resilient Parser Server] Raw bypass fetch failed:', err.message);
          }
        }

        console.log('[Force Sync] Bypassing cache to pull directly from Google Sheets...');
        try {
          // Shared promise deduplication to prevent overloading Apps Script on concurrent hard-sync hits
          if (!activeCloudFetchPromise) {
            activeCloudFetchPromise = (async () => {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
              try {
                const response = await fetch(appsScriptUrl, { 
                  signal: controller.signal 
                });
                clearTimeout(timeoutId);
                
                if (response.ok) {
                  const rawText = await response.text();
                  const cloudResObj = resilientParse(rawText);
                  if (cloudResObj) {
                    if (cloudResObj.data && (cloudResObj.data.patients || cloudResObj.data.dailyReports || cloudResObj.data.operationReports)) {
                      return cloudResObj.data;
                    } else if (cloudResObj.patients || cloudResObj.dailyReports || cloudResObj.operationReports) {
                      return cloudResObj;
                    }
                  }
                }
                throw new Error(`Google Sheets responded with status ${response.status}`);
              } catch (e: any) {
                console.error('[Force Sync Fetch] Google Sheets pull failed:', e.message);
                return null;
              } finally {
                activeCloudFetchPromise = null;
              }
            })();
          }

          const cloudData = await activeCloudFetchPromise;
          if (cloudData) {
            const merged = serverMergeData(cachedData || INITIAL_DATA, cloudData);
            cachedData = merged;
            lastCloudFetchTime = Date.now();
            fs.writeFileSync(CACHE_PATH, JSON.stringify(cachedData, null, 2));

            // RESTORE CONFIG FROM SHEETS if serverConfig is empty/default or was wiped (Heal Block)
            if (cloudData.masterData?.settings) {
              const s = cloudData.masterData.settings;
              let configChanged = false;
              if (s.appName && s.appName !== 'SiMANTAP' && serverConfig.appName !== s.appName) {
                serverConfig.appName = s.appName;
                configChanged = true;
              }
              if (s.appSlogan && serverConfig.appSlogan !== s.appSlogan) {
                serverConfig.appSlogan = s.appSlogan;
                configChanged = true;
              }
              if (s.themeColor && serverConfig.themeColor !== s.themeColor) {
                serverConfig.themeColor = s.themeColor;
                configChanged = true;
              }
              if (s.fontColor && serverConfig.fontColor !== s.fontColor) {
                serverConfig.fontColor = s.fontColor;
                configChanged = true;
              }
              if (s.logoUrl && serverConfig.logoUrl !== s.logoUrl) {
                serverConfig.logoUrl = s.logoUrl;
                configChanged = true;
              }
              if (s.loginWallpaperUrl && serverConfig.loginWallpaperUrl !== s.loginWallpaperUrl) {
                serverConfig.loginWallpaperUrl = s.loginWallpaperUrl;
                configChanged = true;
              }
              if (s.appWallpaperUrl && serverConfig.appWallpaperUrl !== s.appWallpaperUrl) {
                serverConfig.appWallpaperUrl = s.appWallpaperUrl;
                configChanged = true;
              }
              if (s.isSidebarAutohide !== undefined && serverConfig.isSidebarAutohide !== !!s.isSidebarAutohide) {
                serverConfig.isSidebarAutohide = !!s.isSidebarAutohide;
                configChanged = true;
              }
              if (configChanged) {
                console.log('[Heal Config] Restored/Synchronized serverConfig settings from Google Sheets database.');
                fs.writeFileSync(CONFIG_PATH, JSON.stringify(serverConfig, null, 2));
              }
            }

            return res.json({
              status: 'ready',
              data: ensureWallpaperUrls(cachedData),
              message: 'Source of truth: Google Sheets (Forced & Synced)'
            });
          }
        } catch (error: any) {
          console.error('[Force Sync] Error pulling from Google Sheets:', error.message);
        }
        return res.json({
          status: 'ready',
          data: ensureWallpaperUrls(cachedData || INITIAL_DATA),
          message: 'Source of truth: Server Cache (Force Pull failed)'
        });
      }

      // SNAPPY AUTO PATH: Return memory cache immediately (< 1ms latency!)
      res.json({ 
        status: 'ready', 
        data: ensureWallpaperUrls(cachedData || INITIAL_DATA), 
        message: isFresh ? 'Source of truth: Server Cache (Fresh)' : 'Source of truth: Server Cache (Stale)' 
      });

      // Background Fetch: If cache is stale and no background pull is already active, trigger one in background!
      if (!isFresh && !isBackgroundFetchingCloud && Date.now() >= sheetsRateLimitedUntil) {
        isBackgroundFetchingCloud = true;
        (async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s generous timeout for background fetch
            
            const response = await fetch(appsScriptUrl, { 
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const rawText = await response.text();
              if (handleSheetsRateLimitError(rawText)) {
                return;
              }
              handleSheetsSuccess();
              const cloudResObj = resilientParse(rawText);
              if (cloudResObj) {
                let cloudData: any = null;
                if (cloudResObj.data && (cloudResObj.data.patients || cloudResObj.data.dailyReports || cloudResObj.data.operationReports)) {
                  cloudData = cloudResObj.data;
                } else if (cloudResObj.patients || cloudResObj.dailyReports || cloudResObj.operationReports) {
                  cloudData = cloudResObj;
                }
                if (cloudData) {
                  const merged = serverMergeData(cachedData || INITIAL_DATA, cloudData);
                  cachedData = merged;
                  lastCloudFetchTime = Date.now();
                  fs.writeFile(CACHE_PATH, JSON.stringify(cachedData, null, 2), () => {
                    console.log('[Auto-Sync] Background Google Sheets pull completed successfully. Broadcasting data-update to all devices.');
                    broadcastEvent({ type: 'data-update' });
                  });
                }
              }
            } else if (response.status === 429) {
              handleSheetsRateLimitError('HTTP 429 Rate Exceeded');
            }
          } catch (e: any) {
            if (e.name === 'AbortError' || e.message?.includes('aborted')) {
              console.log('[Auto-Sync] Background Google Sheets pull timed out/aborted gracefully. Will retry on next request series.');
            } else {
              handleSheetsRateLimitError(e.message || '');
              console.warn('[Auto-Sync] Background Google Sheets pull suspended:', e.message);
            }
          } finally {
            isBackgroundFetchingCloud = false;
          }
        })();
      }
      return;
    }

    // Default Central Server Database (Superfast standalone mode for instant cross-device sharing)
    return res.json({ status: 'ready', data: ensureWallpaperUrls(cachedData || INITIAL_DATA), message: cachedData ? 'Source of truth: Server Cache' : 'Source of truth: Initial State' });
  } catch (err: any) {
    console.error('Crash in GET /api/data handler caught gracefully:', err);
    return res.json({
      status: 'ready',
      data: ensureWallpaperUrls(cachedData || INITIAL_DATA),
      message: 'Source of truth: Server Cache (API Error Recovery)'
    });
  }
});

function getSheetsOptimizedData(data: any): any {
  if (!data) return data;
  const copy = JSON.parse(JSON.stringify(data));
  
  // Trim high-volume historic arrays for Google Sheets cell limit protection
  if (Array.isArray(copy.dailyReports) && copy.dailyReports.length > 100) {
    copy.dailyReports = copy.dailyReports.slice(-100);
  }
  if (Array.isArray(copy.patients) && copy.patients.length > 150) {
    copy.patients = copy.patients.slice(-150);
  }
  if (Array.isArray(copy.doctorVisits) && copy.doctorVisits.length > 100) {
    copy.doctorVisits = copy.doctorVisits.slice(-100);
  }
  if (Array.isArray(copy.financeRecords) && copy.financeRecords.length > 100) {
    copy.financeRecords = copy.financeRecords.slice(-100);
  }
  if (Array.isArray(copy.nursingReports) && copy.nursingReports.length > 100) {
    copy.nursingReports = copy.nursingReports.slice(-100);
  }
  if (Array.isArray(copy.operationReports) && copy.operationReports.length > 100) {
    copy.operationReports = copy.operationReports.slice(-100);
  }
  
  return copy;
}

function splitAndCompressPayloadServer(data: any): any[] {
  if (!data) return [];
  const rawStr = JSON.stringify(data);
  if (rawStr.length <= 40000) {
    return [data];
  }

  // 1. Clean empty properties and nulls
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

  // 2. Break into sub-chunk payloads if length > 40,000 characters
  const chunks: any[] = [];
  const baseHeader: any = {
    masterData: cleanObj.masterData,
    deletedIds: cleanObj.deletedIds || [],
    timestamp: cleanObj.timestamp || new Date().toISOString()
  };

  const majorTables = [
    'patients', 'dailyReports', 'nursingReports', 'financeRecords',
    'operationReports', 'operations', 'incidentReports', 'instruments',
    'doctorVisits', 'qualityMeasurements'
  ];

  let currentChunk: any = { ...baseHeader };
  majorTables.forEach(t => { currentChunk[t] = []; });
  let currentChunkSize = JSON.stringify(currentChunk).length;

  majorTables.forEach(t => {
    const arr = cleanObj[t];
    if (Array.isArray(arr) && arr.length > 0) {
      arr.forEach((item: any) => {
        const itemStr = JSON.stringify(item);
        if (currentChunkSize + itemStr.length > 38000) {
          chunks.push(currentChunk);
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
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [cleanObj];
}

app.post('/api/sync', async (req, res) => {
  try {
    const { data, url: queryUrl, clientTime } = req.body;
    
    // Propagate appsScriptUrl globally if passed by any connected device
    if (queryUrl && queryUrl.startsWith('http') && (!serverConfig.appsScriptUrl || serverConfig.appsScriptUrl !== queryUrl)) {
      serverConfig.appsScriptUrl = queryUrl;
      serverConfig.enableGoogleSheets = true;
      try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(serverConfig, null, 2));
      } catch (e) {}
    }

    // Merge incoming client data with current server cache data first!
    const incomingRaw = JSON.parse(JSON.stringify(data || {}));

    // Normalize clocks/skew to server reference time if needed
    const clockSkew = clientTime ? (Date.now() - Number(clientTime)) : 0;
    if (Math.abs(clockSkew) > 2000) {
      const normalizeItem = (item: any) => {
        if (item && item.lastModified) {
          try {
            const originalTime = new Date(item.lastModified).getTime();
            if (!isNaN(originalTime)) {
              item.lastModified = new Date(originalTime + clockSkew).toISOString();
            }
          } catch (e) {}
        }
      };
      if (Array.isArray(incomingRaw.patients)) incomingRaw.patients.forEach(normalizeItem);
      if (Array.isArray(incomingRaw.dailyReports)) incomingRaw.dailyReports.forEach(normalizeItem);
      if (Array.isArray(incomingRaw.financeRecords)) incomingRaw.financeRecords.forEach(normalizeItem);
      if (Array.isArray(incomingRaw.doctorVisits)) incomingRaw.doctorVisits.forEach(normalizeItem);
    }

    const mergedData = serverMergeData(incomingRaw, cachedData || INITIAL_DATA);
    const sanitizedLocalData = ensureWallpaperUrls(JSON.parse(JSON.stringify(mergedData)));
    
    // Find dailyReports delta (added or modified) to enable instant delta-sync broadcast
    const previousReports = cachedData?.dailyReports || [];
    const newReports = sanitizedLocalData.dailyReports || [];

    const previousReportsMap = new Map();
    previousReports.forEach((r: any) => {
      if (r && r.patientId && r.date) {
        previousReportsMap.set(`${r.patientId}_${r.date}`, r);
      }
    });

    const deltaReports: any[] = [];
    newReports.forEach((r: any) => {
      if (r && r.patientId && r.date) {
        const key = `${r.patientId}_${r.date}`;
        const prev = previousReportsMap.get(key);
        if (!prev) {
          deltaReports.push(r);
        } else {
          const prevMod = prev.lastModified ? new Date(prev.lastModified).getTime() : 0;
          const rMod = r.lastModified ? new Date(r.lastModified).getTime() : 0;
          if (rMod > prevMod || JSON.stringify(prev) !== JSON.stringify(r)) {
            deltaReports.push(r);
          }
        }
      }
    });

    // IMMEDIATELY update server cache with sanitized merged data
    cachedData = sanitizedLocalData;
    lastCloudFetchTime = Date.now(); // Mark this local sync as valid cache to prevent immediate re-fetching
    fs.writeFile(CACHE_PATH, JSON.stringify(cachedData, null, 2), (err) => {
      if (err) console.error('Failed to write app-data-cache.json');
      else {
        runAutoBackup(cachedData);
      }
      
      // Broadcast the delta reports for lightweight and silent instant sync
      if (deltaReports.length > 0) {
        console.log(`[SSE Broadcast] Delta update detected for dailyReports (${deltaReports.length} items). Sending delta-update signal.`);
        broadcastEvent({ 
          type: 'delta-update', 
          table: 'dailyReports', 
          items: deltaReports 
        });
      } else {
        broadcastEvent({ type: 'data-update' });
      }
    });

    const envUrl = serverConfig.appsScriptUrl || process.env.VITE_APPS_SCRIPT_URL;
    const rawAppsScriptUrl = (queryUrl && queryUrl.trim() !== '') ? queryUrl.trim() : envUrl;
    const appsScriptUrl = getIsolatedAppsScriptUrl(rawAppsScriptUrl);
    const shouldSyncGoogleSheets = serverConfig.enableGoogleSheets && appsScriptUrl && appsScriptUrl.startsWith('http');

    // If Apps Script integration is enabled, write to Google Sheets with 10s debouncing & rate limit protection
    if (shouldSyncGoogleSheets) {
      const runSheetsSync = async () => {
        if (Date.now() < sheetsRateLimitedUntil) {
          console.log('[Sync Background] Deferring Google Sheets background write due to active rate limit backoff. Data is safely persisted in server memory, Firestore, and cache file.');
          return false;
        }
        try {
          const optimizedData = getSheetsOptimizedData(sanitizedLocalData);
          const payloadChunks = splitAndCompressPayloadServer(optimizedData);
          for (const chunkPayload of payloadChunks) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout per chunk
            
            try {
              const response = await fetch(appsScriptUrl, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'text/plain',
                  'Accept': 'application/json'
                },
                body: JSON.stringify(chunkPayload),
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const rawText = await response.text();
                if (handleSheetsRateLimitError(rawText)) {
                  return false;
                }
                handleSheetsSuccess();
                const result = resilientParse(rawText);
                if (result) {
                  let cloudData: any = null;
                  if (result.data && (result.data.patients || result.data.dailyReports || result.data.operationReports)) {
                    cloudData = result.data;
                  } else if (result.patients || result.dailyReports || result.operationReports) {
                    cloudData = result;
                  }
                  if (cloudData) {
                    // Merge any newest cloud return
                    cachedData = serverMergeData(cachedData || INITIAL_DATA, cloudData);
                    cachedData = ensureWallpaperUrls(cachedData);
                    lastCloudFetchTime = Date.now();
                    fs.writeFileSync(CACHE_PATH, JSON.stringify(cachedData, null, 2));
                    broadcastEvent({ type: 'data-update' });
                  }
                }
              } else {
                const errTxt = await response.text().catch(() => '');
                handleSheetsRateLimitError(errTxt || `HTTP ${response.status}`);
                return false;
              }
            } catch (chunkErr: any) {
              clearTimeout(timeoutId);
              if (chunkErr.name === 'AbortError' || chunkErr.message?.includes('aborted')) {
                console.log('[Sync Background] Google Sheets background chunk write timed out/aborted gracefully.');
              } else {
                handleSheetsRateLimitError(chunkErr.message || '');
                console.log('[Sync Background] Google Sheets write chunk deferred:', chunkErr.message);
              }
              break;
            }
          }
          return true;
        } catch (error: any) {
          if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            console.log('[Sync Background] Google Sheets write deferred/aborted gracefully.');
          } else {
            handleSheetsRateLimitError(error.message || '');
            console.log('[Sync Background] Write to Google Sheets deferred:', error.message);
          }
          return false;
        }
      };

      // Return the memory-cached, merged data to the client IMMEDIATELY
      res.json({
        success: true,
        data: ensureWallpaperUrls(cachedData || INITIAL_DATA)
      });

      // Run Google Sheets sync in the background asynchronously (fire-and-forget)
      // This complies with "HAPUS BLOCKING AWAIT PADA SISI SERVER" to ensure the client gets instant success
      // and eliminates any loading spinner or UI freeze during Sheets writing.
      setImmediate(() => {
        runSheetsSync().catch((err: any) => {
          console.warn('[Asynchronous Sync Background Process Error]:', err.message);
        });
      });
      return;
    }

    // Return the memory-cached, merged data to the client if not using Google Sheets
    return res.json({
      success: true,
      data: ensureWallpaperUrls(cachedData || INITIAL_DATA)
    });
  } catch (err: any) {
    console.error('Crash in POST /api/sync handler caught gracefully:', err);
    return res.status(200).json({
      success: true,
      warning: 'Server Sync Error: ' + err.message,
      data: ensureWallpaperUrls(cachedData || INITIAL_DATA)
    });
  }
});

// Wallpaper dynamic image provider
app.get('/api/wallpaper/:type', (req, res) => {
  const { type } = req.params;
  let base64 = '';
  
  if (type === 'app') {
    base64 = appWallpaperBase64;
  } else if (type === 'login') {
    base64 = loginWallpaperBase64;
  } else if (type === 'logo') {
    base64 = logoBase64;
  }

  if (base64 && base64.startsWith('data:image/')) {
    const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 7 days since wallpapers are static until reloaded
      return res.end(buffer);
    }
  }

  // Fallback: 1x1 Transparent PNG
  const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.end(transparentPng);
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite middleware loaded');
    } catch (e) {
      console.error('Failed to load Vite:', e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production build from:', distPath);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
