import { RoomBooking } from '../types';
import { getDB, saveDB, registerDeletedId, uploadDataBackground } from '../db';
import { pushItemToFirestoreCollection } from '../firestoreSync';
import { googleAppsScriptService } from './googleAppsScriptService';

/**
 * Booking Service with Zero Data Loss 3-Layer Hybrid Persistence Architecture
 * Handles Room Bookings & Jadwal Operasi / Ruangan Bedah
 */

const generatePermanentUUID = (prefix: string = 'BK'): string => {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
};

export const bookingService = {
  // 1. Get all room bookings from local cache
  getBookings(): RoomBooking[] {
    const db = getDB();
    return [
      ...(Array.isArray(db.booking_ruangan) ? db.booking_ruangan : []),
      ...(Array.isArray(db.roomBookings) ? db.roomBookings : [])
    ].filter((b, idx, self) => b && b.id && self.findIndex(s => s.id === b.id) === idx);
  },

  // 2. Create Room Booking
  async createBooking(bookingData: Omit<RoomBooking, 'id'>): Promise<RoomBooking> {
    const db = getDB();
    const nowIso = new Date().toISOString();
    const newBooking: RoomBooking = {
      ...bookingData,
      id: generatePermanentUUID('BK'),
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (!Array.isArray(db.booking_ruangan)) db.booking_ruangan = [];
    if (!Array.isArray(db.roomBookings)) db.roomBookings = [];

    db.booking_ruangan.push(newBooking);
    db.roomBookings.push(newBooking);

    // Lapis 2: Save Local Cache
    saveDB(db);

    // Lapis 1: Realtime write to Firestore
    try {
      await pushItemToFirestoreCollection('booking_ruangan', newBooking.id, newBooking);
      await pushItemToFirestoreCollection('roomBookings', newBooking.id, newBooking);
    } catch (err) {
      console.warn('[BookingService] Firestore write queued:', err);
    }

    // Lapis 3: Background queue sync
    uploadDataBackground();

    // Auto-Backup: Trigger Google Sheets full snapshot backup
    googleAppsScriptService.triggerBackupToSheets(db).catch(() => {});

    return newBooking;
  },

  // 3. Update Booking
  async updateBooking(id: string, updates: Partial<RoomBooking>): Promise<RoomBooking | null> {
    const db = getDB();
    if (!Array.isArray(db.booking_ruangan)) db.booking_ruangan = [];
    if (!Array.isArray(db.roomBookings)) db.roomBookings = [];

    const idx = db.booking_ruangan.findIndex((b) => String(b.id) === String(id));
    if (idx === -1) return null;

    const nowIso = new Date().toISOString();
    const updatedBooking: RoomBooking = {
      ...db.booking_ruangan[idx],
      ...updates,
      updatedAt: nowIso
    };

    db.booking_ruangan[idx] = updatedBooking;
    const rIdx = db.roomBookings.findIndex((b) => String(b.id) === String(id));
    if (rIdx > -1) {
      db.roomBookings[rIdx] = updatedBooking;
    } else {
      db.roomBookings.push(updatedBooking);
    }

    // Lapis 2: Local Cache
    saveDB(db);

    // Lapis 1: Firestore Realtime
    try {
      await pushItemToFirestoreCollection('booking_ruangan', updatedBooking.id, updatedBooking);
      await pushItemToFirestoreCollection('roomBookings', updatedBooking.id, updatedBooking);
    } catch (err) {
      console.warn('[BookingService] Firestore update queued:', err);
    }

    // Lapis 3: Background Sync
    uploadDataBackground();

    googleAppsScriptService.triggerBackupToSheets(db).catch(() => {});

    return updatedBooking;
  },

  // 4. Delete Booking
  async deleteBooking(id: string): Promise<boolean> {
    const db = getDB();
    registerDeletedId(String(id));

    if (Array.isArray(db.booking_ruangan)) {
      db.booking_ruangan = db.booking_ruangan.filter((b) => String(b.id) !== String(id));
    }
    if (Array.isArray(db.roomBookings)) {
      db.roomBookings = db.roomBookings.filter((b) => String(b.id) !== String(id));
    }

    saveDB(db);
    uploadDataBackground();
    return true;
  }
};
