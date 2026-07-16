
import React from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { Patient, DailyReportEntry, MasterData, QualityMeasurement, User as AppUser, compareDatesSafe } from '../../types';
import { Button } from '../Button';
// Added Gauge, Download, FileSpreadsheet, RefreshCw to the imports from lucide-react
import { FilePieChart, Activity, UserCheck, ClipboardList, TrendingUp, Gauge, Check, X, Download, FileSpreadsheet, RefreshCw, Edit, Trash2, Search } from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';

const normalizeToIcd10 = (text: string): string => {
  let name = String(text || '').toUpperCase().trim();
  if (!name || name === '-' || name === 'BELUM DIISI' || name === 'BELUM ADA') return '';

  // Clean up any ICD-10 code format like [A-Z]\d{2} or [A-Z]\d{2}.\d from the text
  name = name.replace(/\b[A-Z]\d{2}(?:\.\d{1,2})?\b/gi, '').trim();
  // Remove symbols, brackets with codes, etc.
  name = name.replace(/[\[\(][A-Z]\d{2}(?:\.\d{1,2})?[\]\)]/gi, '').trim();
  name = name.replace(/^[:\-–—\s\.\,\;]+|[:\-–—\s\.\,\;]+$/g, '').trim();

  const upper = name.toUpperCase();

  if (upper.includes('DIARRHOEA') || upper.includes('GASTROENTERITIS') || upper.includes('GEA') || upper.includes('DIARE')) {
    return "Gastroenteritis / Diare (GEA)";
  }
  if (upper.includes('DIABETES') || upper === 'DM' || upper.startsWith('DM ') || upper.includes('MELITUS')) {
    return "Diabetes Melitus (DM)";
  }
  if (upper.includes('HIPERTENSI') || upper.includes('HYPERTENSION') || upper === 'HT' || upper.startsWith('HT ')) {
    return "Hipertensi";
  }
  if (upper.includes('APPENDICITIS') || upper.includes('APENDISITIS') || upper.includes('APP ') || upper === 'APP') {
    return "Appendicitis";
  }
  if (upper.includes('GINJAL KRONIK') || upper.includes('CHRONIC KIDNEY') || upper.includes('CKD') || upper === 'CKD') {
    return "Chronic Kidney Disease (CKD)";
  }
  if (upper.includes('HERNIA') || upper.includes('INGUINALIS') || upper.includes('HERNIOPLASTI')) {
    return "Hernia Inguinalis";
  }
  if (upper.includes('GOITRE') || upper.includes('STRUMA') || upper.includes('GONDOK') || upper.includes('GOITER')) {
    return "Struma / Goitre";
  }
  if (upper.includes('BREAST') || upper.includes('PAYUDARA') || upper.includes('MAMMAE') || upper.includes('FAM') || upper.includes('CA MAMAE') || upper.includes('TUMOR MAMAE') || upper.includes('MAMMA')) {
    return "Fibroadenoma Mammae (FAM) / Tumor Mammae";
  }
  if (upper.includes('CHOLELITHIASIS') || upper.includes('BATU EMPEDU') || upper.includes('KOLELITIASIS')) {
    return "Cholelithiasis (Batu Empedu)";
  }
  if (upper.includes('COLON') || upper.includes('KOLON') || upper.includes('RECTI') || upper.includes('REKTUM')) {
    return "Malignant Neoplasm of Colon / Rectum";
  }
  if (upper.includes('BENIGN NEOPLASM') || upper.includes('TUMOR JINAK') || upper.includes('LIPOMA') || upper.includes('ATHEROMA') || upper.includes('KISTA') || upper.includes('GANGLION')) {
    return "Tumor Jinak / Lipoma / Kista";
  }
  if (upper.includes('DISC') || upper.includes('HNP') || upper.includes('HERNIATED') || upper.includes('SPINAL') || upper.includes('PINGGUNG')) {
    return "Herniated Nucleus Pulposus (HNP)";
  }
  if (upper.includes('THYROID') || upper.includes('TIROID') || upper.includes('STRUMA MALIGNA')) {
    return "Neoplasm of Thyroid";
  }
  if (upper.includes('MYOMA') || upper.includes('MIO MA') || upper.includes('MIOMA') || upper.includes('UTERI') || upper.includes('RAHIM')) {
    return "Mioma Uteri";
  }
  if (upper.includes('PROSTATE') || upper.includes('PROSTAT') || upper.includes('BPH') || upper.includes('TURP')) {
    return "Benign Prostatic Hyperplasia (BPH)";
  }
  if (upper.includes('PNEUMONIA') || upper.includes('PNEUMONI')) {
    return "Pneumonia";
  }
  if (upper.includes('STROKE') || upper.includes('CVA') || upper.includes('LUMPUH') || upper.includes('INFARK')) {
    return "Stroke / CVA";
  }
  if (upper.includes('ILEUS') || upper.includes('OBSTRUKTIF') || upper.includes('ILEUS OBSTRUKTIF') || upper.includes('KOLIK')) {
    return "Ileus Obstruktif";
  }
  if (upper.includes('UROLITHIASIS') || upper.includes('BATU GINJAL') || upper.includes('BATU SALURAN') || upper.includes('BATU KANDUNG') || upper.includes('VESIKOLITIASIS') || upper.includes('NEFROLITIASIS') || upper.includes('BATU BULI') || upper.includes('BATU URETER')) {
    if (upper.includes('BULI')) return "Batu Buli";
    if (upper.includes('URETER')) return "Batu Ureter";
    return "Urolithiasis (Batu Ginjal/Saluran Kemih)";
  }
  if (upper.includes('ABSES') || upper.includes('ABSCESS') || upper.includes('FURUNCLE') || upper.includes('SELULITIS') || upper.includes('PHLEGMON')) {
    return "Abses / Selulitis";
  }
  if (upper.includes('CEDERA KEPALA RINGAN') || upper.includes('CKR') || upper === 'CKR') {
    return "Cedera Kepala Ringan (CKR)";
  }
  if (upper.includes('CEDERA KEPALA SEDANG') || upper.includes('CKS') || upper === 'CKS') {
    return "Cedera Kepala Sedang (CKS)";
  }
  if (upper.includes('FRAKTUR FEMUR') || upper.includes('FRACTURE FEMUR')) {
    return "Fracture Femur";
  }
  if (upper.includes('ABDOMINAL PAIN') || upper.includes('NYERI PERUT') || upper.includes('KOLIK ABDOMEN')) {
    return "Abdominal Pain";
  }
  if (upper.includes('CEDERA') || upper.includes('INJURY') || upper.includes('TRAUMA') || upper.includes('VULNUS') || upper.includes('CORPUS ALIEN')) {
    return "Trauma / Vulnus / Cedera";
  }

  // Fallback to Title Case / clean name
  return name.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.substring(1).toLowerCase()).join(' ');
};

interface QualityReportsProps {
  type: 'DIAGNOSIS' | 'DEPENDENCY' | 'ATTENDANCE' | 'PATHWAY' | 'VISITE_COMPLIANCE' | 'DPJP_ABSENSI' | 'OPERASI_ELEKTIF' | 'APS_MUTU';
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  doctorVisits?: any[];
  masterData: MasterData;
  currentUser: AppUser | null;
  qualityMeasurements?: QualityMeasurement[];
  onUpdateReport?: (patientId: string, type: keyof DailyReportEntry | 'BATCH', content: any, date?: string) => void;
}

