import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { createClient } from '@supabase/supabase-js';
import firebaseConfigJson from '../firebase-applet-config.json';

// 1. Firebase Multi-Database Initialization
export const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyC-IQHifzM2wjL6wjM1v-uN52-M6yws-Oo",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0234581338.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0234581338",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0234581338.firebasestorage.app",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "359469612868",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:359469612868:web:0bc4678953dc87e42da111"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Primary Database Firestore Instance
const primaryDbId = firebaseConfigJson.firestoreDatabaseId || "ai-studio-simantapbedah-c6a38a36-4082-4d85-9040-78110b8f6ff4";

export const dbPasien = getFirestore(app, primaryDbId);
export const dbMutu = dbPasien;
export const dbMaster = dbPasien;
export const db = dbPasien;
export const auth = getAuth(app);

// Enable persistence safely on primary db
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(dbPasien).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firestore dbPasien] Offline persistence warning: Multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firestore dbPasien] Persistence not supported.');
    }
  });
}

// 2. Supabase Client Initialization (Core Auth & Primary Relational DB)
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "https://your-supabase-url.supabase.co";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "your-anon-key";
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 3. Cloudflare D1 / Worker Endpoint (High-Traffic Read-Heavy API)
export const CLOUDFLARE_D1_API = (import.meta as any).env?.VITE_CLOUDFLARE_D1_URL || "https://your-worker.workers.dev";

// 4. PocketBase Storage Endpoint (File Storage & Attachments)
export const POCKETBASE_URL = (import.meta as any).env?.VITE_POCKETBASE_URL || "https://your-pocketbase.fly.dev";

// 5. Google Apps Script Web App Endpoint (Export, Reports & Live Spreadsheet Backup)
export const GOOGLE_APPS_SCRIPT_URL = (import.meta as any).env?.VITE_GAS_URL || (import.meta as any).env?.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/your-script-id/exec";
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
