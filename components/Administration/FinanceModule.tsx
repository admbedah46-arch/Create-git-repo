import React, { useState, useMemo, useRef } from 'react';
import { FinanceRecord, DoctorChargeEntry, MasterData, Patient, User as AppUser, DoctorVisitRecord, compareDatesSafe } from '../../types';
import { Button } from '../Button';
import { STANDAR_ICD10 } from '../Finance/AdminRegistrasiModule';
import { SearchableSelect } from '../SearchableSelect';
import { 
  Plus, Search, Download, BarChart3, Stethoscope, Briefcase, 
  DollarSign, Activity, FileText, User, Calendar, Upload, X, Check, CheckCircle2, FileSpreadsheet,
  Trash2, Layers, Coins, PieChart, Edit
} from 'lucide-react';
import * as XLSXModule from 'xlsx-js-style';
const XLSX = (XLSXModule as any).default || XLSXModule;

export interface DoctorSMFAnalysisStats {
  doctorName: string;
  dpjpUtamaPatients: number;
  dpjpUtamaAndRaberanVisits: number;
  dpjpKonsulanPatients: number;
  dpjpKonsulanVisits: number;
}

interface FinanceModuleProps {
  records: FinanceRecord[];
  masterData: MasterData;
  patients: Patient[];
  doctorVisits?: DoctorVisitRecord[];
  onAddRecord: (record: FinanceRecord) => void;
  onDeleteRecord?: (id: string) => void;
  onImportRecords?: (records: FinanceRecord[]) => void;
  currentUser: AppUser | null;
}

const MONTHS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' }
];

