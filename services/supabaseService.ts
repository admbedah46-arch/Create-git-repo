import { supabase } from './databaseConfig';
import { Patient, QualityMeasurement, IncidentReport } from '../types';
import { getDB, saveDB } from '../db';

/**
 * Supabase Service
 * Core Auth, User Sessions, Role Management (Admin, Perawat, DPJP, PIC Mutu)
 * Primary Relational DB queries for Pasien, Asesmen Awal Medis, Indikator Mutu, & Insiden KPRS
 */

export interface UserRoleProfile {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Perawat' | 'DPJP' | 'PIC Mutu' | 'Management';
  department?: string;
  isActive: boolean;
}

export const supabaseService = {
  // Auth & Session Management
  async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    } catch (e) {
      console.log('[Supabase Auth] Fallback to local session user');
      const localDb = getDB();
      return localDb.masterData?.users?.[0] || null;
    }
  },

  async signIn(email: string, pass: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      return { user: data.user, error: null };
    } catch (e: any) {
      console.warn('[Supabase Auth] Remote login fallback:', e?.message || e);
      return { user: null, error: e?.message || 'Login failed' };
    }
  },

  async signOut() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[Supabase Auth] SignOut error:', e);
    }
  },

  // 1. Patient Registrations (Limit 20 for optimized fetching)
  async getPatients(limit: number = 20): Promise<Patient[]> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(limit);

      if (error || !data) throw error || new Error('No data');
      return data as Patient[];
    } catch (e) {
      console.log('[Supabase DB] Fallback to IndexedDB for Patients');
      const localDb = getDB();
      return (localDb.patients || []).slice(0, limit);
    }
  },

  async savePatient(patient: Patient): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('patients')
        .upsert(patient, { onConflict: 'id' });

      if (error) throw error;
      return true;
    } catch (e) {
      console.log('[Supabase DB] Saved patient to local IndexedDB fallback');
      const localDb = getDB();
      const existingIdx = localDb.patients.findIndex(p => p.id === patient.id);
      if (existingIdx >= 0) {
        localDb.patients[existingIdx] = patient;
      } else {
        localDb.patients.unshift(patient);
      }
      saveDB(localDb);
      return true;
    }
  },

  // 2. Kertas Kerja Mutu & Asesmen Awal Medis
  async getQualityMeasurements(): Promise<QualityMeasurement[]> {
    try {
      const { data, error } = await supabase
        .from('quality_measurements')
        .select('*')
        .order('tanggal', { ascending: false });

      if (error || !data) throw error || new Error('No quality measurements data');
      return data as QualityMeasurement[];
    } catch (e) {
      console.log('[Supabase DB] Fallback to IndexedDB for Quality Measurements');
      const localDb = getDB();
      return localDb.qualityMeasurements || [];
    }
  },

  // 3. Insiden KPRS
  async getIncidentReports(): Promise<IncidentReport[]> {
    try {
      const { data, error } = await supabase
        .from('incident_reports')
        .select('*')
        .order('tanggalInsiden', { ascending: false });

      if (error || !data) throw error || new Error('No incident reports data');
      return data as IncidentReport[];
    } catch (e) {
      console.log('[Supabase DB] Fallback to IndexedDB for Incident Reports');
      const localDb = getDB();
      return localDb.incidentReports || [];
    }
  },

  async saveIncidentReport(report: IncidentReport): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('incident_reports')
        .upsert(report, { onConflict: 'id' });

      if (error) throw error;
      return true;
    } catch (e) {
      console.log('[Supabase DB] Saved incident report to local IndexedDB fallback');
      const localDb = getDB();
      const idx = localDb.incidentReports.findIndex(r => r.id === report.id);
      if (idx >= 0) {
        localDb.incidentReports[idx] = report;
      } else {
        localDb.incidentReports.unshift(report);
      }
      saveDB(localDb);
      return true;
    }
  }
};
