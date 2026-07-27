import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Printer,
  RefreshCw,
  Plus,
  Calendar,
  Filter,
  FileText,
  ChevronDown,
  AlertCircle,
  UserCheck,
  UserPlus,
  History,
  Copy,
  Edit,
  Pill,
  User,
  Stethoscope,
  X,
  Search,
  Trash2,
  Check,
  HeartHandshake,
} from "lucide-react";
import {
  Patient,
  DailyReportEntry,
  MasterData,
  DependencyLevel,
  User as UserType,
  getDpjpStyles,
  getRoomBedStyles,
  getPaymentMethodStyles,
  parseToStandardDateString,
  compareDatesSafe,
} from "../../types";
import { Button } from "../Button";
import { SearchableSelect } from "../SearchableSelect";
import { DebouncedInput, DebouncedTextarea } from "../DebouncedInput";
import { generatePermanentUUID } from "../../db";

const isSameDate = (d1: any, d2: any) => {
  if (!d1 || !d2) return false;
  return parseToStandardDateString(d1) === parseToStandardDateString(d2);
};

const isDateBeforeOrSame = (d1: any, d2: any) => {
  if (!d1 || !d2) return false;
  return parseToStandardDateString(d1) <= parseToStandardDateString(d2);
};

const isDateBefore = (d1: any, d2: any) => {
  if (!d1 || !d2) return false;
  return parseToStandardDateString(d1) < parseToStandardDateString(d2);
};

interface ServiceMatrixProps {
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  patientLocks?: { [patientId: string]: { username: string; lockedAt: number } };
  masterData: MasterData;
  onAddPatient: () => void;
  onUpdateReport: (
    patientId: string,
    type: keyof DailyReportEntry | "BATCH",
    content: any,
    date?: string,
  ) => Promise<any> | any;
  onUpdateDependency?: (
    patientId: string,
    shift: "morning" | "afternoon" | "night",
    level: DependencyLevel,
    date?: string,
  ) => void;
  onUpdatePatient?: (id: string, updates: Partial<Patient>) => void;
  onAddDoctorVisit?: (visit: any) => void;
  onUpdateDoctorVisit?: (id: string, updates: any) => void;
  onRemoveDoctorVisit?: (id: string) => void;
  appData?: any;
  currentUser?: UserType | null;
  onPatientClick?: (patientId: string) => void;
  syncStatus?: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
}

