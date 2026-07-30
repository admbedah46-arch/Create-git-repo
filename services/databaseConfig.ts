import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { createClient } from '@supabase/supabase-js';
import firebaseConfigJson from '../firebase-applet-config.json';

// Helper to safely extract environment properties without crashing
const getEnvVar = (key: string, fallback: string = ''): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const val = (import.meta as any).env[key];
      if (val && typeof val === 'string' && val.trim() !== '') {
        return val.trim();
      }
    }
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[key];
      if (val && typeof val === 'string' && val.trim() !== '') {
        return val.trim();
      }
    }
  } catch (e) {}
  return fallback;
};

// 4 PILAR SERVER & DIRECT ENGINE DATABASE CONFIGURATION
export const DATABASE_CONFIG = {
  // PILAR 1: Google Spreadsheet Utama & Apps Script
  GAS: {
    SPREADSHEET_ID: getEnvVar('VITE_GOOGLE_SPREADSHEET_ID', '1R2yjyUUPJheGomLpSWnUW3FvkIlLsZxoCHn_bGaqPDw'),
    WEB_APP_URL: getEnvVar('VITE_GAS_URL', getEnvVar('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/AKfycbydRSS_JBTGeJryBc0uTckoEjJ1-kQY65ntUbYxLwuuBn80QNNwXreuFj0MVYqF3Q-GLw/exec')),
  },

  // PILAR 2: Firebase (Realtime Database & Authentication)
  FIREBASE: {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY', (firebaseConfigJson as any)?.apiKey || 'AIzaSyC-IQHifzM2wjL6wjM1v-uN52-M6yws-Oo'),
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', (firebaseConfigJson as any)?.authDomain || 'gen-lang-client-0234581338.firebaseapp.com'),
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', (firebaseConfigJson as any)?.projectId || 'gen-lang-client-0234581338'),
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', (firebaseConfigJson as any)?.storageBucket || 'gen-lang-client-0234581338.firebasestorage.app'),
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', (firebaseConfigJson as any)?.messagingSenderId || '359469612868'),
    appId: getEnvVar('VITE_FIREBASE_APP_ID', (firebaseConfigJson as any)?.appId || '1:359469612868:web:0bc4678953dc87e42da111'),
  },

  // PILAR 3: Supabase (Relational Cloud Database)
  SUPABASE: {
    url: getEnvVar('VITE_SUPABASE_URL', 'https://flreglddjsyxypjfalqz.supabase.co'),
    anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZscmVnbGRkanN5eHlwamZhbHF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNzM2OTMsImV4cCI6MjEwMDg0OTY5M30.N3gwF73WxPTEyrV6WBk2FHADa42fQVRxh22Dqh5pnpM'),
  },

  // PILAR 4: Direct Google AI Studio Execution
  AI_STUDIO: {
    apiKey: getEnvVar('GEMINI_API_KEY', getEnvVar('VITE_GEMINI_API_KEY', '')),
    model: 'gemini-2.5-flash',
  }
};

// 1. Firebase Multi-Database Initialization
export const firebaseConfig = DATABASE_CONFIG.FIREBASE;

let app: any = null;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
} catch (error) {
  console.warn('[databaseConfig] Firebase app initialization error fallback:', error);
}

// Primary Database Firestore Instance
let primaryDbId = "ai-studio-simantapbedah-c6a38a36-4082-4d85-9040-78110b8f6ff4";
try {
  if (firebaseConfigJson && (firebaseConfigJson as any).firestoreDatabaseId) {
    primaryDbId = (firebaseConfigJson as any).firestoreDatabaseId;
  }
} catch (e) {}

let firestoreInstance: any = null;
try {
  firestoreInstance = app ? getFirestore(app, primaryDbId) : getFirestore();
} catch (error) {
  console.warn('[databaseConfig] getFirestore with custom db ID failed, trying default:', error);
  try {
    firestoreInstance = app ? getFirestore(app) : getFirestore();
  } catch (err2) {
    console.warn('[databaseConfig] getFirestore fallback failed:', err2);
    firestoreInstance = {} as any;
  }
}

