import React, { useState, useEffect } from 'react';
import { Patient, DailyReportEntry, MasterData, compareDatesSafe } from '../../types';
import { 
  X, Calendar, User, Clipboard, Stethoscope, 
  MapPin, Clock, BadgeCheck, ShieldAlert, Award, RefreshCw, AlertCircle,
  Edit2, Check, RotateCcw
} from 'lucide-react';

interface PatientDetailModalProps {
  patient: Patient;
  dailyReports: DailyReportEntry[];
  onClose: () => void;
  onSave?: (id: string, updates: Partial<Patient>) => void;
  masterData?: MasterData;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({ 
  patient, 
  dailyReports, 
  onClose,
  onSave,
  masterData
}) => {
  const [activeTab, setActiveTab] = useState<'REGISTRATION' | 'ADMINISTRATION' | 'CLINICAL'>('REGISTRATION');
  const [aiCompilationText, setAiCompilationText] = useState<string>('');
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<string>('');
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<Partial<Patient>>({});

  const filteredReports = dailyReports
    .filter(r => r.patientId === patient.id)
    .sort((a, b) => compareDatesSafe(a.date, b.date, true));

  // Helper to compile diagnoses from early registry and all shift reports
  const getCompiledDiagnosisText = () => {
    const initial = patient.diagnosaUtama ? patient.diagnosaUtama.trim() : '';
    const shiftDiagnoses = dailyReports
      .filter(r => r.patientId === patient.id && r.diagnosis && r.diagnosis.trim() !== '')
      .map(r => r.diagnosis!.trim());
    
    const uniqueDiagnoses = Array.from(new Set(shiftDiagnoses));
    if (uniqueDiagnoses.length === 0) {
      return initial || 'Belum diisi';
    }
    
    const latest = uniqueDiagnoses[uniqueDiagnoses.length - 1];
    if (latest === initial || !initial) {
      return latest;
    }
    return `${initial} ➔ Kompilasi Diagnosa AI: ${latest}`;
  };

  const handleCompileDiagnosis = async () => {
    setIsCompiling(true);
    setCompileError('');
    try {
      const res = await fetch('/api/compile-patient-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id })
      });
      const data = await res.json();
      if (data.success) {
        setAiCompilationText(data.compiledDiagnosis);
        if (onSave) {
          onSave(patient.id, { diagnosaUtama: data.compiledDiagnosis });
        }
      } else {
        setCompileError(data.error || 'Gagal mengompilasi diagnosa.');
      }
    } catch (err: any) {
      setCompileError(err.message || 'Gagal menghubungi server.');
    } finally {
      setIsCompiling(false);
    }
  };

