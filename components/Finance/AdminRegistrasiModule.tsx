import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { getDB } from '../../db';
import { 
  Users, Search, Plus, Trash2, Download, AlertCircle, Save, Check,
  ChevronDown, HeartHandshake, Eye, Calendar, RefreshCcw, HelpCircle,
  AlertTriangle, Activity, CheckCircle, FileText, Printer, X
} from 'lucide-react';
import { Patient, MasterData, User as AppUser } from '../../types';
import { Button } from '../Button';
import { SearchableSelect } from '../SearchableSelect';
import { PatientLetterModal } from './PatientLetterModal';

export const STANDAR_ICD10 = [
  "A09 - Diarrhoea and gastroenteritis",
  "E11 - Type 2 diabetes mellitus",
  "I10 - Essential (primary) hypertension",
  "K35 - Acute appendicitis",
  "N18 - Chronic kidney disease",
  "K40 - Inguinal hernia",
  "E04 - Other nontoxic goitre",
  "C50 - Malignant neoplasm of breast",
  "K80 - Cholelithiasis",
  "C18 - Malignant neoplasm of colon",
  "D21 - Other benign neoplasms of connective and other soft tissue",
  "M51 - Other intervertebral disc disorders",
  "C73 - Malignant neoplasm of thyroid gland",
  "D25 - Leiomyoma of uterus",
  "N40 - Hyperplasia of prostate",
  "J18 - Pneumonia, unspecified organism",
  "I64 - Stroke, not specified as haemorrhage or infarction",
  "K56 - Paralytic ileus and intestinal obstruction without hernia",
  "N20 - Calculus of kidney and ureter",
  "L02 - Cutaneous abscess, furuncle and carbuncle",
  "T14 - Injury of unspecified body region"
];

interface AdminRegistrasiModuleProps {
  patients: Patient[];
  masterData: MasterData;
  currentUser: AppUser | null;
  onUpdatePatient: (id: string, updates: Partial<Patient>) => void;
  onAddPatient: (patientData: Omit<Patient, 'id'>) => void;
  onDeletePatient: (id: string) => void;
  onCreateEmptyPatient?: () => void;
  onNavigate?: (menu: string) => void;
}