export const QualityReports: React.FC<QualityReportsProps> = ({ 
  type, 
  patients: rawPatients, 
  dailyReports: rawDailyReports, 
  doctorVisits = [],
  masterData, 
  currentUser,
  qualityMeasurements = [],
  onUpdateReport
}) => {
  const [editingReport, setEditingReport] = React.useState<any | null>(null);
  const [selectedStatusTindakanFilter, setSelectedStatusTindakanFilter] = React.useState('Semua Status');
  const [surgerySearchText, setSurgerySearchText] = React.useState('');

  // Auto-Deduplication & Auto-Hapus in DB
  React.useEffect(() => {
    if (type !== 'OPERASI_ELEKTIF' || !onUpdateReport) return;
    // Walk through all daily reports with surgery
    const opsWithSurgery = rawDailyReports.filter(r => r.surgeryProcedure && r.surgeryProcedure.trim() !== '');
    const patientGroups = new Map<string, any[]>();
    opsWithSurgery.forEach(r => {
      if (!patientGroups.has(r.patientId)) {
        patientGroups.set(r.patientId, []);
      }
      patientGroups.get(r.patientId)!.push(r);
    });

    // For any patient with > 1 surgery record, delete/clear older/inactive ones
    patientGroups.forEach((records, patientId) => {
      if (records.length <= 1) return;
      
      // Determine the best one to keep (performed wins, latest lastModified wins)
      let best = records[0];
      for (let i = 1; i < records.length; i++) {
        const current = records[i];
        const currentIsPerformed = current.surgeryStatus === 'PERFORMED';
        const bestIsPerformed = best.surgeryStatus === 'PERFORMED';
        
        const currentTime = current.lastModified ? new Date(current.lastModified).getTime() : 0;
        const bestTime = best.lastModified ? new Date(best.lastModified).getTime() : 0;

        if (currentIsPerformed && !bestIsPerformed) {
          best = current;
        } else if (!currentIsPerformed && bestIsPerformed) {
          // keep best
        } else if (currentTime > bestTime) {
          best = current;
        }
      }

      // The rest are to be auto-cleared in database
      records.forEach(r => {
        if (r.id !== best.id && r.date !== best.date) {
          // Clear surgery fields
          onUpdateReport(
            r.patientId,
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
            r.date
          );
        }
      });
    });
  }, [type, rawDailyReports, onUpdateReport]);

  const [dateRange, setDateRange] = React.useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const parseDateAsLocal = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dateStr);
  };

  const [selectedUnit, setSelectedUnit] = React.useState(() => {
    if (currentUser?.unit === "Ruang Bedah") {
      return "Ruang Bedah";
    }
    const isFullAccess = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || currentUser?.role === 'PIC';
    if (currentUser?.unit && !isFullAccess) {
      return currentUser.unit;
    }
    return 'Semua Unit';
  });

  React.useEffect(() => {
    if (currentUser?.unit === "Ruang Bedah") {
      setSelectedUnit("Ruang Bedah");
      return;
    }
    const isFullAccess = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || currentUser?.role === 'PIC';
    if (currentUser?.unit && !isFullAccess) {
      setSelectedUnit(currentUser.unit);
    }
  }, [currentUser]);

  const units = React.useMemo(() => {
    const isFullAccess = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || currentUser?.role === 'PIC';
    if (currentUser?.unit && !isFullAccess) {
      return [currentUser.unit];
    }
    // Prioritize units from visits but merge with masterData if needed
    const visitsUnits = Array.from(new Set(doctorVisits.map(v => v.unit))).filter(Boolean);
    const masterUnits = masterData.units || [];
    return Array.from(new Set([...visitsUnits, ...masterUnits])).sort();
  }, [doctorVisits, masterData.units, currentUser]);
  
  const patients = React.useMemo(() => {
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
    let list = rawPatients;
    if (selectedUnit !== 'Semua Unit') {
      list = list.filter(p => normalize(p.unitTujuan) === normalize(selectedUnit) || normalize(p.ruangan) === normalize(selectedUnit));
    }
    return list;
  }, [rawPatients, selectedUnit]);

  const dailyReports = React.useMemo(() => {
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
    let list = rawDailyReports;
    if (selectedUnit !== 'Semua Unit') {
      const unitPatients = rawPatients.filter(p => normalize(p.unitTujuan) === normalize(selectedUnit) || normalize(p.ruangan) === normalize(selectedUnit)).map(p => p.id);
      list = list.filter(r => unitPatients.includes(r.patientId));
    }
    return list;
  }, [rawDailyReports, rawPatients, selectedUnit]);

  const rawDiagnosisList = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const matchedPatients = rawPatients.filter(p => {
      if (selectedUnit === 'Semua Unit') return true;
      const normalize = (u: string) => (u || '').trim().toUpperCase();
      return normalize(p.unitTujuan) === normalize(selectedUnit);
    });

    const rawTermsCollected: string[] = [];

    // Filter helper to determine if a term is a surgical procedure or a nursing diagnosis
    const isProcedureOrNursingDiagnosis = (term: string): boolean => {
      const normalized = term.toLowerCase().trim();
      if (!normalized) return true;

      const blacklist = [
        // Procedures / Tindakan Medis Operasi
        'orif', 'oref', 'debridement', 'debridemant', 'appendectomy', 'apendektomi', 'amputasi', 'amputation', 
        'laparotomi', 'laparotomy', 'herniorafi', 'hernioplasti', 'hernioplasty', 'sectio', 'cesarean', 'sc ', ' sc', 
        'turp', 'mastektomi', 'mastectomy', 'tindakan', 'operasi', 'prosedur', 'pembedahan', 'excisi', ' excision', 
        'biopsi', 'biopsy', 'extirpasi', 'heacting', 'hecting', 'up hecting', 'necrotomy', 'necrotomi', 'kraniotomi', 
        'craniotomy', 'cystostomi', 'sistosistomi', 'pleurodesis', 'thoracocentesis', 'punksi', 'drinase', 'drainage', 
        'irigasi', 'kemoterapi', 'chemotherapy', 'hemodialisa', 'hemodialysis', 'tracheostomi', 'trakeostomi', 'intubasi', 
        'extubasi', 'dekompresi', 'tindakan', 'sirkumsisi', 'suturing', 'pemasangan', 'venaseksi',

        // Diagnosa Keperawatan / Nursing Diagnoses
        'nyeri', 'bersihan jalan', 'pola napas', 'pola nafas', 'gangguan mobilitas', 'ansietas', 'cemas', 'pola tidur',
        'hipertermia', 'hipotermia', 'infeksi', 'risiko', 'resiko', 'defisit', 'kelebihan volume', 'kekurangan volume',
        'perfusi', 'integritas', 'pertukaran gas', 'intoleransi', 'perawatan diri', 'eliminasi', 'retensi', 'konstipasi', 
        'jatuh', 'ketidakstabilan', 'curah jantung', 'termoregulasi', 'distres', 'disfungsi', 'disfagia', 'koping', 
        'isolasi', 'harga diri', 'keputusasaan', 'ketidakberdayaan', 'rasa nyaman', 'mual', 'muntah', 'pengetahuan',
        'kecemasan', 'ketidakefektifan', 'kerusakan', 'penurunan', 'hambatan', 'kelelahan'
      ];

      return blacklist.some(word => {
        // Safe check to avoid matching "sepsis" or "isk" with "infeksi" unless it is explicitly a risk or nursing diagnosis
        if (word === 'infeksi' && (normalized.includes('saluran kemih') || normalized.includes('isk') || normalized.includes('paru'))) {
          return false; // allow urinary tract infection, ISK, etc.
        }
        if (word === 'infeksi' && !normalized.includes('risiko') && !normalized.includes('resiko') && !normalized.includes('gangguan')) {
          return false; // allow plain medical diagnosis containing "infeksi" unless it's "risiko infeksi"
        }
        if (word === 'cedera' && normalized.includes('kepala')) {
          return false; // allow head injuries like CKR/CKS
        }
        return normalized.includes(word);
      });
    };

    // Alihkan source column pemrosesan data: ambil khusus "Diagnosa Medis" terakhir pasien
    // yang dikumpulkan dari lembar Laporan Keperawatan/Pelayanan seluruh pasien
    matchedPatients.forEach(p => {
      const patientReports = rawDailyReports.filter(r => 
        r.patientId === p.id && 
        r.date >= dateRange.start && 
        r.date <= dateRange.end && 
        r.diagnosis && 
        r.diagnosis.trim() !== ''
      );

      if (patientReports.length > 0) {
        // Sort to get the latest report
        patientReports.sort((a, b) => {
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

        const latestDiag = patientReports[0].diagnosis;
        if (latestDiag && latestDiag.trim() !== '') {
          rawTermsCollected.push(latestDiag);
        }
      }
    });

    // Heuristics mapping to standardize raw inputs of active diagnoses list
    rawTermsCollected.forEach(item => {
      const separatedList = item
        .split(/[,;+/]|\s+dan\s+|\s+with\s+|\s+&\s+/i)
        .map(x => x.trim())
        .filter(x => x.length > 1);

      separatedList.forEach(singleTerm => {
        // Skip procedures and nursing diagnoses
        if (isProcedureOrNursingDiagnosis(singleTerm)) {
          return;
        }

        let name = singleTerm.toUpperCase().trim();
        
        if (name.includes(' EC ')) name = name.split(' EC ')[0].trim();
        if (name.includes(' EC.')) name = name.split(' EC.')[0].trim();
        if (name.includes(' POST-')) name = name.split(' POST-')[0].trim();
        if (name.includes(' POST ')) name = name.split(' POST ')[0].trim();
        if (name.includes(' PRO ')) name = name.split(' PRO ')[0].trim();
        if (name.includes(' ACCID')) name = name.split(' ACCID')[0].trim();
        if (name.includes(' JATUH')) name = name.split(' JATUH')[0].trim();

        name = name.replace(/^POST\s+/g, '');
        name = name.replace(/^PRO\s+/g, '');
        name = name.replace(/^SUSP\s+/g, '');
        name = name.replace(/^SUSP\.\s+/g, '');

        name = normalizeToIcd10(name);
        
        name = name.trim();
        if (name.length > 2 && !['DENGAN', 'DAN', 'PRE', 'POST', 'POSTOP', 'DIAGNOSA', 'PASIEN', 'RUANG', 'KARENA', 'SEBAB'].includes(name.toUpperCase())) {
          counts[name] = (counts[name] || 0) + 1;
        }
      });
    });

    const list = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { 
      list, 
      totalPatient: matchedPatients.length, 
      totalTermsLength: rawTermsCollected.length,
      rawTerms: rawTermsCollected
    };
  }, [rawPatients, rawDailyReports, selectedUnit, dateRange]);

  const [aiStandardizedList, setAiStandardizedList] = React.useState<any[] | null>(null);
  const [isAiHarmonizing, setIsAiHarmonizing] = React.useState(false);
  const lastAttemptedKeyRef = React.useRef<string>('');

  // Auto-clear standardized list and reference whenever the unit or period filters change
  React.useEffect(() => {
    setAiStandardizedList(null);
    lastAttemptedKeyRef.current = '';
  }, [selectedUnit, dateRange]);

  const handleAiHarmonize = async (rawList: { name: string, count: number }[]) => {
    setIsAiHarmonizing(true);
    try {
      // Limit to top 40 raw matches to stay within tokens limit safely and keep interactions snappy
      const listToSend = rawList.slice(0, 40);
      const res = await fetch('/api/standardize-diagnoses-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosesList: listToSend })
      });
      const d = await res.json();
      if (d.success && Array.isArray(d.standardizedList)) {
        setAiStandardizedList(d.standardizedList);
      } else {
        console.warn(`Gagal menyelaraskan diagnosa dengan AI: ${d.error || 'Terjadi masalah'}`);
      }
    } catch (err: any) {
      console.error(`Gagal menghubungi server AI: ${err.message}`);
    } finally {
      setIsAiHarmonizing(false);
    }
  };

  // Safe Auto-Harmonization effect
  React.useEffect(() => {
    const key = `${selectedUnit}_${dateRange.start}_${dateRange.end}_${rawDiagnosisList.list.length}`;
    if (rawDiagnosisList.list.length > 0 && aiStandardizedList === null && !isAiHarmonizing && lastAttemptedKeyRef.current !== key) {
      lastAttemptedKeyRef.current = key;
      handleAiHarmonize(rawDiagnosisList.list);
    }
  }, [rawDiagnosisList, aiStandardizedList, isAiHarmonizing, selectedUnit, dateRange]);

  const handleExportDiagnosisToExcel = (activeData: any[]) => {
    try {
      const wb = XLSX.utils.book_new();
      const totalFreq = activeData.reduce((sum, item) => sum + item.count, 0);

      // Sheet 1: Ranks
      const rowsTop10 = activeData.map((item, idx) => ({
        'Peringkat (Rank)': idx + 1,
        'Kategori Diagnosa Medis': item.name,
        'Jumlah Kasus (Frekuensi)': item.count,
        'Persentase (%)': totalFreq > 0 ? ((item.count / totalFreq) * 100).toFixed(1) + '%' : '0%'
      }));
      const wsTop10 = XLSX.utils.json_to_sheet(rowsTop10);
      XLSX.utils.book_append_sheet(wb, wsTop10, 'Top 10 Diagnosa Medis');

      // Sheet 2: Auditable Patient Logs
      const matchedPatients = rawPatients.filter(p => {
        if (selectedUnit === 'Semua Unit') return true;
        const normalize = (u: string) => (u || '').trim().toUpperCase();
        return normalize(p.unitTujuan) === normalize(selectedUnit);
      });
      
      const rowsAudit: any[] = [];
      matchedPatients.forEach(p => {
        const hasActiveReportsInRange = rawDailyReports.some(r => 
          r.patientId === p.id && r.date >= dateRange.start && r.date <= dateRange.end
        );
        const matchesAdmitDate = p.entryDate && p.entryDate >= dateRange.start && p.entryDate <= dateRange.end;

        const patientReports = rawDailyReports.filter(r => 
          r.patientId === p.id && r.date >= dateRange.start && r.date <= dateRange.end
        );

        if (matchesAdmitDate || hasActiveReportsInRange) {
          const shiftDiagList = patientReports
            .map(r => `[${r.date}] ${r.diagnosis || '-'}`)
            .filter(str => !str.endsWith('-'))
            .join('; ');

          rowsAudit.push({
            'No. RM': p.noRM || '-',
            'Nama Pasien': p.name || '-',
            'Ruangan / Bed': `${p.ruangan || '-'} / ${p.nomorBed || '-'}`,
            'Diagnosa Utama Masuk': p.diagnosaUtama || '-',
            'Diagnosa Harian Shift (Periode)': shiftDiagList || '(Tidak ada update harian)',
            'Tanggal Masuk': p.entryDate || '-'
          });
        }
      });

      const wsAudit = XLSX.utils.json_to_sheet(rowsAudit);
      XLSX.utils.book_append_sheet(wb, wsAudit, 'Data Pasien Terpindai');

      XLSX.writeFile(wb, `Laporan_Mutu_Top_10_Diagnosa_${String(selectedUnit).replace(/\s+/g, '_')}_${dateRange.start}_to_${dateRange.end}.xlsx`);
    } catch (err: any) {
      alert('Gagal mengekspor laporan diagnosa ke Excel: ' + err.message);
    }
  };

  const renderDiagnosisReport = () => {
    const heuristicList = rawDiagnosisList.list;
    const isAiPresent = aiStandardizedList !== null;
    const compiledTotalList = isAiPresent ? aiStandardizedList! : heuristicList;

    const top10Data = compiledTotalList.slice(0, 10);
    const totalPatientCount = rawDiagnosisList.totalPatient;
    const totalTermsCount = rawDiagnosisList.totalTermsLength;

    return (
      <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-10 animate-fade-in">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b">
           <div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[9px] font-black uppercase tracking-widest text-[#144272] flex items-center gap-1.5 font-mono">
                  📊 KERTAS KERJA INDIKATOR MUTU
                </span>
                {isAiPresent && (
                  <span className="px-3 py-1 bg-emerald-100 border border-emerald-200 rounded-full text-[9px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    ✨ DISERASIKAN OLEH AI
                  </span>
                )}
              </div>
              <h3 className="text-3xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter mt-1.5">
                <FilePieChart size={36} className="text-indigo-650"/> Top 10 Diagnosa Medis Terbanyak
              </h3>
              <p className="text-slate-400 mt-2 font-semibold text-xs leading-normal">
                Disusun dari diagnosa masuk (admission), kompilasi laporan shift keperawatan, dan laporan visite harian terintegrasi ({selectedUnit === 'Semua Unit' ? 'Seluruh Ruangan' : `Ruang ${selectedUnit}`}). 
              </p>
           </div>

           {/* Quick Stats Summary badges */}
           <div className="flex gap-3 text-[10px] leading-relaxed">
             <div className="p-3 bg-slate-50 border rounded-2xl">
               <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px] font-mono">Pasien Terpindai</span>
               <span className="font-mono text-base font-black text-slate-800">{totalPatientCount}</span>
             </div>
             <div className="p-3 bg-slate-50 border rounded-2xl">
               <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px] font-mono">Total Entri Diagnosa</span>
               <span className="font-mono text-base font-black text-indigo-600">{totalTermsCount}</span>
             </div>
           </div>
        </div>

        {/* Action Controls Panel */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => handleAiHarmonize(heuristicList)}
            disabled={isAiHarmonizing || heuristicList.length === 0}
            className="px-6 py-3.5 bg-gradient-to-r from-indigo-950 via-slate-900 to-[#144272] hover:bg-slate-950 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-md flex items-center justify-center gap-2"
          >
            {isAiHarmonizing ? (
              <>
                <RefreshCw size={14} className="animate-spin text-purple-400" />
                Deduplikasi & Standardisasi AI...
              </>
            ) : (
              <>
                ✨ JALANKAN HARMONISASI AI GEMINI
              </>
            )}
          </Button>

          <Button
            onClick={() => handleExportDiagnosisToExcel(compiledTotalList)}
            disabled={compiledTotalList.length === 0}
            className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-md flex items-center justify-center gap-2"
          >
            📥 EKSTRAK DATA KE EXCEL (.XLSX)
          </Button>

          {isAiPresent && (
            <Button
              onClick={() => setAiStandardizedList(null)}
              variant="outline"
              className="px-5 py-3.5 text-slate-400 hover:text-slate-600 border border-slate-200 text-[10px] font-black uppercase rounded-2xl"
            >
              Kembalikan ke Mentah
            </Button>
          )}
        </div>

        {compiledTotalList.length === 0 ? (
          <div className="text-center p-16 bg-slate-50 border border-dashed rounded-3xl text-slate-400 text-xs font-semibold leading-relaxed">
             Tidak ada rekam medis diagnosa yang tercatat pada unit tujuan {selectedUnit} selama periode {dateRange.start} s/d {dateRange.end}.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
             <div className="lg:col-span-8 h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={top10Data} layout="vertical" margin={{ left: 150 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1}/>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={140} tick={{fontSize: 9, fontWeight: 'bold', fill: '#475569'}} axisLine={false} tickLine={false}/>
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#4f46e5" radius={[0, 10, 10, 0]} barSize={26}>
                         {top10Data.map((entry, index) => (
                           <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.08)} />
                         ))}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </div>
             <div className="lg:col-span-4 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                {top10Data.map((item, i) => {
                  const totalFreq = top10Data.reduce((sum, x) => sum + x.count, 0);
                  const percentage = totalFreq > 0 ? ((item.count / totalFreq) * 100).toFixed(0) + '%' : '0%';
                  return (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:scale-[1.01] hover:shadow-sm">
                       <div className="flex items-center gap-3">
                          <span className="w-8 h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200/50 font-black text-xs text-slate-500 font-mono">{i+1}</span>
                          <div>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-1 truncate max-w-[170px]" title={item.name}>{item.name}</span>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider font-mono">{percentage} Kasus Terlaporkan</span>
                          </div>
                       </div>
                       <span className="text-lg font-black text-[#144272] font-mono shrink-0 pl-2">{item.count}</span>
                    </div>
                  );
                })}
             </div>
          </div>
        )}
      </div>
    );
  };

  const renderDependencyReport = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayReports = dailyReports.filter(r => r.date === today);

    // Start date and end date from dateRange state
    const parsedStartDate = parseDateAsLocal(dateRange.start);
    const year = parsedStartDate.getFullYear();
    const month = parsedStartDate.getMonth(); // 0-11
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNamesID = [
      'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
      'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
    ];
    const monthName = monthNamesID[month];

    // Helper to get counts for a specific day
    const getDayData = (dayNum: number) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      
      // Filter reports for that day
      const dayReports = dailyReports.filter(r => r.date === dateStr);

      const pagi = {
        min: dayReports.filter(r => r.morningDependency === 'MINIMAL').length,
        part: dayReports.filter(r => r.morningDependency === 'PARSIAL').length,
        tot: dayReports.filter(r => r.morningDependency === 'TOTAL').length,
        sum: 0
      };
      pagi.sum = pagi.min + pagi.part + pagi.tot;

      const sore = {
        min: dayReports.filter(r => r.afternoonDependency === 'MINIMAL').length,
        part: dayReports.filter(r => r.afternoonDependency === 'PARSIAL').length,
        tot: dayReports.filter(r => r.afternoonDependency === 'TOTAL').length,
        sum: 0
      };
      sore.sum = sore.min + sore.part + sore.tot;

      const malam = {
        min: dayReports.filter(r => r.nightDependency === 'MINIMAL').length,
        part: dayReports.filter(r => r.nightDependency === 'PARSIAL').length,
        tot: dayReports.filter(r => r.nightDependency === 'TOTAL').length,
        sum: 0
      };
      malam.sum = malam.min + malam.part + malam.tot;

      return { pagi, sore, malam };
    };

    // Construct days array
    const monthDays = Array.from({ length: daysInMonth }, (_, idx) => {
      const dayNum = idx + 1;
      return { dayNum, ...getDayData(dayNum) };
    });

    // Calculate Column Totals
    const totals = monthDays.reduce((acc, curr) => {
      acc.pagi.min += curr.pagi.min;
      acc.pagi.part += curr.pagi.part;
      acc.pagi.tot += curr.pagi.tot;
      acc.pagi.sum += curr.pagi.sum;

      acc.sore.min += curr.sore.min;
      acc.sore.part += curr.sore.part;
      acc.sore.tot += curr.sore.tot;
      acc.sore.sum += curr.sore.sum;

      acc.malam.min += curr.malam.min;
      acc.malam.part += curr.malam.part;
      acc.malam.tot += curr.malam.tot;
      acc.malam.sum += curr.malam.sum;

      return acc;
    }, {
      pagi: { min: 0, part: 0, tot: 0, sum: 0 },
      sore: { min: 0, part: 0, tot: 0, sum: 0 },
      malam: { min: 0, part: 0, tot: 0, sum: 0 }
    });

    // XLSX exporter khusus
    const handleExportExcel = () => {
      const rawData = [];
      rawData.push(["LAPORAN TINGKAT KETERGANTUNGAN PASIEN"]);
      rawData.push([`RUANG: ${selectedUnit.toUpperCase()}`]);
      rawData.push([`BULAN: ${monthName} ${year}`]);
      rawData.push([]); // blank row
      // Header row 1
      rawData.push(["TGL", "PAGI", "", "", "", "SORE", "", "", "", "MALAM", "", "", "", "KET"]);
      // Header row 2
      rawData.push([
        "",
        "Minimal Care", "Partial Care", "Total Care", "Total Pasien",
        "Minimal Care", "Partial Care", "Total Care", "Total Pasien",
        "Minimal Care", "Partial Care", "Total Care", "Total Pasien",
        ""
      ]);

      // Add day rows
      monthDays.forEach(day => {
        rawData.push([
          day.dayNum,
          day.pagi.min, day.pagi.part, day.pagi.tot, day.pagi.sum,
          day.sore.min, day.sore.part, day.sore.tot, day.sore.sum,
          day.malam.min, day.malam.part, day.malam.tot, day.malam.sum,
          ""
        ]);
      });

      // Add total row
      rawData.push([
        "TOTAL",
        totals.pagi.min, totals.pagi.part, totals.pagi.tot, totals.pagi.sum,
        totals.sore.min, totals.sore.part, totals.sore.tot, totals.sore.sum,
        totals.malam.min, totals.malam.part, totals.malam.tot, totals.malam.sum,
        ""
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet(rawData);

      // Apply merges for headers
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 13 } },
        { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // TGL vertical merge
        { s: { r: 4, c: 1 }, e: { r: 4, c: 4 } }, // PAGI horizontal merge
        { s: { r: 4, c: 5 }, e: { r: 4, c: 8 } }, // SORE horizontal merge
        { s: { r: 4, c: 9 }, e: { r: 4, c: 12 } }, // MALAM horizontal merge
        { s: { r: 4, c: 13 }, e: { r: 5, c: 13 } } // KET vertical merge
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ketergantungan Pasien');
      XLSX.writeFile(workbook, `Laporan_Ketergantungan_Pasien_${monthName}_${year}.xlsx`);
    };

    // Group dependency data by date for chart
    const dateMap: Record<string, { MINIMAL: number, PARSIAL: number, TOTAL: number }> = {};
    
    dailyReports.forEach(r => {
      if (!dateMap[r.date]) dateMap[r.date] = { MINIMAL: 0, PARSIAL: 0, TOTAL: 0 };
      
      const patientMorning = r.morningDependency;
      const patientAfternoon = r.afternoonDependency;
      const patientNight = r.nightDependency;

      if (patientMorning) dateMap[r.date][patientMorning]++;
      else if (patientAfternoon) dateMap[r.date][patientAfternoon]++;
      else if (patientNight) dateMap[r.date][patientNight]++;
    });

    const chartData = Object.entries(dateMap)
      .sort((a, b) => compareDatesSafe(a[0], b[0], false))
      .slice(-7)
      .map(([date, counts]) => ({
        date: date.split('-').slice(1).join('/'),
        ...counts
      }));

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {[
             { label: 'MINIMAL CARE', color: 'emerald', val: todayReports.filter(r => r.morningDependency === 'MINIMAL' || r.afternoonDependency === 'MINIMAL' || r.nightDependency === 'MINIMAL').length },
             { label: 'PARSIAL CARE', color: 'amber', val: todayReports.filter(r => r.morningDependency === 'PARSIAL' || r.afternoonDependency === 'PARSIAL' || r.nightDependency === 'PARSIAL').length },
             { label: 'TOTAL CARE', color: 'rose', val: todayReports.filter(r => r.morningDependency === 'TOTAL' || r.afternoonDependency === 'TOTAL' || r.nightDependency === 'TOTAL').length },
           ].map((stat, i) => (
             <div key={i} className={`bg-white p-8 rounded-[2rem] border shadow-sm border-b-8 border-b-${stat.color}-500 transition-all hover:scale-105`}>
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{stat.label} (Hari Ini)</h5>
                <div className="text-4xl font-black text-slate-800">{stat.val} <span className="text-xs text-slate-300 font-bold">Pasien</span></div>
             </div>
           ))}
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
           <h3 className="text-2xl font-black text-slate-800 mb-10 flex items-center gap-3">
             <Activity size={32} className="text-indigo-600"/> Tren Beban Kerja Keperawatan (7 Hari)
           </h3>
           <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs>
                       <linearGradient id="colorMin" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                       <linearGradient id="colorPar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                       <linearGradient id="colorTot" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" />
                    <Area type="monotone" dataKey="MINIMAL" stroke="#10b981" fillOpacity={1} fill="url(#colorMin)" stackId="1" />
                    <Area type="monotone" dataKey="PARSIAL" stroke="#f59e0b" fillOpacity={1} fill="url(#colorPar)" stackId="1" />
                    <Area type="monotone" dataKey="TOTAL" stroke="#ef4444" fillOpacity={1} fill="url(#colorTot)" stackId="1" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Tabel Laporan Bulanan Ketergantungan Pasien */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
            <div>
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <FileSpreadsheet size={28} className="text-emerald-600"/> Laporan Tingkat Ketergantungan Pasien
              </h3>
              <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">
                RUANG: {selectedUnit} | BULAN: {monthName} {year}
              </p>
            </div>
            <button 
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] tracking-wider uppercase py-3 px-6 rounded-2xl flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Download size={14}/> Export Laporan Excel
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-150 rounded-[2rem] bg-slate-50/50 shadow-inner">
            <table className="min-w-[1000px] w-full text-center text-xs">
              <thead className="bg-[#144272] text-white text-[9px] uppercase font-black tracking-wider">
                <tr className="border-b border-white/10">
                  <th rowSpan={2} className="p-3 pl-4 border-r border-white/10 w-[60px]">Tgl</th>
                  <th colSpan={4} className="p-2 border-r border-white/10 bg-blue-900/45">Shift Pagi</th>
                  <th colSpan={4} className="p-2 border-r border-white/10 bg-indigo-900/40">Shift Sore</th>
                  <th colSpan={4} className="p-2 border-r border-white/10 bg-slate-800/50">Shift Malam</th>
                  <th rowSpan={2} className="p-3 pr-4 w-[120px]">Ket</th>
                </tr>
                <tr>
                  {/* PAGI */}
                  <th className="p-2 text-[8px] bg-blue-900/30">Minimal</th>
                  <th className="p-2 text-[8px] bg-blue-900/30">Partial</th>
                  <th className="p-2 text-[8px] bg-blue-900/30">Total</th>
                  <th className="p-2 text-[8px] bg-blue-950/40 border-r border-white/10">Sum</th>
                  {/* SORE */}
                  <th className="p-2 text-[8px] bg-indigo-900/20">Minimal</th>
                  <th className="p-2 text-[8px] bg-indigo-900/20">Partial</th>
                  <th className="p-2 text-[8px] bg-indigo-900/20">Total</th>
                  <th className="p-2 text-[8px] bg-indigo-950/30 border-r border-white/10">Sum</th>
                  {/* MALAM */}
                  <th className="p-2 text-[8px] bg-slate-800/30">Minimal</th>
                  <th className="p-2 text-[8px] bg-slate-800/30">Partial</th>
                  <th className="p-2 text-[8px] bg-slate-800/30">Total</th>
                  <th className="p-2 text-[8px] bg-slate-900/40 border-r border-white/10">Sum</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-bold text-slate-700">
                {monthDays.map(day => (
                  <tr key={day.dayNum} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 pl-4 border-r border-slate-100 bg-slate-50/50 text-slate-500 font-black">{day.dayNum}</td>
                    {/* PAGI */}
                    <td className="p-2 text-slate-600 bg-emerald-50/20">{day.pagi.min || '-'}</td>
                    <td className="p-2 text-slate-600 bg-emerald-50/20">{day.pagi.part || '-'}</td>
                    <td className="p-2 text-slate-600 bg-emerald-50/20">{day.pagi.tot || '-'}</td>
                    <td className="p-2 text-indigo-700 bg-indigo-50/30 border-r border-slate-100 font-extrabold">{day.pagi.sum || '-'}</td>
                    {/* SORE */}
                    <td className="p-2 text-slate-600 bg-amber-50/20">{day.sore.min || '-'}</td>
                    <td className="p-2 text-slate-600 bg-amber-50/20">{day.sore.part || '-'}</td>
                    <td className="p-1 text-slate-600 bg-amber-50/20">{day.sore.tot || '-'}</td>
                    <td className="p-2 text-indigo-700 bg-indigo-50/30 border-r border-slate-100 font-extrabold">{day.sore.sum || '-'}</td>
                    {/* MALAM */}
                    <td className="p-2 text-slate-600 bg-rose-50/20">{day.malam.min || '-'}</td>
                    <td className="p-2 text-slate-600 bg-rose-50/20">{day.malam.part || '-'}</td>
                    <td className="p-2 text-slate-600 bg-rose-50/20">{day.malam.tot || '-'}</td>
                    <td className="p-2 text-indigo-700 bg-indigo-50/30 border-r border-slate-100 font-extrabold">{day.malam.sum || '-'}</td>
                    <td className="p-2 pr-4 text-slate-400 font-medium italic text-[10px]">shift entries ok</td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-slate-800 text-white font-black text-xs">
                  <td className="p-3 pl-4 border-r border-slate-900 bg-slate-900">Total</td>
                  {/* PAGI */}
                  <td className="p-3">{totals.pagi.min}</td>
                  <td className="p-3">{totals.pagi.part}</td>
                  <td className="p-3">{totals.pagi.tot}</td>
                  <td className="p-3 bg-slate-900/80 border-r border-slate-950">{totals.pagi.sum}</td>
                  {/* SORE */}
                  <td className="p-3">{totals.sore.min}</td>
                  <td className="p-3">{totals.sore.part}</td>
                  <td className="p-3">{totals.sore.tot}</td>
                  <td className="p-3 bg-slate-900/80 border-r border-slate-950">{totals.sore.sum}</td>
                  {/* MALAM */}
                  <td className="p-3">{totals.malam.min}</td>
                  <td className="p-3">{totals.malam.part}</td>
                  <td className="p-3">{totals.malam.tot}</td>
                  <td className="p-3 bg-slate-900/80 border-r border-slate-950">{totals.malam.sum}</td>
                  <td className="p-3 pr-4 text-[10px] uppercase font-black tracking-widest text-slate-400">Audited</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAttendanceReport = () => {
    // Group visits by SMF for summary
    const smfStats: Record<string, { hadir: number, absen: number, izin: number }> = {};
    const docVisitsMap: Record<string, { hadir: number, absen: number, izin: number, smf: string }> = {};
    
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
    // Apply filters
    const filteredVisits = doctorVisits.filter(v => {
      const matchesUnit = selectedUnit === 'Semua Unit' || normalize(v.unit) === normalize(selectedUnit);
      const matchesDate = v.date >= dateRange.start && v.date <= dateRange.end;
      return matchesUnit && matchesDate;
    });

    filteredVisits.forEach(v => {
      const statuses = v.attendanceStatuses || [v.attendanceStatus];
      
      // Interpretation logic for attendance
      let result: 'HADIR' | 'ABSEN' | 'IZIN' = 'ABSEN';
      
      if (statuses.includes('IZIN') || statuses.includes('CUTI')) {
        result = 'IZIN';
      } else if (statuses.includes('TIDAK_HADIR')) {
        result = 'ABSEN';
      } else if (statuses.includes('HADIR') || statuses.includes('ASISTEN')) {
        result = 'HADIR';
      }

      // Doc level
      if (!docVisitsMap[v.doctorName]) {
        docVisitsMap[v.doctorName] = { hadir: 0, absen: 0, izin: 0, smf: v.smf };
      }
      if (result === 'HADIR') docVisitsMap[v.doctorName].hadir++;
      else if (result === 'IZIN') docVisitsMap[v.doctorName].izin++;
      else docVisitsMap[v.doctorName].absen++;

      // SMF level
      if (!smfStats[v.smf]) smfStats[v.smf] = { hadir: 0, absen: 0, izin: 0 };
      if (result === 'HADIR') smfStats[v.smf].hadir++;
      else if (result === 'IZIN') smfStats[v.smf].izin++;
      else smfStats[v.smf].absen++;
    });

    const docData = Object.entries(docVisitsMap).map(([name, stats]) => ({
      name,
      ...stats,
      percentage: Math.round((stats.hadir / (stats.hadir + stats.absen + stats.izin)) * 100) || 0
    }));

    const smfData = Object.entries(smfStats).map(([name, stats]) => ({
      name,
      ...stats,
      percentage: Math.round((stats.hadir / (stats.hadir + stats.absen + stats.izin)) * 100) || 0
    }));

    return (
      <div className="space-y-8 animate-fade-in text-slate-800">
         <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h3 className="text-3xl font-black flex items-center gap-3 tracking-tighter">
                    <UserCheck size={36} className="text-emerald-600"/> INDIKATOR MUTU: ABSENSI DPJP
                  </h3>
                  <p className="text-slate-400 font-medium uppercase text-[10px] tracking-widest mt-1">Monitoring Kehadiran Dokter Penanggung Jawab Pelayanan</p>
               </div>
               <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-100 flex items-center gap-2">
                 Export PDF / Excel
               </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Analisis Per SMF</h4>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={smfData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} />
                           <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                           <Bar dataKey="percentage" fill="#10b981" radius={[8, 8, 0, 0]} barSize={40}>
                              {smfData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.percentage >= 80 ? '#10b981' : '#ef4444'} />
                              ))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Distribusi Kehadiran</h4>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={[
                                { name: 'Hadir', value: docData.reduce((acc, d) => acc + d.hadir, 0) },
                                { name: 'Absen', value: docData.reduce((acc, d) => acc + d.absen, 0) },
                                { name: 'Izin/Cuti', value: docData.reduce((acc, d) => acc + d.izin, 0) }
                              ]}
                              cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                           >
                              <Cell fill="#10b981" />
                              <Cell fill="#ef4444" />
                              <Cell fill="#f59e0b" />
                           </Pie>
                           <Tooltip />
                           <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b">
                     <tr>
                        <th className="p-6">DPJP / DOKTER</th>
                        <th className="p-6">SMF / KSM</th>
                        <th className="p-6 text-center">Hadir</th>
                        <th className="p-6 text-center">Absen</th>
                        <th className="p-6 text-center">Izin/Cuti</th>
                        <th className="p-6 text-center">Persentase</th>
                        <th className="p-6 text-center">Status</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {docData.sort((a,b) => a.percentage - b.percentage).map(doc => (
                       <tr key={doc.name} className="hover:bg-slate-50 transition-colors">
                          <td className="p-6 font-black text-xs text-slate-700 uppercase">{doc.name}</td>
                          <td className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">SMF {doc.smf || 'LAINNYA'}</td>
                          <td className="p-6 text-center font-bold text-emerald-600 text-xs">{doc.hadir}</td>
                          <td className="p-6 text-center font-bold text-rose-600 text-xs">{doc.absen}</td>
                          <td className="p-6 text-center font-bold text-amber-600 text-xs">{doc.izin}</td>
                          <td className="p-6 text-center">
                             <div className="flex items-center gap-3">
                               <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden w-20">
                                  <div className={`${doc.percentage >= 80 ? 'bg-emerald-500' : 'bg-rose-500'} h-full`} style={{width: `${doc.percentage}%`}}></div>
                               </div>
                               <span className="text-[10px] font-black text-slate-600">{doc.percentage}%</span>
                             </div>
                          </td>
                          <td className="p-6 text-center">
                             <span className={`px-4 py-1.5 rounded-full font-black text-[9px] uppercase tracking-widest ${doc.percentage >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                               {doc.percentage >= 80 ? 'TERCAPAI' : 'RENDAH'}
                             </span>
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    );
  };

  const renderPathwayReport = () => {
    // Get all clinical pathway audit data
    const pathwayMeasurements = qualityMeasurements.filter(m => m.indicatorId === 'pathway-1' && m.auditData);
    
    const allAuditRows: any[] = [];
    pathwayMeasurements.forEach(m => {
       (m.auditData || []).forEach((row: any) => {
          allAuditRows.push({ ...row, date: m.date });
       });
    });

    const diagnosisStats: Record<string, { total: number, compliant: number }> = {};
    allAuditRows.forEach(row => {
       const diag = row.diagnosis || 'LAINNYA';
       if (!diagnosisStats[diag]) diagnosisStats[diag] = { total: 0, compliant: 0 };
       diagnosisStats[diag].total++;
       const complianceValues = row.compliance ? Object.values(row.compliance) : [];
       const isFull = complianceValues.length > 0 && complianceValues.every(v => v === true || v === 'true' || v === 'yes' || v === 1);
       if (isFull) diagnosisStats[diag].compliant++;
    });

    const chartData = Object.entries(diagnosisStats).map(([name, stats]) => ({
       name,
       percentage: Math.round((stats.compliant / stats.total) * 100) || 0,
       total: stats.total
    }));

    return (
      <div className="space-y-8 animate-fade-in text-slate-800">
         <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h3 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tighter">
                    <ClipboardList size={36} className="text-indigo-600"/> EVALUASI CLINICAL PATHWAY (CP)
                  </h3>
                  <p className="text-slate-400 font-medium uppercase text-[10px] tracking-widest mt-1">Monitoring Kepatuhan Implementasi Standar CP per Diagnosa</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Pencapaian per Diagnosa (%)</h4>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} />
                           <Tooltip />
                           <Bar dataKey="percentage" fill="#4f46e5" radius={[8, 8, 0, 0]} barSize={40}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.percentage >= 80 ? '#10b981' : '#f59e0b'} />
                              ))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>
               
               <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 flex flex-col justify-center items-center text-center">
                  <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-6 shadow-xl shadow-indigo-100">
                     <ClipboardList size={40}/>
                  </div>
                  <h4 className="text-5xl font-black text-slate-800 tracking-tighter">
                    {allAuditRows.length}
                    <span className="text-sm text-slate-400 ml-2">Total Pasien Diaudit</span>
                  </h4>
                  <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-sm">
                     <div className="p-4 bg-white rounded-2xl border flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Patuh</span>
                        <span className="text-2xl font-black text-emerald-500">{allAuditRows.filter(r => {
                           const arr = r.compliance ? Object.values(r.compliance) : [];
                           return arr.length > 0 && arr.every(v => v === true || v === 'true' || v === 'yes' || v === 1);
                        }).length}</span>
                     </div>
                     <div className="p-4 bg-white rounded-2xl border flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Varian</span>
                        <span className="text-2xl font-black text-rose-500">{allAuditRows.filter(r => {
                           const arr = r.compliance ? Object.values(r.compliance) : [];
                           return arr.length === 0 || !arr.every(v => v === true || v === 'true' || v === 'yes' || v === 1);
                        }).length}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-slate-100 shadow-inner">
               <table className="w-full text-left text-xs bg-white">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                     <tr>
                        <th className="p-6">Tgl Audit</th>
                        <th className="p-6">Nama / No RM</th>
                        <th className="p-6">Diagnosa</th>
                        <th className="p-6 text-center">Asesmen</th>
                        <th className="p-6 text-center">Penunjang</th>
                        <th className="p-6 text-center">Tindakan</th>
                        <th className="p-6 text-center">Terapi</th>
                        <th className="p-6 text-center">LOS</th>
                        <th className="p-6 text-center">Result</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {allAuditRows.sort((a,b) => compareDatesSafe(a.date, b.date, true)).map((row, i) => {
                        const isFull = Object.values(row.compliance).every(v => v === true);
                        return (
                          <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                             <td className="p-6 font-bold text-slate-400">{row.date}</td>
                             <td className="p-6 font-black text-slate-700 uppercase">{row.patientName}</td>
                             <td className="p-6 font-bold text-indigo-500 uppercase tracking-tighter">{row.diagnosis}</td>
                             <td className="p-6 text-center">{row.compliance.assess ? <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Check size={12}/></div> : <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><X size={12}/></div>}</td>
                             <td className="p-6 text-center">{row.compliance.labs ? <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Check size={12}/></div> : <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><X size={12}/></div>}</td>
                             <td className="p-6 text-center">{row.compliance.surgery ? <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Check size={12}/></div> : <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><X size={12}/></div>}</td>
                             <td className="p-6 text-center">{row.compliance.pharmacy ? <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Check size={12}/></div> : <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><X size={12}/></div>}</td>
                             <td className="p-6 text-center">{row.compliance.los ? <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Check size={12}/></div> : <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><X size={12}/></div>}</td>
                             <td className="p-6 text-center">
                                <span className={`px-4 py-1 rounded-full font-black text-[9px] uppercase tracking-widest ${isFull ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                  {isFull ? 'COMPLIANT' : 'VARIANT'}
                                </span>
                             </td>
                          </tr>
                        );
                     })}
                  </tbody>
               </table>
               {allAuditRows.length === 0 && (
                 <div className="p-24 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-20">
                   Belum ada data audit Clinical Pathway hari ini
                 </div>
               )}
            </div>
         </div>
      </div>
    );
  };

  const renderVisiteComplianceReport = () => {
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
    // 1. Filter visits based on user selection
    const filteredVisits = doctorVisits.filter(v => {
      const matchesUnit = selectedUnit === 'Semua Unit' || normalize(v.unit) === normalize(selectedUnit);
      const matchesDate = v.date >= dateRange.start && v.date <= dateRange.end;
      return matchesUnit && matchesDate;
    });

    // 2. Group data by Date and Doctor
    const groupedData: Record<string, Record<string, { total: number, compliant: number, nonCompliant: number, times: string[] }>> = {};
    
    filteredVisits.forEach(v => {
      if (!groupedData[v.date]) groupedData[v.date] = {};
      if (!groupedData[v.date][v.doctorName]) {
        groupedData[v.date][v.doctorName] = { total: 0, compliant: 0, nonCompliant: 0, times: [] };
      }
      
      const stats = groupedData[v.date][v.doctorName];
      stats.total++;
      
      const statuses = v.attendanceStatuses || [v.attendanceStatus];
      if (statuses.includes('HADIR') || statuses.includes('ASISTEN')) {
        stats.compliant++;
      } else if (statuses.includes('TIDAK_HADIR') || statuses.includes('ABSEN')) {
        stats.nonCompliant++;
      }
      
      if (v.recordedAt) {
        stats.times.push(new Date(v.recordedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }));
      }
    });

    // 3. Flatten for Table
    const flatRows: any[] = [];
    Object.entries(groupedData).sort((a,b) => a[0].localeCompare(b[0])).forEach(([date, doctors]) => {
      let firstDate = true;
      Object.entries(doctors).forEach(([doctor, stats]) => {
        flatRows.push({
          date,
          doctor,
          time: stats.times.sort()[0] || '-', // Earliest visit time
          total: stats.total,
          visited: stats.compliant,
          notVisited: stats.nonCompliant,
          showDate: firstDate
        });
        firstDate = false;
      });
    });

    // 4. Analytics Data for Charts
    const smfDataMap: Record<string, { total: number, compliant: number }> = {};
    filteredVisits.forEach(v => {
      const smfName = v.smf || 'NON-SMF';
      if (!smfDataMap[smfName]) smfDataMap[smfName] = { total: 0, compliant: 0 };
      smfDataMap[smfName].total++;
      const statuses = v.attendanceStatuses || [v.attendanceStatus];
      if (statuses.includes('HADIR') || statuses.includes('ASISTEN')) {
        smfDataMap[smfName].compliant++;
      }
    });

    const smfChartData = Object.entries(smfDataMap).map(([name, stats]) => ({
      name,
      total: stats.total,
      visited: stats.compliant,
      notVisited: stats.total - stats.compliant,
      percentage: Math.round((stats.compliant / stats.total) * 100) || 0
    })).sort((a,b) => b.percentage - a.percentage);

    const overallTotal = filteredVisits.length;
    const overallCompliant = filteredVisits.filter(v => {
      const s = v.attendanceStatuses || [v.attendanceStatus];
      return s.includes('HADIR') || s.includes('ASISTEN');
    }).length;
    const overallNotCompliant = overallTotal - overallCompliant;
    const overallPercentage = Math.round((overallCompliant / overallTotal) * 100) || 0;

    const overallChartData = [
      { name: 'Sesuai (Visited)', value: overallCompliant, color: '#10b981' },
      { name: 'Tidak Sesuai', value: overallNotCompliant, color: '#ef4444' }
    ];

    return (
      <div className="space-y-8 animate-fade-in text-slate-800">
         {/* Charts Analytics Section */}
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
            {/* Overall Pie Chart */}
            <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col items-center">
               <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 self-start">Pencapaian Keseluruhan</h4>
               <div className="h-[240px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                           data={overallChartData}
                           innerRadius={60}
                           outerRadius={80}
                           paddingAngle={5}
                           dataKey="value"
                        >
                           {overallChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                           ))}
                        </Pie>
                        <Tooltip 
                           contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                        />
                     </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <div className="text-4xl font-black text-slate-800 tracking-tighter">{overallPercentage}%</div>
                     <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Compliant</div>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4 w-full mt-6">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center group/item hover:bg-emerald-100 transition-colors">
                     <span className="text-[9px] font-black text-emerald-600/50 uppercase">VISITED</span>
                     <span className="text-xl font-black text-emerald-600">{overallCompliant}</span>
                     <span className="text-[10px] font-black text-emerald-600 mt-1">{overallTotal > 0 ? Math.round((overallCompliant/overallTotal)*100) : 0}%</span>
                  </div>
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex flex-col items-center group/item hover:bg-rose-100 transition-colors">
                     <span className="text-[9px] font-black text-rose-600/50 uppercase">TIDAK VISITE</span>
                     <span className="text-xl font-black text-rose-600">{overallNotCompliant}</span>
                     <span className="text-[10px] font-black text-rose-600 mt-1">{overallTotal > 0 ? Math.round((overallNotCompliant/overallTotal)*100) : 0}%</span>
                  </div>
               </div>
            </div>

            {/* Per SMF Bar Chart */}
            <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col">
               <div className="flex justify-between items-center mb-8">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Analisis Kepatuhan per SMF</h4>
                  <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase">Visited</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-slate-200 rounded-full"></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase">Not Visited</span>
                     </div>
                  </div>
               </div>
               <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={smfChartData} layout="vertical" margin={{ left: 80, right: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.05} />
                        <XAxis type="number" hide />
                        <YAxis 
                           dataKey="name" 
                           type="category" 
                           axisLine={false} 
                           tickLine={false} 
                           tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                           width={80}
                        />
                        <Tooltip 
                           cursor={{ fill: '#f8fafc' }}
                           contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                           formatter={(val, name, props) => {
                             if (name === 'visited') return [`${val} (${props.payload.percentage}%)`, 'Visite'];
                             return [val, 'Tidak Visite'];
                           }}
                        />
                        <Bar dataKey="visited" stackId="a" fill="#10b981" barSize={24} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="notVisited" stackId="a" fill="#f1f5f9" barSize={24} radius={[0, 10, 10, 0]} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
               <div className="mt-4 flex flex-wrap gap-2">
                  {smfChartData.map((item, idx) => (
                     <div key={idx} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase">{item.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">({item.visited}/{item.total})</span>
                        <span className={`text-[10px] font-black ${item.percentage >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>{item.percentage}%</span>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Work Table */}
         <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-10 relative">
            <div className="absolute top-6 right-6 no-print opacity-20">
               <Gauge size={100} />
            </div>
            
            <div className="text-center font-black uppercase space-y-1 mb-8">
               <div className="text-xs tracking-widest text-slate-400">LEMBAR KERJA</div>
               <h3 className="text-2xl md:text-3xl tracking-tighter">INDIKATOR MUTU UNIT KEPATUHAN VISITE</h3>
            </div>

            <div className="flex flex-col md:flex-row justify-between border-b border-slate-100 pb-8 mb-8 gap-6 md:gap-0">
               <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UNIT / RUANGAN</div>
                  <div className="text-lg font-black text-indigo-600 uppercase tracking-tighter">{selectedUnit}</div>
               </div>
               <div className="space-y-2 md:text-right">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PERIODE LAPORAN</div>
                  <div className="text-lg font-black text-slate-700 uppercase tracking-tighter">
                    {parseDateAsLocal(dateRange.start).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {parseDateAsLocal(dateRange.end).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
               </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border-2 border-[#84c44c]">
               <table className="w-full text-[10px] text-left border-collapse">
                  <thead className="bg-[#84c44c] text-white font-black uppercase text-center">
                     <tr className="divide-x divide-white/10">
                       <th className="p-4 border border-emerald-700/20 w-12">NO</th>
                       <th className="p-4 border border-emerald-700/20 w-32">HARI TANGGAL</th>
                       <th className="p-4 border border-emerald-700/20">DOKTER</th>
                       <th className="p-4 border border-emerald-700/20 w-28">JAM VISITE</th>
                       <th className="p-4 border border-emerald-700/20 w-24 bg-black/5">JML PASIEN</th>
                       <th className="p-4 border border-emerald-700/20 w-24 bg-emerald-600/30">VISITE</th>
                       <th className="p-4 border border-emerald-700/20 w-24 bg-rose-600/30 text-rose-50">TIDAK VISITE</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {flatRows.length > 0 ? flatRows.map((row, i) => (
                       <tr key={i} className="hover:bg-emerald-50/50 transition-colors divide-x divide-slate-100 text-center">
                         <td className="p-4 font-bold text-slate-300">{i + 1}</td>
                         <td className="p-4 font-black text-slate-600 bg-slate-50/30">
                           {row.showDate ? new Date(row.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: '2-digit' }) : ''}
                         </td>
                         <td className="p-4 text-left font-black text-slate-700 pl-8 uppercase tracking-tighter">{row.doctor}</td>
                         <td className="p-4 text-slate-500 font-bold">{row.time}</td>
                         <td className="p-4 font-black text-slate-600 bg-slate-50/30">{row.total}</td>
                         <td className="p-4 font-black text-emerald-600 bg-emerald-50/40 text-sm">{row.visited}</td>
                         <td className="p-4 font-black text-rose-600 bg-rose-50/40 text-sm">{row.notVisited}</td>
                       </tr>
                     )) : (
                       <tr>
                         <td colSpan={7} className="p-32 text-center text-slate-300 italic font-medium uppercase tracking-[0.2em] bg-slate-50/50">Belum ada data kunjungan yang tercatat.</td>
                       </tr>
                     )}
                  </tbody>
                  {flatRows.length > 0 && (
                    <tfoot className="bg-slate-800 text-white font-black uppercase text-center">
                       <tr className="divide-x divide-white/10">
                         <td colSpan={4} className="p-5 text-right pr-10 tracking-widest text-slate-400">TOTAL KESELURUHAN</td>
                         <td className="p-5">{flatRows.reduce((a, b) => a + b.total, 0)}</td>
                         <td className="p-5 text-emerald-400">{flatRows.reduce((a, b) => a + b.visited, 0)}</td>
                         <td className="p-5 text-rose-400">{flatRows.reduce((a, b) => a + b.notVisited, 0)}</td>
                       </tr>
                    </tfoot>
                  )}
               </table>
            </div>

            <div className="flex justify-between items-center no-print">
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                     <div className="w-4 h-4 bg-emerald-500 rounded-md"></div>
                     <span className="text-[10px] font-black uppercase text-slate-400">Visited</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-4 h-4 bg-rose-500 rounded-md"></div>
                     <span className="text-[10px] font-black uppercase text-slate-400">Not Visited</span>
                  </div>
               </div>
               <button 
                 onClick={() => window.print()}
                 className="bg-emerald-500 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-emerald-200 transition-all active:scale-95 flex items-center gap-3"
               >
                 Export & Cetak Laporan <TrendingUp size={16}/>
               </button>
            </div>
         </div>
      </div>
    );
  };

  const renderOperasiElektifReport = () => {
    const startObj = parseDateAsLocal(dateRange.start);
    const endObj = parseDateAsLocal(dateRange.end);
    
    const ops = dailyReports.filter(r => {
      if (!r.surgeryDate) return false;
      const d = parseDateAsLocal(r.surgeryDate);
      return d >= startObj && d <= endObj && r.surgeryProcedure && r.surgeryProcedure.trim() !== '';
    });

    const isSurgeryDelayed = (o: any) => {
      if (o.surgeryStatus === 'CANCELLED' || o.surgeryStatus === 'DELAYED') {
        return true;
      }
      if (o.surgeryDelayReason && o.surgeryDelayReason.trim() !== '') {
        return true;
      }
      if (o.surgeryNewDate && o.surgeryNewDate !== o.surgeryDate) {
        return true;
      }
      if (o.surgeryNewTime && o.surgeryNewTime !== o.surgeryTime) {
        return true;
      }
      return false;
    };

    const getStatusDisplay = (op: any) => {
      if (op.surgeryStatus === 'CANCELLED') return 'Batal';
      if (isSurgeryDelayed(op)) return 'Tertunda';
      return 'Terlaksana Sesuai Jadwal';
    };

    const getTanggalTerlaksana = (op: any, statusText: string) => {
      if (statusText === 'Batal' || statusText === 'BATAL') return '';
      if (statusText === 'Tertunda' || statusText === 'TERTUNDA') return op.surgeryNewDate || op.surgeryDate || op.date || '-';
      return op.surgeryDate || op.date || '-';
    };

    // Auto-Deduplication of operation records
    const dedupedOpsMap = new Map<string, any>();
    ops.forEach(op => {
      const existing = dedupedOpsMap.get(op.patientId);
      if (!existing) {
        dedupedOpsMap.set(op.patientId, op);
      } else {
        const opIsPerformed = op.surgeryStatus === 'PERFORMED';
        const existingIsPerformed = existing.surgeryStatus === 'PERFORMED';
        
        const opTime = op.lastModified ? new Date(op.lastModified).getTime() : 0;
        const existingTime = existing.lastModified ? new Date(existing.lastModified).getTime() : 0;

        if (opIsPerformed && !existingIsPerformed) {
          dedupedOpsMap.set(op.patientId, op);
        } else if (!opIsPerformed && existingIsPerformed) {
          // keep existing
        } else if (opTime > existingTime) {
          dedupedOpsMap.set(op.patientId, op);
        }
      }
    });
    const allFinalOps = Array.from(dedupedOpsMap.values());

    // Apply dynamic status filter instan
    const statusFilteredOps = allFinalOps.filter(op => {
      if (selectedStatusTindakanFilter === 'Semua Status') return true;
      const statusText = getStatusDisplay(op);
      return statusText.toLowerCase() === selectedStatusTindakanFilter.toLowerCase();
    });

    // Apply global text searching to obtain the final subset of operations
    const finalOps = statusFilteredOps.filter(op => {
      if (!surgerySearchText || surgerySearchText.trim() === '') return true;
      const lower = surgerySearchText.toLowerCase().trim();
      const p = rawPatients.find(pat => pat.id === op.patientId);
      
      const name = (p?.name || '').toLowerCase();
      const noRM = (p?.noRM || op.patientNoRM || '').toLowerCase();
      const birthStr = (p?.birthDate || '').toLowerCase();
      const addr = (p?.address || '').toLowerCase();
      const proc = (op.surgeryProcedure || '').toLowerCase();
      const diagListStr = ((p?.diagnosaUtama || '') + ' ' + (p?.diagnosaSekunder || '')).toLowerCase();
      
      return name.includes(lower) ||
             noRM.includes(lower) ||
             birthStr.includes(lower) ||
             addr.includes(lower) ||
             proc.includes(lower) ||
             diagListStr.includes(lower);
    });

    const totalScheduled = finalOps.length;
    const delayed = finalOps.filter(isSurgeryDelayed).length;
    const performedOnTime = totalScheduled - delayed;
    const pending = 0;

    const complianceRate = totalScheduled > 0 ? Math.round((performedOnTime / totalScheduled) * 100) : 0;

    const delayReasons = finalOps.filter(isSurgeryDelayed).map(o => ({
      patientId: o.patientId,
      reason: o.surgeryDelayReason || (o.surgeryStatus === 'CANCELLED' ? 'Operasi Batal' : 'Penundaan jadwal operasi'),
      doc: o.surgeryOperator || 'Dokter'
    }));

    // Doughnut chart combines Delayed & Cancelled into Orange slice "Tertunda & Batal" as requested!
    const chartData = [
      { name: 'Terlaksana Sesuai Jadwal', value: performedOnTime, color: '#10b981' },
      { name: 'Tertunda / Batal', value: delayed, color: '#ff7f00' }
    ].filter(v => v.value > 0);

    const unitOptions = [
      { value: 'Semua Unit', label: 'Semua Unit' },
      ...units.map(u => ({ value: u, label: u }))
    ];

    const statusOptions = [
      { value: 'Semua Status', label: 'Semua Status' },
      { value: 'Terlaksana Sesuai Jadwal', label: 'Terlaksana Sesuai Jadwal' },
      { value: 'Tertunda', label: 'Tertunda' },
      { value: 'Batal', label: 'Batal' }
    ];

    const exportToExcel = () => {
      const heading = [
        ['LAPORAN KEPATUHAN JADWAL OPERASI ELEKTIF'],
        [`PERIODE: ${dateRange.start} s/d ${dateRange.end}`],
        [''],
        ['No', 'Tanggal MRS', 'Tanggal Rencana', 'Nama Pasien', 'No. RM', 'Operator', 'Nama Tindakan', 'Status', 'Tanggal Terlaksana Tindakan', 'Keterangan Penundaan/Batal Tindakan']
      ];

      const rows = finalOps.map((op, idx) => {
        const p = rawPatients.find(p => p.id === op.patientId);
        const statusText = getStatusDisplay(op);
        const tMRS = p?.entryDate || '-';
        const tRencana = op.surgeryDate || op.date || '-';
        const namaPasien = p?.name || 'Pasien';
        const noRM = p?.noRM || op.patientNoRM || '-';
        const operator = op.surgeryOperator || '-';
        const namaTindakan = op.surgeryProcedure || '-';
        const tTerlaksana = getTanggalTerlaksana(op, statusText);
        const keterangan = op.surgeryDelayReason || '-';

        return [
          idx + 1,
          tMRS,
          tRencana,
          namaPasien,
          noRM,
          operator,
          namaTindakan,
          statusText,
          tTerlaksana,
          keterangan
        ];
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([...heading, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Kepatuhan Operasi Elektif');
      XLSX.writeFile(wb, `Laporan_Mutu_Operasi_Elektif_${dateRange.start}_to_${dateRange.end}.xlsx`);
    };

    return (
      <div className="space-y-8 animate-fade-in">
        {/* Authoritative Kop Filters */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 no-print">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#144272] uppercase tracking-widest block font-sans">Filter Nama Unit Perawatan</label>
            <SearchableSelect
              options={unitOptions}
              value={selectedUnit}
              onChange={(val) => setSelectedUnit(val || 'Semua Unit')}
              placeholder="Cari Unit Perawatan..."
              className="w-full font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#144272] uppercase tracking-widest block font-sans">Rentang Tanggal Laporan</label>
            <div className="flex items-center gap-2">
              <input 
                type="date"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
              <span className="text-slate-300 font-extrabold text-xs">s.d</span>
              <input 
                type="date"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#144272] uppercase tracking-widest block font-sans">Status Tindakan / Pasien</label>
            <SearchableSelect
              options={statusOptions}
              value={selectedStatusTindakanFilter}
              onChange={(val) => setSelectedStatusTindakanFilter(val || 'Semua Status')}
              placeholder="Pilih Status..."
              className="w-full font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#144272] uppercase tracking-widest block font-sans">Filter Searching Teks</label>
            <div className="relative">
              <input 
                type="text"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Cari Nama, No RM, Diagnosa, Tindakan..."
                value={surgerySearchText}
                onChange={(e) => setSurgerySearchText(e.target.value)}
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={14} className="font-extrabold"/>
              </span>
              {surgerySearchText && (
                <button 
                  type="button" 
                  onClick={() => setSurgerySearchText('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-sans text-xs bg-transparent border-none cursor-pointer"
                >
                  <X size={14}/>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in-up">
          <div className="bg-gradient-to-br from-[#144272] to-[#205295] p-6 rounded-3xl text-white shadow-xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 block mb-2">Total Operasi Terjadwal</span>
            <div className="text-4xl font-black">{totalScheduled}</div>
            <p className="text-[9px] text-blue-200/70 font-bold mt-2 font-sans">Semua tindakan bedah dengan jadwal rencana</p>
          </div>
          <div className="bg-white border rounded-3xl p-6 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#10b981] block mb-2">Terlaksana Tepat Waktu</span>
            <div className="text-4xl font-black text-emerald-600">{performedOnTime}</div>
            <p className="text-[9px] text-slate-400 font-bold mt-2 font-sans">Numerator - Selesai sesuai tanggal rencana</p>
          </div>
          <div className="bg-white border rounded-3xl p-6 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] block mb-2">Tertunda / Reschedule</span>
            <div className="text-4xl font-black text-[#d97706]">{delayed}</div>
            <p className="text-[9px] text-slate-400 font-bold mt-2 font-sans">Operasi yang mengalami penundaan/ reschedule</p>
          </div>
          <div className="bg-white border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 block mb-2">Persentase Kepatuhan</span>
              <div className="text-4xl font-black text-indigo-600">{complianceRate}%</div>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all rounded-full" style={{ width: `${complianceRate}%` }}></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white border rounded-[2rem] p-8 shadow-sm flex flex-col justify-between lg:col-span-1">
            <div className="mb-4">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">Proporsi Pelaksanaan</h4>
              <p className="text-xs text-slate-400">Distribusi status realisasi jadwal operasi</p>
            </div>
            {chartData.length > 0 ? (
              <div className="h-64 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center flex flex-col items-center">
                  <span className="text-2xl font-black text-slate-700">{complianceRate}%</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kepatuhan</span>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400 font-bold italic text-xs">Tidak ada data visualisasi</div>
            )}
            <div className="flex justify-around text-[10px] font-black uppercase tracking-wider mt-4">
              <div className="flex items-center gap-1.5 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Sesuai Jadwal ({performedOnTime})</div>
              <div className="flex items-center gap-1.5 text-amber-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Tertunda ({delayed})</div>
            </div>
          </div>

          <div className="bg-white border rounded-[2rem] p-8 shadow-sm lg:col-span-2 flex flex-col justify-between">
            <div>
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-6">Analisa Penundaan Operasi</h4>
              <div className="space-y-3 overflow-y-auto max-h-[14rem] pr-2 custom-scrollbar">
                {delayReasons.length > 0 ? delayReasons.map((item, idx) => {
                  const pat = rawPatients.find(p => p.id === item.patientId);
                  return (
                    <div key={idx} className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl flex justify-between items-start">
                      <div>
                        <div className="text-xs font-black text-amber-800 uppercase">{pat?.name || 'Pasien'} ({pat?.noRM})</div>
                        <div className="text-[10px] text-slate-400 font-medium">Operator: {item.doc}</div>
                        <p className="text-xs font-bold text-slate-650 mt-2">"{item.reason}"</p>
                      </div>
                      <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg uppercase tracking-wider">DELAYED</span>
                    </div>
                  );
                }) : (
                  <div className="text-center py-12 text-slate-300 font-bold italic text-xs">Belum ada catatan penundaan operasi untuk periode ini.</div>
                )}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button onClick={exportToExcel} className="px-6 py-3 bg-[#10b981] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-opacity-90 active:scale-95 shadow-xl shadow-emerald-100 transition-all hover:shadow-[#10b981]/20">
                <FileSpreadsheet size={16}/> Ekspor ke Excel
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-[2rem] shadow-sm overflow-hidden animate-fade-in-up">
          <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
            <div>
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">Log Audit Detail Pelaksanaan Operasi</h4>
              <p className="text-xs text-slate-400 font-sans">Dibuat otomatis dari pengentrian shift petugas terkait</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs border-collapse">
              <thead className="bg-[#144272] text-white font-black uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-5 pl-8">No</th>
                  <th className="p-5">Tanggal MRS</th>
                  <th className="p-5">Tanggal Rencana</th>
                  <th className="p-5">Nama Pasien</th>
                  <th className="p-5">No. RM</th>
                  <th className="p-5">Operator</th>
                  <th className="p-5">Nama Tindakan</th>
                  <th className="p-5 text-center">Status</th>
                  <th className="p-5 text-center">Tanggal Terlaksana Tindakan</th>
                  <th className="p-5">Keterangan Penundaan/Batal Tindakan</th>
                  <th className="p-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                {finalOps.length > 0 ? finalOps.map((op, index) => {
                  const p = rawPatients.find(p => p.id === op.patientId);
                  const statusText = getStatusDisplay(op);
                  const tMRS = p?.entryDate || '-';
                  const tRencana = op.surgeryDate || op.date || '-';
                  const namaPasien = p?.name || 'Pasien';
                  const noRM = p?.noRM || op.patientNoRM || '-';
                  const operator = op.surgeryOperator || '-';
                  const namaTindakan = op.surgeryProcedure || '-';
                  const tTerlaksana = getTanggalTerlaksana(op, statusText);
                  const keterangan = op.surgeryDelayReason || '-';

                  return (
                    <tr key={index} className="hover:bg-slate-50/35 transition-colors">
                      <td className="p-5 pl-8 font-black text-slate-400">{index + 1}</td>
                      <td className="p-5">{tMRS}</td>
                      <td className="p-5">{tRencana}</td>
                      <td className="p-5 font-black text-slate-800 uppercase">{namaPasien}</td>
                      <td className="p-5 font-mono text-slate-500">{noRM}</td>
                      <td className="p-5 font-bold">{operator}</td>
                      <td className="p-5 font-bold text-indigo-600">{namaTindakan}</td>
                      <td className="p-5">
                        <div className="flex justify-center">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            statusText === 'Terlaksana Sesuai Jadwal'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                              : statusText === 'Batal'
                              ? 'bg-rose-50 text-rose-700 border border-rose-150'
                              : 'bg-amber-50 text-amber-700 border border-amber-150'
                          }`}>
                            {statusText}
                          </span>
                        </div>
                      </td>
                      <td className="p-5 text-center font-bold font-mono text-slate-700">{tTerlaksana}</td>
                      <td className="p-5 text-slate-400 italic max-w-xs truncate">{keterangan}</td>
                      <td className="p-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingReport(op)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-[9px] font-black uppercase tracking-wider border border-blue-100 cursor-pointer flex items-center gap-1 transition-all"
                          >
                            <Edit size={10} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Apakah Anda yakin ingin menghapus tindakan/operasi ini?")) {
                                if (onUpdateReport) {
                                  onUpdateReport(
                                    op.patientId,
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
                                    op.date
                                  );
                                }
                              }
                            }}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[9px] font-black uppercase tracking-wider border border-rose-100 cursor-pointer flex items-center gap-1 transition-all"
                          >
                            <Trash2 size={10} /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={11} className="p-16 text-center text-slate-400 font-bold italic text-xs">Tidak ditemukan data operasi untuk dinilai pada periode ini.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Surgery Modal inside QualityReports */}
        {editingReport && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 text-left">
            <div className="bg-white rounded-[2rem] p-10 w-full max-w-lg shadow-2xl animate-fade-in border-t-8 border-indigo-655 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Edit className="text-indigo-600" size={18} /> Edit Laporan Operasi Elektif
                </h4>
                <button 
                  onClick={() => setEditingReport(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition duration-150"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Identitas Pasien</label>
                  <input 
                    type="text" 
                    disabled 
                    className="w-full bg-slate-50 text-slate-500 font-bold px-4 py-2.5 rounded-xl text-xs" 
                    value={`${rawPatients.find(p => p.id === editingReport.patientId)?.name || 'Pasien'} (${rawPatients.find(p => p.id === editingReport.patientId)?.noRM || editingReport.patientNoRM || ''})`} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tanggal Rencana</label>
                    <input 
                      type="date" 
                      className="w-full bg-slate-50 border border-slate-100 font-bold px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100" 
                      value={editingReport.surgeryDate || editingReport.date || ''} 
                      onChange={e => setEditingReport({ ...editingReport, surgeryDate: e.target.value, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Jam Rencana</label>
                    <input 
                      type="time" 
                      className="w-full bg-slate-50 border border-slate-100 font-bold px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100" 
                      value={editingReport.surgeryTime || '08:00'} 
                      onChange={e => setEditingReport({ ...editingReport, surgeryTime: e.target.value })}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nama Prosedur / Tindakan</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-100 font-extrabold px-4 py-2.5 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100" 
                    value={editingReport.surgeryProcedure || ''} 
                    onChange={e => setEditingReport({ ...editingReport, surgeryProcedure: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Dokter Operator (DPJP)</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-100 font-extrabold px-4 py-2.5 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100" 
                    value={editingReport.surgeryOperator || ''} 
                    onChange={e => setEditingReport({ ...editingReport, surgeryOperator: e.target.value })}
                  >
                    <option value="">-- Pilih Dokter --</option>
                    {masterData?.doctors?.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Urgensi</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-100 font-black px-4 py-2.5 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                      value={editingReport.surgeryUrgency || 'ELECTIVE'}
                      onChange={e => setEditingReport({ ...editingReport, surgeryUrgency: e.target.value })}
                    >
                      <option value="ELECTIVE">ELEKTIF</option>
                      <option value="EMERGENCY">CYTO / EMERGENCY</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Status Pelaksanaan</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-100 font-black px-4 py-2.5 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                      value={editingReport.surgeryStatus || 'SCHEDULED'}
                      onChange={e => setEditingReport({ ...editingReport, surgeryStatus: e.target.value })}
                    >
                      <option value="SCHEDULED">DIJADWALKAN (SCHEDULED)</option>
                      <option value="PERFORMED">TERLAKSANA (PERFORMED)</option>
                      <option value="DELAYED">TERTUNDA / RESCHEDULE (DELAYED)</option>
                      <option value="CANCELLED">BATAL (CANCELLED)</option>
                    </select>
                  </div>
                </div>
                       {(editingReport.surgeryStatus === 'DELAYED' || editingReport.surgeryStatus === 'CANCELLED' || isSurgeryDelayed(editingReport)) && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-3">
                    <div>
                      <label className="block text-[9px] font-black text-amber-800 uppercase tracking-wider mb-1.5">
                        {editingReport.surgeryStatus === 'CANCELLED' ? 'Alasan Pembatalan' : 'Alasan Penundaan'}
                      </label>
                      <textarea 
                        className="w-full bg-white border border-amber-200 font-medium p-3 rounded-xl text-xs focus:ring-2 focus:ring-amber-200 outline-none" 
                        rows={2}
                        placeholder={editingReport.surgeryStatus === 'CANCELLED' ? 'Tuliskan alasan pembatalan medis/non-medis...' : 'Tuliskan alasan penundaan medis/non-medis...'}
                        value={editingReport.surgeryDelayReason || ''}
                        onChange={e => setEditingReport({ ...editingReport, surgeryDelayReason: e.target.value })}
                      />
                    </div>
                    {editingReport.surgeryStatus !== 'CANCELLED' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-black text-amber-800 uppercase tracking-wider mb-1.5">Tanggal Reschedule Baru</label>
                          <input 
                            type="date" 
                            className="w-full bg-white border border-amber-200 font-bold px-3 py-2 rounded-lg text-xs outline-none" 
                            value={editingReport.surgeryNewDate || ''}
                            onChange={e => setEditingReport({ ...editingReport, surgeryNewDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-amber-800 uppercase tracking-wider mb-1.5">Jam Reschedule Baru</label>
                          <input 
                            type="time" 
                            className="w-full bg-white border border-amber-200 font-bold px-3 py-2 rounded-lg text-xs outline-none" 
                            value={editingReport.surgeryNewTime || ''}
                            onChange={e => setEditingReport({ ...editingReport, surgeryNewTime: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="px-6 py-2.5 bg-slate-50 border hover:bg-slate-100 rounded-xl text-xs font-black uppercase text-slate-500"
                >
                  Batal
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (onUpdateReport) {
                      onUpdateReport(
                        editingReport.patientId,
                        'BATCH',
                        {
                          surgeryProcedure: editingReport.surgeryProcedure,
                          surgeryOperator: editingReport.surgeryOperator,
                          surgeryDate: editingReport.surgeryDate || editingReport.date,
                          surgeryTime: editingReport.surgeryTime,
                          surgeryUrgency: editingReport.surgeryUrgency || 'ELECTIVE',
                          surgeryStatus: editingReport.surgeryStatus,
                          surgeryDelayReason: (editingReport.surgeryStatus === 'DELAYED' || editingReport.surgeryStatus === 'CANCELLED') ? (editingReport.surgeryDelayReason || '') : '',
                          surgeryNewDate: editingReport.surgeryStatus === 'DELAYED' ? (editingReport.surgeryNewDate || '') : '',
                          surgeryNewTime: editingReport.surgeryStatus === 'DELAYED' ? (editingReport.surgeryNewTime || '') : '',
                          surgeryAnesthesiaType: editingReport.surgeryAnesthesiaType || ''
                        },
                        editingReport.date
                      );
                    }
                    setEditingReport(null);
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-150"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderApsReport = () => {
    const activeDischargedPatients = rawPatients.filter(p => {
      const isDc = p.status === 'DISCHARGED' || 
                   ['BPL', 'APS', 'DIRUJUK', 'MENINGGAL', 'PINDAH RUANGAN'].some(s => (p.statusDataPasien || '').toUpperCase().includes(s)) ||
                   (p.statusDataPasien || '').toUpperCase().includes('PINDAH');
                   
      if (!isDc) return false;
      
      const pDate = p.dischargeDate || p.entryDate || '';
      return pDate >= dateRange.start && pDate <= dateRange.end;
    });

    const apsPatients = activeDischargedPatients.filter(p => {
      const statusUpper = (p.statusDataPasien || '').toUpperCase();
      return statusUpper.includes('APS') || p.apsReason;
    });

    const totalKrs = activeDischargedPatients.length;
    const totalAps = apsPatients.length;
    const apsPercentage = totalKrs > 0 ? ((totalAps / totalKrs) * 100).toFixed(1) : "0.0";

    const handleExportApsToExcel = () => {
      try {
        const wb = XLSX.utils.book_new();
        const title = [
          ["LAPORAN INDIKATOR MUTU - PASIEN PULANG ATAS PERMINTAAN SENDIRI (APS)", "", "", "", "", ""],
          ["Periode Waktu", `${dateRange.start} s/d ${dateRange.end}`, "", "", "", ""],
          ["Persentase APS", `${apsPercentage}% (${totalAps} dari ${totalKrs} Pasien Pulang)`, "", "", "", ""],
          [],
          ["No", "No Rekam Medis", "Nama Pasien", "Tanggal Pulang / KRS", "DPJP Utama", "Alasan KRS Atas Permintaan Sendiri (APS)"]
        ];

        const rows = apsPatients.map((p, idx) => [
          idx + 1,
          p.noRM || '-',
          p.name || '-',
          p.dischargeDate || p.entryDate || '-',
          p.dpjpList?.join(', ') || '-',
          p.apsReason || '-'
        ]);

        const ws = XLSX.utils.aoa_to_sheet([...title, ...rows]);
        ws['!cols'] = [
          { wch: 6 },
          { wch: 15 },
          { wch: 25 },
          { wch: 18 },
          { wch: 25 },
          { wch: 50 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Pasien APS");
        XLSX.writeFile(wb, `Laporan_Mutu_Pasien_APS_${dateRange.start}_to_${dateRange.end}.xlsx`);
      } catch (err: any) {
        alert('Gagal mengekspor laporan APS ke Excel: ' + err.message);
      }
    };

    return (
      <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-10 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-[9px] font-black uppercase tracking-widest text-[#d97706] flex items-center gap-1.5 font-mono">
                ⚠️ INDIKATOR MUTU KHUSUS
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-2.5 font-sans">Kepatuhan & Analisis Pasien APS</h3>
            <p className="text-slate-400 text-xs mt-1 font-medium font-sans">Memantau rasio dan alasan kepulangan atas permohonan pasien mandiri.</p>
          </div>

          <button
            onClick={handleExportApsToExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-750 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-2xl transition-all cursor-pointer border-none shadow-md shadow-emerald-100 font-sans"
          >
            EXPORT EXCEL
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100/60 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block font-mono">RASIO PASIEN APS</span>
              <h2 className="text-5xl font-black text-amber-950 mt-2 font-mono">{apsPercentage}%</h2>
            </div>
            <div className="text-[10px] text-amber-700 font-bold mt-4 leading-relaxed font-sans">
              Persentase dihitung berdasarkan total pasien pulang/KRS berstatus APS.
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">TOTAL PASIEN PULANG (KRS)</span>
              <h3 className="text-3xl font-black text-slate-850 mt-2 font-mono">{totalKrs} <span className="text-sm font-semibold text-slate-400 font-sans">Pasien</span></h3>
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-4 font-sans">
              Semua pasien berstatus pulang dalam rentang tanggal yang dipilih.
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">GRAFIK RASIO KEPATUHAN</span>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span className="font-sans">Pasien APS ({totalAps})</span>
                  <span className="font-mono">{apsPercentage}%</span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(parseFloat(apsPercentage), 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-4 font-sans">
              Nilai aman target adalah sekecil mungkin dari total pasien keluar.
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest block font-sans">Rincian Data Pasien APS</h4>
            <span className="px-3 py-1 bg-slate-150 text-slate-600 font-bold text-[9px] uppercase tracking-wide rounded-lg font-mono">
              {totalAps} Data Ditemukan
            </span>
          </div>

          <div className="border border-slate-100 rounded-[2rem] overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100">
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono text-center w-12">No</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono w-32">No RM</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono w-48">Nama Pasien</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono w-40">Tgl Pulang (KRS)</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono w-48">DPJP Utama</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Alasan Atas Permintaan Sendiri</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-700">
                  {apsPatients.length > 0 ? (
                    apsPatients.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-4 text-slate-900 font-mono font-bold">{p.noRM || '-'}</td>
                        <td className="p-4 text-slate-800 font-black">{p.name || '-'}</td>
                        <td className="p-4 text-slate-500 font-mono">{p.dischargeDate || p.entryDate || '-'}</td>
                        <td className="p-4 font-bold text-indigo-700 font-sans">{p.dpjpList?.join(', ') || p.dpjp || '-'}</td>
                        <td className="p-4 text-slate-600 italic bg-amber-50/20 max-w-xs truncate font-sans" title={p.apsReason}>{p.apsReason || 'Tidak ditulis'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400 italic font-sans">
                        Tidak ada data pasien pulang atas permintaan sendiri (APS) pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-20">
       <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden no-print">
          <div className="relative z-10">
             <h2 className="text-4xl font-black tracking-tighter mb-4 flex items-center gap-4">
                <TrendingUp size={44} className="text-blue-500"/> Pusat Pelaporan Mutu (PIC)
             </h2>
             <p className="text-slate-400 max-w-2xl font-medium text-xs">Laporan analitik mendalam untuk monitoring kualitas pelayanan bedah secara real-time. Data diperbarui otomatis dari input pelayanan harian.</p>
          </div>
          <div className="absolute -bottom-10 -right-10 opacity-10">
             <Gauge size={300}/>
          </div>
       </div>

       {/* Global Filters Section */}
       {type !== 'OPERASI_ELEKTIF' && (
         <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Filter Ruangan/Unit</label>
              <select 
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                disabled={!!(currentUser?.unit && currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'BIDANG' && currentUser?.role !== 'PIC')}
              >
                <option>Semua Unit</option>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rentang Tanggal Laporan</label>
              <div className="flex items-center gap-3">
                <input 
                  type="date"
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                />
                <span className="text-slate-300 font-bold">s/d</span>
                <input 
                  type="date"
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                />
              </div>
            </div>
         </div>
       )}

       {type === 'DIAGNOSIS' && renderDiagnosisReport()}
       {type === 'DEPENDENCY' && renderDependencyReport()}
       {(type === 'ATTENDANCE' || type === 'DPJP_ABSENSI') && renderAttendanceReport()}
       {type === 'PATHWAY' && renderPathwayReport()}
       {type === 'VISITE_COMPLIANCE' && renderVisiteComplianceReport()}
       {type === 'OPERASI_ELEKTIF' && renderOperasiElektifReport()}
       {type === 'APS_MUTU' && renderApsReport()}
    </div>
  );
};