// Create a separate component for doctor rows to allow per-item state (fixes Hook error)
const DoctorVisitRow = ({ 
  doc, 
  existingVisit, 
  editingVisite, 
  masterData, 
  onAddDoctorVisit, 
  onRemoveDoctorVisit, 
  currentUser 
}: any) => {
  const [tempRole, setTempRole] = useState(existingVisit?.visitRole || 'DPJP_UTAMA');
  const [assistantName, setAssistantName] = useState(existingVisit?.assistantName || '');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    existingVisit?.attendanceStatuses || (existingVisit?.attendanceStatus ? [existingVisit.attendanceStatus] : [])
  );

  const assistantDoctors = (masterData?.doctors || []).filter((d: string) => 
    masterData?.doctorMetadata?.[d]?.ksm === 'Umum'
  );

  const toggleStatus = (statusId: string) => {
    setSelectedStatuses(prev => 
      prev.includes(statusId) 
        ? prev.filter(s => s !== statusId) 
        : [...prev, statusId]
    );
  };

  const STATUS_OPTIONS = [
    { id: 'HADIR', label: 'HADIR', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', activeColor: 'bg-emerald-600 text-white border-emerald-600' },
    { id: 'TIDAK_HADIR', label: 'ABSEN', color: 'bg-rose-50 text-rose-600 border-rose-100', activeColor: 'bg-rose-600 text-white border-rose-600' },
    { id: 'IZIN', label: 'IZIN', color: 'bg-amber-50 text-amber-600 border-amber-100', activeColor: 'bg-amber-600 text-white border-amber-600' },
    { id: 'CUTI', label: 'CUTI', color: 'bg-slate-50 text-slate-600 border-slate-100', activeColor: 'bg-slate-600 text-white border-slate-600' },
    { id: 'ASISTEN', label: 'ASISTEN', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', activeColor: 'bg-indigo-600 text-white border-indigo-600' },
  ];

  const handleSave = () => {
    if (!onAddDoctorVisit || selectedStatuses.length === 0) return;
    
    onAddDoctorVisit({
      id: existingVisit?.id || Math.random().toString(36).substr(2, 9),
      patientId: editingVisite.patientId,
      patientName: editingVisite.patientName,
      noRM: editingVisite.noRM,
      doctorId: doc,
      doctorName: doc,
      smf: masterData.doctorMetadata[doc]?.ksm || '',
      date: editingVisite.date,
      // Keep legacy field for compatibility, but prioritize new array
      attendanceStatus: selectedStatuses.includes('HADIR') ? 'HADIR' : (selectedStatuses.includes('TIDAK_HADIR') ? 'TIDAK_HADIR' : selectedStatuses[0]),
      attendanceStatuses: selectedStatuses,
      assistantName: selectedStatuses.includes('ASISTEN') ? assistantName : '',
      visitRole: tempRole,
      unit: editingVisite.unit || '',
      paymentMethod: editingVisite.paymentMethod.join(', '),
      recordedAt: new Date().toISOString(),
      recordedBy: currentUser?.name || ''
    });
  };

  return (
    <div key={doc} className={`p-6 rounded-[2.5rem] border transition-all space-y-4 ${existingVisit ? 'bg-indigo-50/30 border-indigo-100' : 'bg-white hover:bg-slate-50 border-slate-100'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="text-sm font-black text-slate-800 uppercase leading-snug tracking-tighter">{doc}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">SMF {masterData.doctorMetadata[doc]?.ksm || 'TIDAK TERDEFINISI'}</div>
        </div>
        
        {existingVisit && (
          <button 
            onClick={() => onRemoveDoctorVisit && onRemoveDoctorVisit(existingVisit.id)}
            className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors"
            title="Hapus Data"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">PILIHAN VISITE</label>
          <select 
            className="w-full bg-white border border-slate-200 rounded-2xl text-xs font-black px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            value={tempRole}
            onChange={(e) => setTempRole(e.target.value)}
          >
            <option value="DPJP_UTAMA">DPJP UTAMA</option>
            <option value="KONSULEN">KONSULEN</option>
            <option value="DPJP_KONSULEN">DPJP + KONSULEN</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">KEHADIRAN (MULTIPEL)</label>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map(opt => {
              const isActive = selectedStatuses.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleStatus(opt.id)}
                  className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-tight border transition-all ${isActive ? opt.activeColor : opt.color}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedStatuses.includes('ASISTEN') && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            DOKTER UMUM ASISTEN
          </label>
          <select 
            className="w-full bg-indigo-50/50 border border-indigo-200 rounded-2xl text-xs font-black px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
          >
            <option value="">Pilih Dokter Umum yang mewakili...</option>
            {assistantDoctors.map((d: string) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {assistantName && (
            <div className="text-[9px] font-bold text-indigo-500 italic ml-1">
              * Visite akan dilakukan oleh {assistantName}
            </div>
          )}
        </div>
      )}

      <div className="pt-2 flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={selectedStatuses.length === 0}
          className={`px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all ${
            existingVisit 
              ? 'bg-slate-800 text-white hover:bg-slate-700' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
          }`}
        >
          {existingVisit ? 'UPDATE DATA' : 'SIMPAN VISITE'}
        </Button>
      </div>
    </div>
  );
};

interface StatusChangeModalProps {
  statusChangePatient: {
    id: string;
    newStatus: string;
    date: string;
    time: string;
    reason?: string;
    destination?: string;
    destinationClass?: string;
    destinationRoom?: string;
    destinationBed?: string;
    isInternalOnly?: boolean;
  };
  masterData: MasterData;
  patients: Patient[];
  onUpdatePatient?: (id: string, updates: Partial<Patient>) => void;
  onClose: () => void;
}

const StatusChangeModal: React.FC<StatusChangeModalProps> = ({
  statusChangePatient: initialPatient,
  masterData,
  patients,
  onUpdatePatient,
  onClose,
}) => {
  const [localState, setLocalState] = useState(initialPatient);

  const handleConfirm = () => {
    if (!onUpdatePatient) return;
    const updates: Partial<Patient> = {
      statusDataPasien: localState.newStatus,
    };

    const isDischarge = ["BPL", "BPL (Boleh Pulang)", "Meninggal", "APS", "APS (Pulang Paksa)", "Dirujuk", "Rujuk", "Batal Rawat Inap", "Batal"].includes(localState.newStatus);

    if (isDischarge) {
      updates.dischargeDate = localState.date;
      updates.dischargeTime = localState.time;
      updates.status = 'DISCHARGED';
    }

    if (localState.newStatus === "APS" || localState.newStatus === "APS (Pulang Paksa)") {
      updates.apsReason = localState.reason;
    } else if (localState.newStatus === "Dirujuk" || localState.newStatus === "Rujuk") {
      updates.referralDestination = localState.destination;
    } else if (localState.newStatus === "Meninggal") {
      updates.deathTime = localState.reason as any;
    } else if (localState.newStatus === "Dipindah ke Ruangan Lain" || localState.newStatus === "Pindah Ruangan") {
      const currentPatient = patients.find((p) => p.id === localState.id);
      
      const isInternal = localState.isInternalOnly || 
                         (currentPatient && currentPatient.unitTujuan === localState.destination);

      if (isInternal) {
        updates.statusDataPasien = "Masih Dirawat";
        updates.status = "ADMITTED";
        updates.dischargeDate = "";
        updates.dischargeTime = "";
        updates.unitTujuan = localState.destination;
        updates.kelasRawat = localState.destinationClass;
        updates.ruangan = localState.destinationRoom;
        updates.nomorBed = localState.destinationBed;
      } else {
        updates.statusDataPasien = "Dipindah ke Ruangan Lain";
        updates.status = "DISCHARGED";
        updates.dischargeDate = localState.date || new Date().toISOString().split("T")[0];
        updates.dischargeTime = localState.time || new Date().toTimeString().split(" ")[0].substring(0, 5);
        
        updates.unitTujuan = currentPatient?.unitTujuan || "";
        updates.kelasRawat = currentPatient?.kelasRawat || "";
        updates.ruangan = currentPatient?.ruangan || "";
        updates.nomorBed = currentPatient?.nomorBed || "";
        
        updates.transferUnit = localState.destination;
        updates.transferClass = localState.destinationClass;
        updates.transferRoom = localState.destinationRoom;
        updates.transferBed = localState.destinationBed;
        updates.transferDestinationRoom = localState.destinationRoom;

        const newPatientId = generatePermanentUUID('P');
        const autoRecord: Patient = {
          id: newPatientId,
          noRegister: `REG-${Date.now().toString().slice(-6)}`,
          noRM: currentPatient?.noRM || "",
          name: currentPatient?.name || "",
          gender: currentPatient?.gender || "L",
          birthDate: currentPatient?.birthDate || "",
          address: currentPatient?.address || "",
          entryDate: localState.date || new Date().toISOString().split("T")[0],
          entryTime: localState.time || new Date().toTimeString().split(" ")[0].substring(0, 5),
          origin: "MUTASI",
          unitTujuan: localState.destination || "",
          kelasRawat: localState.destinationClass || "",
          ruangan: localState.destinationRoom || "",
          nomorBed: localState.destinationBed || "",
          statusDataPasien: "Masih Dirawat",
          diagnosaUtama: currentPatient?.diagnosaUtama || "",
          diagnosaSekunder: currentPatient?.diagnosaSekunder || "",
          tindakanProsedur: currentPatient?.tindakanProsedur || "",
          dpjpList: currentPatient?.dpjpList || [],
          paymentMethod: currentPatient?.paymentMethod || [],
          noSEP: currentPatient?.noSEP || "",
          statusSEP: currentPatient?.statusSEP || "",
          jenisKLL: currentPatient?.jenisKLL || "",
          noLP: currentPatient?.noLP || "",
          perawatPrimer: "",
          catatanKhusus: currentPatient?.catatanKhusus || "",
          allergyHistory: currentPatient?.allergyHistory || "",
          emergencyContactName: currentPatient?.emergencyContactName || "",
          emergencyContactPhone: currentPatient?.emergencyContactPhone || "",
          adminResp: currentPatient?.adminResp || "",
          status: "ADMITTED"
        };
        (updates as any)._autoRegisterNewRecord = autoRecord;
      }

      const history = [...(currentPatient?.transferHistory || [])];
      history.push({
        date: `${localState.date} ${localState.time}`,
        fromUnit: `${currentPatient?.unitTujuan || ""} (${currentPatient?.ruangan || ""})`,
        toUnit: `${localState.destination} (${localState.destinationRoom || ""})`,
      });
      updates.transferHistory = history;
    }

    onUpdatePatient(localState.id, updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] p-10 w-full max-w-lg shadow-2xl animate-fade-in border-t-8 border-indigo-600">
        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-8">
          Detail {(localState.newStatus === "BPL" || localState.newStatus === "BPL (Boleh Pulang)") ? "Boleh Pulang" : (localState.newStatus === "Dipindah ke Ruangan Lain" || localState.newStatus === "Pindah Ruangan") ? "Pindah Ruangan" : localState.newStatus}
        </h3>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Tanggal {(localState.newStatus === "Dipindah ke Ruangan Lain" || localState.newStatus === "Pindah Ruangan") ? "Pindah" : (localState.newStatus === "BPL" || localState.newStatus === "BPL (Boleh Pulang)") ? "Pulang" : localState.newStatus}
              </label>
              <input
                type="date"
                className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                value={localState.date}
                onChange={(e) =>
                  setLocalState({
                    ...localState,
                    date: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Jam {(localState.newStatus === "Dipindah ke Ruangan Lain" || localState.newStatus === "Pindah Ruangan") ? "Pindah" : (localState.newStatus === "BPL" || localState.newStatus === "BPL (Boleh Pulang)") ? "Pulang" : localState.newStatus}
              </label>
              <input
                type="time"
                className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                value={localState.time}
                onChange={(e) =>
                  setLocalState({
                    ...localState,
                    time: e.target.value,
                  })
                }
              />
            </div>
          </div>

          {(localState.newStatus === "APS" || localState.newStatus === "APS (Pulang Paksa)") && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Alasan APS (Sinkron Mutu)
              </label>
              <textarea
                className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-500"
                placeholder="Masukkan alasan APS dengan detail..."
                value={localState.reason}
                onChange={(e) =>
                  setLocalState({
                    ...localState,
                    reason: e.target.value,
                  })
                }
              />
            </div>
          )}

          {(localState.newStatus === "Dirujuk" || localState.newStatus === "Rujuk") && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                RS Tujuan Rujuk
              </label>
              <input
                type="text"
                className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                placeholder="Nama Rumah Sakit Tujuan..."
                value={localState.destination}
                onChange={(e) =>
                  setLocalState({
                    ...localState,
                    destination: e.target.value,
                  })
                }
              />
            </div>
          )}

          {(localState.newStatus === "Dipindah ke Ruangan Lain" || localState.newStatus === "Pindah Ruangan") && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Unit Tujuan
                </label>
                <select
                  disabled={localState.isInternalOnly}
                  className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500 text-slate-700 disabled:opacity-75 disabled:bg-slate-50"
                  value={localState.destination || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const classes = masterData.unitToClasses[val] || [];
                    const autoClass = classes.length === 1 ? classes[0] : "";
                    let autoRoom = "";
                    if (autoClass) {
                      const rooms = masterData.classToRooms[`${val} - ${autoClass}`] || [];
                      if (rooms.length === 1) autoRoom = rooms[0];
                    }
                    setLocalState({
                      ...localState,
                      destination: val,
                      destinationClass: autoClass,
                      destinationRoom: autoRoom,
                      destinationBed: "",
                    });
                  }}
                >
                  <option value="">-- Pilih Unit Tujuan --</option>
                  {masterData.units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Kelas {!localState.destination && <span className="text-red-400 text-[8px] italic">(Pilih unit)</span>}
                  </label>
                  <select
                    disabled={!localState.destination}
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500 disabled:opacity-50 text-slate-700"
                    value={localState.destinationClass || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const rooms = masterData.classToRooms[`${localState.destination} - ${val}`] || [];
                      const autoRoom = rooms.length === 1 ? rooms[0] : "";
                      setLocalState({
                        ...localState,
                        destinationClass: val,
                        destinationRoom: autoRoom,
                        destinationBed: "",
                      });
                    }}
                  >
                    <option value="">-- Kelas --</option>
                    {(masterData.unitToClasses[localState.destination || ""] || []).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Ruangan {!localState.destinationClass && <span className="text-red-400 text-[8px] italic">(Pilih kelas)</span>}
                  </label>
                  <select
                    disabled={!localState.destinationClass}
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500 disabled:opacity-50 text-slate-700"
                    value={localState.destinationRoom || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const beds = masterData.roomToBeds[val] || [];
                      const autoBed = beds.length === 1 ? beds[0] : "";
                      setLocalState({
                        ...localState,
                        destinationRoom: val,
                        destinationBed: autoBed,
                      });
                    }}
                  >
                    <option value="">-- Ruangan --</option>
                    {(masterData.classToRooms[`${localState.destination} - ${localState.destinationClass}`] || []).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Nomor Bed {!localState.destinationRoom && <span className="text-red-400 text-[8px] italic">(Pilih ruangan)</span>}
                </label>
                <select
                  disabled={!localState.destinationRoom}
                  className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500 disabled:opacity-50 text-slate-700"
                  value={localState.destinationBed || ""}
                  onChange={(e) =>
                    setLocalState({
                      ...localState,
                      destinationBed: e.target.value,
                    })
                  }
                >
                  <option value="">-- Pilih Bed --</option>
                  {(masterData.roomToBeds[localState.destinationRoom || ""] || []).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {localState.newStatus === "Meninggal" && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Kategori Waktu Meninggal
              </label>
              <select
                className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500"
                value={localState.reason}
                onChange={(e) =>
                  setLocalState({
                    ...localState,
                    reason: e.target.value,
                  })
                }
              >
                <option value="">-- Pilih Kategori --</option>
                <option value="<48h">MENINGGAL &lt; 48 JAM</option>
                <option value=">=48h">MENINGGAL &gt;= 48 JAM</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-10 flex gap-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest bg-slate-100 text-slate-600"
          >
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest bg-indigo-600 text-white shadow-xl shadow-indigo-100"
          >
            Konfirmasi
          </Button>
        </div>
      </div>
    </div>
  );
};

interface ShiftReportModalProps {
  editingEntry: {
    patientId: string;
    type: keyof DailyReportEntry;
    tempDiagnosis?: string;
    tempTherapy?: string;
    tempReport?: string;
    tempDependency?: DependencyLevel;
    tempRecordedBy?: string;
  };
  patients: Patient[];
  masterData: MasterData;
  dailyReports: DailyReportEntry[];
  selectedDate: string;
  currentUser: any;
  primaryNurses: string[];
  onUpdateReport: (
    patientId: string,
    mode: "BATCH" | "DIAGNOSIS" | "THERAPY",
    fields: Partial<DailyReportEntry>,
    dateStr?: string,
  ) => Promise<any>;
  onClose: () => void;
}

const ShiftReportModal: React.FC<ShiftReportModalProps> = React.memo(({
  editingEntry: initialEntry,
  patients,
  masterData,
  dailyReports,
  selectedDate,
  currentUser,
  primaryNurses,
  onUpdateReport,
  onClose,
}) => {
  const [editingEntry, setEditingEntry] = useState(initialEntry);
  const [nurseSearch, setNurseSearch] = useState("");
  const [isNurseDropdownOpen, setIsNurseDropdownOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [aiSplittingDiagnosis, setAiSplittingDiagnosis] = useState(false);
  const [aiSplitDiagnosesResult, setAiSplitDiagnosesResult] = useState<string[] | null>(null);
  const [aiAnalyzingTherapy, setAiAnalyzingTherapy] = useState(false);
  const [aiTherapyAnalysis, setAiTherapyAnalysis] = useState<string | null>(null);

  const filteredNurses = React.useMemo(() => {
    if (!nurseSearch) return primaryNurses;
    return primaryNurses.filter((n) =>
      n.toLowerCase().includes(nurseSearch.toLowerCase()),
    );
  }, [primaryNurses, nurseSearch]);

  const handleSelectDependency = React.useCallback((lvl: DependencyLevel) => {
    setEditingEntry((prev) => (prev ? { ...prev, tempDependency: lvl } : null));
    setError(null);
  }, []);

  const handleSelectNurse = React.useCallback((nurseName: string) => {
    setEditingEntry((prev) => (prev ? { ...prev, tempRecordedBy: nurseName } : null));
    setIsNurseDropdownOpen(false);
    setNurseSearch("");
    setError(null);
  }, []);

  const getReportForPatient = (pId: string) => {
    return dailyReports.find(r => r.patientId === pId && isSameDate(r.date, selectedDate));
  };

  const handleAiSplitDiagnosis = async (text: string) => {
    if (!text.trim()) return;
    setAiSplittingDiagnosis(true);
    setAiSplitDiagnosesResult(null);
    try {
      const res = await fetch("/api/split-diagnoses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosisText: text })
      });
      const data = await res.json();
      if (data.success) {
        setAiSplitDiagnosesResult(data.results || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiSplittingDiagnosis(false);
    }
  };

  const handleAiAnalyzeTherapy = async (text: string) => {
    if (!text.trim()) return;
    setAiAnalyzingTherapy(true);
    setAiTherapyAnalysis(null);
    try {
      const res = await fetch("/api/analyze-therapy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapyText: text })
      });
      const data = await res.json();
      if (data.success) {
        setAiTherapyAnalysis(data.analysis);
      } else {
        setAiTherapyAnalysis(data.warning || "Gagal menganalisis terapi.");
      }
    } catch (err: any) {
      setAiTherapyAnalysis("Koneksi gagal: " + err.message);
    } finally {
      setAiAnalyzingTherapy(false);
    }
  };

  const applyTagToReport = (tagStart: string, tagEnd: string) => {
    const textarea = document.getElementById("catatan-textarea") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editingEntry?.tempReport || "";
    const selectedText = text.substring(start, end);
    const replacement = tagStart + selectedText + tagEnd;
    const newReport = text.substring(0, start) + replacement + text.substring(end);
    setEditingEntry({
      ...editingEntry,
      tempReport: newReport
    });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagStart.length, start + tagStart.length + selectedText.length);
    }, 50);
  };

  const insertSymbolToReport = (sym: string) => {
    const textarea = document.getElementById("catatan-textarea") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editingEntry?.tempReport || "";
    const newReport = text.substring(0, start) + sym + text.substring(end);
    setEditingEntry({
      ...editingEntry,
      tempReport: newReport
    });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + sym.length, start + sym.length);
    }, 50);
  };

  const handleSaveShiftReport = () => {
    if (!editingEntry) return;

    const shiftPrefix = editingEntry.type.replace("Report", "");
    const currentLevel = editingEntry.tempDependency;
    const currentRecorder = editingEntry.tempRecordedBy;

    if (!currentLevel) {
      setError("Wajib mengisi Tingkat Ketergantungan!");
      return;
    }

    if (!currentRecorder) {
      setError("Wajib mengisi Pembuat Laporan!");
      return;
    }

    setError(null);
    setSaveError(null);
    setIsSaving(true);

    // Call onUpdateReport asynchronously in the background without blocking the UI
    onUpdateReport(
      editingEntry.patientId,
      "BATCH",
      {
        diagnosis: editingEntry.tempDiagnosis,
        [`${shiftPrefix}Therapy`]: editingEntry.tempTherapy,
        [`${shiftPrefix}Report`]: editingEntry.tempReport,
        [`${shiftPrefix}RecordedBy`]: editingEntry.tempRecordedBy,
        [`${shiftPrefix}Dependency`]: editingEntry.tempDependency,
      },
      selectedDate,
    ).catch((err: any) => {
      console.warn("Background shift report sync failed (already saved locally):", err);
    });

    // INSTANT FEEDBACK: Display success toast and close the modal immediately (0ms delay)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("surgihub_toast", {
          detail: {
            message: "Laporan berhasil disimpan (Sinkronisasi berjalan di background)",
            type: "success",
          },
        })
      );
    }
    
    // Close the modal instantly
    onClose();
  };

  const getDepLabel = (shift: string, r?: DailyReportEntry) => {
    if (!r) return null;
    const dep = (r as any)[`${shift}Dependency` as any];
    if (!dep) return null;
    return (
      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border ${
        dep === 'TOTAL' ? 'bg-red-50 text-red-600 border-red-100' :
        dep === 'PARSIAL' ? 'bg-amber-50 text-amber-600 border-amber-100' :
        'bg-emerald-50 text-emerald-600 border-emerald-100'
      }`}>
        {dep}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl animate-fade-in border-t-8 border-indigo-600 max-h-[96vh] w-full max-w-6xl flex flex-col md:flex-row overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 z-[220]"
        >
          <X size={24} />
        </button>
        <div className="flex-1 p-8 md:p-10 overflow-y-auto custom-scrollbar border-r border-slate-100 min-h-0 bg-white">
          <div className="flex justify-between items-start mb-8 gap-4 mr-8">
            <div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                Entri Laporan Shift
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                Pasien: {patients.find(p => p.id === editingEntry.patientId)?.name}
              </p>
            </div>
            <button
              type="button"
              id="btn-mini-reset-laporan"
              onClick={() => setShowResetConfirm(true)}
              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer shadow-sm select-none"
              title="Reset total laporan shift ini"
            >
              <RefreshCw size={13} className="animate-spin-slow text-red-500" /> RESET LAPORAN
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                Tingkat Ketergantungan <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["MINIMAL", "PARSIAL", "TOTAL"] as DependencyLevel[]).map(
                  (lvl, i) => {
                    const currentLevel = editingEntry?.tempDependency;
                    return (
                      <button
                        key={`${lvl}-${i}`}
                        type="button"
                        onClick={() => handleSelectDependency(lvl)}
                        className={`py-3 rounded-xl text-[10px] font-black border transition-all ${currentLevel === lvl ? "bg-indigo-600 text-white border-indigo-600 shadow-lg" : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-white"}`}
                      >
                        {lvl}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  Pembuat Laporan <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <div
                    onClick={() =>
                      setIsNurseDropdownOpen(!isNurseDropdownOpen)
                    }
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold bg-white cursor-pointer flex justify-between items-center"
                  >
                    <span className="truncate">
                      {editingEntry.tempRecordedBy || "-- Pilih Perawat --"}
                    </span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </div>

                  {isNurseDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-100 rounded-2xl shadow-2xl z-[210] overflow-hidden flex flex-col max-h-64">
                      <div className="p-3 border-b bg-slate-50">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Cari nama perawat..."
                          className="w-full px-3 py-2 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={nurseSearch}
                          onChange={(e) => setNurseSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="overflow-y-auto custom-scrollbar">
                        {filteredNurses.length > 0 ? (
                          filteredNurses.map((n, nIdx) => (
                            <div
                              key={`nurse-${n}-${nIdx}`}
                              onClick={() => handleSelectNurse(n)}
                              className={`px-4 py-3 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
                                editingEntry?.tempRecordedBy === n
                                  ? "bg-indigo-50 text-indigo-600"
                                  : "hover:bg-slate-50 text-slate-600"
                              }`}
                            >
                              <span>{n}</span>
                              {n === currentUser?.name && (
                                <span className="text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black">
                                  SAYA
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-[10px] font-bold text-slate-400 italic">
                             Tidak ditemukan.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Shift
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-2.5 bg-slate-50 rounded-xl text-xs font-black text-slate-500 uppercase tracking-widest border border-slate-100">
                    {editingEntry.type.replace("Report", "").toUpperCase()}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const shift = editingEntry.type.replace("Report", "");
                      
                      const currentDayReport = getReportForPatient(editingEntry.patientId);
                      let prevContent = "";
                      let prevTherapy = "";
                      let prevRecorder = "";
                      let prevDep = "";

                      if (shift === "afternoon" && currentDayReport) {
                        prevContent = currentDayReport.morningReport || "";
                        prevTherapy = currentDayReport.morningTherapy || "";
                        prevRecorder = currentDayReport.morningRecordedBy || "";
                        prevDep = currentDayReport.morningDependency || "";
                      } else if (shift === "night" && currentDayReport) {
                        prevContent = currentDayReport.afternoonReport || "";
                        prevTherapy = currentDayReport.afternoonTherapy || "";
                        prevRecorder = currentDayReport.afternoonRecordedBy || "";
                        prevDep = currentDayReport.afternoonDependency || "";
                      }

                      if (!prevContent && !prevTherapy) {
                        const prevDayReport = dailyReports
                          .filter(
                            (r) =>
                              r.patientId === editingEntry.patientId &&
                              isDateBefore(r.date, selectedDate),
                          )
                          .sort((a, b) => compareDatesSafe(a.date, b.date, true))[0];

                        if (prevDayReport) {
                          if (shift === "morning") {
                              prevContent = prevDayReport.nightReport || "";
                              prevTherapy = prevDayReport.nightTherapy || "";
                              prevRecorder = prevDayReport.nightRecordedBy || "";
                              prevDep = prevDayReport.nightDependency || "";
                          } else {
                              prevContent = (prevDayReport as any)[editingEntry.type] || "";
                              prevTherapy = (prevDayReport as any)[`${shift}Therapy`] || "";
                              prevRecorder = (prevDayReport as any)[`${shift}RecordedBy`] || "";
                              prevDep = (prevDayReport as any)[`${shift}Dependency`] || "";
                          }
                        }
                      }

                      setEditingEntry({
                        ...editingEntry,
                        tempReport: prevContent || editingEntry.tempReport,
                        tempTherapy: prevTherapy || editingEntry.tempTherapy,
                        tempRecordedBy: prevRecorder || editingEntry.tempRecordedBy || "",
                        tempDependency: (prevDep as DependencyLevel) || editingEntry.tempDependency,
                      });
                    }}
                    className="bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200"
                  >
                    Copy Prev
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Diagnosa Medis (Update Shift Ini)
                </label>
                <button
                  type="button"
                  onClick={() => handleAiSplitDiagnosis(editingEntry.tempDiagnosis || "")}
                  disabled={aiSplittingDiagnosis || !(editingEntry.tempDiagnosis || "").trim()}
                  className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                >
                  ✨ AI Belah Diagnosa
                </button>
              </div>
              <DebouncedInput
                type="text"
                className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                placeholder="Diagnosa saat ini (bisa gabungan, misal: Hipertensi, DM)..."
                value={editingEntry.tempDiagnosis || ""}
                onChangeValue={(val) =>
                  setEditingEntry((prev) => (prev ? {
                    ...prev,
                    tempDiagnosis: val,
                  } : null))
                }
              />
              {aiSplittingDiagnosis && (
                <div className="text-[10px] font-bold text-slate-400 mt-2 animate-pulse">
                  Memproses diagnosa dengan AI...
                </div>
              )}
              {aiSplitDiagnosesResult && (
                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Hasil Analisis AI (Terbelah Tunggal):</div>
                  <div className="flex flex-wrap gap-1.5">
                    {aiSplitDiagnosesResult.map((diag, dIdx) => (
                      <span 
                        key={dIdx} 
                        className="px-2 py-1 rounded bg-teal-50 border border-teal-200 text-[10px] font-black text-teal-750 flex items-center gap-1 cursor-pointer hover:bg-teal-100 transition-colors"
                        onClick={() => {
                          setEditingEntry({
                            ...editingEntry,
                            tempDiagnosis: diag
                          });
                        }}
                      >
                        {diag} <span className="opacity-40 text-[8px] font-normal">(Klik utk salin)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <div className="flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Terapi / Instruksi Medis
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAiAnalyzeTherapy(editingEntry.tempTherapy || "")}
                    disabled={aiAnalyzingTherapy || !(editingEntry.tempTherapy || "").trim()}
                    className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                  >
                    💊 AI Analisa Restriksi
                  </button>
                </div>
                <DebouncedTextarea
                  className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-emerald-500 outline-none flex-1 min-h-[300px] bg-emerald-50/20"
                  placeholder="Masukkan daftar obat, dosis, atau instruksi khusus..."
                  value={editingEntry.tempTherapy || ""}
                  onChangeValue={(val) =>
                    setEditingEntry((prev) => (prev ? {
                      ...prev,
                      tempTherapy: val,
                    } : null))
                  }
                />
                {aiAnalyzingTherapy && (
                  <div className="text-[10px] font-bold text-slate-400 mt-2 animate-pulse">
                    Mengevaluasi restriksi klinis dengan AI...
                  </div>
                )}
                {aiTherapyAnalysis && (
                  <div className="mt-2 p-3 bg-indigo-50/50 border border-indigo-150 rounded-2xl text-xs text-indigo-900 leading-relaxed max-h-[150px] overflow-y-auto">
                    <div className="text-[9px] font-black text-indigo-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>📋 Laporan Apoteker Klinis AI:</span>
                      <button 
                        onClick={() => setAiTherapyAnalysis(null)}
                        className="text-indigo-400 hover:text-indigo-600 font-extrabold uppercase text-[8px]"
                      >
                        Tutup
                      </button>
                    </div>
                    <div className="whitespace-pre-line font-medium text-slate-750">
                      {aiTherapyAnalysis}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Catatan Pelayanan (Laporan)
                </label>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-wrap gap-1.5 items-center mb-2">
                  <select
                    className="bg-white border rounded-lg text-[10px] font-bold py-1.5 px-2 outline-none cursor-pointer"
                    onChange={(e) => {
                      if (e.target.value) {
                        applyTagToReport(`<span style="font-family: ${e.target.value}">`, '</span>');
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Font Family</option>
                    <option value="sans-serif">Sans-Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="serif">Serif (Elegant)</option>
                    <option value="system-ui">Modern UI</option>
                  </select>

                  <select
                    className="bg-white border rounded-lg text-[10px] font-bold py-1.5 px-2 outline-none cursor-pointer"
                    onChange={(e) => {
                      if (e.target.value) {
                        applyTagToReport(`<span style="font-size: ${e.target.value}">`, '</span>');
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Font Size</option>
                    <option value="8px">Kecil Sekali (8px)</option>
                    <option value="11px">Kecil (11px)</option>
                    <option value="14px">Sedang (14px)</option>
                    <option value="16px">Besar (16px)</option>
                    <option value="20px">Besar Sekali (20px)</option>
                  </select>

                  <select
                    className="bg-white border rounded-lg text-[10px] font-bold py-1.5 px-2 outline-none cursor-pointer"
                    onChange={(e) => {
                      if (e.target.value) {
                        applyTagToReport(`<span style="color: ${e.target.value}">`, '</span>');
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Font Color</option>
                    <option value="#e11d48">Merah (Darah/Suhu)</option>
                    <option value="#2563eb">Biru (DPJP)</option>
                    <option value="#16a34a">Hijau (Terapi)</option>
                    <option value="#ca8a04">Kuning (Perhatian)</option>
                    <option value="#4b5563">Abu-abu (Stabil)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => applyTagToReport('<b>', '</b>')}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black w-8 h-8 flex items-center justify-center transition-colors shadow-sm"
                    title="Bold"
                  >
                    B
                  </button>

                  <button
                    type="button"
                    onClick={() => applyTagToReport('<i>', '</i>')}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black w-8 h-8 flex items-center justify-center italic transition-colors shadow-sm"
                    title="Italic"
                  >
                    I
                  </button>

                  <button
                    type="button"
                    onClick={() => applyTagToReport('<u>', '</u>')}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black w-8 h-8 flex items-center justify-center underline transition-colors shadow-sm"
                    title="Underline"
                  >
                    U
                  </button>

                  <button
                    type="button"
                    onClick={() => applyTagToReport('<s>', '</s>')}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black w-8 h-8 flex items-center justify-center line-through transition-colors shadow-sm"
                    title="Strikethrough"
                  >
                    S
                  </button>

                  <div className="border-r border-slate-200 h-6 mx-1"></div>

                  <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase">SIMBOL:</span>
                  <div className="flex flex-nowrap gap-1 overflow-x-auto py-0.5 max-w-[280px]">
                    {["✓", "❌", "⚠️", "🩺", "💊", "🩸", "🌡️", "⭐", "➕", "➖", "↑", "↓", "→"].map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => insertSymbolToReport(sym)}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 border hover:border-indigo-200 rounded text-[10px] font-bold active:scale-90 transition-all cursor-pointer"
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>

                <DebouncedTextarea
                  id="catatan-textarea"
                  className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-indigo-500 outline-none flex-1 min-h-[300px] leading-relaxed shadow-inner"
                  placeholder="Masukkan detail implementasi keperawatan..."
                  value={editingEntry.tempReport || ""}
                  onChangeValue={(val) =>
                    setEditingEntry((prev) => (prev ? {
                      ...prev,
                      tempReport: val,
                    } : null))
                  }
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-[11px] font-black uppercase tracking-widest">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {saveError && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700 text-[11px] font-bold uppercase tracking-wider">
              <RefreshCw size={18} className="animate-spin text-amber-600 shrink-0" />
              <div>
                <span className="font-black text-amber-800 block">SINKRONISASI DI LATAR BELAKANG:</span>
                {saveError}
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-4 sticky bottom-0 bg-white py-4 border-t border-slate-50 z-[210]">
            <Button
              id="btn-batal-laporan"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-4 rounded-2xl font-black uppercase tracking-widest bg-slate-100 text-slate-600 border-none hover:bg-slate-200 disabled:opacity-50"
            >
              Batal
            </Button>
            <Button
              id="btn-bersihkan-laporan"
              variant="ghost"
              onClick={() => {
                setEditingEntry({
                  ...editingEntry,
                  tempReport: "",
                  tempTherapy: "",
                  tempDiagnosis: "",
                  tempDependency: undefined,
                  tempRecordedBy: "",
                });
              }}
              disabled={isSaving}
              className="px-6 py-4 rounded-2xl font-black uppercase tracking-widest border-2 border-amber-500/20 text-amber-600 hover:bg-amber-50 disabled:opacity-50"
            >
              Bersihkan
            </Button>
            <Button
              id="btn-simpan-laporan"
              onClick={handleSaveShiftReport}
              disabled={isSaving}
              className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest bg-indigo-600 text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {isSaving ? "Menyimpan & Sinkron..." : "Selesai & Simpan"}
            </Button>
          </div>
        </div>

        <div className="w-full md:w-96 bg-slate-50 flex flex-col max-h-screen">
          <div className="p-8 pb-4 border-b border-slate-200/60 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <History size={18} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter leading-none">Riwayat Laporan</h4>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 inline-block">Klik Salin untuk Menambahkan Laporan</span>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
            {[...dailyReports]
              .filter(r => r.patientId === editingEntry.patientId && isDateBeforeOrSame(r.date, selectedDate))
              .sort((a, b) => compareDatesSafe(a.date, b.date, true))
              .map((r, rIdx) => {
                const shifts = ['night', 'afternoon', 'morning'];
                const availableShifts = shifts.filter(shift => {
                  if (isSameDate(r.date, selectedDate) && editingEntry.type === `${shift}Report`) return false;
                  return (r as any)[`${shift}Report`] || (r as any)[`${shift}Therapy`];
                });

                if (availableShifts.length === 0) return null;

                return (
                  <div key={`hist-block-${r.date}-${rIdx}`} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{isSameDate(r.date, selectedDate) ? "HARI INI" : r.date}</span>
                       <div className="h-px flex-1 bg-slate-200/50"></div>
                    </div>
                    
                    {availableShifts.map(shift => {
                      const content = (r as any)[`${shift}Report`];
                      const therapy = (r as any)[`${shift}Therapy`];
                      const recordedBy = (r as any)[`${shift}RecordedBy`];
                      const dep = (r as any)[`${shift}Dependency`];

                      return (
                        <div key={`hist-${r.date}-${shift}`} className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm relative group hover:border-indigo-400 hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">
                                  {shift === 'morning' ? 'PAGI' : shift === 'afternoon' ? 'SIANG' : 'MALAM'}
                                </span>
                                {dep && (
                                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase border ${
                                    dep === 'TOTAL' ? 'bg-red-50 text-red-600 border-red-100' :
                                    dep === 'PARSIAL' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                    'bg-emerald-50 text-emerald-600 border-emerald-100'
                                  }`}>
                                    {dep}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              <button 
                                onClick={() => {
                                  setEditingEntry({
                                    ...editingEntry,
                                    tempReport: content ? `${editingEntry.tempReport ? editingEntry.tempReport + '\n\n' : ''}${content}` : editingEntry.tempReport,
                                    tempTherapy: therapy ? `${editingEntry.tempTherapy ? editingEntry.tempTherapy + '\n' : ''}${therapy}` : editingEntry.tempTherapy,
                                    tempDiagnosis: r.diagnosis || editingEntry.tempDiagnosis
                                  });
                                }}
                                className="p-2 bg-slate-50 hover:bg-emerald-50 rounded-xl text-slate-400 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-200"
                                title="Salin ke Laporan"
                              >
                                <Copy size={14} />
                              </button>
                              <button 
                                onClick={() => {
                                  const label = shift === 'morning' ? 'PAGI' : shift === 'afternoon' ? 'SIANG' : 'MALAM';
                                  if (window.confirm(`Apakah Anda yakin ingin membatalkan/menghapus isi Laporan Shift ${label} untuk pasien ini?`)) {
                                    onUpdateReport(
                                      r.patientId,
                                      "BATCH",
                                      {
                                        [`${shift}Report`]: "",
                                        [`${shift}Therapy`]: "",
                                        [`${shift}RecordedBy`]: "",
                                        [`${shift}Dependency`]: "",
                                        [`${shift}Time`]: "",
                                      },
                                      r.date,
                                    );
                                  }
                                }}
                                className="p-2 bg-slate-50 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-red-600 transition-all border border-transparent hover:border-rose-200"
                                title="Batal / Delete Laporan Shift"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          
                          {content && (
                            <div className="text-[11px] text-slate-600 font-medium leading-relaxed mb-3 whitespace-pre-wrap select-text selection:bg-indigo-100 selection:text-indigo-900 border-l-2 border-slate-100 pl-3">
                              {content}
                            </div>
                          )}
                          
                          {therapy && (
                             <div className="text-[10px] text-emerald-700 font-bold bg-emerald-50/50 p-2.5 rounded-2xl flex items-start gap-2.5 border border-emerald-100/50">
                               <Pill size={12} className="shrink-0 mt-0.5 text-emerald-500" />
                               <span className="select-text selection:bg-emerald-200">{therapy}</span>
                             </div>
                          )}
                          {recordedBy && (
                            <div className="mt-3 pt-2 border-t border-slate-50 text-[8px] font-black text-slate-300 uppercase text-right tracking-widest italic">Oleh: {recordedBy}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

            {dailyReports.filter(r => r.patientId === editingEntry.patientId).length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-slate-300 text-center animate-pulse">
                <History size={48} className="opacity-10 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Belum Ada Riwayat Laporan</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm border-t-8 border-red-500 shadow-2xl animate-fade-in text-center text-slate-800">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 mb-2">Konfirmasi Reset</h3>
            <p className="text-sm font-bold text-slate-500 leading-relaxed mb-6">
              Apakah Anda yakin ingin mereset laporan? Data yang sudah di-entry pada shift ini akan dihapus permanen.
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                id="btn-batal-confirm-reset"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-ya-confirm-reset"
                onClick={() => {
                  const shiftPrefix = editingEntry.type.replace("Report", "");
                  
                  // Reset local editing states immediately for Optimistic rendering
                  setEditingEntry({
                    ...editingEntry,
                    tempReport: "",
                    tempTherapy: "",
                    tempDiagnosis: "",
                    tempDependency: undefined,
                    tempRecordedBy: "",
                  });
                  
                  // Clear the shift data fields in the global state & server database asynchronously
                  onUpdateReport(
                    editingEntry.patientId,
                    "BATCH",
                    {
                      [`${shiftPrefix}Therapy`]: "",
                      [`${shiftPrefix}Report`]: "",
                      [`${shiftPrefix}RecordedBy`]: "",
                      [`${shiftPrefix}Dependency`]: "",
                    },
                    selectedDate,
                  ).catch((err: any) => {
                    console.warn("Background shift report delete failed:", err);
                  });

                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("surgihub_toast", {
                        detail: {
                          message: "Laporan shift berhasil direset & dihapus dari server.",
                          type: "success",
                        },
                      })
                    );
                  }

                  setShowResetConfirm(false);
                  onClose(); // Automatically redirect/close window returning to Nursing Reports page
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-red-100"
              >
                Ya, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const ServiceMatrix: React.FC<ServiceMatrixProps> = React.memo(({
  patients,
  dailyReports,
  patientLocks,
  masterData,
  onAddPatient,
  onUpdateReport,
  onUpdateDependency,
  onUpdatePatient,
  onAddDoctorVisit,
  onUpdateDoctorVisit,
  onRemoveDoctorVisit,
  appData,
  currentUser,
  onPatientClick,
  syncStatus = "IDLE",
}) => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedUnit, setSelectedUnit] = useState(
    currentUser?.unit === "Ruang Bedah"
      ? "Ruang Bedah"
      : (currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "BIDANG"
        ? "Semua Unit"
        : currentUser?.unit || "Semua Unit"),
  );
  const [selectedPPJA, setSelectedPPJA] = useState("Semua PPJA");
  const [selectedDPJP, setSelectedDPJP] = useState("Semua DPJP");
  const [selectedStatus, setSelectedStatus] = useState("Masih Dirawat");
  const [selectedRoomFilter, setSelectedRoomFilter] = useState("Semua Ruangan");
  const [selectedBedFilter, setSelectedBedFilter] = useState("Semua No Bed");

  // AI Holistic Diagnosis Compilation states
  const [compiledDiagnosisPatientId, setCompiledDiagnosisPatientId] = useState<string | null>(null);
  const [compiledDiagnosisText, setCompiledDiagnosisText] = useState<string | null>(null);
  const [isCompilingDiagnosis, setIsCompilingDiagnosis] = useState(false);

  const handleCompilePatientDiagnosis = async (patientId: string) => {
    setCompiledDiagnosisPatientId(patientId);
    setCompiledDiagnosisText(null);
    setIsCompilingDiagnosis(true);
    try {
      const res = await fetch('/api/compile-patient-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId })
      });
      const d = await res.json();
      if (d.success) {
        setCompiledDiagnosisText(d.compiledDiagnosis);
        onUpdatePatient?.(patientId, {
          diagnosaUtama: d.compiledDiagnosis
        });
      } else {
        setCompiledDiagnosisText(`Gagal melakukan kompilasi AI: ${d.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      setCompiledDiagnosisText(`Gagal menghubungi server AI: ${err.message}`);
    } finally {
      setIsCompilingDiagnosis(false);
    }
  };

  const [statusChangePatient, setStatusChangePatient] = useState<{
    id: string;
    newStatus: string;
    date: string;
    time: string;
    reason?: string;
    destination?: string;
    destinationClass?: string;
    destinationRoom?: string;
    destinationBed?: string;
    isInternalOnly?: boolean;
  } | null>(null);

  // Retrieval / Panggil Data Pasien Lama states
  const [isRetrievalModalOpen, setIsRetrievalModalOpen] = useState(false);
  const [retrievalSearch, setRetrievalSearch] = useState("");
  const [selectedRetrievalPatient, setSelectedRetrievalPatient] = useState<Patient | null>(null);
  const [retrievalDate, setRetrievalDate] = useState(new Date().toISOString().split("T")[0]);
  const [retrievalTime, setRetrievalTime] = useState(new Date().toTimeString().split(" ")[0].substring(0, 5));
  const [retrievalClass, setRetrievalClass] = useState("");
  const [retrievalRoom, setRetrievalRoom] = useState("");
  const [retrievalBed, setRetrievalBed] = useState("");

  // Registrasi Pasien Pernah Dirawat (Penerimaan Pasien Baru) states
  const [isRegisterOldModalOpen, setIsRegisterOldModalOpen] = useState(false);
  const [registerOldRMInput, setRegisterOldRMInput] = useState("");
  const [foundOldPatient, setFoundOldPatient] = useState<Patient | null>(null);
  const [generatedRegNo, setGeneratedRegNo] = useState("");
  const [regOldDate, setRegOldDate] = useState(new Date().toISOString().split("T")[0]);
  const [regOldTime, setRegOldTime] = useState(new Date().toTimeString().split(" ")[0].substring(0, 5));
  const [regOldClass, setRegOldClass] = useState("");
  const [regOldRoom, setRegOldRoom] = useState("");
  const [regOldBed, setRegOldBed] = useState("");
   const [regOldDPJP, setRegOldDPJP] = useState("");
  const [regOldPayment, setRegOldPayment] = useState<string[]>([]);
  const [regOldOrigin, setRegOldOrigin] = useState("IGD");
  const [regOldNoSEP, setRegOldNoSEP] = useState("");
  const [regOldStatusSEP, setRegOldStatusSEP] = useState("Belum Terbit");
  const [isRegOldDpjpDropdownOpen, setIsRegOldDpjpDropdownOpen] = useState(false);
  const [regOldDpjpSearch, setRegOldDpjpSearch] = useState("");
  const [isRegOldOriginDropdownOpen, setIsRegOldOriginDropdownOpen] = useState(false);
  const [regOldOriginSearch, setRegOldOriginSearch] = useState("");

  const regOldDpjpDropdownRef = useRef<HTMLDivElement>(null);
  const regOldOriginDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (regOldDpjpDropdownRef.current && !regOldDpjpDropdownRef.current.contains(event.target as Node)) {
        setIsRegOldDpjpDropdownOpen(false);
      }
      if (regOldOriginDropdownRef.current && !regOldOriginDropdownRef.current.contains(event.target as Node)) {
        setIsRegOldOriginDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const [editingEntry, setEditingEntry] = useState<{
    patientId: string;
    type: keyof DailyReportEntry;
    tempDiagnosis?: string;
    tempTherapy?: string;
    tempReport?: string;
    tempDependency?: DependencyLevel;
    tempRecordedBy?: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setIsSaving(false);
    setSaveError(null);
  }, [editingEntry]);

  const [editingSurgery, setEditingSurgery] = useState<string | null>(null);
  const [doctorSearchTerm, setDoctorSearchTerm] = useState("");
  const [editingAdminNote, setEditingAdminNote] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Overhauled DPJP Management popup states
  const [isDpjpModalOpen, setIsDpjpModalOpen] = useState(false);
  const [dpjpModalPatientId, setDpjpModalPatientId] = useState<string | null>(null);
  const [isDpjpModalDropdownOpen, setIsDpjpModalDropdownOpen] = useState(false);
  const [dpjpModalSearch, setDpjpModalSearch] = useState("");
  const [isRaberanAddOpen, setIsRaberanAddOpen] = useState(false);
  const [raberanSearch, setRaberanSearch] = useState("");
  const [selectedRaberanDocs, setSelectedRaberanDocs] = useState<string[]>([]);
  const [nurseSearch, setNurseSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDate, selectedUnit, selectedPPJA, selectedDPJP, selectedStatus]);
  const [isNurseDropdownOpen, setIsNurseDropdownOpen] = useState(false);
  const [activeNurseSelectId, setActiveNurseSelectId] = useState<string | null>(
    null,
  );
  const [activeDpjpSelectId, setActiveDpjpSelectId] = useState<string | null>(null);
  const [dpjpSearch, setDpjpSearch] = useState("");
  const [historyModalPatientId, setHistoryModalPatientId] = useState<string | null>(null);
  const [showHistoryPatientId, setShowHistoryPatientId] = useState<string | null>(null);
  const [doctorVisitSearch, setDoctorVisitSearch] = useState("");
  const [editingVisite, setEditingVisite] = useState<{
    patientId: string;
    patientName: string;
    noRM: string;
    date: string;
    paymentMethod: string[];
    dpjpList: string[];
  } | null>(null);

  const [aiAnalyzingTherapy, setAiAnalyzingTherapy] = useState(false);
  const [aiTherapyAnalysis, setAiTherapyAnalysis] = useState<string | null>(null);
  const [aiSplittingDiagnosis, setAiSplittingDiagnosis] = useState(false);
  const [aiSplitDiagnosesResult, setAiSplitDiagnosesResult] = useState<string[] | null>(null);

  // Real-time patient lock mechanisms & UI State preservation helpers
  const lastLockedPatientIdRef = React.useRef<string | null>(null);

  const getPatientLockUser = (patientId: string): string | null => {
    if (!patientLocks) return null;
    const lock = patientLocks[patientId];
    if (!lock) return null;
    if (Date.now() - lock.lockedAt > 600000) return null; // 10 minute lock timeout
    if (lock.username === currentUser?.username) return null; // current user owns the lock
    return lock.username;
  };

  const lockPatientOnServer = async (patientId: string) => {
    if (!currentUser?.username) return;
    try {
      await fetch(`/api/patients/${patientId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username })
      });
    } catch (e) {
      console.error("Failed to lock patient:", e);
    }
  };

  const unlockPatientOnServer = async (patientId: string) => {
    if (!currentUser?.username) return;
    try {
      await fetch(`/api/patients/${patientId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username })
      });
    } catch (e) {
      console.error("Failed to unlock patient:", e);
    }
  };

  const activeEditingPatientId = editingEntry 
    ? editingEntry.patientId 
    : (editingSurgery 
        ? editingSurgery 
        : (editingAdminNote ? editingAdminNote : null));

  useEffect(() => {
    const handleLocking = async () => {
      const prevId = lastLockedPatientIdRef.current;
      const nextId = activeEditingPatientId;

      if (prevId === nextId) return;

      if (prevId) {
        await unlockPatientOnServer(prevId);
        lastLockedPatientIdRef.current = null;
      }

      if (nextId) {
        const locker = getPatientLockUser(nextId);
        if (locker) {
          alert(`[REAL-TIME CONCURRENCY LOCK]\n\nPasien ini sedang diedit oleh "${locker}".\n\nUntuk menjaga konsistensi data, Anda dilarang mengedit pasien ini sampai rekan Anda selesai.`);
          setEditingEntry(null);
          setEditingSurgery(null);
          setEditingAdminNote(null);
          return;
        }

        await lockPatientOnServer(nextId);
        lastLockedPatientIdRef.current = nextId;
      }
    };

    handleLocking();
  }, [activeEditingPatientId]);

  useEffect(() => {
    return () => {
      if (lastLockedPatientIdRef.current) {
        unlockPatientOnServer(lastLockedPatientIdRef.current);
      }
    };
  }, []);

  // Detailed age calculation utility based on service Date
  const getDetailedAge = (birthDateStr: string, serviceDateStr: string): string => {
    if (!birthDateStr) return "";
    try {
      let birthDate: Date;
      const cleanBirth = birthDateStr.trim();
      if (cleanBirth.includes("-")) {
        const parts = cleanBirth.split("-");
        if (parts[0].length === 4) {
          birthDate = new Date(cleanBirth);
        } else {
          birthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      } else {
        birthDate = new Date(cleanBirth);
      }

      if (isNaN(birthDate.getTime())) return "";

      const serviceDate = new Date(serviceDateStr);
      if (isNaN(serviceDate.getTime())) return "";

      let years = serviceDate.getFullYear() - birthDate.getFullYear();
      let months = serviceDate.getMonth() - birthDate.getMonth();
      let days = serviceDate.getDate() - birthDate.getDate();

      if (days < 0) {
        months--;
        const prevMonth = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), 0);
        days += prevMonth.getDate();
      }

      if (months < 0) {
        years--;
        months += 12;
      }

      if (years < 0) return " (0 Thn 0 Bln 0 Hari)";

      return ` (${years} Thn ${months} Bln ${days} Hari)`;
    } catch (e) {
      return "";
    }
  };

  // Simplified diagnosis cleaner utility
  const getLatestCleanDiagnosis = (patient: Patient): string => {
    const sortedReports = (dailyReports || [])
      .filter(r => r.patientId === patient.id && r.diagnosis && r.diagnosis.trim() !== "")
      .sort((a, b) => {
        const dateComp = compareDatesSafe(a.date, b.date, true);
        if (dateComp !== 0) return dateComp;
        
        const getTsSafe = (dt: any) => {
          if (!dt) return 0;
          const parsed = new Date(dt).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        const aDiagTime = getTsSafe(a.fieldModifiedTimes?.diagnosis) || getTsSafe(a.lastModified);
        const bDiagTime = getTsSafe(b.fieldModifiedTimes?.diagnosis) || getTsSafe(b.lastModified);
        return bDiagTime - aDiagTime;
      });

    let rawDiagnosis = "";
    if (sortedReports.length > 0) {
      rawDiagnosis = sortedReports[0].diagnosis || "";
    } else {
      rawDiagnosis = patient.diagnosaUtama || "";
    }

    if (!rawDiagnosis) return "Belum diisi";

    let clean = rawDiagnosis;

    // Bersihkan format markdown dan karakter noise
    clean = clean.replace(/[\*\`\#]/g, "");

    // Jika diagnosa merupakan hasil kompilasi terstruktur AI, ekstrak komponen diagnosa utama & sekunder secara rapi
    if (/diagnosa utama|diagnosa sekunder|prosedur tindakan/i.test(clean)) {
      const lines = clean.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      const outputLines: string[] = [];
      let currentSection = "";

      lines.forEach(line => {
        const isMain = /^(1\.)?\s*diagnosa\s+utama/i.test(line);
        const isSec = /^(2\.)?\s*diagnosa\s+sekunder/i.test(line);
        const isProc = /^(3\.)?\s*prosedur\s+tindakan/i.test(line);

        if (isMain) {
          currentSection = "MAIN";
          const val = line.replace(/^(1\.)?\s*diagnosa\s+utama\s*[:\-–—\s]*/i, "").trim();
          if (val) outputLines.push(`Diagnosa Utama: ${val}`);
        } else if (isSec) {
          currentSection = "SEC";
          const val = line.replace(/^(2\.)?\s*diagnosa\s+sekunder\s*(&\s*komplikasi\s*aktif)?\s*[:\-–—\s]*/i, "").trim();
          if (val) outputLines.push(`Diagnosa Sekunder: ${val}`);
        } else if (isProc) {
          currentSection = "PROC"; // Sesuai instruksi: Tampilkan HANYA diagnosa medis, abaikan seksi prosedur tindakan
        } else {
          if (currentSection === "MAIN" && !line.match(/^\d+\./)) {
            outputLines.push(line);
          } else if (currentSection === "SEC" && !line.match(/^\d+\./)) {
            outputLines.push(line);
          }
        }
      });

      if (outputLines.length > 0) {
        return outputLines.join("\n");
      }
    }

    // Pembersihan umum untuk teks bebas non-terstruktur
    clean = clean.replace(/(diagnosa kompilasi|kompilasi diagnosa|diagnosa medis|diagnosa utama|diagnosa terakhir|diagnosa)\s*[:\-–—\n]+/gi, "");
    clean = clean.replace(/[\[\(]\d{4}[-\/]\d{2}[-\/]\d{2}.*?[\]\)]/gi, "");
    clean = clean.replace(/[\[\(]\d{2}[-\/]\d{2}[-\/]\d{4}.*?[\]\)]/gi, "");
    clean = clean.replace(/[\[\(](draf|draft|compiled|ai|kompilasi|generated|otomatis).*?[\]\)]/gi, "");
    clean = clean.replace(/^[\s•\-\*]+/gm, "");

    clean = clean.replace(/^[:\-–—\s\.\,\;]+|[:\-–—\s\.\,\;]+$/g, "").trim();
    return clean || "Belum diisi";
  };

  const handleAiAnalyzeTherapy = async (text: string) => {
    if (!text.trim()) return;
    setAiAnalyzingTherapy(true);
    setAiTherapyAnalysis(null);
    try {
      const res = await fetch("/api/analyze-therapy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapyText: text })
      });
      const data = await res.json();
      if (data.success) {
        setAiTherapyAnalysis(data.analysis);
      } else {
        setAiTherapyAnalysis(data.warning || "Gagal menganalisis terapi.");
      }
    } catch (err: any) {
      setAiTherapyAnalysis("Koneksi gagal: " + err.message);
    } finally {
      setAiAnalyzingTherapy(false);
    }
  };

  const handleAiSplitDiagnosis = async (text: string) => {
    if (!text.trim()) return;
    setAiSplittingDiagnosis(true);
    setAiSplitDiagnosesResult(null);
    try {
      const res = await fetch("/api/split-diagnoses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosisText: text })
      });
      const data = await res.json();
      if (data.success) {
        setAiSplitDiagnosesResult(data.results || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiSplittingDiagnosis(false);
    }
  };

  const topScrollRef = React.useRef<HTMLDivElement>(null);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1400);

  useEffect(() => {
    if (tableRef.current) {
      setTableScrollWidth(tableRef.current.scrollWidth);
    }
  }, [patients, selectedDate, selectedUnit, selectedPPJA, selectedDPJP, selectedStatus]);

  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableContainer = tableContainerRef.current;

    if (!topScroll || !tableContainer) return;

    let isSyncingTop = false;
    let isSyncingContainer = false;

    const handleTopScroll = () => {
      if (isSyncingContainer) {
        isSyncingContainer = false;
        return;
      }
      isSyncingTop = true;
      tableContainer.scrollLeft = topScroll.scrollLeft;
    };

    const handleContainerScroll = () => {
      if (isSyncingTop) {
        isSyncingTop = false;
        return;
      }
      isSyncingContainer = true;
      topScroll.scrollLeft = tableContainer.scrollLeft;
    };

    topScroll.addEventListener("scroll", handleTopScroll);
    tableContainer.addEventListener("scroll", handleContainerScroll);

    return () => {
      topScroll.removeEventListener("scroll", handleTopScroll);
      tableContainer.removeEventListener("scroll", handleContainerScroll);
    };
  }, [patients, selectedDate, selectedUnit, selectedPPJA, selectedDPJP, selectedStatus]);

  const sortedNurses = React.useMemo(() => {
    let list = [...masterData.nurses];
    if (currentUser?.name) {
      list = [currentUser.name, ...list.filter((n) => n !== currentUser.name)];
    }
    return list;
  }, [masterData.nurses, currentUser]);

  const filteredNurses = React.useMemo(() => {
    if (!nurseSearch) return sortedNurses;
    return sortedNurses.filter((n) =>
      n.toLowerCase().includes(nurseSearch.toLowerCase()),
    );
  }, [sortedNurses, nurseSearch]);

  const primaryNurses = React.useMemo(() => {
    const list = (masterData.users || [])
      .filter((u: any) => {
        const role = String(u.role || '').toLowerCase();
        const pos = String(u.position || '').toLowerCase();
        return role === 'ppja' || pos.includes('ppja') || pos.includes('primer');
      })
      .map((u: any) => u.name);
    const unique = Array.from(new Set(list));
    const isUserPPJA = currentUser?.role === 'PPJA' || 
                       String(currentUser?.position || '').toLowerCase().includes('ppja') || 
                       String(currentUser?.position || '').toLowerCase().includes('primer');
    if (currentUser?.name && isUserPPJA) {
      return [currentUser.name, ...unique.filter((n) => n !== currentUser.name)];
    }
    return unique;
  }, [masterData.users, currentUser]);

  const allNursesList = React.useMemo(() => {
    const list = (masterData.users || [])
      .filter((u: any) => {
        if (!u || !u.name) return false;
        const role = String(u.role || '').toLowerCase();
        const pos = String(u.position || '').toLowerCase();
        
        // Exclude clinical role of doctors/DPJP
        const isDoctor = role.includes('dokter') || role.includes('dpjp') || pos.includes('dokter') || pos.includes('dpjp');
        if (isDoctor) return false;
        
        // Include Perawat (Nurse), Bidan (Midwife), Admin, Super Admin, PPJA, PIC, KARU, SEKRU, STAFF
        const isTargetRole = 
          role.includes('perawat') || 
          role.includes('bidan') || 
          role.includes('admin') || 
          role.includes('staff') || 
          role.includes('ppja') || 
          role.includes('pic') || 
          role.includes('sekru') || 
          role.includes('karu') || 
          role.includes('bidang') ||
          pos.includes('perawat') || 
          pos.includes('bidan') || 
          pos.includes('admin') || 
          pos.includes('nurse') || 
          pos.includes('midwife');
          
        return isTargetRole || !role; // Default to true if no role to prevent filtering out existing users
      })
      .map((u: any) => String(u.name || '').trim())
      .filter(Boolean);

    const unique = Array.from(new Set([...list, ...(masterData.nurses || [])])).filter(Boolean);
    if (currentUser?.name) {
      return [currentUser.name, ...unique.filter((n) => n !== currentUser.name)];
    }
    return unique;
  }, [masterData.users, masterData.nurses, currentUser]);

  const filteredPrimaryNurses = React.useMemo(() => {
    if (!nurseSearch) return primaryNurses;
    return primaryNurses.filter((n) =>
      n.toLowerCase().includes(nurseSearch.toLowerCase()),
    );
  }, [primaryNurses, nurseSearch]);

  const applyTagToReport = (tagStart: string, tagEnd: string) => {
    const textarea = document.getElementById("catatan-textarea") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editingEntry?.tempReport || "";
    const selectedText = text.substring(start, end);
    const replacement = tagStart + selectedText + tagEnd;
    const newReport = text.substring(0, start) + replacement + text.substring(end);
    setEditingEntry({
      ...editingEntry,
      tempReport: newReport
    });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagStart.length, start + tagStart.length + selectedText.length);
    }, 50);
  };

  const insertSymbolToReport = (sym: string) => {
    const textarea = document.getElementById("catatan-textarea") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editingEntry?.tempReport || "";
    const newReport = text.substring(0, start) + sym + text.substring(end);
    setEditingEntry({
      ...editingEntry,
      tempReport: newReport
    });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + sym.length, start + sym.length);
    }, 50);
  };

  const uniqueRooms = React.useMemo(() => {
    const list = patients.map(p => p.ruangan).filter(Boolean);
    const unique = Array.from(new Set(list));
    return unique.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [patients]);

  const uniqueBeds = React.useMemo(() => {
    const list = patients.map(p => p.nomorBed).filter(Boolean);
    const unique = Array.from(new Set(list));
    return unique.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [patients]);

  const filteredPatients = React.useMemo(() => {
    const list = patients.filter((p) => {
      // 1. Search term check
      if (
        searchTerm &&
        !p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !p.noRM.includes(searchTerm)
      ) {
        return false;
      }

      // 2. Dynamic Clinical Census status calculations (T_Masuk, T_Keluar, T_Filter)
      const tFilter = selectedDate;
      const tMasuk = parseToStandardDateString(p.entryDate) || '';
      const tKeluar = parseToStandardDateString(p.dischargeDate) || '';

      if (!tMasuk) return false;

      // Strict filter: Exclude "Batal Rawat Inap" or "Batal" patients from active clinical census matrix, UNLESS selectedStatus filter is explicitly set to "Batal Rawat Inap"!
      const isBatal = (p.statusDataPasien || '').toUpperCase().includes('BATAL');
      if (isBatal && selectedStatus !== 'Batal Rawat Inap') return false;

      // Mathematical validation: T_Masuk must be <= T_Filter
      if (tMasuk > tFilter) return false;

      // Clinical Census Mathematical Cases:
      const isCase1 = tMasuk === tFilter && (p.status === 'ADMITTED' || !p.dischargeDate || p.statusDataPasien === 'Masih Dirawat');
      const isCase2 = tMasuk < tFilter && (!tKeluar || tKeluar > tFilter);
      const isCase3 = tKeluar === tFilter && ['BPL', 'APS', 'Meninggal', 'Dirujuk', 'Rujuk', 'BPL (Boleh Pulang)', 'APS (Pulang Paksa)'].some(st => (p.statusDataPasien || '').toUpperCase().trim().includes(st.toUpperCase()));
      const isCase4 = tMasuk === tFilter && !!p.transferHistory && p.transferHistory.length > 0;
      const isCase5 = tKeluar === tFilter && ['Pindah', 'Dipindah', 'Transfer', 'Pindah Ruangan', 'Dipindah ke Ruangan Lain'].some(st => (p.statusDataPasien || '').toUpperCase().trim().includes(st.toUpperCase()));

      // If patient does not satisfy any of these active clinical census bounds on T_Filter, hide them visually!
      const isEligible = isCase1 || isCase2 || isCase3 || isCase4 || isCase5 || (isBatal && selectedStatus === 'Batal Rawat Inap');
      if (!isEligible) return false;

      // Dynamic calculation of patient status on selectedDate (T_Filter)
      let calculatedStatus = "Masih Dirawat";
      if (p.statusDataPasien && String(p.statusDataPasien).toUpperCase().includes("BATAL")) {
        calculatedStatus = p.statusDataPasien;
      } else if (isCase3 || isCase5) {
        calculatedStatus = p.statusDataPasien || "BPL";
      } else {
        calculatedStatus = "Masih Dirawat";
      }

      // Group matching helper for robust status comparison
      const matchesStatusGroup = (curStatus: string, filterStatus: string) => {
        if (filterStatus === "Semua Status") return true;
        
        const groupOf = (status: string) => {
          const s = (status || '').toLowerCase();
          if (s.includes('batal')) return 'Batal Rawat Inap';
          if (s.includes('masih dirawat') || s.includes('aktif') || !s) return 'Masih Dirawat';
          if (s.includes('bpl') || s.includes('boleh pulang')) return 'BPL';
          if (s.includes('aps') || s.includes('pulang paksa')) return 'APS';
          if (s.includes('dirujuk') || s.includes('rujuk')) return 'Dirujuk';
          if (s.includes('meninggal')) return 'Meninggal';
          if (s.includes('pindah') || s.includes('dipindah')) return 'Dipindah ke Ruangan Lain';
          return status;
        };

        return groupOf(curStatus) === groupOf(filterStatus);
      };

      // 3. Status selection filter
      if (selectedStatus !== "Semua Status" && !matchesStatusGroup(calculatedStatus, selectedStatus)) {
        return false;
      }

      const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
      
      const isTransferredToday = (calculatedStatus.toLowerCase().includes("pindah") || calculatedStatus.toLowerCase().includes("dipindah")) && tKeluar === tFilter;
      const activeUnit = isTransferredToday ? (p.transferUnit || p.unitTujuan) : p.unitTujuan;
      const activeRoom = isTransferredToday ? (p.transferRoom || p.ruangan) : p.ruangan;
      const activeBed = isTransferredToday ? (p.transferBed || p.nomorBed) : p.nomorBed;

      // 4. Unit selection filter
      if (selectedUnit !== "Semua Unit" && normalize(activeUnit) !== normalize(selectedUnit) && normalize(activeRoom) !== normalize(selectedUnit))
        return false;

      // 5. PPJA selection filter
      if (selectedPPJA !== "Semua PPJA" && p.perawatPrimer !== selectedPPJA)
        return false;

      // 6. DPJP selection filter
      if (
        selectedDPJP !== "Semua DPJP" &&
        !(p.dpjpList || []).includes(selectedDPJP)
      )
        return false;

      // 7. Room selection filter
      if (selectedRoomFilter !== "Semua Ruangan" && normalize(activeRoom) !== normalize(selectedRoomFilter)) {
        return false;
      }

      // 8. Bed selection filter
      if (selectedBedFilter !== "Semua No Bed" && activeBed !== selectedBedFilter) {
        return false;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      const roomA = String(a.ruangan || '').trim();
      const roomB = String(b.ruangan || '').trim();
      const roomCompare = roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
      if (roomCompare !== 0) return roomCompare;

      const bedA = String(a.nomorBed || '').trim();
      const bedB = String(b.nomorBed || '').trim();
      return bedA.localeCompare(bedB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [patients, searchTerm, selectedUnit, selectedPPJA, selectedDPJP, selectedStatus, selectedDate, selectedRoomFilter, selectedBedFilter]);

  const paginatedPatients = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPatients.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPatients, currentPage, itemsPerPage]);

  const doubleBookedMap = React.useMemo(() => {
    const counts: Record<string, string[]> = {};
    const activeDirawatPatients = patients.filter((p) => {
      const pStatus = (p.statusDataPasien || 'Masih Dirawat').toUpperCase();
      const isDischargedOrInactive = 
        ['BPL', 'APS', 'MENINGGAL', 'RUJUK', 'DIRUJUK', 'PINDAH RUANGAN', 'DIPINDAH KE RUANGAN LAIN', 'BATAL RAWAT INAP', 'BATAL'].some(s => pStatus.includes(s)) ||
        p.status === 'DISCHARGED';
      return !isDischargedOrInactive;
    });

    activeDirawatPatients.forEach(p => {
      const displayRoom = p.ruangan;
      const displayBed = p.nomorBed;
      
      if (displayRoom && displayBed) {
        const key = `${String(displayRoom).trim().toUpperCase()}_${String(displayBed).trim().toUpperCase()}`;
        if (!counts[key]) {
          counts[key] = [];
        }
        counts[key].push(p.id);
      }
    });
    return counts;
  }, [patients]);

  const retrievalCandidates = React.useMemo(() => {
    // Current unit we are browsing
    const activeUnit = selectedUnit === "Semua Unit" ? (currentUser?.unit || "") : selectedUnit;
    if (!activeUnit) return [];

    // Group patients by RM
    const patientsByRM: Record<string, Patient[]> = {};
    patients.forEach(p => {
      if (p.noRM) {
        const key = p.noRM.trim().toUpperCase();
        if (!patientsByRM[key]) patientsByRM[key] = [];
        patientsByRM[key].push(p);
      }
    });

    const candidates: Patient[] = [];

    Object.entries(patientsByRM).forEach(([rm, list]) => {
      // Sort descending by date & time (latest first) using robust string comparison
      const sorted = [...list].sort((a, b) => {
        const dateA = parseToStandardDateString(a.entryDate) || "1970-01-01";
        const dateB = parseToStandardDateString(b.entryDate) || "1970-01-01";
        const timeA = a.entryTime || "00:00";
        const timeB = b.entryTime || "00:00";
        const strA = `${dateA}T${timeA}`;
        const strB = `${dateB}T${timeB}`;
        return strB.localeCompare(strA);
      });

      const latestOverall = sorted[0];
      const overallStatus = (latestOverall.statusDataPasien || "").toUpperCase().trim();

      // Check if patient has any final discharge status (strictly forbidden)
      const isLatestDischargedOrExcluded = 
        ['BPL', 'APS', 'MENINGGAL', 'RUJUK', 'DIRUJUK', 'BATAL RAWAT INAP', 'BATAL', 'BATAL DI RAWAT'].some(s => overallStatus.includes(s)) ||
        latestOverall.status === 'DISCHARGED';

      // Check if patient is currently active in the RS (at any other unit)
      const isLatestActive = !isLatestDischargedOrExcluded && latestOverall.status === 'ADMITTED' && ["MASIH DIRAWAT", "AKTIF", ""].includes(overallStatus);
      const isInOtherUnit = latestOverall.unitTujuan?.toLowerCase() !== activeUnit.toLowerCase();

      if (!isLatestActive || !isInOtherUnit) {
        return; // Only active patients in other units can be pulled back
      }

      // Find their latest record in our activeUnit
      const unitRecords = sorted.filter(r => (r.unitTujuan || "").toLowerCase() === activeUnit.toLowerCase());
      if (unitRecords.length === 0) return; // Never treated in this unit

      const latestUnitRecord = unitRecords[0];
      const unitStatus = (latestUnitRecord.statusDataPasien || "").toUpperCase().trim();
      const isUnitLastMutation = ["PINDAH RUANGAN", "DIPINDAH KE RUANGAN LAIN", "PINDAH", "DIPINDAH", "TRANSFER"].some(s => unitStatus.includes(s));

      if (isUnitLastMutation) {
        candidates.push(latestOverall); // Use the latest overall record as candidate info
      }
    });

    // Filter by search terms (noRM or Name)
    let filtered = candidates;
    if (retrievalSearch.trim()) {
      const q = retrievalSearch.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.noRM.toLowerCase().includes(q));
    }
    return filtered;
  }, [patients, selectedUnit, currentUser, retrievalSearch]);

  const handleConfirmRetrieval = () => {
    if (!selectedRetrievalPatient) return;
    const activeUnit = selectedUnit === "Semua Unit" ? (currentUser?.unit || "") : selectedUnit;
    if (!activeUnit) return;

    if (!retrievalClass || !retrievalRoom || !retrievalBed) {
      alert("Harap lengkapi pilihan Kelas, Ruangan, dan Bed!");
      return;
    }

    // Check if the bed is occupied by an active patient
    const bedKey = `${String(retrievalRoom).trim().toUpperCase()}_${String(retrievalBed).trim().toUpperCase()}`;
    const occupantIds = doubleBookedMap[bedKey] || [];
    if (occupantIds.length > 0) {
      alert("⚠️ Bed ini sudah ditempati oleh pasien aktif lainnya! Harap pilih bed lain.");
      return;
    }

    // First: if this patient is currently active in another unit, discharge them from there!
    const activeRecordInOtherUnit = patients.find(p => 
      p.noRM === selectedRetrievalPatient.noRM && 
      p.unitTujuan?.toLowerCase() !== activeUnit.toLowerCase() && 
      !['BPL', 'APS', 'MENINGGAL', 'RUJUK', 'DIRUJUK', 'PINDAH RUANGAN', 'DIPINDAH KE RUANGAN LAIN', 'BATAL RAWAT INAP', 'BATAL'].some(s => (p.statusDataPasien || '').toUpperCase().includes(s)) &&
      p.status !== 'DISCHARGED'
    );

    const dischargeId = activeRecordInOtherUnit ? activeRecordInOtherUnit.id : "";

    const previousRecordInActiveUnit = patients.find(p => 
      p.noRM === selectedRetrievalPatient.noRM && 
      p.unitTujuan?.toLowerCase() === activeUnit.toLowerCase()
    );

    if (previousRecordInActiveUnit) {
      // 1. Build the chronological timeline
      const existingLogs = [...(previousRecordInActiveUnit.mutationSubLog || [])];
      
      if (existingLogs.length === 0) {
        existingLogs.push({
          date: `${previousRecordInActiveUnit.entryDate} ${previousRecordInActiveUnit.entryTime || "00:00"}`,
          log: `Periode Pertama di ${previousRecordInActiveUnit.unitTujuan} (${previousRecordInActiveUnit.ruangan}): Masuk ${previousRecordInActiveUnit.entryDate} ${previousRecordInActiveUnit.entryTime || ""} s/d Pindah Ruangan ${previousRecordInActiveUnit.dischargeDate || ""} ${previousRecordInActiveUnit.dischargeTime || ""}`
        });
      }

      if (activeRecordInOtherUnit) {
        existingLogs.push({
          date: `${activeRecordInOtherUnit.entryDate} ${activeRecordInOtherUnit.entryTime || "00:00"}`,
          log: `Periode Kedua di ${activeRecordInOtherUnit.unitTujuan} (${activeRecordInOtherUnit.ruangan}): Masuk ${activeRecordInOtherUnit.entryDate} ${activeRecordInOtherUnit.entryTime || ""} s/d Pindah Ruangan ${retrievalDate} ${retrievalTime}`
        });
      }

      existingLogs.push({
        date: `${retrievalDate} ${retrievalTime}`,
        log: `Masuk Kembali ke ${activeUnit} (${retrievalRoom} - Bed ${retrievalBed}): Masuk Kembali ${retrievalDate} ${retrievalTime}`
      });

      const nextTransferHistory = [
        ...(previousRecordInActiveUnit.transferHistory || []),
        {
          date: `${retrievalDate} ${retrievalTime}`,
          fromUnit: activeRecordInOtherUnit ? `${activeRecordInOtherUnit.unitTujuan} (${activeRecordInOtherUnit.ruangan})` : "Ditarik Kembali",
          toUnit: `${activeUnit} (${retrievalRoom})`
        }
      ];

      // 2. Perform updates
      if (dischargeId) {
        onUpdatePatient?.(dischargeId, {
          statusDataPasien: "Dipindah ke Ruangan Lain",
          status: "DISCHARGED",
          dischargeDate: retrievalDate,
          dischargeTime: retrievalTime,
          _batchUpdates: [
            {
              id: previousRecordInActiveUnit.id,
              updates: {
                statusDataPasien: "Masih Dirawat",
                status: "ADMITTED",
                dischargeDate: "",
                dischargeTime: "",
                kelasRawat: retrievalClass,
                ruangan: retrievalRoom,
                nomorBed: retrievalBed,
                entryDate: retrievalDate,
                entryTime: retrievalTime,
                transferHistory: nextTransferHistory,
                mutationSubLog: existingLogs
              }
            }
          ] as any
        });
      } else {
        onUpdatePatient?.(previousRecordInActiveUnit.id, {
          statusDataPasien: "Masih Dirawat",
          status: "ADMITTED",
          dischargeDate: "",
          dischargeTime: "",
          kelasRawat: retrievalClass,
          ruangan: retrievalRoom,
          nomorBed: retrievalBed,
          entryDate: retrievalDate,
          entryTime: retrievalTime,
          transferHistory: nextTransferHistory,
          mutationSubLog: existingLogs
        });
      }
    } else {
      // Create the new active record
      const newId = generatePermanentUUID('P');
      const autoRecord: Patient = {
        ...selectedRetrievalPatient,
        id: newId,
        noRegister: selectedRetrievalPatient.noRegister, // DILARANG MEMBUAT No Register Baru!
        entryDate: retrievalDate,
        entryTime: retrievalTime,
        dischargeDate: "",
        dischargeTime: "",
        unitTujuan: activeUnit,
        kelasRawat: retrievalClass,
        ruangan: retrievalRoom,
        nomorBed: retrievalBed,
        statusDataPasien: "Masih Dirawat",
        status: "ADMITTED",
        transferHistory: [
          ...(selectedRetrievalPatient.transferHistory || []),
          {
            date: `${retrievalDate} ${retrievalTime}`,
            fromUnit: activeRecordInOtherUnit ? `${activeRecordInOtherUnit.unitTujuan} (${activeRecordInOtherUnit.ruangan})` : "Ditarik dari Master Pasien",
            toUnit: `${activeUnit} (${retrievalRoom})`
          }
        ]
      };

      if (dischargeId) {
        // Discharged from the old unit first, which carries the autoRegisterNewRecord
        onUpdatePatient?.(dischargeId, {
          statusDataPasien: "Dipindah ke Ruangan Lain",
          status: "DISCHARGED",
          dischargeDate: retrievalDate,
          dischargeTime: retrievalTime,
          _autoRegisterNewRecord: autoRecord as any
        });
      } else {
        // Direct pull
        onUpdatePatient?.("NEW_RETRIEVAL", {
          _autoRegisterNewRecord: autoRecord as any
        });
      }
    }

    // Close modal
    setIsRetrievalModalOpen(false);
    setSelectedRetrievalPatient(null);
    setRetrievalSearch("");
  };

  const handleUpdatePrimaryDpjp = (newDoc: string) => {
    if (!dpjpModalPatientId) return;
    const pat = patients.find(p => p.id === dpjpModalPatientId);
    if (!pat) return;

    const oldDoc = pat.dpjpList?.[0] || "Belum Ditentukan";
    if (oldDoc === newDoc) return;

    const currentList = [...(pat.dpjpList || [])];
    // Remove newDoc if it exists elsewhere in the list to avoid duplicates
    const cleanedList = currentList.filter(d => d !== newDoc);
    
    // Set as first element
    const updatedList = [newDoc, ...cleanedList.slice(oldDoc === "Belum Ditentukan" ? 0 : 1)];
    if (oldDoc !== "Belum Ditentukan" && oldDoc !== newDoc) {
      updatedList[0] = newDoc;
      // Keep old primary as a co-dpjp
      if (!cleanedList.includes(oldDoc)) {
        updatedList.push(oldDoc);
      }
    }

    const logMsg = `Mengubah DPJP Utama dari ${oldDoc} menjadi ${newDoc}`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0] + " " + now.toTimeString().split(' ')[0].substring(0, 5);
    const newHistory = [
      ...(pat.dpjpHistory || []),
      { date: dateStr, type: "CHANGE_PRIMARY", log: logMsg, user: currentUser?.name || "Perawat" }
    ];

    onUpdatePatient?.(pat.id, {
      dpjpList: updatedList,
      dpjpHistory: newHistory
    });
  };

  const handleAddMultipleCoDpjp = (newDocs: string[]) => {
    if (!dpjpModalPatientId || newDocs.length === 0) return;
    const pat = patients.find(p => p.id === dpjpModalPatientId);
    if (!pat) return;

    const currentList = [...(pat.dpjpList || [])];
    const docsToAdd = newDocs.filter(d => !currentList.includes(d));

    if (docsToAdd.length === 0) {
      alert("Semua dokter yang dipilih sudah terdaftar di tim DPJP pasien!");
      return;
    }

    const updatedList = [...currentList, ...docsToAdd];
    const logMsg = `Menambahkan Co-DPJP (Raberan) Bersama: ${docsToAdd.join(", ")}`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0] + " " + now.toTimeString().split(' ')[0].substring(0, 5);
    const newHistory = [
      ...(pat.dpjpHistory || []),
      { date: dateStr, type: "ADD", log: logMsg, user: currentUser?.name || "Perawat" }
    ];

    onUpdatePatient?.(pat.id, {
      dpjpList: updatedList,
      dpjpHistory: newHistory
    });
  };

  const handleAddCoDpjp = (newDoc: string) => {
    if (!dpjpModalPatientId) return;
    const pat = patients.find(p => p.id === dpjpModalPatientId);
    if (!pat) return;

    const currentList = [...(pat.dpjpList || [])];
    if (currentList.includes(newDoc)) {
      alert("Dokter ini sudah terdaftar di tim DPJP pasien!");
      return;
    }

    const updatedList = [...currentList, newDoc];
    const logMsg = `Menambahkan Co-DPJP (Raberan): ${newDoc}`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0] + " " + now.toTimeString().split(' ')[0].substring(0, 5);
    const newHistory = [
      ...(pat.dpjpHistory || []),
      { date: dateStr, type: "ADD", log: logMsg, user: currentUser?.name || "Perawat" }
    ];

    onUpdatePatient?.(pat.id, {
      dpjpList: updatedList,
      dpjpHistory: newHistory
    });
  };

  const handleRemoveDpjpIdx = (idx: number) => {
    if (!dpjpModalPatientId) return;
    const pat = patients.find(p => p.id === dpjpModalPatientId);
    if (!pat) return;

    const currentList = [...(pat.dpjpList || [])];
    const removedDoc = currentList[idx];
    if (!removedDoc) return;

    const updatedList = currentList.filter((_, i) => i !== idx);
    const logMsg = `Menghapus DPJP: ${removedDoc}`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0] + " " + now.toTimeString().split(' ')[0].substring(0, 5);
    const newHistory = [
      ...(pat.dpjpHistory || []),
      { date: dateStr, type: "REMOVE", log: logMsg, user: currentUser?.name || "Perawat" }
    ];

    onUpdatePatient?.(pat.id, {
      dpjpList: updatedList,
      dpjpHistory: newHistory
    });
  };

  const handleSwapToPrimary = (idx: number) => {
    if (!dpjpModalPatientId) return;
    const pat = patients.find(p => p.id === dpjpModalPatientId);
    if (!pat) return;

    const currentList = [...(pat.dpjpList || [])];
    const targetDoc = currentList[idx];
    const oldPrimary = currentList[0];
    if (!targetDoc || !oldPrimary) return;

    // Swap index 0 and index idx
    currentList[0] = targetDoc;
    currentList[idx] = oldPrimary;

    const logMsg = `Menjadikan ${targetDoc} sebagai DPJP Utama (sebelumnya ${oldPrimary})`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0] + " " + now.toTimeString().split(' ')[0].substring(0, 5);
    const newHistory = [
      ...(pat.dpjpHistory || []),
      { date: dateStr, type: "SWAP", log: logMsg, user: currentUser?.name || "Perawat" }
    ];

    onUpdatePatient?.(pat.id, {
      dpjpList: currentList,
      dpjpHistory: newHistory
    });
  };

  const handleSearchOldPatient = () => {
    if (!registerOldRMInput.trim()) {
      alert("Masukkan No. RM terlebih dahulu!");
      return;
    }
    const targetRM = registerOldRMInput.trim().toUpperCase();
    const matches = patients.filter(p => p.noRM?.trim().toUpperCase() === targetRM);
    if (matches.length === 0) {
      alert(`⚠️ Pasien dengan Nomor RM "${targetRM}" tidak ditemukan di database!`);
      setFoundOldPatient(null);
      return;
    }

    // Sort matching records by entryDate/entryTime descending to grab the most recent one as template
    const sorted = [...matches].sort((a, b) => {
      const dateA = parseToStandardDateString(a.entryDate) || "1970-01-01";
      const dateB = parseToStandardDateString(b.entryDate) || "1970-01-01";
      const timeA = a.entryTime || "00:00";
      const timeB = b.entryTime || "00:00";
      const strA = `${dateA}T${timeA}`;
      const strB = `${dateB}T${timeB}`;
      return strB.localeCompare(strA);
    });

    const template = sorted[0];

    // Check if the patient is currently active (Masih Dirawat / AKTIF / ADMITTED) across all units
    const isCurrentlyActive = sorted.some(p => {
      const status = (p.statusDataPasien || "").toUpperCase().trim();
      return (status === "MASIH DIRAWAT" || status === "AKTIF" || !status) && p.status === 'ADMITTED';
    });

    if (isCurrentlyActive) {
      alert(`⚠️ Pasien dengan No. RM "${targetRM}" saat ini masih aktif dirawat di salah satu unit! Harap lakukan mutasi resmi atau pulangkan pasien terlebih dahulu sebelum melakukan pendaftaran admisi baru.`);
      setFoundOldPatient(null);
      return;
    }

    setFoundOldPatient(template);
    
    // Generate new No Register Baru!
    const newRegNo = `REG-${Math.floor(100000 + Math.random() * 900000)}`;
    setGeneratedRegNo(newRegNo);

    // Auto-prefill class/room/bed from template if browsed unit matches, but let user select
    const activeUnit = selectedUnit === "Semua Unit" ? (currentUser?.unit || "") : selectedUnit;
    const classes = masterData.unitToClasses[activeUnit] || [];
    const autoClass = classes.length === 1 ? classes[0] : "";
    let autoRoom = "";
    if (autoClass) {
      const rooms = masterData.classToRooms[`${activeUnit} - ${autoClass}`] || [];
      autoRoom = rooms.length === 1 ? rooms[0] : "";
    }
    setRegOldClass(autoClass);
    setRegOldRoom(autoRoom);
    setRegOldBed("");
    setRegOldDPJP(template.dpjpList?.[0] || "");
    
    let defaultPay: string[] = [];
    if (Array.isArray(template.paymentMethod)) {
      defaultPay = template.paymentMethod;
    } else if (typeof template.paymentMethod === 'string' && template.paymentMethod) {
      defaultPay = (template.paymentMethod as string).split(',').map((s: string) => s.trim());
    }
    setRegOldPayment(defaultPay);
    setRegOldOrigin(template.origin || "IGD");
  };

  const handleConfirmRegisterOld = () => {
    if (!foundOldPatient) return;
    const activeUnit = selectedUnit === "Semua Unit" ? (currentUser?.unit || "") : selectedUnit;
    if (!activeUnit) return;

    if (!regOldClass || !regOldRoom || !regOldBed) {
      alert("Harap lengkapi pilihan Kelas, Ruangan, dan Bed!");
      return;
    }

    if (!regOldDPJP) {
      alert("Harap pilih DPJP Utama!");
      return;
    }

    if (regOldPayment.length === 0) {
      alert("Harap pilih minimal satu Cara Bayar!");
      return;
    }

    // Check if bed is occupied
    const bedKey = `${String(regOldRoom).trim().toUpperCase()}_${String(regOldBed).trim().toUpperCase()}`;
    const occupantIds = doubleBookedMap[bedKey] || [];
    if (occupantIds.length > 0) {
      alert("⚠️ Bed ini sudah ditempati oleh pasien aktif lainnya! Harap pilih bed lain.");
      return;
    }

    // Create the brand new admission record (No Register Baru, separate from history!)
    const newId = `P-${Date.now()}`;
    const newAdmissionRecord: Patient = {
      ...foundOldPatient, // Preserve permanent identity: Name, Gender, BirthDate, Address, AllergyHistory, etc.
      id: newId,
      noRegister: generatedRegNo, // Baris No Register Baru!
      origin: regOldOrigin,
      entryDate: regOldDate,
      entryTime: regOldTime,
      dischargeDate: "",
      dischargeTime: "",
      unitTujuan: activeUnit,
      kelasRawat: regOldClass,
      ruangan: regOldRoom,
      nomorBed: regOldBed,
      statusDataPasien: "Masih Dirawat",
      status: "ADMITTED",
      dpjpList: [regOldDPJP],
      paymentMethod: regOldPayment,
      transferHistory: [
        {
          date: `${regOldDate} ${regOldTime}`,
          fromUnit: "Admisi Baru (Riwayat Lama)",
          toUnit: `${activeUnit} (${regOldRoom})`
        }
      ],
      // Clear transactional medical history for this brand new stay period
      diagnosaUtama: "",
      diagnosaSekunder: "",
      tindakanProsedur: "",
      noSEP: regOldPayment.includes("BPJS") ? regOldNoSEP : "",
      statusSEP: regOldPayment.includes("BPJS") ? regOldStatusSEP : "Belum Terbit",
      jenisKLL: "Bukan KLL",
      noLP: "",
      perawatPrimer: "",
      catatanKhusus: "",
      adminResp: currentUser?.name || ""
    };

    // Save as a brand new independent record
    onUpdatePatient?.("NEW_RETRIEVAL", {
      _autoRegisterNewRecord: newAdmissionRecord as any
    });

    // Close modal & reset states
    setIsRegisterOldModalOpen(false);
    setRegisterOldRMInput("");
    setFoundOldPatient(null);
    setRegOldClass("");
    setRegOldRoom("");
    setRegOldBed("");
    setRegOldDPJP("");
    setRegOldPayment([]);
    setRegOldNoSEP("");
    setRegOldStatusSEP("Belum Terbit");
    setIsRegOldDpjpDropdownOpen(false);
    setRegOldDpjpSearch("");
  };

  // Optimized indexed lookup of dailyReports per patient to speed up rendering from O(N_patients * N_reports log N_reports) to O(N_patients + N_reports)
  const reportsLookup = useMemo(() => {
    const lookupMap: { [patientId: string]: DailyReportEntry } = {};

    // Group daily reports by patientId
    const reportsByPatient: { [patientId: string]: DailyReportEntry[] } = {};
    for (let i = 0; i < dailyReports.length; i++) {
      const r = dailyReports[i];
      if (!r) continue;
      if (!reportsByPatient[r.patientId]) {
        reportsByPatient[r.patientId] = [];
      }
      reportsByPatient[r.patientId].push(r);
    }

    // Pre-process for each patient
    for (const patientId in reportsByPatient) {
      const pReports = reportsByPatient[patientId];
      if (!pReports) continue;
      
      // Find current day report if any
      const currentReport = pReports.find(r => isSameDate(r.date, selectedDate));

      if (currentReport?.surgeryProcedure) {
        lookupMap[patientId] = currentReport;
        continue;
      }

      // Find past surgery reports
      const pastSurgeryReports = pReports.filter(
        r => isDateBeforeOrSame(r.date, selectedDate) && r.surgeryProcedure
      );

      if (pastSurgeryReports.length > 0) {
        // Sort past surgery reports descending by date
        pastSurgeryReports.sort((a, b) => compareDatesSafe(a.date, b.date, true));
        const sourceReport = pastSurgeryReports[0];

        lookupMap[patientId] = {
          ...(currentReport || {
            id: `temp-${patientId}-${selectedDate}`,
            patientId,
            date: selectedDate,
            morningReport: "",
            morningTherapy: "",
            afternoonReport: "",
            afternoonTherapy: "",
            nightReport: "",
            nightTherapy: ""
          }),
          surgeryProcedure: sourceReport.surgeryProcedure,
          surgeryOperator: sourceReport.surgeryOperator,
          surgeryDate: sourceReport.surgeryDate,
          surgeryTime: sourceReport.surgeryTime,
          surgeryAnesthesiaType: sourceReport.surgeryAnesthesiaType,
          surgeryUrgency: sourceReport.surgeryUrgency,
          surgeryStatus: sourceReport.surgeryStatus,
          surgeryDelayReason: sourceReport.surgeryDelayReason,
          surgeryNewDate: sourceReport.surgeryNewDate,
          surgeryNewTime: sourceReport.surgeryNewTime
        } as DailyReportEntry;
      } else {
        if (currentReport) {
          lookupMap[patientId] = currentReport;
        }
      }
    }

    return lookupMap;
  }, [dailyReports, selectedDate]);

  const getReportForPatient = useCallback((patientId: string) => {
    return reportsLookup[patientId];
  }, [reportsLookup]);

  // Optimized indexed lookup of medication restrictions to prevent expensive calculations per patient on every render
  const medicationRestrictionsLookup = useMemo(() => {
    const lookupMap: { [patientId: string]: any[] } = {};

    // Group daily reports by patientId
    const reportsByPatient: { [patientId: string]: DailyReportEntry[] } = {};
    for (let i = 0; i < dailyReports.length; i++) {
      const r = dailyReports[i];
      if (!r) continue;
      if (!reportsByPatient[r.patientId]) {
        reportsByPatient[r.patientId] = [];
      }
      reportsByPatient[r.patientId].push(r);
    }

    const drugRules = (masterData.restrictedDrugs && masterData.restrictedDrugs.length > 0)
      ? masterData.restrictedDrugs.map(d => ({
          name: d.drugName,
          max: d.maxDays,
          regex: new RegExp(d.drugName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i')
        }))
      : [
          { name: 'Ketorolac', max: 3, regex: /ketorolac/i },
          { name: 'Ceftriaxone', max: 5, regex: /ceftriaxone/i },
          { name: 'Meropenem', max: 7, regex: /meropenem/i },
          { name: 'Levofloxacin', max: 5, regex: /levofloxacin/i },
          { name: 'Dexamethasone', max: 3, regex: /dexamethasone/i },
          { name: 'Methylprednisolone', max: 5, regex: /methylprednisolone/i },
          { name: 'Ranitidine', max: 5, regex: /ranitidine/i },
          { name: 'Ketoprofen', max: 3, regex: /ketoprofen/i },
        ];

    for (const patientId in reportsByPatient) {
      const pReports = reportsByPatient[patientId];
      if (!pReports) continue;
      const sortedReports = pReports
        .filter((r) => isDateBeforeOrSame(r.date, selectedDate))
        .sort((a, b) => compareDatesSafe(a.date, b.date, true));

      const alerts: any[] = [];
      drugRules.forEach(rule => {
        let days = 0;
        for (let i = 0; i < sortedReports.length; i++) {
          const rep = sortedReports[i];
          if (!rep) continue;
          const combinedTherapies = `${rep.morningTherapy || ''} ${rep.afternoonTherapy || ''} ${rep.nightTherapy || ''}`;
          if (rule.regex.test(combinedTherapies)) {
            days++;
          } else {
            break;
          }
        }

        if (days > 0) {
          alerts.push({
            drugName: rule.name,
            maxDays: rule.max,
            consecutiveDays: days,
            triggerWarning: days >= rule.max
          });
        }
      });

      lookupMap[patientId] = alerts;
    }

    return lookupMap;
  }, [dailyReports, selectedDate, masterData.restrictedDrugs]);

  const checkMedicationRestrictions = useCallback((patientId: string) => {
    return medicationRestrictionsLookup[patientId] || [];
  }, [medicationRestrictionsLookup]);

  const [surgeryForm, setSurgeryForm] = useState<{
    surgeryProcedure: string;
    surgeryOperator: string;
    surgeryDate: string;
    surgeryTime: string;
    surgeryAnesthesiaType: string;
    surgeryUrgency: string;
    surgeryStatus: string;
    surgeryDelayReason: string;
    surgeryNewDate: string;
    surgeryNewTime: string;
  } | null>(null);

  const [surgeryValidationError, setSurgeryValidationError] = useState<string | null>(null);

  useEffect(() => {
    setDoctorSearchTerm("");
    setSurgeryValidationError(null);
    if (editingSurgery) {
      const report = getReportForPatient(editingSurgery);
      setSurgeryForm({
        surgeryProcedure: report?.surgeryProcedure || "",
        surgeryOperator: report?.surgeryOperator || "",
        surgeryDate: report?.surgeryDate || selectedDate,
        surgeryTime: report?.surgeryTime || "",
        surgeryAnesthesiaType: report?.surgeryAnesthesiaType || "",
        surgeryUrgency: report?.surgeryUrgency || "ELECTIVE",
        surgeryStatus: report?.surgeryStatus || "SCHEDULED",
        surgeryDelayReason: report?.surgeryDelayReason || "",
        surgeryNewDate: report?.surgeryNewDate || "",
        surgeryNewTime: report?.surgeryNewTime || "",
      });
    } else {
      setSurgeryForm(null);
    }
  }, [editingSurgery, selectedDate]);

  const getDepLabel = (
    shift: "morning" | "afternoon" | "night",
    report?: DailyReportEntry,
  ) => {
    if (!report) return null;
    const level =
      shift === "morning"
        ? report.morningDependency
        : shift === "afternoon"
          ? report.afternoonDependency
          : report.nightDependency;
    if (!level) return null;
    return (
      <span
        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
          level === "TOTAL"
            ? "bg-red-100 text-red-700"
            : level === "PARSIAL"
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {level} CARE
      </span>
    );
  };

  const handleSaveShiftReport = () => {
    if (!editingEntry) return;

    const shiftPrefix = editingEntry.type.replace("Report", "");
    const currentLevel = editingEntry.tempDependency;
    const currentRecorder = editingEntry.tempRecordedBy;

    if (!currentLevel) {
      setError("Wajib mengisi Tingkat Ketergantungan!");
      return;
    }

    if (!currentRecorder) {
      setError("Wajib mengisi Pembuat Laporan!");
      return;
    }

    setError(null);
    setSaveError(null);
    setIsSaving(false);

    // Kirim sinkronisasi secara asynchronous (background) ke Google Sheets
    onUpdateReport(
      editingEntry.patientId,
      "BATCH",
      {
        diagnosis: editingEntry.tempDiagnosis,
        [`${shiftPrefix}Therapy`]: editingEntry.tempTherapy,
        [`${shiftPrefix}Report`]: editingEntry.tempReport,
        [`${shiftPrefix}RecordedBy`]: editingEntry.tempRecordedBy,
        [`${shiftPrefix}Dependency`]: editingEntry.tempDependency,
      },
      selectedDate,
    ).catch((err: any) => {
      console.warn("Background shift report sync failed (already saved locally):", err);
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("surgihub_toast", {
          detail: {
            message: "Laporan berhasil disimpan (Sinkronisasi berjalan di background)",
            type: "success",
          },
        })
      );
    }

    // Langsung tutup modal dan redirect kembali
    setEditingEntry(null);
  };

  const EntryBox = ({
    label,
    shift,
    content,
    therapy,
    report,
    patientId,
    color = "indigo",
  }: {
    label: string;
    shift: "morning" | "afternoon" | "night";
    content?: string;
    therapy?: string;
    report?: DailyReportEntry;
    patientId: string;
    color?: string;
  }) => (
    <div
      onClick={() => {
        setError(null);
        const currentReport = getReportForPatient(patientId);
        const shiftPrefix = shift;
        setEditingEntry({
          patientId: patientId,
          type: `${shift}Report` as any,
          tempDiagnosis:
            currentReport?.diagnosis ||
            patients.find((p) => p.id === patientId)?.diagnosaUtama ||
            "",
          tempTherapy: (currentReport as any)?.[`${shiftPrefix}Therapy`] || "",
          tempReport: (currentReport as any)?.[`${shiftPrefix}Report`] || "",
          tempDependency: (currentReport as any)?.[`${shiftPrefix}Dependency`] || undefined,
          tempRecordedBy: (currentReport as any)?.[`${shiftPrefix}RecordedBy`] || "",
        });
      }}
      className={`w-full min-w-[210px] min-h-[170px] border ${content || therapy ? 'border-semibold border-slate-350 bg-slate-50/70 shadow-sm' : 'border-slate-200'} rounded-none flex flex-col p-4 cursor-pointer transition-all hover:bg-slate-50 hover:border-indigo-400 group relative overflow-hidden`}
    >
      <div className="flex justify-between items-start mb-2">
        <span
          className={`text-[11px] font-black uppercase tracking-widest text-slate-800`}
        >
          SHIFT {label}
        </span>
        {getDepLabel(shift, report)}
      </div>

      <div className="space-y-2 flex-1">
        {content ? (
          <div 
            className="text-[13px] text-slate-800 font-semibold leading-relaxed border-l-2 border-indigo-300 pl-2 whitespace-pre-wrap"
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', minHeight: 'fit-content' }}
          >
            <FileText size={12} className="inline mr-1 text-slate-700 opacity-70" /> <span dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        ) : (
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Laporan Kosong
          </div>
        )}

        {therapy && (
          <div className="pt-2 border-t border-slate-200">
            <div 
              className="text-[12px] text-emerald-800 font-extrabold leading-tight whitespace-pre-wrap"
              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', minHeight: 'fit-content' }}
            >
              <Pill size={11} className="inline mr-1 text-emerald-600" /> {therapy}
            </div>
          </div>
        )}
      </div>

      {!content && !therapy && (
        <div className="flex flex-col items-center justify-center opacity-45 group-hover:opacity-100 transition-opacity gap-1 py-4">
          <Plus size={16} className={`text-indigo-600`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
            Entry Lap
          </span>
        </div>
      )}



      {report && (report as any)[`${shift}RecordedBy`] && (
        <div className="mt-4 pt-2 border-t border-dashed border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right shrink-0">
          Oleh: {(report as any)[`${shift}RecordedBy`]}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modal History Reports */}
      {showHistoryPatientId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-2xl shadow-2xl animate-fade-in border-t-8 border-indigo-600 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                  Riwayat Laporan Keperawatan
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Pasien: {patients.find(p => p.id === showHistoryPatientId)?.name}
                </p>
              </div>
              <button onClick={() => setShowHistoryPatientId(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <ChevronDown size={24} className="rotate-180" />
              </button>
            </div>

            <div className="space-y-8">
              {dailyReports
                .filter(r => r.patientId === showHistoryPatientId)
                .sort((a, b) => compareDatesSafe(a.date, b.date, true))
                .slice(0, 15)
                .map((r, rIdx) => (
                  <div key={`history-${r.date}-${rIdx}`} className="space-y-4 border-l-4 border-slate-100 pl-6 relative">
                    <div className="absolute -left-[10px] top-0 w-4 h-4 rounded-full bg-indigo-500 border-4 border-white"></div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                         {r.date}
                       </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {['morning', 'afternoon', 'night'].map(shift => {
                        const content = (r as any)[`${shift}Report`];
                        const therapy = (r as any)[`${shift}Therapy`];
                        const recordedBy = (r as any)[`${shift}RecordedBy`];
                        const dep = (r as any)[`${shift}Dependency`];
                        
                        if (!content && !therapy) return null;

                        return (
                          <div key={shift} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                SHIFT {shift === 'morning' ? 'PAGI' : shift === 'afternoon' ? 'SIANG' : 'MALAM'}
                                <button 
                                  onClick={() => {
                                    if (editingEntry) {
                                      setEditingEntry({
                                        ...editingEntry,
                                        tempReport: content || editingEntry.tempReport,
                                        tempTherapy: therapy || editingEntry.tempTherapy,
                                      });
                                      setShowHistoryPatientId(null);
                                    } else {
                                       // If no entry is open, maybe just show a toast or do nothing
                                       // Or maybe set editingEntry to this patient and shift?
                                       setEditingEntry({
                                          patientId: showHistoryPatientId!,
                                          type: `${shift}Report` as any,
                                          tempDiagnosis: r.diagnosis || "",
                                          tempTherapy: therapy || "",
                                          tempReport: content || "",
                                          tempDependency: dep || undefined,
                                          tempRecordedBy: recordedBy || "",
                                       });
                                       setShowHistoryPatientId(null);
                                    }
                                  }}
                                  className="text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 normal-case"
                                >
                                  <Copy size={10} /> Salin Laporan
                                </button>
                              </span>
                              {dep && (
                                <span className="text-[7px] font-black bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded uppercase">{dep}</span>
                              )}
                            </div>
                            {content && (
                              <p className="text-[10px] text-slate-700 font-medium leading-relaxed italic mb-2 border-b border-white pb-2 whitespace-pre-wrap">
                                {content}
                              </p>
                            )}
                            {therapy && (
                              <div className="text-[9px] text-emerald-600 font-bold bg-emerald-50/50 p-2 rounded-lg">
                                <Pill size={10} className="inline mr-1" /> {therapy}
                              </div>
                            )}
                            {recordedBy && (
                              <div className="mt-2 text-[7px] font-black text-slate-400 uppercase text-right">By: {recordedBy}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              
              {dailyReports.filter(r => r.patientId === showHistoryPatientId).length === 0 && (
                <div className="text-center py-20 text-slate-400 italic font-bold">Belum ada riwayat laporan untuk pasien ini.</div>
              )}
            </div>

            <div className="mt-10">
              <Button onClick={() => setShowHistoryPatientId(null)} className="w-full py-4 rounded-2xl font-black uppercase tracking-widest bg-slate-900 text-white">
                Tutup Jendela
              </Button>
            </div>
          </div>
        </div>
      )}

       {/* Modal Edit for detailed entry */}
      {editingEntry && (
        <ShiftReportModal
          editingEntry={editingEntry}
          patients={patients}
          masterData={masterData}
          dailyReports={dailyReports}
          selectedDate={selectedDate}
          currentUser={currentUser}
          primaryNurses={allNursesList}
          onUpdateReport={onUpdateReport}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {/* Modal Surgery Schedule */}
      {editingSurgery && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-4xl shadow-2xl animate-fade-in border-t-8 border-blue-600 max-h-[80vh] flex flex-col overflow-y-auto">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-6 bg-blue-600 rounded-full inline-block"></span>
                Jadwal / Tindakan
              </h3>
            </div>
            
            {/* Split layout into two compact scrollable columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
              
              {/* Left Column: Core Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-[#144272] uppercase tracking-widest mb-1.5">
                    Nama Tindakan / Prosedur
                  </label>
                  <input
                    type="text"
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 transition-all bg-slate-50/50"
                    placeholder="Contoh: Laparoscopy..."
                    value={surgeryForm?.surgeryProcedure || ""}
                    onChange={(e) =>
                      setSurgeryForm(prev => prev ? { ...prev, surgeryProcedure: e.target.value } : null)
                    }
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#144272] uppercase tracking-widest mb-1.5">
                    Waktu / Tanggal Tindakan
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="date"
                      className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 transition-all bg-slate-50/50"
                      value={surgeryForm?.surgeryDate || ""}
                      onChange={(e) =>
                        setSurgeryForm(prev => prev ? { ...prev, surgeryDate: e.target.value } : null)
                      }
                    />
                    <input
                      type="time"
                      className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 transition-all bg-slate-50/50"
                      value={surgeryForm?.surgeryTime || ""}
                      onChange={(e) =>
                        setSurgeryForm(prev => prev ? { ...prev, surgeryTime: e.target.value } : null)
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#144272] uppercase tracking-widest mb-1.5">
                      Jenis Anestesi
                    </label>
                    <input
                      type="text"
                      className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 transition-all bg-slate-50/50"
                      placeholder="Contoh: General, Spinal..."
                      value={surgeryForm?.surgeryAnesthesiaType || ""}
                      onChange={(e) =>
                        setSurgeryForm(prev => prev ? { ...prev, surgeryAnesthesiaType: e.target.value } : null)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#144272] uppercase tracking-widest mb-1.5">
                      Sifat Operasi
                    </label>
                    <select
                      className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none bg-slate-50/50 focus:border-blue-500 transition-all cursor-pointer"
                      value={surgeryForm?.surgeryUrgency || "ELECTIVE"}
                      onChange={(e) =>
                        setSurgeryForm(prev => prev ? { ...prev, surgeryUrgency: e.target.value } : null)
                      }
                    >
                      <option value="ELECTIVE">ELEKTIF</option>
                      <option value="EMERGENCY">CYTO / EMERGENCY</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#144272] uppercase tracking-widest mb-1.5">
                    Status Tindakan
                  </label>
                  <select
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none bg-slate-50/50 focus:border-blue-500 transition-all cursor-pointer"
                    value={surgeryForm?.surgeryStatus || "SCHEDULED"}
                    onChange={(e) =>
                      setSurgeryForm(prev => prev ? { ...prev, surgeryStatus: e.target.value } : null)
                    }
                  >
                    <option value="SCHEDULED">DIJADWALKAN</option>
                    <option value="PERFORMED">TELAH DILAKUKAN</option>
                    <option value="DELAYED">DITUNDA</option>
                    <option value="CANCELLED">DIBATALKAN</option>
                  </select>
                </div>

                {surgeryForm?.surgeryStatus === "DELAYED" && (
                  <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-black text-rose-700 uppercase tracking-widest mb-1.5">
                        Alasan Ditunda (Akan masuk ke Mutu)
                      </label>
                      <textarea
                        className="w-full border-2 border-rose-100 rounded-xl p-3 text-xs font-bold outline-none focus:border-rose-550 bg-white"
                        placeholder="Sebutkan alasan penundaan..."
                        value={surgeryForm?.surgeryDelayReason || ""}
                        onChange={(e) =>
                          setSurgeryForm(prev => prev ? { ...prev, surgeryDelayReason: e.target.value } : null)
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-rose-700 uppercase tracking-widest mb-1.5">
                          Tgl Rencana Baru
                        </label>
                        <input
                          type="date"
                          className="w-full border-2 border-rose-100 rounded-xl px-4 py-2 text-xs font-bold outline-none bg-white focus:border-rose-500"
                          value={surgeryForm?.surgeryNewDate || ""}
                          onChange={(e) =>
                            setSurgeryForm(prev => prev ? { ...prev, surgeryNewDate: e.target.value } : null)
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-rose-700 uppercase tracking-widest mb-1.5">
                          Jam Rencana Baru
                        </label>
                        <input
                          type="time"
                          className="w-full border-2 border-rose-100 rounded-xl px-4 py-2 text-xs font-bold outline-none bg-white focus:border-rose-500"
                          value={surgeryForm?.surgeryNewTime || ""}
                          onChange={(e) =>
                            setSurgeryForm(prev => prev ? { ...prev, surgeryNewTime: e.target.value } : null)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right Column: Multi-DPJP Panel */}
              <div className="space-y-4 border-l border-dashed border-slate-100 pl-0 lg:pl-6">
                <label className="block text-[10px] font-black text-[#144272] uppercase tracking-widest">
                  Operator / Dokter Bedah (DPJP) - Pilih Multi Dokter
                </label>
                
                {/* Search Box */}
                <div className="relative">
                  <input
                    type="text"
                    className="w-full border-2 border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 bg-slate-50/50"
                    placeholder="Ketik untuk mencari nama DPJP atau SMF..."
                    value={doctorSearchTerm}
                    onChange={(e) => setDoctorSearchTerm(e.target.value)}
                  />
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                {/* Selected DPJP Chips */}
                {(() => {
                  const currentOps = surgeryForm?.surgeryOperator
                    ? surgeryForm.surgeryOperator.split(',').map(s => s.trim()).filter(Boolean)
                    : [];

                  const handleToggleDoctor = (docName: string) => {
                    const trimmedDoc = docName.trim();
                    let updated: string[];
                    if (currentOps.map(o => o.toLowerCase().trim()).includes(trimmedDoc.toLowerCase())) {
                      updated = currentOps.filter(o => o.trim().toLowerCase() !== trimmedDoc.toLowerCase());
                    } else {
                      updated = Array.from(new Set([...currentOps, trimmedDoc]));
                    }
                    const joined = updated.join(', ');
                    setSurgeryForm(prev => prev ? { ...prev, surgeryOperator: joined } : null);
                  };

                  const filteredDocs = masterData.doctors.filter(d => {
                    const smf = masterData.doctorMetadata?.[d]?.ksm || 'UMUM';
                    const q = doctorSearchTerm.toLowerCase();
                    return d.toLowerCase().includes(q) || smf.toLowerCase().includes(q);
                  });

                  // Group by KSM
                  const grouped: Record<string, string[]> = {};
                  filteredDocs.forEach(d => {
                    const smf = masterData.doctorMetadata?.[d]?.ksm || 'UMUM';
                    if (!grouped[smf]) grouped[smf] = [];
                    grouped[smf].push(d);
                  });

                  const sortedKsmKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

                  return (
                    <div className="space-y-3">
                      {/* Chips Display */}
                      {currentOps.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100 max-h-24 overflow-y-auto custom-scrollbar">
                          {currentOps.map(op => {
                            const opSmf = masterData.doctorMetadata?.[op]?.ksm || 'UMUM';
                            return (
                              <span key={op} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 font-extrabold text-[9px] px-2.5 py-1 rounded-lg border border-blue-200 uppercase tracking-tight">
                                {op} <span className="text-blue-400 font-normal">({opSmf})</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleDoctor(op)}
                                  className="text-blue-500 hover:text-red-500 font-bold ml-1 text-[11px] leading-none cursor-pointer"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-amber-500 font-bold italic">Belum ada DPJP terpilih. Klik dokter di bawah untuk memilih.</p>
                      )}

                      {/* Grouped Lists Scrollable Area */}
                      <div className="border border-slate-100 rounded-2xl max-h-[220px] overflow-y-auto p-3 bg-white space-y-3 custom-scrollbar">
                        {sortedKsmKeys.length > 0 ? (
                          sortedKsmKeys.map(ksm => (
                            <div key={ksm} className="space-y-1">
                              <div className="text-[8px] font-black text-indigo-600 bg-indigo-50/70 px-2 py-0.5 rounded tracking-widest uppercase">
                                SMF: {ksm}
                              </div>
                              <div className="grid grid-cols-1 gap-1 pl-1">
                                {grouped[ksm].sort((a, b) => a.localeCompare(b)).map(doc => {
                                  const isSelected = currentOps.includes(doc);
                                  return (
                                    <button
                                      type="button"
                                      key={doc}
                                      onClick={() => handleToggleDoctor(doc)}
                                      className={`flex items-center justify-between text-left p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-blue-600 text-white shadow-sm'
                                          : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent'
                                      }`}
                                    >
                                      <span>{doc}</span>
                                      {isSelected && <span className="text-[10px] bg-white text-blue-600 px-1.5 py-0.5 rounded-md font-black">✓ TERPILIH</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center italic text-slate-400 text-[10px]">Dokter tidak ditemukan</div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>

            {surgeryValidationError && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 text-xs font-black rounded-2xl border border-red-100 uppercase tracking-wider animate-shake">
                ⚠️ {surgeryValidationError}
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="mt-6 flex gap-4 shrink-0 border-t pt-4 border-slate-100">
              <Button
                variant="ghost"
                onClick={() => setEditingSurgery(null)}
                className="flex-1 py-3 px-6 rounded-2xl font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition-all cursor-pointer"
              >
                Batal
              </Button>
              <Button
                onClick={() => {
                  if (surgeryForm && editingSurgery) {
                    if (surgeryForm.surgeryStatus === "DELAYED") {
                      if (!surgeryForm.surgeryDelayReason || !surgeryForm.surgeryDelayReason.trim()) {
                        setSurgeryValidationError("Alasan tunda (klinis/non-klinis) wajib diisi untuk status TUNDA.");
                        return;
                      } else {
                        // Append delay reason to patient's catatanKhusus
                        const pat = patients.find(p => p.id === editingSurgery);
                        const existingCatatan = pat?.catatanKhusus || "";
                        const trimmedReason = surgeryForm.surgeryDelayReason.trim();
                        const delayMarker = `(TUNDA OPERASI: ${trimmedReason})`;
                        
                        if (!existingCatatan.includes(delayMarker)) {
                          const updatedCatatan = existingCatatan 
                            ? `${existingCatatan} | ${delayMarker}`
                            : delayMarker;
                          onUpdatePatient?.(editingSurgery, { catatanKhusus: updatedCatatan });
                        }
                      }
                    }
                    
                    onUpdateReport(
                      editingSurgery,
                      "BATCH",
                      surgeryForm,
                      selectedDate,
                    );
                  }
                  setEditingSurgery(null);
                }}
                className="flex-[2] py-3 px-6 rounded-2xl font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white text-xs shadow-xl shadow-blue-100 transition-all cursor-pointer"
              >
                Simpan Jadwal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Admin Note */}
      {editingAdminNote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-lg shadow-2xl animate-fade-in border-t-8 border-slate-800">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                Admin Note
              </h3>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Catatan Khusus Admin
              </label>
              <textarea
                className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-slate-800 outline-none min-h-[150px]"
                placeholder="Masukkan catatan administratif..."
                defaultValue={
                  getReportForPatient(editingAdminNote)?.adminNote || 
                  patients.find(p => p.id === editingAdminNote)?.catatanKhusus || ""
                }
                onBlur={(e) =>
                  onUpdateReport(editingAdminNote, "adminNote", e.target.value, selectedDate)
                }
              />
            </div>
            <div className="mt-10">
              <Button
                onClick={() => setEditingAdminNote(null)}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest bg-slate-800 text-white shadow-xl shadow-slate-100"
              >
                Simpan Note
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Status Change Details */}
      {statusChangePatient && (
        <StatusChangeModal
          statusChangePatient={statusChangePatient}
          masterData={masterData}
          patients={patients}
          onUpdatePatient={onUpdatePatient}
          onClose={() => setStatusChangePatient(null)}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">
            Matriks Pelayanan Harian
          </h2>
          {syncStatus === 'SYNCING' && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
              Menyinkronkan...
            </span>
          )}
          {syncStatus === 'SUCCESS' && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Tersinkronisasi
            </span>
          )}
          {syncStatus === 'ERROR' && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-100 animate-bounce">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              Pending Sync
            </span>
          )}
          {syncStatus === 'IDLE' && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 border border-slate-100">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              Tersinkronisasi
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="bg-white border text-[11px] font-bold px-5 py-2.5 rounded-xl"
          >
            <Printer size={16} className="mr-2" /> Cetak
          </Button>
          <Button
            onClick={() => setIsRetrievalModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg shadow-emerald-100 flex items-center gap-1.5"
          >
            <History size={16} /> Tarik Pasien Mutasi Kembali
          </Button>
          <Button
            onClick={() => setIsRegisterOldModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg shadow-blue-100 flex items-center gap-1.5"
          >
            <UserPlus size={16} /> Registrasi Pasien Pernah Dirawat
          </Button>
          <Button
            onClick={onAddPatient}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-lg shadow-indigo-100"
          >
            <Plus size={16} className="mr-2" /> Pasien Baru
          </Button>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur shadow-sm border rounded-[2rem] p-8 overflow-visible relative z-[100]">
        <div className="flex flex-nowrap gap-6 items-end min-w-max pb-1">
          
          {/* SEARCH TERM BOX */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
              CARI PASIEN (NAMA/RM)
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Cari nama atau No. RM..."
                className="pl-10 pr-4 py-2.5 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none w-52 bg-slate-50/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
              TGL PELAYANAN
            </label>
            <div className="relative">
              <Calendar
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="date"
                className="pl-10 pr-4 py-2.5 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none w-48 bg-slate-50/50"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
              UNIT PERAWATAN
            </label>
            <SearchableSelect
              className="w-52"
              options={((currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "BIDANG") ? ["Semua Unit"] : []).concat(masterData.units)}
              value={selectedUnit}
              onChange={(val) => setSelectedUnit(val)}
              disabled={
                currentUser?.role !== "SUPER_ADMIN" &&
                currentUser?.role !== "BIDANG"
              }
              placeholder="Pilih Unit..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
              PERAWAT PRIMER
            </label>
            <SearchableSelect
              className="w-52"
              options={["Semua PPJA"].concat(primaryNurses)}
              value={selectedPPJA}
              onChange={(val) => setSelectedPPJA(val)}
              placeholder="Pilih PPJA..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
              DPJP
            </label>
            <SearchableSelect
              className="w-52"
              options={["Semua DPJP"].concat(masterData.doctors)}
              value={selectedDPJP}
              onChange={(val) => setSelectedDPJP(val)}
              placeholder="Pilih DPJP..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
              STATUS PASIEN
            </label>
            <SearchableSelect
              className="w-52"
              options={["Semua Status"].concat((masterData?.refs?.statusDataPasien || []).filter(v => v !== "Batal Rawat Inap")).concat(["Batal Rawat Inap"])}
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val || 'Semua Status')}
              placeholder="Pilih Status..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
              RUANGAN
            </label>
            <SearchableSelect
              className="w-52"
              options={["Semua Ruangan"].concat(uniqueRooms)}
              value={selectedRoomFilter}
              onChange={(val) => setSelectedRoomFilter(val)}
              placeholder="Pilih Ruangan..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
              NO BED
            </label>
            <SearchableSelect
              className="w-40"
              options={["Semua No Bed"].concat(uniqueBeds)}
              value={selectedBedFilter}
              onChange={(val) => setSelectedBedFilter(val)}
              placeholder="Pilih Bed..."
            />
          </div>
          <div className="pl-6 flex items-center justify-end">
            <span className="bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl border border-blue-100 text-[10px] font-black uppercase tracking-widest">
              {filteredPatients.length} Pasien Aktif
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden min-h-[75vh] flex flex-col">
        {/* Synchronized Top Horizontal Scrollbar */}
        <div 
          ref={topScrollRef} 
          className="overflow-x-auto overflow-y-hidden border-b border-slate-100 custom-scrollbar shrink-0 bg-slate-50/80"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div style={{ width: `${tableScrollWidth}px` }} className="h-2.5"></div>
        </div>

        <div ref={tableContainerRef} className="overflow-auto max-h-[75vh] custom-scrollbar flex-1 bg-white">
          <table ref={tableRef} className="w-full text-left border-collapse min-w-[1340px]">
            <thead className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b select-none">
              <tr>
                <th className="p-4 w-[60px] min-w-[60px] max-w-[60px] text-center sticky top-0 left-0 bg-slate-100 z-40 border-r border-b border-slate-200">NO</th>
                <th className="p-4 w-[110px] min-w-[110px] max-w-[110px] text-center sticky top-0 left-[60px] bg-slate-100 z-40 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-b border-slate-200">NOMOR BED / RUANGAN</th>
                <th className="p-4 w-[260px] min-w-[260px] max-w-[260px] sticky top-0 left-[170px] bg-slate-100 z-40 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-b border-slate-200">IDENTITAS PASIEN</th>
                <th className="p-4 w-[230px] min-w-[230px] max-w-[230px] text-center sticky top-0 bg-slate-100 z-30 border-b border-r border-slate-200">PERAWAT PRIMER & DPJP</th>
                <th className="p-4 w-[170px] min-w-[170px] max-w-[170px] text-center sticky top-0 bg-slate-100 z-30 border-b border-r border-slate-200">STATUS PERAWATAN</th>
                <th className="p-4 w-[240px] min-w-[240px] max-w-[240px] text-center bg-slate-50/80 sticky top-0 z-30 border-b border-r border-slate-200">LAPORAN SHIFT PAGI</th>
                <th className="p-4 w-[240px] min-w-[240px] max-w-[240px] text-center sticky top-0 bg-slate-100 z-30 border-b border-r border-slate-200">LAPORAN SHIFT SIANG</th>
                <th className="p-4 w-[240px] min-w-[240px] max-w-[240px] text-center bg-slate-50/80 sticky top-0 z-30 border-b border-r border-slate-200">LAPORAN SHIFT MALAM</th>
                <th className="p-4 w-[220px] min-w-[220px] max-w-[220px] text-center sticky top-0 bg-slate-100 z-30 border-b border-r border-slate-200">JADWAL TINDAKAN</th>
                <th className="p-4 w-[220px] min-w-[220px] max-w-[220px] text-center sticky top-0 bg-slate-100 z-30 border-b border-r border-slate-200">ADMIN NOTE</th>
                <th className="p-4 w-[220px] min-w-[220px] max-w-[220px] text-center sticky top-0 bg-slate-100 z-30 border-b border-slate-200">ENTRY VISITE DOKTER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedPatients.map((p, idx) => {
                const report = getReportForPatient(p.id);
                const isTransferredToday = (p.statusDataPasien === "Pindah Ruangan" || p.statusDataPasien === "Dipindah ke Ruangan Lain" || p.status === "DISCHARGED") && parseToStandardDateString(p.dischargeDate) === selectedDate;
                const displayRoom = isTransferredToday ? (p.transferRoom || p.ruangan) : p.ruangan;
                const displayBed = isTransferredToday ? (p.transferBed || p.nomorBed) : p.nomorBed;
                const isActive = p.statusDataPasien === "Masih Dirawat" || p.statusDataPasien === "AKTIF" || !p.statusDataPasien;
                const rowBgClass = isActive 
                  ? "bg-sky-50/15 hover:bg-sky-100/25 transition-colors group" 
                  : "bg-slate-50 hover:bg-slate-100 transition-colors group opacity-85";
                const stickyBgClass = isActive 
                  ? "bg-[#f4faff] group-hover:bg-[#ebf5ff] transition-all" 
                  : "bg-slate-50/95 group-hover:bg-slate-100 transition-all";

                return (
                  <tr
                    key={p.id}
                    className={rowBgClass}
                  >
                    <td className={`p-4 w-[60px] min-w-[60px] max-w-[60px] text-center font-black text-slate-850 text-[14px] sticky left-0 transition-all z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-b border-slate-200 ${stickyBgClass}`}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td 
                      className={`p-4 w-[110px] min-w-[110px] max-w-[110px] text-center sticky left-[60px] transition-all border-r border-b border-slate-200 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)] cursor-pointer ${stickyBgClass}`}
                      onClick={() => {
                        setStatusChangePatient({
                          id: p.id,
                          newStatus: "Dipindah ke Ruangan Lain",
                          date: new Date().toISOString().split("T")[0],
                          time: new Date()
                            .toTimeString()
                            .split(" ")[0]
                            .substring(0, 5),
                          reason: "",
                          destination: p.unitTujuan || "",
                          destinationClass: p.kelasRawat || "",
                          destinationRoom: p.ruangan || "",
                          destinationBed: p.nomorBed || "",
                          isInternalOnly: true,
                        });
                      }}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="text-indigo-950 font-black text-[14px] leading-tight select-all tracking-tight bg-slate-100/80 py-1.5 px-2 rounded-xl group-hover:scale-102 transition-transform">
                          {displayRoom}
                        </div>
                        {(() => {
                          const bedStyles = getRoomBedStyles(displayRoom || p.ruangan);
                          return (
                            <div className={`text-[11px] font-black tracking-wider uppercase py-1 px-1.5 rounded-lg inline-block text-center shadow-xs border ${bedStyles.bg} ${bedStyles.text} ${bedStyles.border}`}>
                              BED {displayBed}
                            </div>
                          );
                        })()}
                        {(() => {
                          if (displayRoom && displayBed) {
                            const key = `${String(displayRoom).trim().toUpperCase()}_${String(displayBed).trim().toUpperCase()}`;
                            const patientIds = doubleBookedMap[key] || [];
                            const isDouble = patientIds.length > 1;
                            if (isDouble) {
                              const doubleBookedNames = patientIds
                                .map(id => patients.find(p => p.id === id))
                                .filter(Boolean)
                                .map(p => p!.name);
                              return (
                                <div className="space-y-1 mt-1">
                                  <span className="block text-[8px] font-black text-white bg-rose-650 px-1.5 py-1 rounded-md animate-pulse font-sans tracking-tight leading-none text-center uppercase border border-rose-500">
                                    ⚠️ TINTA GANDA
                                  </span>
                                  <div className="bg-rose-50 border border-rose-200 rounded p-1 text-[8px] font-bold text-rose-700 leading-tight space-y-0.5 text-left">
                                    {doubleBookedNames.map((name, ni) => (
                                      <div key={ni} className="truncate select-none font-bold" title={name}>• {name}</div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                        <div className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 transition-all uppercase tracking-widest flex items-center justify-center gap-0.5 mt-0.5 opacity-60 group-hover:opacity-100">
                          <Edit size={10} /> PINDAH
                        </div>
                      </div>
                    </td>
                    <td 
                      onClick={() => onPatientClick?.(p.id)}
                      className={`p-4 w-[260px] min-w-[260px] max-w-[260px] sticky left-[170px] cursor-pointer hover:bg-slate-100/60 transition-all z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-b border-slate-200 ${stickyBgClass}`}
                    >
                      {(() => {
                        const locker = getPatientLockUser(p.id);
                        if (locker) {
                          return (
                            <div className="mb-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                              ⚠️ Sedang diisi oleh {locker}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div className="text-slate-800 font-extrabold text-[15px] uppercase truncate max-w-[220px] hover:text-indigo-600 transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[12px] text-slate-500 font-bold tracking-tight mb-2.5 flex items-center justify-between">
                        <span>RM: {p.noRM}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowHistoryPatientId(p.id);
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 bg-indigo-100/50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <History size={11} /> RIWAYAT
                        </button>
                      </div>
                      {/* Gender, DOB, Address, and Medical Diagnosis */}
                      <div className="space-y-2 my-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[13px] leading-relaxed">
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-bold">
                            L/P: <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{p.gender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}</span>
                          </span>
                        </div>
                        <div className="text-slate-650">
                          <span className="font-bold">Lahir:</span> <span className="font-extrabold text-slate-850">{p.birthDate || '-'}</span>
                          {p.birthDate && (
                            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded-lg ml-1 whitespace-nowrap font-sans">
                              {getDetailedAge(p.birthDate, selectedDate)}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-650 line-clamp-1 truncate hover:line-clamp-none hover:whitespace-normal transition-all">
                          <span className="font-bold">Alamat:</span> <span className="font-medium text-slate-700">{p.address || '-'}</span>
                        </div>
                        <div className="text-slate-650 mt-1.5">
                          <div className="font-black text-slate-500 text-[10px] uppercase tracking-wider mb-1 font-mono">Diagnosa Medis (Main):</div>
                          <p 
                            onClick={() => setHistoryModalPatientId(p.id)}
                            title="Klik untuk melihat riwayat diagnosa per shift"
                            className="font-bold text-slate-850 bg-amber-50 border border-amber-250/50 hover:bg-amber-100 hover:border-amber-300 transition-all px-2.5 py-2.5 rounded-xl text-[13px] leading-snug break-words mb-2 cursor-pointer flex items-center justify-between group"
                          >
                            <span>{getLatestCleanDiagnosis(p)}</span>
                            <span className="text-[10px] font-black text-amber-700 bg-amber-100/60 px-2 py-1 rounded-lg uppercase font-mono opacity-80 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-2">
                              LIHAT RIWAYAT
                            </span>
                          </p>

                          {/* Interactive AI Compilator Trigger */}
                          <button
                            onClick={() => handleCompilePatientDiagnosis(p.id)}
                            className="w-full mt-2.5 py-2 bg-gradient-to-r from-indigo-700 via-slate-800 to-slate-900 hover:from-indigo-800 hover:to-slate-950 text-white font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all animate-pulse"
                          >
                            🧠 Kompilasi Diagnosa AI
                          </button>
                        </div>
                      </div>

                      {/* Medication Restriction Warning Badge/Info */}
                      {(() => {
                        const alerts = checkMedicationRestrictions(p.id);
                        const activeWarnings = alerts.filter(a => a.triggerWarning);
                        if (activeWarnings.length > 0) {
                          return (
                            <div className="my-2 p-2 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                              <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                                ⚠️ RESTRIKSI OBAT TERLEWATI!
                              </span>
                              {activeWarnings.map((aw, idx) => (
                                <div key={idx} className="text-[9px] font-bold text-rose-850 leading-tight">
                                  Obat <span className="font-extrabold text-rose-950 uppercase">{aw.drugName}</span> telah diberikan <span className="font-extrabold text-red-650 bg-red-100/50 px-1 rounded">{aw.consecutiveDays} hari</span> berturut-turut (Batas: {aw.maxDays} hari).
                                </div>
                              ))}
                            </div>
                          );
                        } else if (alerts.length > 0) {
                          return (
                            <div className="my-2 p-2 bg-amber-50/50 border border-amber-250/20 rounded-xl space-y-0.5">
                              <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">
                                ℹ️ Monitoring Restriksi:
                              </span>
                              {alerts.map((aw, idx) => (
                                <div key={idx} className="text-[9px] font-bold text-amber-800 leading-tight">
                                  • {aw.drugName}: {aw.consecutiveDays}/{aw.maxDays} hari
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div className="flex flex-wrap gap-1 mb-2 items-center">
                        <span className="text-[8px] font-black text-slate-400 uppercase mr-1">Cara Bayar:</span>
                        {(() => {
                          let methods: string[] = [];
                          if (Array.isArray(p.paymentMethod)) {
                            methods = p.paymentMethod;
                          } else if (typeof p.paymentMethod === 'string' && p.paymentMethod.trim() !== '') {
                            methods = p.paymentMethod.split(',').map(s => s.trim());
                          }
                          if (methods.length > 0) {
                            return methods.map((pm, pmIdx) => {
                              const payStyle = getPaymentMethodStyles(pm);
                              return (
                                <span key={`${pm}-${pmIdx}`} className={`px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tight shadow-xs ${payStyle.bg} ${payStyle.text} mb-0.5`}>
                                  {pm}
                                </span>
                              );
                            });
                          }
                          return <span className="text-[8px] font-bold text-slate-400 italic">Belum dipilih</span>;
                        })()}
                      </div>
                    </td>

                    {/* Kolom 4: PERAWAT PRIMER & DPJP (Gabungan Kontras Tinggi) */}
                    <td className="p-4 w-[230px] min-w-[230px] max-w-[230px] border-r border-b border-slate-200">
                      <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                        {/* PPJA / Perawat Primer */}
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] font-black text-amber-900 uppercase tracking-wider font-mono bg-amber-50 px-2 py-0.5 rounded w-fit border border-amber-300">
                            PERAWAT PRIMER (PPJA):
                          </label>
                          <div className="flex flex-col gap-1 relative w-full font-sans">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveNurseSelectId(
                                  activeNurseSelectId === p.id ? null : p.id,
                                );
                              }}
                              className="w-full py-2 px-3 border border-orange-350 rounded-xl text-[12px] font-black text-orange-800 bg-orange-50/70 cursor-pointer flex justify-between items-center hover:border-orange-400 hover:bg-orange-100/40 transition-colors shadow-sm"
                            >
                              <span className="truncate py-0.5 font-black text-orange-900">
                                {p.perawatPrimer || "-- PILIH PPJA --"}
                              </span>
                              <ChevronDown size={13} className="text-orange-700 shrink-0 ml-1" />
                            </div>

                            {activeNurseSelectId === p.id && (
                              <div 
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-full left-0 right-0 mt-1 min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-2xl z-[250] overflow-hidden flex flex-col max-h-48"
                              >
                                <div className="p-2 border-b bg-slate-50">
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="Cari PPJA..."
                                    className="w-full px-2 py-1.5 rounded-lg border text-[10.5px] font-bold outline-none focus:ring-2 focus:ring-rose-500"
                                    value={nurseSearch}
                                    onChange={(e) => setNurseSearch(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="overflow-y-auto custom-scrollbar">
                                  {filteredPrimaryNurses.length > 0 ? (
                                    filteredPrimaryNurses.map((n) => (
                                      <div
                                        key={n}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onUpdatePatient?.(p.id, {
                                            perawatPrimer: n,
                                          });
                                          setActiveNurseSelectId(null);
                                          setNurseSearch("");
                                        }}
                                        className={`px-3 py-2 text-[10.5px] font-bold cursor-pointer transition-colors flex items-center justify-between ${
                                          p.perawatPrimer === n
                                            ? "bg-rose-100 text-rose-800"
                                            : "hover:bg-rose-50/50 text-slate-600"
                                        }`}
                                      >
                                        <span>{n}</span>
                                        {n === currentUser?.name && (
                                          <span className="text-[7px] bg-rose-200 text-rose-800 px-1 py-0.5 rounded font-black">
                                            SAYA
                                          </span>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="p-3 text-center text-[9px] font-bold text-slate-400 italic">
                                      Tidak ada.
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {p.perawatPrimer && (
                              <div className="flex items-center gap-1.5 text-orange-850 font-extrabold text-[10px] uppercase tracking-widest mt-1 bg-orange-100/60 px-2.5 py-1 rounded-lg w-fit border border-orange-200">
                                <UserCheck size={12} className="text-orange-600" /> PPJA AKTIF
                              </div>
                            )}
                          </div>
                        </div>

                        {/* DPJP SECTION */}
                        <div className="space-y-2 flex flex-col pt-3 border-t border-slate-150 font-sans">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-black text-[#144272] uppercase tracking-widest font-mono bg-[#144272]/5 border border-[#144272]/20 px-2 py-0.5 rounded">
                              DPJP / Raberan:
                            </label>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDpjpModalPatientId(p.id);
                                setIsDpjpModalOpen(true);
                                setDpjpModalSearch("");
                                setIsDpjpModalDropdownOpen(false);
                              }}
                              className="text-[8px] font-black uppercase text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                            >
                              ⚙️ Kelola DPJP
                            </button>
                          </div>
                          
                          <div className="space-y-1">
                            {/* DPJP Utama */}
                            {(p.dpjpList || []).length > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[7.5px] font-black uppercase bg-[#005B60]/10 text-[#005B60] px-1 rounded-sm border border-[#005B60]/15 shrink-0 font-mono">UTAMA</span>
                                <span className="text-[10px] font-extrabold text-slate-800 truncate" title={(p.dpjpList || [])[0]}>
                                  {(p.dpjpList || [])[0]}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[9.5px] text-rose-500 italic font-bold">⚠️ DPJP Belum Ditentukan!</div>
                            )}

                            {/* Co-DPJPs (Raberan) */}
                            {(p.dpjpList || []).slice(1).length > 0 && (
                              <div className="flex items-start gap-1.5 mt-1">
                                <span className="text-[7.5px] font-black uppercase bg-indigo-50 text-indigo-700 px-1 rounded-sm border border-indigo-100 shrink-0 font-mono mt-0.5">RABERAN</span>
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  {(p.dpjpList || []).slice(1).map((coDoc, coIdx) => (
                                    <span key={coDoc} className="text-[9.5px] font-bold text-slate-600 truncate" title={coDoc}>
                                      {coDoc}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 border-r border-b border-slate-200">
                      <select
                        className="w-full text-[10px] font-black border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                        value={p.statusDataPasien || "Masih Dirawat"}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          const needsModal = [
                            "BPL", "BPL (Boleh Pulang)", 
                            "APS", "APS (Pulang Paksa)", 
                            "Dirujuk", "Rujuk", 
                            "Dipindah ke Ruangan Lain", "Pindah Ruangan", 
                            "Meninggal", "Batal Rawat Inap"
                          ].includes(newStatus);

                          if (needsModal) {
                            setStatusChangePatient({
                              id: p.id,
                              newStatus,
                              date: new Date().toISOString().split("T")[0],
                              time: new Date()
                                .toTimeString()
                                .split(" ")[0]
                                .substring(0, 5),
                              reason: "",
                              destination: "",
                              destinationClass: "",
                              destinationRoom: "",
                              destinationBed: "",
                            });
                          } else {
                            const isCurrentlyTreated = ["Masih Dirawat", "AKTIF"].includes(newStatus);
                            const clearDischarge: any = {};
                            if (isCurrentlyTreated) {
                              clearDischarge.dischargeDate = "";
                              clearDischarge.dischargeTime = "";
                              clearDischarge.apsReason = "";
                              clearDischarge.referralDestination = "";
                              clearDischarge.deathTime = "";
                              clearDischarge.transferDestinationRoom = "";
                              clearDischarge.status = "ADMITTED";
                            }
                            onUpdatePatient?.(p.id, {
                              statusDataPasien: newStatus,
                              ...clearDischarge
                            });
                          }
                        }}
                      >
                        {(masterData?.refs?.statusDataPasien || []).filter(v => v !== "Batal Rawat Inap").concat(["Batal Rawat Inap"]).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>

                      {p.statusDataPasien !== "Masih Dirawat" && (
                        <div className="bg-slate-50 p-2 rounded-lg space-y-1 border border-slate-100">
                          {p.dischargeDate && (
                            <div className="text-[8px] font-black text-slate-400 uppercase">
                              TGL: {p.dischargeDate}{" "}
                              {p.dischargeTime && `@ ${p.dischargeTime}`}
                            </div>
                          )}
                          {(p.statusDataPasien === "APS" || p.statusDataPasien === "APS (Pulang Paksa)") && p.apsReason && (
                            <div className="text-[9px] font-bold text-amber-600 line-clamp-2">
                              Alasan: {p.apsReason}
                            </div>
                          )}
                          {(p.statusDataPasien === "Dirujuk" || p.statusDataPasien === "Rujuk") &&
                            p.referralDestination && (
                              <div className="text-[9px] font-bold text-indigo-600">
                                RS Tujuan: {p.referralDestination}
                              </div>
                            )}
                          {p.statusDataPasien === "Meninggal" && p.deathTime && (
                            <div className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded w-fit">
                              KAT: {p.deathTime}
                            </div>
                          )}
                          {(p.statusDataPasien === "Dipindah ke Ruangan Lain" || p.statusDataPasien === "Pindah Ruangan") &&
                            (p.transferDestinationRoom || p.ruangan) && (
                              <div className="text-[9px] font-bold text-blue-600">
                                Ruangan: {p.transferDestinationRoom || p.ruangan}{" "}
                                {p.nomorBed && <span className="opacity-60">/ {p.nomorBed}</span>}
                              </div>
                            )}
                          <button 
                            onClick={() => {
                              setStatusChangePatient({
                                id: p.id,
                                newStatus: p.statusDataPasien,
                                date: p.dischargeDate || new Date().toISOString().split("T")[0],
                                time: p.dischargeTime || new Date().toTimeString().split(" ")[0].substring(0, 5),
                                reason: p.apsReason || p.deathTime || "",
                                destination: p.referralDestination || p.unitTujuan || "",
                                destinationClass: p.kelasRawat || "",
                                destinationRoom: p.ruangan || "",
                                destinationBed: p.nomorBed || "",
                              });
                            }}
                            className="mt-2 w-full py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1.5 font-black uppercase text-[8px] tracking-widest shadow-sm"
                          >
                            <Edit size={10} /> Ubah Detail
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-3 bg-slate-50/10 border-r border-b border-slate-200">
                      <EntryBox
                        label="PAGI"
                        shift="morning"
                        content={report?.morningReport}
                        therapy={report?.morningTherapy}
                        report={report}
                        patientId={p.id}
                      />
                    </td>
                    <td className="p-3 border-r border-b border-slate-200">
                      <EntryBox
                        label="SIANG"
                        shift="afternoon"
                        content={report?.afternoonReport}
                        therapy={report?.afternoonTherapy}
                        report={report}
                        patientId={p.id}
                      />
                    </td>
                    <td className="p-3 bg-slate-50/10 border-r border-b border-slate-200">
                      <EntryBox
                        label="MALAM"
                        shift="night"
                        content={report?.nightReport}
                        therapy={report?.nightTherapy}
                        report={report}
                        patientId={p.id}
                      />
                    </td>
                    <td className="p-4 border-r border-b border-slate-200">
                      {(() => {
                        const hasSurgeryHistory = (dailyReports || []).some(
                          (r) => r.patientId === p.id && r.surgeryProcedure && r.surgeryProcedure.trim() !== ""
                        );
                        return (
                          <div
                            onClick={() => {
                              if (!report?.surgeryProcedure && hasSurgeryHistory) return;
                              if (!report?.surgeryProcedure) setEditingSurgery(p.id);
                            }}
                            className={`w-full min-w-[200px] min-h-[120px] border rounded-none flex flex-col p-3 transition-all bg-slate-50/10 ${
                              report?.surgeryProcedure 
                                ? "border-slate-200" 
                                : hasSurgeryHistory
                                  ? "border-rose-100 bg-rose-50/5 cursor-not-allowed opacity-50"
                                  : "border-slate-200 cursor-pointer hover:bg-indigo-50/20 hover:border-indigo-400 group"
                            }`}
                          >
                            <div className="text-[8px] font-black uppercase tracking-widest text-blue-600 mb-2 flex justify-between items-center">
                              <span>JADWAL TINDAKAN</span>
                              {hasSurgeryHistory && !report?.surgeryProcedure && (
                                <span className="text-rose-500 font-extrabold text-[7px] tracking-thinnest px-1 bg-rose-50 rounded">TERKUNCI</span>
                              )}
                            </div>
                            {report?.surgeryProcedure ? (
                              <div className="space-y-2">
                                <div className="text-[10px] font-black text-slate-800 uppercase leading-tight">
                                  {report.surgeryProcedure}
                                </div>
                                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                                  <Stethoscope
                                    size={10}
                                    className="text-blue-500"
                                  />{" "}
                                  {report.surgeryOperator || "Belum diisi"}
                                </div>
                                <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase tracking-tighter">
                                  <Calendar size={10} /> {report.surgeryDate || "-"}
                                </div>
                                {report.surgeryStatus && (
                                  <div
                                    className={`text-[8px] font-black px-2 py-0.5 rounded w-fit ${
                                      report.surgeryStatus === "PERFORMED"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : report.surgeryStatus === "DELAYED"
                                          ? "bg-red-100 text-red-700"
                                          : report.surgeryStatus === "CANCELLED"
                                            ? "bg-slate-100 text-slate-600"
                                            : "bg-blue-100 text-blue-700"
                                    }`}
                                  >
                                    {report.surgeryStatus}
                                  </div>
                                )}
                                {report.surgeryStatus === "DELAYED" && report.surgeryNewDate && (
                                  <div className="mt-1 text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded flex items-center gap-1 border border-indigo-100 animate-pulse">
                                    <RefreshCw size={8} /> JDW BARU: {report.surgeryNewDate} {report.surgeryNewTime && `@ ${report.surgeryNewTime}`}
                                  </div>
                                )}
                                
                                {/* Direct Edit and Delete actions in the cell */}
                                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 mt-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingSurgery(p.id);
                                    }}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-[8px] font-black uppercase tracking-wide transition-all border border-blue-100 cursor-pointer flex items-center gap-0.5"
                                  >
                                    <Edit size={8} /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm("Apakah Anda yakin ingin menghapus jadwal/laporan operasi ini?")) {
                                        onUpdateReport(
                                          p.id,
                                          "BATCH",
                                          {
                                            surgeryProcedure: "",
                                            surgeryOperator: "",
                                            surgeryDate: "",
                                            surgeryTime: "",
                                            surgeryAnesthesiaType: "",
                                            surgeryUrgency: "ELECTIVE",
                                            surgeryStatus: "SCHEDULED",
                                            surgeryDelayReason: "",
                                            surgeryNewDate: "",
                                            surgeryNewTime: ""
                                          },
                                          selectedDate
                                        );
                                      }
                                    }}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[8px] font-black uppercase tracking-wide transition-all border border-rose-100 cursor-pointer flex items-center gap-0.5"
                                  >
                                    <Trash2 size={8} /> Hapus
                                  </button>
                                </div>
                              </div>
                            ) : hasSurgeryHistory ? (
                              <div className="flex-1 flex flex-col items-center justify-center gap-1 select-none text-rose-400">
                                <span className="text-[14px]">🔒</span>
                                <span className="text-[8px] font-black uppercase tracking-wider text-rose-500 text-center leading-snug">
                                  Sudah Ada Entry Operasi
                                </span>
                              </div>
                            ) : (
                              <div className="flex-1 flex flex-col items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity gap-1">
                                <Plus size={14} className="text-blue-500" />
                                <span className="text-[8px] font-black uppercase tracking-widest">
                                  Atur Jadwal
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-4 border-r border-b border-slate-200">
                      <div
                        onClick={() => setEditingAdminNote(p.id)}
                        className={`w-full min-w-[200px] min-h-[120px] border rounded-xl flex flex-col p-3 cursor-pointer transition-all ${
                          report?.adminNote || p.catatanKhusus
                            ? "bg-amber-50/95 border-amber-400 shadow-sm hover:bg-amber-100/50"
                            : "border-slate-250 bg-slate-50/10 hover:bg-slate-50 hover:border-slate-300 group"
                        }`}
                      >
                        <div className={`text-[9px] font-black uppercase tracking-widest mb-2 ${
                          report?.adminNote || p.catatanKhusus ? "text-amber-805 text-amber-800" : "text-slate-400"
                        }`}>
                          📢 ADMIN NOTE
                        </div>
                        {report?.adminNote || p.catatanKhusus ? (
                          <div className="space-y-1">
                            <span className="text-[8px] font-extrabold text-amber-900 bg-amber-200/60 px-1.5 py-0.5 rounded uppercase tracking-wider inline-block">
                              PENTING/ALERT
                            </span>
                            <p className="text-[11.5px] text-amber-900 font-extrabold leading-relaxed whitespace-pre-wrap">
                              {report?.adminNote || p.catatanKhusus}
                            </p>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity gap-1">
                            <Plus size={14} className="text-slate-400" />
                            <span className="text-[8px] font-black uppercase tracking-widest">
                              Add Note
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 border-b border-slate-200 text-center">
                      <div className="flex flex-col gap-1.5 items-center">
                        <div 
                          onClick={() => {
                            const canAccess = ['PIC', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'].includes(currentUser?.role || '');
                            if (!canAccess) {
                              alert("Akses hanya untuk PIC, Admin, Sekru, Karu, Bidang, atau Super User");
                              return;
                            }
                            setEditingVisite({
                              patientId: p.id,
                              patientName: p.name,
                              noRM: p.noRM,
                              date: selectedDate,
                              unit: p.unitTujuan || '',
                              paymentMethod: Array.isArray(p.paymentMethod) ? p.paymentMethod : (p.paymentMethod ? [p.paymentMethod] : []),
                              dpjpList: Array.isArray(p.dpjpList) ? p.dpjpList : (p.dpjpList ? [p.dpjpList] : [])
                            });
                          }}
                          className={`w-full group cursor-pointer p-3 rounded-none border border-slate-250 transition-all flex flex-col items-center justify-center min-h-[120px] min-w-[200px] ${
                            (appData?.doctorVisits || []).filter((v: any) => v.patientId === p.id && isSameDate(v.date, selectedDate)).length > 0
                              ? 'bg-emerald-50/60 border-emerald-300 text-emerald-800 font-extrabold'
                              : 'bg-slate-50/50 border-slate-200 text-slate-400 hover:border-indigo-400'
                          }`}
                        >
                          {(appData?.doctorVisits || []).filter((v: any) => v.patientId === p.id && isSameDate(v.date, selectedDate)).length > 0 ? (
                            <>
                              <div className="flex flex-col gap-2 w-full">
                                {(appData?.doctorVisits || []).filter((v: any) => v.patientId === p.id && isSameDate(v.date, selectedDate)).map((v: any, vIdx: number) => (
                                  <div key={`visite-${v.id}-${vIdx}`} className="bg-white p-2 rounded-none border border-emerald-250 shadow-sm flex flex-col items-start text-[10px] gap-1 relative group/item">
                                    <div className="flex justify-between w-full">
                                      <span className="font-black truncate max-w-[120px] uppercase text-emerald-900">{v.doctorName}</span>
                                      <span className={`px-1.5 py-0.5 rounded-none text-[8px] font-black uppercase ${
                                        v.attendanceStatus === 'HADIR' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                      }`}>
                                        {v.attendanceStatus === 'HADIR' ? 'Hadir' : 'Absen'}
                                      </span>
                                    </div>
                                    <div className="flex gap-1">
                                      <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight">
                                        {v.visitRole.replace('_', ' ')}
                                      </span>
                                      <span className="bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight">
                                        {v.smf}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                <div className="text-[9px] font-black text-emerald-700 flex items-center justify-center gap-1 mt-1 opacity-80 group-hover:opacity-100">
                                  <Plus size={10} /> TAMBAH VISITE
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="p-1.5 bg-white border border-slate-200 rounded-none mb-1.5 shadow-sm text-slate-300 group-hover:text-indigo-500 transition-all">
                                <Stethoscope size={18} />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest leading-tight">Entry Visite</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {filteredPatients.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-6 py-4 bg-white border border-slate-150 rounded-3xl shadow-sm">
          <div className="text-xs font-bold text-slate-500">
            Menampilkan <span className="font-black text-indigo-600">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(filteredPatients.length, currentPage * itemsPerPage)}</span> dari <span className="font-black text-indigo-600">{filteredPatients.length}</span> pasien
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer select-none border border-slate-200/60"
            >
              Sebelumnya
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.ceil(filteredPatients.length / itemsPerPage) }).map((_, pageIdx) => {
                const pageNum = pageIdx + 1;
                // Only show first, last, and surrounding pages to avoid layout clutter
                if (
                  pageNum === 1 ||
                  pageNum === Math.ceil(filteredPatients.length / itemsPerPage) ||
                  Math.abs(pageNum - currentPage) <= 1
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (
                  (pageNum === 2 && currentPage > 3) ||
                  (pageNum === Math.ceil(filteredPatients.length / itemsPerPage) - 1 && currentPage < Math.ceil(filteredPatients.length / itemsPerPage) - 2)
                ) {
                  return <span key={`dots-${pageNum}`} className="text-slate-400 text-xs px-1">...</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPatients.length / itemsPerPage), p + 1))}
              disabled={currentPage === Math.ceil(filteredPatients.length / itemsPerPage)}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer select-none border border-slate-200/60"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
      {/* Visite Entry Modal */}
      {editingVisite && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6 sm:p-10 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white flex flex-col animate-slide-up">
            <div className="bg-indigo-600 p-10 text-white relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Stethoscope size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Entry Visite Dokter</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded uppercase tracking-widest">{editingVisite.patientName}</span>
                    <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded uppercase tracking-widest">RM: {editingVisite.noRM}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                  setEditingVisite(null);
                  setDoctorVisitSearch("");
                }}
                className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"
                id="close-visite-modal"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CARI DOKTER</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="Ketik nama dokter..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    value={doctorVisitSearch}
                    onChange={(e) => setDoctorVisitSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TANGGAL VISITE</label>
                  <input 
                    type="date"
                    disabled
                    value={editingVisite.date}
                    className="w-full bg-slate-50 border rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CARA BAYAR PASIEN</label>
                  <div className="flex flex-wrap gap-1.5">
                    {editingVisite.paymentMethod.length > 0 ? editingVisite.paymentMethod.map(pm => (
                      <span key={pm} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight italic">{pm}</span>
                    )) : <span className="text-[10px] italic text-slate-400">Belum diset</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-indigo-600">PILIH DOKTER & KEHADIRAN</label>
                <div className="grid grid-cols-1 gap-3">
                  {masterData.doctors
                    .filter(doc => doc.toLowerCase().includes(doctorVisitSearch.toLowerCase()))
                    .map(doc => {
                    const existingVisit = (appData?.doctorVisits || []).find((v: any) => v.patientId === editingVisite.patientId && v.date === editingVisite.date && v.doctorName === doc);
                    
                    return (
                      <DoctorVisitRow 
                        key={doc}
                        doc={doc}
                        existingVisit={existingVisit}
                        editingVisite={editingVisite}
                        masterData={masterData}
                        onAddDoctorVisit={onAddDoctorVisit}
                        onRemoveDoctorVisit={onRemoveDoctorVisit} 
                        currentUser={currentUser}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t flex justify-end">
              <Button 
                onClick={() => {
                  setEditingVisite(null);
                  setDoctorVisitSearch("");
                }}
                className="px-10 py-3.5 bg-indigo-600 font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-100"
              >
                Selesai
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI INTEGRATE COMPILATION DIAGNOSIS MODAL (EXPLICIT USER INTENT) */}
      {compiledDiagnosisPatientId && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in shadow-2xl">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-[#144272] p-6 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🧠</span>
                <div>
                  <h4 className="text-sm font-black tracking-widest uppercase">AI Kompilasi & Sintesis Diagnosa</h4>
                  <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-0.5 font-mono">Simantap Clinical AI (Gemini)</p>
                </div>
              </div>
              <button 
                onClick={() => setCompiledDiagnosisPatientId(null)}
                className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
              {(() => {
                const patObj = patients.find(p => p.id === compiledDiagnosisPatientId);
                if (!patObj) return <div className="text-center text-xs text-slate-400">Pasien tidak ditemukan.</div>;
                return (
                  <div className="space-y-4">
                    {/* Compact Identity Badge */}
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-black text-slate-800 uppercase tracking-tight">{patObj.name}</div>
                        <div className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">RM: {patObj.noRM} | Ruangan: {patObj.ruangan || '-'} Bed {patObj.nomorBed || '-'}</div>
                      </div>
                      <span className="px-3 py-1 bg-indigo-50 border border-indigo-150 rounded-lg text-[9px] font-black text-indigo-600 uppercase">
                        {patObj.gender === 'L' ? 'Laki-Laki' : 'Perempuan'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-wider font-mono">Hasil Kompilasi Synthesizer AI:</h5>
                      {isCompilingDiagnosis ? (
                        <div className="p-10 border border-dashed rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-400">
                          <RefreshCw size={24} className="animate-spin text-indigo-600" />
                          <div className="text-xs font-black uppercase tracking-widest text-slate-600">Menganalisis Seluruh Rekam Medis...</div>
                          <p className="text-[9px] text-slate-400 max-w-sm text-center font-semibold leading-relaxed">
                            Gemini AI sedang membaca diagnosa awal, men-sintesis catatan harian perawat, mencocokkan laporan shift pagi/sore/malam, serta prosedur tindakan operasi tindakan bedah untuk merumuskan hasil diagnosa akhir terintegrasi.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200/60 p-6 rounded-3xl text-xs leading-relaxed text-slate-700 whitespace-pre-wrap font-semibold font-sans">
                          {compiledDiagnosisText || 'Tidak ada hasil kompilasi.'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
              <Button
                onClick={() => {
                  if (compiledDiagnosisPatientId) {
                    handleCompilePatientDiagnosis(compiledDiagnosisPatientId);
                  }
                }}
                disabled={isCompilingDiagnosis}
                className="px-5 py-3 bg-[#144272] hover:bg-[#1f5891] text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={isCompilingDiagnosis ? 'animate-spin' : ''} /> RE-SINTESIS AI
              </Button>
              <Button
                onClick={() => setCompiledDiagnosisPatientId(null)}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-Up Modal: Riwayat Diagnosa Pasien Per & Antar Shift */}
      {historyModalPatientId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-fade-in shadow-2xl">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-[#144272] p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <div>
                  <h4 className="text-xs font-black tracking-widest uppercase">Riwayat Diagnosa Pasien Per Shift</h4>
                  <p className="text-[8.5px] text-slate-300 font-bold uppercase tracking-widest mt-0.5 font-mono">Simantap History Record</p>
                </div>
              </div>
              <button 
                onClick={() => setHistoryModalPatientId(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {(() => {
                const patObj = patients.find(p => p.id === historyModalPatientId);
                if (!patObj) return <div className="text-center text-xs text-slate-400">Pasien tidak ditemukan.</div>;

                const shiftDiagnoses = dailyReports
                  .filter((r) => r.patientId === patObj.id && r.diagnosis && r.diagnosis.trim() !== '')
                  .sort((a,b) => compareDatesSafe(a.date, b.date, false));

                return (
                  <div className="space-y-4">
                    {/* Compact Identity Badge */}
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-slate-800 uppercase tracking-tight">{patObj.name}</div>
                        <div className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">RM: {patObj.noRM} | Ruangan: {patObj.ruangan || '-'} Bed {patObj.nomorBed || '-'}</div>
                      </div>
                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-150 rounded text-[8.5px] font-black text-blue-600 uppercase">
                        {patObj.gender === 'L' ? 'Laki-Laki' : 'Perempuan'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Daftar Rekam Diagnosa Harian:</div>
                      
                      {shiftDiagnoses.length === 0 ? (
                        <div className="text-center p-6 border border-dashed rounded-xl text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          Belum ada riwayat diagnose shift harian untuk pasien ini.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {shiftDiagnoses.map((sd, i) => (
                            <div key={i} className="flex gap-3 items-start bg-slate-50 border border-slate-100 p-3 rounded-lg hover:border-indigo-150 transition-colors">
                              <span className="text-[14px] mt-0.5 shrink-0">📅</span>
                              <div className="space-y-1">
                                <div className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest leading-none">TGL: {sd.date}</div>
                                <div className="text-xs font-bold text-slate-800 leading-normal">{sd.diagnosis}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
              <Button
                onClick={() => setHistoryModalPatientId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-Up Modal: Tarik Pasien Mutasi Kembali */}
      {isRetrievalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-fade-in shadow-2xl">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-emerald-600 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <History size={18} />
                <div>
                  <h4 className="text-xs font-black tracking-widest uppercase">Tarik / Panggil Data Pasien Mutasi Kembali</h4>
                  <p className="text-[8.5px] text-emerald-100 font-bold uppercase tracking-widest mt-0.5 font-mono">Daftar Pasien Berdasarkan Riwayat Unit</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsRetrievalModalOpen(false);
                  setSelectedRetrievalPatient(null);
                  setRetrievalSearch("");
                }}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {(() => {
                const activeUnit = selectedUnit === "Semua Unit" ? (currentUser?.unit || "") : selectedUnit;
                if (!activeUnit) {
                  return (
                    <div className="text-center p-8 text-xs text-slate-400 font-bold uppercase">
                      ⚠️ Silakan pilih unit perawatan terlebih dahulu di filter atas!
                    </div>
                  );
                }

                if (!selectedRetrievalPatient) {
                  return (
                    <div className="space-y-4">
                      {/* Searchbox */}
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text"
                          placeholder="Cari pasien berdasarkan No. RM atau Nama..."
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/25 transition-all focus:bg-white"
                          value={retrievalSearch}
                          onChange={(e) => setRetrievalSearch(e.target.value)}
                        />
                      </div>

                      {/* Candidates list */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Daftar Pasien yang Pernah Dirawat di Unit {activeUnit}:</label>
                        {retrievalCandidates.length === 0 ? (
                          <div className="text-center p-8 border border-dashed rounded-xl text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                            Tidak ada data pasien yang memiliki riwayat di unit ini.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                            {retrievalCandidates.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setSelectedRetrievalPatient(c);
                                  // Auto set values from the masterData
                                  const classes = masterData.unitToClasses[activeUnit] || [];
                                  const autoClass = classes.length === 1 ? classes[0] : (c.kelasRawat || "");
                                  let autoRoom = "";
                                  if (autoClass) {
                                    const rooms = masterData.classToRooms[`${activeUnit} - ${autoClass}`] || [];
                                    autoRoom = rooms.length === 1 ? rooms[0] : (c.ruangan || "");
                                  }
                                  setRetrievalClass(autoClass);
                                  setRetrievalRoom(autoRoom);
                                  setRetrievalBed(c.nomorBed || "");
                                }}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all text-left group"
                              >
                                <div>
                                  <div className="text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-emerald-700 transition-colors">{c.name}</div>
                                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">RM: {c.noRM} | Jenis Kelamin: {c.gender === 'L' ? 'L' : 'P'}</div>
                                  <div className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest mt-0.5">MRS Terakhir: {c.entryDate} | Unit: {c.unitTujuan}</div>
                                </div>
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[9px] rounded-lg border border-emerald-100 uppercase group-hover:bg-emerald-600 group-hover:text-white transition-all">Pilih Pasien</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // If patient is selected, show admission form
                const roomBeds = masterData.roomToBeds[retrievalRoom] || [];
                const activeOccupants = doubleBookedMap[`${String(retrievalRoom).trim().toUpperCase()}_${String(retrievalBed).trim().toUpperCase()}`] || [];
                const isBedOccupied = activeOccupants.length > 0;

                return (
                  <div className="space-y-5 animate-fade-in">
                    {/* Selected Patient Identity Banner */}
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex justify-between items-center">
                      <div>
                        <div className="text-sm font-black text-emerald-800 uppercase tracking-tight">{selectedRetrievalPatient.name}</div>
                        <div className="text-[9px] text-emerald-600 font-bold tracking-wider mt-0.5 uppercase">RM: {selectedRetrievalPatient.noRM} | TGL LAHIR: {selectedRetrievalPatient.birthDate || '-'} | CARA BAYAR: {selectedRetrievalPatient.paymentMethod?.join(', ') || '-'}</div>
                      </div>
                      <button 
                        onClick={() => setSelectedRetrievalPatient(null)}
                        className="text-xs font-black text-slate-400 hover:text-rose-650 uppercase tracking-wider"
                      >
                        Ganti Pasien
                      </button>
                    </div>

                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Form Panggilan Rawat Kembali (Unit {activeUnit}):</div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tanggal Masuk Baru</label>
                        <input
                          type="date"
                          className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                          value={retrievalDate}
                          onChange={(e) => setRetrievalDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Jam Masuk Baru</label>
                        <input
                          type="time"
                          className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                          value={retrievalTime}
                          onChange={(e) => setRetrievalTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Kelas</label>
                        <select
                          className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-white outline-none focus:border-emerald-500 text-slate-700"
                          value={retrievalClass}
                          onChange={(e) => {
                            const val = e.target.value;
                            const rooms = masterData.classToRooms[`${activeUnit} - ${val}`] || [];
                            const autoRoom = rooms.length === 1 ? rooms[0] : "";
                            setRetrievalClass(val);
                            setRetrievalRoom(autoRoom);
                            setRetrievalBed("");
                          }}
                        >
                          <option value="">-- Pilih --</option>
                          {(masterData.unitToClasses[activeUnit] || []).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ruangan</label>
                        <select
                          disabled={!retrievalClass}
                          className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-white outline-none focus:border-emerald-500 disabled:opacity-50 text-slate-700"
                          value={retrievalRoom}
                          onChange={(e) => {
                            const val = e.target.value;
                            const beds = masterData.roomToBeds[val] || [];
                            const autoBed = beds.length === 1 ? beds[0] : "";
                            setRetrievalRoom(val);
                            setRetrievalBed(autoBed);
                          }}
                        >
                          <option value="">-- Pilih --</option>
                          {(masterData.classToRooms[`${activeUnit} - ${retrievalClass}`] || []).map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">No. Bed</label>
                        <select
                          disabled={!retrievalRoom}
                          className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-white outline-none focus:border-emerald-500 disabled:opacity-50 text-slate-700"
                          value={retrievalBed}
                          onChange={(e) => setRetrievalBed(e.target.value)}
                        >
                          <option value="">-- Pilih --</option>
                          {roomBeds.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isBedOccupied && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-black rounded-xl uppercase tracking-wider flex items-center gap-2">
                        <span>⚠️ PERINGATAN: Bed ini sedang ditempati oleh pasien aktif lainnya!</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsRetrievalModalOpen(false);
                  setSelectedRetrievalPatient(null);
                  setRetrievalSearch("");
                }}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-[9px] font-black uppercase rounded-lg hover:bg-slate-100"
              >
                Batal
              </Button>
              {selectedRetrievalPatient && (
                <button
                  onClick={handleConfirmRetrieval}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <UserCheck size={12} /> Panggil & Aktifkan Kembali
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pop-Up Modal: Registrasi Pasien Pernah Dirawat */}
      {isRegisterOldModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-fade-in shadow-2xl">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-blue-600 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <UserPlus size={18} />
                <div>
                  <h4 className="text-xs font-black tracking-widest uppercase">Registrasi Pasien Pernah Dirawat (Penerimaan Baru)</h4>
                  <p className="text-[8.5px] text-blue-100 font-bold uppercase tracking-widest mt-0.5 font-mono">Admission Pasien Riwayat Lama / Re-Admission</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsRegisterOldModalOpen(false);
                  setRegisterOldRMInput("");
                  setFoundOldPatient(null);
                  setRegOldClass("");
                  setRegOldRoom("");
                  setRegOldBed("");
                  setRegOldDPJP("");
                  setRegOldPayment([]);
                }}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {(() => {
                const activeUnit = selectedUnit === "Semua Unit" ? (currentUser?.unit || "") : selectedUnit;
                const filteredDoctorsForRegOld = masterData.doctors.filter(d => 
                  d.toLowerCase().includes(regOldDpjpSearch.toLowerCase())
                );
                if (!activeUnit) {
                  return (
                    <div className="text-center p-8 text-xs text-slate-400 font-bold uppercase">
                      ⚠️ Silakan pilih unit perawatan terlebih dahulu di filter atas!
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* No RM Search Box */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
                        Langkah 1: Masukkan Nomor Rekam Medis (RM) Pasien
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input
                            type="text"
                            placeholder="Contoh: RM-12345..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/25 transition-all"
                            value={registerOldRMInput}
                            onChange={(e) => setRegisterOldRMInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSearchOldPatient();
                              }
                            }}
                          />
                        </div>
                        <button
                          onClick={handleSearchOldPatient}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl transition-all active:scale-95 font-sans"
                        >
                          Cari RM
                        </button>
                      </div>
                    </div>

                    {foundOldPatient ? (
                      <div className="space-y-4 animate-fade-in">
                        {/* Identity Auto-Fill Display */}
                        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl space-y-2">
                          <div className="flex justify-between items-center border-b border-blue-100 pb-2">
                            <span className="text-[9px] font-black text-blue-700 uppercase tracking-widest font-mono">✓ Identitas Pasien Ditemukan (Auto-Fill)</span>
                            <span className="text-[10px] font-black text-slate-600 bg-white border px-2 py-0.5 rounded-md font-mono">RM: {foundOldPatient.noRM}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                            <div><span className="font-bold text-slate-400">Nama Pasien:</span> <span className="font-extrabold text-slate-800 uppercase">{foundOldPatient.name}</span></div>
                            <div><span className="font-bold text-slate-400">Gender:</span> <span className="font-extrabold text-slate-800 uppercase">{foundOldPatient.gender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}</span></div>
                            <div><span className="font-bold text-slate-400">Tgl Lahir:</span> <span className="font-extrabold text-slate-800">{foundOldPatient.birthDate || '-'}</span></div>
                            <div><span className="font-bold text-slate-400">Alamat:</span> <span className="font-extrabold text-slate-800 uppercase truncate block" title={foundOldPatient.address}>{foundOldPatient.address || '-'}</span></div>
                          </div>
                        </div>

                        {/* New Admission Data Section */}
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Langkah 2: Lengkapi Data Admisi Baru (New Admission Record)</div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">No. Register Baru</label>
                            <input
                              type="text"
                              className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-800 outline-none font-mono focus:border-blue-500"
                              value={generatedRegNo}
                              onChange={(e) => setGeneratedRegNo(e.target.value)}
                            />
                          </div>
                          <div className="relative font-sans" ref={regOldOriginDropdownRef}>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Asal Masuk</label>
                            <div 
                              onClick={() => setIsRegOldOriginDropdownOpen(!isRegOldOriginDropdownOpen)}
                              className="w-full border-2 border-slate-100 rounded-xl p-2.5 bg-white cursor-pointer flex items-center justify-between text-xs font-bold text-slate-700 min-h-[38px]"
                            >
                              <span className="truncate">{regOldOrigin || "-- Pilih Asal Masuk --"}</span>
                              <ChevronDown size={14} className="text-slate-400 shrink-0"/>
                            </div>

                            {isRegOldOriginDropdownOpen && (
                              <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl z-[320] overflow-hidden flex flex-col max-h-48">
                                <div className="p-2 border-b bg-slate-50">
                                  <div className="relative">
                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input 
                                      autoFocus
                                      type="text"
                                      placeholder="Cari Asal Masuk..."
                                      className="w-full pl-8 pr-2 py-1.5 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                      value={regOldOriginSearch}
                                      onChange={e => setRegOldOriginSearch(e.target.value)}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                                <div className="overflow-y-auto custom-scrollbar max-h-36">
                                  {(masterData.refs?.asalMasuk || ["IGD", "Poliklinik", "Rujukan RS Lain", "Rujukan Puskesmas", "Rujukan Dokter"])
                                    .filter(o => o.toLowerCase().includes(regOldOriginSearch.toLowerCase()))
                                    .map(o => {
                                      const isSelected = regOldOrigin === o;
                                      return (
                                        <div 
                                          key={o}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRegOldOrigin(o);
                                            setIsRegOldOriginDropdownOpen(false);
                                            setRegOldOriginSearch("");
                                          }}
                                          className={`px-3 py-2 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
                                            isSelected 
                                            ? 'bg-blue-50 text-blue-700' 
                                            : 'hover:bg-slate-50 text-slate-600'
                                          }`}
                                        >
                                          <span>{o}</span>
                                          {isSelected && <Check size={12} className="text-blue-600 stroke-[3px]" />}
                                        </div>
                                      );
                                    })
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tanggal Masuk Baru</label>
                            <input
                              type="date"
                              className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500"
                              value={regOldDate}
                              onChange={(e) => setRegOldDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Jam Masuk Baru</label>
                            <input
                              type="time"
                              className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500"
                              value={regOldTime}
                              onChange={(e) => setRegOldTime(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Kelas</label>
                            <select
                              className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-white outline-none focus:border-blue-500 text-slate-700"
                              value={regOldClass}
                              onChange={(e) => {
                                const val = e.target.value;
                                const rooms = masterData.classToRooms[`${activeUnit} - ${val}`] || [];
                                const autoRoom = rooms.length === 1 ? rooms[0] : "";
                                setRegOldClass(val);
                                setRegOldRoom(autoRoom);
                                setRegOldBed("");
                              }}
                            >
                              <option value="">-- Pilih --</option>
                              {(masterData.unitToClasses[activeUnit] || []).map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ruangan</label>
                            <select
                              disabled={!regOldClass}
                              className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-white outline-none focus:border-blue-500 disabled:opacity-50 text-slate-700"
                              value={regOldRoom}
                              onChange={(e) => {
                                const val = e.target.value;
                                const beds = masterData.roomToBeds[val] || [];
                                const autoBed = beds.length === 1 ? beds[0] : "";
                                setRegOldRoom(val);
                                setRegOldBed(autoBed);
                              }}
                            >
                              <option value="">-- Pilih --</option>
                              {(masterData.classToRooms[`${activeUnit} - ${regOldClass}`] || []).map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">No. Bed</label>
                            <select
                              disabled={!regOldRoom}
                              className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-white outline-none focus:border-blue-500 disabled:opacity-50 text-slate-700"
                              value={regOldBed}
                              onChange={(e) => setRegOldBed(e.target.value)}
                            >
                              <option value="">-- Pilih --</option>
                              {(masterData.roomToBeds[regOldRoom] || []).map((b) => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* DPJP Utama Baru Searchable Dropdown */}
                          <div className="relative font-sans" ref={regOldDpjpDropdownRef}>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">DPJP Utama Baru</label>
                            <div 
                              onClick={() => setIsRegOldDpjpDropdownOpen(!isRegOldDpjpDropdownOpen)}
                              className="w-full border-2 border-slate-100 rounded-xl p-2.5 bg-white cursor-pointer flex items-center justify-between text-xs font-bold text-slate-700 min-h-[38px]"
                            >
                              <span className="truncate">{regOldDPJP || "-- Pilih DPJP Utama --"}</span>
                              <ChevronDown size={14} className="text-slate-400 shrink-0"/>
                            </div>

                            {isRegOldDpjpDropdownOpen && (
                              <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl z-[320] overflow-hidden flex flex-col max-h-48">
                                <div className="p-2 border-b bg-slate-50">
                                  <div className="relative">
                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input 
                                      autoFocus
                                      type="text"
                                      placeholder="Cari nama DPJP..."
                                      className="w-full pl-8 pr-2 py-1.5 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                      value={regOldDpjpSearch}
                                      onChange={e => setRegOldDpjpSearch(e.target.value)}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                                <div className="overflow-y-auto custom-scrollbar max-h-36">
                                  {filteredDoctorsForRegOld.length > 0 ? filteredDoctorsForRegOld.map(doc => {
                                    const isSelected = regOldDPJP === doc;
                                    return (
                                      <div 
                                        key={doc}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRegOldDPJP(doc);
                                          setIsRegOldDpjpDropdownOpen(false);
                                          setRegOldDpjpSearch("");
                                        }}
                                        className={`px-3 py-2 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
                                          isSelected 
                                          ? 'bg-blue-50 text-blue-700' 
                                          : 'hover:bg-slate-50 text-slate-600'
                                        }`}
                                      >
                                        <span>{doc}</span>
                                        {isSelected && <Check size={12} className="text-blue-600 stroke-[3px]" />}
                                      </div>
                                    );
                                  }) : (
                                    <div className="p-3 text-center text-[10px] font-bold text-slate-400 italic">Tidak ditemukan.</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cara Bayar</label>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {(masterData.refs?.caraBayar || ["BPJS", "UMUM", "ASURANSI SWASTA"]).map((cb) => {
                                const isSelected = regOldPayment.includes(cb);
                                return (
                                  <button
                                    key={cb}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setRegOldPayment(regOldPayment.filter(x => x !== cb));
                                      } else {
                                        setRegOldPayment([...regOldPayment, cb]);
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${
                                      isSelected 
                                        ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" 
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                    }`}
                                  >
                                    {cb}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Optional SEP input if BPJS is selected */}
                        {regOldPayment.includes("BPJS") && (
                          <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50/40 rounded-2xl border border-blue-100 animate-fade-in">
                            <div>
                              <label className="block text-[9px] font-black text-blue-800 uppercase tracking-widest mb-1.5 font-mono">Nomor SEP (BPJS)</label>
                              <input
                                type="text"
                                placeholder="Masukkan No. SEP..."
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500 bg-white"
                                value={regOldNoSEP}
                                onChange={(e) => setRegOldNoSEP(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-blue-800 uppercase tracking-widest mb-1.5 font-mono">Status SEP</label>
                              <select
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-white outline-none focus:border-blue-500 text-slate-700"
                                value={regOldStatusSEP}
                                onChange={(e) => setRegOldStatusSEP(e.target.value)}
                              >
                                <option value="Belum Terbit">Belum Terbit</option>
                                <option value="Sudah Terbit">Sudah Terbit</option>
                                <option value="Gagal Terbit">Gagal Terbit</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {regOldRoom && regOldBed && (doubleBookedMap[`${String(regOldRoom).trim().toUpperCase()}_${String(regOldBed).trim().toUpperCase()}`] || []).length > 0 && (
                          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-black rounded-xl uppercase tracking-wider">
                            ⚠️ PERINGATAN: Bed ini sedang ditempati oleh pasien aktif lainnya! Harap pilih bed lain.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsRegisterOldModalOpen(false);
                  setRegisterOldRMInput("");
                  setFoundOldPatient(null);
                  setRegOldClass("");
                  setRegOldRoom("");
                  setRegOldBed("");
                  setRegOldDPJP("");
                  setRegOldPayment([]);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-[9px] font-black uppercase rounded-lg hover:bg-slate-100"
              >
                Batal
              </Button>
              {foundOldPatient && (
                <button
                  onClick={handleConfirmRegisterOld}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <UserPlus size={12} /> Daftarkan Pasien (Admisi Baru)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pop-Up Modal: Kelola DPJP / Raberan Pasien (Overhauled) */}
      {isDpjpModalOpen && (() => {
        const pat = patients.find(p => p.id === dpjpModalPatientId);
        if (!pat) return null;

        const primaryDoc = pat.dpjpList?.[0] || "";
        const coDocs = pat.dpjpList?.slice(1) || [];
        const doctorsFiltered = masterData.doctors.filter(d => 
          d.toLowerCase().includes(dpjpModalSearch.toLowerCase())
        );

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-fade-in shadow-2xl">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="bg-[#144272] p-5 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <HeartHandshake size={18} />
                  <div>
                    <h4 className="text-xs font-black tracking-widest uppercase font-sans">Manajemen Komposisi DPJP & Raberan</h4>
                    <p className="text-[8.5px] text-blue-100 font-bold uppercase tracking-widest mt-0.5 font-mono">
                      {pat.name} | No. RM: {pat.noRM} | {pat.unitTujuan} ({pat.ruangan || "-"} / Bed {pat.nomorBed || "-"})
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDpjpModalOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                
                {/* 1. DPJP Utama (Primary) Card */}
                <div className="space-y-2 font-sans">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">DPJP UTAMA (Primary Physician)</span>
                  {primaryDoc ? (
                    <div className="bg-emerald-50/75 border border-emerald-200 p-4 rounded-2xl flex justify-between items-center shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="bg-[#005B60] text-white p-2 rounded-xl flex items-center justify-center">
                          <Check size={14} className="stroke-[3px]" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-[#005B60] uppercase tracking-wide">{primaryDoc}</p>
                          <p className="text-[8px] font-bold text-emerald-700 uppercase tracking-widest mt-0.5">Penanggung Jawab Utama Pelayanan</p>
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => {
                            setIsDpjpModalDropdownOpen(!isDpjpModalDropdownOpen);
                            setDpjpModalSearch("");
                          }}
                          className="px-3.5 py-1.5 bg-white border border-emerald-300 hover:border-emerald-500 text-emerald-800 text-[9px] font-black uppercase rounded-lg transition-all cursor-pointer"
                        >
                          Ganti Utama
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-center space-y-2">
                      <p className="text-xs font-bold text-rose-800">⚠️ DPJP UTAMA BELUM DITENTUKAN!</p>
                      <button
                        onClick={() => {
                          setIsDpjpModalDropdownOpen(true);
                          setDpjpModalSearch("");
                        }}
                        className="px-4 py-2 bg-rose-600 text-white text-[9px] font-black uppercase rounded-lg shadow-sm cursor-pointer"
                      >
                        Set DPJP Utama
                      </button>
                    </div>
                  )}

                  {/* Dropdown for Changing Primary DPJP */}
                  {isDpjpModalDropdownOpen && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 animate-fade-in space-y-2">
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 border border-slate-200 rounded-xl">
                        <Search size={12} className="text-slate-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Cari Dokter Spesialis..."
                          className="w-full bg-transparent text-[11px] font-bold text-slate-800 outline-none border-none p-0 focus:ring-0"
                          value={dpjpModalSearch}
                          onChange={(e) => setDpjpModalSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-150 rounded-xl">
                        {doctorsFiltered.length > 0 ? (
                          doctorsFiltered.map(d => {
                            const isCurrentPrimary = d === primaryDoc;
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => {
                                  handleUpdatePrimaryDpjp(d);
                                  setIsDpjpModalDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase transition-all flex justify-between items-center cursor-pointer ${
                                  isCurrentPrimary 
                                    ? "bg-emerald-50 text-emerald-800 cursor-not-allowed" 
                                    : "text-slate-700 hover:bg-slate-50"
                                }`}
                                disabled={isCurrentPrimary}
                              >
                                <span>{d}</span>
                                {isCurrentPrimary && <span className="text-[7.5px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">UTAMA</span>}
                              </button>
                            );
                          })
                        ) : (
                          <p className="p-3 text-center text-[9px] text-slate-400 font-bold italic">Dokter tidak ditemukan.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Co-DPJP / Raberan List */}
                <div className="space-y-3 font-sans">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">CO-DPJP / RABERAN (Consultant & Joint Care)</span>
                    <button
                      onClick={() => {
                        setIsDpjpModalDropdownOpen(false);
                        setIsRaberanAddOpen(!isRaberanAddOpen);
                        setRaberanSearch("");
                        setSelectedRaberanDocs([]);
                      }}
                      className="px-3 py-1 bg-[#144272] hover:bg-blue-800 text-white text-[8px] font-black uppercase rounded-md transition-colors cursor-pointer"
                    >
                      {isRaberanAddOpen ? "Tutup Panel Tambah" : "+ Tambah Raberan (Multi-Select)"}
                    </button>
                  </div>

                  {isRaberanAddOpen && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 animate-fade-in space-y-3">
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 border border-slate-200 rounded-xl">
                        <Search size={12} className="text-slate-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Cari Dokter Raberan Baru..."
                          className="w-full bg-transparent text-[11px] font-bold text-slate-800 outline-none border-none p-0 focus:ring-0"
                          value={raberanSearch}
                          onChange={(e) => setRaberanSearch(e.target.value)}
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl p-1 custom-scrollbar">
                        {masterData.doctors
                          .filter(d => d.toLowerCase().includes(raberanSearch.toLowerCase()))
                          .map(d => {
                            const isAlreadyDjp = (pat.dpjpList || []).includes(d);
                            const isChecked = selectedRaberanDocs.includes(d);

                            return (
                              <label
                                key={d}
                                className={`flex items-center justify-between p-2 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                  isAlreadyDjp
                                    ? "opacity-40 bg-slate-50 cursor-not-allowed text-slate-400"
                                    : "text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    disabled={isAlreadyDjp}
                                    checked={isAlreadyDjp || isChecked}
                                    onChange={() => {
                                      if (isAlreadyDjp) return;
                                      if (isChecked) {
                                        setSelectedRaberanDocs(selectedRaberanDocs.filter(x => x !== d));
                                      } else {
                                        setSelectedRaberanDocs([...selectedRaberanDocs, d]);
                                      }
                                    }}
                                  />
                                  <span>{d}</span>
                                </div>
                                {isAlreadyDjp && (
                                  <span className="text-[7px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">TERDAFTAR</span>
                                )}
                              </label>
                            );
                          })
                        }
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsRaberanAddOpen(false);
                            setSelectedRaberanDocs([]);
                          }}
                          className="px-3 py-1.5 border border-slate-200 text-slate-600 text-[9px] font-bold uppercase rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={selectedRaberanDocs.length === 0}
                          onClick={() => {
                            handleAddMultipleCoDpjp(selectedRaberanDocs);
                            setIsRaberanAddOpen(false);
                            setSelectedRaberanDocs([]);
                          }}
                          className="px-3.5 py-1.5 bg-[#144272] text-white text-[9px] font-black uppercase rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        >
                          Tambahkan ({selectedRaberanDocs.length}) Dokter
                        </button>
                      </div>
                    </div>
                  )}

                  {coDocs.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden bg-white">
                      {coDocs.map((doc, cIdx) => {
                        const originalIdx = cIdx + 1; // index in pat.dpjpList
                        return (
                          <div key={doc} className="p-3.5 flex justify-between items-center hover:bg-slate-50/50 transition-all">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-mono font-black text-[9px] border border-indigo-100 shrink-0">
                                {cIdx + 1}
                              </span>
                              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">{doc}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSwapToPrimary(originalIdx)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200/50 text-amber-900 text-[8px] font-black uppercase rounded-lg transition-all cursor-pointer"
                              >
                                Jadikan Utama
                              </button>
                              <button
                                onClick={() => handleRemoveDpjpIdx(originalIdx)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-800 text-[8px] font-black uppercase rounded-lg transition-all cursor-pointer"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 border-2 border-dashed border-slate-150 rounded-2xl text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Belum ada Co-DPJP (Raberan) terdaftar.</p>
                    </div>
                  )}
                </div>

                {/* 3. DPJP History Sub-Panel */}
                <div className="space-y-2 pt-4 border-t border-slate-150 font-sans">
                  <span className="text-[9px] font-black uppercase text-[#144272] tracking-wider block">TIMELINE HISTORI PERUBAHAN DPJP</span>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 max-h-48 overflow-y-auto custom-scrollbar">
                    {pat.dpjpHistory && pat.dpjpHistory.length > 0 ? (
                      <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4">
                        {pat.dpjpHistory.map((h, hIdx) => (
                          <div key={hIdx} className="relative">
                            {/* Dot indicator */}
                            <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-[#144272] border border-white shadow-sm" />
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] font-mono font-black text-slate-400">{h.date}</span>
                                <span className="text-[8px] bg-slate-200 text-slate-700 font-extrabold px-1.5 py-0.2 rounded uppercase">{h.user}</span>
                              </div>
                              <p className="text-[9.5px] font-bold text-slate-700 normal-case leading-relaxed">{h.log}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2 text-center">
                        <p className="text-[9.5px] text-slate-400 font-bold italic">Belum ada log riwayat perubahan DPJP.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
                <Button
                  variant="secondary"
                  onClick={() => setIsDpjpModalOpen(false)}
                  className="px-5 py-2 border border-slate-200 text-slate-700 text-[10px] font-black uppercase rounded-lg hover:bg-slate-100"
                >
                  Selesai & Tutup
                </Button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
});
