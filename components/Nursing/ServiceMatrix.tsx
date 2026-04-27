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
  Pill,
  User,
  Stethoscope,
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
  currentUser?: UserType | null;
}

export const ServiceMatrix: React.FC<ServiceMatrixProps> = ({
  patients,
  dailyReports,
  masterData,
  onAddPatient,
  onUpdateReport,
  onUpdateDependency,
  onUpdatePatient,
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
    if (selectedUnit !== "Semua Unit" && p.unitTujuan !== selectedUnit)
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
    )
      return false;
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
      className={`w-64 min-h-[140px] border-2 ${content || therapy ? 'border-indigo-200 bg-indigo-50/30' : 'border-dashed border-slate-200'} rounded-2xl flex flex-col p-4 cursor-pointer transition-all hover:bg-${color}-50 hover:border-${color}-300 group relative overflow-hidden`}
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
                              <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">SHIFT {shift === 'morning' ? 'PAGI' : shift === 'afternoon' ? 'SIANG' : 'MALAM'}</span>
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
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-xl shadow-2xl animate-fade-in border-t-8 border-indigo-600 max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                Entri Laporan Shift
              </h3>
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
                  className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-indigo-500 outline-none min-h-[120px]"
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
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-[10px] font-black uppercase tracking-widest animate-shake">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="mt-10 flex gap-4">
              <Button
                variant="ghost"
                onClick={() => setEditingEntry(null)}
                className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest bg-slate-100 text-slate-600"
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveShiftReport}
                className="flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest bg-indigo-600 text-white shadow-xl shadow-indigo-100"
              >
                Selesai & Simpan
              </Button>
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
              Detail {statusChangePatient.newStatus}
            </h3>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Tanggal
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
                    Jam
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

              {statusChangePatient.newStatus === "APS" && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Alasan APS
                  </label>
                  <textarea
                    className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="Masukkan alasan APS..."
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

              {statusChangePatient.newStatus === "Dirujuk" && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    RS Tujuan Rujuk
                  </label>
                  <input
                    type="text"
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="Nama Rumah Sakit..."
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

              {statusChangePatient.newStatus === "Dipindah ke Ruangan Lain" && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Ruangan Tujuan
                  </label>
                  <select
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-white focus:border-indigo-500"
                    value={statusChangePatient.destination}
                    onChange={(e) =>
                      setStatusChangePatient({
                        ...statusChangePatient,
                        destination: e.target.value,
                      })
                    }
                  >
                    <option value="">-- Pilih Ruangan --</option>
                    {masterData.units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
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

                  if (statusChangePatient.newStatus === "Sudah Pulang") {
                    updates.dischargeDate = statusChangePatient.date;
                    updates.dischargeTime = statusChangePatient.time;
                  } else if (statusChangePatient.newStatus === "APS") {
                    updates.dischargeDate = statusChangePatient.date;
                    updates.dischargeTime = statusChangePatient.time;
                    updates.apsReason = statusChangePatient.reason;
                  } else if (statusChangePatient.newStatus === "Dirujuk") {
                    updates.dischargeDate = statusChangePatient.date;
                    updates.dischargeTime = statusChangePatient.time;
                    updates.referralDestination =
                      statusChangePatient.destination;
                  } else if (statusChangePatient.newStatus === "Dipindah ke Ruangan Lain") {
                    updates.transferDestinationRoom =
                      statusChangePatient.destination;
                    // Log to history
                    const currentPatient = patients.find(
                      (p) => p.id === statusChangePatient.id,
                    );
                    const history = [...(currentPatient?.transferHistory || [])];
                    history.push({
                      date: `${statusChangePatient.date} ${statusChangePatient.time}`,
                      fromUnit: currentPatient?.ruangan || "",
                      toUnit: statusChangePatient.destination || "",
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
                    <td className="p-6">
                      <div className="text-blue-600 font-black text-xs">
                        {p.ruangan}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        BED {p.nomorBed}
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
                          if (
                            ["Sudah Pulang", "APS", "Dirujuk", "Dipindah ke Ruangan Lain"].includes(
                              newStatus,
                            )
                          ) {
                            setStatusChangePatient({
                              id: p.id,
                              newStatus,
                              date: new Date().toISOString().split("T")[0],
                              time: new Date()
                                .toTimeString()
                                .split(" ")[0]
                                .substring(0, 5),
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
                          {p.statusDataPasien === "APS" && p.apsReason && (
                            <div className="text-[9px] font-bold text-amber-600 line-clamp-2">
                              Alasan: {p.apsReason}
                            </div>
                          )}
                          {p.statusDataPasien === "Dirujuk" &&
                            p.referralDestination && (
                              <div className="text-[9px] font-bold text-indigo-600">
                                RS Tujuan: {p.referralDestination}
                              </div>
                            )}
                          {p.statusDataPasien === "Dipindah ke Ruangan Lain" &&
                            p.transferDestinationRoom && (
                              <div className="text-[9px] font-bold text-blue-600">
                                Ruang: {p.transferDestinationRoom}
                              </div>
                            )}
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
                        className="w-56 min-h-[100px] border-2 border-dashed border-blue-100 rounded-2xl flex flex-col p-4 cursor-pointer transition-all hover:bg-blue-50 hover:border-blue-300 group"
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
                    <td className="p-6">
                      <div
                        onClick={() => setEditingAdminNote(p.id)}
                        className="w-56 min-h-[100px] border-2 border-dashed border-slate-100 rounded-2xl flex flex-col p-4 cursor-pointer transition-all hover:bg-slate-50 hover:border-slate-300 group"
                      >
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">
                          ADMIN NOTE
                        </div>
                        {report?.adminNote ? (
                          <p className="text-[10px] text-slate-600 font-medium italic line-clamp-4">
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
    </div>
  );
};
