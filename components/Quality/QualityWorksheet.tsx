
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { QualityIndicator, QualityMeasurement, MasterData, User as AppUser, Patient, DailyReportEntry, compareDatesSafe } from '../../types';
import { Button } from '../Button';
import { 
  ClipboardCheck, Target, TrendingUp, TrendingDown, 
  Calendar, Info, Save, CheckCircle2, AlertTriangle,
  History, Search, Filter, LayoutGrid, User, ShieldCheck,
  Stethoscope, Zap, Plus, Trash2, Check, X, ClipboardList, Minus,
  Printer, FileSpreadsheet
} from 'lucide-react';

interface QualityWorksheetProps {
  indicators: QualityIndicator[];
  measurements: QualityMeasurement[];
  onSaveMeasurement: (m: QualityMeasurement) => void;
  currentUser: AppUser | null;
  masterData: MasterData;
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  selectedDate?: string;
  setSelectedDate?: (date: string) => void;
  onUpdateMasterData?: (newMasterData: MasterData) => void;
}

// Detailed Audit Components
const HandHygieneAuditForm: React.FC<{
  data: any[];
  onChange: (newData: any[]) => void;
  auditInfo: { observer: string; unit: string };
  onInfoChange: (info: any) => void;
  masterData: MasterData;
}> = ({ data, onChange, auditInfo, onInfoChange, masterData }) => {
  const addRow = () => {
    onChange([...data, { 
      id: Date.now(), 
      code: '',
      prof: 'Perawat',
      moments: [], 
      action: 'HR',
      gloves: false 
    }]);
  };

  const removeRow = (id: number) => {
    const next = data.filter(d => d.id !== id);
    onChange(next);
  };

  const updateRow = (id: number, field: string, val: any) => {
    const next = data.map(d => d.id === id ? { ...d, [field]: val } : d);
    onChange(next);
  };

  const toggleMoment = (rowId: number, momentId: string) => {
    const row = data.find(r => r.id === rowId);
    if (!row) return;
    const currentMoments = row.moments || [];
    const nextMoments = currentMoments.includes(momentId)
      ? currentMoments.filter((id: string) => id !== momentId)
      : [...currentMoments, momentId];
    updateRow(rowId, 'moments', nextMoments);
  };

  const moments = [
    { id: '1', label: '1. Sebelum Kontak dengan Pasien' },
    { id: '2', label: '2. Sebelum Tindakan Aseptik' },
    { id: '3', label: '3. Setelah Terkena Cairan Tubuh Pasien' },
    { id: '4', label: '4. Setelah Kontak dengan Pasien' },
    { id: '5', label: '5. Setelah Kontak dengan Lingkungan Pasien' },
  ];

  const staffList = masterData.nurses || [];
  const unitList = masterData.units || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#144272]/5 p-6 rounded-[2rem] border border-[#144272]/10">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-[#144272] uppercase tracking-widest">Observer / Petugas</label>
          <select 
            className="w-full bg-white border rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
            value={auditInfo.observer || ''}
            onChange={e => onInfoChange({ ...auditInfo, observer: e.target.value })}
          >
            <option value="">-- Pilih Observer --</option>
            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-[#144272] uppercase tracking-widest">Unit / Ruang</label>
          <select 
            className="w-full bg-white border rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
            value={auditInfo.unit || ''}
            onChange={e => onInfoChange({ ...auditInfo, unit: e.target.value })}
          >
            <option value="">-- Pilih Ruangan --</option>
            {unitList.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-2xl bg-slate-50/50">
        <table className="w-full text-[10px] text-left">
          <thead className="bg-[#144272] text-white font-black uppercase tracking-widest">
            <tr>
              <th className="p-3">N°</th>
              <th className="p-3">Responden</th>
              <th className="p-3">Profesi</th>
              <th className="p-3">Indikasi (5 Moments)</th>
              <th className="p-3">Tindakan HH</th>
              <th className="p-3 text-center">Sarung Tangan</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.map((row, idx) => (
              <tr key={row.id} className="bg-white hover:bg-blue-50/50 transition-colors">
                <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                <td className="p-3">
                  <select 
                    className="bg-transparent border-none font-bold text-slate-700 focus:ring-0 w-full"
                    value={row.code || ''}
                    onChange={e => updateRow(row.id, 'code', e.target.value)}
                  >
                    <option value="">-- Pilih --</option>
                    {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <select 
                    className="bg-transparent border-none font-bold text-slate-700 focus:ring-0 w-full"
                    value={row.prof}
                    onChange={e => updateRow(row.id, 'prof', e.target.value)}
                  >
                    <option value="Perawat">Perawat</option>
                    <option value="Dokter">Dokter</option>
                    <option value="CS">CS</option>
                    <option value="Nakes Lain">Lainnya</option>
                  </select>
                </td>
                <td className="p-3">
                   <div className="flex flex-wrap gap-1">
                      {moments.map(m => (
                        <button 
                          key={m.id}
                          onClick={() => toggleMoment(row.id, m.id)}
                          className={`w-6 h-6 rounded-lg text-[10px] font-black transition-all border flex items-center justify-center ${row.moments?.includes(m.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                          title={m.label}
                        >
                          {m.id}
                        </button>
                      ))}
                   </div>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {['HR', 'HW', 'tdk'].map(act => (
                      <button 
                        key={act}
                        onClick={() => updateRow(row.id, 'action', act)}
                        className={`px-3 py-1 rounded-full font-black uppercase border transition-all ${row.action === act ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-center">
                  <button 
                    onClick={() => updateRow(row.id, 'gloves', !row.gloves)}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center mx-auto transition-all ${row.gloves ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-300'}`}
                  >
                    {row.gloves && <Check size={14}/>}
                  </button>
                </td>
                <td className="p-3 text-center">
                  <button onClick={() => removeRow(row.id)} className="p-2 text-rose-300 hover:text-rose-50 hover:bg-rose-50 rounded-lg transition-all">
                    <Trash2 size={14}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="p-12 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-40">
            Klik tombol tambah untuk memulai observasi
          </div>
        )}
      </div>
      <Button onClick={addRow} variant="secondary" className="w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-600 font-black uppercase tracking-widest hover:bg-indigo-50 rounded-2xl">
        <Plus size={18} className="mr-2"/> Tambah Observasi Opportunity
      </Button>
    </div>
  );
};

const PPEAuditForm: React.FC<{
  data: any[];
  onChange: (newData: any[]) => void;
  masterData: MasterData;
}> = ({ data, onChange, masterData }) => {
  const items = [
    { id: 'hands', label: 'Sarung Tangan' },
    { id: 'masker', label: 'Masker Bedah' },
    { id: 'gown', label: 'Gaun / Apron' },
    { id: 'n95', label: 'Masker N95' },
    { id: 'shield', label: 'Face Shield' },
    { id: 'caps', label: 'Penutup Kepala' },
    { id: 'boots', label: 'Sepatu Boot' },
  ];

  const actionTemplates: Record<string, string[]> = {
    // Risiko Rendah (Sarung Tangan, Masker Bedah)
    'Mandi/Memandikan': ['hands', 'masker'],
    'Obat Oral': ['hands', 'masker'],
    'Tanda Vital': ['hands', 'masker'],
    'Transportasi Rutin': ['hands', 'masker'],
    // Risiko Sedang (Sarung Tangan, Gaun/Apron, Masker Bedah)
    'Perawatan Luka': ['hands', 'masker', 'gown'],
    'Ganti Perban': ['hands', 'masker', 'gown'],
    'BAB/BAK (Pispot)': ['hands', 'masker', 'gown'],
    'Kateter Urin': ['hands', 'masker', 'gown'],
    'Infus / Injeksi': ['hands', 'masker', 'gown'],
    'Dekontaminasi': ['hands', 'masker', 'gown'],
    // Risiko Tinggi (APD Lengkap)
    'Suctioning': ['hands', 'gown', 'n95', 'shield', 'caps', 'boots'],
    'Trakeostomi': ['hands', 'gown', 'n95', 'shield', 'caps', 'boots'],
    'Ventilator/Intubasi': ['hands', 'gown', 'n95', 'shield', 'caps', 'boots'],
    'Persalinan': ['hands', 'gown', 'n95', 'shield', 'caps', 'boots'],
    'Pasien Airborne': ['hands', 'gown', 'n95', 'shield', 'caps', 'boots'],
  };

  const addRow = () => {
    const defaultAction = 'Perawatan Luka';
    onChange([...data, { 
      id: Date.now(), 
      name: '', 
      actionType: defaultAction,
      compliance: Object.fromEntries(items.map(i => [i.id, true]))
    }]);
  };

  const removeRow = (id: number) => {
    const next = data.filter(d => d.id !== id);
    onChange(next);
  };

  const updateRow = (id: number, field: string, val: any) => {
    const next = data.map(d => d.id === id ? { ...d, [field]: val } : d);
    onChange(next);
  };

  const toggleCompliance = (rowId: number, itemId: string) => {
    const row = data.find(r => r.id === rowId);
    if (!row) return;
    const newComp = { ...row.compliance, [itemId]: !row.compliance[itemId] };
    updateRow(rowId, 'compliance', newComp);
  };

  const staffList = masterData.nurses || [];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border rounded-2xl bg-slate-50/50">
        <table className="w-full text-[10px] text-left">
          <thead className="bg-[#144272] text-white font-black uppercase tracking-widest">
            <tr>
              <th className="p-3">Tgl / Petugas</th>
              <th className="p-3">Tindakan</th>
              {items.map(i => <th key={i.id} className="p-3 text-center">{i.label}</th>)}
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.map((row) => {
              const required = actionTemplates[row.actionType] || [];
              const score = required.filter(itemId => row.compliance[itemId] === true).length;
              const isCompliant = score === required.length;
              
              return (
                <tr key={row.id} className="bg-white hover:bg-blue-50/50 transition-colors">
                  <td className="p-3">
                    <select 
                      className="bg-transparent border-none font-black text-slate-700 focus:ring-0 p-0 w-full"
                      value={row.name}
                      onChange={e => updateRow(row.id, 'name', e.target.value)}
                    >
                      <option value="">-- Pilih --</option>
                      {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <select 
                      className="bg-transparent border-none font-bold text-indigo-600 focus:ring-0 p-0 w-full"
                      value={row.actionType}
                      onChange={e => updateRow(row.id, 'actionType', e.target.value)}
                    >
                      {Object.keys(actionTemplates).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>
                  {items.map(i => {
                    const isRequired = required.includes(i.id);
                    return (
                      <td key={i.id} className={`p-3 text-center ${isRequired ? 'bg-indigo-50/10' : 'opacity-40'}`}>
                        <button 
                          onClick={() => toggleCompliance(row.id, i.id)}
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center mx-auto transition-all ${row.compliance[i.id] ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-white border-slate-200 text-slate-400 group-hover:border-rose-200'} ${!isRequired && 'grayscale opacity-50'}`}
                        >
                          {row.compliance[i.id] ? <Check size={16}/> : <X size={16} className="opacity-20"/>}
                        </button>
                        {!isRequired && <div className="text-[7px] text-slate-400/50 mt-1 uppercase font-black">N/A</div>}
                      </td>
                    );
                  })}
                  <td className="p-3 text-center">
                    <span className={`px-3 py-1 rounded-full font-black uppercase text-[8px] ${isCompliant ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'bg-rose-100 text-rose-700 shadow-sm animate-pulse'}`}>
                      {isCompliant ? 'PATUH' : 'TIDAK'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => removeRow(row.id)} className="p-2 text-rose-300 hover:text-rose-50 hover:bg-rose-50 rounded-lg transition-all">
                      <Trash2 size={14}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="p-12 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-40">
            Belum ada observasi hari ini
          </div>
        )}
      </div>
      <Button onClick={addRow} variant="secondary" className="w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-600 font-black uppercase tracking-widest hover:bg-indigo-50 rounded-2xl">
        <Plus size={18} className="mr-2"/> Tambah Petugas Terobservasi
      </Button>
    </div>
  );
};

const PatientIdAuditForm: React.FC<{
  data: any[];
  onChange: (newData: any[]) => void;
}> = ({ data, onChange }) => {
  const interventionItems = [
    { id: 'obat', label: 'Pemberian Obat' },
    { id: 'infus', label: 'Pemberian Cairan Intravena' },
    { id: 'emergency', label: 'Prosedur Tindakan dan Gawat Darurat' },
    { id: 'kia', label: 'Prosedur Tindakan di Ruang KIA, KB, Anak & Imunisasi' },
    { id: 'gigi', label: 'Prosedur Tindakan di Ruang Yankes Gigi' },
    { id: 'sample', label: 'Prosedur Pengambilan Sample' },
  ];

  const addRow = () => {
    onChange([...data, { 
      id: Date.now(), 
      patientName: '', 
      interventions: Object.fromEntries(interventionItems.map(i => [i.id, 'NONE'])) // 'YA', 'TIDAK', 'NONE'
    }]);
  };

  const removeRow = (id: number) => {
    const next = data.filter(d => d.id !== id);
    onChange(next);
  };

  const updateRow = (id: number, field: string, val: any) => {
    const next = data.map(d => d.id === id ? { ...d, [field]: val } : d);
    onChange(next);
  };

  const setStatus = (rowId: number, itemId: string, status: 'YA' | 'TIDAK' | 'NONE') => {
    const row = data.find(r => r.id === rowId);
    if (!row) return;
    const nextInterventions = { ...row.interventions, [itemId]: status };
    updateRow(rowId, 'interventions', nextInterventions);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border rounded-[2rem] bg-slate-50/50 shadow-inner">
        <table className="w-full text-left">
          <thead className="bg-[#144272] text-white text-[10px] uppercase font-black tracking-[0.2em]">
            <tr>
               <th className="p-6">Nama / No RM Pasien</th>
               <th className="p-6">Tindakan Intervensi</th>
               <th className="p-6 text-center">Identifikasi YA</th>
               <th className="p-6 text-center">Identifikasi TIDAK</th>
               <th className="p-6 text-center">Tidak Ada Intervensi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, idx) => (
              <React.Fragment key={row.id}>
                {interventionItems.map((item, iIdx) => (
                  <tr key={`${row.id}-${item.id}`} className={`${iIdx === 0 ? 'border-t-4 border-[#144272]/10' : ''} bg-white hover:bg-slate-50 transition-colors`}>
                    {iIdx === 0 && (
                      <td className="p-6 align-top" rowSpan={interventionItems.length}>
                        <div className="flex flex-col gap-2">
                           <input 
                              className="font-black text-slate-800 bg-transparent border-none p-0 focus:ring-0 text-sm"
                              placeholder="Nama/RM Pasien..."
                              value={row.patientName}
                              onChange={e => updateRow(row.id, 'patientName', e.target.value)}
                           />
                           <button onClick={() => removeRow(row.id)} className="w-fit p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all flex items-center gap-1 uppercase font-black text-[9px]">
                             <Trash2 size={12}/> Hapus Pasien
                           </button>
                        </div>
                      </td>
                    )}
                    <td className="p-4 px-6 font-bold text-slate-600 text-xs">{item.label}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => setStatus(row.id, item.id, 'YA')}
                        className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center mx-auto transition-all ${row.interventions[item.id] === 'YA' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-white border-slate-100 text-slate-200'}`}
                      >
                         <Check size={18}/>
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => setStatus(row.id, item.id, 'TIDAK')}
                        className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center mx-auto transition-all ${row.interventions[item.id] === 'TIDAK' ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-100' : 'bg-white border-slate-100 text-slate-200'}`}
                      >
                         <X size={18}/>
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => setStatus(row.id, item.id, 'NONE')}
                        className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center mx-auto transition-all ${row.interventions[item.id] === 'NONE' ? 'bg-slate-500 border-slate-500 text-white shadow-lg shadow-slate-100' : 'bg-white border-slate-100 text-slate-200'}`}
                      >
                         <Minus size={18}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-40 flex flex-col items-center gap-4">
             <User size={48} />
             Belum ada audit Identifikasi hari ini
          </div>
        )}
      </div>
      <Button onClick={addRow} variant="secondary" className="w-full py-5 border-2 border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-[2rem] transition-all">
        <Plus size={20} className="mr-2" /> Tambah Audit Pasien Baru
      </Button>
    </div>
  );
};


const ClinicalPathwayAuditForm: React.FC<{
  data: any[];
  onChange: (newData: any[]) => void;
}> = ({ data, onChange }) => {
  const [customDiagnoses, setCustomDiagnoses] = useState<string[]>(['SUSPECT CA MAMAE', 'ESWL', 'APPENDICITIS', 'HERNIA']);
  const [newDiagnosis, setNewDiagnosis] = useState('');

  const checkItems = [
    { id: 'assess', label: 'Asesmen Kerja' },
    { id: 'labs', label: 'Penunjang' },
    { id: 'surgery', label: 'Tindakan' },
    { id: 'pharmacy', label: 'Farmasi' },
    { id: 'los', label: 'LOS' },
    { id: 'discharge', label: 'Planning' },
  ];

  const addRow = () => {
    onChange([...data, { 
      id: Date.now(), 
      patientName: '', 
      diagnosis: customDiagnoses[0],
      compliance: Object.fromEntries(checkItems.map(i => [i.id, true]))
    }]);
  };

  const addDiagnosisType = () => {
    if (!newDiagnosis.trim()) return;
    if (customDiagnoses.includes(newDiagnosis.trim().toUpperCase())) return;
    setCustomDiagnoses([...customDiagnoses, newDiagnosis.trim().toUpperCase()]);
    setNewDiagnosis('');
  };

  const removeRow = (id: number) => {
    const next = data.filter(d => d.id !== id);
    onChange(next);
  };

  const updateRow = (id: number, field: string, val: any) => {
    const next = data.map(d => d.id === id ? { ...d, [field]: val } : d);
    onChange(next);
  };

  const toggleCompliance = (rowId: number, itemId: string) => {
    const row = data.find(r => r.id === rowId);
    if (!row) return;
    const newComp = { ...row.compliance, [itemId]: !row.compliance[itemId] };
    updateRow(rowId, 'compliance', newComp);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
        <input 
          type="text"
          className="flex-1 bg-slate-50 border-none px-4 py-2 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20"
          placeholder="Input Nama Diagnosis Cp Baru..."
          value={newDiagnosis}
          onChange={e => setNewDiagnosis(e.target.value)}
        />
        <Button onClick={addDiagnosisType} variant="secondary" className="px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest bg-indigo-600 text-white hover:bg-indigo-700">
          <Plus size={14} className="mr-2"/> Tambah Jenis Cp
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-[2rem] bg-slate-50/50 shadow-inner">
        <table className="w-full text-left">
          <thead className="bg-[#144272] text-white text-[10px] uppercase font-black tracking-[0.2em]">
            <tr>
               <th className="p-6">No RM / Nama Pasien</th>
               <th className="p-6">Diagnosa CP</th>
               {checkItems.map(i => <th key={i.id} className="p-4 text-center">{i.label}</th>)}
               <th className="p-6 text-center">Status</th>
               <th className="p-6 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => {
              const score = Object.values(row.compliance).filter(v => v === true).length;
              const isFull = score === checkItems.length;
              return (
                <tr key={row.id} className="bg-white hover:bg-slate-50 transition-colors">
                   <td className="p-4 px-6">
                      <input 
                        className="bg-transparent border-none font-black text-slate-800 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs"
                        placeholder="Nama/RM Pasien..."
                        value={row.patientName}
                        onChange={e => updateRow(row.id, 'patientName', e.target.value)}
                      />
                   </td>
                   <td className="p-4 px-6">
                      <select 
                        className="bg-transparent border-none font-bold text-indigo-600 focus:ring-0 p-0 w-full text-xs"
                        value={row.diagnosis}
                        onChange={e => updateRow(row.id, 'diagnosis', e.target.value)}
                      >
                         {customDiagnoses.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                   </td>
                   {checkItems.map(i => (
                     <td key={i.id} className="p-4 text-center">
                        <button 
                          onClick={() => toggleCompliance(row.id, i.id)}
                          className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center mx-auto transition-all ${row.compliance[i.id] ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 text-slate-300'}`}
                        >
                          {row.compliance[i.id] ? <Check size={18}/> : <X size={18} className="opacity-20"/>}
                        </button>
                     </td>
                   ))}
                   <td className="p-4 text-center">
                      <span className={`px-4 py-1.5 rounded-full font-black text-[9px] uppercase tracking-widest ${isFull ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {isFull ? 'PATUH' : 'TIDAK PATUH'}
                      </span>
                   </td>
                   <td className="p-4 text-center">
                      <button onClick={() => removeRow(row.id)} className="p-2 text-rose-300 hover:text-rose-600 bg-rose-50/0 hover:bg-rose-50 rounded-xl transition-all">
                        <Trash2 size={16}/>
                      </button>
                   </td>
                </tr>
              );
            })}
          </tbody>
        </table>
         {data.length === 0 && (
          <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-40 flex flex-col items-center gap-4">
             <ClipboardList size={48} />
             Belum ada audit Clinical Pathway yang diinput
          </div>
        )}
      </div>
      <Button onClick={addRow} variant="secondary" className="w-full py-5 border-2 border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-[2rem] transition-all">
        <Plus size={20} className="mr-2"/> Input Audit Clinical Pathway Pasien Baru
      </Button>
    </div>
  );
};

const OperasiElektifAuditForm: React.FC<{
  data: any[];
  onChange: (newData: any[]) => void;
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  selectedDate: string;
}> = ({ data, onChange, patients, dailyReports, selectedDate }) => {
  const addRow = () => {
    onChange([...data, {
      id: Date.now() + Math.random(),
      date: selectedDate,
      patientName: '',
      noRM: '',
      origin: 'POLI',
      dpjp: '',
      admissionDate: '',
      planDate: selectedDate,
      opDate: selectedDate,
      diagnosis: '',
      procedure: '',
      status: 'PERFORMED',
      delayReason: ''
    }]);
  };

  const syncFromSchedules = () => {
    const matchedSchedules: any[] = [];
    dailyReports.forEach(r => {
      const isTargetDate = r.surgeryDate === selectedDate || r.date === selectedDate;
      if (isTargetDate && r.surgeryProcedure && r.surgeryProcedure.trim() !== '') {
        const p = patients.find(pat => pat.id === r.patientId);
        matchedSchedules.push({
          patientId: r.patientId,
          name: p?.name || 'Pasien',
          noRM: p?.noRM || '',
          origin: p?.origin || 'IGD',
          dpjp: r.surgeryOperator || p?.dpjpList?.[0] || '',
          admissionDate: p?.entryDate || '',
          planDate: r.surgeryDate || r.date || selectedDate,
          opDate: r.surgeryStatus === 'PERFORMED' ? (r.surgeryDate || r.date || selectedDate) : '',
          diagnosis: r.diagnosis || p?.diagnosaUtama || '',
          procedure: r.surgeryProcedure || p?.tindakanProsedur || '',
          status: r.surgeryStatus || 'SCHEDULED',
          delayReason: r.surgeryDelayReason || ''
        });
      }
    });

    const newData = [...data];
    matchedSchedules.forEach(item => {
      const exists = newData.some(d => (item.noRM && d.noRM === item.noRM) || d.patientName === item.name);
      if (!exists) {
        newData.push({
          id: Date.now() + Math.random(),
          date: item.planDate || selectedDate,
          patientName: item.name,
          noRM: item.noRM,
          origin: item.origin,
          dpjp: item.dpjp,
          admissionDate: item.admissionDate,
          planDate: item.planDate,
          opDate: item.opDate,
          diagnosis: item.diagnosis,
          procedure: item.procedure,
          status: item.status,
          delayReason: item.delayReason
        });
      }
    });

    onChange(newData);
  };

  const removeRow = (id: number) => {
    onChange(data.filter(d => d.id !== id));
  };

  const updateRow = (id: number, field: string, val: any) => {
    onChange(data.map(d => d.id === id ? { ...d, [field]: val } : d));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-2">
        <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Metode Sinkronisasi Otomatis</span>
        <Button onClick={syncFromSchedules} variant="secondary" className="px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest bg-[#144272] text-white hover:bg-opacity-90 shadow-xl flex items-center gap-2">
          <Zap size={14}/> Tarik Data dari Jadwal Tindakan ({selectedDate})
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-[2rem] bg-slate-50/50 shadow-inner">
        <table className="min-w-[1400px] text-left table-fixed">
          <thead className="bg-[#144272] text-white text-[9px] uppercase font-black tracking-wider">
            <tr>
              <th className="p-4 pl-6 w-[50px]">No</th>
              <th className="p-4 w-[110px]">Hari, Tgl</th>
              <th className="p-4 w-[160px]">Nama Pasien</th>
              <th className="p-4 w-[100px]">No. RM</th>
              <th className="p-4 w-[110px]">Asal Masuk</th>
              <th className="p-4 w-[160px]">DPJP (Operator)</th>
              <th className="p-4 w-[110px]">Tgl MRS</th>
              <th className="p-4 w-[110px]">Rencana OP</th>
              <th className="p-4 w-[110px]">Tgl OP</th>
              <th className="p-4 w-[180px]">Diagnosa</th>
              <th className="p-4 w-[185px]">Nama Tindakan</th>
              <th className="p-4 w-[150px]">Status</th>
              <th className="p-4 w-[155px]">Alasan Penundaan</th>
              <th className="p-4 text-center w-[60px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {data.map((row, index) => (
              <tr key={row.id} className="bg-white hover:bg-slate-50 transition-colors">
                <td className="p-3 pl-6 font-bold text-slate-400">{index + 1}</td>
                <td className="p-3">
                  <input
                    type="text"
                    className="bg-transparent border-none font-bold text-slate-700 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs"
                    value={row.date || selectedDate}
                    onChange={e => updateRow(row.id, 'date', e.target.value)}
                    placeholder="Hari, Tgl"
                  />
                </td>
                <td className="p-3">
                  <input
                    className="bg-transparent border-none font-black text-slate-800 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs"
                    placeholder="Nama Pasien..."
                    value={row.patientName}
                    onChange={e => updateRow(row.id, 'patientName', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="bg-transparent border-none font-bold text-slate-700 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs"
                    placeholder="RM..."
                    value={row.noRM || ''}
                    onChange={e => updateRow(row.id, 'noRM', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <select
                    className="bg-transparent border-none font-semibold text-slate-700 focus:ring-0 p-0 w-full text-xs"
                    value={row.origin || 'POLI'}
                    onChange={e => updateRow(row.id, 'origin', e.target.value)}
                  >
                    <option value="IGD">IGD</option>
                    <option value="POLI">POLI</option>
                    <option value="RAWAT INAP">RAWAT INAP</option>
                  </select>
                </td>
                <td className="p-3">
                  <input
                    className="bg-transparent border-none font-medium text-slate-600 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs"
                    placeholder="DPJP..."
                    value={row.dpjp || row.operator || ''}
                    onChange={e => updateRow(row.id, 'dpjp', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <input
                    type="date"
                    className="bg-transparent border-none font-medium text-slate-600 focus:ring-0 p-0 w-full text-xs"
                    value={row.admissionDate || ''}
                    onChange={e => updateRow(row.id, 'admissionDate', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <input
                    type="date"
                    className="bg-transparent border-none font-medium text-slate-600 focus:ring-0 p-0 w-full text-xs"
                    value={row.planDate || selectedDate}
                    onChange={e => updateRow(row.id, 'planDate', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <input
                    type="date"
                    className="bg-transparent border-none font-medium text-slate-600 focus:ring-0 p-0 w-full text-xs"
                    value={row.opDate || ''}
                    onChange={e => updateRow(row.id, 'opDate', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <textarea
                    rows={1}
                    className="bg-transparent border-none font-medium text-slate-600 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs resize-none"
                    placeholder="Diagnosa..."
                    value={row.diagnosis || ''}
                    onChange={e => updateRow(row.id, 'diagnosis', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <textarea
                    rows={1}
                    className="bg-transparent border-none font-medium text-slate-600 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs resize-none"
                    placeholder="Tindakan..."
                    value={row.procedure || ''}
                    onChange={e => updateRow(row.id, 'procedure', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <select
                    className={`bg-slate-50 border p-1 rounded font-black text-[10px] uppercase tracking-tight w-full ${
                      row.status === 'PERFORMED' ? 'bg-emerald-50 text-emerald-700 border-emerald-250' : 'bg-rose-50 text-rose-700 border-rose-250'
                    }`}
                    value={row.status || 'SCHEDULED'}
                    onChange={e => {
                      const nextStatus = e.target.value;
                      const nextOpDate = nextStatus === 'PERFORMED' ? (row.opDate || selectedDate) : '';
                      onChange(data.map(d => d.id === row.id ? { ...d, status: nextStatus, opDate: nextOpDate } : d));
                    }}
                  >
                    <option value="PERFORMED">TERLAKSANA (PATUH)</option>
                    <option value="DELAYED">DITUNDA (TIDAK PATUH)</option>
                    <option value="CANCELLED">DIBATALKAN</option>
                    <option value="SCHEDULED">DAPAT JADWAL</option>
                  </select>
                </td>
                <td className="p-3">
                  <input
                    className="bg-slate-50 border px-1 py-1 rounded text-[10px] font-medium w-full"
                    placeholder="Alasan penundaan..."
                    value={row.delayReason || ''}
                    disabled={row.status === 'PERFORMED'}
                    onChange={e => updateRow(row.id, 'delayReason', e.target.value)}
                  />
                </td>
                <td className="p-3 text-center">
                  <button onClick={() => removeRow(row.id)} className="p-1 text-rose-300 hover:text-rose-600 bg-rose-50/0 hover:bg-rose-50 rounded-lg transition-all">
                    <Trash2 size={14}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-40 flex flex-col items-center gap-4">
            <AlertTriangle size={48} />
            Belum ada rencana operasi elektif yang di-audit hari ini
          </div>
        )}
      </div>
      <Button onClick={addRow} variant="secondary" className="w-full py-5 border-2 border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-[2rem] transition-all">
        <Plus size={20} className="mr-2"/> Tambah Pasien Operasi Baru
      </Button>
    </div>
  );
};

const KetergantunganPasienAuditForm: React.FC<{
  data: any[];
  onChange: (newData: any[]) => void;
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  selectedDate: string;
}> = ({ data, onChange, patients, dailyReports, selectedDate }) => {
  const syncFromActivePatients = () => {
    const active = patients.filter(p => !p.dischargeDate || p.dischargeDate >= selectedDate);
    
    const newData = [...data];
    active.forEach(p => {
      // Robust matching to avoid blank string matching issues
      const existingIdx = newData.findIndex(d => {
        const hasRm = p.noRM && p.noRM.trim() !== '';
        if (hasRm) {
          return d.patientName.includes(p.noRM);
        }
        return p.name && p.name.trim() !== '' && d.patientName.includes(p.name);
      });
      const r = dailyReports.find(rep => rep.patientId === p.id && rep.date === selectedDate);
      
      if (existingIdx !== -1) {
        // Enforce update with the latest filled entries from the nursing daily report
        newData[existingIdx] = {
          ...newData[existingIdx],
          morning: r?.morningDependency || newData[existingIdx].morning || '',
          afternoon: r?.afternoonDependency || newData[existingIdx].afternoon || '',
          night: r?.nightDependency || newData[existingIdx].night || '',
          compliant: !!(r?.morningDependency || r?.afternoonDependency || r?.nightDependency || newData[existingIdx].compliant)
        };
      } else {
        newData.push({
          id: Date.now() + Math.random(),
          patientName: `${p.name} (${p.noRM})`,
          roomBed: `${p.ruangan || '-'} / ${p.nomorBed || '-'}`,
          morning: r?.morningDependency || '',
          afternoon: r?.afternoonDependency || '',
          night: r?.nightDependency || '',
          compliant: !!(r?.morningDependency || r?.afternoonDependency || r?.nightDependency)
        });
      }
    });

    onChange(newData);
  };

  const removeRow = (id: number) => {
    onChange(data.filter(d => d.id !== id));
  };

  const updateRow = (id: number, field: string, val: any) => {
    onChange(data.map(d => d.id === id ? { ...d, [field]: val } : d));
  };

  const addRow = () => {
    onChange([...data, {
      id: Date.now() + Math.random(),
      patientName: '',
      roomBed: '',
      morning: '',
      afternoon: '',
      night: '',
      compliant: false
    }]);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 mb-2">
        <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Metode Tarik Otomatis Laporan Shift</span>
        <Button onClick={syncFromActivePatients} variant="secondary" className="px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl flex items-center gap-2">
          <Zap size={14}/> Tarik Tingkat Ketergantungan Pasien Aktif ({selectedDate})
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-[2rem] bg-slate-50/50 shadow-inner">
        <table className="w-full text-left">
          <thead className="bg-[#144272] text-white text-[10px] uppercase font-black tracking-[0.2em]">
            <tr>
              <th className="p-6">Nama Pasien / RM</th>
              <th className="p-6">Ruang / Bed</th>
              <th className="p-6">Shift Pagi</th>
              <th className="p-6">Shift Siang</th>
              <th className="p-6">Shift Malam</th>
              <th className="p-6 text-center">Status Pengisian</th>
              <th className="p-6 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => {
              const isFilled = !!(row.morning || row.afternoon || row.night);
              return (
                <tr key={row.id} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="p-4 px-6">
                    <input
                      className="bg-transparent border-none font-black text-slate-800 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs"
                      placeholder="Nama/RM Pasien..."
                      value={row.patientName}
                      onChange={e => updateRow(row.id, 'patientName', e.target.value)}
                    />
                  </td>
                  <td className="p-4 px-6">
                    <input
                      className="bg-transparent border-none font-extrabold text-indigo-600 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs"
                      placeholder="Ruangan/Bed..."
                      value={row.roomBed}
                      onChange={e => updateRow(row.id, 'roomBed', e.target.value)}
                    />
                  </td>
                  <td className="p-4 px-6">
                    <select
                      className="bg-transparent border-none font-bold text-slate-600 focus:ring-0 p-0 w-full text-xs uppercase"
                      value={row.morning || ''}
                      onChange={e => updateRow(row.id, 'morning', e.target.value)}
                    >
                      <option value="">Belum diisi</option>
                      <option value="MINIMAL">MINIMAL CARE</option>
                      <option value="PARSIAL">PARSIAL CARE</option>
                      <option value="TOTAL">TOTAL CARE</option>
                    </select>
                  </td>
                  <td className="p-4 px-6">
                    <select
                      className="bg-transparent border-none font-bold text-slate-600 focus:ring-0 p-0 w-full text-xs uppercase"
                      value={row.afternoon || ''}
                      onChange={e => updateRow(row.id, 'afternoon', e.target.value)}
                    >
                      <option value="">Belum diisi</option>
                      <option value="MINIMAL">MINIMAL CARE</option>
                      <option value="PARSIAL">PARSIAL CARE</option>
                      <option value="TOTAL">TOTAL CARE</option>
                    </select>
                  </td>
                  <td className="p-4 px-6">
                    <select
                      className="bg-transparent border-none font-bold text-slate-600 focus:ring-0 p-0 w-full text-xs uppercase"
                      value={row.night || ''}
                      onChange={e => updateRow(row.id, 'night', e.target.value)}
                    >
                      <option value="">Belum diisi</option>
                      <option value="MINIMAL">MINIMAL CARE</option>
                      <option value="PARSIAL">PARSIAL CARE</option>
                      <option value="TOTAL">TOTAL CARE</option>
                    </select>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded text-[8px] font-black uppercase ${
                      isFilled ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {isFilled ? 'Lengkap (Terisi)' : 'Belum Lengkap'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => removeRow(row.id)} className="p-2 text-rose-300 hover:text-rose-600 bg-rose-50/0 hover:bg-rose-50 rounded-xl transition-all">
                      <Trash2 size={16}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-40 flex flex-col items-center gap-4">
            <AlertTriangle size={48} />
            Belum ada audit pengisian tingkat ketergantungan pasien hari ini
          </div>
        )}
      </div>
      <Button onClick={addRow} variant="secondary" className="w-full py-5 border-2 border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-[2rem] transition-all">
        <Plus size={20} className="mr-2"/> Tambah Audit Pasien Baru
      </Button>
    </div>
  );
};

const APSListForm: React.FC<{
  data: any[];
  onChange: (newData: any[]) => void;
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  selectedDate: string;
}> = ({ data, onChange, patients, dailyReports, selectedDate }) => {
  const addRow = () => {
    onChange([...data, { 
      id: Date.now(), 
      patientName: '', 
      doctor: '',
      reason: 'BIAYA',
      otherReason: '',
      documented: true
    }]);
  };

  const syncFromPatients = () => {
    // Find patients who have "APS" status and were admitted or had reports on selectedDate
    // Actually, check statusDataPasien === 'APS'
    const apsPatients = patients.filter(p => p.statusDataPasien === 'APS' || p.caraKeluar === 'APS (Pulang Paksa)');
    
    const newData = [...data];
    apsPatients.forEach(p => {
      const exists = newData.some(d => d.patientName.includes(p.noRM) || d.patientName.includes(p.name));
      if (!exists) {
        newData.push({
          id: Date.now() + Math.random(),
          patientName: `${p.name} (${p.noRM})`,
          doctor: p.dpjpList?.[0] || '',
          reason: p.apsReason || 'KELUARGA',
          otherReason: '',
          documented: true
        });
      }
    });

    onChange(newData);
  };

  const removeRow = (id: number) => {
    const next = data.filter(d => d.id !== id);
    onChange(next);
  };

  const updateRow = (id: number, field: string, val: any) => {
    const next = data.map(d => d.id === id ? { ...d, [field]: val } : d);
    onChange(next);
  };

  const reasons = [
    { id: 'BIAYA', label: 'Masalah Biaya' },
    { id: 'KELUARGA', label: 'Permintaan Keluarga' },
    { id: 'FASILITAS', label: 'Fasilitas Kurang Memadai' },
    { id: 'SEMBUH', label: 'Merasa Sudah Sembuh' },
    { id: 'LAINNYA', label: 'Lainnya' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={syncFromPatients} variant="secondary" className="px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100 flex items-center gap-2">
          <Zap size={14}/> Sinkronisasi Otomatis dari Data Pasien
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-[2rem] bg-slate-50/50 shadow-inner">
        <table className="w-full text-left">
          <thead className="bg-[#144272] text-white text-[10px] uppercase font-black tracking-[0.2em]">
            <tr>
               <th className="p-6">Nama Pasien / RM</th>
               <th className="p-6">DPJP</th>
               <th className="p-6">Alasan APS</th>
               <th className="p-6 text-center">Terdokumentasi?</th>
               <th className="p-6 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => (
              <tr key={row.id} className="bg-white hover:bg-slate-50 transition-colors">
                <td className="p-4 px-6">
                  <input 
                    className="bg-transparent border-none font-black text-slate-800 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs"
                    placeholder="Nama/RM Pasien..."
                    value={row.patientName}
                    onChange={e => updateRow(row.id, 'patientName', e.target.value)}
                  />
                </td>
                <td className="p-4 px-6">
                  <input 
                    className="bg-transparent border-none font-bold text-indigo-600 focus:ring-0 p-0 w-full placeholder:text-slate-300 text-xs"
                    placeholder="Nama Dokter..."
                    value={row.doctor}
                    onChange={e => updateRow(row.id, 'doctor', e.target.value)}
                  />
                </td>
                <td className="p-4 px-6">
                  <div className="flex flex-col gap-1">
                    <select 
                      className="bg-transparent border-none font-bold text-slate-600 focus:ring-0 p-0 w-full text-xs"
                      value={row.reason}
                      onChange={e => updateRow(row.id, 'reason', e.target.value)}
                    >
                      {reasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    {row.reason === 'LAINNYA' && (
                      <input 
                        className="bg-slate-50 border-none px-2 py-1 rounded text-[10px] font-medium"
                        placeholder="Sebutkan alasan..."
                        value={row.otherReason}
                        onChange={e => updateRow(row.id, 'otherReason', e.target.value)}
                      />
                    )}
                  </div>
                </td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => updateRow(row.id, 'documented', !row.documented)}
                    className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center mx-auto transition-all ${row.documented ? 'bg-[#144272] border-[#144272] text-white shadow-lg' : 'bg-white border-slate-100 text-slate-200'}`}
                  >
                     <Check size={18}/>
                  </button>
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => removeRow(row.id)} className="p-2 text-rose-300 hover:text-rose-600 bg-rose-50/0 hover:bg-rose-50 rounded-xl transition-all">
                    <Trash2 size={16}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-40 flex flex-col items-center gap-4">
             <AlertTriangle size={48} />
             Belum ada laporan data pasien APS hari ini
          </div>
        )}
      </div>
      <Button onClick={addRow} variant="secondary" className="w-full py-5 border-2 border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-[2rem] transition-all">
        <Plus size={20} className="mr-2"/> Tambah Data Pasien APS
      </Button>
    </div>
  );
};

export const QualityWorksheet: React.FC<QualityWorksheetProps> = ({ 
  indicators, 
  measurements, 
  onSaveMeasurement,
  currentUser,
  masterData,
  patients,
  dailyReports,
  selectedDate: propsSelectedDate,
  setSelectedDate: propsSetSelectedDate,
  onUpdateMasterData
}) => {
  const [localSelectedDate, setLocalSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const selectedDate = propsSelectedDate || localSelectedDate;
  const setSelectedDate = propsSetSelectedDate || setLocalSelectedDate;
  
  const [activeTab, setActiveTab] = useState<'ENTRY' | 'SUMMARY' | 'ANALYSIS'>('ENTRY');
  
  const [localValues, setLocalValues] = useState<Record<string, { num: number, den: number, auditData?: any, auditInfo?: any }>>({});
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);

  // Month string state for evaluation, default to June 2026 as the active month
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-06-30');
  
  // State for active loaded monthly analysis dictionary: indicatorId -> MonthlyQualityAnalysis
  const [analysisStore, setAnalysisStore] = useState<Record<string, { problemAnalysis: string, actionPlan: string }>>(() => {
    try {
      const globalAnalysis = masterData?.settings?.qualityAnalysis;
      if (globalAnalysis && Object.keys(globalAnalysis).length > 0) {
        return globalAnalysis;
      }
      const saved = localStorage.getItem('simantap_quality_analysis');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Keep local analysis store in sync with real-time global settings updates
  React.useEffect(() => {
    const globalAnalysis = masterData?.settings?.qualityAnalysis;
    if (globalAnalysis && Object.keys(globalAnalysis).length > 0) {
      setAnalysisStore(globalAnalysis);
    }
  }, [masterData?.settings?.qualityAnalysis]);

  // Active selected indicator for entering monthly analysis details
  const [selectedIndicatorForAnalysis, setSelectedIndicatorForAnalysis] = useState<string | null>(null);

  // Temporary edit states for problemAnalysis and actionPlan
  const [tempProblemAnalysis, setTempProblemAnalysis] = useState('');
  const [tempActionPlan, setTempActionPlan] = useState('');

  // Handle saving the analysis
  const handleSaveAnalysis = (indicatorId: string) => {
    const key = `${selectedMonth}_${indicatorId}`;
    const updatedStore = {
      ...analysisStore,
      [key]: {
        problemAnalysis: tempProblemAnalysis,
        actionPlan: tempActionPlan
      }
    };
    setAnalysisStore(updatedStore);
    localStorage.setItem('simantap_quality_analysis', JSON.stringify(updatedStore));

    if (onUpdateMasterData) {
      onUpdateMasterData({
        ...masterData,
        settings: {
          ...(masterData.settings || {}),
          qualityAnalysis: updatedStore,
          settingsTimestamp: new Date().toISOString()
        }
      });
    }
  };

  // Load the analysis whenever indicator or month changes
  const loadAnalysisForIndicator = (indicatorId: string) => {
    setSelectedIndicatorForAnalysis(indicatorId);
    const key = `${selectedMonth}_${indicatorId}`;
    const existing = analysisStore[key] || { problemAnalysis: '', actionPlan: '' };
    setTempProblemAnalysis(existing.problemAnalysis || '');
    setTempActionPlan(existing.actionPlan || '');
  };

  const monthlyMetrics = useMemo(() => {
    return indicators.map(ind => {
      // Find all measurements in the measurements table for this indicator whose date shares the selected month
      const monthlyMeasurements = measurements.filter(m => 
        m.indicatorId === ind.id && m.date.startsWith(selectedMonth)
      );

      const totalNum = monthlyMeasurements.reduce((acc, m) => acc + m.numeratorValue, 0);
      const totalDen = monthlyMeasurements.reduce((acc, m) => acc + m.denominatorValue, 0);
      const score = totalDen === 0 ? 0 : (totalNum / totalDen) * 100;
      const status = score >= ind.target ? 'TERCAPAI' : 'BELUM TERCAPAI';

      const key = `${selectedMonth}_${ind.id}`;
      const analysisData = analysisStore[key] || { problemAnalysis: '', actionPlan: '' };

      return {
        ...ind,
        totalNum,
        totalDen,
        score,
        status,
        hasAnalysis: !!(analysisData.problemAnalysis || analysisData.actionPlan)
      };
    });
  }, [indicators, measurements, selectedMonth, analysisStore]);

  const scoringLogic = {
    'inm-1': (data: any[]) => {
      const den = data.length;
      const num = data.filter((d: any) => d.action === 'HR' || d.action === 'HW').length;
      return { num, den };
    },
    'inm-2': (data: any[]) => {
      const actionTemplates: Record<string, string[]> = {
        'Mandi/Memandikan': ['hands', 'masker'],
        'Obat Oral': ['hands', 'masker'],
        'Tanda Vital': ['hands', 'masker'],
        'Transportasi Rutin': ['hands', 'masker'],
        'Perawatan Luka': ['hands', 'masker', 'gown'],
        'Ganti Perban': ['hands', 'masker', 'gown'],
        'BAB/BAK (Pispot)': ['hands', 'masker', 'gown'],
        'Kateter Urin': ['hands', 'masker', 'gown'],
        'Infus / Injeksi': ['hands', 'masker', 'gown'],
        'Dekontaminasi': ['hands', 'masker', 'gown'],
        'Suctioning': ['hands', 'gown', 'n95', 'shield', 'caps', 'boots'],
        'Trakeostomi': ['hands', 'gown', 'n95', 'shield', 'caps', 'boots'],
        'Ventilator/Intubasi': ['hands', 'gown', 'n95', 'shield', 'caps', 'boots'],
        'Persalinan': ['hands', 'gown', 'n95', 'shield', 'caps', 'boots'],
        'Pasien Airborne': ['hands', 'gown', 'n95', 'shield', 'caps', 'boots'],
      };
      const den = data.length;
      const num = data.filter((d: any) => {
        const required = actionTemplates[d.actionType] || [];
        return required.every(itemId => d.compliance[itemId] === true);
      }).length;
      return { num, den };
    },
    'inm-3': (data: any[]) => {
      let totalInterventions = 0;
      let compliantInterventions = 0;
      data.forEach((row: any) => {
        ['obat', 'infus', 'emergency', 'kia', 'gigi', 'sample'].forEach(id => {
          const val = row.interventions?.[id];
          if (val === 'YA') {
            compliantInterventions++;
            totalInterventions++;
          } else if (val === 'TIDAK') {
            totalInterventions++;
          }
        });
      });
      return { num: compliantInterventions, den: totalInterventions };
    },
    'skp-1': (data: any[]) => {
       const den = data.length;
       const num = data.filter((d: any) => Object.values(d.compliance || {}).every(v => v === true)).length;
       return { num, den };
    },
    'skp-4': (data: any[]) => {
       const den = data.length;
       const num = data.filter((d: any) => d.documented).length;
       return { num, den };
    },
    'pathway-1': (data: any[]) => {
       const den = data.length;
       if (den === 0) return { num: 0, den: 0 };
       const num = data.filter((row: any) => {
         if (!row.compliance || Object.keys(row.compliance).length === 0) return false;
         return Object.values(row.compliance).every(v => v === true || v === 'true' || v === 'yes' || v === 1);
       }).length;
       return { num, den };
    },
    'aps-1': (data: any[]) => {
       const targetMonth = selectedDate.substring(0, 7); // e.g. "2026-06"
       const totalDischargedInMonth = patients.filter(p => p.dischargeDate && p.dischargeDate.startsWith(targetMonth)).length;
       const den = totalDischargedInMonth || data.length || 0;
       if (den === 0) return { num: 0, den: 0 };
       const num = data.filter((d: any) => d.documented).length;
       return { num, den };
    },
    'operasi-elektif-1': (data: any[]) => {
       const den = data.length;
       if (den === 0) return { num: 0, den: 0 };
       const num = data.filter((d: any) => d.status === 'PERFORMED').length;
       return { num, den };
    },
    'ketergantungan-pasien-1': (data: any[]) => {
       const den = data.length;
       if (den === 0) return { num: 0, den: 0 };
       const num = data.filter((d: any) => !!(d.morning || d.afternoon || d.night)).length;
       return { num, den };
    }
  };

  const calculatePercentage = (num: number, den: number) => {
    if (den === 0) return 0;
    return (num / den) * 100;
  };

  const handleExportExcel = () => {
    const tableData = filteredMeasurements.map(m => {
      const ind = indicators.find(i => i.id === m.indicatorId);
      const result = calculatePercentage(m.numeratorValue, m.denominatorValue);
      return {
        'Tanggal': m.date,
        'Indikator': ind?.title || m.indicatorId,
        'Kategori': ind?.category || '-',
        'Numerator': m.numeratorValue,
        'Denominator': m.denominatorValue,
        'Hasil (%)': result.toFixed(2),
        'Target (%)': ind?.target || 0,
        'Status': result >= (ind?.target || 0) ? 'TERCAPAI' : 'TIDAK TERCAPAI',
        'Recorded By': m.recordedBy,
        'Unit': m.unit || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Mutu');
    XLSX.writeFile(workbook, `Laporan_Mutu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF() as any;
    doc.text('LAPORAN CAPAIAN INDIKATOR MUTU', 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleString()}`, 14, 21);
    doc.text(`Rentang Laporan: ${startDate} s/d ${endDate}`, 14, 26);

    const tableData = filteredMeasurements.map(m => {
      const ind = indicators.find(i => i.id === m.indicatorId);
      const result = calculatePercentage(m.numeratorValue, m.denominatorValue);
      return [
        m.date,
        ind?.title || m.indicatorId,
        `${m.numeratorValue}/${m.denominatorValue}`,
        `${result.toFixed(1)}%`,
        ind?.target ? `${ind.target}%` : '-',
        result >= (ind?.target || 0) ? 'YA' : 'TIDAK'
      ];
    });

    doc.autoTable({
      head: [['Tanggal', 'Indikator', 'N/D', 'Hasil', 'Target', 'Capai']],
      body: tableData,
      startY: 32,
      theme: 'grid',
      headStyles: { fillStyle: '#144272', textColor: '#FFFFFF' }
    });

    doc.save(`Laporan_Mutu_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredMeasurements = useMemo(() => {
    let list = measurements || [];
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'BIDANG') {
      list = list.filter(m => m.unit === currentUser.unit);
    }
    if (startDate) {
      list = list.filter(m => m.date >= startDate);
    }
    if (endDate) {
      list = list.filter(m => m.date <= endDate);
    }
    return list;
  }, [measurements, currentUser, startDate, endDate]);

  const handleInputChange = (id: string, field: 'num' | 'den', val: string) => {
    const numVal = parseInt(val) || 0;
    setLocalValues(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { num: 0, den: 0 }),
        [field]: numVal
      }
    }));
  };

  const handleAuditChange = (id: string, auditData: any) => {
    setLocalValues(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { num: 0, den: 0 }),
        auditData
      }
    }));
  };

  const handleAuditInfoChange = (id: string, auditInfo: any) => {
    setLocalValues(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { num: 0, den: 0 }),
        auditInfo
      }
    }));
  };

  const getDefaultAuditData = (indicatorId: string, dateStr: string) => {
    if (indicatorId === 'ketergantungan-pasien-1') {
      const active = patients.filter(p => {
        const hasReportToday = dailyReports.some(rep => rep.patientId === p.id && rep.date === dateStr);
        const isDischarged = p.status === 'DISCHARGED' || (p.statusDataPasien && (
          p.statusDataPasien.toUpperCase().includes('BPL') ||
          p.statusDataPasien.toUpperCase().includes('PULANG') ||
          p.statusDataPasien.toUpperCase().includes('APS') ||
          p.statusDataPasien.toUpperCase().includes('RUJUK') ||
          p.statusDataPasien.toUpperCase().includes('PINDAH') ||
          p.statusDataPasien.toUpperCase().includes('MENINGGAL')
        ));
        const isCurrentlyTreated = !isDischarged || p.statusDataPasien === "Masih Dirawat" || p.statusDataPasien === "AKTIF" || !p.statusDataPasien;
        return isCurrentlyTreated || hasReportToday;
      });
      
      return active.map(p => {
        const r = dailyReports.find(rep => rep.patientId === p.id && rep.date === dateStr);
        return {
          id: Date.now() + Math.random(),
          patientName: `${p.name} (${p.noRM})`,
          roomBed: `${p.ruangan || '-'} / ${p.nomorBed || '-'}`,
          morning: r?.morningDependency || '',
          afternoon: r?.afternoonDependency || '',
          night: r?.nightDependency || '',
          compliant: !!(r?.morningDependency || r?.afternoonDependency || r?.nightDependency)
        };
      });
    }

    if (indicatorId === 'operasi-elektif-1') {
      const matchedSchedules: any[] = [];
      dailyReports.forEach(r => {
        const isTargetDate = r.surgeryDate === dateStr || r.date === dateStr;
        if (isTargetDate && r.surgeryProcedure && r.surgeryProcedure.trim() !== '') {
          const p = patients.find(pat => pat.id === r.patientId);
          matchedSchedules.push({
            id: Date.now() + Math.random(),
            date: r.surgeryDate || r.date || dateStr,
            patientName: p?.name || 'Pasien',
            noRM: p?.noRM || '',
            origin: p?.origin || 'POLI',
            dpjp: r.surgeryOperator || p?.dpjpList?.[0] || '',
            admissionDate: p?.entryDate || '',
            planDate: r.surgeryDate || r.date || dateStr,
            opDate: r.surgeryStatus === 'PERFORMED' ? (r.surgeryDate || r.date || dateStr) : '',
            diagnosis: r.diagnosis || p?.diagnosaUtama || '',
            procedure: r.surgeryProcedure || p?.tindakanProsedur || '',
            status: r.surgeryStatus || 'SCHEDULED',
            delayReason: r.surgeryDelayReason || ''
          });
        }
      });
      return matchedSchedules;
    }

    return undefined;
  };

  const getExistingMeasurement = (indicatorId: string) => {
    return filteredMeasurements.find(m => m.indicatorId === indicatorId && m.date === selectedDate);
  };

  const saveMeasurement = (indicator: QualityIndicator) => {
    const existing = getExistingMeasurement(indicator.id);
    const rawAudit = existing?.auditData;
    const defaultAudit = (!rawAudit || rawAudit.length === 0) ? getDefaultAuditData(indicator.id, selectedDate) : rawAudit;

    const values = localValues[indicator.id] || { 
      num: existing?.numeratorValue || 0, 
      den: existing?.denominatorValue || 0,
      auditData: defaultAudit,
      auditInfo: existing?.meta?.auditInfo
    };
    
    const calc = values.auditData && (scoringLogic as any)[indicator.id] 
      ? (scoringLogic as any)[indicator.id](values.auditData) 
      : { num: values.num, den: values.den };
    
    const measurement: QualityMeasurement = {
      id: existing?.id || `m-${Date.now()}`,
      indicatorId: indicator.id,
      date: selectedDate,
      numeratorValue: calc.num,
      denominatorValue: calc.den,
      recordedBy: currentUser?.name || 'User',
      unit: currentUser?.unit || '',
      auditData: values.auditData,
      meta: {
        auditInfo: values.auditInfo
      }
    };
    onSaveMeasurement(measurement);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Dynamic Header */}
      <div className="bg-gradient-to-br from-[#144272] via-[#205295] to-[#2c74b3] p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="max-w-xl">
            <h3 className="text-4xl font-black tracking-tighter mb-3 flex items-center gap-4">
              <ClipboardCheck size={40}/> Kertas Kerja Mutu {currentUser?.unit && ` - ${currentUser.unit}`}
            </h3>
            <p className="text-blue-100 font-medium text-sm leading-relaxed">
              Revision {new Date().getFullYear()} - Sesuai Standar Akreditasi & INM. 
              Gunakan mode audit untuk pencatatan detail observasi PPI/Keselamatan Pasien.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/20 shadow-inner flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <Calendar size={24}/>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-blue-200 mb-1">Pilih Tgl Pengukuran</label>
              <input 
                type="date" 
                className="bg-transparent border-none text-xl font-black focus:ring-0 outline-none p-0 cursor-pointer"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  setLocalValues({});
                  setExpandedIndicator(null);
                }}
              />
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <Target size={280} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/70 backdrop-blur-md p-1 rounded-2xl border shadow-sm w-fit border-[#144272]/10 animate-fade-in-down">
        <button 
          onClick={() => setActiveTab('ENTRY')}
          className={`px-8 sm:px-12 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ENTRY' ? 'bg-[#144272] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          Form Entri Harian
        </button>
        <button 
          onClick={() => setActiveTab('SUMMARY')}
          className={`px-8 sm:px-12 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SUMMARY' ? 'bg-[#144272] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          Ringkasan Capaian
        </button>
        <button 
          onClick={() => setActiveTab('ANALYSIS')}
          className={`px-8 sm:px-12 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ANALYSIS' ? 'bg-[#144272] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          Kertas Kerja Analisis Bulanan
        </button>
      </div>

      {activeTab === 'ENTRY' && (
        <div className="grid grid-cols-1 gap-8">
          {indicators.map(indicator => {
            const existing = getExistingMeasurement(indicator.id);
            const rawAudit = existing?.auditData;
            let defaultAudit = (!rawAudit || rawAudit.length === 0) ? getDefaultAuditData(indicator.id, selectedDate) : rawAudit;

            // Auto-enrich empty auditData fields with live nurse report data
            if (indicator.id === 'ketergantungan-pasien-1' && defaultAudit && defaultAudit.length > 0) {
              defaultAudit = defaultAudit.map((d: any) => {
                const p = patients.find(pat => {
                  const hasRm = pat.noRM && pat.noRM.trim() !== '';
                  if (hasRm) return d.patientName.includes(pat.noRM);
                  return pat.name && pat.name.trim() !== '' && d.patientName.includes(pat.name);
                });
                if (p) {
                  const r = dailyReports.find(rep => rep.patientId === p.id && rep.date === selectedDate);
                  if (r) {
                    return {
                      ...d,
                      morning: r.morningDependency || d.morning || '',
                      afternoon: r.afternoonDependency || d.afternoon || '',
                      night: r.nightDependency || d.night || '',
                      compliant: !!(r.morningDependency || r.afternoonDependency || r.nightDependency || d.compliant)
                    };
                  }
                }
                return d;
              });
            }

            const values = localValues[indicator.id] || { 
              num: existing?.numeratorValue || 0, 
              den: existing?.denominatorValue || 0,
              auditData: defaultAudit,
              auditInfo: existing?.meta?.auditInfo
            };

            // Real-time calculation if auditData exists
            const calc = values.auditData && (scoringLogic as any)[indicator.id] 
              ? (scoringLogic as any)[indicator.id](values.auditData) 
              : { num: values.num, den: values.den };

            const currentDraft = {
              num: calc.num,
              den: calc.den,
              auditData: values.auditData,
              auditInfo: values.auditInfo
            };
            
            const result = calculatePercentage(currentDraft.num, currentDraft.den);
            const isAchieved = result >= indicator.target;
            const isExpanded = expandedIndicator === indicator.id;

            return (
              <div key={indicator.id} className={`bg-white/70 backdrop-blur-md rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col transition-all duration-500 border-[#144272]/5 ${isExpanded ? 'ring-2 ring-indigo-500 shadow-2xl' : 'hover:shadow-xl'}`}>
                <div className="p-8 flex-1 flex flex-col">
                  <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="px-4 py-1.5 bg-blue-50 text-[9px] font-black text-blue-600 rounded-full border border-blue-100 uppercase tracking-widest">
                          {indicator.category}
                        </span>
                        { (indicator.id === 'inm-1' || indicator.id === 'inm-2' || indicator.id === 'inm-3' || indicator.id === 'pathway-1' || indicator.id === 'aps-1' || indicator.id === 'operasi-elektif-1' || indicator.id === 'ketergantungan-pasien-1') && (
                          <span className="px-4 py-1.5 bg-amber-50 text-[9px] font-black text-amber-600 rounded-full border border-amber-100 uppercase tracking-widest flex items-center gap-1.5">
                            <Zap size={10}/> Audit Mode Available
                          </span>
                        )}
                      </div>
                      <h4 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">{indicator.title}</h4>
                    </div>
                    <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                       <div className="text-right">
                          <div className={`text-4xl font-black tracking-tighter ${isAchieved ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {result.toFixed(1)}%
                          </div>
                          <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">TARGET: {indicator.target}%</div>
                       </div>
                       <div className="w-px h-10 bg-slate-200"></div>
                       <button 
                        onClick={() => setExpandedIndicator(isExpanded ? null : indicator.id)}
                        className={`p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${isExpanded ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-indigo-600 border border-indigo-200'}`}
                       >
                         {isExpanded ? 'Tutup Detail' : (['inm-1', 'inm-2', 'inm-3', 'pathway-1', 'aps-1', 'operasi-elektif-1', 'ketergantungan-pasien-1'].includes(indicator.id) ? 'Buka Form Audit' : 'Edit Data')}
                       </button>
                    </div>
                  </div>

                  {!isExpanded ? (
                    <div className="bg-slate-50/80 p-8 rounded-3xl border-2 border-dashed border-slate-100 mb-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl border flex items-center justify-center text-blue-600 font-black text-sm shrink-0 shadow-sm">1</div>
                          <div>
                            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Numerator (Pembilang)</div>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">{indicator.numerator}</p>
                            <div className="mt-4 text-2xl font-black text-slate-700">{currentDraft.num}</div>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl border flex items-center justify-center text-blue-600 font-black text-sm shrink-0 shadow-sm">2</div>
                          <div>
                            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Denominator (Penyebut)</div>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">{indicator.denominator}</p>
                            <div className="mt-4 text-2xl font-black text-slate-700">{currentDraft.den}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-fade-in space-y-8 mt-2">
                       {indicator.id === 'inm-1' ? (
                         <HandHygieneAuditForm 
                           data={currentDraft.auditData || []} 
                           onChange={(next) => handleAuditChange(indicator.id, next)}
                           auditInfo={currentDraft.auditInfo || { observer: '', unit: currentUser?.unit || '' }}
                           onInfoChange={(info) => handleAuditInfoChange(indicator.id, info)}
                           masterData={masterData}
                         />
                       ) : indicator.id === 'inm-2' ? (
                         <PPEAuditForm 
                           data={currentDraft.auditData || []} 
                           onChange={(next) => handleAuditChange(indicator.id, next)}
                           masterData={masterData}
                         />
                       ) : indicator.id === 'inm-3' ? (
                        <PatientIdAuditForm 
                          data={currentDraft.auditData || []} 
                          onChange={(next) => handleAuditChange(indicator.id, next)}
                        />
                       ) : indicator.id === 'pathway-1' ? (
                         <ClinicalPathwayAuditForm 
                          data={currentDraft.auditData || []} 
                          onChange={(next) => handleAuditChange(indicator.id, next)}
                        />
                       ) : indicator.id === 'operasi-elektif-1' ? (
                        <OperasiElektifAuditForm
                          data={currentDraft.auditData || []}
                          onChange={(next) => handleAuditChange(indicator.id, next)}
                          patients={patients}
                          dailyReports={dailyReports}
                          selectedDate={selectedDate}
                        />
                      ) : indicator.id === 'ketergantungan-pasien-1' ? (
                        <KetergantunganPasienAuditForm
                          data={currentDraft.auditData || []}
                          onChange={(next) => handleAuditChange(indicator.id, next)}
                          patients={patients}
                          dailyReports={dailyReports}
                          selectedDate={selectedDate}
                        />
                      ) : indicator.id === 'aps-1' ? (
                        <APSListForm 
                          data={currentDraft.auditData || []} 
                          onChange={(next) => handleAuditChange(indicator.id, next)}
                          patients={patients}
                          dailyReports={dailyReports}
                          selectedDate={selectedDate}
                        />
                       ) : (
                         <div className="grid grid-cols-2 gap-8 bg-blue-50/20 p-8 rounded-[2rem] border border-blue-100">
                           <div className="space-y-3">
                             <label className="block text-[11px] font-black text-blue-600 uppercase tracking-[0.2em]">Isi Numerator</label>
                             <input 
                               type="number" 
                               className="w-full bg-white border-2 border-slate-200 rounded-2xl p-5 text-3xl font-black text-slate-700 focus:border-[#144272] focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-inner"
                               value={currentDraft.num}
                               onChange={e => handleInputChange(indicator.id, 'num', e.target.value)}
                               placeholder="0"
                             />
                             <p className="text-[9px] text-slate-400 font-bold leading-tight">{indicator.numerator}</p>
                           </div>
                           <div className="space-y-3">
                             <label className="block text-[11px] font-black text-blue-600 uppercase tracking-[0.2em]">Isi Denominator</label>
                             <input 
                               type="number" 
                               className="w-full bg-white border-2 border-slate-200 rounded-2xl p-5 text-3xl font-black text-slate-700 focus:border-[#144272] focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-inner"
                               value={currentDraft.den}
                               onChange={e => handleInputChange(indicator.id, 'den', e.target.value)}
                               placeholder="0"
                             />
                             <p className="text-[9px] text-slate-400 font-bold leading-tight">{indicator.denominator}</p>
                           </div>
                         </div>
                       )}
                    </div>
                  )}
                </div>

                <div className="px-8 py-6 bg-slate-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    {existing ? (
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white"><Check size={12}/></div>
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Tersimpan</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium ml-7">Oleh {existing.recordedBy} pada {existing.date}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-amber-500 animate-pulse"/>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memerlukan input hari ini</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button 
                      onClick={() => saveMeasurement(indicator)}
                      className="flex-1 sm:flex-none rounded-2xl px-12 py-3.5 shadow-2xl shadow-[#144272]/20 text-[11px] font-black uppercase tracking-widest bg-[#144272] text-white hover:bg-[#205295] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Save size={18}/> {existing ? 'Perbarui Data' : 'Simpan Entri'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'SUMMARY' && (
        <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] border border-[#144272]/10 shadow-sm overflow-hidden animate-fade-in">
          <div className="p-8 border-b border-[#144272]/10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h4 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <History className="text-[#144272]"/> Analisis Capaian Mutu {currentUser?.unit}
              </h4>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Monitoring progres kepatuhan standar pelayanan</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 border p-3 rounded-2xl w-full lg:w-auto">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Rentang Tanggal:</span>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-1.5 outline-none focus:border-[#144272] cursor-pointer text-slate-700 font-sans"
              />
              <span className="text-[10px] font-black text-slate-400">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-1.5 outline-none focus:border-[#144272] cursor-pointer text-slate-700 font-sans"
              />
            </div>

            <div className="flex gap-3 w-full lg:w-auto shrink-0 justify-end">
              <Button onClick={handleExportExcel} variant="secondary" className="rounded-xl text-[10px] font-black border-[#144272]/10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-2"><FileSpreadsheet size={14}/> Export Excel</Button>
              <Button onClick={handleExportPDF} variant="secondary" className="rounded-xl text-[10px] font-black border-[#144272]/10 bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center gap-2"><Printer size={14}/> Export PDF</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-[0.2em] border-b border-[#144272]/10">
                <tr>
                  <th className="p-6">TANGGAL</th>
                  <th className="p-6">INDIKATOR</th>
                  <th className="p-6 text-center">CAPAIAN</th>
                  <th className="p-6 text-center">HASIL</th>
                  <th className="p-6">PIC PETUGAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMeasurements.sort((a,b) => compareDatesSafe(a.date, b.date, true)).map(m => {
                  const ind = indicators.find(i => i.id === m.indicatorId);
                  const result = calculatePercentage(m.numeratorValue, m.denominatorValue);
                  const isAchieved = result >= (ind?.target || 0);
                  
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-6 font-bold text-slate-600">{m.date}</td>
                      <td className="p-6">
                        <div className="font-black text-slate-800 uppercase leading-snug">{ind?.title}</div>
                        <div className="text-[9px] text-slate-400 font-bold mt-0.5 tracking-tighter uppercase">{ind?.category} • target {ind?.target}%</div>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="text-sm font-black text-slate-700">{m.numeratorValue} / {m.denominatorValue}</div>
                          <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                             <div className={`h-full ${isAchieved ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, result)}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                         <span className={`px-5 py-2 rounded-2xl font-black text-[10px] uppercase shadow-sm transition-all group-hover:scale-110 flex items-center justify-center gap-2 mx-auto w-fit ${isAchieved ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                           {isAchieved ? <CheckCircle2 size={12}/> : <AlertTriangle size={12}/>}
                           {result.toFixed(1)}%
                         </span>
                      </td>
                      <td className="p-6 text-slate-500 italic font-bold">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><User size={14}/></div>
                           {m.recordedBy}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {measurements.length === 0 && (
              <div className="p-32 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-20 bg-slate-50/50">
                <LayoutGrid size={64} className="mx-auto mb-6 opacity-40"/>
                Belum ada data riwayat pengukuran bulan ini
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ANALYSIS' && (
        <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] border border-[#144272]/10 shadow-sm overflow-hidden animate-fade-in space-y-8 p-8 sm:p-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-[#144272]/10 pb-6">
            <div>
              <h4 className="text-2xl font-black text-[#144272] tracking-tight flex items-center gap-3">
                <ClipboardList className="text-[#144272]"/> KERTAS KERJA ANALISIS MUTU BULANAN
              </h4>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Agregasi Otomatis Data Harian & Tindakan Korektif (PDSA)</p>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto bg-slate-50 border border-slate-200/60 rounded-2xl px-4 py-2.5">
              <label className="text-[10px] font-black text-[#144272] uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> Periode:</label>
              <select
                className="bg-transparent border-none text-xs font-black text-slate-700 focus:ring-0 outline-none p-0 cursor-pointer"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSelectedIndicatorForAnalysis(null);
                }}
              >
                <option value="2026-01">Januari 2026</option>
                <option value="2026-02">Februari 2026</option>
                <option value="2026-03">Maret 2026</option>
                <option value="2026-04">April 2026</option>
                <option value="2026-05">Mei 2026</option>
                <option value="2026-06">Juni 2026</option>
                <option value="2026-07">Juli 2026</option>
                <option value="2026-08">Agustus 2026</option>
                <option value="2026-09">September 2026</option>
                <option value="2026-10">Oktober 2026</option>
                <option value="2026-11">November 2026</option>
                <option value="2026-12">Desember 2026</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto bg-white border border-[#144272]/10 rounded-3xl shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#144272]/5 text-[#144272] font-black uppercase tracking-[0.15em] border-b border-[#144272]/10">
                <tr>
                  <th className="p-6">INDIKATOR MUTU</th>
                  <th className="p-6 text-center">NUMERATOR TOTAL</th>
                  <th className="p-6 text-center">DENOMINATOR TOTAL</th>
                  <th className="p-6 text-center">SKOR CAPAIAN (%)</th>
                  <th className="p-6 text-center">TARGET %</th>
                  <th className="p-6 text-center">STATUS</th>
                  <th className="p-6 text-center">KERTAS KERJA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {monthlyMetrics.map(item => {
                  const isSelected = selectedIndicatorForAnalysis === item.id;
                  const isAchieved = item.score >= item.target;
                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${isSelected ? 'bg-indigo-50/30' : ''}`}
                      onClick={() => loadAnalysisForIndicator(item.id)}
                    >
                      <td className="p-6">
                        <div className="font-extrabold text-slate-800 uppercase leading-snug group-hover:text-indigo-600 transition-colors">{item.title}</div>
                        <div className="text-[9px] text-slate-400 font-bold mt-1 tracking-wider uppercase">{item.category}</div>
                      </td>
                      <td className="p-6 text-center font-bold text-slate-600 text-sm">
                        {item.totalNum}
                      </td>
                      <td className="p-6 text-center font-bold text-slate-600 text-sm">
                        {item.totalDen}
                      </td>
                      <td className="p-6 text-center font-black text-slate-800">
                        {item.totalDen > 0 ? `${item.score.toFixed(1)}%` : '-'}
                      </td>
                      <td className="p-6 text-center font-bold text-slate-400">
                        {item.target}%
                      </td>
                      <td className="p-6 text-center">
                        {item.totalDen > 0 ? (
                          <span className={`px-4 py-1.5 rounded-2xl font-black text-[10px] uppercase shadow-sm ${isAchieved ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                            {item.status}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">TIDAK ADA DATA</span>
                        )}
                      </td>
                      <td className="p-6 text-center">
                        <span className={`px-4 py-1.5 rounded-xl font-black text-[10px] uppercase border ${item.hasAnalysis ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200/60'}`}>
                          {item.hasAnalysis ? 'TERISI' : 'BELUM TERISI'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedIndicatorForAnalysis && (() => {
            const indicator = indicators.find(i => i.id === selectedIndicatorForAnalysis);
            return (
              <div className="border-t border-slate-100 pt-8 animate-fade-in space-y-6">
                <div className="bg-slate-50 border border-slate-205 rounded-[2rem] p-8 space-y-6">
                  <div>
                    <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest block mb-1">PENGISIAN KERTAS EVALUASI MUTU</span>
                    <h4 className="text-lg font-black text-[#144272] uppercase leading-tight">{indicator?.title}</h4>
                    <p className="text-[10px] text-slate-400 font-bold block mt-1 uppercase tracking-wider">Periode: {selectedMonth}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Analisis Masalah (Penyebab Tren/Capaian Belum Tercapai)</label>
                      <textarea
                        rows={6}
                        placeholder="Tuliskan analisis akar masalah, komplikasi tak terduga, atau deviasi target di sini..."
                        className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all resize-none shadow-sm placeholder:text-slate-400"
                        value={tempProblemAnalysis}
                        onChange={(e) => setTempProblemAnalysis(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Action Plan / Tindakan Korektif (PDSA)</label>
                      <textarea
                        rows={6}
                        placeholder="Tuliskan rencana tindakan perbaikan dengan format Plan-Do-Study-Act (PDSA) di sini..."
                        className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all resize-none shadow-sm placeholder:text-slate-400"
                        value={tempActionPlan}
                        onChange={(e) => setTempActionPlan(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <Button
                      onClick={() => {
                        handleSaveAnalysis(selectedIndicatorForAnalysis);
                        alert('Kertas kerja analisis berhasil disimpan ke database lokal aplikasi!');
                      }}
                      className="rounded-2xl text-xs font-black shadow-lg bg-[#144272] hover:bg-[#205295] text-white flex items-center gap-2 py-3.5 px-8 transition-all hover:translate-y-[-1px] active:scale-95"
                    >
                      <Save size={16}/> SIMPAN KERTAS KERJA
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

