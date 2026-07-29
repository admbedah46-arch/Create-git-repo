import { QualityMeasurement, IncidentReport, DoctorVisit, FinanceRecord } from '../types';
import { getDB, saveDB, registerDeletedId, uploadDataBackground } from '../db';
import { pushItemToFirestoreCollection } from '../firestoreSync';
import { googleAppsScriptService } from './googleAppsScriptService';

/**
 * Mutu & KPRS Service with Zero Data Loss 3-Layer Hybrid Persistence Architecture
 * Handles Quality Indicators, KPRS Incidents, DPJP Visits & Finance Summaries
 */

const generatePermanentUUID = (prefix: string = 'M'): string => {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
};

export const mutuService = {
  // --- QUALITY MEASUREMENTS ---
  getQualityMeasurements(): QualityMeasurement[] {
    const db = getDB();
    return db.qualityMeasurements || [];
  },

  async saveQualityMeasurement(data: Omit<QualityMeasurement, 'id'> & { id?: string }): Promise<QualityMeasurement> {
    const db = getDB();
    const nowIso = new Date().toISOString();
    const id = data.id || generatePermanentUUID('QM');
    const record: QualityMeasurement = {
      ...data,
      id,
      lastModified: nowIso,
      updatedAt: nowIso
    } as QualityMeasurement;

    if (!Array.isArray(db.qualityMeasurements)) db.qualityMeasurements = [];
    const idx = db.qualityMeasurements.findIndex((q) => String(q.id) === String(id));
    if (idx > -1) {
      db.qualityMeasurements[idx] = record;
    } else {
      db.qualityMeasurements.push(record);
    }

    // Lapis 2: Save local cache
    saveDB(db);

    // Lapis 1: Realtime push to Cloud
    try {
      await pushItemToFirestoreCollection('qualityMeasurements', record.id, record);
      await pushItemToFirestoreCollection('quality_indicators', record.id, record);
    } catch (err) {
      console.warn('[MutuService] Firestore write queued:', err);
    }

    // Lapis 3: Background queue sync
    uploadDataBackground();

    // Auto-Backup
    googleAppsScriptService.triggerBackupToSheets(db).catch(() => {});

    return record;
  },

  // --- KPRS INCIDENT REPORTS ---
  getIncidentReports(): IncidentReport[] {
    const db = getDB();
    return db.incidentReports || [];
  },

  async reportIncident(incidentData: Omit<IncidentReport, 'id'> & { id?: string }): Promise<IncidentReport> {
    const db = getDB();
    const nowIso = new Date().toISOString();
    const id = incidentData.id || generatePermanentUUID('INC');
    const incident: IncidentReport = {
      ...incidentData,
      id,
      createdAt: nowIso,
      updatedAt: nowIso
    } as IncidentReport;

    if (!Array.isArray(db.incidentReports)) db.incidentReports = [];
    const idx = db.incidentReports.findIndex((i) => String(i.id) === String(id));
    if (idx > -1) {
      db.incidentReports[idx] = incident;
    } else {
      db.incidentReports.push(incident);
    }

    saveDB(db);

    try {
      await pushItemToFirestoreCollection('incidentReports', incident.id, incident);
    } catch (err) {
      console.warn('[MutuService] Incident report queued for offline push:', err);
    }

    uploadDataBackground();

    googleAppsScriptService.triggerBackupToSheets(db).catch(() => {});

    return incident;
  },

  // --- DOCTOR VISITS ---
  getDoctorVisits(): DoctorVisit[] {
    const db = getDB();
    return db.doctorVisits || [];
  },

  async recordDoctorVisit(visitData: Omit<DoctorVisit, 'id'> & { id?: string }): Promise<DoctorVisit> {
    const db = getDB();
    const nowIso = new Date().toISOString();
    const id = visitData.id || generatePermanentUUID('VIS');
    const visit: DoctorVisit = {
      ...visitData,
      id,
      lastModified: nowIso
    } as DoctorVisit;

    if (!Array.isArray(db.doctorVisits)) db.doctorVisits = [];
    const idx = db.doctorVisits.findIndex((v) => String(v.id) === String(id));
    if (idx > -1) {
      db.doctorVisits[idx] = visit;
    } else {
      db.doctorVisits.push(visit);
    }

    saveDB(db);

    try {
      await pushItemToFirestoreCollection('doctorVisits', visit.id, visit);
    } catch (err) {
      console.warn('[MutuService] Doctor visit queued:', err);
    }

    uploadDataBackground();

    // Auto-Backup to Sheets for DPJP Visite Report
    googleAppsScriptService.exportDpjpVisitsReport(db.doctorVisits).catch(() => {});

    return visit;
  },

  // --- FINANCE RECORDS ---
  getFinanceRecords(): FinanceRecord[] {
    const db = getDB();
    return db.financeRecords || [];
  },

  async recordFinance(financeData: Omit<FinanceRecord, 'id'> & { id?: string }): Promise<FinanceRecord> {
    const db = getDB();
    const nowIso = new Date().toISOString();
    const id = financeData.id || generatePermanentUUID('FIN');
    const record: FinanceRecord = {
      ...financeData,
      id,
      updatedAt: nowIso
    } as FinanceRecord;

    if (!Array.isArray(db.financeRecords)) db.financeRecords = [];
    const idx = db.financeRecords.findIndex((f) => String(f.id) === String(id));
    if (idx > -1) {
      db.financeRecords[idx] = record;
    } else {
      db.financeRecords.push(record);
    }

    saveDB(db);

    try {
      await pushItemToFirestoreCollection('financeRecords', record.id, record);
      await pushItemToFirestoreCollection('financial_reports', record.id, record);
    } catch (err) {
      console.warn('[MutuService] Finance record queued:', err);
    }

    uploadDataBackground();

    // Auto-Backup Financial Report
    googleAppsScriptService.exportFinancialReport(db.financeRecords).catch(() => {});

    return record;
  }
};