  // Trigger auto compile if initial registry diagnosis is empty
  useEffect(() => {
    const initialDiagnosa = patient.diagnosaUtama ? patient.diagnosaUtama.trim() : '';
    if (!initialDiagnosa && onSave && !aiCompilationText && !isCompiling) {
      const triggerAutoCompile = async () => {
        setIsCompiling(true);
        setCompileError('');
        try {
          const res = await fetch('/api/compile-patient-diagnosis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId: patient.id })
          });
          const data = await res.json();
          if (data.success && data.compiledDiagnosis) {
            setAiCompilationText(data.compiledDiagnosis);
            onSave(patient.id, { diagnosaUtama: data.compiledDiagnosis });
          } else {
            // Local fallback
            const localFallback = getCompiledDiagnosisText();
            if (localFallback && localFallback !== 'Belum diisi') {
              onSave(patient.id, { diagnosaUtama: localFallback });
            }
          }
        } catch (err: any) {
          console.error("Auto compile failed", err);
          const localFallback = getCompiledDiagnosisText();
          if (localFallback && localFallback !== 'Belum diisi') {
            onSave(patient.id, { diagnosaUtama: localFallback });
          }
        } finally {
          setIsCompiling(false);
        }
      };
      triggerAutoCompile();
    }
  }, [patient.id]);

  useEffect(() => {
    if (activeTab === 'CLINICAL' && !aiCompilationText && !isCompiling && patient.diagnosaUtama) {
      handleCompileDiagnosis();
    }
  }, [activeTab]);

  const handleStartEdit = () => {
    setEditForm({ ...patient });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveChanges = () => {
    if (onSave && editForm) {
      // Validate RM and Name are not completely empty
      if (!editForm.name || !editForm.noRM) {
        alert("Nama Pasien dan Nomor RM wajib diisi!");
        return;
      }

      const updates = { ...editForm };
      if (updates.statusDataPasien !== undefined) {
        const uStatus = String(updates.statusDataPasien || '').toUpperCase().trim();
        const isCurrentlyTreated = uStatus === 'MASIH DIRAWAT' || uStatus === 'AKTIF' || uStatus === '';
        
        if (isCurrentlyTreated) {
          updates.status = 'ADMITTED';
          updates.dischargeDate = '';
          updates.dischargeTime = '';
          updates.apsReason = '';
          updates.referralDestination = '';
          updates.deathTime = '';
          updates.transferDestinationRoom = '';
        } else {
          updates.status = 'DISCHARGED';
          if (!patient.dischargeDate && !updates.dischargeDate) {
            updates.dischargeDate = new Date().toISOString().split('T')[0];
          }
          if (!patient.dischargeTime && !updates.dischargeTime) {
            updates.dischargeTime = new Date().toTimeString().slice(0, 5);
          }
        }
      }

      onSave(patient.id, updates);
      setIsEditing(false);
      setEditForm({});
    }
  };

  // Multi-select payment helper
  const togglePaymentMethod = (method: string) => {
    const current = editForm.paymentMethod || [];
    let updated;
    if (current.includes(method)) {
      updated = current.filter(m => m !== method);
    } else {
      updated = [...current, method];
    }
    setEditForm({ ...editForm, paymentMethod: updated });
  };

  // Helper arrays for options
  const defaultAsalMasuk = ["IGD", "IGD Ponek", "P. Bedah", "P. Orthopedi", "P. Syaraf", "P. Dalam", "P. Anak", "Ruang Bedah", "Ruang Intermediet", "IBS", "ICU"];
  const defaultStatusSep = ["Belum Terbit", "Sudah Terbit", "Pending", "Ditolak", "Tidak Ada SEP"];
  const defaultJenisKll = ["Bukan KLL", "KLL Tunggal", "KLL Ganda", "Kecelakaan Kerja"];
  const defaultCaraBayar = ["BPJS", "Umum", "Jasa Raharja (JR)", "Asuransi Swasta"];
  const defaultStatusDataPasien = ["Masih Dirawat", "BPL", "APS", "Dirujuk", "Pindah Ruangan", "Meninggal", "Batal Rawat Inap"];

  return (
    <div id="patient-detail-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 overflow-y-auto">
      <div 
        id="patient-detail-card" 
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col my-8 border border-slate-100 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#144272] p-8 text-white flex justify-between items-start relative overflow-hidden shrink-0">
          <div className="relative z-10 space-y-1 w-full mr-8">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-[9px] font-black tracking-widest uppercase text-blue-200">
                Detail Rekam Medis Pasien
              </span>
              {isEditing && (
                <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[9px] font-black tracking-widest uppercase animate-pulse">
                  Mode Edit
                </span>
              )}
            </div>
            {isEditing ? (
              <input 
                type="text" 
                className="text-2xl font-black uppercase tracking-tight text-white mt-1 bg-white/10 border border-white/20 rounded-xl px-4 py-1 w-full outline-none focus:bg-white/15 transition-all text-slate-100"
                value={editForm.name || ''}
                onChange={e => setEditForm({...editForm, name: e.target.value})}
                placeholder="Nama Lengkap Pasien"
              />
            ) : (
              <h3 className="text-2xl font-black uppercase tracking-tight text-white mt-1">
                {patient.name}
              </h3>
            )}
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider flex flex-wrap items-center gap-1.5 font-mono pt-1">
              <span>RM: {isEditing ? (
                <input 
                  type="text" 
                  className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-white outline-none w-24"
                  value={editForm.noRM || ''}
                  onChange={e => setEditForm({...editForm, noRM: e.target.value})}
                />
              ) : patient.noRM}</span>
              <span>•</span>
              <span>REG: {isEditing ? (
                <input 
                  type="text" 
                  className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-white outline-none w-28"
                  value={editForm.noRegister || ''}
                  onChange={e => setEditForm({...editForm, noRegister: e.target.value})}
                />
              ) : (patient.noRegister || '-')}</span>
              <span>•</span>
              <span>BED: {isEditing ? (
                <input 
                  type="text" 
                  className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-white outline-none w-16"
                  value={editForm.nomorBed || ''}
                  onChange={e => setEditForm({...editForm, nomorBed: e.target.value})}
                />
              ) : (patient.nomorBed || '-')} ({isEditing ? (
                <input 
                  type="text" 
                  className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-white outline-none w-20"
                  value={editForm.ruangan || ''}
                  onChange={e => setEditForm({...editForm, ruangan: e.target.value})}
                />
              ) : (patient.ruangan || '-')})</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 transition-all rounded-full text-white cursor-pointer group active:scale-95 shrink-0"
            aria-label="Close"
          >
            <X size={18} className="transition-transform group-hover:rotate-90" />
          </button>
        </div>

        {/* Tab Switcher Area */}
        <div className="bg-slate-50 px-8 border-b flex gap-1 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('REGISTRATION')}
            className={`px-6 py-4 text-xs font-extrabold uppercase tracking-wide border-b-4 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'REGISTRATION'
                ? 'border-indigo-600 text-indigo-700 font-black'
                : 'border-transparent text-slate-500 hover:text-indigo-650'
            }`}
          >
            <User size={14} /> Informasi Pendaftaran
          </button>
          <button
            onClick={() => setActiveTab('ADMINISTRATION')}
            className={`px-6 py-4 text-xs font-extrabold uppercase tracking-wide border-b-4 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'ADMINISTRATION'
                ? 'border-indigo-600 text-indigo-700 font-black'
                : 'border-transparent text-slate-500 hover:text-indigo-650'
            }`}
          >
            <Clipboard size={14} /> Informasi Administrasi
          </button>
          <button
            onClick={() => setActiveTab('CLINICAL')}
            className={`px-6 py-4 text-xs font-extrabold uppercase tracking-wide border-b-4 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'CLINICAL'
                ? 'border-indigo-600 text-indigo-700 font-black'
                : 'border-transparent text-slate-500 hover:text-indigo-650'
            }`}
          >
            <Stethoscope size={14} /> Informasi Penyakit & Laporan
          </button>
        </div>

        {/* Info Content Area */}
        <div id="patient-detail-body" className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-8">
          
          {/* TAB 1: REGISTRATION */}
          {activeTab === 'REGISTRATION' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Data Identitas</h4>
                <div className="space-y-3 bg-slate-50/70 p-5 rounded-2xl border">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Nama Lengkap</label>
                    {isEditing ? (
                      <input 
                        type="text"
                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1"
                        value={editForm.name || ''}
                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                      />
                    ) : (
                      <span className="text-sm font-extrabold text-slate-800 uppercase block mt-0.5">{patient.name}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Nomor RM</label>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-850 bg-white mt-1"
                          value={editForm.noRM || ''}
                          onChange={e => setEditForm({...editForm, noRM: e.target.value})}
                        />
                      ) : (
                        <span className="text-xs font-black text-slate-700 font-mono block mt-0.5">{patient.noRM}</span>
                      )}
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Jenis Kelamin</label>
                      {isEditing ? (
                        <select
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1 cursor-pointer"
                          value={editForm.gender || 'L'}
                          onChange={e => setEditForm({...editForm, gender: e.target.value as 'L' | 'P'})}
                        >
                          <option value="L">Laki-Laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      ) : (
                        <span className="text-xs font-extrabold text-indigo-600 uppercase block mt-0.5">
                          {patient.gender === 'L' ? 'Laki-Laki' : 'Perempuan'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tanggal Lahir</label>
                      {isEditing ? (
                        <input 
                          type="date"
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1"
                          value={editForm.birthDate || ''}
                          onChange={e => setEditForm({...editForm, birthDate: e.target.value})}
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-700 block mt-0.5">{patient.birthDate || '-'}</span>
                      )}
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status Pasien</label>
                      {isEditing ? (
                        <select
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1 cursor-pointer"
                          value={editForm.statusDataPasien || ''}
                          onChange={e => setEditForm({...editForm, statusDataPasien: e.target.value})}
                        >
                          {(() => {
                            const rawList = masterData?.refs?.statusDataPasien || defaultStatusDataPasien;
                            const hasBatal = rawList.some(s => s.toLowerCase().includes('batal'));
                            const finalOptions = hasBatal ? rawList : [...rawList, "Batal Rawat Inap"];
                            return finalOptions.map((st, sidx) => (
                              <option key={sidx} value={st}>{st}</option>
                            ));
                          })()}
                        </select>
                      ) : (
                        <span className="text-xs font-black text-slate-700 uppercase mt-0.5 block">{patient.statusDataPasien || 'Masih Dirawat'}</span>
                      )}
                    </div>
                  </div>
                  <div className="pt-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Alamat Rumah</label>
                    {isEditing ? (
                      <textarea 
                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1 min-h-[50px]"
                        value={editForm.address || ''}
                        onChange={e => setEditForm({...editForm, address: e.target.value})}
                      />
                    ) : (
                      <span className="text-xs font-semibold text-slate-600 block mt-0.5 leading-relaxed">{patient.address || '-'}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Registrasi Masuk Rumah Sakit (MRS)</h4>
                <div className="space-y-3 bg-slate-50/70 p-5 rounded-2xl border">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tanggal Masuk (MRS)</label>
                      {isEditing ? (
                        <input 
                          type="date"
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1"
                          value={editForm.entryDate || ''}
                          onChange={e => setEditForm({...editForm, entryDate: e.target.value})}
                        />
                      ) : (
                        <span className="text-xs font-black text-indigo-700 flex items-center gap-1 mt-1 font-mono">
                          <Calendar size={12} /> {patient.entryDate || '-'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Asal Pasien (Origin)</label>
                      {isEditing ? (
                        <select
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1 cursor-pointer"
                          value={editForm.origin || ''}
                          onChange={e => setEditForm({...editForm, origin: e.target.value})}
                        >
                          {(masterData?.refs?.asalMasuk || defaultAsalMasuk).map((or, oidx) => (
                            <option key={oidx} value={or}>{or}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-extrabold text-slate-700 block mt-1 uppercase">{patient.origin || '-'}</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Nomor SEP</label>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1 font-mono"
                          value={editForm.noSEP || ''}
                          onChange={e => setEditForm({...editForm, noSEP: e.target.value})}
                        />
                      ) : (
                        <span className="text-xs font-black text-slate-700 font-mono block mt-0.5">{patient.noSEP || '-'}</span>
                      )}
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status SEP</label>
                      {isEditing ? (
                        <select
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1 cursor-pointer"
                          value={editForm.statusSEP || ''}
                          onChange={e => setEditForm({...editForm, statusSEP: e.target.value})}
                        >
                          {(masterData?.refs?.statusSep || defaultStatusSep).map((ss, sidx) => (
                            <option key={sidx} value={ss}>{ss}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-extrabold text-slate-700 uppercase block mt-0.5">{patient.statusSEP || '-'}</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Jenis KLL (Kecelakaan)</label>
                      {isEditing ? (
                        <select
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1 cursor-pointer"
                          value={editForm.jenisKLL || ''}
                          onChange={e => setEditForm({...editForm, jenisKLL: e.target.value})}
                        >
                          {(masterData?.refs?.jenisKll || defaultJenisKll).map((cl, cidx) => (
                            <option key={cidx} value={cl}>{cl}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-extrabold text-slate-700 uppercase block mt-0.5">{patient.jenisKLL || '-'}</span>
                      )}
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">No. Laporan Polisi (LP)</label>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1"
                          value={editForm.noLP || ''}
                          onChange={e => setEditForm({...editForm, noLP: e.target.value})}
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-700 block mt-0.5">{patient.noLP || '-'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ADMINISTRATION */}
          {activeTab === 'ADMINISTRATION' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Rincian Penjamin & Kamar</h4>
                <div className="space-y-3 bg-slate-50/70 p-5 rounded-2xl border">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Metode Pembayaran / Penjamin</label>
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2 mt-1.5 p-3.5 bg-white border border-slate-200 rounded-xl">
                        {(masterData?.refs?.caraBayar || defaultCaraBayar).map((method, midx) => {
                          const isChecked = (editForm.paymentMethod || []).includes(method);
                          return (
                            <label key={midx} className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 cursor-pointer">
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePaymentMethod(method)}
                                className="rounded text-indigo-600 focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer"
                              />
                              {method}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded inline-block mt-1 uppercase">
                        {(patient.paymentMethod || []).join(', ') || 'UMUM'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Unit Perawatan</label>
                      {isEditing ? (
                        <select
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1 cursor-pointer animate-fade-in"
                          value={editForm.unitTujuan || ''}
                          onChange={e => setEditForm({...editForm, unitTujuan: e.target.value})}
                        >
                          {(masterData?.units || []).map((un, uidx) => (
                            <option key={uidx} value={un}>{un}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-black text-slate-800 uppercase block mt-0.5">{patient.unitTujuan || '-'}</span>
                      )}
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Kelas Rawat</label>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1"
                          value={editForm.kelasRawat || ''}
                          onChange={e => setEditForm({...editForm, kelasRawat: e.target.value})}
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-700 uppercase block mt-0.5">{patient.kelasRawat || '-'}</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Ruangan</label>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1"
                          value={editForm.ruangan || ''}
                          onChange={e => setEditForm({...editForm, ruangan: e.target.value})}
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-[#144272] block mt-0.5 uppercase">{patient.ruangan || '-'}</span>
                      )}
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Nomor Bed</label>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1"
                          value={editForm.nomorBed || ''}
                          onChange={e => setEditForm({...editForm, nomorBed: e.target.value})}
                        />
                      ) : (
                        <span className="text-xs font-black text-slate-700 block mt-0.5">BED {patient.nomorBed || '-'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Kelengkapan & Catatan</h4>
                <div className="space-y-3 bg-slate-50/70 p-5 rounded-2xl border">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Dokter DPJP Utama</label>
                    {isEditing ? (
                      <div className="flex flex-col gap-1.5 p-3.5 bg-white border border-slate-200 rounded-xl mt-1 max-h-32 overflow-y-auto">
                        {(masterData?.doctors || []).map((doc, docidx) => {
                          const isDpjpUtama = patient.dpjpList && patient.dpjpList.length > 0 && doc === patient.dpjpList[0];
                          const isChecked = (editForm.dpjpList || []).includes(doc);
                          return (
                            <label key={docidx} className={`flex items-center gap-1.5 text-xs font-extrabold text-slate-700 ${isDpjpUtama ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                disabled={isDpjpUtama}
                                onChange={() => {
                                  if (isDpjpUtama) return;
                                  let currentDocs = editForm.dpjpList || [];
                                  if (currentDocs.includes(doc)) {
                                    currentDocs = currentDocs.filter(d => d !== doc);
                                  } else {
                                    currentDocs = Array.from(new Set([...currentDocs, doc]));
                                  }
                                  setEditForm({ ...editForm, dpjpList: currentDocs });
                                }}
                                className="rounded text-indigo-600 focus:ring-0 focus:outline-none cursor-pointer disabled:cursor-not-allowed"
                              />
                              {doc} {isDpjpUtama && <span className="text-[8px] bg-red-100 text-red-700 px-1 font-black rounded ml-1 uppercase">DPJP UTAMA</span>}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1.5 animate-fade-in">
                        {(patient.dpjpList || []).length > 0 ? (
                          (patient.dpjpList || []).map((doc, idx) => (
                            <span key={idx} className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded border border-emerald-150 uppercase">
                              {doc}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-450 text-[10px] italic">Belum ditentukan</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="pt-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Perawat Primer (PPJA)</label>
                    {isEditing ? (
                      <select
                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1 cursor-pointer"
                        value={editForm.perawatPrimer || ''}
                        onChange={e => setEditForm({...editForm, perawatPrimer: e.target.value})}
                      >
                        <option value="">-- PILIH PPJA --</option>
                        {(masterData?.nurses || []).map((nurse, nurseidx) => (
                          <option key={nurseidx} value={nurse}>{nurse}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-extrabold text-slate-750 block mt-0.5 uppercase">{patient.perawatPrimer || 'Belum diisi'}</span>
                    )}
                  </div>
                  <div className="pt-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Catatan Khusus Keperawatan</label>
                    {isEditing ? (
                      <textarea 
                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white mt-1 min-h-[60px]"
                        value={editForm.catatanKhusus || ''}
                        onChange={e => setEditForm({...editForm, catatanKhusus: e.target.value})}
                      />
                    ) : (
                      <p className="text-xs font-medium text-slate-600 bg-white border rounded-xl p-3 mt-1 leading-relaxed min-h-[60px]">
                        {patient.catatanKhusus || 'Tidak ada catatan khusus.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Log Riwayat Mutasi Bolak-Balik Pasien */}
              {((patient.mutationSubLog && patient.mutationSubLog.length > 0) || (patient.transferHistory && patient.transferHistory.length > 0)) && (
                <div className="mt-6 col-span-1 md:col-span-2 space-y-3 bg-indigo-50/40 p-6 rounded-3xl border border-indigo-100">
                  <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest font-mono flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin-slow"/> Log Riwayat Mutasi Pasien (Historical Mutation Sub-Log)
                  </h4>
                  <div className="relative border-l border-indigo-200 pl-5 ml-2.5 space-y-4">
                    {patient.mutationSubLog && patient.mutationSubLog.length > 0 ? (
                      patient.mutationSubLog.map((logEntry, logIdx) => (
                        <div key={logIdx} className="relative">
                          <span className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white shadow-sm" />
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-mono font-black text-slate-400 block">{logEntry.date}</span>
                            <p className="text-xs font-bold text-slate-700 normal-case leading-relaxed">{logEntry.log}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      patient.transferHistory?.map((th, thIdx) => (
                        <div key={thIdx} className="relative">
                          <span className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-mono font-black text-slate-400 block">{th.date}</span>
                            <p className="text-xs font-bold text-slate-700 normal-case leading-relaxed">
                              Mutasi dari <span className="font-extrabold uppercase">{th.fromUnit}</span> ke <span className="font-extrabold uppercase">{th.toUnit}</span>
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: CLINICAL */}
          {activeTab === 'CLINICAL' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono mb-2">Diagnosa Medis & AI</h4>
                  <div className="space-y-4 bg-slate-50/70 p-5 rounded-2xl border">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Diagnosa Utama (Registrasi)</label>
                      {isEditing ? (
                        <textarea 
                          className="w-full border border-slate-200 rounded-xl p-3 text-xs font-extrabold text-slate-850 bg-white min-h-[60px] outline-none"
                          value={editForm.diagnosaUtama || ''}
                          onChange={e => setEditForm({...editForm, diagnosaUtama: e.target.value})}
                        />
                      ) : (
                        <p className="text-xs font-extrabold text-slate-800 bg-amber-50 border border-amber-200 p-3 rounded-xl leading-relaxed">
                          {patient.diagnosaUtama || 'Belum diisi'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Diagnosa Sekunder</label>
                      {isEditing ? (
                        <textarea 
                          className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-850 bg-white min-h-[60px] outline-none"
                          value={editForm.diagnosaSekunder || ''}
                          onChange={e => setEditForm({...editForm, diagnosaSekunder: e.target.value})}
                          placeholder="Tambahkan diagnosa sekunder (jika ada)..."
                        />
                      ) : (
                        <p className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 p-3 rounded-xl leading-relaxed">
                          {patient.diagnosaSekunder || 'Belum diisi'}
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Kompilasi Diagnosa AI Terintegrasi</label>
                        <button
                          type="button"
                          onClick={handleCompileDiagnosis}
                          disabled={isCompiling}
                          className="flex items-center gap-1 text-[8.5px] font-black text-indigo-600 bg-indigo-50 border border-indigo-150 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-55 cursor-pointer"
                        >
                          <RefreshCw size={10} className={isCompiling ? "animate-spin" : ""} />
                          {isCompiling ? "Menganalisis..." : "Generate AI"}
                        </button>
                      </div>

                      {isCompiling ? (
                        <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-2 animate-pulse min-h-[150px]">
                          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Gemini AI sedang mengolah...</div>
                          <p className="text-[10px] font-bold text-slate-400 max-w-xs leading-normal">Membaca riwayat diagnosa utama & narasi harian shift keperawatan secara komprehensif...</p>
                        </div>
                      ) : compileError ? (
                        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-2 text-[10px] leading-relaxed text-rose-600 font-bold">
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <div>
                            <div className="uppercase tracking-wide font-black">Gagal Mencetak Analisis AI</div>
                            <div className="font-semibold text-rose-500 mt-0.5">{compileError}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-indigo-900 text-indigo-50 border border-indigo-950/20 p-5 rounded-xl leading-relaxed whitespace-pre-wrap text-xs tracking-wide shadow-inner shadow-black/5">
                          <div className="prose prose-sm prose-invert select-text max-w-none text-slate-100 font-medium font-sans">
                            {aiCompilationText || getCompiledDiagnosisText()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono mb-2">Tindakan & Prosedur</h4>
                  <div className="bg-slate-50/70 p-5 rounded-2xl border h-full">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tindakan Bedah / Prosedur Medis</label>
                    {isEditing ? (
                      <textarea 
                        className="w-full border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 bg-white min-h-[100px] outline-none"
                        value={editForm.tindakanProsedur || ''}
                        onChange={e => setEditForm({...editForm, tindakanProsedur: e.target.value})}
                      />
                    ) : (
                      <p className="text-xs font-semibold text-slate-700 bg-white border rounded-xl p-3 mt-1 leading-relaxed min-h-[100px]">
                        {patient.tindakanProsedur || 'Tidak ada tindakan terdaftar.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Weekly/Shift nursing reports logs timeline */}
              <div className="space-y-4 pt-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <Clock size={12} /> Riwayat Laporan Keperawatan Harian
                </h4>
                
                {filteredReports.length > 0 ? (
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {filteredReports.map((rep, idx) => (
                      <div key={idx} className="bg-white border rounded-2xl p-4 space-y-3 shadow-sm hover:border-slate-300 transition-colors">
                        <div className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-lg border-b">
                          <span className="text-xs font-black text-indigo-700 flex items-center gap-1">
                            <Calendar size={12} /> {rep.date}
                          </span>
                          <span className="text-[8px] font-black text-slate-400 uppercase font-mono">
                            ID: LOG_SHIFT_{idx+1}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Morning */}
                          <div className="space-y-1.5 border-r md:pr-4">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Pagi</span>
                              <span className="text-[8.5px] font-bold text-slate-400 truncate max-w-[80px]" title={rep.morningRecordedBy}>By: {rep.morningRecordedBy || '-'}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                              {rep.morningReport || <span className="text-slate-300 italic">No report</span>}
                            </p>
                            {rep.morningTherapy && (
                              <div className="bg-slate-50 p-1.5 rounded-lg text-[9.5px]">
                                <span className="font-bold text-indigo-600">Therapy:</span> {rep.morningTherapy}
                              </div>
                            )}
                          </div>

                          {/* Afternoon */}
                          <div className="space-y-1.5 border-r md:px-4">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">Siang</span>
                              <span className="text-[8.5px] font-bold text-slate-400 truncate max-w-[80px]" title={rep.afternoonRecordedBy}>By: {rep.afternoonRecordedBy || '-'}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                              {rep.afternoonReport || <span className="text-slate-300 italic">No report</span>}
                            </p>
                            {rep.afternoonTherapy && (
                              <div className="bg-slate-50 p-1.5 rounded-lg text-[9.5px]">
                                <span className="font-bold text-indigo-600">Therapy:</span> {rep.afternoonTherapy}
                              </div>
                            )}
                          </div>

                          {/* Night */}
                          <div className="space-y-1.5 md:pl-4">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">Malam</span>
                              <span className="text-[8.5px] font-bold text-slate-400 truncate max-w-[80px]" title={rep.nightRecordedBy}>By: {rep.nightRecordedBy || '-'}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                              {rep.nightReport || <span className="text-slate-300 italic">No report</span>}
                            </p>
                            {rep.nightTherapy && (
                              <div className="bg-slate-50 p-1.5 rounded-lg text-[9.5px]">
                                <span className="font-bold text-indigo-600">Therapy:</span> {rep.nightTherapy}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 border-2 border-dashed rounded-3xl flex items-center justify-center text-slate-450 text-xs italic font-bold">
                    Tidak ada laporan keperawatan harian terdaftar untuk pasien ini.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-slate-50 border-t flex justify-between items-center shrink-0">
          <div>
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-50 outline-none"
                >
                  <Check size={14} /> Simpan Perubahan
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 transition-colors text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5 cursor-pointer outline-none"
                >
                  <RotateCcw size={14} /> Batal
                </button>
              </div>
            ) : (
              onSave && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="px-5 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-100 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm outline-none"
                >
                  <Edit2 size={13} /> Edit Data Rekam Medis
                </button>
              )
            )}
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 transition-colors text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer active:scale-95"
          >
            Tutup Detail
          </button>
        </div>
      </div>
    </div>
  );
};
