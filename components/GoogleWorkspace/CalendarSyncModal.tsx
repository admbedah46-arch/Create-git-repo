import React, { useState, useEffect } from 'react';
import { 
  createCalendarEvent, 
  listCalendarEvents, 
  deleteCalendarEvent,
  CalendarEventData,
  getWorkspaceAccessToken
} from '../../googleWorkspace';
import { 
  Calendar, CheckCircle2, RefreshCw, Plus, Trash2, ExternalLink, X, 
  Loader2, Clock, MapPin, User, AlertCircle, Sparkles
} from 'lucide-react';

interface SurgicalOperationItem {
  id?: string;
  patientName: string;
  medRecNo: string;
  operator: string;
  procedure: string;
  room?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

interface CalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  operations?: SurgicalOperationItem[];
  notify?: (msg: string, type?: 'success' | 'danger') => void;
}

export const CalendarSyncModal: React.FC<CalendarSyncModalProps> = ({
  isOpen,
  onClose,
  operations = [],
  notify,
}) => {
  const [googleEvents, setGoogleEvents] = useState<CalendarEventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCalendarEvents();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchCalendarEvents = async () => {
    const token = getWorkspaceAccessToken();
    if (!token) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      // Get events from today onwards
      const timeMin = new Date().toISOString();
      const events = await listCalendarEvents(timeMin);
      setGoogleEvents(events);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal memuat jadwal Google Calendar');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOperation = async (op: SurgicalOperationItem) => {
    setSyncingId(op.id || op.patientName);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Construct start and end dateTime
      const startDateTimeStr = op.startTime 
        ? `${op.date}T${op.startTime}:00+07:00`
        : `${op.date}T08:00:00+07:00`;

      const endDateTimeStr = op.endTime
        ? `${op.date}T${op.endTime}:00+07:00`
        : `${op.date}T10:00:00+07:00`;

      const eventData: CalendarEventData = {
        summary: `[OPERASI] ${op.procedure} - ${op.patientName}`,
        description: `Jadwal Operasi SiMANTAP Bedah\nPasien: ${op.patientName}\nNo. RM: ${op.medRecNo}\nOperator: ${op.operator}\nTindakan: ${op.procedure}\nKamar Operasi: ${op.room || 'OK Bedah'}`,
        location: op.room || 'Kamar Operasi RS',
        start: {
          dateTime: new Date(startDateTimeStr).toISOString(),
          timeZone: 'Asia/Jakarta',
        },
        end: {
          dateTime: new Date(endDateTimeStr).toISOString(),
          timeZone: 'Asia/Jakarta',
        },
      };

      await createCalendarEvent(eventData);

      setSuccessMsg(`Jadwal operasi "${op.patientName}" berhasil disinkronkan ke Google Calendar!`);
      if (notify) notify(`Disinkronkan ke Google Calendar: ${op.patientName}`, 'success');
      
      // Refresh Google Calendar list
      await fetchCalendarEvents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan jadwal ke Google Calendar');
      if (notify) notify(err.message || 'Gagal sinkronisasi Google Calendar', 'danger');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteEvent = async (eventId: string, summary: string) => {
    // Confirm deletion first
    const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus acara "${summary}" dari Google Calendar?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteCalendarEvent(eventId);
      if (notify) notify(`Acara dihapus dari Google Calendar`, 'success');
      await fetchCalendarEvents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus acara');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-fade-in">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800 to-indigo-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Calendar className="w-6 h-6 text-purple-200" />
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-wider">Google Calendar Sync</h3>
              <p className="text-xs text-purple-200">Sinkronisasi Jadwal Operasi dengan Google Calendar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: SiMANTAP Surgery Schedules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={15} className="text-purple-600" />
                Jadwal Operasi SiMANTAP Bedah ({operations.length})
              </h4>
            </div>

            {operations.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                Belum ada jadwal operasi terdaftar di sistem.
              </div>
            ) : (
              <div className="space-y-2.5">
                {operations.map((op, idx) => (
                  <div
                    key={op.id || idx}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-xs">{op.patientName}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                          RM: {op.medRecNo}
                        </span>
                      </div>
                      <p className="text-xs text-purple-700 font-semibold">{op.procedure}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium pt-0.5">
                        <span className="flex items-center gap-1">
                          <User size={12} /> Operator: {op.operator}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {op.date} {op.startTime ? `(${op.startTime})` : ''}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSyncOperation(op)}
                      disabled={syncingId === (op.id || op.patientName)}
                      className="inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition-all shrink-0 disabled:opacity-50"
                    >
                      {syncingId === (op.id || op.patientName) ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Menyinkronkan...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          <span>Sync ke Google Calendar</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Current Google Calendar Events */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={15} className="text-indigo-600" />
                Jadwal Terdaftar di Google Calendar ({googleEvents.length})
              </h4>
              <button
                onClick={fetchCalendarEvents}
                disabled={loading}
                className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                title="Refresh Calendar"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-purple-600" />
                <span>Memuat acara dari Google Calendar...</span>
              </div>
            ) : googleEvents.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                Tidak ada jadwal mendatang di Google Calendar.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                {googleEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 overflow-hidden">
                      <h5 className="font-bold text-xs text-indigo-900 truncate">{ev.summary}</h5>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        {ev.start?.dateTime && (
                          <span>
                            {new Date(ev.start.dateTime).toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        )}
                        {ev.location && <span>• {ev.location}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleDeleteEvent(ev.id!, ev.summary)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        title="Hapus dari Google Calendar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
          >
            <span>Buka Google Calendar Web</span>
            <ExternalLink size={13} />
          </a>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 px-5 py-2.5 rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