// Age calculation helper
const getAgeFromBirthDate = (birthDateStr: string | undefined): string => {
  if (!birthDateStr) return '-';
  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) return '-';
  const today = new Date('2026-05-26'); // Fixed to system runtime date matching user metadata
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${age} thn`;
};

// Age updater helper to estimate birthDate
const estimateBirthDateFromAge = (ageStr: string): string => {
  const ageNum = parseInt(ageStr, 10);
  if (isNaN(ageNum)) return '';
  const currentYear = 2026;
  const birthYear = currentYear - ageNum;
  return `${birthYear}-01-01`;
};

// Multi-select dropdown component for DPJP and Payment Method within cells
interface MultipleSelectCellProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  themeColor?: string;
}

const MultipleSelectCell: React.FC<MultipleSelectCellProps> = ({ 
  options = [], 
  selected = [], 
  onChange, 
  placeholder,
  themeColor = 'indigo'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item: string) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return options;
    return options.filter(opt => (opt || '').toLowerCase().includes(s));
  }, [options, search]);

  const badgeColor = themeColor === 'emerald' 
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
    : 'bg-indigo-50 text-indigo-700 border-indigo-100';

  return (
    <div ref={dropdownRef} className="relative w-full min-w-[140px]">
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className="w-full text-left bg-white border border-slate-200 hover:border-slate-350 focus-within:ring-2 focus-within:ring-indigo-100 rounded-lg px-2.5 py-2 font-bold flex justify-between items-center cursor-pointer transition-all h-10 select-none text-[10px]"
      >
        <div className="flex flex-wrap gap-1 max-w-[110px] items-center overflow-hidden h-7">
          {selected.length > 0 ? (
            selected.map(item => (
              <span key={item} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight truncate max-w-[80px] border ${badgeColor}`}>
                {item.split(',')[0]}
              </span>
            ))
          ) : (
            <span className="text-slate-400 font-medium italic">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={12} className="text-slate-400 shrink-0 ml-1" />
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 max-h-56 overflow-hidden bg-white border border-slate-200 rounded-xl shadow-2xl z-50 flex flex-col text-[10px]">
          <div className="px-2 py-1.5 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50">
            <Search size={11} className="text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              className="w-full bg-transparent text-[10px] font-bold text-slate-800 placeholder-slate-400 border-none outline-none focus:ring-0 p-0"
              placeholder="Ketik untuk mencari..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1 max-h-44 p-1 space-y-0.5">
            <div className="px-2 py-1 border-b text-[8px] font-black uppercase text-slate-400 tracking-wider">
              Pilih Opsi (Multi-select)
            </div>
            {filtered.map((option) => (
              <label key={option} className="flex items-center gap-2 hover:bg-slate-50 p-2 rounded-lg cursor-pointer font-bold select-none">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => handleToggle(option)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span className="text-slate-755 truncate">{option}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="p-3 text-center italic text-slate-400">Tidak ada hasil</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Searchable Single-select Dropdown Component tailored for Spreadsheet Cell
interface SearchableSelectCellProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  themeColor?: 'indigo' | 'emerald' | 'slate' | 'rose' | 'amber' | 'blue';
}

const SearchableSelectCell: React.FC<SearchableSelectCellProps> = ({
  options = [],
  value = '',
  onChange,
  placeholder,
  themeColor = 'slate'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return options;
    return options.filter(opt => (opt || '').toLowerCase().includes(s));
  }, [options, search]);

  const colorStyles = useMemo(() => {
    switch (themeColor) {
      case 'emerald':
        return 'text-emerald-700 bg-emerald-50 border-slate-200 hover:border-emerald-350 focus-within:ring-emerald-100';
      case 'amber':
        return 'text-amber-700 bg-amber-50 border-slate-200 hover:border-amber-350 focus-within:ring-amber-100';
      case 'blue':
        return 'text-blue-700 bg-blue-50 border-slate-200 hover:border-blue-350 focus-within:ring-blue-100';
      case 'rose':
        return 'text-rose-700 bg-rose-50 border-slate-200 hover:border-rose-350 focus-within:ring-rose-100';
      case 'indigo':
        return 'text-indigo-700 bg-indigo-50 border-slate-200 hover:border-indigo-350 focus-within:ring-indigo-100';
      default:
        return 'text-slate-700 bg-white border-slate-200 hover:border-slate-350 focus-within:ring-indigo-100';
    }
  }, [themeColor]);

  return (
    <div ref={dropdownRef} className="relative w-full min-w-[125px] font-sans">
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className={`w-full text-left border rounded-lg px-2.5 py-1.5 font-bold flex justify-between items-center cursor-pointer transition-all h-10 select-none text-[10px] ${colorStyles}`}
      >
        <span className="truncate pr-1 block max-w-[110px]">
          {value || <span className="text-slate-400 font-medium italic">{placeholder}</span>}
        </span>
        <ChevronDown size={11} className="text-slate-400 shrink-0 ml-auto" />
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 max-h-56 overflow-hidden bg-white border border-slate-200 rounded-xl shadow-2xl z-50 flex flex-col text-[10px]">
          <div className="px-2 py-1.5 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50">
            <Search size={11} className="text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              className="w-full bg-transparent text-[10px] font-bold text-slate-800 placeholder-slate-400 border-none outline-none focus:ring-0 p-0"
              placeholder="Ketik untuk mencari..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1 max-h-44 p-1 space-y-0.5">
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg font-bold transition-all truncate block ${
                  value === option 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {option}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-3 text-center italic text-slate-400">Tidak ada hasil</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Individual Row with Draft Local State to ensure typing in inputs has zero UI lag
interface SpreadsheetRowProps {
  patient: Patient;
  index: number;
  masterData: MasterData;
  onUpdate: (id: string, updates: Partial<Patient>) => void;
  onDelete: (id: string) => void;
  allPatients: Patient[];
  onOpenLetterModal?: (patient: Patient) => void;
}

const SpreadsheetRow: React.FC<SpreadsheetRowProps> = ({ 
  patient, 
  index, 
  masterData, 
  onUpdate, 
  onDelete,
  allPatients,
  onOpenLetterModal
}) => {
  const [draft, setDraft] = useState<Patient>(patient);
  const [focusedField, setFocusedField] = useState<keyof Patient | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const chronList = useMemo(() => {
    if (!patient.noRegister && !patient.noRM) return [];
    
    // Find all records with the same noRegister (or fallback to noRM if noRegister is empty)
    const related = allPatients.filter(p => {
      if (patient.noRegister && p.noRegister) {
        return p.noRegister.trim().toUpperCase() === patient.noRegister.trim().toUpperCase();
      }
      return p.noRM && patient.noRM && p.noRM.trim().toUpperCase() === patient.noRM.trim().toUpperCase();
    });

    // Sort chronologically by entry date and time
    return [...related].sort((a, b) => {
      const dateA = a.entryDate || "1970-01-01";
      const dateB = b.entryDate || "1970-01-01";
      const timeA = a.entryTime || "00:00";
      const timeB = b.entryTime || "00:00";
      const strA = `${dateA}T${timeA}`;
      const strB = `${dateB}T${timeB}`;
      return strA.localeCompare(strB);
    });
  }, [patient.noRegister, patient.noRM, allPatients]);

  const explicitMutationLog = useMemo(() => {
    if (chronList.length <= 1) return null;
    
    const idx = chronList.findIndex(r => r.id === patient.id);
    if (idx === -1) return null;

    const nextRec = chronList[idx + 1];
    if (nextRec) {
      const exitDate = patient.dischargeDate || nextRec.entryDate;
      const exitTime = patient.dischargeTime || nextRec.entryTime || "00:00";
      return `Pasien pernah dirawat di ${patient.unitTujuan || "Ruangan Lama"}, status saat ini: KELUAR (${patient.statusDataPasien || "Dipindah ke Ruangan Lain"}) pada ${exitDate} ${exitTime} dengan Tujuan Ruangan Baru: ${nextRec.unitTujuan || "Ruangan Baru"}${nextRec.ruangan ? ` (${nextRec.ruangan})` : ""}`;
    } else {
      // Latest overall record of the patient's stay
      return `Pasien saat ini aktif dirawat di ${patient.unitTujuan || ""}${patient.ruangan ? ` (${patient.ruangan})` : ""} sejak ${patient.entryDate} ${patient.entryTime || ""}`;
    }
  }, [chronList, patient]);

  useEffect(() => {
    if (focusedField) {
      setDraft(prev => ({
        ...patient,
        [focusedField]: prev[focusedField]
      }));
    } else {
      setDraft(patient);
    }
  }, [patient, focusedField]);

  // Handle local typing updates
  const handleCellChange = (field: keyof Patient, value: any) => {
    const updated = { ...draft, [field]: value };
    setDraft(updated);
  };

  const handleToggleMasalah = (type: 'risiko' | 'on_proses' | 'selesai') => {
    let updates: Partial<Patient> = {};
    if (type === 'risiko') {
      const active = !draft.isRisikoBermasalah;
      updates = {
        isRisikoBermasalah: active,
        statusMasalah: ''
      };
    } else if (type === 'on_proses') {
      const active = draft.statusMasalah === 'ON_PROSES';
      updates = {
        isRisikoBermasalah: false,
        statusMasalah: active ? '' : 'ON_PROSES'
      };
    } else if (type === 'selesai') {
      const active = draft.statusMasalah === 'SELESAI';
      updates = {
        isRisikoBermasalah: false,
        statusMasalah: active ? '' : 'SELESAI'
      };
    }
    const updated = { ...draft, ...updates };
    setDraft(updated);
    onUpdate(patient.id, updates);
  };

  // Perform saving to parent database onBlur
  const handleCellBlur = (field: keyof Patient, value: any) => {
    if (patient[field] !== value) {
      onUpdate(patient.id, { [field]: value });
    }
  };

  // Handle multi-select parameters instantly
  const handleMultiSelectChange = (field: 'dpjpList' | 'paymentMethod', selection: string[]) => {
    const updated = { ...draft, [field]: selection };
    setDraft(updated);
    onUpdate(patient.id, { [field]: selection });
  };

  // Dynamic dependencies list
  const availableClasses = useMemo(() => {
    const unit = draft.unitTujuan || '';
    return masterData.unitToClasses?.[unit] || ['VVIP', 'VIP', 'Kelas 1', 'Kelas 2', 'Kelas 3', 'ICU', 'HCU', 'Isolasi'];
  }, [draft.unitTujuan, masterData]);

  const availableRooms = useMemo(() => {
    const key = `${draft.unitTujuan || ''} - ${draft.kelasRawat || ''}`;
    const rooms = masterData.classToRooms?.[key] || [];
    if (rooms.length > 0) return rooms;
    return masterData.rooms || [];
  }, [draft.unitTujuan, draft.kelasRawat, masterData]);

  const originOptions = useMemo(() => {
    const base = patient.origin ? [patient.origin] : ["IGD", "IRJ", "Rujukan", "IBS"];
    const roomsFiltered = (masterData.rooms || []).filter(r => r !== draft.ruangan);
    return Array.from(new Set([...base, "IGD", "IRJ", "Rujukan", "IBS", ...roomsFiltered]));
  }, [masterData.rooms, draft.ruangan, patient.origin]);

  const availableNurses = useMemo(() => {
    return (masterData.nurses || []).filter(n => {
      const meta = masterData.nurseMetadata?.[n];
      if (!meta) return true;
      const pos = String(meta.position || '').toLowerCase();
      return pos.includes('primer') || pos.includes('ppja') || pos.includes('rawat');
    });
  }, [masterData.nurses, masterData.nurseMetadata]);

  // Ensure origin is synchronized with patient.origin if draft is empty
  useEffect(() => {
    if (!draft.origin && patient.origin) {
      handleCellChange('origin', patient.origin);
    }
  }, [patient.origin]);

  const ageText = useMemo(() => {
    return getAgeFromBirthDate(draft.birthDate);
  }, [draft.birthDate]);

  // Admin Completeness Check
  const completeness = useMemo(() => {
    const fields = [
      { name: 'No. RM', isFilled: !!draft.noRM?.trim() },
      { name: 'No. Register', isFilled: !!draft.noRegister?.trim() },
      { name: 'Unit Tujuan', isFilled: !!draft.unitTujuan?.trim() },
      { name: 'Kelas Rawat', isFilled: !!draft.kelasRawat?.trim() },
      { name: 'Ruangan', isFilled: !!draft.ruangan?.trim() },
      { name: 'Bed', isFilled: !!draft.nomorBed?.trim() },
      { name: 'Nama Pasien', isFilled: !!draft.name?.trim() },
      { name: 'Jenis Kelamin', isFilled: !!draft.gender?.trim() },
      { name: 'Tanggal Lahir', isFilled: !!draft.birthDate?.trim() },
      { name: 'No. SEP', isFilled: !!draft.noSEP?.trim() },
      { name: 'Status SEP', isFilled: !!draft.statusSEP?.trim() },
      { name: 'Alamat', isFilled: !!draft.address?.trim() },
      { name: 'Tanggal MRS', isFilled: !!draft.entryDate?.trim() },
      { name: 'Jaminan', isFilled: !!(draft.paymentMethod && draft.paymentMethod.length > 0) },
      { name: 'DPJP', isFilled: !!(draft.dpjpList && draft.dpjpList.length > 0) },
      { name: 'PPJA / Perawat', isFilled: !!draft.perawatPrimer?.trim() },
      { name: 'Keterangan', isFilled: !!draft.catatanKhusus?.trim() && !draft.isRisikoBermasalah && draft.statusMasalah !== 'ON_PROSES' }
    ];
    const filled = fields.filter(f => f.isFilled).length;
    const total = fields.length;
    const missing = fields.filter(f => !f.isFilled).map(f => f.name);
    return {
      filled,
      total,
      isComplete: filled === total,
      percentage: Math.round((filled / total) * 100),
      missing
    };
  }, [draft]);

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 group">
      
      {/* 1. No */}
      <td className="p-3 text-center border-r border-slate-100 font-bold text-slate-400 text-[10px] sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
        {index + 1}
      </td>

      {/* Status Admin Column */}
      <td className="p-2 border-r border-slate-100 text-center w-28 bg-slate-50 sticky left-12 group-hover:bg-slate-100 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
        {(() => {
          const { filled, total, isComplete, percentage, missing } = completeness;
          return (
            <div className="flex flex-col items-center gap-1 select-none leading-none group/tooltip relative font-sans">
              {isComplete ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-1 rounded bg-emerald-50 text-emerald-700 font-extrabold text-[8px] uppercase tracking-wide border border-emerald-200">
                  <Check size={8} className="stroke-[3px]" /> LENGKAP
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-1 rounded bg-rose-50 text-rose-750 font-extrabold text-[8px] uppercase tracking-wide border border-rose-200 animate-pulse">
                  BELUM LENGKAP
                </span>
              )}
              <div className="w-16 bg-slate-200 h-1 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${isComplete ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                  style={{ width: `${percentage}%` }} 
                />
              </div>
              
              {!isComplete && (
                <div className="invisible group-hover/tooltip:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-slate-950 text-white rounded-lg p-2.5 text-[8px] leading-snug font-medium shadow-xl z-55 text-left transition-opacity duration-150">
                  <div className="font-extrabold text-amber-400 mb-1 uppercase text-[7px] tracking-wider">Perlu Dilengkapi:</div>
                  <ul className="list-disc list-inside space-y-0.5 font-sans">
                    {missing.slice(0, 5).map(m => (
                      <li key={m} className="truncate">{m}</li>
                    ))}
                    {missing.length > 5 && <li>+ {missing.length - 5} lainnya</li>}
                  </ul>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950" />
                </div>
              )}
            </div>
          );
        })()}
      </td>

      {/* 2. No RM */}
      <td className="p-2 border-r border-slate-100 w-24 sticky left-40 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
        <input 
          type="text"
          className="w-full text-[10px] font-black text-blue-600 text-center tracking-wider bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-indigo-300 rounded p-1.5 focus:outline-none transition-all uppercase"
          value={draft.noRM || ''}
          placeholder="00-00-00"
          onChange={e => handleCellChange('noRM', e.target.value)}
          onFocus={() => setFocusedField('noRM')}
          onBlur={e => {
            handleCellBlur('noRM', e.target.value);
            setFocusedField(null);
          }}
        />
      </td>

      {/* 3. No Register */}
      <td className="p-2 border-r border-slate-100 w-32 sticky left-[256px] bg-slate-50 group-hover:bg-slate-100 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
        <input 
          type="text"
          className="w-full text-[10px] font-bold text-slate-705 bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-indigo-300 rounded p-1.5 focus:outline-none transition-all"
          value={draft.noRegister || ''}
          placeholder="REG-000000"
          onChange={e => handleCellChange('noRegister', e.target.value)}
          onFocus={() => setFocusedField('noRegister')}
          onBlur={e => {
            handleCellBlur('noRegister', e.target.value);
            setFocusedField(null);
          }}
        />
      </td>

      {/* 9. Nama Pasien */}
      <td className="p-2 border-r border-slate-100 w-48 sticky left-[384px] bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-1">
          <input 
            type="text"
            className="w-full text-[10px] font-black text-slate-800 uppercase tracking-tight bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-indigo-300 rounded p-1.5 focus:outline-none transition-all"
            value={draft.name || ''}
            placeholder="Nama Lengkap..."
            onChange={e => handleCellChange('name', e.target.value)}
            onFocus={() => setFocusedField('name')}
            onBlur={e => {
              handleCellBlur('name', e.target.value);
              setFocusedField(null);
            }}
          />
          {chronList.length > 1 && (
            <button
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="self-start inline-flex items-center gap-1 bg-amber-55 text-amber-900 border border-amber-200/60 text-[8px] font-black uppercase px-2 py-0.5 rounded-md cursor-pointer transition-all leading-none font-sans"
            >
              <RefreshCcw size={8} /> {isHistoryExpanded ? "Tutup" : "Riwayat"} Mutasi ({chronList.length})
            </button>
          )}
        </div>
      </td>

      {/* 4. Unit Tujuan */}
      <td className="p-2 border-r border-slate-100 w-36">
        <SearchableSelectCell
          options={masterData.units || []}
          value={draft.unitTujuan || ''}
          onChange={val => {
            handleCellChange('unitTujuan', val);
            const unitClasses = masterData.unitToClasses?.[val] || [];
            const isClassValid = unitClasses.includes(draft.kelasRawat || '');
            const newClass = isClassValid ? (draft.kelasRawat || '') : (unitClasses[0] || '');
            
            const roomKey = `${val} - ${newClass}`;
            const roomOptions = masterData.classToRooms?.[roomKey] || [];
            const isRoomValid = roomOptions.includes(draft.ruangan || '');
            const newRoom = isRoomValid ? (draft.ruangan || '') : (roomOptions[0] || '');

            handleCellChange('kelasRawat', newClass);
            handleCellChange('ruangan', newRoom);

            onUpdate(patient.id, { 
              unitTujuan: val,
              kelasRawat: newClass,
              ruangan: newRoom
            });
          }}
          placeholder="Pilih Unit"
          themeColor="slate"
        />
      </td>

      {/* 5. Kelas Rawat */}
      <td className="p-2 border-r border-slate-100 w-32">
        <SearchableSelectCell
          options={availableClasses}
          value={draft.kelasRawat || ''}
          onChange={val => {
            handleCellChange('kelasRawat', val);
            const roomKey = `${draft.unitTujuan || ''} - ${val}`;
            const roomOptions = masterData.classToRooms?.[roomKey] || [];
            const isRoomValid = roomOptions.includes(draft.ruangan || '');
            const newRoom = isRoomValid ? (draft.ruangan || '') : (roomOptions[0] || '');
            
            handleCellChange('ruangan', newRoom);
            onUpdate(patient.id, { 
              kelasRawat: val,
              ruangan: newRoom
            });
          }}
          placeholder="Pilih Kelas"
          themeColor="slate"
        />
      </td>

      {/* 6. Ruangan */}
      <td className="p-2 border-r border-slate-100 w-32">
        <SearchableSelectCell
          options={availableRooms}
          value={draft.ruangan || ''}
          onChange={val => {
            handleCellChange('ruangan', val);
            onUpdate(patient.id, { ruangan: val });
          }}
          placeholder="Pilih Ruangan"
          themeColor="slate"
        />
      </td>

      {/* 7. Bed */}
      <td className="p-2 border-r border-slate-100 w-24">
        <input 
          type="text"
          className="w-full text-[10px] font-bold text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-indigo-300 rounded p-1.5 focus:outline-none transition-all"
          value={draft.nomorBed || ''}
          placeholder="Bed..."
          onChange={e => handleCellChange('nomorBed', e.target.value)}
          onFocus={() => setFocusedField('nomorBed')}
          onBlur={e => {
            handleCellBlur('nomorBed', e.target.value);
            setFocusedField(null);
          }}
        />
      </td>

      {/* 8. Ruangan Asal */}
      <td className="p-2 border-r border-slate-100 w-32">
        <SearchableSelectCell
          options={originOptions}
          value={draft.origin || patient.origin || 'IGD'}
          onChange={val => {
            handleCellChange('origin', val);
            onUpdate(patient.id, { origin: val });
          }}
          placeholder="Pilih Asal"
          themeColor="slate"
        />
      </td>

      {/* 10. Jenis Kelamin */}
      <td className="p-2 border-r border-slate-100 w-24">
        <select
          className={`w-full text-[10px] font-black tracking-wider text-center bg-transparent border rounded-lg p-1.5 focus:outline-none transition-all cursor-pointer border-transparent ${draft.gender === 'L' ? 'text-blue-700 bg-blue-50/50' : draft.gender === 'P' ? 'text-pink-700 bg-pink-50/50' : 'text-slate-500'}`}
          value={draft.gender || 'L'}
          onChange={e => {
            const val = e.target.value as 'L' | 'P';
            handleCellChange('gender', val);
            onUpdate(patient.id, { gender: val });
          }}
        >
          <option value="L">L-Laki-laki</option>
          <option value="P">P-Perempuan</option>
        </select>
      </td>

      {/* 11. Tanggal Lahir */}
      <td className="p-2 border-r border-slate-100 w-36">
        <input 
          type="date"
          className="w-full text-[10px] font-bold text-slate-700 bg-slate-50 border hover:border-slate-350 focus:bg-white rounded p-1 focus:outline-none transition-all cursor-pointer"
          value={draft.birthDate || ''}
          onChange={e => handleCellChange('birthDate', e.target.value)}
          onFocus={() => setFocusedField('birthDate')}
          onBlur={e => {
            handleCellBlur('birthDate', e.target.value);
            setFocusedField(null);
          }}
        />
      </td>

      {/* 12. No SEP */}
      <td className="p-2 border-r border-slate-100 w-32">
        <input 
          type="text"
          className="w-full text-[10px] font-semibold text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-indigo-300 rounded p-1.5 focus:outline-none transition-all"
          value={draft.noSEP || ''}
          placeholder="No SEP..."
          onChange={e => handleCellChange('noSEP', e.target.value)}
          onFocus={() => setFocusedField('noSEP')}
          onBlur={e => {
            handleCellBlur('noSEP', e.target.value);
            setFocusedField(null);
          }}
        />
      </td>

      {/* 13. Status SEP */}
      <td className="p-2 border-r border-slate-100 w-32">
        <SearchableSelectCell
          options={['Belum Terbit', 'Selesai SEP', 'Proses', 'Bermasalah']}
          value={draft.statusSEP || 'Belum Terbit'}
          onChange={val => {
            handleCellChange('statusSEP', val);
            onUpdate(patient.id, { statusSEP: val });
          }}
          placeholder="Status SEP"
          themeColor="slate"
        />
      </td>

      {/* 14. Jenis KLL */}
      <td className="p-2 border-r border-slate-100 w-36">
        <SearchableSelectCell
          options={['Bukan KLL', 'KLL Jasa Raharja', 'KLL BPJS', 'KLL Mandiri']}
          value={draft.jenisKLL || 'Bukan KLL'}
          onChange={val => {
            handleCellChange('jenisKLL', val);
            onUpdate(patient.id, { jenisKLL: val });
          }}
          placeholder="Jenis KLL"
          themeColor="slate"
        />
      </td>

      {/* 15. No LP */}
      <td className="p-2 border-r border-slate-100 w-32">
        <input 
          type="text"
          className="w-full text-[10px] font-bold text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-indigo-300 rounded p-1.5 focus:outline-none transition-all"
          value={draft.noLP || ''}
          placeholder="No LP..."
          onChange={e => handleCellChange('noLP', e.target.value)}
          onFocus={() => setFocusedField('noLP')}
          onBlur={e => {
            handleCellBlur('noLP', e.target.value);
            setFocusedField(null);
          }}
        />
      </td>

      {/* Surat Keterangan History / Metadata */}
      <td className="p-2 border-r border-slate-100 w-56">
        <input 
          type="text"
          className="w-full text-[10px] font-bold text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-indigo-300 rounded p-1.5 focus:outline-none transition-all"
          value={draft.suratKeterangan || ''}
          placeholder="Metadata/No. Surat..."
          onChange={e => handleCellChange('suratKeterangan', e.target.value)}
          onFocus={() => setFocusedField('suratKeterangan')}
          onBlur={e => {
            handleCellBlur('suratKeterangan', e.target.value);
            setFocusedField(null);
          }}
        />
      </td>

      {/* 16. Alamat */}
      <td className="p-2 border-r border-slate-100 min-w-[200px]">
        <input 
          type="text"
          className="w-full text-[10px] font-medium text-slate-600 bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-indigo-300 rounded p-1.5 focus:outline-none transition-all"
          value={draft.address || ''}
          placeholder="Alamat Domisili Pasien..."
          onChange={e => handleCellChange('address', e.target.value)}
          onFocus={() => setFocusedField('address')}
          onBlur={e => {
            handleCellBlur('address', e.target.value);
            setFocusedField(null);
          }}
        />
      </td>

      {/* 17. Tanggal MRS */}
      <td className="p-2 border-r border-slate-100 w-32">
        <input 
          type="date"
          className="w-full text-[9px] font-bold text-slate-800 bg-transparent hover:bg-slate-100 focus:bg-white border border-slate-200 rounded p-1.5 focus:outline-none transition-all cursor-pointer"
          value={draft.entryDate || ''}
          onChange={e => {
            handleCellChange('entryDate', e.target.value);
            onUpdate(patient.id, { entryDate: e.target.value });
          }}
        />
      </td>

      {/* 18. Tanggal KRS */}
      <td className="p-2 border-r border-slate-100 w-32">
        <input 
          type="date"
          className="w-full text-[9px] font-bold text-slate-850 bg-transparent hover:bg-slate-100 focus:bg-white border border-slate-200 rounded p-1.5 focus:outline-none transition-all cursor-pointer"
          value={draft.dischargeDate || ''}
          onChange={e => {
            handleCellChange('dischargeDate', e.target.value);
            onUpdate(patient.id, { dischargeDate: e.target.value || "" });
          }}
        />
      </td>

      {/* 19. Jam KRS */}
      <td className="p-2 border-r border-slate-100 w-24">
        <input 
          type="time"
          className="w-full text-[9px] font-bold text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-white border border-slate-200 rounded p-1.5 focus:outline-none transition-all cursor-pointer"
          value={draft.dischargeTime || ''}
          onChange={e => {
            handleCellChange('dischargeTime', e.target.value);
            onUpdate(patient.id, { dischargeTime: e.target.value });
          }}
        />
      </td>

      {/* 20. Alasan APS / Rujukan / Meninggal / Dipindah ke Ruangan Lain detail */}
      <td className="p-2 border-r border-slate-100 min-w-[200px] bg-slate-50/40">
        <input 
          type="text"
          className="w-full text-[10px] font-bold text-indigo-700 bg-transparent placeholder-indigo-400 p-1 rounded hover:bg-indigo-50"
          value={
            draft.statusDataPasien?.toUpperCase().includes('APS') ? (draft.apsReason || '') :
            draft.statusDataPasien?.toUpperCase().includes('RUJUK') || draft.statusDataPasien?.toUpperCase().includes('DIRUJUK') ? (draft.referralDestination || '') :
            draft.statusDataPasien?.toUpperCase().includes('MENINGGAL') ? (`Waktu: ${draft.deathTime || '-'}`) :
            draft.statusDataPasien?.toUpperCase().includes('PINDAH') || draft.statusDataPasien?.toUpperCase().includes('RUANGAN LAIN') ? (draft.transferDestinationRoom || '') : ''
          }
          placeholder="Rincian KRS (Alasan APS / RS Rujukan / Dipindah ke Ruangan Lain / Menit Meninggal)..."
          onChange={e => {
            const val = e.target.value;
            if (draft.statusDataPasien?.toUpperCase().includes('APS')) {
              handleCellChange('apsReason', val);
            } else if (draft.statusDataPasien?.toUpperCase().includes('RUJUK') || draft.statusDataPasien?.toUpperCase().includes('DIRUJUK')) {
              handleCellChange('referralDestination', val);
            } else if (draft.statusDataPasien?.toUpperCase().includes('PINDAH') || draft.statusDataPasien?.toUpperCase().includes('RUANGAN LAIN')) {
              handleCellChange('transferDestinationRoom', val);
            }
          }}
          onBlur={() => {
            if (draft.statusDataPasien?.toUpperCase().includes('APS')) {
              onUpdate(patient.id, { apsReason: draft.apsReason });
            } else if (draft.statusDataPasien?.toUpperCase().includes('RUJUK') || draft.statusDataPasien?.toUpperCase().includes('DIRUJUK')) {
              onUpdate(patient.id, { referralDestination: draft.referralDestination });
            } else if (draft.statusDataPasien?.toUpperCase().includes('PINDAH') || draft.statusDataPasien?.toUpperCase().includes('RUANGAN LAIN')) {
              onUpdate(patient.id, { transferDestinationRoom: draft.transferDestinationRoom });
            }
          }}
          disabled={!['APS', 'DIRUJUK', 'MENINGGAL', 'PINDAH RUANGAN', 'DIPINDAH KE RUANGAN LAIN', 'BPL'].some(s => draft.statusDataPasien?.toUpperCase().includes(s))}
        />
      </td>

      {/* 21. Diagnosa */}
      <td className="p-2 border-r border-slate-100 min-w-[220px]">
        <SearchableSelectCell
          options={STANDAR_ICD10.concat((draft.diagnosaUtama && !STANDAR_ICD10.includes(draft.diagnosaUtama)) ? [draft.diagnosaUtama] : [])}
          value={draft.diagnosaUtama || ''}
          onChange={val => {
            handleCellChange('diagnosaUtama', val);
            onUpdate(patient.id, { diagnosaUtama: val });
          }}
          placeholder="Pilih Diagnosa ICD-10"
          themeColor="slate"
        />
      </td>

      {/* 22. Tindakan Prosedur */}
      <td className="p-2 border-r border-slate-100 min-w-[185px]">
        <textarea 
          className="w-full text-[10px] font-medium text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-white border hover:border-slate-350 focus:border-indigo-300 rounded p-1.5 focus:outline-none transition-all min-h-[36px] h-9 custom-scrollbar"
          value={draft.tindakanProsedur || ''}
          placeholder="Tindakan medis..."
          onChange={e => handleCellChange('tindakanProsedur', e.target.value)}
          onFocus={() => setFocusedField('tindakanProsedur')}
          onBlur={e => {
            handleCellBlur('tindakanProsedur', e.target.value);
            setFocusedField(null);
          }}
        />
      </td>

      {/* 23. Jaminan */}
      <td className="p-2 border-r border-slate-100">
        <MultipleSelectCell 
          options={masterData.refs?.caraBayar || ['BPJS', 'Umum', 'Asuransi Swasta']} 
          selected={draft.paymentMethod || []} 
          onChange={selection => handleMultiSelectChange('paymentMethod', selection)}
          placeholder="Jaminan"
          themeColor="emerald"
        />
      </td>

      {/* 24. DPJP (Can be multiple!) */}
      <td className="p-2 border-r border-slate-100">
        <MultipleSelectCell 
          options={masterData.doctors} 
          selected={draft.dpjpList || []} 
          onChange={selection => handleMultiSelectChange('dpjpList', selection)}
          placeholder="Pilih DPJP"
          themeColor="indigo"
        />
      </td>

      {/* 25. Perawat Primer / PPJA */}
      <td className="p-2 border-r border-slate-100 w-36">
        <SearchableSelectCell
          options={availableNurses}
          value={draft.perawatPrimer || ''}
          onChange={val => {
            handleCellChange('perawatPrimer', val);
            onUpdate(patient.id, { perawatPrimer: val });
          }}
          placeholder="Pilih PPJA / Perawat"
          themeColor="slate"
        />
      </td>

      {/* 26. Riwayat Alergi */}
      <td className="p-2 border-r border-slate-100 w-40">
        <input 
          type="text"
          className="w-full text-[10px] font-semibold text-rose-600 bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-rose-300 rounded p-1.5 focus:outline-none transition-all"
          value={draft.allergyHistory || ''}
          placeholder="Riwayat Alergi..."
          onChange={e => handleCellChange('allergyHistory', e.target.value)}
          onFocus={() => setFocusedField('allergyHistory')}
          onBlur={e => {
            handleCellBlur('allergyHistory', e.target.value);
            setFocusedField(null);
          }}
        />
      </td>

      {/* 29. Status Keluar */}
      <td className="p-2 border-r border-slate-100 w-36">
        <SearchableSelectCell
          options={useMemo(() => {
            const list = masterData.refs?.statusDataPasien || ["BPL", "APS", "Dipindah ke Ruangan Lain", "Dirujuk", "Meninggal"];
            const hasBatal = list.some(s => s.toLowerCase().includes('batal'));
            const final = hasBatal ? list : [...list, "Batal Rawat Inap"];
            return ["AKTIF"].concat(final);
          }, [masterData.refs])}
          value={draft.statusDataPasien || 'AKTIF'}
          onChange={val => {
            handleCellChange('statusDataPasien', val);
            
            // Set patient discharge status automatically too if discharges
            let appStatus = draft.status;
            let clearDischarge: Partial<Patient> = {};
            
            const vUpper = val.toUpperCase().trim();
            const mustDischarge = vUpper.includes('BPL') || vUpper.includes('APS') || vUpper.includes('MENINGGAL') || vUpper.includes('BATAL') || vUpper.includes('RUJUK');
            const isPindahRuangan = vUpper.includes('PINDAH') || vUpper.includes('RUANGAN');
            
            if (mustDischarge) {
              appStatus = 'DISCHARGED';
              const curDate = new Date().toISOString().split('T')[0];
              const curTime = new Date().toTimeString().slice(0, 5);
              draft.dischargeDate = curDate;
              draft.dischargeTime = curTime;
              clearDischarge.dischargeDate = curDate;
              clearDischarge.dischargeTime = curTime;
            } else if (isPindahRuangan) {
              appStatus = 'ADMITTED';
              draft.dischargeDate = '';
              draft.dischargeTime = '';
              clearDischarge.dischargeDate = '';
              clearDischarge.dischargeTime = '';
              clearDischarge.apsReason = '';
              clearDischarge.referralDestination = '';
              clearDischarge.deathTime = '';
            } else {
              appStatus = 'ADMITTED';
              draft.dischargeDate = '';
              draft.dischargeTime = '';
              clearDischarge = {
                dischargeDate: "",
                dischargeTime: "",
                apsReason: "",
                referralDestination: "",
                deathTime: "",
                transferDestinationRoom: ""
              };
            }

            onUpdate(patient.id, { 
              statusDataPasien: val, 
              status: appStatus,
              ...clearDischarge
            });
          }}
          placeholder="Status Keluar"
          themeColor={
            draft.statusDataPasien === 'BPL' || draft.statusDataPasien?.toUpperCase().includes('BPL') ? 'emerald' :
            draft.statusDataPasien === 'APS' || draft.statusDataPasien?.toUpperCase().includes('APS') ? 'amber' :
            draft.statusDataPasien === 'PINDAH RUANGAN' || draft.statusDataPasien === 'Dipindah ke Ruangan Lain' || draft.statusDataPasien?.toUpperCase().includes('PINDAH') ? 'blue' : 'slate'
          }
        />
      </td>

      {/* 30. Keterangan / Catatan Khusus */}
      <td className="p-2 border-r border-slate-100 min-w-[420px]">
        <div className="flex flex-col gap-1.5 font-sans">
          <input 
            type="text"
            className={`w-full text-[10px] font-bold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 transition-all ${
              !draft.catatanKhusus?.trim() 
                ? 'border border-rose-300 bg-rose-50/40 text-rose-800 placeholder-rose-400 focus:ring-rose-400 font-black animate-pulse' 
                : 'bg-slate-50 hover:bg-slate-100 focus:bg-white font-semibold text-slate-700 border border-slate-200 focus:ring-indigo-300'
            }`}
            value={draft.catatanKhusus || ''}
            placeholder="Masukkan keterangan tambahan... (WAJIB DIISI)"
            onChange={e => handleCellChange('catatanKhusus', e.target.value)}
            onFocus={() => setFocusedField('catatanKhusus')}
            onBlur={e => {
              handleCellBlur('catatanKhusus', e.target.value);
              setFocusedField(null);
            }}
          />
          
          {explicitMutationLog && (
            <div className="mt-0.5 bg-blue-50/60 border border-blue-100 text-blue-800 text-[9px] font-bold p-2.5 rounded-xl leading-relaxed">
              ℹ️ <span className="font-black uppercase tracking-wider text-[8px] text-blue-900 block mb-0.5">Log Mutasi Kronologis:</span>
              <p className="normal-case">{explicitMutationLog}</p>
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-1.5 select-none text-[8px] font-black tracking-wider">
            {/* Toggles if patient is problematic risk */}
            <button 
              type="button" 
              onClick={() => handleToggleMasalah('risiko')}
              className={`px-2 py-1 rounded-lg font-black flex items-center gap-1 transition-all border outline-none cursor-pointer uppercase ${
                draft.isRisikoBermasalah 
                  ? 'bg-rose-600 text-white border-rose-600 shadow shadow-rose-200 animate-pulse' 
                  : 'bg-white text-rose-650 border-rose-200 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle size={9} className="stroke-[3px]" /> RISIKO BERMASALAH
            </button>

            {/* Toggle Status Masalah: ON PROSES */}
            <button 
              type="button"
              onClick={() => handleToggleMasalah('on_proses')}
              className={`px-2 py-1 rounded-lg font-black flex items-center gap-1 transition-all border outline-none cursor-pointer uppercase ${
                draft.statusMasalah === 'ON_PROSES'
                  ? 'bg-amber-500 text-white border-amber-500 shadow shadow-amber-100'
                  : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
              }`}
            >
              <Activity size={9} className="stroke-[3px]" /> ON PROSES
            </button>

            {/* Toggle Status Masalah: SELESAI */}
            <button 
              type="button"
              onClick={() => handleToggleMasalah('selesai')}
              className={`px-2 py-1 rounded-lg font-black flex items-center gap-1 transition-all border outline-none cursor-pointer uppercase ${
                draft.statusMasalah === 'SELESAI'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow shadow-emerald-150'
                  : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle size={9} className="stroke-[3px]" /> MASALAH SELESAI
            </button>
          </div>
        </div>
      </td>

      {/* Surat Keterangan Action */}
      <td className="p-2 border-r border-slate-100 text-center w-40">
        <button 
          type="button"
          onClick={() => onOpenLetterModal?.(patient)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-all font-bold text-[9px] uppercase tracking-wide shadow-sm cursor-pointer"
        >
          <FileText size={10} /> Buat/Cetak Surat
        </button>
      </td>

      {/* Action Column for Delete */}
      <td className="p-3 text-center w-14 sticky right-0 bg-white shadow-[-8px_0_12px_rgba(0,0,0,0.05)]">
        <button 
          type="button"
          onClick={() => onDelete(patient.id)}
          className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-lg transition-all"
          title="Hapus baris pasien"
        >
          <Trash2 size={14} />
        </button>
      </td>

    </tr>

    {isHistoryExpanded && chronList.length > 1 && (
      <tr className="bg-slate-50/60 border-b border-slate-100">
        <td colSpan={35} className="p-4 bg-slate-50/30">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm max-w-4xl mx-auto space-y-4 animate-fade-in font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-[10px] font-black text-[#144272] uppercase tracking-widest flex items-center gap-1.5 font-sans">
                <RefreshCcw size={12} className="text-amber-500 animate-spin-slow" /> 
                Audit Log: Fragmen Riwayat Mutasi Pasien (Chronological Stay History)
              </span>
              <span className="text-[9px] font-mono font-black text-slate-500 uppercase bg-slate-100 px-2.5 py-1 rounded-md">
                No. Register: {patient.noRegister || "-"} | RM: {patient.noRM || "-"}
              </span>
            </div>

            <div className="overflow-hidden border border-slate-150 rounded-xl">
              <table className="w-full text-left text-[10px] border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-650 font-black uppercase tracking-wider">
                    <th className="p-3 text-center w-8">No</th>
                    <th className="p-3">Unit Tujuan / Ruangan</th>
                    <th className="p-3 text-center">Kelas & Bed</th>
                    <th className="p-3 text-center">Tanggal & Jam Masuk</th>
                    <th className="p-3 text-center">Tanggal & Jam Keluar</th>
                    <th className="p-3 text-center">Status Keluar</th>
                    <th className="p-3">DPJP Utama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {chronList.map((rec, rIdx) => {
                    const isCurrent = rec.id === patient.id;
                    return (
                      <tr 
                        key={rec.id} 
                        className={`hover:bg-slate-50/40 transition-all ${
                          isCurrent 
                            ? "bg-amber-50/40 font-extrabold text-[#144272]" 
                            : "text-slate-600 font-medium"
                        }`}
                      >
                        <td className="p-3 text-center font-mono font-bold text-slate-400">
                          {rIdx + 1} {isCurrent && <span className="ml-1 text-[8px] bg-amber-500 text-white px-1.5 py-0.5 font-black rounded uppercase tracking-wider">INI</span>}
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-slate-800 uppercase block">{rec.unitTujuan}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">{rec.ruangan || "-"}</span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700">
                          Kelas {rec.kelasRawat || "-"} / Bed {rec.nomorBed || "-"}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {rec.entryDate} <span className="text-slate-400 font-semibold text-[9px]">{rec.entryTime || "00:00"}</span>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {rec.dischargeDate || "-"} <span className="text-slate-400 font-semibold text-[9px]">{rec.dischargeTime || ""}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${
                            (rec.statusDataPasien || "").toUpperCase().includes("PINDAH")
                              ? "bg-blue-50 text-blue-700 border-blue-100"
                              : (rec.statusDataPasien || "").toUpperCase() === "MASIH DIRAWAT" || !rec.dischargeDate
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100 animate-pulse"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}>
                            {rec.statusDataPasien || "Masih Dirawat"}
                          </span>
                        </td>
                        <td className="p-3 truncate font-bold uppercase text-slate-700" title={rec.dpjpList?.join(", ")}>
                          {rec.dpjpList?.[0] || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </td>
      </tr>
    )}
  </>
);
};

export const AdminRegistrasiModule: React.FC<AdminRegistrasiModuleProps> = ({
  patients = [],
  masterData,
  currentUser,
  onUpdatePatient,
  onAddPatient,
  onDeletePatient,
  onCreateEmptyPatient,
  onNavigate
}) => {
  const [selectedPatientForLetter, setSelectedPatientForLetter] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRuanganFilter, setSelectedRuanganFilter] = useState('Semua Ruangan');
  const [selectedDPJPFilter, setSelectedDPJPFilter] = useState('Semua DPJP');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedEndDateFilter, setSelectedEndDateFilter] = useState('');
  const [selectedKrsDateFilter, setSelectedKrsDateFilter] = useState('');
  const [selectedKrsEndDateFilter, setSelectedKrsEndDateFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('Semua Status');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState(
    currentUser?.unit === "Ruang Bedah" ? "Ruang Bedah" : "Semua Unit"
  );
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showOnlyMpp, setShowOnlyMpp] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Reset page to 1 whenever any filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedRuanganFilter,
    selectedDPJPFilter,
    selectedDateFilter,
    selectedEndDateFilter,
    selectedKrsDateFilter,
    selectedKrsEndDateFilter,
    selectedStatusFilter,
    selectedUnitFilter,
    showOnlyActive,
    showOnlyMpp,
    pageSize
  ]);

  // Filter patients
  const filteredPatients = useMemo(() => {
    // Group patients by RM for history lookups
    const patientsByRM: Record<string, Patient[]> = {};
    patients.forEach(p => {
      if (p.noRM) {
        const key = p.noRM.trim().toUpperCase();
        if (!patientsByRM[key]) patientsByRM[key] = [];
        patientsByRM[key].push(p);
      }
    });

    return patients.filter(p => {
      const matchesSearch = 
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.noRM || '').includes(searchTerm) ||
        (p.noRegister || '').includes(searchTerm) ||
        (p.diagnosaUtama || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRuangan = selectedRuanganFilter === 'Semua Ruangan' || p.ruangan === selectedRuanganFilter;
      const matchesDPJP = selectedDPJPFilter === 'Semua DPJP' || p.dpjpList?.includes(selectedDPJPFilter);
      
      let matchesDateRange = true;
      if (selectedDateFilter) {
        matchesDateRange = matchesDateRange && (p.entryDate || '') >= selectedDateFilter;
      }
      if (selectedEndDateFilter) {
        matchesDateRange = matchesDateRange && (p.entryDate || '') <= selectedEndDateFilter;
      }

      let matchesKrsDateRange = true;
      if (selectedKrsDateFilter) {
        matchesKrsDateRange = matchesKrsDateRange && (p.dischargeDate || '') >= selectedKrsDateFilter;
      }
      if (selectedKrsEndDateFilter) {
        matchesKrsDateRange = matchesKrsDateRange && (p.dischargeDate || '') <= selectedKrsEndDateFilter;
      }

      const key = (p.noRM || '').trim().toUpperCase();
      const related = patientsByRM[key] || [];

      // Filter Unit: matches current unit for this specific record (mutation phase)
      const matchesUnit = selectedUnitFilter === 'Semua Unit' || (p.unitTujuan || '').toLowerCase() === selectedUnitFilter.toLowerCase();

      // Check if patient's latest record is discharged
      const sortedRelated = [...related].sort((a, b) => {
        const dateA = a.entryDate || "1970-01-01";
        const dateB = b.entryDate || "1970-01-01";
        const timeA = a.entryTime || "00:00";
        const timeB = b.entryTime || "00:00";
        const strA = `${dateA}T${timeA}`;
        const strB = `${dateB}T${timeB}`;
        return strB.localeCompare(strA);
      });
      const latestOverall = sortedRelated[0] || p;
      const latestStatus = (latestOverall.statusDataPasien || '').toUpperCase();
      
      // Pindah Ruangan is not a terminal discharge, so we do not check status === 'DISCHARGED'
      // only check actual terminal hospital discharge statuses
      const isLatestDischarged = ['BPL', 'APS', 'DIRUJUK', 'MENINGGAL', 'BATAL RAWAT INAP', 'BATAL', 'KABUR'].some(s => latestStatus.includes(s));

      const isDischarged = isLatestDischarged;
      
      const matchesActive = !showOnlyActive || !isDischarged;

      let matchesStatus = true;
      if (selectedStatusFilter !== 'Semua Status') {
        const pStatus = (p.statusDataPasien || 'Masih Dirawat').toUpperCase();
        const fStatus = selectedStatusFilter.toUpperCase();
        if (fStatus === 'MASIH DIRAWAT') {
          matchesStatus = pStatus === 'MASIH DIRAWAT' || pStatus === 'DIRAWAT' || pStatus === 'AKTIF' || !p.statusDataPasien ||
                          ['PINDAH RUANGAN', 'DIPINDAH KE RUANGAN LAIN', 'PINDAH', 'DIPINDAH', 'TRANSFER'].some(s => pStatus.includes(s));
        } else if (fStatus === 'DIPINDAH KE RUANGAN LAIN' || fStatus === 'PINDAH RUANGAN') {
          matchesStatus = ['PINDAH RUANGAN', 'DIPINDAH KE RUANGAN LAIN', 'PINDAH', 'DIPINDAH', 'TRANSFER'].some(s => pStatus.includes(s));
        } else {
          matchesStatus = pStatus.includes(fStatus) || fStatus.includes(pStatus);
        }
      }

      let matchesMpp = true;
      if (showOnlyMpp) {
        matchesMpp = !!p.isRisikoBermasalah || p.statusMasalah === 'ON_PROSES' || p.statusMasalah === 'SELESAI';
      }

      return matchesSearch && matchesRuangan && matchesDPJP && matchesActive && matchesDateRange && matchesKrsDateRange && matchesUnit && matchesStatus && matchesMpp;
    });
  }, [patients, searchTerm, selectedRuanganFilter, selectedDPJPFilter, showOnlyActive, selectedDateFilter, selectedEndDateFilter, selectedKrsDateFilter, selectedKrsEndDateFilter, selectedStatusFilter, selectedUnitFilter, showOnlyMpp]);

  const totalPages = Math.ceil(filteredPatients.length / pageSize);

  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage, pageSize]);

  // Statistics summaries
  const stats = useMemo(() => {
    const total = patients.length;
    let active = 0;
    let discharged = 0;

    patients.forEach(p => {
      const isDischarged = ['BPL', 'APS', 'DIRUJUK', 'MENINGGAL', 'PINDAH RUANGAN', 'DIPINDAH KE RUANGAN LAIN', 'BATAL'].some(s => (p.statusDataPasien || '').toUpperCase().includes(s)) || 
                           (p.statusDataPasien || '').toUpperCase().includes('PINDAH') ||
                           p.status === 'DISCHARGED';
      if (isDischarged) {
        discharged++;
      } else {
        active++;
      }
    });

    return { total, active, discharged };
  }, [patients]);

  const handleExportExcelAll = () => {
    try {
      const db = getDB();
      const allPatients = db.patients || [];
      const dailyReports = db.dailyReports || [];
      const doctorVisits = db.doctorVisits || [];
      const qualityMeasurements = db.qualityMeasurements || [];
      const instruments = db.instruments || [];
      const financeRecords = db.financeRecords || [];
      
      const patientsMap = allPatients.reduce((acc, p) => {
        if (p && p.id) {
          acc[p.id] = p;
        }
        return acc;
      }, {} as Record<string, Patient>);

      // Helper to apply premium styles, automatic fit widths & currency formatting
      const applyPremiumStyles = (ws: any, rows: any[][]) => {
        if (!rows || rows.length === 0) return;
        
        ws['!views'] = [{ showGridLines: true }];
        
        // 1. Columns auto-fit widths with +3 safety padding
        const colWidths = rows[0].map((_, colIdx) => {
          let maxLen = 10;
          rows.forEach(row => {
            if (row && row[colIdx] !== undefined && row[colIdx] !== null) {
              let valStr = String(row[colIdx]);
              if (typeof row[colIdx] === 'number') {
                valStr = row[colIdx].toLocaleString('id-ID');
              }
              if (valStr.length > maxLen) {
                maxLen = valStr.length;
              }
            }
          });
          return { wch: maxLen + 3 };
        });
        ws['!cols'] = colWidths;

        for (const ref in ws) {
          if (ref.startsWith('!')) continue;
          const cell = ws[ref];
          if (!cell) continue;

          const match = ref.match(/^([A-Z]+)([0-9]+)$/);
          if (!match) continue;
          const colStr = match[1];
          const rowNum = parseInt(match[2], 10) - 1;

          let colIdx = 0;
          for (let i = 0; i < colStr.length; i++) {
            colIdx = colIdx * 26 + (colStr.charCodeAt(i) - 64);
          }
          colIdx -= 1;

          cell.s = {
            font: { name: "Calibri", sz: 10, color: { rgb: "1E293B" } },
            alignment: { vertical: "center", horizontal: "left" },
            border: {
              top: { style: "thin", color: { rgb: "CBD5E1" } },
              bottom: { style: "thin", color: { rgb: "CBD5E1" } },
              left: { style: "thin", color: { rgb: "CBD5E1" } },
              right: { style: "thin", color: { rgb: "CBD5E1" } }
            }
          };

          if (typeof cell.v === 'number') {
            cell.z = "#,##0";
            cell.s.alignment.horizontal = "right";
          }

          const cellValueStr = String(cell.v || '');
          if (cellValueStr.toUpperCase().includes('TOTAL') || cellValueStr.toUpperCase() === 'NO') {
            cell.s.font.bold = true;
          }

          // Wajib diberi warna Background Biru Gelap (Dark Royal Navy #0A2647) dengan teks putih tebal (Bold White)
          if (rowNum === 0) {
            cell.s.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
            cell.s.fill = { fgColor: { rgb: "0A2647" } };
            cell.s.alignment.horizontal = "center";
            cell.s.border = {
              top: { style: "medium", color: { rgb: "020617" } },
              bottom: { style: "medium", color: { rgb: "020617" } },
              left: { style: "thin", color: { rgb: "475569" } },
              right: { style: "thin", color: { rgb: "475569" } }
            };
          }
        }
      };

      const wb = XLSX.utils.book_new();

      // Sheet 1: Sensus_Pasien
      const sensusRows = [
        ["No", "No RM", "No Register", "Nama Pasien", "Tgl Masuk", "Jam Masuk", "Ruangan", "Bed", "Status Pasien", "PPJA", "DPJP Utama", "Diagnosa Utama", "Diagnosa Sekunder", "Tindakan Bedah", "Cara Bayar"],
        ...allPatients.map((p, idx) => [
          idx + 1,
          p.noRM || '-',
          p.noRegister || '-',
          p.name || '-',
          p.entryDate || '-',
          p.entryTime || '-',
          p.ruangan || '-',
          p.nomorBed || '-',
          p.statusDataPasien || p.status || '-',
          p.perawatPrimer || '-',
          p.dpjpList?.join(', ') || '-',
          p.diagnosaUtama || '-',
          p.diagnosaSekunder || '-',
          p.tindakanProsedur || '-',
          p.paymentMethod?.join(', ') || '-'
        ])
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(sensusRows);
      applyPremiumStyles(ws1, sensusRows);
      XLSX.utils.book_append_sheet(wb, ws1, "Sensus_Pasien");

      // Sheet 2: Keperawatan_Pagi
      const morningReports = dailyReports.filter(r => r.morningReport || r.morningDependency || r.morningTherapy || r.morningRecordedBy);
      const morningRows = [
        ["No", "Tanggal", "No RM", "Nama Pasien", "Laporan Shift Pagi", "Tingkat Ketergantungan", "PPJA / Recorded By", "Terapi / Tindakan"],
        ...morningReports.map((r, idx) => {
          const pat = patientsMap[r.patientId] || { noRM: '-', name: '-' };
          return [
            idx + 1,
            r.date || '-',
            pat.noRM,
            pat.name,
            r.morningReport || '-',
            r.morningDependency || '-',
            r.morningRecordedBy || '-',
            r.morningTherapy || '-'
          ];
        })
      ];
      if (morningRows.length === 1) {
        morningRows.push([1, "-", "-", "Tidak ada data shift pagi", "-", "-", "-", "-"]);
      }
      const ws2 = XLSX.utils.aoa_to_sheet(morningRows);
      applyPremiumStyles(ws2, morningRows);
      XLSX.utils.book_append_sheet(wb, ws2, "Keperawatan_Pagi");

      // Sheet 3: Keperawatan_Siang
      const afternoonReports = dailyReports.filter(r => r.afternoonReport || r.afternoonDependency || r.afternoonTherapy || r.afternoonRecordedBy);
      const afternoonRows = [
        ["No", "Tanggal", "No RM", "Nama Pasien", "Laporan Shift Siang", "Tingkat Ketergantungan", "PPJA / Recorded By", "Terapi / Tindakan"],
        ...afternoonReports.map((r, idx) => {
          const pat = patientsMap[r.patientId] || { noRM: '-', name: '-' };
          return [
            idx + 1,
            r.date || '-',
            pat.noRM,
            pat.name,
            r.afternoonReport || '-',
            r.afternoonDependency || '-',
            r.afternoonRecordedBy || '-',
            r.afternoonTherapy || '-'
          ];
        })
      ];
      if (afternoonRows.length === 1) {
        afternoonRows.push([1, "-", "-", "Tidak ada data shift siang", "-", "-", "-", "-"]);
      }
      const ws3 = XLSX.utils.aoa_to_sheet(afternoonRows);
      applyPremiumStyles(ws3, afternoonRows);
      XLSX.utils.book_append_sheet(wb, ws3, "Keperawatan_Siang");

      // Sheet 4: Keperawatan_Malam
      const nightReports = dailyReports.filter(r => r.nightReport || r.nightDependency || r.nightTherapy || r.nightRecordedBy);
      const nightRows = [
        ["No", "Tanggal", "No RM", "Nama Pasien", "Laporan Shift Malam", "Tingkat Ketergantungan", "PPJA / Recorded By", "Terapi / Tindakan"],
        ...nightReports.map((r, idx) => {
          const pat = patientsMap[r.patientId] || { noRM: '-', name: '-' };
          return [
            idx + 1,
            r.date || '-',
            pat.noRM,
            pat.name,
            r.nightReport || '-',
            r.nightDependency || '-',
            r.nightRecordedBy || '-',
            r.nightTherapy || '-'
          ];
        })
      ];
      if (nightRows.length === 1) {
        nightRows.push([1, "-", "-", "Tidak ada data shift malam", "-", "-", "-", "-"]);
      }
      const ws4 = XLSX.utils.aoa_to_sheet(nightRows);
      applyPremiumStyles(ws4, nightRows);
      XLSX.utils.book_append_sheet(wb, ws4, "Keperawatan_Malam");

      // Sheet 5: Rujukan_Visite_DPJP
      const visitsRows = [
        ["No", "Tanggal", "Jam", "No RM", "Nama Pasien", "Nama Dokter / DPJP", "SMF", "Peran DPJP (Utama/Konsul)", "Status Attendance", "Recorded By"],
        ...doctorVisits.map((v, idx) => [
          idx + 1,
          v.date || '-',
          v.time || '-',
          v.noRM || '-',
          v.patientName || '-',
          v.doctorName || '-',
          v.smf || '-',
          v.visitRole || '-',
          v.attendanceStatus || '-',
          v.recordedBy || '-'
        ])
      ];
      if (visitsRows.length === 1) {
        visitsRows.push([1, "-", "-", "-", "Tidak ada data rujukan visite", "-", "-", "-", "-", "-"]);
      }
      const ws5 = XLSX.utils.aoa_to_sheet(visitsRows);
      applyPremiumStyles(ws5, visitsRows);
      XLSX.utils.book_append_sheet(wb, ws5, "Rujukan_Visite_DPJP");

      // Sheet 6: Mutu_Indikator
      const qualityRows = [
        ["No", "Tanggal", "Indikator ID", "Nama Indikator", "Numerator", "Denominator", "Capaian (%)", "Recorded By", "Catatan"],
        ...qualityMeasurements.map((m, idx) => {
          const ind = masterData?.qualityIndicators?.find(i => i.id === m.indicatorId) || { title: m.indicatorId, target: 100 };
          const pct = m.denominatorValue > 0 ? (m.numeratorValue / m.denominatorValue) * 100 : 0;
          return [
            idx + 1,
            m.date || '-',
            m.indicatorId || '-',
            ind.title || '-',
            m.numeratorValue || 0,
            m.denominatorValue || 0,
            Number(pct.toFixed(2)),
            m.recordedBy || '-',
            m.notes || '-'
          ];
        })
      ];
      if (qualityRows.length === 1) {
        qualityRows.push([1, "-", "-", "Tidak ada data mutu indikator", 0, 0, 0, "-", "-"]);
      }
      const ws6 = XLSX.utils.aoa_to_sheet(qualityRows);
      applyPremiumStyles(ws6, qualityRows);
      XLSX.utils.book_append_sheet(wb, ws6, "Mutu_Indikator");

      // Sheet 7: Inventaris_Bedah
      const instrumentRows = [
        ["No", "Kode Alat", "Nama Alat", "Kategori", "Status", "Maintenance Terakhir", "Catatan"],
        ...instruments.map((ins, idx) => [
          idx + 1,
          ins.code || '-',
          ins.name || '-',
          ins.category || '-',
          ins.status || '-',
          ins.lastMaintenance || '-',
          ins.notes || '-'
        ])
      ];
      if (instrumentRows.length === 1) {
        instrumentRows.push([1, "-", "Tidak ada data inventaris bedah", "-", "-", "-", "-"]);
      }
      const ws7 = XLSX.utils.aoa_to_sheet(instrumentRows);
      applyPremiumStyles(ws7, instrumentRows);
      XLSX.utils.book_append_sheet(wb, ws7, "Inventaris_Bedah");

      // Sheet 8: Pendapatan_Pembedahan
      const financeRows = [
        ["No", "Tanggal", "No RM", "Nama Pasien", "Tipe Transaksi", "Kategori", "Jumlah (Rp)", "Billing Akomodasi (Rp)", "Billing Tindakan (Rp)", "Billing Gas Medis (Rp)", "Keterangan", "DPJP", "KSM"],
        ...financeRecords.map((f, idx) => [
          idx + 1,
          f.date || '-',
          f.noRM || '-',
          f.patientName || '-',
          f.type || '-',
          f.category || '-',
          f.amount || 0,
          f.billingAkomodasi || 0,
          f.billingTindakan || 0,
          f.billingGasMedis || 0,
          f.description || '-',
          f.dpjp || '-',
          f.ksm || '-'
        ])
      ];
      if (financeRows.length === 1) {
        financeRows.push([1, "-", "-", "Tidak ada data pendapatan keuangan", "-", "-", 0, 0, 0, 0, "-", "-", "-"]);
      }
      const ws8 = XLSX.utils.aoa_to_sheet(financeRows);
      applyPremiumStyles(ws8, financeRows);
      XLSX.utils.book_append_sheet(wb, ws8, "Pendapatan_Pembedahan");

      // Sheet 9: Batal_Rawat
      const batalPatients = allPatients.filter(p => {
        const pStatus = (p.statusDataPasien || p.status || '').toUpperCase();
        return pStatus.includes('BATAL') || pStatus.includes('CANCEL');
      });
      const batalRows = [
        ["No", "No RM", "No Register", "Nama Pasien", "Tgl Masuk", "Jam Masuk", "Ruangan", "Bed", "Status Pasien", "DPJP Utama", "Diagnosa Utama", "Tindakan Bedah", "Cara Bayar"],
        ...batalPatients.map((p, idx) => [
          idx + 1,
          p.noRM || '-',
          p.noRegister || '-',
          p.name || '-',
          p.entryDate || '-',
          p.entryTime || '-',
          p.ruangan || '-',
          p.nomorBed || '-',
          p.statusDataPasien || p.status || '-',
          p.dpjpList?.join(', ') || '-',
          p.diagnosaUtama || '-',
          p.tindakanProsedur || '-',
          p.paymentMethod?.join(', ') || '-'
        ])
      ];
      if (batalRows.length === 1) {
        batalRows.push([1, "-", "-", "Tidak ada data pasien batal rawat", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
      }
      const ws9 = XLSX.utils.aoa_to_sheet(batalRows);
      applyPremiumStyles(ws9, batalRows);
      XLSX.utils.book_append_sheet(wb, ws9, "Batal_Rawat");

      XLSX.writeFile(wb, `Laporan_SIMANTAP_Sensus_Fisiologis_9Sheet_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error("Export workbook error: ", err);
      alert("Gagal melakukan export: Pastikan data valid.");
    }
  };

  const topScrollRef = React.useRef<HTMLDivElement>(null);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(4200);

  useEffect(() => {
    if (tableRef.current) {
      setTableScrollWidth(tableRef.current.scrollWidth);
    }
  }, [filteredPatients]);

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
  }, [filteredPatients]);

  const handleAddNewRow = () => {
    if (onCreateEmptyPatient) {
      onCreateEmptyPatient();
    } else {
      // Fallback local empty model creator
      const defaultPatient: Omit<Patient, 'id'> = {
        noRegister: `REG-${Date.now().toString().slice(-6)}`,
        noRM: '',
        name: 'PASIEN BARU',
        gender: 'L',
        birthDate: '1985-01-01',
        address: '',
        entryDate: new Date().toISOString().split('T')[0],
        origin: 'IGD',
        unitTujuan: 'Rawat Inap',
        kelasRawat: 'Kelas 3',
        ruangan: masterData.rooms[0] || '3A1',
        nomorBed: '',
        statusDataPasien: 'AKTIF',
        diagnosaUtama: '',
        tindakanProsedur: '',
        dpjpList: [],
        paymentMethod: ['BPJS'],
        noSEP: '',
        statusSEP: 'Selesai SEP',
        jenisKLL: 'Bukan KLL',
        noLP: '',
        perawatPrimer: '',
        catatanKhusus: '',
        status: 'ADMITTED'
      };
      onAddPatient(defaultPatient);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      
      {/* Upper header information card */}
      <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border shadow-sm border-l-8 border-indigo-600 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-3.5 tracking-tighter text-slate-800">
            <Users size={32} className="text-indigo-600 animate-pulse" /> SPREADSHEET REGISTRASI ADMIN
          </h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
            TABEL SINKRONISASI ADMINISTRATIF &bull; SEMUA KOTAK EDITABLE &bull; SINKRONISASI AKTIF DI SEMUA MENU
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full xl:w-auto items-center">
          <Button 
            onClick={() => {
              if (onNavigate) {
                onNavigate('adm-register');
              } else {
                handleAddNewRow();
              }
            }} 
            className="flex-1 xl:flex-initial bg-indigo-600 hover:bg-indigo-750 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-2xl flex items-center justify-center gap-2 border-none shadow-lg shadow-indigo-100 cursor-pointer transition-all"
          >
            <Plus size={16}/> TAMBAH PASIEN BARU
          </Button>
          
          <Button 
            variant="secondary"
            onClick={() => window.print()} 
            className="flex-1 xl:flex-initial font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-2xl flex items-center justify-center gap-2"
          >
            <Download size={16}/> CETAK / PDF
          </Button>

          <Button 
            variant="outline"
            onClick={handleExportExcelAll} 
            className="flex-1 xl:flex-initial bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Download size={16}/> EXPORT EXCEL
          </Button>
        </div>
      </div>

      {/* Counter Statistics Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100/60 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">GRAND TOTAL REGISTRASI</span>
            <h3 className="text-2xl font-black text-indigo-950 mt-1">{stats.total} Pasien</h3>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-650 rounded-xl font-bold text-xs"><Users size={20} /></div>
        </div>
        
        <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100/60 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block">AKTIF RAWAT (SINKRON)</span>
            <h3 className="text-2xl font-black text-emerald-950 mt-1">{stats.active} Pasien</h3>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-650 rounded-xl font-bold text-xs"><HeartHandshake size={20} /></div>
        </div>

        <div className="bg-slate-100/60 p-5 rounded-3xl border border-slate-200/60 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">TOTAL SELESAI / KRS PASIEN</span>
            <h3 className="text-2xl font-black text-slate-850 mt-1">{stats.discharged} Pasien</h3>
          </div>
          <div className="p-3 bg-slate-200 text-slate-650 rounded-xl font-bold text-xs"><Check size={20} /></div>
        </div>
      </div>

      {/* Search Filters Toolbar */}
      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          
          {/* Search */}
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Cari Pasien (Nama/RM/Reg/Diag)</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
              <input 
                type="text"
                placeholder="Kata kunci pencarian..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-100/50 focus:border-indigo-400 transition-all border-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Tanggal MRS Dari Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Tgl Masuk (Dari MRS)</label>
            <input 
              type="date"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-100/50"
              value={selectedDateFilter}
              onChange={e => setSelectedDateFilter(e.target.value)}
            />
          </div>

          {/* Tanggal MRS Sampai Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Tgl Masuk (Sampai MRS)</label>
            <input 
              type="date"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-100/50"
              value={selectedEndDateFilter}
              onChange={e => setSelectedEndDateFilter(e.target.value)}
            />
          </div>

          {/* Tanggal KRS Dari Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Filter Pasien Keluar dari Tanggal</label>
            <input 
              type="date"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-100/50"
              value={selectedKrsDateFilter}
              onChange={e => setSelectedKrsDateFilter(e.target.value)}
            />
          </div>

          {/* Tanggal KRS Sampai Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">s.d Tanggal</label>
            <input 
              type="date"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-100/50"
              value={selectedKrsEndDateFilter}
              onChange={e => setSelectedKrsEndDateFilter(e.target.value)}
            />
          </div>

          {/* Status Pasien Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Status Pasien</label>
            <SearchableSelect
              options={["Semua Status", "Masih Dirawat", "BPL", "APS", "DIRUJUK", "MENINGGAL", "Dipindah ke Ruangan Lain", "BATAL RAWAT INAP"]}
              value={selectedStatusFilter}
              onChange={val => setSelectedStatusFilter(val)}
              placeholder="Filter Status..."
            />
          </div>

          {/* Unit Tujuan Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Unit Perawatan</label>
            <SearchableSelect
              options={["Semua Unit"].concat(masterData.units || [])}
              value={selectedUnitFilter}
              onChange={val => setSelectedUnitFilter(val)}
              placeholder="Filter Unit..."
            />
          </div>

          {/* DPJP Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">DPJP</label>
            <SearchableSelect
              options={["Semua DPJP"].concat(masterData.doctors || [])}
              value={selectedDPJPFilter}
              onChange={val => setSelectedDPJPFilter(val)}
              placeholder="Filter DPJP..."
            />
          </div>

        </div>

        <div className="flex flex-wrap gap-4 items-center pt-3 border-t border-slate-100">
          
          {/* Checkbox filters */}
          <label className="flex items-center gap-2.5 cursor-pointer font-bold text-[10px] text-slate-600">
            <input 
              type="checkbox" 
              checked={showOnlyActive} 
              onChange={e => setShowOnlyActive(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Hanya tampilkan Pasien Aktif</span>
          </label>

          {/* MPP Filter */}
          <label className="flex items-center gap-2.5 cursor-pointer font-bold text-[10px] text-slate-600 bg-amber-50 hover:bg-amber-100/75 border border-amber-250/50 px-3 py-1.5 rounded-xl transition-all select-none">
            <input 
              type="checkbox" 
              checked={showOnlyMpp} 
              onChange={e => setShowOnlyMpp(e.target.checked)}
              className="rounded border-amber-300 text-amber-600 focus:ring-amber-550 w-4 h-4"
            />
            <span className="text-amber-805 font-black uppercase tracking-wider text-[9px]">⚠️ Pasien Kelolaan MPP</span>
          </label>

          {/* Ruangan Filter in checkbox level row */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ruangan:</span>
            <select 
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold cursor-pointer focus:outline-none"
              value={selectedRuanganFilter}
              onChange={e => setSelectedRuanganFilter(e.target.value)}
            >
              <option>Semua Ruangan</option>
              {masterData.rooms.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Clear filters trigger */}
          {(selectedDateFilter || selectedEndDateFilter || selectedKrsDateFilter || selectedKrsEndDateFilter || selectedUnitFilter !== 'Semua Unit' || selectedDPJPFilter !== 'Semua DPJP' || selectedRuanganFilter !== 'Semua Ruangan' || showOnlyActive || showOnlyMpp) && (
            <button
              onClick={() => {
                setSelectedDateFilter('');
                setSelectedEndDateFilter('');
                setSelectedKrsDateFilter('');
                setSelectedKrsEndDateFilter('');
                setSelectedUnitFilter('Semua Unit');
                setSelectedDPJPFilter('Semua DPJP');
                setSelectedRuanganFilter('Semua Ruangan');
                setShowOnlyActive(false);
                setShowOnlyMpp(false);
              }}
              className="ml-auto text-[9px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg active:scale-95 transition-all outline-none border-none cursor-pointer"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Spreadsheet Grid panel */}
      <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm flex flex-col">
        {/* Helper bar info */}
        <div className="bg-slate-900 px-6 py-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest">TABEL GRID REGISTRASI PASIEN & REGISTRASI SELLER</h3>
            <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase">Klik atau ubah elemen sel langsung untuk memperbarui data secara real-time</p>
          </div>
          <span className="text-[9px] font-black bg-white/10 text-indigo-200 px-3 py-1.5 rounded-lg border border-white/5 uppercase">
            Jumlah Tampil: {filteredPatients.length} dari {patients.length} rekor
          </span>
        </div>

        {/* Synchronized Top Horizontal Scrollbar */}
        <div 
          ref={topScrollRef} 
          className="overflow-x-auto overflow-y-hidden border-b border-slate-100 custom-scrollbar shrink-0 bg-slate-50/85"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div style={{ width: `${tableScrollWidth}px` }} className="h-2.5"></div>
        </div>

        {/* Outer scrolling container */}
        <div ref={tableContainerRef} className="overflow-auto relative custom-scrollbar max-h-[72vh] min-h-[60vh]">
          <table ref={tableRef} className="w-full text-[10px] border-collapse text-left min-w-[4800px]">
            <thead className="bg-[#144272]/5 text-[#144272] border-b text-center font-black uppercase tracking-wider sticky top-0 bg-white z-20 shadow-sm">
              <tr>
                <th className="p-3 w-12 border-r text-center sticky top-0 left-0 bg-slate-100 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">No</th>
                <th className="p-3 border-r text-center w-28 bg-slate-200 text-[#144272] sticky top-0 left-[48px] z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Status Admin</th>
                <th className="p-3 border-r text-center w-24 sticky top-0 left-[160px] bg-slate-100 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">No. RM</th>
                <th className="p-3 border-r text-center w-32 sticky top-0 left-[256px] bg-slate-200 text-[#144272] z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">No Register</th>
                <th className="p-3 border-r text-left w-48 sticky top-0 left-[384px] bg-slate-100 text-[#144272] z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Nama Pasien</th>
                <th className="p-3 border-r text-center w-36 sticky top-0 bg-white z-20">Unit Tujuan</th>
                <th className="p-3 border-r text-center w-32 sticky top-0 bg-white z-20">Kelas Rawat</th>
                <th className="p-3 border-r text-center w-32 sticky top-0 bg-white z-20">Ruangan</th>
                <th className="p-3 border-r text-center w-24 sticky top-0 bg-white z-20">Bed</th>
                <th className="p-3 border-r text-center w-32 sticky top-0 bg-white z-20">Ruangan Asal</th>
                <th className="p-3 border-r text-center w-24 sticky top-0 bg-white z-20">Jenis Kelamin</th>
                <th className="p-3 border-r text-center w-36 sticky top-0 bg-white z-20">Tgl Lahir</th>
                <th className="p-3 border-r text-center w-32 sticky top-0 bg-white z-20">No SEP</th>
                <th className="p-3 border-r text-center w-32 sticky top-0 bg-white z-20">Status SEP</th>
                <th className="p-3 border-r text-center w-36 sticky top-0 bg-white z-20">Jenis KLL</th>
                <th className="p-3 border-r text-center w-32 sticky top-0 bg-white z-20">No LP</th>
                <th className="p-3 border-r text-center w-56 sticky top-0 bg-white z-20">Surat Keterangan</th>
                <th className="p-3 border-r text-left min-w-[200px] sticky top-0 bg-white z-20">Alamat</th>
                <th className="p-3 border-r text-center w-32 sticky top-0 bg-white z-20">Tanggal MRS</th>
                <th className="p-3 border-r text-center w-32 sticky top-0 bg-white z-20">Tanggal KRS</th>
                <th className="p-3 border-r text-center w-24 sticky top-0 bg-white z-20">Jam KRS</th>
                <th className="p-3 border-r text-left min-w-[200px] sticky top-0 bg-white z-20">Detail KRS (Alasan, dsb)</th>
                <th className="p-3 border-r text-left min-w-[180px] sticky top-0 bg-white z-20">Diagnosa</th>
                <th className="p-3 border-r text-left min-w-[185px] sticky top-0 bg-white z-20">Tindakan Prosedur</th>
                <th className="p-3 border-r text-center w-40 sticky top-0 bg-white z-20">Jaminan</th>
                <th className="p-3 border-r text-center w-40 sticky top-0 bg-white z-20">DPJP</th>
                <th className="p-3 border-r text-center w-36 sticky top-0 bg-white z-20">PPJA / Perawat</th>
                <th className="p-3 border-r text-center w-40 sticky top-0 bg-white z-20">Riwayat Alergi</th>
                <th className="p-3 border-r text-center w-36 sticky top-0 bg-white z-20">Status Keluar</th>
                <th className="p-3 border-r text-left min-w-[420px] bg-[#144272]/10 text-rose-900 sticky top-0 z-20">Keterangan / Catatan Khusus <span className="text-rose-600 animate-pulse font-black">* WAJIB</span></th>
                <th className="p-3 border-r text-center w-40 sticky top-0 bg-white z-20">Surat Keterangan</th>
                <th className="p-3 text-center w-14 sticky right-0 bg-slate-50 shadow-[-8px_0_12px_rgba(0,0,0,0.05)]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedPatients.map((patient, idx) => (
                <SpreadsheetRow 
                  key={patient.id} 
                  patient={patient} 
                  index={(currentPage - 1) * pageSize + idx} 
                  masterData={masterData}
                  onUpdate={onUpdatePatient}
                  onDelete={onDeletePatient}
                  allPatients={patients}
                  onOpenLetterModal={setSelectedPatientForLetter}
                />
              ))}

              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={35} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/20">
                    Tidak ditemukan baris data pasien yang cocok dengan pencarian or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION CONTROLS */}
        <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-sans shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tampilkan</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-extrabold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-200 cursor-pointer"
            >
              <option value={10}>10 Baris</option>
              <option value={20}>20 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
            </select>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wide">
              Menampilkan {filteredPatients.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(filteredPatients.length, currentPage * pageSize)} dari {filteredPatients.length} data
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-bold transition-all text-[9px] uppercase tracking-wider active:scale-95"
            >
              Awal
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-bold transition-all text-[9px] uppercase tracking-wider active:scale-95"
            >
              Sebelumnya
            </button>
            
            <div className="flex items-center gap-1 px-3 font-black text-slate-700 text-[10px] uppercase bg-slate-200/50 py-1.5 rounded-lg border border-slate-300/30 font-mono">
              Halaman {currentPage} dari {totalPages || 1}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-bold transition-all text-[9px] uppercase tracking-wider active:scale-95"
            >
              Selanjutnya
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-bold transition-all text-[9px] uppercase tracking-wider active:scale-95"
            >
              Akhir
            </button>
          </div>
        </div>
      </div>

      {selectedPatientForLetter && (
        <PatientLetterModal 
          patient={selectedPatientForLetter}
          onClose={() => setSelectedPatientForLetter(null)}
          onUpdatePatient={onUpdatePatient}
          masterData={masterData}
          allPatients={patients}
        />
      )}

    </div>
  );
};
