import React, { useState } from "react";
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
  History,
  Copy,
  Edit,
  Pill,
  User,
  Stethoscope,
  X,
  Search,
} from "lucide-react";
import {
  Patient,
  DailyReportEntry,
  MasterData,
  DependencyLevel,
  User as UserType,
} from "../../types";
import { Button } from "../Button";

interface ServiceMatrixProps {
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  masterData: MasterData;
  onAddPatient: () => void;
  onUpdateReport: (
    patientId: string,
    type: keyof DailyReportEntry,
    content: any,
    date?: string,
  ) => void;
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

  const assistantDoctors = (masterData.doctors || []).filter((d: string) => 
    masterData.doctorMetadata[d]?.ksm === 'Umum'
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

export const ServiceMatrix: React.FC<ServiceMatrixProps> = ({
  patients,
  dailyReports,
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
}) => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedUnit, setSelectedUnit] = useState(
    currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "BIDANG"
      ? "Semua Unit"
      : currentUser?.unit || "Semua Unit",
  );
  const [selectedPPJA, setSelectedPPJA] = useState("Semua PPJA");
  const [selectedDPJP, setSelectedDPJP] = useState("Semua DPJP");
  const [selectedStatus, setSelectedStatus] = useState("Masih Dirawat");
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
  } | null>(null);
  const [editingEntry, setEditingEntry] = useState<{
    patientId: string;
    type: keyof DailyReportEntry;
    tempDiagnosis?: string;
    tempTherapy?: string;
    tempReport?: string;
  } | null>(null);
  const [editingSurgery, setEditingSurgery] = useState<string | null>(null);
  const [editingAdminNote, setEditingAdminNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nurseSearch, setNurseSearch] = useState("");
  const [isNurseDropdownOpen, setIsNurseDropdownOpen] = useState(false);
  const [activeNurseSelectId, setActiveNurseSelectId] = useState<string | null>(
    null,
  );
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

  const filteredPatients = patients.filter((p) => {
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
    if (selectedUnit !== "Semua Unit" && normalize(p.unitTujuan) !== normalize(selectedUnit) && normalize(p.ruangan) !== normalize(selectedUnit))
      return false;
    if (selectedPPJA !== "Semua PPJA" && p.perawatPrimer !== selectedPPJA)
      return false;
    if (
      selectedDPJP !== "Semua DPJP" &&
      !(p.dpjpList || []).includes(selectedDPJP)
    )
      return false;
    if (
      selectedStatus !== "Semua Status" &&
      p.statusDataPasien !== selectedStatus
    ) {
      // Show "Dipindah ke Ruangan Lain" and "Pindah Ruangan" also as active if selectedStatus is "Masih Dirawat"
      if (selectedStatus === "Masih Dirawat") {
          if (p.statusDataPasien !== "Dipindah ke Ruangan Lain" && p.statusDataPasien !== "Pindah Ruangan") {
              return false;
          }
      } else {
          return false;
      }
    }
    return true;
  });

  const getReportForPatient = (patientId: string) => {
    return dailyReports.find(
      (r) => r.patientId === patientId && r.date === selectedDate,
    );
  };

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

    const currentReport = getReportForPatient(editingEntry.patientId);
    const shiftPrefix = editingEntry.type.replace("Report", "");
    const currentLevel = (currentReport as any)?.[`${shiftPrefix}Dependency`];
    const currentRecorder = (currentReport as any)?.[
      `${shiftPrefix}RecordedBy`
    ];

    if (!currentLevel) {
      setError("Wajib mengisi Tingkat Ketergantungan!");
      return;
    }

    if (!currentRecorder) {
      setError("Wajib mengisi Pembuat Laporan!");
      return;
    }

    // Explicitly save all fields from modal
    onUpdateReport(
      editingEntry.patientId,
      "diagnosis",
      editingEntry.tempDiagnosis,
      selectedDate,
    );
    onUpdateReport(
      editingEntry.patientId,
      `${shiftPrefix}Therapy` as any,
      editingEntry.tempTherapy,
      selectedDate,
    );
    onUpdateReport(
      editingEntry.patientId,
      `${shiftPrefix}Report` as any,
      editingEntry.tempReport,
      selectedDate,
    );

    setError(null);
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
        });
      }}
      className={`w-full min-w-[200px] min-h-[160px] border-2 ${content || therapy ? 'border-indigo-200 bg-indigo-50/30' : 'border-dashed border-slate-200'} rounded-2xl flex flex-col p-4 cursor-pointer transition-all hover:bg-${color}-50 hover:border-${color}-300 group relative overflow-hidden`}
    >
      <div className="flex justify-between items-start mb-2">
        <span
          className={`text-[8px] font-black uppercase tracking-widest text-${color}-600`}
        >
          SHIFT {label}
        </span>
        {getDepLabel(shift, report)}
      </div>

      <div className="space-y-2 flex-1">
        {content ? (
          <p className="text-[10px] text-slate-600 font-medium leading-relaxed italic border-l-2 border-indigo-100 pl-2">
            <FileText size={10} className="inline mr-1 opacity-50" /> {content}
          </p>
        ) : (
          <div className="text-[8px] font-black uppercase tracking-widest text-slate-300">
            Laporan Kosong
          </div>
        )}

        {therapy && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[9px] text-emerald-600 font-bold leading-tight">
              <Pill size={10} className="inline mr-1" /> {therapy}
            </p>
          </div>
        )}
      </div>

      {!content && !therapy && (
        <div className="flex flex-col items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity gap-1 py-4">
          <Plus size={14} className={`text-${color}-500`} />
          <span className="text-[8px] font-black uppercase tracking-widest">
            Entry Lap
          </span>
        </div>
      )}

      {report && (report as any)[`${shift}RecordedBy`] && (
        <div className="absolute bottom-2 right-4 text-[7px] font-black text-slate-400 uppercase tracking-widest">
          By: {(report as any)[`${shift}RecordedBy`]}
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
                .sort((a, b) => b.date.localeCompare(a.date))
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
                                          tempReport: content || ""
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
                              <p className="text-[10px] text-slate-700 font-medium leading-relaxed italic mb-2 border-b border-white pb-2">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl animate-fade-in border-t-8 border-indigo-600 max-h-[96vh] w-full max-w-6xl flex flex-col md:flex-row overflow-hidden relative">
            <button 
              onClick={() => setEditingEntry(null)}
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 z-[220]"
            >
              <ChevronDown size={24} className="rotate-180" />
            </button>
            <div className="flex-1 p-8 md:p-10 overflow-y-auto custom-scrollbar border-r border-slate-100 min-h-0 bg-white">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                    Entri Laporan Shift
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Pasien: {patients.find(p => p.id === editingEntry.patientId)?.name}
                  </p>
                </div>
              </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  Tingkat Ketergantungan <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["MINIMAL", "PARSIAL", "TOTAL"] as DependencyLevel[]).map(
                    (lvl, i) => {
                      const currentReport = getReportForPatient(
                        editingEntry.patientId,
                      );
                      const shiftPrefix = editingEntry.type.replace(
                        "Report",
                        "",
                      );
                      const currentLevel = (currentReport as any)?.[
                        `${shiftPrefix}Dependency`
                      ];
                      return (
                        <button
                          key={`${lvl}-${i}`}
                          onClick={() => {
                            onUpdateDependency?.(
                              editingEntry.patientId,
                              shiftPrefix as any,
                              lvl,
                            );
                            setError(null);
                          }}
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
                        {(getReportForPatient(editingEntry.patientId) as any)?.[
                          `${editingEntry.type.replace("Report", "")}RecordedBy`
                        ] || "-- Pilih Perawat --"}
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
                          {sortedNurses.length > 0 ? (
                            sortedNurses.map((n, nIdx) => (
                              <div
                                key={`nurse-${n}-${nIdx}`}
                                onClick={() => {
                                  onUpdateReport(
                                    editingEntry.patientId,
                                    `${editingEntry.type.replace("Report", "")}RecordedBy` as any,
                                    n,
                                    selectedDate,
                                  );
                                  setIsNurseDropdownOpen(false);
                                  setNurseSearch("");
                                  setError(null);
                                }}
                                className={`px-4 py-3 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
                                  (
                                    getReportForPatient(
                                      editingEntry.patientId,
                                    ) as any
                                  )?.[
                                    `${editingEntry.type.replace("Report", "")}RecordedBy`
                                  ] === n
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
                        
                        // 1. Try to find report from PREVIOUS SHIFT on SAME DAY
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

                        // 2. If nothing on same day (or it's Morning), find from PREVIOUS DATE
                        if (!prevContent && !prevTherapy) {
                          const prevDayReport = dailyReports
                            .filter(
                              (r) =>
                                r.patientId === editingEntry.patientId &&
                                r.date < selectedDate,
                            )
                            .sort((a, b) => b.date.localeCompare(a.date))[0];

                          if (prevDayReport) {
                            // If recording Morning, copy from yesterday's Night
                            if (shift === "morning") {
                                prevContent = prevDayReport.nightReport || "";
                                prevTherapy = prevDayReport.nightTherapy || "";
                                prevRecorder = prevDayReport.nightRecordedBy || "";
                                prevDep = prevDayReport.nightDependency || "";
                            } else {
                                // Default back to same-shift from yesterday if available
                                prevContent = (prevDayReport as any)[editingEntry.type] || "";
                                prevTherapy = (prevDayReport as any)[`${shift}Therapy`] || "";
                                prevRecorder = (prevDayReport as any)[`${shift}RecordedBy`] || "";
                                prevDep = (prevDayReport as any)[`${shift}Dependency`] || "";
                            }
                          }
                        }

                        if (prevContent) {
                          onUpdateReport(
                            editingEntry.patientId,
                            editingEntry.type,
                            prevContent,
                            selectedDate,
                          );
                          setEditingEntry({
                            ...editingEntry,
                            tempReport: prevContent,
                          });
                        }
                        if (prevTherapy) {
                          onUpdateReport(
                            editingEntry.patientId,
                            `${shift}Therapy` as any,
                            prevTherapy,
                            selectedDate,
                          );
                          setEditingEntry({
                            ...editingEntry,
                            tempTherapy: prevTherapy,
                          });
                        }
                        if (prevRecorder)
                          onUpdateReport(
                            editingEntry.patientId,
                            `${shift}RecordedBy` as any,
                            prevRecorder,
                            selectedDate,
                          );
                        if (prevDep)
                          onUpdateDependency?.(
                            editingEntry.patientId,
                            shift as any,
                            prevDep,
                            selectedDate,
                          );
                      }}
                      className="bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200"
                    >
                      Copy Prev
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Diagnosa Medis (Update Shift Ini)
                </label>
                <input
                  type="text"
                  className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                  placeholder="Diagnosa saat ini..."
                  value={editingEntry.tempDiagnosis || ""}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      tempDiagnosis: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Terapi / Instruksi Medis
                </label>
                <textarea
                  className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-emerald-500 outline-none min-h-[80px] bg-emerald-50/20"
                  placeholder="Masukkan daftar obat, dosis, atau instruksi khusus..."
                  value={editingEntry.tempTherapy || ""}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      tempTherapy: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Catatan Pelayanan (Laporan)
                </label>
                <textarea
                  className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-indigo-500 outline-none min-h-[250px] leading-relaxed shadow-inner"
                  placeholder="Masukkan detail implementasi keperawatan..."
                  value={editingEntry.tempReport || ""}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      tempReport: e.target.value,
                    })
                  }
                />
              </div>
              </div>

              {error && (
                <div className="mt-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-[11px] font-black uppercase tracking-widest animate-shake">
                  <AlertCircle size={18} /> {error}
                </div>
              )}

              <div className="mt-10 flex flex-wrap gap-4 sticky bottom-0 bg-white py-4 border-t border-slate-50 z-[210]">
                <Button
                  variant="ghost"
                  onClick={() => setEditingEntry(null)}
                  className="px-6 py-4 rounded-2xl font-black uppercase tracking-widest bg-slate-100 text-slate-600 border-none hover:bg-slate-200"
                >
                  Batal
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingEntry({
                      ...editingEntry,
                      tempReport: "",
                      tempTherapy: "",
                      tempDiagnosis: "",
                    });
                  }}
                  className="px-6 py-4 rounded-2xl font-black uppercase tracking-widest border-2 border-amber-500/20 text-amber-600 hover:bg-amber-50"
                >
                  Bersihkan
                </Button>
                <Button
                  onClick={handleSaveShiftReport}
                  className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest bg-indigo-600 text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
                >
                  Selesai & Simpan
                </Button>
              </div>
            </div>

            {/* Right side: History (Riwayat Laporan Sebelumnya) */}
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
                  .filter(r => r.patientId === editingEntry.patientId && r.date <= selectedDate)
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((r, rIdx) => {
                    const shifts = ['night', 'afternoon', 'morning'];
                    const availableShifts = shifts.filter(shift => {
                      if (r.date === selectedDate && editingEntry.type === `${shift}Report`) return false;
                      return (r as any)[`${shift}Report`] || (r as any)[`${shift}Therapy`];
                    });

                    if (availableShifts.length === 0) return null;

                    return (
                      <div key={`hist-block-${r.date}-${rIdx}`} className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{r.date === selectedDate ? "HARI INI" : r.date}</span>
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
        </div>
      )}

      {/* Modal Surgery Schedule */}
      {editingSurgery && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-lg shadow-2xl animate-fade-in border-t-8 border-blue-600">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                Jadwal / Tindakan
              </h3>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Nama Tindakan / Prosedur
                </label>
                <input
                  type="text"
                  className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="Contoh: Laparoscopy..."
                  defaultValue={
                    getReportForPatient(editingSurgery)?.surgeryProcedure || ""
                  }
                  onBlur={(e) =>
                    onUpdateReport(
                      editingSurgery,
                      "surgeryProcedure",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Operator / Dokter Bedah
                </label>
                <select
                  className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-blue-500"
                  value={
                    getReportForPatient(editingSurgery)?.surgeryOperator || ""
                  }
                  onChange={(e) =>
                    onUpdateReport(
                      editingSurgery,
                      "surgeryOperator",
                      e.target.value,
                    )
                  }
                >
                  <option value="">-- Pilih Operator --</option>
                  {masterData.doctors.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Tanggal Tindakan
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                    defaultValue={
                      getReportForPatient(editingSurgery)?.surgeryDate ||
                      selectedDate
                    }
                    onBlur={(e) =>
                      onUpdateReport(
                        editingSurgery,
                        "surgeryDate",
                        e.target.value,
                      )
                    }
                  />
                  <input
                    type="time"
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                    defaultValue={
                      getReportForPatient(editingSurgery)?.surgeryTime || ""
                    }
                    onBlur={(e) =>
                      onUpdateReport(
                        editingSurgery,
                        "surgeryTime",
                        e.target.value,
                      )
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Jenis Anestesi
                  </label>
                  <input
                    type="text"
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                    placeholder="Contoh: General, Spinal..."
                    defaultValue={
                      getReportForPatient(editingSurgery)?.surgeryAnesthesiaType || ""
                    }
                    onBlur={(e) =>
                      onUpdateReport(
                        editingSurgery,
                        "surgeryAnesthesiaType",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Sifat Operasi
                  </label>
                  <select
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-blue-500"
                    value={
                      getReportForPatient(editingSurgery)?.surgeryUrgency || "ELECTIVE"
                    }
                    onChange={(e) =>
                      onUpdateReport(
                        editingSurgery,
                        "surgeryUrgency",
                        e.target.value,
                      )
                    }
                  >
                    <option value="ELECTIVE">ELEKTIF</option>
                    <option value="EMERGENCY">CYTO / EMERGENCY</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Status Tindakan
                </label>
                <select
                  className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-blue-500"
                  value={
                    getReportForPatient(editingSurgery)?.surgeryStatus ||
                    "SCHEDULED"
                  }
                  onChange={(e) =>
                    onUpdateReport(
                      editingSurgery,
                      "surgeryStatus",
                      e.target.value,
                    )
                  }
                >
                  <option value="SCHEDULED">DIJADWALKAN</option>
                  <option value="PERFORMED">TELAH DILAKUKAN</option>
                  <option value="DELAYED">DITUNDA</option>
                  <option value="CANCELLED">DIBATALKAN</option>
                </select>
              </div>
              {getReportForPatient(editingSurgery)?.surgeryStatus ===
                "DELAYED" && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Alasan Ditunda (Akan masuk ke Mutu)
                    </label>
                    <textarea
                      className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:border-red-500 bg-red-50/30"
                      placeholder="Sebutkan alasan penundaan..."
                      defaultValue={
                        getReportForPatient(editingSurgery)?.surgeryDelayReason ||
                        ""
                      }
                      onBlur={(e) =>
                        onUpdateReport(
                          editingSurgery,
                          "surgeryDelayReason",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Tanggal Pelaksanaan Baru
                      </label>
                      <input
                        type="date"
                        className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-blue-50/30 focus:border-blue-500"
                        defaultValue={
                          getReportForPatient(editingSurgery)?.surgeryNewDate || ""
                        }
                        onChange={(e) =>
                          onUpdateReport(
                            editingSurgery,
                            "surgeryNewDate",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Waktu Pelaksanaan Baru
                      </label>
                      <input
                        type="time"
                        className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-blue-50/30 focus:border-blue-500"
                        defaultValue={
                          getReportForPatient(editingSurgery)?.surgeryNewTime || ""
                        }
                        onChange={(e) =>
                          onUpdateReport(
                            editingSurgery,
                            "surgeryNewTime",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="mt-10 flex gap-4">
              <Button
                variant="ghost"
                onClick={() => setEditingSurgery(null)}
                className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest bg-slate-100 text-slate-600"
              >
                Batal
              </Button>
              <Button
                onClick={() => setEditingSurgery(null)}
                className="flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest bg-blue-600 text-white shadow-xl shadow-blue-100"
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
                  getReportForPatient(editingAdminNote)?.adminNote || ""
                }
                onBlur={(e) =>
                  onUpdateReport(editingAdminNote, "adminNote", e.target.value)
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-lg shadow-2xl animate-fade-in border-t-8 border-indigo-600">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-8">
              Detail {(statusChangePatient.newStatus === "BPL" || statusChangePatient.newStatus === "BPL (Boleh Pulang)") ? "Boleh Pulang" : (statusChangePatient.newStatus === "Dipindah ke Ruangan Lain" || statusChangePatient.newStatus === "Pindah Ruangan") ? "Pindah Ruangan" : statusChangePatient.newStatus}
            </h3>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Tanggal {(statusChangePatient.newStatus === "Dipindah ke Ruangan Lain" || statusChangePatient.newStatus === "Pindah Ruangan") ? "Pindah" : (statusChangePatient.newStatus === "BPL" || statusChangePatient.newStatus === "BPL (Boleh Pulang)") ? "Pulang" : statusChangePatient.newStatus}
                  </label>
                  <input
                    type="date"
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    value={statusChangePatient.date}
                    onChange={(e) =>
                      setStatusChangePatient({
                        ...statusChangePatient,
                        date: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Jam {(statusChangePatient.newStatus === "Dipindah ke Ruangan Lain" || statusChangePatient.newStatus === "Pindah Ruangan") ? "Pindah" : (statusChangePatient.newStatus === "BPL" || statusChangePatient.newStatus === "BPL (Boleh Pulang)") ? "Pulang" : statusChangePatient.newStatus}
                  </label>
                  <input
                    type="time"
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    value={statusChangePatient.time}
                    onChange={(e) =>
                      setStatusChangePatient({
                        ...statusChangePatient,
                        time: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {(statusChangePatient.newStatus === "APS" || statusChangePatient.newStatus === "APS (Pulang Paksa)") && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Alasan APS (Sinkron Mutu)
                  </label>
                  <textarea
                    className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="Masukkan alasan APS dengan detail..."
                    value={statusChangePatient.reason}
                    onChange={(e) =>
                      setStatusChangePatient({
                        ...statusChangePatient,
                        reason: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {(statusChangePatient.newStatus === "Dirujuk" || statusChangePatient.newStatus === "Rujuk") && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    RS Tujuan Rujuk
                  </label>
                  <input
                    type="text"
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="Nama Rumah Sakit Tujuan..."
                    value={statusChangePatient.destination}
                    onChange={(e) =>
                      setStatusChangePatient({
                        ...statusChangePatient,
                        destination: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {(statusChangePatient.newStatus === "Dipindah ke Ruangan Lain" || statusChangePatient.newStatus === "Pindah Ruangan") && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Unit Tujuan
                    </label>
                    <select
                      className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500 text-slate-700"
                      value={statusChangePatient.destination || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const classes = masterData.unitToClasses[val] || [];
                        const autoClass = classes.length === 1 ? classes[0] : "";
                        let autoRoom = "";
                        if (autoClass) {
                          const rooms = masterData.classToRooms[`${val} - ${autoClass}`] || [];
                          if (rooms.length === 1) autoRoom = rooms[0];
                        }
                        setStatusChangePatient({
                          ...statusChangePatient,
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
                        Kelas {!statusChangePatient.destination && <span className="text-red-400 text-[8px] italic">(Pilih unit)</span>}
                      </label>
                      <select
                        disabled={!statusChangePatient.destination}
                        className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500 disabled:opacity-50 text-slate-700"
                        value={statusChangePatient.destinationClass || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const rooms = masterData.classToRooms[`${statusChangePatient.destination} - ${val}`] || [];
                          const autoRoom = rooms.length === 1 ? rooms[0] : "";
                          setStatusChangePatient({
                            ...statusChangePatient,
                            destinationClass: val,
                            destinationRoom: autoRoom,
                            destinationBed: "",
                          });
                        }}
                      >
                        <option value="">-- Kelas --</option>
                        {(masterData.unitToClasses[statusChangePatient.destination || ""] || []).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Ruangan {!statusChangePatient.destinationClass && <span className="text-red-400 text-[8px] italic">(Pilih kelas)</span>}
                      </label>
                      <select
                        disabled={!statusChangePatient.destinationClass}
                        className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500 disabled:opacity-50 text-slate-700"
                        value={statusChangePatient.destinationRoom || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const beds = masterData.roomToBeds[val] || [];
                          const autoBed = beds.length === 1 ? beds[0] : "";
                          setStatusChangePatient({
                            ...statusChangePatient,
                            destinationRoom: val,
                            destinationBed: autoBed,
                          });
                        }}
                      >
                        <option value="">-- Ruangan --</option>
                        {(masterData.classToRooms[`${statusChangePatient.destination} - ${statusChangePatient.destinationClass}`] || []).map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Nomor Bed {!statusChangePatient.destinationRoom && <span className="text-red-400 text-[8px] italic">(Pilih ruangan)</span>}
                    </label>
                    <select
                      disabled={!statusChangePatient.destinationRoom}
                      className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500 disabled:opacity-50 text-slate-700"
                      value={statusChangePatient.destinationBed || ""}
                      onChange={(e) =>
                        setStatusChangePatient({
                          ...statusChangePatient,
                          destinationBed: e.target.value,
                        })
                      }
                    >
                      <option value="">-- Pilih Bed --</option>
                      {(masterData.roomToBeds[statusChangePatient.destinationRoom || ""] || []).map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {statusChangePatient.newStatus === "Meninggal" && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Kategori Waktu Meninggal
                  </label>
                  <select
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500"
                    value={statusChangePatient.reason}
                    onChange={(e) =>
                      setStatusChangePatient({
                        ...statusChangePatient,
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
                onClick={() => setStatusChangePatient(null)}
                className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest bg-slate-100 text-slate-600"
              >
                Batal
              </Button>
              <Button
                onClick={() => {
                  if (!onUpdatePatient) return;
                  const updates: Partial<Patient> = {
                    statusDataPasien: statusChangePatient.newStatus,
                  };

                  const isDischarge = ["BPL", "BPL (Boleh Pulang)", "Meninggal", "APS", "APS (Pulang Paksa)", "Dirujuk", "Rujuk"].includes(statusChangePatient.newStatus);

                  if (isDischarge) {
                    updates.dischargeDate = statusChangePatient.date;
                    updates.dischargeTime = statusChangePatient.time;
                    updates.status = 'DISCHARGED';
                  }

                  if (statusChangePatient.newStatus === "APS" || statusChangePatient.newStatus === "APS (Pulang Paksa)") {
                    updates.apsReason = statusChangePatient.reason;
                  } else if (statusChangePatient.newStatus === "Dirujuk" || statusChangePatient.newStatus === "Rujuk") {
                    updates.referralDestination =
                      statusChangePatient.destination;
                  } else if (statusChangePatient.newStatus === "Meninggal") {
                    updates.deathTime = statusChangePatient.reason as any;
                  } else if (statusChangePatient.newStatus === "Dipindah ke Ruangan Lain" || statusChangePatient.newStatus === "Pindah Ruangan") {
                    updates.unitTujuan = statusChangePatient.destination;
                    updates.kelasRawat = statusChangePatient.destinationClass;
                    updates.ruangan = statusChangePatient.destinationRoom;
                    updates.nomorBed = statusChangePatient.destinationBed;
                    updates.transferDestinationRoom = statusChangePatient.destinationRoom;
                    updates.dischargeDate = statusChangePatient.date;
                    updates.dischargeTime = statusChangePatient.time;
                    
                    // After moving, if we want them to stay in the system, we should probably set statusDataPasien back to "Masih Dirawat"
                    // But if the user selected "Pindah Ruangan" specifically, maybe they want to see it? 
                    // Let's keep it as is, but if they are still ADMITTED, they show up.
                    
                    const currentPatient = patients.find(
                      (p) => p.id === statusChangePatient.id,
                    );
                    const history = [...(currentPatient?.transferHistory || [])];
                    history.push({
                      date: `${statusChangePatient.date} ${statusChangePatient.time}`,
                      fromUnit: currentPatient?.ruangan || "",
                      toUnit: statusChangePatient.destinationRoom || "",
                    });
                    updates.transferHistory = history;
                  }

                  onUpdatePatient(statusChangePatient.id, updates);
                  setStatusChangePatient(null);
                }}
                className="flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest bg-indigo-600 text-white shadow-xl shadow-indigo-100"
              >
                Konfirmasi
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">
          Matriks Pelayanan Harian
        </h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="bg-white border text-[11px] font-bold px-5 py-2.5 rounded-xl"
          >
            <Printer size={16} className="mr-2" /> Cetak
          </Button>
          <Button
            onClick={onAddPatient}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-lg shadow-indigo-100"
          >
            <Plus size={16} className="mr-2" /> Pasien Baru
          </Button>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur shadow-sm border rounded-[2rem] p-8 flex flex-wrap gap-x-8 gap-y-4 items-end">
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
          <select
            className="w-52 py-2.5 px-4 border rounded-xl text-xs font-bold outline-none bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            disabled={
              currentUser?.role !== "SUPER_ADMIN" &&
              currentUser?.role !== "BIDANG"
            }
          >
            {(currentUser?.role === "SUPER_ADMIN" ||
              currentUser?.role === "BIDANG") && <option>Semua Unit</option>}
            {masterData.units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
            PERAWAT PRIMER
          </label>
          <select
            className="w-52 py-2.5 px-4 border rounded-xl text-xs font-bold outline-none bg-white focus:ring-2 focus:ring-indigo-500"
            value={selectedPPJA}
            onChange={(e) => setSelectedPPJA(e.target.value)}
          >
            <option>Semua PPJA</option>
            {masterData.nurses.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
            DPJP
          </label>
          <select
            className="w-52 py-2.5 px-4 border rounded-xl text-xs font-bold outline-none bg-white focus:ring-2 focus:ring-indigo-500"
            value={selectedDPJP}
            onChange={(e) => setSelectedDPJP(e.target.value)}
          >
            <option>Semua DPJP</option>
            {masterData.doctors.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
            STATUS PASIEN
          </label>
          <select
            className="w-52 py-2.5 px-4 border rounded-xl text-xs font-bold outline-none bg-white focus:ring-2 focus:ring-indigo-500"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option>Semua Status</option>
            {masterData.refs.statusDataPasien.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 text-right">
          <span className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl border border-blue-100 text-[10px] font-black uppercase tracking-widest">
            {filteredPatients.length} Pasien Aktif
          </span>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
              <tr>
                <th className="p-6 w-16 text-center">NO</th>
                <th className="p-6 w-48">RUANG/BED</th>
                <th className="p-6 w-64">IDENTITAS PASIEN & DPJP</th>
                <th className="p-6 w-48">PERAWAT PRIMER</th>
                <th className="p-6 w-40 text-center">STATUS</th>
                <th className="p-6 text-center bg-slate-50/80">LAPORAN PAGI</th>
                <th className="p-6 text-center">LAPORAN SIANG</th>
                <th className="p-6 text-center bg-slate-50/80">
                  LAPORAN MALAM
                </th>
                <th className="p-6 text-center">JADWAL/TINDAKAN</th>
                <th className="p-6 text-center">VISITE DOKTER</th>
                <th className="p-6 text-center">ADMIN NOTE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((p, idx) => {
                const report = getReportForPatient(p.id);
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-6 text-center font-black text-slate-800 text-xs">
                      {idx + 1}
                    </td>
                    <td 
                      className="p-6 cursor-pointer group hover:bg-slate-50 transition-all border-l-4 border-l-transparent hover:border-l-indigo-500"
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
                        });
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="text-indigo-600 font-black text-xs flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                          {p.ruangan}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight flex items-center justify-between">
                          <span>BED {p.nomorBed}</span>
                          <Edit size={10} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="text-slate-800 font-black text-sm uppercase truncate max-w-[200px]">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold tracking-tighter mb-2 flex items-center justify-between">
                        <span>RM: {p.noRM}</span>
                        <button 
                          onClick={() => setShowHistoryPatientId(p.id)}
                          className="flex items-center gap-1 text-[8px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors"
                        >
                          <History size={10} /> RIWAYAT
                        </button>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase">
                          DPJP:
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {(p.dpjpList || []).map((d, dIdx) => (
                            <span
                              key={`${d}-${dIdx}`}
                              className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[8px] font-bold flex items-center gap-1"
                            >
                              {d}
                              <button
                                onClick={() =>
                                  onUpdatePatient?.(p.id, {
                                    dpjpList: (p.dpjpList || []).filter(
                                      (name) => name !== d,
                                    ),
                                  })
                                }
                                className="hover:text-red-500"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <select
                            className="text-[8px] font-bold border-none bg-transparent outline-none text-blue-600 cursor-pointer"
                            onChange={(e) => {
                              if (
                                e.target.value &&
                                !(p.dpjpList || []).includes(e.target.value)
                              ) {
                                onUpdatePatient?.(p.id, {
                                  dpjpList: [
                                    ...(p.dpjpList || []),
                                    e.target.value,
                                  ],
                                });
                              }
                            }}
                            value=""
                          >
                            <option value="">+ Tambah</option>
                            {masterData.doctors.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col gap-1 relative">
                        <div
                          onClick={() =>
                            setActiveNurseSelectId(
                              activeNurseSelectId === p.id ? null : p.id,
                            )
                          }
                          className="w-full py-2 px-3 border rounded-xl text-[10px] font-bold bg-white cursor-pointer flex justify-between items-center hover:border-blue-300 transition-colors"
                        >
                          <span className="truncate">
                            {p.perawatPrimer || "-- Pilih PPJA --"}
                          </span>
                          <ChevronDown size={12} className="text-slate-400" />
                        </div>

                        {activeNurseSelectId === p.id && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-2xl z-[150] overflow-hidden flex flex-col max-h-48">
                            <div className="p-2 border-b bg-slate-50">
                              <input
                                autoFocus
                                type="text"
                                placeholder="Cari..."
                                className="w-full px-2 py-1.5 rounded-lg border text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                value={nurseSearch}
                                onChange={(e) => setNurseSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div className="overflow-y-auto custom-scrollbar">
                              {filteredNurses.length > 0 ? (
                                filteredNurses.map((n) => (
                                  <div
                                    key={n}
                                    onClick={() => {
                                      onUpdatePatient?.(p.id, {
                                        perawatPrimer: n,
                                      });
                                      setActiveNurseSelectId(null);
                                      setNurseSearch("");
                                    }}
                                    className={`px-3 py-2 text-[10px] font-bold cursor-pointer transition-colors flex items-center justify-between ${
                                      p.perawatPrimer === n
                                        ? "bg-blue-50 text-blue-600"
                                        : "hover:bg-slate-50 text-slate-600"
                                    }`}
                                  >
                                    <span>{n}</span>
                                    {n === currentUser?.name && (
                                      <span className="text-[7px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded font-black">
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
                          <div className="flex items-center gap-1 text-emerald-600 font-black text-[8px] uppercase tracking-widest">
                            <UserCheck size={10} /> Assigned
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-6">
                      <select
                        className="w-full text-[10px] font-black border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                        value={p.statusDataPasien}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          const needsModal = [
                            "BPL", "BPL (Boleh Pulang)", 
                            "APS", "APS (Pulang Paksa)", 
                            "Dirujuk", "Rujuk", 
                            "Dipindah ke Ruangan Lain", "Pindah Ruangan", 
                            "Meninggal"
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
                            onUpdatePatient?.(p.id, {
                              statusDataPasien: newStatus,
                            });
                          }
                        }}
                      >
                        {masterData.refs.statusDataPasien.map((s) => (
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
                    <td className="p-6 bg-slate-50/30">
                      <EntryBox
                        label="PAGI"
                        shift="morning"
                        content={report?.morningReport}
                        therapy={report?.morningTherapy}
                        report={report}
                        patientId={p.id}
                      />
                    </td>
                    <td className="p-6">
                      <EntryBox
                        label="SIANG"
                        shift="afternoon"
                        content={report?.afternoonReport}
                        therapy={report?.afternoonTherapy}
                        report={report}
                        patientId={p.id}
                      />
                    </td>
                    <td className="p-6 bg-slate-50/30">
                      <EntryBox
                        label="MALAM"
                        shift="night"
                        content={report?.nightReport}
                        therapy={report?.nightTherapy}
                        report={report}
                        patientId={p.id}
                      />
                    </td>
                    <td className="p-6">
                      <div
                        onClick={() => setEditingSurgery(p.id)}
                        className="w-full min-w-[200px] min-h-[120px] border-2 border-dashed border-blue-100 rounded-2xl flex flex-col p-4 cursor-pointer transition-all hover:bg-blue-50 hover:border-blue-300 group"
                      >
                        <div className="text-[8px] font-black uppercase tracking-widest text-blue-600 mb-2">
                          JADWAL TINDAKAN
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
                    </td>
                    <td className="p-6 text-center">
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
                          className={`w-full group cursor-pointer p-4 rounded-3xl border border-dashed transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center min-h-[120px] min-w-[200px] ${
                            (appData?.doctorVisits || []).filter((v: any) => v.patientId === p.id && v.date === selectedDate).length > 0
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-300 hover:bg-slate-100'
                          }`}
                        >
                          {(appData?.doctorVisits || []).filter((v: any) => v.patientId === p.id && v.date === selectedDate).length > 0 ? (
                            <>
                              <div className="flex flex-col gap-2 w-full">
                                {(appData?.doctorVisits || []).filter((v: any) => v.patientId === p.id && v.date === selectedDate).map((v: any, vIdx: number) => (
                                  <div key={`visite-${v.id}-${vIdx}`} className="bg-white p-2.5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col items-start text-[10px] gap-1 relative group/item">
                                    <div className="flex justify-between w-full">
                                      <span className="font-black truncate max-w-[120px] uppercase text-slate-800">{v.doctorName}</span>
                                      <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase ${
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
                                <div className="text-[9px] font-black text-emerald-600 flex items-center justify-center gap-1 mt-1 opacity-60 group-hover:opacity-100">
                                  <Plus size={10} /> TAMBAH VISITE
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="p-2 bg-white rounded-xl mb-2 shadow-sm text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all">
                                <Stethoscope size={18} />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest leading-tight">Entry Visite</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <div
                        onClick={() => setEditingAdminNote(p.id)}
                        className="w-full min-w-[200px] min-h-[120px] border-2 border-dashed border-slate-100 rounded-2xl flex flex-col p-4 cursor-pointer transition-all hover:bg-slate-50 hover:border-slate-300 group"
                      >
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">
                          ADMIN NOTE
                        </div>
                        {report?.adminNote ? (
                          <p className="text-[10px] text-slate-600 font-medium italic border-l-2 border-slate-200 pl-2">
                            {report.adminNote}
                          </p>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
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
    </div>
  );
};
