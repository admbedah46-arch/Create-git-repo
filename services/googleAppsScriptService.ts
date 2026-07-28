import { GOOGLE_APPS_SCRIPT_URL, syncToGoogleAppsScript } from './databaseConfig';
import { Patient, DoctorVisit, QualityMeasurement, IncidentReport } from '../types';

/**
 * Google Apps Script + Google Sheets Service
 * Export, Laporan & Live Spreadsheet Sync
 * Handles Visite DPJP export, Financial summaries, Patient Census, and automatic Google Sheets backup
 */

export const googleAppsScriptService = {
  // 1. Export & Sync DPJP Visite Report
  async exportDpjpVisitsReport(visits: DoctorVisit[]) {
    console.log('[Google Apps Script] Exporting DPJP Visits Report to Google Sheets...', visits.length);
    return await syncToGoogleAppsScript('EXPORT_DPJP_VISITS', {
      visits,
      exportedAt: new Date().toISOString(),
      reportTitle: 'Rekap Laporan Visite DPJP'
    });
  },

  // 2. Export & Sync Financial Report / Rekap Finansial Layanan
  async exportFinancialReport(financialData: any[]) {
    console.log('[Google Apps Script] Syncing Financial Report to Google Sheets...', financialData.length);
    return await syncToGoogleAppsScript('EXPORT_FINANCIAL_SUMMARY', {
      records: financialData,
      exportedAt: new Date().toISOString(),
      reportTitle: 'Rekap Finansial Layanan Bedah'
    });
  },

  // 3. Export & Sync Patient Census / Sensus Pasien
  async exportPatientCensus(patients: Patient[]) {
    console.log('[Google Apps Script] Exporting Patient Census to Google Sheets...', patients.length);
    return await syncToGoogleAppsScript('EXPORT_PATIENT_CENSUS', {
      patients,
      exportedAt: new Date().toISOString(),
      reportTitle: 'Sensus Bedah Harian'
    });
  },

  // 4. Background Automatic Backup to Google Sheets
  async triggerBackupToSheets(appDataSnapshot: any) {
    console.log('[Google Apps Script] Triggering full background backup sync to Google Sheets...');
    return await syncToGoogleAppsScript('BACKUP_FULL_APP_DATA', {
      snapshotSummary: {
        patientsCount: appDataSnapshot.patients?.length || 0,
        qualityCount: appDataSnapshot.qualityMeasurements?.length || 0,
        incidentsCount: appDataSnapshot.incidentReports?.length || 0,
        bookingsCount: appDataSnapshot.booking_ruangan?.length || 0,
        timestamp: new Date().toISOString(),
      }
    });
  }
};