export const FinanceModule: React.FC<FinanceModuleProps> = ({ 
  records, 
  masterData, 
  patients: patientsProp, 
  doctorVisits = [],
  onAddRecord, 
  onDeleteRecord,
  onImportRecords,
  currentUser 
}) => {
  const patients = useMemo(() => {
    return (patientsProp || []).filter(p => !String(p.statusDataPasien || '').toUpperCase().includes('BATAL'));
  }, [patientsProp]);

  const getKsmForRecord = (r: any) => {
    if (!r) return 'SMF BELUM TERDATA';
    
    // safe navigation: check if there's any dpjp_utama, smf, or ksm property directly
    const dpjpUtama = r.dpjp_utama || r.dpjpUtama || r.dpjp_utama_obj;
    const dpjpUtamaSMF = dpjpUtama?.smf || dpjpUtama?.ksm;
    const itemSMF = r.smf || r.ksm;
    
    let smfCandidate = dpjpUtamaSMF || itemSMF;
    if (!smfCandidate) {
      const primaryDocName = r.dpjp || 'Dokter Umum';
      const doctorMetadata = (masterData && masterData.doctorMetadata) || {};
      const primaryDocMeta = doctorMetadata[primaryDocName];
      smfCandidate = primaryDocMeta?.ksm || primaryDocMeta?.smf;
    }
    
    // Strict fallback checks
    const finalSMF = smfCandidate ? String(smfCandidate).trim() : '';
    
    // Check if pindah/titipan status matches
    const isPindah = (String(r.statusDataPasien || r.status || '').toUpperCase().trim().includes('PINDAH') ||
                     String(r.statusDataPasien || r.status || '').toUpperCase().trim().includes('TITIPAN'));
                     
    if (isPindah && (!finalSMF || finalSMF === '')) {
      return 'PASIEN TITIPAN / DIPINDAHKAN KE RUANGAN LAIN';
    }
    
    return finalSMF ? finalSMF.toUpperCase() : 'SMF BELUM TERDATA';
  };

  const [showForm, setShowForm] = useState(false);
  const [showImportArea, setShowImportArea] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKSM, setSelectedKSM] = useState('Semua KSM');
  const [selectedDoctor, setSelectedDoctor] = useState('Semua Dokter');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'range' | 'monthYear'>('range');
  const [exportMonth, setExportMonth] = useState<number>(new Date().getMonth() + 1);
  const [exportYear, setExportYear] = useState<number>(new Date().getFullYear());
  const [patientDischargeFilterDate, setPatientDischargeFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'rincian' | 'smf' | 'cara-bayar' | 'pasien-keluar'>('rincian');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<FinanceRecord | null>(null);
  const [formDoctorCharges, setFormDoctorCharges] = useState<DoctorChargeEntry[]>([
    { doctorName: '', count: 1, role: 'DPJP_UTAMA' }
  ]);

  // Drag and Drop State
  const [loadedDraftPatientId, setLoadedDraftPatientId] = useState<string | null>(null);
  const eligibleDraftPatients = useMemo(() => {
    if (!patientDischargeFilterDate) return [];
    return patients.filter(p => {
      // Must match dischargeDate strictly
      const matchesDischargeDate = p.dischargeDate === patientDischargeFilterDate;
      if (!matchesDischargeDate) return false;

      // Deep discharge status match
      const st = (p.statusDataPasien || '').toUpperCase().trim();
      const keywords = [
        "BPL", "PULANG", "SEMBUH", 
        "APS", "ATAS PERMINTAAN SENDIRI", 
        "MENINGGAL", "WAFAT", 
        "RUJUK", 
        "TRANSFER", "PINDAH"
      ];
      const isDischargedOrStatus = keywords.some(kw => st.includes(kw)) || p.status === 'DISCHARGED';
      if (!isDischargedOrStatus) return false;

      // Must NOT be already entered in finance records on that date
      const alreadyAdded = (records || []).some(
        r => r.patientId === p.id && r.date === patientDischargeFilterDate
      );
      return !alreadyAdded;
    });
  }, [patients, records, patientDischargeFilterDate]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importSummary, setImportSummary] = useState<{ success: number; records: FinanceRecord[] } | null>(null);

  // Default values for newly input items
  const [newRecord, setNewRecord] = useState<Partial<FinanceRecord>>({
    id: '',
    type: 'INCOME',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    category: 'Visite & Billing Pasien Pulang',
    description: '',
    ksm: '',
    dpjp: '',
    numVisites: 1,
    billingAkomodasi: 0,
    billingTindakan: 0,
    billingGasMedis: 0,
    dischargeDate: new Date().toISOString().split('T')[0],
    unit: currentUser?.unit || '',
    noSEP: '',
    ruangRawatAsal: '',
    entryDate: '',
    jmlHariRawat: 1,
    diagnosaUtama: '',
    caraBayar: 'BPJS',
    statusDataPasien: 'BPL'
  });

  const isMethodSelected = (method: string) => {
    const selected = newRecord.caraBayar ? newRecord.caraBayar.split(',').map(m => m.trim()) : [];
    return selected.some(m => m.toLowerCase() === method.toLowerCase());
  };

  const toggleMethod = (method: string) => {
    const selected = newRecord.caraBayar ? newRecord.caraBayar.split(',').map(m => m.trim()).filter(Boolean) : [];
    const index = selected.findIndex(m => m.toLowerCase() === method.toLowerCase());
    let newSelected = [...selected];
    if (index > -1) {
      newSelected.splice(index, 1);
    } else {
      newSelected.push(method);
    }
    setNewRecord({ ...newRecord, caraBayar: newSelected.join(', ') });
  };

  const handlePatientChange = (patientId: string) => {
    if (!patientId) {
      setNewRecord(prev => ({
        ...prev,
        patientId: undefined,
        patientName: undefined,
        noRM: undefined,
        dpjp: '',
        ksm: '',
        noSEP: '',
        ruangRawatAsal: '',
        entryDate: '',
        jmlHariRawat: 1,
        diagnosaUtama: '',
        caraBayar: 'BPJS',
        statusDataPasien: 'BPL'
      }));
      setFormDoctorCharges([{ doctorName: '', count: 1, role: 'DPJP_UTAMA' }]);
      return;
    }

    const p = patients.find(pat => pat.id === patientId);
    if (p) {
      // Calculate stay length
      let calculatedStay = 1;
      if (p.entryDate) {
        const d1 = new Date(p.entryDate);
        const d2 = new Date(p.dischargeDate || new Date().toISOString().split('T')[0]);
        const diffTime = Math.abs(d2.getTime() - d1.getTime());
        calculatedStay = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
      if (isNaN(calculatedStay) || calculatedStay <= 0) calculatedStay = 1;

      // Calculate room class accommodation rate dynamically
      const classRate = (() => {
        const cls = (p.kelasRawat || '').toUpperCase().trim();
        if (cls.includes('VVIP')) return 1500000;
        if (cls.includes('VIP')) return 1000000;
        if (cls.includes('KELAS 1') || cls === '1' || cls === 'I') return 600000;
        if (cls.includes('KELAS 2') || cls === '2' || cls === 'II') return 400000;
        if (cls.includes('KELAS 3') || cls === '3' || cls === 'III') return 200000;
        if (cls.includes('ICU') || cls.includes('HC') || cls.includes('NICU') || cls.includes('PICU')) return 2000000;
        return 300000;
      })();
      const calculatedAccommodationBilling = calculatedStay * classRate;

      // Compile doctors from doctorVisits as Default Value Draft
      const patientVisits = doctorVisits.filter(dv => dv.patientId === p.id);
      const chargeMap: Record<string, { doctorName: string; count: number; role: 'DPJP_UTAMA' | 'DPJP_RABERAN' | 'DPJP_KONSULAN' }> = {};

      if (patientVisits.length > 0) {
        patientVisits.forEach(visit => {
          const roleNormalized: 'DPJP_UTAMA' | 'DPJP_RABERAN' | 'DPJP_KONSULAN' = 
            (visit.visitRole === 'DPJP Utama' || visit.visitRole === 'DPJP_UTAMA') ? 'DPJP_UTAMA' : 
            (visit.visitRole === 'DPJP Rawat Bersama' || visit.visitRole === 'DPJP_RABERAN') ? 'DPJP_RABERAN' : 'DPJP_KONSULAN';
          
          const key = `${visit.doctorName || ''}-${roleNormalized}`;
          if (chargeMap[key]) {
            chargeMap[key].count += 1;
          } else {
            chargeMap[key] = {
              doctorName: visit.doctorName,
              count: 1,
              role: roleNormalized
            };
          }
        });
      }

      const initialCharges: DoctorChargeEntry[] = Object.values(chargeMap);
      if (initialCharges.length === 0) {
        if (p.dpjpList && p.dpjpList.length > 0) {
          p.dpjpList.forEach(doctor => {
            if (doctor) {
              initialCharges.push({
                doctorName: doctor,
                count: 1,
                role: 'DPJP_UTAMA'
              });
            }
          });
        }
      }
      if (initialCharges.length === 0) {
        initialCharges.push({ doctorName: '', count: 1, role: 'DPJP_UTAMA' });
      }

      setFormDoctorCharges(initialCharges);

      const firstDoctor = p.dpjpList?.[0] || '';
      const docMeta = firstDoctor ? masterData.doctorMetadata?.[firstDoctor] : null;

      setNewRecord(prev => ({
        ...prev,
        patientId: p.id,
        patientName: p.name,
        noRM: p.noRM,
        date: p.dischargeDate || prev.date || new Date().toISOString().split('T')[0],
        dischargeDate: p.dischargeDate || prev.dischargeDate || new Date().toISOString().split('T')[0],
        noSEP: p.noSEP || '',
        ruangRawatAsal: p.ruangan || p.unitTujuan || '',
        entryDate: p.entryDate || '',
        jmlHariRawat: calculatedStay,
        billingAkomodasi: calculatedAccommodationBilling,
        diagnosaUtama: p.diagnosaUtama || '',
        caraBayar: (() => {
          let rawMethods: string[] = [];
          if (Array.isArray(p.paymentMethod)) {
            rawMethods = p.paymentMethod;
          } else if (typeof p.paymentMethod === 'string' && p.paymentMethod) {
            rawMethods = p.paymentMethod.split(',').map(m => m.trim()).filter(Boolean);
          }
          
          if (rawMethods.length === 0) {
            return 'BPJS';
          }

          const refsCaraBayar = masterData.refs?.caraBayar || ["BPJS", "Jasa Raharja (JR)", "Umum", "BPJS Ketenagakerjaan", "Tanggungan Negara", "Baksos", "Asuransi Swasta", "Lain-lain"];
          
          const mapped = rawMethods.map(raw => {
            const norm = raw.toUpperCase().trim();
            if (norm.includes('BPJS KETENAGAKERJAAN')) {
              return refsCaraBayar.find(r => r.toUpperCase().includes('KETENAGAKERJAAN')) || 'BPJS Ketenagakerjaan';
            }
            if (norm.includes('BPJS') || norm.includes('KIS')) {
              return refsCaraBayar.find(r => r.toUpperCase() === 'BPJS') || 'BPJS';
            }
            if (norm.includes('UMUM') || norm.includes('MANDIRI') || norm.includes('TUNAI') || norm.includes('CASH')) {
              return refsCaraBayar.find(r => r.toUpperCase() === 'UMUM') || 'Umum';
            }
            if (norm.includes('ASURANSI') || norm.includes('SWASTA')) {
              return refsCaraBayar.find(r => r.toUpperCase().includes('ASURANSI')) || 'Asuransi Swasta';
            }
            if (norm.includes('JASA RAHARJA') || norm.includes('JR') || norm.includes('RAHARJA')) {
              return refsCaraBayar.find(r => r.toUpperCase().includes('RAHARJA')) || 'Jasa Raharja (JR)';
            }
            if (norm.includes('BAKSOS') || norm.includes('BAKTI')) {
              return refsCaraBayar.find(r => r.toUpperCase().includes('BAKSOS')) || 'Baksos';
            }
            if (norm.includes('NEGARA') || norm.includes('TANGGUNGAN')) {
              return refsCaraBayar.find(r => r.toUpperCase().includes('TANGGUNGAN')) || 'Tanggungan Negara';
            }
            
            const exactOrSub = refsCaraBayar.find(r => r.toUpperCase() === norm || r.toUpperCase().includes(norm) || norm.includes(r.toUpperCase()));
            return exactOrSub || raw;
          });

          const uniqueMapped = Array.from(new Set(mapped)).filter(Boolean);
          return uniqueMapped.length > 0 ? uniqueMapped.join(', ') : 'BPJS';
        })(),
        statusDataPasien: p.statusDataPasien || 'BPL',
        dpjp: firstDoctor,
        ksm: docMeta?.ksm || '',
        unit: p.ruangan || prev.unit
      }));
    }
  };

  const handleStartEdit = (r: FinanceRecord) => {
    setNewRecord({
      id: r.id,
      patientId: r.patientId,
      patientName: r.patientName,
      noRM: r.noRM,
      date: r.date || r.dischargeDate || new Date().toISOString().split('T')[0],
      amount: r.amount || 0,
      category: r.category || 'Visite & Billing Pasien Pulang',
      description: r.description || '',
      ksm: r.ksm || '',
      dpjp: r.dpjp || '',
      numVisites: r.numVisites || 1,
      billingAkomodasi: r.billingAkomodasi || 0,
      billingTindakan: r.billingTindakan || 0,
      billingGasMedis: r.billingGasMedis || 0,
      dischargeDate: r.dischargeDate || r.date || new Date().toISOString().split('T')[0],
      unit: r.unit || '',
      noSEP: r.noSEP || '',
      ruangRawatAsal: r.ruangRawatAsal || '',
      entryDate: r.entryDate || '',
      jmlHariRawat: r.jmlHariRawat || 1,
      diagnosaUtama: r.diagnosaUtama || '',
      caraBayar: r.caraBayar || (r as any).caraBayarSingle || 'BPJS',
      statusDataPasien: r.statusDataPasien || 'BPL'
    });
    setFormDoctorCharges(r.doctorCharges && r.doctorCharges.length > 0 ? r.doctorCharges : [{ doctorName: r.dpjp || '', count: 1, role: 'DPJP_UTAMA' }]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDoctorChange = (doctorName: string) => {
    const docMeta = doctorName ? masterData.doctorMetadata?.[doctorName] : null;
    const deducedKsm = docMeta?.ksm || '';
    setNewRecord(prev => ({
      ...prev,
      dpjp: doctorName,
      ksm: deducedKsm || prev.ksm
    }));
  };

  const calculatedTotal = useMemo(() => {
    const akomodasi = Number(newRecord.billingAkomodasi || 0);
    const tindakan = Number(newRecord.billingTindakan || 0);
    const gasMedis = Number(newRecord.billingGasMedis || 0);
    return akomodasi + tindakan + gasMedis;
  }, [newRecord.billingAkomodasi, newRecord.billingTindakan, newRecord.billingGasMedis]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.patientId) {
      alert('Pilih Pasien Terlebih Dahulu!');
      return;
    }

    // Filter valid doctor entries
    const validDoctorCharges = formDoctorCharges.filter(c => !!c.doctorName);
    if (validDoctorCharges.length === 0) {
      alert('Tentukan paling sedikit satu dokter visite!');
      return;
    }

    const firstUtama = validDoctorCharges.find(c => c.role === 'DPJP_UTAMA')?.doctorName || validDoctorCharges[0].doctorName;
    const docMeta = firstUtama ? masterData.doctorMetadata?.[firstUtama] : null;
    const deducedKsm = docMeta?.ksm || newRecord.ksm || 'Umum';

    const methods = newRecord.caraBayar 
      ? newRecord.caraBayar.split(',').map(m => m.trim()).filter(Boolean) 
      : ['BPJS'];

    if (methods.length > 1) {
      methods.forEach((method, idx) => {
        const finalRecord: FinanceRecord = {
          ...newRecord,
          id: idx === 0 && newRecord.id ? newRecord.id : `${newRecord.id || Date.now().toString()}-${idx + 1}`,
          caraBayar: method,
          type: 'INCOME',
          category: 'Visite & Billing Pasien Pulang',
          amount: calculatedTotal,
          recordedBy: currentUser?.name || 'Admin Finansial',
          unit: newRecord.unit || currentUser?.unit || 'Umum',
          dpjp: firstUtama,
          ksm: deducedKsm,
          numVisites: validDoctorCharges.reduce((sum, c) => sum + c.count, 0),
          doctorCharges: validDoctorCharges
        } as FinanceRecord;
        onAddRecord(finalRecord);
      });
    } else {
      const finalRecord: FinanceRecord = {
        ...newRecord,
        id: newRecord.id || Date.now().toString(),
        caraBayar: methods[0] || 'BPJS',
        type: 'INCOME',
        category: 'Visite & Billing Pasien Pulang',
        amount: calculatedTotal,
        recordedBy: currentUser?.name || 'Admin Finansial',
        unit: newRecord.unit || currentUser?.unit || 'Umum',
        dpjp: firstUtama,
        ksm: deducedKsm,
        numVisites: validDoctorCharges.reduce((sum, c) => sum + c.count, 0),
        doctorCharges: validDoctorCharges
      } as FinanceRecord;
      onAddRecord(finalRecord);
    }

    setShowForm(false);
    // Reset state
    setNewRecord({
      id: '',
      type: 'INCOME',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      category: 'Visite & Billing Pasien Pulang',
      description: '',
      ksm: '',
      dpjp: '',
      numVisites: 1,
      billingAkomodasi: 0,
      billingTindakan: 0,
      billingGasMedis: 0,
      dischargeDate: new Date().toISOString().split('T')[0],
      unit: currentUser?.unit || '',
      noSEP: '',
      ruangRawatAsal: '',
      entryDate: '',
      jmlHariRawat: 1,
      diagnosaUtama: '',
      caraBayar: 'BPJS',
      statusDataPasien: 'BPL'
    });
    setFormDoctorCharges([{ doctorName: '', count: 1, role: 'DPJP_UTAMA' }]);
    setLoadedDraftPatientId(null);
  };

  // Filter the financial/visite records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Must be income category pertaining to patient billing/visites
      const matchesSearch = 
        (r.patientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.noRM || '').includes(searchTerm) ||
        (r.dpjp || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesKsm = selectedKSM === 'Semua KSM' || r.ksm === selectedKSM;
      const matchesDoctor = selectedDoctor === 'Semua Dokter' || r.dpjp === selectedDoctor;
      const matchesDate = (() => {
        if (!startDate && !endDate) return true;
        const dVal = r.date || '';
        const dcVal = r.dischargeDate || '';
        const isDInRange = dVal && (!startDate || dVal >= startDate) && (!endDate || dVal <= endDate);
        const isDCInRange = dcVal && (!startDate || dcVal >= startDate) && (!endDate || dcVal <= endDate);
        return !!(isDInRange || isDCInRange);
      })();

      return matchesSearch && matchesKsm && matchesDoctor && matchesDate;
    });
  }, [records, searchTerm, selectedKSM, selectedDoctor, startDate, endDate]);

  // Aggregate totals
  const aggregatedStats = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => {
      acc.totalBilling += curr.amount || 0;
      acc.akomodasi += curr.billingAkomodasi || 0;
      acc.tindakan += curr.billingTindakan || 0;
      acc.gasMedis += curr.billingGasMedis || 0;
      
      const chargeVisites = curr.doctorCharges && curr.doctorCharges.length > 0
        ? curr.doctorCharges.reduce((s, c) => s + c.count, 0)
        : curr.numVisites || 0;
      acc.visites += chargeVisites;
      return acc;
    }, { totalBilling: 0, akomodasi: 0, tindakan: 0, gasMedis: 0, visites: 0 });
  }, [filteredRecords]);

  // Unique KSM list
  const ksmList = useMemo(() => {
    return masterData.refs?.ksmList || [];
  }, [masterData]);

  // Available Years for export options
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear()); // always include current year
    records.forEach(r => {
      const dStr = r.date || r.dischargeDate;
      if (dStr) {
        const yr = new Date(dStr).getFullYear();
        if (!isNaN(yr)) yearsSet.add(yr);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [records]);

  // Helper to split cara bayar and return array
  const getCaraBayarListForRecord = (r: FinanceRecord): string[] => {
    const cleanCb = (val: string): string => {
      let v = val.trim();
      // Case-insensitive replacement of BPJS KEPENDUDUKAN, BPJS KESEHATAN, BPJS KES, etc. to just BPJS
      let replaced = v.replace(/bpjs\s+kesehatan/gi, "BPJS").replace(/bpjs\s+kes/gi, "BPJS");
      if (replaced.toUpperCase() === 'BPJS') {
        return 'BPJS';
      }
      return replaced;
    };

    if (r.caraBayar) {
      const list = r.caraBayar.split(/[,;\+]/).map(cleanCb).filter(Boolean);
      if (list.length > 0) return list;
    }
    if (r.patientId) {
      const p = patients.find(pat => pat.id === r.patientId);
      if (p && p.paymentMethod && p.paymentMethod.length > 0) {
        return p.paymentMethod.map(cleanCb).filter(Boolean);
      }
    }
    return [r.caraBayar ? cleanCb(r.caraBayar) : 'BPJS'];
  };

  // Expanded filtered records where a single row is duplicated for each target payment method
  const expandedFilteredRecords = useMemo(() => {
    const list: (FinanceRecord & { caraBayarSingle: string })[] = [];
    filteredRecords.forEach(r => {
      const cbList = getCaraBayarListForRecord(r);
      cbList.forEach(cb => {
        list.push({
          ...r,
          caraBayarSingle: cb
        });
      });
    });
    return list;
  }, [filteredRecords, patients]);

  // Aggregate totals for the duplicated expanded billing schema
  const expandedAggregatedStats = useMemo(() => {
    return expandedFilteredRecords.reduce((acc, curr) => {
      acc.totalBilling += curr.amount || 0;
      acc.akomodasi += curr.billingAkomodasi || 0;
      acc.tindakan += curr.billingTindakan || 0;
      acc.gasMedis += curr.billingGasMedis || 0;
      
      const chargeVisites = curr.doctorCharges && curr.doctorCharges.length > 0
        ? curr.doctorCharges.reduce((s, c) => s + c.count, 0)
        : curr.numVisites || 0;
      acc.visites += chargeVisites;
      return acc;
    }, { totalBilling: 0, akomodasi: 0, tindakan: 0, gasMedis: 0, visites: 0 });
  }, [expandedFilteredRecords]);

  // Split per Cara Bayar for Rincian Laporan
  const recordsByCaraBayar = useMemo<Record<string, (FinanceRecord & { caraBayarSingle: string })[]>>(() => {
    const groups: Record<string, (FinanceRecord & { caraBayarSingle: string })[]> = {};
    expandedFilteredRecords.forEach(r => {
      const cb = r.caraBayarSingle || 'BPJS';
      if (!groups[cb]) groups[cb] = [];
      groups[cb].push(r);
    });
    return groups;
  }, [expandedFilteredRecords]);

  // SMF (KSM) & Cara Bayar Analysis per Doctor mapping
  const smfDoctorAnalysis = useMemo<Record<string, Record<string, Record<string, DoctorSMFAnalysisStats>>>>(() => {
    // Structure: CaraBayar -> SMF (KSM) -> DoctorName -> DoctorStats
    const groups: Record<string, Record<string, Record<string, DoctorSMFAnalysisStats>>> = {};

    filteredRecords.forEach(r => {
      const cbList = getCaraBayarListForRecord(r);

      cbList.forEach(cb => {
        if (!groups[cb]) {
          groups[cb] = {};
        }

        const charges = r.doctorCharges && r.doctorCharges.length > 0
          ? r.doctorCharges
          : [{ doctorName: r.dpjp || 'Dokter Umum', count: r.numVisites || 1, role: 'DPJP_UTAMA' as const }];

        // The KSM/SMF group is determined by the Primary DPJP (DPJP_UTAMA) of this record
        const ksmKey = getKsmForRecord(r);

        charges.forEach(c => {
          if (!c.doctorName) return;
          const docName = c.doctorName;

          if (!groups[cb][ksmKey]) {
            groups[cb][ksmKey] = {};
          }

          if (!groups[cb][ksmKey][docName]) {
            groups[cb][ksmKey][docName] = {
              doctorName: docName,
              dpjpUtamaPatients: 0,
              dpjpUtamaAndRaberanVisits: 0,
              dpjpKonsulanPatients: 0,
              dpjpKonsulanVisits: 0
            };
          }

          const stats = groups[cb][ksmKey][docName];

          if (c.role === 'DPJP_UTAMA') {
            stats.dpjpUtamaPatients += 1;
            stats.dpjpUtamaAndRaberanVisits += c.count || 0;
          } else if (c.role === 'DPJP_RABERAN') {
            stats.dpjpUtamaAndRaberanVisits += c.count || 0;
          } else if (c.role === 'DPJP_KONSULAN') {
            stats.dpjpKonsulanPatients += 1;
            stats.dpjpKonsulanVisits += c.count || 0;
          }
        });
      });
    });

    return groups;
  }, [filteredRecords, masterData, patients]);

  // SMF (SMF/KSM of Doctors) & Cara Bayar Analysis per Doctor
  const smfAnalysis = useMemo(() => {
    const analysisMap: Record<string, {
      ksm: string;
      caraBayar: string;
      doctorName: string;
      patientCount: number;
      visiteCount: number;
      dpjpUtamaCount: number;
      dpjpRaberanCount: number;
      dpjpKonsulanCount: number;
      akomodasi: number;
      tindakan: number;
      gasMedis: number;
      totalBilling: number;
    }> = {};

    filteredRecords.forEach(r => {
      const cbList = getCaraBayarListForRecord(r);
      
      cbList.forEach(cb => {
        const charges = r.doctorCharges && r.doctorCharges.length > 0
          ? r.doctorCharges
          : [{ doctorName: r.dpjp || 'Dokter Umum', count: r.numVisites || 1, role: 'DPJP_UTAMA' as const }];

        // The KSM/SMF group is determined by the Primary DPJP (DPJP_UTAMA) of this record
        const ksmKey = getKsmForRecord(r);

        charges.forEach(c => {
          if (!c.doctorName) return;
          const docName = c.doctorName;
          
          const compositeKey = `${ksmKey}_${cb}_${docName}`;

          if (!analysisMap[compositeKey]) {
            analysisMap[compositeKey] = {
              ksm: ksmKey,
              caraBayar: cb,
              doctorName: docName,
              patientCount: 0,
              visiteCount: 0,
              dpjpUtamaCount: 0,
              dpjpRaberanCount: 0,
              dpjpKonsulanCount: 0,
              akomodasi: 0,
              tindakan: 0,
              gasMedis: 0,
              totalBilling: 0
            };
          }

          const item = analysisMap[compositeKey];
          item.patientCount += 1;
          item.visiteCount += c.count || 0;

          if (c.role === 'DPJP_UTAMA') {
            item.dpjpUtamaCount += 1;
          } else if (c.role === 'DPJP_RABERAN') {
            item.dpjpRaberanCount += 1;
          } else if (c.role === 'DPJP_KONSULAN') {
            item.dpjpKonsulanCount += 1;
          }

          item.akomodasi += r.billingAkomodasi || 0;
          item.tindakan += r.billingTindakan || 0;
          item.gasMedis += r.billingGasMedis || 0;
          item.totalBilling += r.amount || 0;
        });
      });
    });

    return Object.values(analysisMap).sort((a, b) => {
      const ksmCompare = a.ksm.localeCompare(b.ksm);
      if (ksmCompare !== 0) return ksmCompare;
      const cbCompare = a.caraBayar.localeCompare(b.caraBayar);
      if (cbCompare !== 0) return cbCompare;
      return a.doctorName.localeCompare(b.doctorName);
    });
  }, [filteredRecords, masterData, patients]);

  // Cara Bayar Analysis
  const caraBayarAnalysis = useMemo(() => {
    const cbMap: Record<string, {
      caraBayar: string;
      patientCount: number;
      visiteCount: number;
      akomodasi: number;
      tindakan: number;
      gasMedis: number;
      totalBilling: number;
    }> = {};

    filteredRecords.forEach(r => {
      const cbList = getCaraBayarListForRecord(r);
      cbList.forEach(cbKey => {
        if (!cbMap[cbKey]) {
          cbMap[cbKey] = {
            caraBayar: cbKey,
            patientCount: 0,
            visiteCount: 0,
            akomodasi: 0,
            tindakan: 0,
            gasMedis: 0,
            totalBilling: 0
          };
        }

        const info = cbMap[cbKey];
        info.patientCount += 1;
        info.akomodasi += r.billingAkomodasi || 0;
        info.tindakan += r.billingTindakan || 0;
        info.gasMedis += r.billingGasMedis || 0;
        info.totalBilling += r.amount || 0;

        const chargesCount = r.doctorCharges && r.doctorCharges.length > 0
          ? r.doctorCharges.reduce((s, c) => s + c.count, 0)
          : r.numVisites || 0;
        info.visiteCount += chargesCount;
      });
    });

    return Object.values(cbMap);
  }, [filteredRecords, patients]);

  // Pasien Keluar Per Hari Analysis (BPL, APS, Meninggal, Pindah Ruangan, Rujuk)
  const statusDischargeAnalysis = useMemo(() => {
    const statusMap: Record<string, {
      date: string;
      bpl: number;
      aps: number;
      meninggal: number;
      pindahRuangan: number;
      rujuk: number;
      totalOut: number;
    }> = {};

    filteredRecords.forEach(r => {
      const dateKey = r.date || r.dischargeDate || 'TBA';
      if (!statusMap[dateKey]) {
        statusMap[dateKey] = {
          date: dateKey,
          bpl: 0,
          aps: 0,
          meninggal: 0,
          pindahRuangan: 0,
          rujuk: 0,
          totalOut: 0
        };
      }

      const info = statusMap[dateKey];
      const status = (r.statusDataPasien || 'BPL').toUpperCase();
      if (status === 'BPL') {
        info.bpl += 1;
      } else if (status === 'APS') {
        info.aps += 1;
      } else if (status === 'MENINGGAL') {
        info.meninggal += 1;
      } else if (status === 'PINDAH RUANGAN' || status === 'PINDAH') {
        info.pindahRuangan += 1;
      } else if (status === 'RUJUK' || status === 'RUJUKAN') {
        info.rujuk += 1;
      } else {
        info.bpl += 1;
      }

      info.totalOut += 1;
    });

    return Object.values(statusMap).sort((a,b) => compareDatesSafe(a.date, b.date, true));
  }, [filteredRecords]);

  // High-Fidelity Excel Export Builder
  const exportToExcelRapi = () => {
    try {
      const activeMode = exportMode;
      const activeMonth = exportMonth;
      const activeYear = exportYear;

      let recordsToExport: FinanceRecord[] = [];
      if (activeMode === 'range') {
        recordsToExport = filteredRecords;
      } else {
        recordsToExport = records.filter(r => {
          const dStr = r.date || r.dischargeDate;
          if (!dStr) return false;
          const dateObj = new Date(dStr);
          if (isNaN(dateObj.getTime())) return false;
          const rMonth = dateObj.getMonth() + 1;
          const rYear = dateObj.getFullYear();
          return rMonth === activeMonth && rYear === activeYear;
        });
      }

      // Compute local equivalents to keep original sheets perfectly intact
      const expandedFilteredRecords: (FinanceRecord & { caraBayarSingle: string })[] = [];
      recordsToExport.forEach(r => {
        const cbList = getCaraBayarListForRecord(r);
        cbList.forEach(cb => {
          expandedFilteredRecords.push({
            ...r,
            caraBayarSingle: cb
          });
        });
      });

      const cbMap: Record<string, {
        caraBayar: string;
        patientCount: number;
        visiteCount: number;
        akomodasi: number;
        tindakan: number;
        gasMedis: number;
        totalBilling: number;
      }> = {};

      recordsToExport.forEach(r => {
        const cbList = getCaraBayarListForRecord(r);
        cbList.forEach(cbKey => {
          if (!cbMap[cbKey]) {
            cbMap[cbKey] = {
              caraBayar: cbKey,
              patientCount: 0,
              visiteCount: 0,
              akomodasi: 0,
              tindakan: 0,
              gasMedis: 0,
              totalBilling: 0
            };
          }

          const info = cbMap[cbKey];
          info.patientCount += 1;
          info.akomodasi += r.billingAkomodasi || 0;
          info.tindakan += r.billingTindakan || 0;
          info.gasMedis += r.billingGasMedis || 0;
          info.totalBilling += r.amount || 0;

          const chargesCount = r.doctorCharges && r.doctorCharges.length > 0
            ? r.doctorCharges.reduce((s, c) => s + c.count, 0)
            : r.numVisites || 0;
          info.visiteCount += chargesCount;
        });
      });

      const caraBayarAnalysis = Object.values(cbMap);

      const smfDoctorAnalysis: Record<string, Record<string, Record<string, DoctorSMFAnalysisStats>>> = {};

      recordsToExport.forEach(r => {
        const cbList = getCaraBayarListForRecord(r);

        cbList.forEach(cb => {
          if (!smfDoctorAnalysis[cb]) {
            smfDoctorAnalysis[cb] = {};
          }

          const charges = r.doctorCharges && r.doctorCharges.length > 0
            ? r.doctorCharges
            : [{ doctorName: r.dpjp || 'Dokter Umum', count: r.numVisites || 1, role: 'DPJP_UTAMA' as const }];

          const ksmKey = getKsmForRecord(r);

          charges.forEach(c => {
            if (!c.doctorName) return;
            const docName = c.doctorName;

            if (!smfDoctorAnalysis[cb][ksmKey]) {
              smfDoctorAnalysis[cb][ksmKey] = {};
            }

            if (!smfDoctorAnalysis[cb][ksmKey][docName]) {
              smfDoctorAnalysis[cb][ksmKey][docName] = {
                doctorName: docName,
                dpjpUtamaPatients: 0,
                dpjpUtamaAndRaberanVisits: 0,
                dpjpKonsulanPatients: 0,
                dpjpKonsulanVisits: 0
              };
            }

            const stats = smfDoctorAnalysis[cb][ksmKey][docName];

            if (c.role === 'DPJP_UTAMA') {
              stats.dpjpUtamaPatients += 1;
              stats.dpjpUtamaAndRaberanVisits += c.count || 0;
            } else if (c.role === 'DPJP_RABERAN') {
              stats.dpjpUtamaAndRaberanVisits += c.count || 0;
            } else if (c.role === 'DPJP_KONSULAN') {
              stats.dpjpKonsulanPatients += 1;
              stats.dpjpKonsulanVisits += c.count || 0;
            }
          });
        });
      });

      const periodText = activeMode === 'range' 
        ? ((startDate || endDate) ? `${startDate || ''} s/d ${endDate || ''}` : "Semua Waktu")
        : `${MONTHS.find(m => m.value === activeMonth)?.label || ''} ${activeYear}`;

      const dateFilter = periodText;

      const wb = XLSX.utils.book_new();

      const addSafeSheet = (ws: any, rawSheetName: string) => {
        try {
          const safeSheetName = rawSheetName.substring(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
        } catch (sErr) {
          console.error("Failed to append sheet: " + rawSheetName, sErr);
        }
      };

    // Helper to calculate column widths and prevent cutting data or ### symbols
    const autoFitColumns = (ws: any, rows: any[][]) => {
      if (!rows || rows.length === 0) return;
      const colWidths = rows[0].map((_, colIdx) => {
        let maxLen = 10; // minimum default size
        rows.forEach(row => {
          if (row && row[colIdx] !== undefined && row[colIdx] !== null) {
            let valStr = String(row[colIdx]);
            if (typeof row[colIdx] === 'number') {
              valStr = row[colIdx].toLocaleString('id-ID'); // approximate accounting format length
            }
            if (valStr.length > maxLen) {
              maxLen = valStr.length;
            }
          }
        });
        return { wch: maxLen + 5 }; // extra safety padding
      });
      ws['!cols'] = colWidths;
    };

    // Helper to apply premium medical brand stylesheet matching the interactive UI (Dark Teal / Orange Accent / Zebra etc)
    const applyStylesToSheet = (ws: any, options: {
      tableHeaderRowIndex: number;
      accentSubHeaderRowIndices?: number[];
      boldRowIndices?: number[];
      centerColIndices?: number[];
      leftColIndices?: number[];
      rightColIndices?: number[];
      currencyColIndices?: number[];
      isRingkasanEksekutif?: boolean;
      tableBHeaderRowIndex?: number;
    }) => {
      // Force Excel to display grid lines correctly!
      ws['!views'] = [{ showGridLines: true }];

      for (const ref in ws) {
        if (ref.startsWith('!')) continue;
        const cell = ws[ref];
        if (!cell) continue;

        const match = ref.match(/^([A-Z]+)([0-9]+)$/);
        if (!match) continue;
        const colStr = match[1];
        const rowNum = parseInt(match[2], 10) - 1; // 0-indexed row

        let colIdx = 0;
        for (let i = 0; i < colStr.length; i++) {
          colIdx = colIdx * 26 + (colStr.charCodeAt(i) - 64);
        }
        colIdx -= 1; // 0-indexed column

        // Default cell layout styling
        cell.s = {
          font: { name: "Calibri", sz: 10, color: { rgb: "1E293B" } }, // Tailwind slate-800
          alignment: { vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left: { style: "thin", color: { rgb: "E2E8F0" } },
            right: { style: "thin", color: { rgb: "E2E8F0" } }
          }
        };

        // Header info block (metadata/title) formatting
        if (rowNum < options.tableHeaderRowIndex) {
          cell.s.border = {}; // remove borders for clean title card
          if (rowNum === 0) {
            cell.s.font = { name: "Calibri", sz: 14, bold: true, color: { rgb: "005B60" } }; // Dark Teal Title
          } else {
            cell.s.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "475569" } };
          }
          continue;
        }

        // Special styles for Ringkasan Eksekutif
        if (options.isRingkasanEksekutif) {
          const tableBHeaderIdx = options.tableBHeaderRowIndex ?? 999;

          // Inside section border gap & titles
          if (rowNum > options.tableHeaderRowIndex + 1 + caraBayarAnalysis.length && rowNum < tableBHeaderIdx) {
            cell.s.border = {};
            cell.s.font = { name: "Calibri", sz: 12, bold: true, color: { rgb: "005B60" } }; // Premium Group Title
            continue;
          }

          // Table A Header
          if (rowNum === options.tableHeaderRowIndex) {
            cell.s.font = { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } };
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "005B60" } }; // Dark Teal
            cell.s.alignment.horizontal = "center";
            cell.s.border = {
              top: { style: "medium", color: { rgb: "003336" } },
              bottom: { style: "medium", color: { rgb: "003336" } },
              left: { style: "thin", color: { rgb: "005B60" } },
              right: { style: "thin", color: { rgb: "005B60" } }
            };
            continue;
          }

          // Table A Total regional summary
          if (rowNum === options.tableHeaderRowIndex + 1 + caraBayarAnalysis.length) {
            cell.s.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "FF7F00" } }; // Orange Accent
            cell.s.alignment.horizontal = colIdx === 0 ? "left" : (colIdx >= 4 && colIdx <= 7 ? "right" : "center");
            if (colIdx >= 4 && colIdx <= 7 && typeof cell.v === 'number') {
              cell.z = "#,##0";
            }
            continue;
          }

          // Table B Header (Analisis Mutu per SMF Dokter Spesialis)
          if (rowNum === tableBHeaderIdx) {
            cell.s.font = { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } };
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "005B60" } }; // Dark Teal
            cell.s.alignment.horizontal = "center";
            cell.s.border = {
              top: { style: "medium", color: { rgb: "003336" } },
              bottom: { style: "medium", color: { rgb: "003336" } },
              left: { style: "thin", color: { rgb: "005B60" } },
              right: { style: "thin", color: { rgb: "005B60" } }
            };
            continue;
          }

          // Table B Data Rows
          if (rowNum > tableBHeaderIdx) {
            const relBIdx = rowNum - tableBHeaderIdx - 1;
            if (relBIdx % 2 === 0) {
              cell.s.fill = { patternType: "solid", fgColor: { rgb: "F4F8F8" } }; // Zebra striping pastel
            } else {
              cell.s.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
            }

            if (colIdx === 1) {
              cell.s.alignment.horizontal = "left";
              cell.s.font.bold = true;
            } else if (colIdx === 2 || colIdx === 3) {
              cell.s.alignment.horizontal = "center";
            } else if (colIdx >= 4 && colIdx <= 6) {
              cell.s.alignment.horizontal = "center";
              cell.s.font.bold = true;
            } else {
              cell.s.alignment.horizontal = "center";
            }

            // Kepatuhan Status color indicators (Hijau / Oranye)
            if (colIdx === 7) {
              cell.s.font.bold = true;
              const statusStr = String(cell.v).toUpperCase();
              if (statusStr.includes("SANGAT") || statusStr.includes("PATUH") && !statusStr.includes("TIDAK")) {
                cell.s.font.color = { rgb: "008F46" }; // Forest Green
                cell.s.fill = { patternType: "solid", fgColor: { rgb: "E6F5EC" } }; // light green bg
              } else {
                cell.s.font.color = { rgb: "D17000" }; // Dark Orange/Amber compliant indicator
                cell.s.fill = { patternType: "solid", fgColor: { rgb: "FDF2E2" } }; // light orange bg
              }
            }
            continue;
          }

          // Table A Data Rows
          if (rowNum > options.tableHeaderRowIndex && rowNum < options.tableHeaderRowIndex + 1 + caraBayarAnalysis.length) {
            const relAIdx = rowNum - options.tableHeaderRowIndex - 1;
            if (relAIdx % 2 === 0) {
              cell.s.fill = { patternType: "solid", fgColor: { rgb: "F4F8F8" } };
            } else {
              cell.s.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
            }

            if (colIdx === 0) {
              cell.s.alignment.horizontal = "center";
            } else if (colIdx === 1) {
              cell.s.alignment.horizontal = "left";
              cell.s.font.bold = true;
            } else if (colIdx === 2 || colIdx === 3) {
              cell.s.alignment.horizontal = "center";
              cell.s.font.bold = true;
            } else {
              cell.s.alignment.horizontal = "right";
              if (typeof cell.v === 'number') {
                cell.z = "#,##0";
              }
            }
            continue;
          }
        }

        // --- Log Sheets styling (Tabs 2 to 9) ---
        if (rowNum === options.tableHeaderRowIndex) {
          cell.s.font = { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } };
          cell.s.fill = { patternType: "solid", fgColor: { rgb: "005B60" } }; // Dark Teal
          cell.s.alignment.horizontal = "center";
          cell.s.border = {
            top: { style: "medium", color: { rgb: "003336" } },
            bottom: { style: "medium", color: { rgb: "003336" } },
            left: { style: "thin", color: { rgb: "005B60" } },
            right: { style: "thin", color: { rgb: "005B60" } }
          };
          continue;
        }

        const isAccentSubHeader = options.accentSubHeaderRowIndices?.includes(rowNum) ?? false;
        if (isAccentSubHeader) {
          cell.s.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
          cell.s.fill = { patternType: "solid", fgColor: { rgb: "FF7F00" } }; // Bold Orange Accent #FF7F00 background
          cell.s.alignment.horizontal = "left";
          continue;
        }

        const totalRowIndex = options.boldRowIndices?.[0] ?? -1;
        if (rowNum === totalRowIndex) {
          // Bottom Grand Total row
          cell.s.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
          cell.s.fill = { patternType: "solid", fgColor: { rgb: "FF7F00" } }; // Accent Sub-header Muted Orange
          
          if (options.centerColIndices?.includes(colIdx)) {
            cell.s.alignment.horizontal = "center";
          } else if (options.currencyColIndices?.includes(colIdx)) {
            cell.s.alignment.horizontal = "right";
            if (typeof cell.v === 'number') {
              cell.z = "#,##0";
            }
          } else {
            cell.s.alignment.horizontal = "left";
          }
          continue;
        }

        // Data Rows Zebra & Alignment mapping
        if (rowNum > options.tableHeaderRowIndex && rowNum < totalRowIndex) {
          const relDataRowIdx = rowNum - options.tableHeaderRowIndex - 1;
          if (relDataRowIdx % 2 === 0) {
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "F4F8F8" } }; // Zebra Striping Pastel
          } else {
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
          }

          if (options.centerColIndices?.includes(colIdx)) {
            cell.s.alignment.horizontal = "center";
          } else if (options.currencyColIndices?.includes(colIdx)) {
            cell.s.alignment.horizontal = "right";
            if (typeof cell.v === 'number') {
              cell.z = "#,##0";
            }
          } else if (options.leftColIndices?.includes(colIdx)) {
            cell.s.alignment.horizontal = "left";
          }
        }
      }
    };

    // Helper functions to routes Cara Bayar (payment methods) into distinct sheets
    const getTabName = (cbSingle: string): string => {
      const cb = String(cbSingle || "BPJS").toUpperCase().trim();
      if (cb === "BPJS" || cb === "BPJS KESEHATAN" || cb === "BPJS KES" || cb.startsWith("BPJS KES") || cb.includes("KESEHATAN") || cb === "JKN" || cb === "BPJS HEALTH") {
        return "Pasien BPJS";
      }
      if (cb === "UMUM" || cb === "MANDIRI" || cb === "CASH" || cb.includes("UMUM") || cb.includes("MANDIRI") || cb.includes("CASH") || cb === "PASIEN UMUM") {
        return "Pasien Umum";
      }
      if (cb === "JASA RAHARJA" || cb === "JR" || cb.includes("RAHARJA") || cb.includes("JASA RAHARJA") || cb === "JASA RAHARJA (JR)") {
        return "Pasien Jasaraharja";
      }
      if (cb === "BPJS KETENAGAKERJAAN" || cb === "BPJSTK" || cb === "BPJS TK" || cb.includes("KETENAGAKERJAAN") || cb.includes("BPJS TK") || cb.includes("BPJSTK")) {
        return "Pasien BPJS Ketenagakerjaan";
      }
      if (cb === "TANGGUNGAN NEGARA" || cb.includes("TANGGUNGAN") || cb.includes("NEGARA")) {
        return "Pasien Tanggungan Negara";
      }
      if (cb === "BAKSOS" || cb.includes("BAKSOS") || cb.includes("BAKTI SOSIAL") || cb.includes("SOSIAL")) {
        return "Pasien Baksos";
      }
      if (cb === "ASURANSI SWASTA" || cb.includes("SWASTA") || cb.includes("ASURANSI")) {
        return "Pasien Asuransi Swasta";
      }
      return "Pasien Lain-Lain";
    };

    // Helper to build Log Sheets (Tabs 2 to 17)
    const buildSheetForCategory = (sheetName: string, records: any[]) => {
      try {
        const titleBlock = [
          [`LAPORAN RINCIAN LOG HARIAN - KLAIM & DETIL BILLING (${sheetName.toUpperCase()})`, "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
          ["Unit Pelayanan", currentUser?.unit || "RUANG BEDAH UTAMA", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
          ["Periode Tanggal", dateFilter || "Semua Waktu", "Filter KSM", selectedKSM, "Filter Dokter", selectedDoctor, "", "", "", "", "", "", "", "", "", ""],
          ["Waktu Pembuatan", new Date().toLocaleString('id-ID'), "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
          [],
          [`TABEL RINCIAN PASIEN (${sheetName.toUpperCase()})`, "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
          [
            "No", "Tgl Pulang", "Nama Pasien", "No RM", "No. SEP", "Cara Bayar", "Ruangan", "Hari Rawat", 
            "DPJP Utama", "DPJP Raberan", "DPJP Konsulan",
            "Akomodasi (Rp)", "Tindakan (Rp)", "Gas Medis (Rp)", "Total Billing (Rp)", "Diagnosa"
          ]
        ];

        const isPindahRuanganOrTitipan = (r: any) => {
          if (!r) return false;
          const status = String(r.statusDataPasien || r.status || '').toUpperCase().trim();
          return status.includes('PINDAH') || status.includes('TITIPAN');
        };

        const regularRecords = (records || []).filter(r => r && !isPindahRuanganOrTitipan(r));
        const pindahRecords = (records || []).filter(r => r && isPindahRuanganOrTitipan(r));

        const finalRows: any[][] = [];
        const smfSubHeaderIndices: number[] = [];
        let itemCounter = 1;

        // Group regular records by SMF
        const regularGroupedBySMF: Record<string, any[]> = {};
        regularRecords.forEach(r => {
          try {
            const smfName = getKsmForRecord(r);
            if (!regularGroupedBySMF[smfName]) {
              regularGroupedBySMF[smfName] = [];
            }
            regularGroupedBySMF[smfName].push(r);
          } catch (e) {
            console.error("Failed to group regular record", r, e);
          }
        });

        const sortedRegularSMF = Object.keys(regularGroupedBySMF).sort();

        sortedRegularSMF.forEach(smfName => {
          const smfRecords = [...regularGroupedBySMF[smfName]].sort((a, b) => {
            const dateA = a?.date || a?.dischargeDate || '';
            const dateB = b?.date || b?.dischargeDate || '';
            return compareDatesSafe(dateA, dateB, true);
          });
          
          // SMF sub-header row
          const subHeaderRow = Array(16).fill("");
          subHeaderRow[0] = `✦ SMF ${smfName.toUpperCase()}`;
          
          const rowIndex = titleBlock.length + finalRows.length;
          smfSubHeaderIndices.push(rowIndex);
          finalRows.push(subHeaderRow);

          smfRecords.forEach(r => {
            try {
              const dpjpUtamaList = r.doctorCharges ? r.doctorCharges.filter((c: any) => c && c.role === 'DPJP_UTAMA') : [];
              const dpjpRaberanList = r.doctorCharges ? r.doctorCharges.filter((c: any) => c && c.role === 'DPJP_RABERAN') : [];
              const dpjpKonsulList = r.doctorCharges ? r.doctorCharges.filter((c: any) => c && c.role === 'DPJP_KONSULAN') : [];

              const dpjpUtamaNames = dpjpUtamaList.map((c: any) => `${c?.doctorName || '-'} (${c?.count || 0}x)`).join(', ') || r.dpjp || '-';
              const dpjpRaberanNames = dpjpRaberanList.map((c: any) => `${c?.doctorName || '-'} (${c?.count || 0}x)`).join(', ') || '-';
              const dpjpKonsulNames = dpjpKonsulList.map((c: any) => `${c?.doctorName || '-'} (${c?.count || 0}x)`).join(', ') || '-';

              finalRows.push([
                itemCounter++,
                r.date || r.dischargeDate || '-',
                r.patientName || 'Pasien Umum',
                r.noRM || '-',
                r.noSEP || '-',
                r.caraBayarSingle || r.caraBayar || 'BPJS',
                r.ruangRawatAsal || '-',
                r.jmlHariRawat || 1,
                dpjpUtamaNames,
                dpjpRaberanNames,
                dpjpKonsulNames,
                r.billingAkomodasi || 0,
                r.billingTindakan || 0,
                r.billingGasMedis || 0,
                r.amount || 0,
                r.diagnosaUtama || '-'
              ]);
            } catch (itemErr) {
              console.error("Failed to build row for regular record:", r, itemErr);
              // Fallback safe row push so it never crashes
              finalRows.push([
                itemCounter++,
                r?.date || r?.dischargeDate || '-',
                r?.patientName || 'Pasien Umum (Data Korup)',
                r?.noRM || '-',
                r?.noSEP || '-',
                r?.caraBayarSingle || r?.caraBayar || 'BPJS',
                r?.ruangRawatAsal || '-',
                r?.jmlHariRawat || 1,
                r?.dpjp || '-',
                '-',
                '-',
                r?.billingAkomodasi || 0,
                r?.billingTindakan || 0,
                r?.billingGasMedis || 0,
                r?.amount || 0,
                r?.diagnosaUtama || '-'
              ]);
            }
          });
        });

        // Group Group Pindah/Titipan at the bottom
        if (pindahRecords.length > 0) {
          const pindahGroupedBySMF: Record<string, any[]> = {};
          pindahRecords.forEach(r => {
            try {
              const smfName = getKsmForRecord(r);
              if (!pindahGroupedBySMF[smfName]) {
                pindahGroupedBySMF[smfName] = [];
              }
              pindahGroupedBySMF[smfName].push(r);
            } catch (e) {
              console.error("Failed to group pindah record", r, e);
            }
          });

          const sortedPindahSMF = Object.keys(pindahGroupedBySMF).sort();

          // grand separator row
          const grandSeparatorRow = Array(16).fill("");
          grandSeparatorRow[0] = `✦ KELOMPOK PASIEN PINDAH RUANGAN / TITIPAN`;
          const grandRowIndex = titleBlock.length + finalRows.length;
          smfSubHeaderIndices.push(grandRowIndex);
          finalRows.push(grandSeparatorRow);

          sortedPindahSMF.forEach(smfName => {
            const smfRecords = [...pindahGroupedBySMF[smfName]].sort((a, b) => {
              const dateA = a?.date || a?.dischargeDate || '';
              const dateB = b?.date || b?.dischargeDate || '';
              return compareDatesSafe(dateA, dateB, true);
            });
            
            const subHeaderRow = Array(16).fill("");
            subHeaderRow[0] = `✦ SMF ${smfName.toUpperCase()} (PASIEN TITIPAN / PINDAH RUANGAN)`;
            
            const rowIndex = titleBlock.length + finalRows.length;
            smfSubHeaderIndices.push(rowIndex);
            finalRows.push(subHeaderRow);

            smfRecords.forEach(r => {
              try {
                const dpjpUtamaList = r.doctorCharges ? r.doctorCharges.filter((c: any) => c && c.role === 'DPJP_UTAMA') : [];
                const dpjpRaberanList = r.doctorCharges ? r.doctorCharges.filter((c: any) => c && c.role === 'DPJP_RABERAN') : [];
                const dpjpKonsulList = r.doctorCharges ? r.doctorCharges.filter((c: any) => c && c.role === 'DPJP_KONSULAN') : [];

                const dpjpUtamaNames = dpjpUtamaList.map((c: any) => `${c?.doctorName || '-'} (${c?.count || 0}x)`).join(', ') || r.dpjp || '-';
                const dpjpRaberanNames = dpjpRaberanList.map((c: any) => `${c?.doctorName || '-'} (${c?.count || 0}x)`).join(', ') || '-';
                const dpjpKonsulNames = dpjpKonsulList.map((c: any) => `${c?.doctorName || '-'} (${c?.count || 0}x)`).join(', ') || '-';

                finalRows.push([
                  itemCounter++,
                  r.date || r.dischargeDate || '-',
                  r.patientName || 'Pasien Umum',
                  r.noRM || '-',
                  r.noSEP || '-',
                  r.caraBayarSingle || r.caraBayar || 'BPJS',
                  r.ruangRawatAsal || '-',
                  r.jmlHariRawat || 1,
                  dpjpUtamaNames,
                  dpjpRaberanNames,
                  dpjpKonsulNames,
                  r.billingAkomodasi || 0,
                  r.billingTindakan || 0,
                  r.billingGasMedis || 0,
                  r.amount || 0,
                  r.diagnosaUtama || '-'
                ]);
              } catch (itemErr) {
                console.error("Failed to build row for pindah record:", r, itemErr);
                finalRows.push([
                  itemCounter++,
                  r?.date || r?.dischargeDate || '-',
                  r?.patientName || 'Pasien Umum (Data Korup)',
                  r?.noRM || '-',
                  r?.noSEP || '-',
                  r?.caraBayarSingle || r?.caraBayar || 'BPJS',
                  r?.ruangRawatAsal || '-',
                  r?.jmlHariRawat || 1,
                  r?.dpjp || '-',
                  '-',
                  '-',
                  r?.billingAkomodasi || 0,
                  r?.billingTindakan || 0,
                  r?.billingGasMedis || 0,
                  r?.amount || 0,
                  r?.diagnosaUtama || '-'
                ]);
              }
            });
          });
        }

        const sumAkomodasi = (records || []).reduce((s, x) => s + (x?.billingAkomodasi || 0), 0);
        const sumTindakan = (records || []).reduce((s, x) => s + (x?.billingTindakan || 0), 0);
        const sumGasMedis = (records || []).reduce((s, x) => s + (x?.billingGasMedis || 0), 0);
        const sumTotalBilling = (records || []).reduce((s, x) => s + (x?.amount || 0), 0);

        const totalFooterRow = [
          "TOTAL REKAP",
          "-",
          "-",
          "-",
          "-",
          "-",
          "-",
          "-",
          "-",
          "-",
          "-",
          sumAkomodasi,
          sumTindakan,
          sumGasMedis,
          sumTotalBilling,
          "-"
        ];

        const fullData = [...titleBlock, ...finalRows, totalFooterRow];
        const ws = XLSX.utils.aoa_to_sheet(fullData);
        autoFitColumns(ws, fullData);

        const tableHeaderRowIndex = 6;
        const totalRowIndex = tableHeaderRowIndex + finalRows.length + 1;

        applyStylesToSheet(ws, {
          tableHeaderRowIndex,
          boldRowIndices: [totalRowIndex],
          accentSubHeaderRowIndices: smfSubHeaderIndices,
          centerColIndices: [0, 1, 3, 4, 5, 6, 7],
          leftColIndices: [2, 8, 9, 10, 15],
          currencyColIndices: [11, 12, 13, 14]
        });

        return ws;
      } catch (err) {
        console.error("Critical error in buildSheetForCategory for " + sheetName, err);
        const fallbackData = [
          [`TERJADI MASALAH PADA PEMBUATAN TABEL - ${sheetName.toUpperCase()}`],
          ["Sistem mendeteksi data korup atau tidak valid."],
          ["Kesalahan: " + (err instanceof Error ? err.message : String(err))]
        ];
        return XLSX.utils.aoa_to_sheet(fallbackData);
      }
    };

    // Helper to build Doctor Visite sheets (Odd sheets)
    const buildDoctorVisiteSheet = (cbGroupName: string, groupedDoctorAnalysis: Record<string, Record<string, DoctorSMFAnalysisStats>>) => {
      try {
        const cleanCbGroupName = cbGroupName.replace("Pasien ", "").toUpperCase();
        const titleBlock = [
          [`LAPORAN ANALISIS VISITE DOKTER SPESIALIS - PENJAMIN ${cleanCbGroupName}`, "", "", "", "", "", ""],
          ["Unit Pelayanan", currentUser?.unit || "RUANG BEDAH UTAMA", "", "", "", "", ""],
          ["Periode Tanggal", dateFilter || "Semua Waktu", "Filter KSM", selectedKSM, "Filter Dokter", selectedDoctor, ""],
          ["Waktu Pembuatan", new Date().toLocaleString('id-ID'), "", "", "", "", ""],
          [],
          [`TABEL ANALISIS KINERJA & VISITE SMF - ${cleanCbGroupName}`, "", "", "", "", "", ""],
          [
            "No", "Nama Dokter Spesialis", "SMF/KSM", "Jumlah Pasien DPJP Utama", "Visite DPJP Utama+Raberan", "Jumlah Pasien Konsulan", "Status Kepatuhan"
          ]
        ];

        const finalRows: any[][] = [];
        const subHeaderRowIndices: number[] = [];

        const sortedSMFKeys = Object.keys(groupedDoctorAnalysis || {}).sort();

        sortedSMFKeys.forEach(smfKey => {
          try {
            const doctorsMap = groupedDoctorAnalysis[smfKey] || {};
            const docList = Object.values(doctorsMap).sort((a, b) => (a?.doctorName || '').localeCompare(b?.doctorName || ''));

            // Sub-header for the SMF
            const smfSubHeader = Array(7).fill("");
            smfSubHeader[0] = `✦ SMF ${smfKey.toUpperCase()}`;
            
            const rowIndex = titleBlock.length + finalRows.length;
            subHeaderRowIndices.push(rowIndex);
            finalRows.push(smfSubHeader);

            let doctorIndex = 1;
            docList.forEach(doc => {
              if (!doc) return;
              let statusKepatuhan = "PATUH";
              const totalVisits = (doc.dpjpUtamaAndRaberanVisits || 0) + (doc.dpjpKonsulanVisits || 0);
              if (totalVisits === 0) {
                statusKepatuhan = "BELUM AKTIF";
              } else if ((doc.dpjpUtamaAndRaberanVisits || 0) > 5) {
                statusKepatuhan = "SANGAT PATUH (100%)";
              } else {
                statusKepatuhan = "PATUH";
              }

              finalRows.push([
                doctorIndex++,
                doc.doctorName || 'Tanpa Nama',
                `SMF ${smfKey.toUpperCase()}`,
                doc.dpjpUtamaPatients || 0,
                doc.dpjpUtamaAndRaberanVisits || 0,
                doc.dpjpKonsulanPatients || 0,
                statusKepatuhan
              ]);
            });
          } catch (smfErr) {
            console.error("Failed to build doctor rows for SMF:", smfKey, smfErr);
          }
        });

        const totalDpjpUtamaPats = Object.values(groupedDoctorAnalysis || {}).reduce((acc, smfMap) => {
          return acc + Object.values(smfMap || {}).reduce((s, doc) => s + (doc?.dpjpUtamaPatients || 0), 0);
        }, 0);

        const totalDpjpUtamaVisits = Object.values(groupedDoctorAnalysis || {}).reduce((acc, smfMap) => {
          return acc + Object.values(smfMap || {}).reduce((s, doc) => s + (doc?.dpjpUtamaAndRaberanVisits || 0), 0);
        }, 0);

        const totalKonsulanPats = Object.values(groupedDoctorAnalysis || {}).reduce((acc, smfMap) => {
          return acc + Object.values(smfMap || {}).reduce((s, doc) => s + (doc?.dpjpKonsulanPatients || 0), 0);
        }, 0);

        const totalRow = [
          "TOTAL REKAP",
          "-",
          "-",
          totalDpjpUtamaPats,
          totalDpjpUtamaVisits,
          totalKonsulanPats,
          "-"
        ];

        const fullData = [...titleBlock, ...finalRows, totalRow];
        const ws = XLSX.utils.aoa_to_sheet(fullData);
        autoFitColumns(ws, fullData);

        const tableHeaderRowIndex = 6;
        const totalRowIndex = tableHeaderRowIndex + finalRows.length + 1;

        applyStylesToSheet(ws, {
          tableHeaderRowIndex,
          boldRowIndices: [totalRowIndex],
          accentSubHeaderRowIndices: subHeaderRowIndices,
          centerColIndices: [0, 2, 3, 4, 5, 6],
          leftColIndices: [1]
        });

        return ws;
      } catch (err) {
        console.error("Critical error in buildDoctorVisiteSheet for " + cbGroupName, err);
        const fallbackData = [
          [`TERJADI MASALAH PADA TABEL VISITE - ${cbGroupName.toUpperCase()}`],
          ["Sistem mendeteksi data korup atau tidak valid."],
          ["Kesalahan: " + (err instanceof Error ? err.message : String(err))]
        ];
        return XLSX.utils.aoa_to_sheet(fallbackData);
      }
    };

    const getMatchedDoctorAnalysis = (cbGroupName: string) => {
      const combinedSMFGroups: Record<string, Record<string, DoctorSMFAnalysisStats>> = {};

      Object.keys(smfDoctorAnalysis).forEach((cbKey) => {
        if (getTabName(cbKey) === cbGroupName) {
          const smfGroups = smfDoctorAnalysis[cbKey] || {};
          Object.keys(smfGroups).forEach((smfKey) => {
            const doctorsMap = smfGroups[smfKey] || {};
            if (!combinedSMFGroups[smfKey]) {
              combinedSMFGroups[smfKey] = {};
            }
            Object.keys(doctorsMap).forEach((docName) => {
              const stats = doctorsMap[docName];
              if (!combinedSMFGroups[smfKey][docName]) {
                combinedSMFGroups[smfKey][docName] = {
                  doctorName: docName,
                  dpjpUtamaPatients: 0,
                  dpjpUtamaAndRaberanVisits: 0,
                  dpjpKonsulanPatients: 0,
                  dpjpKonsulanVisits: 0
                };
              }
              const target = combinedSMFGroups[smfKey][docName];
              target.dpjpUtamaPatients += stats.dpjpUtamaPatients || 0;
              target.dpjpUtamaAndRaberanVisits += stats.dpjpUtamaAndRaberanVisits || 0;
              target.dpjpKonsulanPatients += stats.dpjpKonsulanPatients || 0;
              target.dpjpKonsulanVisits += stats.dpjpKonsulanVisits || 0;
            });
          });
        }
      });

      return combinedSMFGroups;
    };

    // =========================================================================
    // SHEET 1: Analisis Per Cara Bayar (replaces Executive Summary)
    // =========================================================================
    const rows1: any[] = [
      ["III. ANALISIS PER CARA BAYAR - REKAPITULASI VISITE & KEUANGAN PATIENTS", "", "", "", "", "", "", ""],
      ["Unit Pelayanan", currentUser?.unit || "RUANG BEDAH", "", "", "", "", "", ""],
      ["Periode Tanggal", dateFilter || "Semua Waktu", "", "", "", "", "", ""],
      ["Waktu Pembuatan", new Date().toLocaleString('id-ID'), "", "", "", "", "", ""],
      [],
      ["REKAPITULASI TOTAL PENDAPATAN, PASIEN, & VISITE PER CARA BAYAR", "", "", "", "", "", "", ""],
      ["No", "Cara Pembayaran / Jaminan", "Total Pasien Berobat", "Total Visite (Kali)", "Akomodasi (Rp)", "Tindakan (Rp)", "Gas Medis (Rp)", "Total Billing (Rp)"]
    ];

    caraBayarAnalysis.forEach((item, idx) => {
      const cbLabel = item.caraBayar.toUpperCase().replace(/BPJS KESEHATAN/g, "BPJS").replace(/BPJS KES/g, "BPJS");
      rows1.push([
        idx + 1,
        cbLabel,
        item.patientCount,
        item.visiteCount,
        item.akomodasi,
        item.tindakan,
        item.gasMedis,
        item.totalBilling
      ]);
    });

    const sumPatients1 = caraBayarAnalysis.reduce((s, x) => s + x.patientCount, 0);
    const sumVisits1 = caraBayarAnalysis.reduce((s, x) => s + x.visiteCount, 0);
    const sumAkomodasi1 = caraBayarAnalysis.reduce((s, x) => s + x.akomodasi, 0);
    const sumTindakan1 = caraBayarAnalysis.reduce((s, x) => s + x.tindakan, 0);
    const sumGasMedis1 = caraBayarAnalysis.reduce((s, x) => s + x.gasMedis, 0);
    const sumTotalBilling1 = caraBayarAnalysis.reduce((s, x) => s + x.totalBilling, 0);

    rows1.push([
      "TOTAL KESELURUHAN",
      "-",
      sumPatients1,
      sumVisits1,
      sumAkomodasi1,
      sumTindakan1,
      sumGasMedis1,
      sumTotalBilling1
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet(rows1);
    autoFitColumns(ws1, rows1);
    applyStylesToSheet(ws1, {
      tableHeaderRowIndex: 6,
      isRingkasanEksekutif: true
    });

    addSafeSheet(ws1, "III. Analisis Per Cara Bayar");

    // =========================================================================
    // TABS 2-17: DETIL RINCIAN LOG PATIEN BERDASARKAN 8 METODE CARA BAYAR
    // =========================================================================
    const bpjsRecords = expandedFilteredRecords.filter(r => {
      const cb = String(r.caraBayarSingle || "").toUpperCase();
      return cb === "BPJS" || cb === "BPJS KESEHATAN" || cb === "BPJS KES" || cb.startsWith("BPJS KES") || cb.includes("KESEHATAN") || cb === "JKN" || cb === "BPJS HEALTH";
    });

    const jrRecords = expandedFilteredRecords.filter(r => {
      const cb = String(r.caraBayarSingle || "").toUpperCase();
      return cb === "JASA RAHARJA" || cb === "JR" || cb.includes("RAHARJA") || cb.includes("JASA RAHARJA") || cb === "JASA RAHARJA (JR)";
    });

    const umumRecords = expandedFilteredRecords.filter(r => {
      const cb = String(r.caraBayarSingle || "").toUpperCase();
      return cb === "UMUM" || cb === "MANDIRI" || cb === "CASH" || cb.includes("UMUM") || cb.includes("MANDIRI") || cb.includes("CASH") || cb === "PASIEN UMUM";
    });

    const bpjsTkRecords = expandedFilteredRecords.filter(r => {
      const cb = String(r.caraBayarSingle || "").toUpperCase();
      return cb === "BPJS KETENAGAKERJAAN" || cb === "BPJSTK" || cb === "BPJS TK" || cb.includes("KETENAGAKERJAAN") || cb.includes("BPJS TK") || cb.includes("BPJSTK");
    });

    const tanggunganRecords = expandedFilteredRecords.filter(r => {
      const cb = String(r.caraBayarSingle || "").toUpperCase();
      return cb === "TANGGUNGAN NEGARA" || cb.includes("TANGGUNGAN") || cb.includes("NEGARA");
    });

    const baksosRecords = expandedFilteredRecords.filter(r => {
      const cb = String(r.caraBayarSingle || "").toUpperCase();
      return cb === "BAKSOS" || cb.includes("BAKSOS") || cb.includes("BAKTI SOSIAL") || cb.includes("SOSIAL");
    });

    const asuransiRecords = expandedFilteredRecords.filter(r => {
      const cb = String(r.caraBayarSingle || "").toUpperCase();
      return cb === "ASURANSI SWASTA" || cb.includes("SWASTA") || cb.includes("ASURANSI");
    });

    const lainRecords = expandedFilteredRecords.filter(r => {
      const cb = String(r.caraBayarSingle || "").toUpperCase();
      const isBpjs = cb === "BPJS" || cb === "BPJS KESEHATAN" || cb === "BPJS KES" || cb.startsWith("BPJS KES") || cb.includes("KESEHATAN") || cb === "JKN" || cb === "BPJS HEALTH";
      const isJr = cb === "JASA RAHARJA" || cb === "JR" || cb.includes("RAHARJA") || cb.includes("JASA RAHARJA") || cb === "JASA RAHARJA (JR)";
      const isUmum = cb === "UMUM" || cb === "MANDIRI" || cb === "CASH" || cb.includes("UMUM") || cb.includes("MANDIRI") || cb.includes("CASH") || cb === "PASIEN UMUM";
      const isBpjsTk = cb === "BPJS KETENAGAKERJAAN" || cb === "BPJSTK" || cb === "BPJS TK" || cb.includes("KETENAGAKERJAAN") || cb.includes("BPJS TK") || cb.includes("BPJSTK");
      const isTanggungan = cb === "TANGGUNGAN NEGARA" || cb.includes("TANGGUNGAN") || cb.includes("NEGARA");
      const isBaksos = cb === "BAKSOS" || cb.includes("BAKSOS") || cb.includes("BAKTI SOSIAL") || cb.includes("SOSIAL");
      const isAsuransi = cb === "ASURANSI SWASTA" || cb.includes("SWASTA") || cb.includes("ASURANSI");
      return !isBpjs && !isJr && !isUmum && !isBpjsTk && !isTanggungan && !isBaksos && !isAsuransi;
    });

    // We build the worksheets for 8 payment types
    const bpjsWS = buildSheetForCategory("BPJS", bpjsRecords);
    const bpjsDocWS = buildDoctorVisiteSheet("Pasien BPJS", getMatchedDoctorAnalysis("Pasien BPJS"));

    const umumWS = buildSheetForCategory("UMUM", umumRecords);
    const umumDocWS = buildDoctorVisiteSheet("Pasien Umum", getMatchedDoctorAnalysis("Pasien Umum"));

    const jrWS = buildSheetForCategory("JASA RAHARJA", jrRecords);
    const jrDocWS = buildDoctorVisiteSheet("Pasien Jasaraharja", getMatchedDoctorAnalysis("Pasien Jasaraharja"));

    const bpjsTkWS = buildSheetForCategory("BPJS KETENAGAKERJAAN", bpjsTkRecords);
    const bpjsTkDocWS = buildDoctorVisiteSheet("Pasien BPJS Ketenagakerjaan", getMatchedDoctorAnalysis("Pasien BPJS Ketenagakerjaan"));

    const tanggunganWS = buildSheetForCategory("TANGGUNGAN NEGARA", tanggunganRecords);
    const tanggunganDocWS = buildDoctorVisiteSheet("Pasien Tanggungan Negara", getMatchedDoctorAnalysis("Pasien Tanggungan Negara"));

    const baksosWS = buildSheetForCategory("BAKSOS", baksosRecords);
    const baksosDocWS = buildDoctorVisiteSheet("Pasien Baksos", getMatchedDoctorAnalysis("Pasien Baksos"));

    const asuransiWS = buildSheetForCategory("ASURANSI SWASTA", asuransiRecords);
    const asuransiDocWS = buildDoctorVisiteSheet("Pasien Asuransi Swasta", getMatchedDoctorAnalysis("Pasien Asuransi Swasta"));

    const lainWS = buildSheetForCategory("LAIN-LAIN", lainRecords);
    const lainDocWS = buildDoctorVisiteSheet("Pasien Lain-Lain", getMatchedDoctorAnalysis("Pasien Lain-Lain"));

    // Append exactly in the 17-sheet sequence requested:
    // Sheet 2 & 3
    addSafeSheet(bpjsWS, "Pasien BPJS");
    addSafeSheet(bpjsDocWS, "Data Visite BPJS");

    // Sheet 4 & 5
    addSafeSheet(umumWS, "Pasien Umum");
    addSafeSheet(umumDocWS, "Data Visite Umum");

    // Sheet 6 & 7
    addSafeSheet(jrWS, "Pasien Jasaraharja");
    addSafeSheet(jrDocWS, "Data Visite Jasaraharja");

    // Sheet 8 & 9
    addSafeSheet(bpjsTkWS, "Pasien BPJS Ketenagakerjaan");
    addSafeSheet(bpjsTkDocWS, "Data Visite BPJS Ketenagakerjaan");

    // Sheet 10 & 11
    addSafeSheet(tanggunganWS, "Pasien Tanggungan Negara");
    addSafeSheet(tanggunganDocWS, "Data Visite Tanggungan Negara");

    // Sheet 12 & 13
    addSafeSheet(baksosWS, "Pasien Baksos");
    addSafeSheet(baksosDocWS, "Data Visite Baksos");

    // Sheet 14 & 15
    addSafeSheet(asuransiWS, "Pasien Asuransi Swasta");
    addSafeSheet(asuransiDocWS, "Data Visite Asuransi Swasta");

    // Sheet 16 & 17
    addSafeSheet(lainWS, "Pasien Lain-Lain");
    addSafeSheet(lainDocWS, "Data Visite Lain-Lain");

      // Save multi-sheet pristine report with exactly 17 tabs
      XLSX.writeFile(wb, `LAPORAN_BPL_REKAP_KEUANGAN_17TAB_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err: any) {
      console.error("Critical Excel construction error:", err);
      alert("Gagal mengekspor berkas Excel. Pesan kesalahan: " + (err?.message || err || "unknown error"));
    }
  };

  // Excel / CSV File Parsing & Merging
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const parseExcelOrCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Header array representational read directly
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
        
        if (jsonData.length <= 1) {
          alert('Template data kosong atau baris header tidak valid!');
          return;
        }

        // Search for relevant column headers with extreme flexibility
        const headers = (jsonData[0] as string[]).map(h => String(h || '').trim().toLowerCase());
        
        const findColumnIndex = (terms: string[]) => {
          return headers.findIndex(h => terms.some(term => h.includes(term)));
        };

        const dateIdx = findColumnIndex(['tanggal', 'tgl', 'date', 'pulang']);
        const nameIdx = findColumnIndex(['nama', 'patient', 'pasien']);
        const rmIdx = findColumnIndex(['rm', 'rekam', 'record', 'no rm']);
        const dpjpIdx = findColumnIndex(['dpjp', 'dokter', 'doctor', 'operator']);
        const ksmIdx = findColumnIndex(['ksm', 'smf', 'department', 'spesialis']);
        const visitsIdx = findColumnIndex(['visite', 'kunjungan', 'visits', 'jml']);
        const akomodasiIdx = findColumnIndex(['akomodasi', 'accommodation', 'kamar']);
        const tindakanIdx = findColumnIndex(['tindakan', 'treatment', 'prosedur', 'operasi']);
        const gasMedisIdx = findColumnIndex(['gas', 'oksigen', 'medis', 'gas medis']);
        const amountIdx = findColumnIndex(['total', 'amount', 'billing', 'jumlah']);
        const caraBayarIdx = findColumnIndex(['cara bayar', 'jaminan', 'payor', 'payment', 'pembayaran']);

        const importedRecords: FinanceRecord[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0 || row.every(cell => cell === null || cell === '')) {
            continue;
          }

          const parsedDate = dateIdx !== -1 && row[dateIdx] 
            ? String(row[dateIdx]).trim() 
            : new Date().toISOString().split('T')[0];
            
          const parsedName = nameIdx !== -1 && row[nameIdx] 
            ? String(row[nameIdx]).trim() 
            : 'Pasien Umum / Non-RM';
            
          const parsedRM = rmIdx !== -1 && row[rmIdx] 
            ? String(row[rmIdx]).trim() 
            : '';
            
          const parsedDpjp = dpjpIdx !== -1 && row[dpjpIdx] 
            ? String(row[dpjpIdx]).trim() 
            : 'Dokter Umum';
            
          const parsedKsm = ksmIdx !== -1 && row[ksmIdx] 
            ? String(row[ksmIdx]).trim() 
            : 'Umum';

          let parsedVisits = visitsIdx !== -1 && row[visitsIdx] ? parseFloat(row[visitsIdx]) : 1;
          if (isNaN(parsedVisits)) parsedVisits = 1;

          const parseMoney = (cellVal: any) => {
            if (cellVal === undefined || cellVal === null) return 0;
            const cleanedStr = String(cellVal).replace(/[^0-9.-]+/g, "");
            const val = parseFloat(cleanedStr);
            return isNaN(val) ? 0 : val;
          };

          const billingAkomodasi = akomodasiIdx !== -1 ? parseMoney(row[akomodasiIdx]) : 0;
          const billingTindakan = tindakanIdx !== -1 ? parseMoney(row[tindakanIdx]) : 0;
          const billingGasMedis = gasMedisIdx !== -1 ? parseMoney(row[gasMedisIdx]) : 0;
          
          let amount = amountIdx !== -1 ? parseMoney(row[amountIdx]) : (billingAkomodasi + billingTindakan + billingGasMedis);
          if (amount === 0) amount = billingAkomodasi + billingTindakan + billingGasMedis;

          let parsedCaraBayar = caraBayarIdx !== -1 && row[caraBayarIdx]
            ? String(row[caraBayarIdx]).trim()
            : 'BPJS';
          // Normalize to BPJS if BPJS Kesehatan/KES etc is specified
          parsedCaraBayar = parsedCaraBayar.replace(/bpjs\s+kesehatan/gi, "BPJS")
                                           .replace(/bpjs\s+kes/gi, "BPJS");

          const newFinanceRecord: FinanceRecord = {
            id: `excel_import_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
            type: 'INCOME',
            date: parsedDate,
            dischargeDate: parsedDate,
            patientName: parsedName,
            noRM: parsedRM,
            dpjp: parsedDpjp,
            ksm: parsedKsm,
            numVisites: parsedVisits,
            billingAkomodasi,
            billingTindakan,
            billingGasMedis,
            amount,
            caraBayar: parsedCaraBayar,
            category: 'Visite & Billing Pasien Pulang',
            recordedBy: currentUser?.name || 'Excel Auto Import',
            unit: currentUser?.unit || 'Umum',
            description: 'Diimport lewat berkas Excel/CSV'
          };

          importedRecords.push(newFinanceRecord);
        }

        if (importedRecords.length > 0) {
          if (onImportRecords) {
            onImportRecords(importedRecords);
          } else {
            importedRecords.forEach(rec => onAddRecord(rec));
          }
          setImportSummary({
            success: importedRecords.length,
            records: importedRecords
          });
          setTimeout(() => {
            setImportSummary(null);
            setShowImportArea(false);
          }, 4000);
        } else {
          alert('Baris data valid tidak terdeteksi dalam lembar kerja.');
        }
      } catch (err: any) {
        alert('Gagal mengimpor file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
        parseExcelOrCsv(file);
      } else {
        alert('Format file tidak didukung! Unggah hanya berkas berekstensi .xlsx, .xls, atau .csv');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseExcelOrCsv(e.target.files[0]);
    }
  };

  const activePeriodText = (startDate || endDate) ? `${startDate || ''} s/d ${endDate || ''}` : "SEMUA WAKTU";

  return (
    <div id="finance-billing-container" className="space-y-8 text-slate-800">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] border shadow-sm border-l-8 border-l-[#144272]">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 flex items-center gap-3">
            <FileText className="text-[#144272]" size={28} /> LAPORAN VISITE & KEUANGAN PATIENTS
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            ENTRY DATA VISITE DAN TOTAL BILLING PASIEN PULANG PER TANGGAL PELAYANAN
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button 
            onClick={() => setShowForm(!showForm)} 
            className="bg-[#144272] hover:bg-[#1d5b9c] text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
          >
            <Plus size={16} /> {showForm ? 'Tutup Form' : 'Entry Pasien Pulang'}
          </Button>
          <Button 
            onClick={() => setShowImportArea(!showImportArea)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-md"
          >
            <Upload size={14} /> {showImportArea ? 'Tutup Impor' : 'Impor Excel/CSV'}
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setShowExportModal(true)}
            className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 border bg-white hover:bg-slate-50 text-slate-700"
          >
            <Download size={14} /> Export Excel Rapi
          </Button>
        </div>
      </div>

      {/* Export Options Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 border border-slate-100 shadow-2xl relative overflow-hidden animate-scale-up text-slate-800">
            <div className="absolute top-0 left-0 w-full h-2 bg-[#144272]"></div>
            
            <h3 className="text-sm font-black text-[#144272] uppercase tracking-widest mb-4 flex items-center gap-2">
              <Download size={18} /> Opsi Ekspor Laporan Excel
            </h3>
            
            <p className="text-xs text-slate-500 font-bold mb-6">
              Silakan pilih cakupan data untuk format 17 Sheet Excel yang akan diekstrak:
            </p>
            
            <div className="space-y-3 mb-8">
              {/* Option 1: Active Range */}
              <label className="flex items-start gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border cursor-pointer transition-all">
                <input 
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'range'}
                  onChange={() => setExportMode('range')}
                  className="mt-1 text-[#144272] focus:ring-[#144272]"
                />
                <div className="flex-1">
                  <span className="text-xs font-black text-slate-700 block uppercase tracking-wide">Rentang Tanggal Aktif</span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    Mengekspor data sesuai filter aktif di halaman ({startDate || endDate ? `${startDate || ''} s/d ${endDate || ''}` : 'Semua Waktu'})
                  </span>
                </div>
              </label>

              {/* Option 2: Month & Year */}
              <label className="flex items-start gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border cursor-pointer transition-all">
                <input 
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'monthYear'}
                  onChange={() => setExportMode('monthYear')}
                  className="mt-1 text-[#144272] focus:ring-[#144272]"
                />
                <div className="flex-1 space-y-3">
                  <div>
                    <span className="text-xs font-black text-slate-700 block uppercase tracking-wide">Pilih Bulan & Tahun</span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      Mengekspor seluruh dataset dari database untuk bulan & tahun pelayanan tertentu.
                    </span>
                  </div>
                  
                  {exportMode === 'monthYear' && (
                    <div className="grid grid-cols-2 gap-2 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <span className="text-[8px] text-slate-400 font-black block mb-1">BULAN</span>
                        <select
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-[#144272]"
                          value={exportMonth}
                          onChange={(e) => setExportMonth(Number(e.target.value))}
                        >
                          {MONTHS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 font-black block mb-1">TAHUN</span>
                        <select
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-[#144272]"
                          value={exportYear}
                          onChange={(e) => setExportYear(Number(e.target.value))}
                        >
                          {availableYears.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider"
              >
                Batal
              </Button>
              <Button 
                onClick={() => {
                  setShowExportModal(false);
                  exportToExcelRapi();
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md"
              >
                <Download size={12} /> Unduh Excel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Drag & Drop Interactive Excel Upload Section */}
      {showImportArea && (
        <div 
          className={`p-8 rounded-[2rem] border-2 border-dashed bg-white shadow-xl transition-all ${dragActive ? 'border-[#144272] bg-blue-50/10' : 'border-slate-200'} animate-fade-in`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <FileSpreadsheet size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">Unggah Lembar Kerja Excel atau CSV</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Tarik-lepas berkas Anda di sini atau cari dari folder penyimpanan perangkat.
              </p>
            </div>

            {/* Simulated file selector click */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              onChange={handleFileChange}
            />
            
            <div className="pt-2">
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#144272] hover:bg-[#1d5b9c] text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest"
              >
                Pilih Berkas Komputer
              </Button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Format Header Rekomendasi:</p>
              <p className="text-[10px] text-slate-500 mt-1 font-bold leading-normal">
                <span className="text-[#144272] font-black">Tanggal</span> | <span className="text-[#144272] font-black">Nama Pasien</span> | <span className="text-[#144272] font-black">No RM</span> | <span className="text-[#144272] font-black">DPJP Dokter</span> | <span className="text-[#144272] font-black">KSM</span> | <span className="text-[#144272] font-black">Visite</span> | <span className="text-[#144272] font-black">Akomodasi</span> | <span className="text-[#144272] font-black">Tindakan</span> | <span className="text-[#144272] font-black">Gas Medis</span>
              </p>
              <p className="text-[9px] text-slate-400 italic mt-2">
                *Sistem kami cerdas untuk memahami bahasa pemformatan Rupiah dan menyesuaikan letak kolom secara otomatis.
              </p>
            </div>

            {importSummary && (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 flex items-center justify-center gap-3 animate-bounce">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Berhasil mengintegrasikan {importSummary.success} rekam data visite/billing baru!
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-indigo-600">
          <span className="text-[9px] font-black uppercase text-indigo-400 tracking-widest block">Total Billing Terpilih</span>
          <h3 className="text-2xl font-black text-indigo-700 mt-2">Rp {aggregatedStats.totalBilling.toLocaleString('id-ID')}</h3>
          <span className="text-[9px] text-slate-400 font-bold block mt-1">Sinergi akomodasi, tindakan & gas medis</span>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-teal-600">
          <span className="text-[9px] font-black uppercase text-teal-400 tracking-widest block">Total Visites Dokter</span>
          <h3 className="text-2xl font-black text-teal-700 mt-2">{aggregatedStats.visites} Kunjungan</h3>
          <span className="text-[9px] text-slate-400 font-bold block mt-1">Terhitung dari entrian perawat</span>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-amber-500">
          <span className="text-[9px] font-black uppercase text-amber-500 tracking-widest block">Akomodasi & Gas Medis</span>
          <div className="flex justify-between items-center mt-2">
            <div>
              <span className="text-[8px] text-slate-400 font-black block">AKOMODASI</span>
              <span className="text-sm font-black text-slate-700">Rp {aggregatedStats.akomodasi.toLocaleString('id-ID')}</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] text-slate-400 font-black block">GAS MEDIS</span>
              <span className="text-sm font-black text-slate-700">Rp {aggregatedStats.gasMedis.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-emerald-600">
          <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest block">Total Tindakan</span>
          <h3 className="text-2xl font-black text-emerald-700 mt-2">Rp {aggregatedStats.tindakan.toLocaleString('id-ID')}</h3>
          <span className="text-[9px] text-slate-400 font-bold block mt-1">Intervensi klinis pasca-operasi</span>
        </div>
      </div>

      {/* Entry Form */}
      {showForm && (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/25 p-8 rounded-3xl border shadow-md animate-fade-in text-slate-800">
          <div className="max-w-4xl mx-auto">
            <h3 className="font-black text-[#144272] text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
              <Stethoscope size={18} /> {newRecord.id ? 'FORM EDIT DATA VISITE & BILLING PASIEN' : 'FORM ENTRY DATA VISITE & BILLING PASIEN PULANG'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Filter Tanggal Pasien Pulang */}
              <div className="md:col-span-12 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-[#144272] uppercase tracking-wider mb-1">Filter Pasien Keluar Berdasarkan Tanggal</h4>
                  <p className="text-[10px] text-slate-500 font-bold">Hanya pasien yang pulang pada tanggal di samping yang akan muncul sebagai opsi pilihan di bawah.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest shrink-0">Tanggal Pulang:</span>
                  <input
                    type="date"
                    className="border border-blue-200 bg-white rounded-xl px-3 py-1.5 text-xs font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-[#144272]"
                    value={patientDischargeFilterDate}
                    onChange={e => {
                      setPatientDischargeFilterDate(e.target.value);
                      setNewRecord(prev => ({ ...prev, date: e.target.value, dischargeDate: e.target.value }));
                    }}
                  />
                  {patientDischargeFilterDate && patientDischargeFilterDate !== new Date().toISOString().split('T')[0] && (
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setPatientDischargeFilterDate(today);
                        setNewRecord(prev => ({ ...prev, date: today, dischargeDate: today }));
                      }}
                      className="text-[9px] font-black text-rose-600 px-2 py-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all"
                    >
                      RESET KE HARI INI
                    </button>
                  )}
                </div>
              </div>

              {/* Draft Antrean Posting Panel */}
              <div className="md:col-span-12 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Antrean Draft Transaksi Keuangan</span>
                  </div>
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-widest">
                    {eligibleDraftPatients.length} Pasien Belum Diposting
                  </span>
                </div>

                {eligibleDraftPatients.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Tidak ada antrean draft transaksi pada tanggal ini ({patientDischargeFilterDate})</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    {eligibleDraftPatients.map(p => {
                      // Aggregate visits from nursing doctorVisits for this patient
                      const visits = (doctorVisits || []).filter(v => v.patientId === p.id);
                      const groupByNameAndRole = (visits || []).reduce((acc: {[key: string]: {count: number, role: string}}, curr) => {
                        const key = curr.doctorName || 'Tanpa Nama';
                        if (!acc[key]) {
                          acc[key] = { count: 0, role: curr.role || 'DPJP' };
                        }
                        acc[key].count += 1;
                        return acc;
                      }, {});

                      const listStr = Object.entries(groupByNameAndRole)
                        .map(([docName, d]: [string, any]) => `${docName} (${d.count}x visite)` )
                        .join(', ');

                      return (
                        <div key={`draft-${p.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/50 hover:bg-indigo-50/20 border border-slate-150 hover:border-indigo-100 rounded-xl transition-all gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{p.name}</span>
                              <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-widest">RM: {p.noRM}</span>
                              <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md uppercase tracking-widest">{p.statusDataPasien || 'Keluar'}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold">
                              Asal: <span className="text-slate-800">{p.ruangan} (Bed: {p.nomorBed})</span> | Dirawat: <span className="text-slate-800">{p.jmlHariRawat || 1} hari</span>
                            </p>
                            {listStr ? (
                              <p className="text-[10px] text-emerald-700 font-extrabold mt-1">
                                🩺 Draft Visite Keperawatan: <span className="italic font-bold text-emerald-800">{listStr}</span>
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-400 font-bold mt-1">
                                🩺 Belum ada catatan visite dokter di sistem keperawatan.
                              </p>
                            )}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                handlePatientChange(p.id);
                                setLoadedDraftPatientId(p.id);
                              }}
                              className="w-full sm:w-auto px-4 py-2 bg-[#144272] hover:bg-[#1d5b9c] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                            >
                              Review & Posting Draft
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {loadedDraftPatientId && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0 animate-pulse"></div>
                    <span>Draft untuk {patients.find(pt => pt.id === loadedDraftPatientId)?.name} berhasil dimuat ke Form di bawah. Silahkan periksa dan klik "Posting Data Keuangan" untuk menyimpan.</span>
                  </div>
                )}
              </div>

              {/* Patient Selection */}
              <div className="md:col-span-12">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Pilih Pasien Pulang</label>
                <SearchableSelect
                  placeholder="-- PILIH PASIEN (ANTREAN PASIEN KELUAR AKTIF) --"
                  options={patients
                    .filter(p => {
                      if (newRecord.id && p.id === newRecord.patientId) return true;

                      // a. Rule Tanggal Berjalan: must match the selected date strictly.
                      if (!patientDischargeFilterDate) return false;
                      const matchesDischargeDate = p.dischargeDate === patientDischargeFilterDate;
                      if (!matchesDischargeDate) return false;

                      // Deep discharge status match matching the 5 requested status categories (BPL, APS, Meninggal, Rujuk, Pindah Ke Ruangan Lain)
                      const st = (p.statusDataPasien || '').toUpperCase().trim();
                      const keywords = [
                        "BPL", "PULANG", "SEMBUH", 
                        "APS", "ATAS PERMINTAAN SENDIRI", 
                        "MENINGGAL", "WAFAT", 
                        "RUJUK", 
                        "TRANSFER", "PINDAH"
                      ];
                      const isDischargedOrStatus = keywords.some(kw => st.includes(kw)) || p.status === 'DISCHARGED';
                      if (!isDischargedOrStatus) return false;

                      // b. Rule Selesai Entry: if a billing/visite record on that date is already entered, exclude it.
                      const alreadyAdded = (records || []).some(
                        r => r.patientId === p.id && r.date === patientDischargeFilterDate
                      );
                      if (alreadyAdded) return false;

                      return true;
                    })
                    .map(p => ({
                      value: p.id,
                      label: `${p.noRM} - ${p.name.toUpperCase()} [${p.ruangan || 'Tanpa Ruangan'}] (${p.statusDataPasien || p.status}) ${p.dischargeDate ? `| Pulang: ${p.dischargeDate}` : ''}`
                    }))
                  }
                  value={newRecord.patientId || ''}
                  onChange={val => handlePatientChange(val)}
                />
              </div>

              {/* Tanggal Pelayanan */}
              <div className="md:col-span-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Tanggal Pelayanan / Pulang</label>
                <input 
                  required
                  type="date" 
                  className="w-full border border-slate-200 bg-white rounded-xl p-3 text-xs font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-[#144272]" 
                  value={newRecord.date} 
                  onChange={e => setNewRecord({...newRecord, date: e.target.value, dischargeDate: e.target.value})}
                />
              </div>

              {/* Cara Bayar */}
              <div className="md:col-span-12">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Cara Bayar (Dapat Pilih Lebih Dari Satu)</label>
                <div className="flex flex-wrap gap-2">
                  {(masterData.refs?.caraBayar || []).map((cb: string) => {
                    const isSel = isMethodSelected(cb);
                    return (
                      <button
                        type="button"
                        key={cb}
                        onClick={() => toggleMethod(cb)}
                        className={`px-3 py-2 text-xs font-bold rounded-xl transition-all border ${
                          isSel 
                            ? 'bg-[#144272] border-[#144272] text-white shadow-sm font-black' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {cb}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Pasien Keluar */}
              <div className="md:col-span-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Status Pasien Keluar</label>
                <select
                  required
                  className="w-full border border-slate-200 bg-white rounded-xl p-3 text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#144272]"
                  value={newRecord.statusDataPasien || ''}
                  onChange={e => setNewRecord({...newRecord, statusDataPasien: e.target.value})}
                >
                  <option value="BPL">BPL (Berobat Jalan / Pulang)</option>
                  <option value="APS">APS (Atas Permintaan Sendiri)</option>
                  <option value="Meninggal">Meninggal</option>
                  <option value="Pindah Ruangan">Pindah Ruangan</option>
                  <option value="Rujuk">Rujuk</option>
                </select>
              </div>

              {/* Nomor SEP */}
              <div className="md:col-span-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Nomor SEP</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 bg-white rounded-xl p-3 text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#144272]"
                  placeholder="Masukkan Nomor SEP..."
                  value={newRecord.noSEP || ''}
                  onChange={e => setNewRecord({...newRecord, noSEP: e.target.value})}
                />
              </div>

              {/* Jml Hari Rawat */}
              <div className="md:col-span-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Jumlah Hari Rawat</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-slate-200 bg-white rounded-xl p-3 text-xs font-black shadow-sm focus:outline-none focus:ring-2 focus:ring-[#144272]"
                  value={newRecord.jmlHariRawat || 1}
                  onChange={e => setNewRecord({...newRecord, jmlHariRawat: Number(e.target.value)})}
                />
              </div>

              {/* KSM / SMF */}
              <div className="md:col-span-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">KSM / SMF Pasien</label>
                <SearchableSelect
                  placeholder="-- PILIH KSM --"
                  options={ksmList}
                  value={newRecord.ksm || ''}
                  onChange={val => setNewRecord({...newRecord, ksm: val})}
                />
              </div>

              {/* Diagnosa Utama */}
              <div className="md:col-span-12">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Diagnosa Utama (Ketik Bebas / Pilih)</label>
                <input
                  required
                  type="text"
                  list="diagnosa-suggestions"
                  placeholder="Ketik diagnosa medis ICD-10 secara bebas atau pilih..."
                  className="w-full border border-slate-200 bg-white rounded-xl p-3 text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#144272]"
                  value={newRecord.diagnosaUtama || ''}
                  onChange={e => setNewRecord({...newRecord, diagnosaUtama: e.target.value})}
                />
                <datalist id="diagnosa-suggestions">
                  {STANDAR_ICD10.map(icd => (
                    <option key={icd} value={icd} />
                  ))}
                </datalist>
              </div>

              {/* Multi-Doctor Entry Block */}
              <div className="md:col-span-12 border-t border-slate-100 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="text-xs font-black text-[#144272] uppercase tracking-wider">Daftar DPJP & Visite/Konsul Dokter</h4>
                    <p className="text-[10px] text-slate-400 font-bold block mt-0.5">Entri DPJP Utama, Raberan, atau Konsul untuk membagi rekap kunjungan.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormDoctorCharges([...formDoctorCharges, { doctorName: '', count: 1, role: 'DPJP_UTAMA' }])}
                    className="px-3 py-1.5 bg-[#144272]/5 text-[#144272] hover:bg-[#144272]/10 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all outline-none cursor-pointer border-none"
                  >
                    <Plus size={12} /> Tambah Dokter
                  </button>
                </div>

                <div className="space-y-3">
                  {formDoctorCharges.map((charge, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row items-center gap-3 bg-[#144272]/5 p-4 rounded-2xl border border-[#144272]/10">
                      <div className="w-full md:w-1/4">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Peran Dokter</label>
                        <select
                          required
                          className="w-full border border-slate-200 bg-white rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#144272]"
                          value={charge.role}
                          onChange={e => {
                            const updated = [...formDoctorCharges];
                            updated[idx].role = e.target.value as any;
                            setFormDoctorCharges(updated);
                          }}
                        >
                          <option value="DPJP_UTAMA">DPJP UTAMA</option>
                          <option value="DPJP_RABERAN">DPJP RABERAN (RAWAT BERSAMA)</option>
                          <option value="DPJP_KONSULAN">DPJP KONSULAN (KONSUL TO)</option>
                        </select>
                      </div>

                      <div className="w-full md:w-1/2">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Dokter DPJP</label>
                        <SearchableSelect
                          placeholder="-- PILIH DOKTER --"
                          options={masterData.doctors}
                          value={charge.doctorName}
                          onChange={val => {
                            const updated = [...formDoctorCharges];
                            updated[idx].doctorName = val;
                            setFormDoctorCharges(updated);
                          }}
                        />
                      </div>

                      <div className="w-full md:w-24">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Kunjungan/Kali</label>
                        <input
                          required
                          type="number"
                          min="0"
                          className="w-full border border-slate-200 bg-white rounded-xl p-2 text-xs font-black focus:outline-none text-center"
                          value={charge.count}
                          onChange={e => {
                            const updated = [...formDoctorCharges];
                            updated[idx].count = Number(e.target.value);
                            setFormDoctorCharges(updated);
                          }}
                        />
                      </div>

                      {formDoctorCharges.length > 1 && (
                        <div className="pt-4 md:pt-0">
                          <button
                            type="button"
                            onClick={() => setFormDoctorCharges(formDoctorCharges.filter((_, i) => i !== idx))}
                            className="p-2 text-red-650 hover:bg-slate-200 rounded-xl transition-all outline-none cursor-pointer mt-2"
                            title="Hapus Dokter"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing Akomodasi */}
              <div className="md:col-span-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Akomodasi Billing (IDR)</label>
                <input 
                  type="number" 
                  min="0"
                  className="w-full border border-slate-200 bg-white rounded-xl p-3 text-xs font-bold shadow-sm" 
                  placeholder="0" 
                  value={newRecord.billingAkomodasi} 
                  onChange={e => setNewRecord({...newRecord, billingAkomodasi: Number(e.target.value)})}
                />
              </div>

              {/* Billing Tindakan */}
              <div className="md:col-span-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Tindakan Billing (IDR)</label>
                <input 
                  type="number" 
                  min="0"
                  className="w-full border border-slate-200 bg-white rounded-xl p-3 text-xs font-bold shadow-sm" 
                  placeholder="0" 
                  value={newRecord.billingTindakan} 
                  onChange={e => setNewRecord({...newRecord, billingTindakan: Number(e.target.value)})}
                />
              </div>

              {/* Billing Gas Medis */}
              <div className="md:col-span-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Gas Medis Billing (IDR)</label>
                <input 
                  type="number" 
                  min="0"
                  className="w-full border border-slate-200 bg-white rounded-xl p-3 text-xs font-bold shadow-sm" 
                  placeholder="0" 
                  value={newRecord.billingGasMedis} 
                  onChange={e => setNewRecord({...newRecord, billingGasMedis: Number(e.target.value)})}
                />
              </div>

              {/* Visualized Total Banner */}
              <div className="md:col-span-12 bg-[#144272]/5 p-5 rounded-2xl flex justify-between items-center border border-dashed border-[#144272]/25">
                <div>
                  <span className="text-[10px] font-black text-[#144272] uppercase tracking-widest">Dinamika Total Billing</span>
                  <p className="text-[10px] text-slate-400 font-bold block mt-1">Dihitung otomatis: Akomodasi + Tindakan + Gas Medis</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#144272]">Rp {calculatedTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="md:col-span-12 flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowForm(false);
                    // Reset editing states cleanly
                    setNewRecord({
                      id: '',
                      type: 'INCOME',
                      date: new Date().toISOString().split('T')[0],
                      amount: 0,
                      category: 'Visite & Billing Pasien Pulang',
                      description: '',
                      ksm: '',
                      dpjp: '',
                      numVisites: 1,
                      billingAkomodasi: 0,
                      billingTindakan: 0,
                      billingGasMedis: 0,
                      dischargeDate: new Date().toISOString().split('T')[0],
                      unit: currentUser?.unit || '',
                      noSEP: '',
                      ruangRawatAsal: '',
                      entryDate: '',
                      jmlHariRawat: 1,
                      diagnosaUtama: '',
                      caraBayar: 'BPJS',
                      statusDataPasien: 'BPL'
                    });
                    setFormDoctorCharges([{ doctorName: '', count: 1, role: 'DPJP_UTAMA' }]);
                    setLoadedDraftPatientId(null);
                  }} 
                  className="px-8 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors font-bold text-xs uppercase text-slate-500 cursor-pointer outline-none shadow-sm"
                >
                  Batal
                </button>
                <Button type="submit" className="bg-[#144272] hover:bg-[#1d5b9c] text-white px-10 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">
                  {newRecord.id ? 'Perbarui & Posting Data Keuangan' : 'Posting Data Keuangan'}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Spreadsheet Search and Filter Layout */}
      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Search */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cari Pasien / Dokter / RM</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Ketik RM atau nama..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black outline-none focus:ring-2 focus:ring-[#144272]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* KSM Filter */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Filter KSM</label>
          <SearchableSelect
            options={['Semua KSM'].concat(ksmList)}
            value={selectedKSM}
            onChange={val => setSelectedKSM(val)}
          />
        </div>

        {/* Doctor Filter */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Filter Dokter DPJP</label>
          <SearchableSelect
            options={['Semua Dokter'].concat(masterData.doctors)}
            value={selectedDoctor}
            onChange={val => setSelectedDoctor(val)}
          />
        </div>

        {/* Date Filter Range */}
        <div className="space-y-2 col-span-1 md:col-span-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Pelayanan</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[8px] text-slate-400 font-black block mb-1">DARI TANGGAL</span>
              <input 
                type="date"
                id="start_date"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-[#144272]"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <span className="text-[8px] text-slate-400 font-black block mb-1">SAMPAI TANGGAL</span>
              <input 
                type="date"
                id="end_date"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-[#144272]"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-[9px] font-black text-rose-600 uppercase mt-1 ml-1 hover:underline block text-left"
            >
              × Bersihkan Filter Tanggal
            </button>
          )}
        </div>

      </div>

      {/* Tab Switcher for Rich Analytical Spreadsheets */}
      <div className="flex flex-wrap border-b border-slate-200 mt-4 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('rincian')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-xs uppercase tracking-wider transition-all border-b-2 outline-none cursor-pointer ${
            activeTab === 'rincian'
              ? 'border-[#144272] text-[#144272] bg-[#144272]/5'
              : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          <Layers size={14} /> I. Rincian Laporan Visite & Billing
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('smf')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-xs uppercase tracking-wider transition-all border-b-2 outline-none cursor-pointer ${
            activeTab === 'smf'
              ? 'border-[#144272] text-[#144272] bg-[#144272]/5'
              : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          <Stethoscope size={14} /> II. Analisis Per SMF Dokter
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cara-bayar')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-xs uppercase tracking-wider transition-all border-b-2 outline-none cursor-pointer ${
            activeTab === 'cara-bayar'
              ? 'border-[#144272] text-[#144272] bg-[#144272]/5'
              : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          <Coins size={14} /> III. Analisis Per Cara Bayar
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pasien-keluar')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-xs uppercase tracking-wider transition-all border-b-2 outline-none cursor-pointer ${
            activeTab === 'pasien-keluar'
              ? 'border-[#144272] text-[#144272] bg-[#144272]/5'
              : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          <PieChart size={14} /> IV. Pasien Keluar Per Hari
        </button>
      </div>

      {/* Spreadsheet Presentation Panel */}
      <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {activeTab === 'rincian' && (
            <div className="flex flex-col gap-8 p-4 bg-slate-50/50">
              {Object.keys(recordsByCaraBayar).length === 0 ? (
                <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest italic bg-white rounded-3xl border border-dashed">
                  Belum ada data entry visite & billing pasien pulang.
                </div>
              ) : (
                (Object.entries(recordsByCaraBayar) as [string, any[]][]).map(([caraBayar, recList]) => {
                  const sortedRecList = [...recList].sort((a,b) => compareDatesSafe(a.date, b.date, true));
                  
                  // Compute stats for this Cara Bayar
                  const cbStats = sortedRecList.reduce((acc, curr) => {
                    acc.akomodasi += curr.billingAkomodasi || 0;
                    acc.tindakan += curr.billingTindakan || 0;
                    acc.gasMedis += curr.billingGasMedis || 0;
                    acc.totalBilling += curr.amount || 0;
                    
                    const chargeVisites = curr.doctorCharges && curr.doctorCharges.length > 0
                      ? curr.doctorCharges.reduce((s, c) => s + c.count, 0)
                      : curr.numVisites || 0;
                    acc.visites += chargeVisites;
                    return acc;
                  }, { akomodasi: 0, tindakan: 0, gasMedis: 0, totalBilling: 0, visites: 0 });

                  return (
                    <div key={caraBayar} className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                      <div className="px-6 py-4 bg-gradient-to-r from-[#144272] to-[#1e5894] text-white flex justify-between items-center">
                        <div>
                          <h4 className="font-extrabold text-xs uppercase tracking-wide">RINCIAN VISITE & BILLING</h4>
                          <p className="text-[10px] text-indigo-100 font-bold mt-0.5 uppercase">JAMINAN / CARA BAYAR: {caraBayar}</p>
                        </div>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-wider">
                          {recList.length} Pasien
                        </span>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] border-collapse text-left">
                          <thead className="bg-[#144272]/5 text-[#144272] border-b font-black uppercase tracking-wider">
                            <tr>
                              <th className="p-3 border-r text-center w-10">No</th>
                              <th className="p-3 border-r">Tgl Pulang</th>
                              <th className="p-3 border-r">SEP & Pasien & RM</th>
                              <th className="p-3 border-r">Ruangan & Hari</th>
                              <th className="p-3 border-r">DPJP Utama & Visite</th>
                              <th className="p-3 border-r">DPJP Raberan</th>
                              <th className="p-3 border-r">DPJP Konsulan</th>
                              <th className="p-3 border-r text-right">Akomodasi (Rp)</th>
                              <th className="p-3 border-r text-right">Tindakan (Rp)</th>
                              <th className="p-3 border-r text-right">Gas Medis (Rp)</th>
                              <th className="p-3 border-r text-right bg-[#144272]/10 text-indigo-900">Total (Rp)</th>
                              <th className="p-3 border-r">Diagnosa</th>
                              {onDeleteRecord && <th className="p-3 text-center w-12 mr-1">Aksi</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(() => {
                              // Group elements of sortedRecList by SMF
                              const groupedBySMF: Record<string, typeof sortedRecList> = {};
                              sortedRecList.forEach(r => {
                                const smfName = getKsmForRecord(r);
                                if (!groupedBySMF[smfName]) {
                                  groupedBySMF[smfName] = [];
                                }
                                groupedBySMF[smfName].push(r);
                              });

                              // Sort SMF names alphabetically
                              const sortedSMFNames = Object.keys(groupedBySMF).sort();
                              
                              let globalRowIdx = 0;

                              return sortedSMFNames.map(smfName => {
                                const smfRecords = groupedBySMF[smfName];
                                return (
                                  <React.Fragment key={`smf-group-view-${smfName}`}>
                                    {/* SMF Section Row (Oranye #FF7F00 styling) */}
                                    <tr className="bg-orange-50 border-y border-orange-100/60 select-none">
                                      <td 
                                        colSpan={onDeleteRecord ? 13 : 12} 
                                        className="p-3 pl-4 font-extrabold text-xs uppercase tracking-widest text-[#FF7F00]"
                                      >
                                        ✦ SMF {smfName}
                                      </td>
                                    </tr>

                                    {smfRecords.map((r, rIdx) => {
                                      globalRowIdx++;
                                      const dpjpUtamaList = r.doctorCharges ? r.doctorCharges.filter(c => c.role === 'DPJP_UTAMA') : [];
                                      const dpjpRaberanList = r.doctorCharges ? r.doctorCharges.filter(c => c.role === 'DPJP_RABERAN') : [];
                                      const dpjpKonsulList = r.doctorCharges ? r.doctorCharges.filter(c => c.role === 'DPJP_KONSULAN') : [];

                                      const dpjpUtamaNames = dpjpUtamaList.map(c => `${c.doctorName} (${c.count}x)`).join(', ') || r.dpjp || '-';
                                      const dpjpRaberanNames = dpjpRaberanList.map(c => `${c.doctorName} (${c.count}x)`).join(', ') || '-';
                                      const dpjpKonsulNames = dpjpKonsulList.map(c => `${c.doctorName} (${c.count}x)`).join(', ') || '-';

                                      return (
                                        <tr key={`${r.id || ''}-smf-${smfName}-${rIdx}`} className="hover:bg-slate-50 transition-colors">
                                          <td className="p-3 text-center border-r font-bold text-slate-400">{globalRowIdx}</td>
                                          <td className="p-3 border-r font-black text-slate-500">{r.date || r.dischargeDate || '-'}</td>
                                          <td className="p-3 border-r">
                                            <div className="font-black text-slate-800 text-xs uppercase tracking-tight">{r.patientName || 'Pasien Umum'}</div>
                                            <div className="flex flex-wrap gap-1.5 items-center mt-1">
                                              <span className="text-[9px] font-black text-[#144272] uppercase tracking-wider">{r.noRM ? `RM: ${r.noRM}` : 'UMUM / INSTALASI'}</span>
                                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-indigo-100 text-indigo-700 tracking-wider">
                                                {r.caraBayarSingle}
                                              </span>
                                            </div>
                                            {r.noSEP && <div className="text-[8px] font-bold text-emerald-600 mt-0.5">SEP: {r.noSEP}</div>}
                                          </td>
                                          <td className="p-3 border-r">
                                            <div className="font-black text-slate-700 uppercase">{r.ruangRawatAsal || '-'}</div>
                                            <div className="text-[9px] font-bold text-slate-400">{r.jmlHariRawat || 1} Hari Rawat</div>
                                          </td>
                                          <td className="p-3 border-r">
                                            <div className="font-black text-slate-700 uppercase">{dpjpUtamaNames}</div>
                                          </td>
                                          <td className="p-3 border-r text-slate-600 font-medium">
                                            {dpjpRaberanNames}
                                          </td>
                                          <td className="p-3 border-r text-slate-600 font-medium">
                                            {dpjpKonsulNames}
                                          </td>
                                          <td className="p-3 border-r text-right font-medium text-slate-600">{(r.billingAkomodasi || 0).toLocaleString('id-ID')}</td>
                                          <td className="p-3 border-r text-right font-medium text-slate-600">{(r.billingTindakan || 0).toLocaleString('id-ID')}</td>
                                          <td className="p-3 border-r text-right font-medium text-slate-600">{(r.billingGasMedis || 0).toLocaleString('id-ID')}</td>
                                          <td className="p-3 border-r text-right font-black bg-indigo-50/10 text-[#144272] text-xs">{(r.amount || 0).toLocaleString('id-ID')}</td>
                                          <td className="p-3 border-r text-slate-500 max-w-[150px] truncate" title={r.diagnosaUtama}>{r.diagnosaUtama || '-'}</td>
                                          {onDeleteRecord && (
                                            <td className="p-3 text-center">
                                              <div className="flex items-center justify-center gap-1">
                                                <button 
                                                  type="button"
                                                  onClick={() => handleStartEdit(r)}
                                                  className="p-1.5 text-blue-600 hover:bg-blue-50 border-none bg-transparent rounded-lg transition-colors outline-none cursor-pointer"
                                                  title="Edit Data"
                                                >
                                                  <Edit size={13} />
                                                </button>
                                                <button 
                                                  type="button"
                                                  onClick={() => setDeleteConfirmTarget(r)}
                                                  className="p-1.5 text-red-600 hover:bg-red-50 border-none bg-transparent rounded-lg transition-colors outline-none cursor-pointer"
                                                  title="Hapus Data"
                                                >
                                                  <Trash2 size={13} />
                                                </button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              });
                            })()}
                          </tbody>
                          <tfoot className="bg-slate-800 text-white font-black uppercase text-[10px] border-t">
                            <tr>
                              <td colSpan={4} className="p-3 pl-6">SUBTOTAL {caraBayar.toUpperCase()}</td>
                              <td colSpan={3} className="p-3 text-center text-xs text-teal-400 font-bold">Kunjungan Visite: {cbStats.visites}x</td>
                              <td className="p-3 text-right">Rp {cbStats.akomodasi.toLocaleString('id-ID')}</td>
                              <td className="p-3 text-right">Rp {cbStats.tindakan.toLocaleString('id-ID')}</td>
                              <td className="p-3 text-right">Rp {cbStats.gasMedis.toLocaleString('id-ID')}</td>
                              <td className="p-3 text-right bg-indigo-800 text-white text-xs">Rp {cbStats.totalBilling.toLocaleString('id-ID')}</td>
                              <td colSpan={onDeleteRecord ? 2 : 1}>-</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'smf' && (
            <div className="flex flex-col gap-10 p-4 bg-slate-50/50">
              {Object.keys(smfDoctorAnalysis).length === 0 ? (
                <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest italic bg-white rounded-3xl border border-dashed">
                  Tidak ada data analisis SMF / KSM terhitung.
                </div>
              ) : (
                (Object.entries(smfDoctorAnalysis) as [string, Record<string, Record<string, DoctorSMFAnalysisStats>>][]).map(([caraBayar, smfGroups]) => {
                  return (
                    <div key={caraBayar} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                      {/* Hospital Header style mimicking the spreadsheet view */}
                      <div className="p-6 bg-emerald-600 text-white border-b border-emerald-700">
                        <div className="text-center">
                          <h3 className="font-extrabold text-sm tracking-wide uppercase leading-tight">RSUD Dr. RADEN SOEDJONO SELONG</h3>
                          <h4 className="font-bold text-xs uppercase leading-tight tracking-wider mt-0.5">LAPORAN REKAP VISITE DOKTER PADA PASIEN {caraBayar}</h4>
                          <p className="text-[10px] text-emerald-100 font-medium tracking-wide mt-1">PERIODE: {activePeriodText} | WAKTU EKSPOR: {new Date().toLocaleDateString('id-ID')}</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse text-left">
                          <thead className="bg-[#fc8c03] text-white font-black uppercase text-[10px] tracking-wider border-b">
                            <tr>
                              <th className="p-3 border-r text-center w-12">No</th>
                              <th className="p-3 border-r">Nama Dokter</th>
                              <th className="p-3 border-r text-center w-48">JUMLAH PASIEN DPJP UTAMA</th>
                              <th className="p-3 border-r text-center w-56">JUMLAH VISITE SEBAGAI DPJP UTAMA + RABERAN</th>
                              <th className="p-3 border-r text-center w-48">JUMLAH PASIEN KONSULAN</th>
                              <th className="p-3 border-r text-center w-48">JUMLAH VISITE SEBAGAI KONSULAN</th>
                              <th className="p-3 text-center w-36">KETERANGAN</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(Object.entries(smfGroups) as [string, Record<string, DoctorSMFAnalysisStats>][]).map(([smfKey, doctorsMap]) => {
                              const docList = (Object.values(doctorsMap) as DoctorSMFAnalysisStats[]).sort((a,b) => a.doctorName.localeCompare(b.doctorName));
                              
                              // Compute totals for this SMF
                              const smfTotals = docList.reduce((acc, curr) => {
                                acc.dpjpUtamaPatients += curr.dpjpUtamaPatients;
                                acc.dpjpUtamaAndRaberanVisits += curr.dpjpUtamaAndRaberanVisits;
                                acc.dpjpKonsulanPatients += curr.dpjpKonsulanPatients;
                                acc.dpjpKonsulanVisits += curr.dpjpKonsulanVisits;
                                return acc;
                              }, { dpjpUtamaPatients: 0, dpjpUtamaAndRaberanVisits: 0, dpjpKonsulanPatients: 0, dpjpKonsulanVisits: 0 });

                              return (
                                <React.Fragment key={smfKey}>
                                  {/* SMF Section Row */}
                                  <tr className="bg-amber-50/50 border-y border-amber-100/50">
                                    <td colSpan={7} className="p-3 font-black text-amber-800 tracking-wider text-[11px] uppercase">
                                      SMF {smfKey.toUpperCase()}
                                    </td>
                                  </tr>
                                  
                                  {/* Doctor Rows */}
                                  {docList.map((doc, idx) => (
                                    <tr key={doc.doctorName} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                                      <td className="p-2.5 text-center border-r font-bold text-slate-400 text-[11px]">{idx + 1}</td>
                                      <td className="p-2.5 border-r font-black text-slate-700 uppercase text-[11px]">{doc.doctorName}</td>
                                      <td className="p-2.5 border-r text-center font-bold text-slate-800 text-[11px]">{doc.dpjpUtamaPatients || '-'}</td>
                                      <td className="p-2.5 border-r text-center font-bold text-indigo-700 text-[11px]">{doc.dpjpUtamaAndRaberanVisits || '-'}</td>
                                      <td className="p-2.5 border-r text-center font-bold text-slate-800 text-[11px]">{doc.dpjpKonsulanPatients || '-'}</td>
                                      <td className="p-2.5 border-r text-center font-bold text-teal-700 text-[11px]">{doc.dpjpKonsulanVisits || '-'}</td>
                                      <td className="p-2.5 text-center text-slate-400 text-[10px]">-</td>
                                    </tr>
                                  ))}

                                  {/* SMF Subtotal Row */}
                                  <tr className="bg-[#fcebd1] text-[#915400] font-black uppercase text-[10px] border-b border-amber-200">
                                    <td colSpan={2} className="p-3 pl-6 text-[10px]">SUB TOTAL SMF {smfKey.toUpperCase()}</td>
                                    <td className="p-3 text-center text-xs font-black">{smfTotals.dpjpUtamaPatients || '-'}</td>
                                    <td className="p-3 text-center text-xs font-black text-indigo-800">{smfTotals.dpjpUtamaAndRaberanVisits || '-'}</td>
                                    <td className="p-3 text-center text-xs font-black">{smfTotals.dpjpKonsulanPatients || '-'}</td>
                                    <td className="p-3 text-center text-xs font-black text-teal-800">{smfTotals.dpjpKonsulanVisits || '-'}</td>
                                    <td className="p-3 text-center">-</td>
                                  </tr>
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'cara-bayar' && (
            <table className="w-full text-[10px] border-collapse text-left">
              <thead className="bg-[#144272]/5 text-[#144272] border-b font-black uppercase tracking-wider">
                <tr>
                  <th className="p-3 border-r text-center w-10">No</th>
                  <th className="p-3 border-r">Cara Pembayaran (Payment Mode)</th>
                  <th className="p-3 border-r text-center w-36">Total Pasien Berobat</th>
                  <th className="p-3 border-r text-center w-32">Total Visite (Kali)</th>
                  <th className="p-3 border-r text-right">Akomodasi (Rp)</th>
                  <th className="p-3 border-r text-right">Tindakan (Rp)</th>
                  <th className="p-3 border-r text-right">Gas Medis (Rp)</th>
                  <th className="p-3 text-right bg-indigo-50/50 text-indigo-900">Total Billing (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {caraBayarAnalysis.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center border-r font-bold text-slate-400">{index + 1}</td>
                    <td className="p-3 border-r font-black text-slate-800 uppercase text-xs">{item.caraBayar}</td>
                    <td className="p-3 border-r text-center font-bold text-slate-700 text-xs">{item.patientCount} Pasien</td>
                    <td className="p-3 border-r text-center font-bold text-teal-705 text-xs">{item.visiteCount} Kunjungan</td>
                    <td className="p-3 border-r text-right font-medium text-slate-600">{item.akomodasi.toLocaleString('id-ID')}</td>
                    <td className="p-3 border-r text-right font-medium text-slate-600">{item.tindakan.toLocaleString('id-ID')}</td>
                    <td className="p-3 border-r text-right font-medium text-slate-600">{item.gasMedis.toLocaleString('id-ID')}</td>
                    <td className="p-3 text-right font-black bg-indigo-50/10 text-indigo-700 text-xs">{item.totalBilling.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
                {caraBayarAnalysis.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/30">
                      Tidak ada data Cara Bayar terhitung.
                    </td>
                  </tr>
                )}
              </tbody>
              {caraBayarAnalysis.length > 0 && (
                <tfoot className="bg-slate-800 text-white font-black uppercase text-[10px] border-t">
                  <tr>
                    <td colSpan={2} className="p-3 pl-6">TOTAL KESELURUHAN</td>
                    <td className="p-3 text-center text-xs text-white font-bold">{caraBayarAnalysis.reduce((sum, item) => sum + item.patientCount, 0)} Pasien</td>
                    <td className="p-3 text-center text-xs text-teal-400 font-bold">{caraBayarAnalysis.reduce((sum, item) => sum + item.visiteCount, 0)} Visite</td>
                    <td className="p-3 text-right">Rp {caraBayarAnalysis.reduce((sum, item) => sum + item.akomodasi, 0).toLocaleString('id-ID')}</td>
                    <td className="p-3 text-right">Rp {caraBayarAnalysis.reduce((sum, item) => sum + item.tindakan, 0).toLocaleString('id-ID')}</td>
                    <td className="p-3 text-right">Rp {caraBayarAnalysis.reduce((sum, item) => sum + item.gasMedis, 0).toLocaleString('id-ID')}</td>
                    <td className="p-3 text-right bg-indigo-800 text-white text-xs">Rp {caraBayarAnalysis.reduce((sum, item) => sum + item.totalBilling, 0).toLocaleString('id-ID')}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {activeTab === 'pasien-keluar' && (
            <table className="w-full text-[10px] border-collapse text-left">
              <thead className="bg-[#144272]/5 text-[#144272] border-b font-black uppercase tracking-wider">
                <tr>
                  <th className="p-3 border-r text-center w-10">No</th>
                  <th className="p-3 border-r text-left">Tanggal Pulang / KRS</th>
                  <th className="p-3 border-r text-center w-32 bg-emerald-50 text-emerald-950 font-black">BPL (Berobat Jalan/Pulang)</th>
                  <th className="p-3 border-r text-center w-32 bg-amber-50 text-amber-950 font-black">APS (Minta Sendiri)</th>
                  <th className="p-3 border-r text-center w-32 bg-rose-50 text-rose-950 font-black">Meninggal</th>
                  <th className="p-3 border-r text-center w-32 bg-blue-50 text-blue-950 font-black">Pindah Ruangan</th>
                  <th className="p-3 border-r text-center w-32 bg-indigo-50 text-indigo-950 font-black">Rujuk</th>
                  <th className="p-3 text-center font-black bg-slate-200 text-slate-800">Total Pasien Keluar (Day)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-center">
                {statusDischargeAnalysis.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center border-r font-bold text-slate-400">{index + 1}</td>
                    <td className="p-3 border-r text-left font-black text-slate-800 text-xs">{item.date}</td>
                    <td className="p-3 border-r font-bold text-emerald-700 bg-emerald-50/10 text-xs">{item.bpl} Pasien</td>
                    <td className="p-3 border-r font-bold text-amber-700 bg-amber-50/10 text-xs">{item.aps} Pasien</td>
                    <td className="p-3 border-r font-bold text-rose-700 bg-rose-50/10 text-xs">{item.meninggal} Pasien</td>
                    <td className="p-3 border-r font-bold text-blue-700 bg-blue-50/10 text-xs">{item.pindahRuangan} Pasien</td>
                    <td className="p-3 border-r font-bold text-indigo-700 bg-indigo-50/10 text-xs">{item.rujuk} Pasien</td>
                    <td className="p-3 font-black bg-slate-50 text-xs text-slate-900">{item.totalOut} Pasien</td>
                  </tr>
                ))}
                {statusDischargeAnalysis.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/30">
                      Tidak ada data pasien keluar.
                    </td>
                  </tr>
                )}
              </tbody>
              {statusDischargeAnalysis.length > 0 && (
                <tfoot className="bg-slate-800 text-white font-black uppercase text-[10px] border-t text-center">
                  <tr>
                    <td colSpan={2} className="p-3 pl-6 text-left">TOTAL REKAPITULASI PASIEN KELUAR</td>
                    <td className="p-3 text-emerald-400 font-bold text-xs">{statusDischargeAnalysis.reduce((sum, item) => sum + item.bpl, 0)} BPL</td>
                    <td className="p-3 text-amber-400 font-bold text-xs">{statusDischargeAnalysis.reduce((sum, item) => sum + item.aps, 0)} APS</td>
                    <td className="p-3 text-rose-450 font-bold text-xs">{statusDischargeAnalysis.reduce((sum, item) => sum + item.meninggal, 0)} Meninggal</td>
                    <td className="p-3 text-blue-400 font-bold text-xs">{statusDischargeAnalysis.reduce((sum, item) => sum + item.pindahRuangan, 0)} Pindah</td>
                    <td className="p-3 text-indigo-400 font-bold text-xs">{statusDischargeAnalysis.reduce((sum, item) => sum + item.rujuk, 0)} Rujuk</td>
                    <td className="p-3 bg-slate-900 text-white text-xs font-black">{statusDischargeAnalysis.reduce((sum, item) => sum + item.totalOut, 0)} TOTAL</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      {deleteConfirmTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl w-full max-w-md border border-slate-100 relative text-left">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-6">
                <Trash2 size={28} />
              </div>
              <h3 className="font-black text-slate-800 text-2xl tracking-tight mb-2">Konfirmasi Hapus</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                Anda yakin ingin menghapus data visite & keuangan pasien <b className="text-slate-700">{deleteConfirmTarget.patientName || 'Umum'}</b>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-4 w-full">
                <Button 
                  variant="secondary" 
                  className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-50"
                  onClick={() => setDeleteConfirmTarget(null)}
                >
                  Batal
                </Button>
                <button 
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-200"
                  onClick={() => {
                    if (onDeleteRecord) {
                      onDeleteRecord(deleteConfirmTarget.id);
                    }
                    setDeleteConfirmTarget(null);
                  }}
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
