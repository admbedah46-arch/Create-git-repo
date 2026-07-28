import { POCKETBASE_URL, uploadToPocketBase } from './databaseConfig';

/**
 * PocketBase File Storage & Attachment Service
 * Handles uploading and managing files/attachments:
 * - KPRS Incident Photo Evidence (Bukti Insiden KPRS)
 * - Surgical Instrument Photos (Foto Alat Bedah)
 * - Physical Document Scans (Scan Rekam Medis / Dokumen Fisik)
 */

export const pocketbaseService = {
  // 1. Upload KPRS Incident Evidence Photo
  async uploadIncidentEvidence(file: File | Blob): Promise<string> {
    console.log('[PocketBase] Uploading KPRS Incident photo attachment...');
    const remoteUrl = await uploadToPocketBase(file, 'incidents');
    if (remoteUrl) return remoteUrl;

    // Fallback to local Data URL preview if PocketBase instance is offline or unreachable
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  },

  // 2. Upload Surgical Instrument Photo
  async uploadInstrumentPhoto(file: File | Blob): Promise<string> {
    console.log('[PocketBase] Uploading Surgical Instrument photo...');
    const remoteUrl = await uploadToPocketBase(file, 'instruments');
    if (remoteUrl) return remoteUrl;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  },

  // 3. Upload Physical Medical Document Scan
  async uploadMedicalDocumentScan(file: File | Blob): Promise<string> {
    console.log('[PocketBase] Uploading Medical Document scan...');
    const remoteUrl = await uploadToPocketBase(file, 'documents');
    if (remoteUrl) return remoteUrl;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
};
