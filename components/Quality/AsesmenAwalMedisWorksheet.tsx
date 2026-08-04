import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Patient, AppData, QualityMeasurement, parseToStandardDateString } from '../../types';
import { Button } from '../Button';
import { 
  Calendar, CheckSquare, ClipboardCheck, Info, Save, 
  Search, Users, Activity, AlertCircle, FileSpreadsheet, 
  Sparkles, CheckCircle2, X, Loader2, Plus, Edit, Trash2,
  Check, ArrowLeft, ChevronDown, ChevronUp
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AsesmenAwalMedisWorksheetProps {
  appData: AppData;
  onSaveMeasurement: (measurements: QualityMeasurement[], immediate?: boolean) => Promise<any> | void;
  currentUser: any;
  selectedDate?: string;
  setSelectedDate?: (date: string) => void;
}

interface AuditRecord {
  anamnesis: 'Ya' | 'Tidak' | 'Tidak Perlu' | boolean;
  pemeriksaanFisik: 'Ya' | 'Tidak' | 'Tidak Perlu' | boolean;
  diagnosis: 'Ya' | 'Tidak' | 'Tidak Perlu' | boolean;
  rencanaTerapi: 'Ya' | 'Tidak' | 'Tidak Perlu' | boolean;
  ttdDPJP: 'Ya' | 'Tidak' | 'Tidak Perlu' | boolean;
  kurang24h: 'Ya' | 'Tidak' | 'Tidak Perlu' | boolean;
}

const normalizeValue = (val: any): 'Ya' | 'Tidak' | 'Tidak Perlu' => {
  if (val === true || val === 'true' || val === 'Ya') return 'Ya';
  if (val === false || val === 'false' || val === 'Tidak') return 'Tidak';
  if (val === 'Tidak Perlu' || val === 'NA' || val === 'Tidak Perlu (NA)') return 'Tidak Perlu';
  return 'Tidak'; // Default to Tidak if empty/undefined
};

const getMainUnit = (roomName: string | undefined | null): string => {
  if (!roomName) return '';
  const r = roomName.trim();
  
  // Direct matches
  if (/^Ruang\s+Bedah/i.test(r) || /^Bedah/i.test(r)) return 'Ruang Bedah';
  if (/^Ruang\s+Dane\s+Rahil/i.test(r) || /^DR\s+/i.test(r) || /^DR\d+/i.test(r) || /^DR$/i.test(r)) return 'Ruang Dane Rahil';
  if (/^Ruang\s+Intermediet/i.test(r) || /Intermediate/i.test(r)) return 'Ruang Intermediet';
  if (/^Ruang\s+Syaraf/i.test(r) || /^Syaraf/i.test(r)) return 'Ruang Syaraf';
  if (/^Ruang\s+Interna/i.test(r) || /^Interna/i.test(r)) return 'Ruang Interna';
  if (/^Ruang\s+Paru/i.test(r) || /^Paru/i.test(r)) return 'Ruang Paru';
  if (/^Ruang\s+Anak/i.test(r) || /^Anak/i.test(r)) return 'Ruang Anak';
  if (/^Ruang\s+Rinjani/i.test(r) || /^Rinjani/i.test(r)) return 'Ruang Rinjani/Nifas';
  if (/^Ruang\s+Neonatus/i.test(r) || /^Neonatus/i.test(r) || /NICU/i.test(r) || /Perinatologi/i.test(r)) return 'Ruang Neonatus';
  if (/^ICU/i.test(r)) return 'ICU';
  if (/^ICCU/i.test(r)) return 'ICCU';
  if (/^IBS/i.test(r)) return 'IBS';
  if (/^OK\s+MCC/i.test(r)) return 'OK MCC';
  if (/^Hemodialisa/i.test(r)) return 'Hemodialisa';

  // Fallbacks if we have other unmapped ones
  if (r.startsWith('Ruang ')) return r;
  return `Ruang ${r}`;
};

export const AsesmenAwalMedisWorksheet: React.FC<AsesmenAwalMedisWorksheetProps> = ({ 
  appData, 
  onSaveMeasurement, 
  currentUser,
  selectedDate: propsSelectedDate,
  setSelectedDate: propsSetSelectedDate
}) => {
  const [localSelectedDate, setLocalSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const selectedDate = propsSelectedDate || localSelectedDate;
  const setSelectedDate = propsSetSelectedDate || setLocalSelectedDate;

  // Filter mode: 'DAY' (Tanggal Spesifik Pasien Masuk - default) vs 'MONTH' (Rentang Akumulasi Bulan Ini)
  const [filterMode, setFilterMode] = useState<'MONTH' | 'DAY'>('DAY');
  
  // Compile list of available rooms/wards
  const roomsList = useMemo(() => {
    const list = new Set<string>();
    list.add('Semua Ruangan');
    
    // Add rooms from masterData
    if (appData?.masterData?.rooms && Array.isArray(appData.masterData.rooms)) {
      appData.masterData.rooms.forEach(r => {
        if (r && typeof r === 'string') {
          const mainUnit = getMainUnit(r);
          if (mainUnit) list.add(mainUnit);
        }
      });
    }

    // Add rooms from patients as fallback to ensure comprehensive coverage
    if (appData?.patients && Array.isArray(appData.patients)) {
      appData.patients.forEach(p => {
        if (p.ruangan && typeof p.ruangan === 'string') {
          const mainUnit = getMainUnit(p.ruangan);
          if (mainUnit) list.add(mainUnit);
        }
        if (p.unitTujuan && typeof p.unitTujuan === 'string') {
          const mainUnit = getMainUnit(p.unitTujuan);
          if (mainUnit) list.add(mainUnit);
        }
      });
    }

    if (currentUser && currentUser.unit) {
      const mainUnit = getMainUnit(currentUser.unit);
      if (mainUnit) list.add(mainUnit);
    }

    return Array.from(list).filter(Boolean).sort((a, b) => {
      if (a === 'Semua Ruangan') return -1;
      if (b === 'Semua Ruangan') return 1;
      return a.localeCompare(b);
    });
  }, [appData, currentUser]);

  const [selectedRoom, setSelectedRoom] = useState<string>(() => {
    // If currentUser is locked to a room, default to that room
    if (currentUser && currentUser.unit) {
      const mainUnit = getMainUnit(currentUser.unit);
      if (mainUnit) return mainUnit;
    }
    // Default fallback to "Ruang Bedah" or the first available room
    return 'Ruang Bedah';
  });

  const isRoomMatch = useCallback((p: Patient) => {
    if (selectedRoom === 'Semua Ruangan') return true;
    const r1 = getMainUnit(p.ruangan);
    const r2 = getMainUnit(p.unitTujuan);
    const r3 = getMainUnit((p as any).originUnit);
    return r1 === selectedRoom || r2 === selectedRoom || r3 === selectedRoom;
  }, [selectedRoom]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchQueue, setSearchQueue] = useState('');
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close custom room dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRoomDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filtered rooms list for the searchbox
  const filteredRoomsList = useMemo(() => {
    if (!roomSearchTerm.trim()) return roomsList;
    const q = roomSearchTerm.toLowerCase();
    return roomsList.filter(r => r.toLowerCase().includes(q));
  }, [roomsList, roomSearchTerm]);

  // Form states
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [activeEditPatient, setActiveEditPatient] = useState<Patient | null>(null);
  const [formValues, setFormValues] = useState<Record<string, 'Ya' | 'Tidak' | 'Tidak Perlu'>>({
    anamnesis: 'Ya',
    pemeriksaanFisik: 'Ya',
    diagnosis: 'Ya',
    rencanaTerapi: 'Ya',
    ttdDPJP: 'Ya',
    kurang24h: 'Ya',
  });

  // Sync and save states
  const [isSyncing, setIsSyncing] = useState(false);

  // Find or initialize quality measurement audit for this date (merging all duplicate entries if any)
  const currentMeasurement = useMemo(() => {
    const list = appData.qualityMeasurements || [];
    const targetDateStd = parseToStandardDateString(selectedDate);
    const matches = list.filter(
      m => m.indicatorId === 'mutu-asesmen-awal-medis' && parseToStandardDateString(m.date) === targetDateStd
    );
    if (matches.length === 0) return null;

    const mergedAuditData: Record<string, AuditRecord> = {};
    matches.forEach(m => {
      if (m.auditData && typeof m.auditData === 'object') {
        Object.assign(mergedAuditData, m.auditData);
      }
    });

    const latest = matches[matches.length - 1];
    return {
      ...latest,
      date: targetDateStd,
      auditData: mergedAuditData
    };
  }, [appData.qualityMeasurements, selectedDate]);

  // Loaded auditData state per patient { [patientId]: AuditRecord }
  const [localAuditData, setLocalAuditData] = useState<Record<string, AuditRecord>>({});

  // Ref to hold the latest localAuditData snapshot so useEffect won't trigger re-runs and rollbacks
  const localAuditDataRef = useRef(localAuditData);
  useEffect(() => {
    localAuditDataRef.current = localAuditData;
  }, [localAuditData]);

  // Sync state whenever the selectedDate or currentMeasurement changes from parent props
  useEffect(() => {
    const serverAuditData = (currentMeasurement && currentMeasurement.auditData) || {};
    setLocalAuditData(serverAuditData);
  }, [currentMeasurement, selectedDate]);

  const isCompliant = (record: AuditRecord | undefined): boolean => {
    if (!record) return false;
    const fields: (keyof AuditRecord)[] = [
      'anamnesis', 'pemeriksaanFisik', 'diagnosis', 'rencanaTerapi', 'ttdDPJP', 'kurang24h'
    ];
    return fields.every(f => {
      const val = normalizeValue(record[f]);
      return val === 'Ya' || val === 'Tidak Perlu';
    });
  };

  // Helper function to check if patient entry date matches selected filter mode (MONTH vs DAY)
  const isDateMatchForFilter = useCallback((p: Patient | string) => {
    if (!p) return false;
    let rawDate = typeof p === 'string' ? p : (p.entryDate || (p as any).tanggal_mrs || (p as any).createdAt || (p as any).date || '');
    if (!rawDate) return false;
    const stdEntry = parseToStandardDateString(rawDate);
    const targetDateStr = parseToStandardDateString(selectedDate);
    if (!stdEntry || !targetDateStr) return false;
    if (filterMode === 'MONTH') {
      const monthPrefix = targetDateStr.substring(0, 7); // e.g. "2026-07"
      return stdEntry.startsWith(monthPrefix);
    }
    return stdEntry === targetDateStr;
  }, [selectedDate, filterMode]);

  // Compile Queue of Patients (have NOT had initial medical assessment audited for the current date/month, multi-criteria filtered)
  const patientsQueue = useMemo(() => {
    let list = appData.patients || [];
    const deletedSet = new Set<string>(appData.deletedIds || []);
    
    // 0. Exclude deleted patients
    list = list.filter(p => p && p.id && !deletedSet.has(p.id));

    // 1. Filter Ruang Perawatan
    list = list.filter(p => isRoomMatch(p));

    // 2. Filter Tanggal Masuk Rumah Sakit (MRS): Hanya tampilkan pasien yang masuk SESUAI TANGGAL ENTRY yang dipilih (seperti Laporan Visite & Keuangan)
    list = list.filter(p => {
      if (!p) return false;
      const rawDate = p.entryDate || (p as any).tanggal_mrs || (p as any).createdAt || (p as any).date || '';
      if (!rawDate) return false;
      const stdEntry = parseToStandardDateString(rawDate);
      const targetDateStr = parseToStandardDateString(selectedDate);
      return stdEntry === targetDateStr;
    });

    // 3. Filter Eksklusi (Pasien Sudah Diposting/Diaudit): Pasien yang sudah disimpan data asesmennya TIDAK BOLEH muncul kembali di antrean
    const auditedIds = new Set<string>(
      Object.keys(localAuditData || {}).filter(key => localAuditData[key] !== undefined && localAuditData[key] !== null)
    );

    list = list.filter(p => p && p.id && !auditedIds.has(p.id));

    if (searchQueue.trim()) {
      const q = searchQueue.toLowerCase();
      return list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.noRM || '').toLowerCase().includes(q));
    }
    return list;
  }, [appData.patients, appData.deletedIds, localAuditData, isRoomMatch, isDateMatchForFilter, searchQueue]);

  // Compile list of audited patients for the selected date/month (Daftar Riwayat)
  const auditedPatientsForSelectedDate = useMemo(() => {
    let list = appData.patients || [];
    const deletedSet = new Set<string>(appData.deletedIds || []);
    
    // 0. Exclude deleted patients
    list = list.filter(p => p && p.id && !deletedSet.has(p.id));

    // Filter by selectedRoom
    list = list.filter(p => isRoomMatch(p));

    // Filter to selected date/month range and those who have active audit record
    list = list.filter(p => p && isDateMatchForFilter(p) && localAuditData[p.id] !== undefined && localAuditData[p.id] !== null);

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.noRM || '').toLowerCase().includes(q));
    }
    return list;
  }, [appData.patients, appData.deletedIds, isDateMatchForFilter, localAuditData, isRoomMatch, searchTerm]);

  // Stats calculation
  const getComplianceStats = () => {
    let datePatients = appData.patients || [];
    const deletedSet = new Set<string>(appData.deletedIds || []);
    
    // Exclude deleted patients
    datePatients = datePatients.filter(p => p && p.id && !deletedSet.has(p.id));

    datePatients = datePatients.filter(p => isRoomMatch(p));
    
    datePatients = datePatients.filter(p => p && isDateMatchForFilter(p));

    const totalNew = datePatients.length;
    const auditedOnDate = datePatients.filter(p => localAuditData[p.id] !== undefined && localAuditData[p.id] !== null);
    const totalAudited = auditedOnDate.length;
    const compliantCount = auditedOnDate.filter(p => isCompliant(localAuditData[p.id])).length;
    const complianceRate = totalAudited > 0 ? Math.round((compliantCount / totalAudited) * 100) : 0;

    return { totalNew, totalAudited, compliantCount, complianceRate };
  };

  const { totalNew, totalAudited, compliantCount, complianceRate } = getComplianceStats();

  // Load existing audit values into form if activeEditPatient changes
  useEffect(() => {
    if (activeEditPatient) {
      const existing = localAuditDataRef.current[activeEditPatient.id];
      if (existing) {
        setFormValues({
          anamnesis: normalizeValue(existing.anamnesis),
          pemeriksaanFisik: normalizeValue(existing.pemeriksaanFisik),
          diagnosis: normalizeValue(existing.diagnosis),
          rencanaTerapi: normalizeValue(existing.rencanaTerapi),
          ttdDPJP: normalizeValue(existing.ttdDPJP),
          kurang24h: normalizeValue(existing.kurang24h),
        });
      } else {
        setFormValues({
          anamnesis: 'Ya',
          pemeriksaanFisik: 'Ya',
          diagnosis: 'Ya',
          rencanaTerapi: 'Ya',
          ttdDPJP: 'Ya',
          kurang24h: 'Ya',
        });
      }
    }
  }, [activeEditPatient]);

  // Handle Save Audit (Optimistic UI & Background Async Sync)
  const handleSaveAudit = (patient: Patient, values: Record<string, 'Ya' | 'Tidak' | 'Tidak Perlu'>) => {
    const rawPatientDate = patient.entryDate || (patient as any).tanggal_mrs || (patient as any).createdAt || (patient as any).date;
    const targetDate = parseToStandardDateString(rawPatientDate) || parseToStandardDateString(selectedDate);
    const targetDateStd = parseToStandardDateString(targetDate);

    // Retrieve global list
    const existingMeasurements = appData.qualityMeasurements || [];
    const matchingMeasurements = existingMeasurements.filter(
      m => m.indicatorId === 'mutu-asesmen-awal-medis' && parseToStandardDateString(m.date) === targetDateStd
    );

    // Merge auditData across all matching measurements for this date + current local state
    const currentAuditData: Record<string, AuditRecord> = {};
    matchingMeasurements.forEach(m => {
      if (m.auditData && typeof m.auditData === 'object') {
        Object.assign(currentAuditData, m.auditData);
      }
    });
    Object.assign(currentAuditData, localAuditDataRef.current);

    // Inject/Update the patient's record
    currentAuditData[patient.id] = {
      anamnesis: values.anamnesis,
      pemeriksaanFisik: values.pemeriksaanFisik,
      diagnosis: values.diagnosis,
      rencanaTerapi: values.rencanaTerapi,
      ttdDPJP: values.ttdDPJP,
      kurang24h: values.kurang24h
    };

    // Recalculate stats for targetDate
    const auditedPatientIds = Object.keys(currentAuditData).filter(
      id => currentAuditData[id] !== undefined && currentAuditData[id] !== null
    );

    let totalNumerator = 0;
    let totalDenominator = auditedPatientIds.length;

    auditedPatientIds.forEach(id => {
      if (isCompliant(currentAuditData[id])) {
        totalNumerator += 1;
      }
    });

    const primaryFound = matchingMeasurements[0];

    const newMeasurement: QualityMeasurement = {
      id: primaryFound?.id || `MEAS_MUTU_ASESMEN_${targetDateStd}_${Date.now()}`,
      indicatorId: 'mutu-asesmen-awal-medis',
      date: targetDateStd,
      numeratorValue: totalNumerator,
      denominatorValue: totalDenominator || 1,
      recordedBy: currentUser?.name || 'Assessor',
      notes: `Audit Kepatuhan Asesmen Awal Medis per ${targetDateStd}`,
      auditData: currentAuditData,
      lastModified: new Date().toISOString()
    };

    // Replace all duplicate measurement entries for this indicator + date with single consolidated newMeasurement
    const nonMatching = existingMeasurements.filter(
      m => !(m.indicatorId === 'mutu-asesmen-awal-medis' && parseToStandardDateString(m.date) === targetDateStd)
    );
    const updatedList = [newMeasurement, ...nonMatching];

    // --- OPTIMISTIC UPDATE ---
    // Update local table view instantly
    setLocalAuditData(currentAuditData);

    // --- INSTANT AUTO-REDIRECT ---
    // Instantly close editor, update selection date, and show success toast
    setSelectedDate(targetDateStd);
    setActiveEditPatient(null);
    setNotification(`Data audit asesmen untuk ${patient.name} berhasil disimpan.`);
    setTimeout(() => setNotification(null), 3000);

    // --- BACKGROUND ASYNC PROCESS ---
    // Fire the save request completely in the background without blocking the UI
    Promise.resolve(onSaveMeasurement(updatedList, false))
      .then(() => {
        console.log('Background sync completed successfully for patient:', patient.name);
      })
      .catch((err) => {
        console.error('Background sync failed for patient:', patient.name, err);
        setNotification('Sinkronisasi latar belakang gagal. Data akan dicoba lagi nanti.');
        setTimeout(() => setNotification(null), 4000);
      });
  };

  // Handle Delete Audit (Optimistic UI & Background Async Sync)
  const handleDeleteAudit = (patientId: string, patientName: string, targetDate: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data audit asesmen untuk pasien ${patientName}?`)) {
      return;
    }

    const targetDateStd = parseToStandardDateString(targetDate);
    const existingMeasurements = appData.qualityMeasurements || [];
    const matchingMeasurements = existingMeasurements.filter(
      m => m.indicatorId === 'mutu-asesmen-awal-medis' && parseToStandardDateString(m.date) === targetDateStd
    );

    const currentAuditData: Record<string, AuditRecord> = {};
    matchingMeasurements.forEach(m => {
      if (m.auditData && typeof m.auditData === 'object') {
        Object.assign(currentAuditData, m.auditData);
      }
    });
    Object.assign(currentAuditData, localAuditDataRef.current);

    delete currentAuditData[patientId];

    // Recalculate stats
    const auditedPatientIds = Object.keys(currentAuditData).filter(
      id => currentAuditData[id] !== undefined && currentAuditData[id] !== null
    );

    let totalNumerator = 0;
    let totalDenominator = auditedPatientIds.length;

    auditedPatientIds.forEach(id => {
      if (isCompliant(currentAuditData[id])) {
        totalNumerator += 1;
      }
    });

    const primaryFound = matchingMeasurements[0];

    const newMeasurement: QualityMeasurement = {
      id: primaryFound?.id || `MEAS_MUTU_ASESMEN_${targetDateStd}_${Date.now()}`,
      indicatorId: 'mutu-asesmen-awal-medis',
      date: targetDateStd,
      numeratorValue: totalNumerator,
      denominatorValue: totalDenominator || 1,
      recordedBy: currentUser?.name || 'Assessor',
      notes: `Audit Kepatuhan Asesmen Awal Medis per ${targetDateStd}`,
      auditData: currentAuditData,
      lastModified: new Date().toISOString()
    };

    const nonMatching = existingMeasurements.filter(
      m => !(m.indicatorId === 'mutu-asesmen-awal-medis' && parseToStandardDateString(m.date) === targetDateStd)
    );
    const updatedList = [newMeasurement, ...nonMatching];

    // --- OPTIMISTIC UPDATE ---
    // Instantly update the local state so the patient disappears from the table immediately
    setLocalAuditData(currentAuditData);
    setNotification(`Data audit untuk pasien ${patientName} berhasil dihapus.`);
    setTimeout(() => setNotification(null), 3000);

    // --- BACKGROUND ASYNC PROCESS ---
    Promise.resolve(onSaveMeasurement(updatedList, false))
      .then(() => {
        console.log('Background delete completed successfully for patient:', patientName);
      })
      .catch((err) => {
        console.error('Background delete failed for patient:', patientName, err);
        setNotification('Gagal menyinkronkan penghapusan ke server.');
        setTimeout(() => setNotification(null), 4000);
      });
  };

  // Handle excel export for history table
  const handleExportExcel = () => {
    const dataToExport = auditedPatientsForSelectedDate.map((p, idx) => {
      const rec = localAuditData[p.id] || {
        anamnesis: 'Tidak',
        pemeriksaanFisik: 'Tidak',
        diagnosis: 'Tidak',
        rencanaTerapi: 'Tidak',
        ttdDPJP: 'Tidak',
        kurang24h: 'Tidak',
      };
      
      return {
        'No': idx + 1,
        'No. RM': p.noRM,
        'Nama Pasien': p.name,
        'Anamnesis': normalizeValue(rec.anamnesis),
        'Pemeriksaan Fisik': normalizeValue(rec.pemeriksaanFisik),
        'Diagnosa Kerja/Banding': normalizeValue(rec.diagnosis),
        'Terapi / Tindakan': normalizeValue(rec.rencanaTerapi),
        'Sign/TTD DPJP': normalizeValue(rec.ttdDPJP),
        'Selesai < 24 Jam': normalizeValue(rec.kurang24h),
        'Status Kepatuhan': isCompliant(rec) ? 'Patuh (100%)' : 'Tidak Patuh'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit_Asesmen');
    XLSX.writeFile(wb, `Audit_Asesmen_Awal_Medis_${selectedDate}.xlsx`);
  };

  const criteriaList = [
    { key: 'anamnesis', label: '1. Anamnesis (Riwayat)', description: 'Kelengkapan riwayat penyakit, keluhan utama, dan riwayat alergi.' },
    { key: 'pemeriksaanFisik', label: '2. Pemeriksaan Fisik', description: 'Kelengkapan pemeriksaan tanda-tanda vital, status generalis, dan lokal.' },
    { key: 'diagnosis', label: '3. Diagnosa Kerja / Banding', description: 'Penegakan diagnosis kerja awal atau diagnosis banding.' },
    { key: 'rencanaTerapi', label: '4. Terapi / Tindakan', description: 'Rencana penatalaksanaan komprehensif, obat-obatan, atau instruksi tindakan.' },
    { key: 'ttdDPJP', label: '5. Sign & Nama Dokter (DPJP)', description: 'Tanda tangan serta nama jelas dokter Penanggung Jawab Pelayanan.' },
    { key: 'kurang24h', label: '6. Selesai < 24 Jam', description: 'Pemberian asesmen awal selesai di-input dalam waktu kurang dari 24 jam sejak MRS.' },
  ];

  const getBadgeClass = (val: 'Ya' | 'Tidak' | 'Tidak Perlu') => {
    switch(val) {
      case 'Ya': return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
      case 'Tidak': return 'bg-rose-50 text-rose-600 border border-rose-100';
      case 'Tidak Perlu': return 'bg-slate-100 text-slate-500 border border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Top Header bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-8 rounded-[2rem] border shadow-xs">
        <div>
          <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800">Asesmen Awal Medis Pasien Baru</h3>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
            <ClipboardCheck size={14} className="text-blue-500" /> Audit kepatuhan pengisian rekam medis awal oleh dokter DPJP
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button 
            onClick={() => setIsQueueModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus size={16} /> + Tambah Data Asesmen Pasien Baru
            <span className="bg-white text-blue-600 font-bold px-2 py-0.5 rounded-full text-[9px] ml-1">
              {patientsQueue.length}
            </span>
          </Button>

          {/* Active Room/Ward Selector with Searchbox */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 relative" ref={dropdownRef}>
            <div className="flex items-center gap-2 pl-2">
              <Users size={14} className="text-blue-500" />
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                RUANG PERAWATAN:
              </label>
            </div>
            
            {/* Custom Interactive Dropdown with Inline Searchbox inside */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
                className="bg-white rounded-lg px-3 py-1.5 text-xs font-black outline-none text-blue-600 cursor-pointer uppercase border border-slate-150 min-w-[170px] flex items-center justify-between gap-2 hover:bg-slate-50/50 transition-all text-left"
              >
                <span>{selectedRoom || 'Pilih Ruangan'}</span>
                {isRoomDropdownOpen ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-blue-500" />}
              </button>

              {isRoomDropdownOpen && (
                <div className="absolute right-0 sm:left-0 top-full mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-50 flex flex-col overflow-hidden animate-fade-in">
                  {/* Inline Search Filter at the top */}
                  <div className="p-2.5 bg-slate-50 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      <input
                        type="text"
                        placeholder="Cari Unit Induk..."
                        className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 placeholder-slate-400 uppercase"
                        value={roomSearchTerm}
                        onChange={(e) => setRoomSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()} // Prevent dropdown close when selecting searchbox
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Dropdown Options */}
                  <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
                    {filteredRoomsList.length === 0 ? (
                      <div className="text-slate-400 text-[10px] font-black uppercase tracking-wider py-3 text-center">
                        Unit Tidak Ditemukan
                      </div>
                    ) : (
                      filteredRoomsList.map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setSelectedRoom(r);
                            setIsRoomDropdownOpen(false);
                            setRoomSearchTerm('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-between ${
                            selectedRoom === r 
                              ? 'bg-blue-50 text-blue-600 font-extrabold' 
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{r}</span>
                          {selectedRoom === r && <Check size={12} className="text-blue-500" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as 'MONTH' | 'DAY')}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-black text-slate-700 outline-none cursor-pointer"
            >
              <option value="DAY">Tanggal Spesifik (Harian)</option>
              <option value="MONTH">Rentang Bulan Ini</option>
            </select>
            <div className="flex items-center gap-1">
              <Calendar size={14} className="text-blue-500 ml-1" />
              <input
                type="date"
                className="border-0 bg-transparent rounded-lg px-2 py-1 text-xs font-black outline-none text-blue-600 cursor-pointer"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest animate-fade-in">
          <CheckCircle2 size={18} /> {notification}
        </div>
      )}

      {/* Summary Scoreboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xs">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Pasien Baru</span>
          <div className="text-3xl font-black text-slate-800 mt-2">{totalNew}</div>
          <span className="text-[10px] text-slate-400 font-semibold block mt-1">Sensus Masuk per {selectedDate}</span>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xs">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pasien Diaudit</span>
          <div className="text-3xl font-black text-indigo-600 mt-2">{totalAudited} / {totalNew}</div>
          <span className="text-[10px] text-slate-400 font-semibold block mt-1">Tingkat Pengisian Kertas Kerja</span>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xs">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pasien Patuh (100% Lengkap)</span>
          <div className="text-3xl font-black text-emerald-600 mt-2">{compliantCount}</div>
          <span className="text-[10px] text-slate-400 font-semibold block mt-1">Selesai Lengkap & Sesuai Standar</span>
        </div>

        <div className="bg-emerald-600 p-6 rounded-[2rem] text-white flex flex-col justify-between relative overflow-hidden shadow-xl shadow-emerald-100">
          <Sparkles className="absolute right-4 bottom-4 text-emerald-500/20 w-24 h-24 pointer-events-none" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Kepatuhan Rekam Medis (MUTU)</span>
          <div className="text-4xl font-black text-white mt-4">{complianceRate}%</div>
          <span className="text-[10px] text-emerald-100 font-bold block mt-1 uppercase tracking-tighter">Target Rumah Sakit: 100%</span>
        </div>
      </div>

      {/* Main interactive workflow */}
      {activeEditPatient ? (
        /* Focused Entry Form */
        <div className="bg-white border rounded-[2rem] shadow-md p-8 animate-fade-in space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
            <div>
              <button 
                onClick={() => setActiveEditPatient(null)}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-black uppercase mb-2 outline-none cursor-pointer"
              >
                <ArrowLeft size={14} /> Kembali ke Menu Utama
              </button>
              <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <ClipboardCheck className="text-blue-600" size={22} /> Form Audit Asesmen Awal Medis
              </h4>
            </div>

            <button
              onClick={() => {
                setFormValues({
                  anamnesis: 'Ya',
                  pemeriksaanFisik: 'Ya',
                  diagnosis: 'Ya',
                  rencanaTerapi: 'Ya',
                  ttdDPJP: 'Ya',
                  kurang24h: 'Ya',
                });
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all outline-none cursor-pointer"
            >
              Set All to "Ya"
            </button>
          </div>

          {/* Patient Details Sub-header (11 Parameters) */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 space-y-4 text-xs">
            <h5 className="font-black text-slate-700 uppercase tracking-wide text-[10px] border-b pb-2 flex items-center gap-2">
              <Users size={14} className="text-blue-500" /> Identitas Pasien Lengkap (11 Parameter)
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase">1. Nama Pasien</span>
                <div className="font-black text-slate-800 mt-0.5 uppercase">{activeEditPatient.name || 'Data Kosong'}</div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase">2. No. Rekam Medis (RM)</span>
                <div className="font-black text-blue-600 mt-0.5">{activeEditPatient.noRM || 'N/A'}</div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase">3. Tanggal Lahir</span>
                <div className="font-bold text-slate-700 mt-0.5">{activeEditPatient.birthDate || 'Data Kosong'}</div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase">4. Jenis Kelamin</span>
                <div className="font-bold text-slate-700 mt-0.5">{activeEditPatient.gender === 'L' ? 'Laki-laki' : activeEditPatient.gender === 'P' ? 'Perempuan' : 'Data Kosong'}</div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase">5. Cara Bayar</span>
                <div className="font-bold text-slate-700 mt-0.5">{(Array.isArray(activeEditPatient.paymentMethod) ? activeEditPatient.paymentMethod.join(', ') : activeEditPatient.paymentMethod) || 'Data Kosong'}</div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase">6. Nama DPJP</span>
                <div className="font-bold text-slate-700 mt-0.5">{activeEditPatient.dpjp || (activeEditPatient.dpjpList && activeEditPatient.dpjpList.join(', ')) || 'Data Kosong'}</div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase">7. Diagnosa Medis</span>
                <div className="font-bold text-slate-700 mt-0.5">{activeEditPatient.diagnosaUtama || 'Data Kosong'}</div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase">8. Tanggal MRS</span>
                <div className="font-bold text-slate-700 mt-0.5">{activeEditPatient.entryDate || 'Data Kosong'}</div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase">9. Ruangan & No Bed</span>
                <div className="font-bold text-slate-700 mt-0.5">{activeEditPatient.ruangan || activeEditPatient.unitTujuan || 'Data Kosong'} - Bed {activeEditPatient.nomorBed || '-'}</div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase">10. Nama PPJA (Perawat Primer)</span>
                <div className="font-bold text-slate-700 mt-0.5">{activeEditPatient.perawatPrimer || 'Data Kosong'}</div>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[9px] font-black text-slate-400 uppercase">11. Alamat</span>
                <div className="font-bold text-slate-700 mt-0.5">{activeEditPatient.address || 'Data Kosong'}</div>
              </div>
            </div>
          </div>

          {/* Form Fields: Segmented controls (3 options) */}
          <div className="space-y-4 pt-2">
            {criteriaList.map((item) => {
              return (
                <div key={item.key} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-slate-150 rounded-2xl gap-4 hover:border-slate-300 transition-colors">
                  <div className="flex-1">
                    <span className="text-xs font-black text-slate-800 block uppercase tracking-tight">{item.label}</span>
                    <span className="text-[11px] text-slate-400 font-medium block mt-0.5">{item.description}</span>
                  </div>

                  <div className="w-full md:w-80">
                    <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border">
                      {['Ya', 'Tidak', 'Tidak Perlu'].map((opt) => {
                        const isSelected = formValues[item.key] === opt;
                        const activeStyle = opt === 'Ya' 
                          ? (isSelected ? 'bg-emerald-600 text-white border-emerald-650 font-black scale-[1.01] shadow-xs' : 'text-slate-500 hover:bg-white/50')
                          : opt === 'Tidak'
                          ? (isSelected ? 'bg-rose-600 text-white border-rose-650 font-black scale-[1.01] shadow-xs' : 'text-slate-500 hover:bg-white/50')
                          : (isSelected ? 'bg-slate-600 text-white border-slate-650 font-black scale-[1.01] shadow-xs' : 'text-slate-500 hover:bg-white/50');

                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFormValues(prev => ({ ...prev, [item.key]: opt as any }))}
                            className={`flex-1 py-2 px-3 rounded-lg text-[10.5px] font-bold transition-all outline-none cursor-pointer text-center ${activeStyle}`}
                          >
                            {opt === 'Tidak Perlu' ? 'NA' : opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end items-center gap-3 border-t pt-5">
            <Button
              variant="secondary"
              onClick={() => setActiveEditPatient(null)}
              className="py-2.5 px-6 uppercase text-[9.5px] font-black tracking-widest rounded-xl outline-none cursor-pointer"
            >
              Batal
            </Button>
            
            <Button
              onClick={() => handleSaveAudit(activeEditPatient, formValues)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 px-8 uppercase text-[9.5px] font-black tracking-widest shadow-md shadow-indigo-100 flex items-center gap-2 outline-none cursor-pointer"
            >
              {isSyncing ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isSyncing ? 'Menyinkronkan...' : 'Kunci & Simpan Audit'}
            </Button>
          </div>
        </div>
      ) : (
        /* History list view (Default display) */
        <div className="bg-white border rounded-[2rem] shadow-xs overflow-hidden flex flex-col">
          {/* Table Toolbar */}
          <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full justify-between md:justify-start">
               <div className="flex items-center gap-2">
                  <Users size={18} className="text-blue-500" />
                  <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">Daftar Riwayat Asesmen Awal Medis ({selectedDate})</h4>
               </div>
               <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
                 Evaluator: {currentUser?.name || '-'}
               </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              <div className="relative flex-1 md:w-60 min-w-[150px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Cari Pasien..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Button
                onClick={handleExportExcel}
                disabled={auditedPatientsForSelectedDate.length === 0}
                className="bg-slate-700 hover:bg-slate-800 text-white rounded-xl py-2 px-4 uppercase text-[9px] font-black tracking-widest disabled:opacity-45 outline-none cursor-pointer"
              >
                <FileSpreadsheet size={14} className="mr-2" /> Ekspor
              </Button>
            </div>
          </div>

          {/* Audit History Sheet Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#144272]/5 border-b text-[9.5px] font-black text-slate-500 uppercase tracking-widest">
                <tr>
                  <th className="p-6">Identitas Pasien</th>
                  <th className="p-6 text-center">Anamnesis</th>
                  <th className="p-6 text-center">Pemeriksaan Fisik</th>
                  <th className="p-6 text-center">Diagnosa Kerja</th>
                  <th className="p-6 text-center">Terapi / Tindakan</th>
                  <th className="p-6 text-center">Dokter (DPJP)</th>
                  <th className="p-6 text-center">Selesai &lt; 24 Jam</th>
                  <th className="p-6 text-center">Status Mutu</th>
                  <th className="p-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditedPatientsForSelectedDate.map((p, pIdx) => {
                  const audit = localAuditData[p.id];
                  const compliant = isCompliant(audit);

                  return (
                    <tr key={`${p.id}-${pIdx}`} className="hover:bg-slate-50/50 transition-all">
                      <td className="p-6 min-w-[200px]">
                        <div className="font-black text-slate-800 text-sm tracking-tight capitalize">{(p?.name || 'Data Kosong').toLowerCase()}</div>
                        <div className="flex gap-2 items-center text-[10px] text-slate-400 font-bold mt-1 uppercase">
                          <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[8.5px] text-slate-500">{p?.noRM || 'N/A'}</span>
                          <span>{p?.ruangan || p?.unitTujuan || '-'} - {p?.nomorBed || '-'}</span>
                        </div>
                      </td>

                      {/* Criteria 1 */}
                      <td className="p-6 text-center">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${getBadgeClass(normalizeValue(audit?.anamnesis))}`}>
                          {normalizeValue(audit?.anamnesis) === 'Tidak Perlu' ? 'NA' : normalizeValue(audit?.anamnesis)}
                        </span>
                      </td>

                      {/* Criteria 2 */}
                      <td className="p-6 text-center">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${getBadgeClass(normalizeValue(audit?.pemeriksaanFisik))}`}>
                          {normalizeValue(audit?.pemeriksaanFisik) === 'Tidak Perlu' ? 'NA' : normalizeValue(audit?.pemeriksaanFisik)}
                        </span>
                      </td>

                      {/* Criteria 3 */}
                      <td className="p-6 text-center">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${getBadgeClass(normalizeValue(audit?.diagnosis))}`}>
                          {normalizeValue(audit?.diagnosis) === 'Tidak Perlu' ? 'NA' : normalizeValue(audit?.diagnosis)}
                        </span>
                      </td>

                      {/* Criteria 4 */}
                      <td className="p-6 text-center">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${getBadgeClass(normalizeValue(audit?.rencanaTerapi))}`}>
                          {normalizeValue(audit?.rencanaTerapi) === 'Tidak Perlu' ? 'NA' : normalizeValue(audit?.rencanaTerapi)}
                        </span>
                      </td>

                      {/* Criteria 5 */}
                      <td className="p-6 text-center">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${getBadgeClass(normalizeValue(audit?.ttdDPJP))}`}>
                          {normalizeValue(audit?.ttdDPJP) === 'Tidak Perlu' ? 'NA' : normalizeValue(audit?.ttdDPJP)}
                        </span>
                      </td>

                      {/* Criteria 6 */}
                      <td className="p-6 text-center">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${getBadgeClass(normalizeValue(audit?.kurang24h))}`}>
                          {normalizeValue(audit?.kurang24h) === 'Tidak Perlu' ? 'NA' : normalizeValue(audit?.kurang24h)}
                        </span>
                      </td>

                      {/* Total compliance status badge */}
                      <td className="p-6 text-center whitespace-nowrap">
                        <span className={`px-3.5 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${
                          compliant 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                            : 'bg-rose-50 text-rose-500 border-rose-100'
                        }`}>
                          {compliant ? '✓ Patuh' : 'Tidak Patuh'}
                        </span>
                      </td>

                      {/* Inline edit/delete actions */}
                      <td className="p-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveEditPatient(p)}
                            className="p-2 text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 rounded-lg transition-all outline-none cursor-pointer"
                            title="Edit Audit"
                          >
                            <Edit size={14} />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteAudit(p.id, p.name, selectedDate)}
                            className="p-2 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-lg transition-all outline-none cursor-pointer"
                            title="Hapus Audit"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {auditedPatientsForSelectedDate.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-20 text-center text-slate-400">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClipboardCheck size={30} className="text-slate-300" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Belum ada riwayat audit</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-1">Silakan klik "+ Tambah Data Asesmen Pasien Baru" untuk memulai audit rekam medis pasien.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pop-up/Modal Daftar Antrean Pasien Baru */}
      {isQueueModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto border shadow-2xl flex flex-col animate-fade-in">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b pb-4 mb-5">
              <div>
                <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight flex items-center gap-2">
                  <Activity size={22} className="text-blue-600 animate-pulse" /> Antrean Pasien Baru
                </h4>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wide mt-1">
                  Pasien yang belum memiliki data audit Asesmen Awal Medis ({patientsQueue.length} pasien)
                </p>
              </div>

              <button
                onClick={() => setIsQueueModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-all outline-none cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Toolbar with Search inside queue */}
            <div className="relative mb-5">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Cari Nama Pasien / No. RM di Antrean..."
                className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-slate-50"
                value={searchQueue}
                onChange={(e) => setSearchQueue(e.target.value)}
              />
            </div>

            {/* Patient Queue List */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {patientsQueue.map((p, idx) => (
                <div 
                  key={`${p.id}-${idx}`}
                  className="p-4 border border-slate-150 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-400 hover:bg-blue-50/10 transition-all"
                >
                  <div>
                    <div className="font-black text-slate-800 text-sm tracking-tight capitalize">{(p?.name || 'Data Kosong').toLowerCase()}</div>
                    <div className="flex flex-wrap gap-2 items-center text-[10px] text-slate-400 font-bold mt-1 uppercase">
                      <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[8.5px] text-slate-500">{p?.noRM || 'N/A'}</span>
                      <span>Ruangan: {p?.ruangan || p?.unitTujuan || '-'} ({p?.nomorBed || '-'})</span>
                      <span>•</span>
                      <span>MRS: {p?.entryDate || 'N/A'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveEditPatient(p);
                      setIsQueueModalOpen(false);
                    }}
                    className="px-4 py-2 bg-[#144272] hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 outline-none cursor-pointer"
                  >
                    Pilih & Input
                  </button>
                </div>
              ))}

              {patientsQueue.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <CheckSquare size={40} className="text-emerald-500/30 mx-auto mb-3" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Semua Pasien Sudah Diaudit!</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Tidak ditemukan antrean pasien baru yang tersisa.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