export const dbPasien = firestoreInstance;
export const dbMutu = dbPasien;
export const dbMaster = dbPasien;
export const db = dbPasien;

let authInstance: any = null;
try {
  authInstance = app ? getAuth(app) : ({} as any);
} catch (error) {
  console.warn('[databaseConfig] getAuth initialization fallback:', error);
  authInstance = {} as any;
}
export const auth = authInstance;

// Enable persistence safely on primary db
if (typeof window !== 'undefined' && dbPasien && typeof dbPasien.type === 'string') {
  try {
    enableIndexedDbPersistence(dbPasien).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firestore dbPasien] Offline persistence warning: Multiple tabs open.');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firestore dbPasien] Persistence not supported.');
      }
    });
  } catch (err) {
    console.warn('[Firestore dbPasien] Persistence setup warning:', err);
  }
}

// 2. Supabase Client Initialization with robust fallback mock
let supabaseClient: any = null;
try {
  if (DATABASE_CONFIG.SUPABASE.url && DATABASE_CONFIG.SUPABASE.anonKey) {
    supabaseClient = createClient(DATABASE_CONFIG.SUPABASE.url, DATABASE_CONFIG.SUPABASE.anonKey);
  }
} catch (error) {
  console.warn('[databaseConfig] Supabase initialization fallback:', error);
}

if (!supabaseClient) {
  supabaseClient = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    }
  };
}

export const supabase = supabaseClient;

// 3. Cloudflare D1 / Worker Endpoint
export const CLOUDFLARE_D1_API = getEnvVar('VITE_CLOUDFLARE_D1_URL', "https://your-worker.workers.dev");

// 4. PocketBase Storage Endpoint
export const POCKETBASE_URL = getEnvVar('VITE_POCKETBASE_URL', "https://your-pocketbase.fly.dev");

// 5. Google Apps Script Web App Endpoint
export const GOOGLE_APPS_SCRIPT_URL = DATABASE_CONFIG.GAS.WEB_APP_URL;
export const APPS_SCRIPT_URL = GOOGLE_APPS_SCRIPT_URL;

// Utility helper for Cloudflare D1 Worker requests
export async function fetchFromCloudflareD1(endpoint: string) {
  try {
    if (!CLOUDFLARE_D1_API || CLOUDFLARE_D1_API.includes('your-worker')) {
      console.log('[Cloudflare D1] Using local/cached fallback for endpoint:', endpoint);
      return null;
    }
    const response = await fetch(`${CLOUDFLARE_D1_API}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[Cloudflare D1] Fetch failed for ${endpoint}:`, error);
    return null;
  }
}

// Utility helper for PocketBase file uploads
export async function uploadToPocketBase(file: File | Blob, collectionName: string = 'attachments'): Promise<string | null> {
  try {
    if (!POCKETBASE_URL || POCKETBASE_URL.includes('your-pocketbase')) {
      console.log('[PocketBase] Endpoint not configured, falling back to local base64/URL format');
      return null;
    }
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${POCKETBASE_URL}/api/collections/${collectionName}/records`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return `${POCKETBASE_URL}/api/files/${collectionName}/${data.id}/${data.file}`;
  } catch (error) {
    console.warn('[PocketBase] Upload failed:', error);
    return null;
  }
}

// Utility helper for Google Apps Script Sheet Sync & Export
export async function syncToGoogleAppsScript(action: string, payload: any) {
  try {
    if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL.includes('your-script-id')) {
      console.log('[AppsScript] URL not configured, skip external sync');
      return { success: false, message: 'GOOGLE_APPS_SCRIPT_URL missing or default' };
    }
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, timestamp: new Date().toISOString() }),
    });
    return await response.json();
  } catch (error) {
    console.warn('[AppsScript] Export sync warning:', error);
    return { success: false, error: String(error) };
  }
}
