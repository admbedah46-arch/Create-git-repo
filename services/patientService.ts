import { Patient } from '../types';
import { getDB, saveDB, registerDeletedId, uploadDataBackground } from '../db';
import { pushItemToFirestoreCollection } from '../firestoreSync';
import { googleAppsScriptService } from './googleAppsScriptService';
import { pushRealtimeUpdateDebounced } from './realtimeSyncService';

/**
 * Patient Service with Zero Data Loss 3-Layer Hybrid Persistence Architecture
 * Lapis 1: Realtime write to Firestore Cloud & Realtime Database Signal
 * Lapis 2: Offline-First IndexedDB & Local Storage Cache (Merge-Only)
 * Lapis 3: Persistent Background Sync Queue
 * Auto-Backup: Realtime background push to Google Sheets
 */

const generatePermanentUUID = (prefix: string = 'P'): string => {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
};

export const patientService = {
  // 1. Get all patients from local cache (Offline First)
  getPatients(): Patient[] {
    const db = getDB();
    return db.patients || [];
  },

  // 2. Find patient by ID
  getPatientById(id: string): Patient | undefined {
    const db = getDB();
    return (db.patients || []).find((p) => String(p.id) === String(id));
  },

  // 3. Create Patient with 3-Layer Write
  async createPatient(patientData: Omit<Patient, 'id'>): Promise<Patient> {
    const db = getDB();
    const nowIso = new Date().toISOString();
    const newPatient: Patient = {
      ...patientData,
      id: generatePermanentUUID('P'),
      entryDate: patientData.entryDate || nowIso.split('T')[0],
      lastModified: nowIso,
      updatedAt: nowIso
    };

    // Lapis 2: Update Local DB Cache (IndexedDB/LocalStorage)
    if (!Array.isArray(db.patients)) db.patients = [];
    db.patients.push(newPatient);
    saveDB(db);

    // Broadcast instant multi-device Realtime signal
    pushRealtimeUpdateDebounced('sensus_bedah/patients', { patient: newPatient, action: 'CREATE' }, 300);

    // Lapis 1: Realtime Push to Cloud Firestore (Single Entity Write with Merge)
    try {
      await pushItemToFirestoreCollection('patients', newPatient.id, newPatient);
    } catch (err) {
      console.warn('[PatientService] Realtime Firestore write queued for offline sync:', err);
    }

    // Lapis 3: Queue in persistent background sync
    uploadDataBackground();

    // Auto-Backup: Trigger background spreadsheet sync for patient census
    googleAppsScriptService.exportPatientCensus(db.patients).catch((e) => {
      console.warn('[PatientService] Google Sheets auto-backup warning:', e);
    });

    return newPatient;
  },

  // 4. Update Patient with 3-Layer Write & Merge Protection
  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient | null> {
    const db = getDB();
    if (!Array.isArray(db.patients)) db.patients = [];
    const idx = db.patients.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) return null;

    const nowIso = new Date().toISOString();
    const updatedPatient: Patient = {
      ...db.patients[idx],
      ...updates,
      lastModified: nowIso,
      updatedAt: nowIso
    };

    // Lapis 2: Update Local DB Cache
    db.patients[idx] = updatedPatient;
    saveDB(db);

    // Broadcast instant multi-device Realtime signal
    pushRealtimeUpdateDebounced('sensus_bedah/patients', { patient: updatedPatient, action: 'UPDATE' }, 300);

    // Lapis 1: Realtime Push to Cloud Firestore
    try {
      await pushItemToFirestoreCollection('patients', updatedPatient.id, updatedPatient);
    } catch (err) {
      console.warn('[PatientService] Firestore update queued:', err);
    }

    // Lapis 3: Background sync
    uploadDataBackground();

    // Auto-Backup: Trigger background spreadsheet sync
    googleAppsScriptService.exportPatientCensus(db.patients).catch(() => {});

    return updatedPatient;
  },

  // 5. Delete Patient safely (registering deleted ID to prevent resurrecting)
  async deletePatient(id: string): Promise<boolean> {
    const db = getDB();
    if (!Array.isArray(db.patients)) return false;

    // Register deleted ID permanently
    registerDeletedId(String(id));

    db.patients = db.patients.filter((p) => String(p.id) !== String(id));
    saveDB(db);

    // Broadcast instant multi-device Realtime signal
    pushRealtimeUpdateDebounced('sensus_bedah/patients', { patientId: id, action: 'DELETE' }, 300);

    uploadDataBackground();
    return true;
  }
};

