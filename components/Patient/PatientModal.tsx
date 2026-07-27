
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, User as UserIcon, Calendar, MapPin, Bed as BedIcon, ClipboardList, Stethoscope, Wallet, Save, Activity, ShieldCheck, FileText, LayoutGrid, Clock, AlertCircle, ChevronDown, Search, Check } from 'lucide-react';
import { Patient, MasterData, User } from '../../types';
import { Button } from '../Button';
import { SearchableSelect } from '../SearchableSelect';
import { DebouncedInput, DebouncedTextarea } from '../DebouncedInput';

interface PatientModalProps {
  onClose: () => void;
  onSave: (patient: Omit<Patient, 'id'>) => void;
  onDelete?: (id: string) => void;
  masterData: MasterData;
  currentUser: User | null;
  initialData?: Patient;
}

export const PatientModal: React.FC<PatientModalProps> = React.memo(({ onClose, onSave, onDelete, masterData, currentUser, initialData }) => {
  // Safe default helper functions
  const getDefaultUnitTujuan = () => {
    if (initialData?.unitTujuan) return initialData.unitTujuan;
    if (currentUser?.unit && currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'BIDANG') {
      return currentUser.unit;
    }
    return '';
  };

  const getDefaultKelasRawat = () => {
    if (initialData?.kelasRawat) return initialData.kelasRawat;
    const unit = getDefaultUnitTujuan();
    if (unit) {
      const classes = masterData.unitToClasses[unit] || [];
      return classes.length === 1 ? classes[0] : '';
    }
    return '';
  };

  const getDefaultRuangan = () => {
    if (initialData?.ruangan) return initialData.ruangan;
    const unit = getDefaultUnitTujuan();
    const kelas = getDefaultKelasRawat();
    if (unit && kelas) {
      const rooms = masterData.classToRooms[`${unit} - ${kelas}`] || [];
      return rooms.length === 1 ? rooms[0] : '';
    }
    return '';
  };

  const [formData, setFormData] = useState<Omit<Patient, 'id'>>({
    noRegister: initialData?.noRegister || '',
    noRM: initialData?.noRM || '',
    name: initialData?.name || '',
    gender: initialData?.gender || 'L',
    birthDate: initialData?.birthDate || '',
    address: initialData?.address || '',
    entryDate: initialData?.entryDate || new Date().toISOString().split('T')[0],
    entryTime: initialData?.entryTime || (() => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    })(),
    origin: initialData?.origin || '',
    unitTujuan: getDefaultUnitTujuan(),
    kelasRawat: getDefaultKelasRawat(),
    ruangan: getDefaultRuangan(),
    nomorBed: initialData?.nomorBed || '',
    statusDataPasien: initialData?.statusDataPasien || 'Masih Dirawat',
    diagnosaUtama: initialData?.diagnosaUtama || '',
    diagnosaSekunder: initialData?.diagnosaSekunder || '',
    tindakanProsedur: initialData?.tindakanProsedur || '',
    dpjpList: initialData?.dpjpList || [],
    paymentMethod: initialData?.paymentMethod || [],
    noSEP: initialData?.noSEP || '',
    statusSEP: initialData?.statusSEP || 'Belum Terbit',
    jenisKLL: initialData?.jenisKLL || 'Bukan KLL',
    noLP: initialData?.noLP || '',
    perawatPrimer: initialData?.perawatPrimer || '',
    catatanKhusus: initialData?.catatanKhusus || '',
    allergyHistory: initialData?.allergyHistory || '',
    emergencyContactName: initialData?.emergencyContactName || '',
    emergencyContactPhone: initialData?.emergencyContactPhone || '',
    status: initialData?.status || 'ADMITTED',
    dischargeDate: initialData?.dischargeDate || '',
    dischargeTime: initialData?.dischargeTime || '',
    deathTime: initialData?.deathTime,
    apsReason: initialData?.apsReason || '',
    referralDestination: initialData?.referralDestination || '',
    transferDestinationRoom: initialData?.transferDestinationRoom || '',
    transferUnit: initialData?.transferUnit || '',
    transferClass: initialData?.transferClass || '',
    transferRoom: initialData?.transferRoom || '',
    transferBed: initialData?.transferBed || '',
  });

  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Derived state for dependent dropdowns
  const availableClasses = React.useMemo(() => {
    return formData.unitTujuan ? (masterData.unitToClasses[formData.unitTujuan] || []) : [];
  }, [formData.unitTujuan, masterData.unitToClasses]);

  const availableRooms = React.useMemo(() => {
    if (!formData.unitTujuan || !formData.kelasRawat) return [];
    const key = `${formData.unitTujuan} - ${formData.kelasRawat}`;
    return masterData.classToRooms[key] || [];
  }, [formData.unitTujuan, formData.kelasRawat, masterData.classToRooms]);

  const availableBeds = React.useMemo(() => {
    return formData.ruangan ? (masterData.roomToBeds[formData.ruangan] || []) : [];
  }, [formData.ruangan, masterData.roomToBeds]);

  const availableTransferClasses = React.useMemo(() => {
    return formData.transferUnit ? (masterData.unitToClasses[formData.transferUnit] || []) : [];
  }, [formData.transferUnit, masterData.unitToClasses]);

  const availableTransferRooms = React.useMemo(() => {
    if (!formData.transferUnit || !formData.transferClass) return [];
    const key = `${formData.transferUnit} - ${formData.transferClass}`;
    return masterData.classToRooms[key] || [];
  }, [formData.transferUnit, formData.transferClass, masterData.classToRooms]);

  const availableTransferBeds = React.useMemo(() => {
    return formData.transferRoom ? (masterData.roomToBeds[formData.transferRoom] || []) : [];
  }, [formData.transferRoom, masterData.roomToBeds]);

  const [nurseSearch, setNurseSearch] = useState('');
  const [isNurseDropdownOpen, setIsNurseDropdownOpen] = useState(false);

  const [dpjpSearch, setDpjpSearch] = useState('');
  const [isDpjpDropdownOpen, setIsDpjpDropdownOpen] = useState(false);

  const [originSearch, setOriginSearch] = useState('');
  const [isOriginDropdownOpen, setIsOriginDropdownOpen] = useState(false);

  const dpjpRef = React.useRef<HTMLDivElement>(null);
  const nurseRef = React.useRef<HTMLDivElement>(null);
  const originRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dpjpRef.current && !dpjpRef.current.contains(event.target as Node)) {
        setIsDpjpDropdownOpen(false);
      }
      if (nurseRef.current && !nurseRef.current.contains(event.target as Node)) {
        setIsNurseDropdownOpen(false);
      }
      if (originRef.current && !originRef.current.contains(event.target as Node)) {
        setIsOriginDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const sortedOrigins = React.useMemo(() => {
    let list = [...(masterData.refs?.asalMasuk || [])];
    if (originSearch) {
      list = list.filter(o => o.toLowerCase().includes(originSearch.toLowerCase()));
    }
    return list;
  }, [masterData.refs?.asalMasuk, originSearch]);

  const sortedDoctors = React.useMemo(() => {
    let list = [...masterData.doctors];
    if (dpjpSearch) {
      list = list.filter(d => d.toLowerCase().includes(dpjpSearch.toLowerCase()));
    }
    return list;
  }, [masterData.doctors, dpjpSearch]);

  const sortedNurses = React.useMemo(() => {
    // Sourced directly from users list with role 'PPJA' or position containing 'ppja' or 'primer'
    let list = (masterData.users || [])
      .filter((u: any) => {
        const role = String(u.role || '').toLowerCase();
        const pos = String(u.position || '').toLowerCase();
        return role === 'ppja' || pos.includes('ppja') || pos.includes('primer');
      })
      .map((u: any) => u.name);

    // Filter to ensure uniqueness
    list = Array.from(new Set(list));

    if (currentUser?.name) {
      const isCurrentUserPPJA = String(currentUser.role || '').toLowerCase() === 'ppja' || 
                                String(currentUser.position || '').toLowerCase().includes('ppja') || 
                                String(currentUser.position || '').toLowerCase().includes('primer');
      if (isCurrentUserPPJA) {
        list = [currentUser.name, ...list.filter(n => n !== currentUser.name)];
      }
    }

    if (nurseSearch) {
      list = list.filter(n => n.toLowerCase().includes(nurseSearch.toLowerCase()));
    }
    return list;
  }, [masterData.users, currentUser, nurseSearch]);

  const handleToggleDPJP = (doctor: string) => {
    const current = formData.dpjpList || [];
    const trimmedDoc = doctor.trim();
    const isSelected = current.map(d => d.toLowerCase().trim()).includes(trimmedDoc.toLowerCase());
    
    if (isSelected) {
      setFormData({ 
        ...formData, 
        dpjpList: current.filter(d => d.trim().toLowerCase() !== trimmedDoc.toLowerCase()) 
      });
    } else {
      setFormData({ 
        ...formData, 
        dpjpList: Array.from(new Set([...current, trimmedDoc])) 
      });
    }
  };

  const handleTogglePayment = (method: string) => {
    const current = formData.paymentMethod || [];
    if (current.includes(method)) {
      setFormData({ ...formData, paymentMethod: current.filter(m => m !== method) });
    } else {
      setFormData({ ...formData, paymentMethod: [...current, method] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const requiredFields = {
      noRM: 'Nomor RM',
      name: 'Nama Pasien',
      gender: 'Jenis Kelamin',
      entryDate: 'Tanggal MRS',
      origin: 'Asal Masuk',
      unitTujuan: 'Unit Tujuan',
      perawatPrimer: 'Perawat Primer'
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!formData[field as keyof typeof requiredFields]) {
        setError(`Mohon lengkapi data wajib: ${label}`);
        return;
      }
    }

    const finalData = { ...formData };
    
    // Auto-update core fields if transferring room
    const isPindah = formData.statusDataPasien && (
      formData.statusDataPasien.toUpperCase().includes('PINDAH') || 
      formData.statusDataPasien.toUpperCase().includes('RUANGAN LAIN')
    );
    if (isPindah) {
      const isTransferringOut = initialData && initialData.unitTujuan === 'Ruang Bedah' && formData.transferUnit !== 'Ruang Bedah';
      const isSameUnit = initialData && formData.transferUnit === initialData.unitTujuan;
      
      if (isSameUnit) {
        finalData.statusDataPasien = "Masih Dirawat";
        finalData.status = "ADMITTED";
        finalData.dischargeDate = "";
        finalData.dischargeTime = "";
      } else if (isTransferringOut) {
        finalData.statusDataPasien = "Dipindah ke Ruangan Lain";
        finalData.status = "DISCHARGED";
        if (!finalData.dischargeDate) {
          finalData.dischargeDate = new Date().toISOString().split('T')[0];
        }
        if (!finalData.dischargeTime) {
          finalData.dischargeTime = new Date().toTimeString().slice(0, 5);
        }
      }
      
      if (formData.transferUnit) finalData.unitTujuan = formData.transferUnit;
      if (formData.transferClass) finalData.kelasRawat = formData.transferClass;
      if (formData.transferRoom) finalData.ruangan = formData.transferRoom;
      if (formData.transferBed) finalData.nomorBed = formData.transferBed;
      
      finalData.transferDestinationRoom = [
        formData.transferUnit,
        formData.transferClass,
        formData.transferRoom,
        formData.transferBed
      ].filter(Boolean).join(' - ');
    }

    onSave(finalData);
  };

  const isDischargeStatus = (status: string) => {
    if (!status) return false;
    const s = status.toUpperCase();
    return ['BPL', 'APS', 'DIRUJUK', 'DIPINDAH KE RUANGAN LAIN', 'MENINGGAL', 'PINDAH RUANGAN', 'BATAL'].some(item => s.includes(item)) || 
           s.includes('RUANGAN LAIN') ||
           s.includes('PINDAH');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[1.5rem] w-full max-w-5xl max-h-[95vh] shadow-2xl overflow-hidden flex flex-col animate-fade-in">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 border-b flex justify-between items-center bg-white sticky top-0 z-10 text-center sm:text-left">
          <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight truncate pr-4">
            {initialData ? `Edit: ${initialData.name}` : 'Pasien Baru'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 shrink-0">
             <X size={20}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 sm:space-y-10 custom-scrollbar bg-white">
          
          {/* Section 1: IDENTITAS DASAR PASIEN */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600 font-black text-[11px] uppercase tracking-widest">
              <UserIcon size={16}/> Identitas Dasar Pasien
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Register</label>
                <DebouncedInput className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Otomatis..." value={formData.noRegister || ''} onChangeValue={val => setFormData(prev => ({...prev, noRegister: val}))}/>
              </div>
              <div className="md:col-span-3 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Rekam Medis (RM)</label>
                <DebouncedInput required className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="00-00-00" value={formData.noRM || ''} onChangeValue={val => setFormData(prev => ({...prev, noRM: val}))}/>
              </div>
              <div className="md:col-span-6 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Lengkap Pasien</label>
                <DebouncedInput required className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 uppercase" placeholder="Nama sesuai identitas..." value={formData.name || ''} onChangeValue={val => setFormData(prev => ({...prev, name: val}))}/>
              </div>
              <div className="md:col-span-6 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Perawat Primer (PPJA) <span className="text-rose-500 font-bold">*</span>
                </label>
                <div ref={nurseRef} className="relative">
                  <div 
                    onClick={() => setIsNurseDropdownOpen(!isNurseDropdownOpen)}
                    className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold bg-white cursor-pointer flex justify-between items-center"
                  >
                    <span className="truncate">
                      {formData.perawatPrimer || '-- Pilih Perawat Primer --'}
                    </span>
                    <ChevronDown size={16} className="text-slate-400"/>
                  </div>

                  {isNurseDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-xl shadow-2xl z-[110] overflow-hidden flex flex-col max-h-64">
                      <div className="p-3 border-b bg-slate-50">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                          <input 
                            autoFocus
                            type="text"
                            placeholder="Cari nama perawat..."
                            className="w-full pl-9 pr-3 py-2 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            value={nurseSearch}
                            onChange={e => setNurseSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar bg-white">
                        {sortedNurses.length > 0 ? sortedNurses.map(n => (
                          <div 
                            key={n}
                            onClick={() => {
                              setFormData({...formData, perawatPrimer: n});
                              setIsNurseDropdownOpen(false);
                              setNurseSearch('');
                            }}
                            className={`px-4 py-3 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
                              formData.perawatPrimer === n 
                              ? 'bg-blue-50 text-blue-600' 
                              : 'hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            <span>{n}</span>
                            {n === currentUser?.name && (
                              <span className="text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black">SAYA</span>
                            )}
                          </div>
                        )) : (
                          <div className="p-4 text-center text-[10px] font-bold text-slate-400 italic">Tidak ditemukan.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-3 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jenis Kelamin</label>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, gender: 'L'})}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${formData.gender === 'L' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                  >
                    Laki-laki (L)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, gender: 'P'})}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${formData.gender === 'P' ? 'bg-pink-500 border-pink-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                  >
                    Perempuan (P)
                  </button>
                </div>
              </div>
              <div className="md:col-span-3 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Lahir</label>
                <input type="date" className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})}/>
              </div>
              <div className="md:col-span-9 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alamat Domisili</label>
                <DebouncedInput className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Alamat lengkap..." value={formData.address || ''} onChangeValue={val => setFormData(prev => ({...prev, address: val}))}/>
              </div>
            </div>
          </section>

          {/* Section 2: KEDATANGAN & LOKASI RAWAT */}
          <section className="space-y-4 pt-2 border-t border-slate-50">
            <div className="flex items-center gap-2 text-blue-600 font-black text-[11px] uppercase tracking-widest">
              <Calendar size={16}/> Kedatangan & Lokasi Rawat
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal MRS</label>
                <input type="date" required className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.entryDate || ''} onChange={e => setFormData({...formData, entryDate: e.target.value})}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jam MRS (Sensus)</label>
                <input type="time" required className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.entryTime || ''} onChange={e => setFormData({...formData, entryTime: e.target.value})}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Asal Masuk</label>
                <div ref={originRef} className="relative font-sans">
                  <div 
                    onClick={() => setIsOriginDropdownOpen(!isOriginDropdownOpen)}
                    className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold bg-white cursor-pointer min-h-11 flex items-center justify-between transition-all hover:border-slate-350 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <span className={formData.origin ? 'text-slate-800' : 'text-slate-400'}>
                      {formData.origin || '-- Pilih Asal --'}
                    </span>
                    <ChevronDown size={14} className="text-slate-400 shrink-0"/>
                  </div>

                  {isOriginDropdownOpen && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border rounded-xl shadow-2xl z-[120] overflow-hidden flex flex-col max-h-64">
                      <div className="p-2 border-b bg-slate-50">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                          <input 
                            autoFocus
                            type="text"
                            placeholder="Cari asal masuk..."
                            className="w-full pl-9 pr-3 py-1.5 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            value={originSearch}
                            onChange={e => setOriginSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar">
                        {sortedOrigins.length > 0 ? (
                          sortedOrigins.map(o => {
                            const isSelected = formData.origin === o;
                            return (
                              <div 
                                key={o}
                                onClick={() => {
                                  setFormData({ ...formData, origin: o });
                                  setIsOriginDropdownOpen(false);
                                  setOriginSearch('');
                                }}
                                className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
                                  isSelected 
                                    ? 'bg-blue-50 text-blue-700 font-extrabold' 
                                    : 'hover:bg-slate-50 text-slate-600'
                                }`}
                              >
                                <span>{o}</span>
                                {isSelected && <Check size={14} className="text-blue-500" />}
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                            Tidak ditemukan hasil
                          </div>
                        )}
                        <div 
                          onClick={() => {
                            if (originSearch.trim()) {
                              setFormData({ ...formData, origin: originSearch.trim() });
                              setIsOriginDropdownOpen(false);
                              setOriginSearch('');
                            }
                          }}
                          className="px-4 py-2 text-xs font-black text-blue-600 hover:bg-blue-50 border-t cursor-pointer flex items-center gap-2"
                        >
                          {originSearch.trim() ? `+ Tambah "${originSearch.trim()}"` : '+ Ketik untuk Tambah Baru'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Tujuan</label>
                <SearchableSelect
                  disabled={currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'BIDANG'}
                  placeholder="-- Pilih Unit --"
                  options={masterData.units.filter(u => {
                    if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG') return true;
                    return u === currentUser?.unit;
                  })}
                  value={formData.unitTujuan || ''}
                  onChange={val => {
                    const classes = masterData.unitToClasses[val] || [];
                    const autoClass = classes.length === 1 ? classes[0] : '';
                    let autoRoom = '';
                    if (autoClass) {
                      const rooms = masterData.classToRooms[`${val} - ${autoClass}`] || [];
                      if (rooms.length === 1) autoRoom = rooms[0];
                    }
                    setFormData({...formData, unitTujuan: val, kelasRawat: autoClass, ruangan: autoRoom, nomorBed: ''});
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Kelas Rawat {!formData.unitTujuan && <small className="text-blue-500 lowercase ml-1">(Pilih unit dulu)</small>}
                </label>
                <select 
                  disabled={!formData.unitTujuan} 
                  className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none bg-white disabled:bg-slate-50 disabled:opacity-60" 
                  value={formData.kelasRawat || ''} 
                  onChange={e => {
                    const val = e.target.value;
                    const rooms = masterData.classToRooms[`${formData.unitTujuan} - ${val}`] || [];
                    const autoRoom = rooms.length === 1 ? rooms[0] : '';
                    setFormData({...formData, kelasRawat: val, ruangan: autoRoom, nomorBed: ''});
                  }}
                >
                  <option value="">-- Pilih Kelas --</option>
                  {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Ruangan {!formData.kelasRawat && <small className="text-blue-500 lowercase ml-1">(Pilih kelas dulu)</small>}
                </label>
                <SearchableSelect
                  disabled={!formData.kelasRawat}
                  options={availableRooms}
                  value={formData.ruangan || ''}
                  onChange={val => {
                    const beds = masterData.roomToBeds[val] || [];
                    const autoBed = beds.length === 1 ? beds[0] : '';
                    setFormData({...formData, ruangan: val, nomorBed: autoBed});
                  }}
                  placeholder="-- Pilih Ruangan --"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Nomor Bed {!formData.ruangan && <small className="text-blue-500 lowercase ml-1">(Pilih ruangan dulu)</small>}
                </label>
                <select 
                  disabled={!formData.ruangan} 
                  className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none bg-white disabled:bg-slate-50 disabled:opacity-60" 
                  value={formData.nomorBed || ''} 
                  onChange={e => setFormData({...formData, nomorBed: e.target.value})}
                >
                  <option value="">-- Bed --</option>
                  {availableBeds.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Data Pasien</label>
                <select className={`w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none transition-all ${isDischargeStatus(formData.statusDataPasien) ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`} value={formData.statusDataPasien || ''} onChange={e => setFormData({...formData, statusDataPasien: e.target.value, status: isDischargeStatus(e.target.value) ? 'DISCHARGED' : 'ADMITTED'})}>
                  {(() => {
                    const list = masterData.refs?.statusDataPasien || [];
                    const hasBatal = list.some(s => s.toLowerCase().includes('batal'));
                    const finalOptions = hasBatal ? list : [...list, "Batal Rawat Inap"];
                    return finalOptions.map(s => <option key={s} value={s}>{s}</option>);
                  })()}
                </select>
              </div>

              {isDischargeStatus(formData.statusDataPasien) && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Keluar/Pindah</label>
                    <input type="date" className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.dischargeDate || ''} onChange={e => setFormData({...formData, dischargeDate: e.target.value})}/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jam Keluar/Keluar</label>
                    <input type="time" className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.dischargeTime || ''} onChange={e => setFormData({...formData, dischargeTime: e.target.value})}/>
                  </div>
                  {isDischargeStatus(formData.statusDataPasien) && (formData.statusDataPasien.toUpperCase().includes('APS')) && (
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alasan APS</label>
                      <DebouncedInput className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none" placeholder="Sebutkan alasan pasien pulang paksa/APS..." value={formData.apsReason || ''} onChangeValue={val => setFormData(prev => ({...prev, apsReason: val}))}/>
                    </div>
                  )}
                  {isDischargeStatus(formData.statusDataPasien) && (formData.statusDataPasien.toUpperCase().includes('DIRUJUK') || formData.statusDataPasien.toUpperCase().includes('RUJUK')) && (
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tujuan Rujukan</label>
                      <DebouncedInput className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none" placeholder="Nama RS/Faskes rujukan..." value={formData.referralDestination || ''} onChangeValue={val => setFormData(prev => ({...prev, referralDestination: val}))}/>
                    </div>
                  )}
                  {isDischargeStatus(formData.statusDataPasien) && (formData.statusDataPasien.toUpperCase().includes('PINDAH') || formData.statusDataPasien.toUpperCase().includes('RUANGAN LAIN')) && (
                    <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Tujuan</label>
                        <select className="w-full border rounded-lg px-3 py-2.5 text-sm font-bold outline-none bg-white border-blue-200" value={formData.transferUnit || ''} onChange={e => {
                          const val = e.target.value;
                          const classes = masterData.unitToClasses[val] || [];
                          const autoClass = classes.length === 1 ? classes[0] : '';
                          let autoRoom = '';
                          if (autoClass) {
                            const rooms = masterData.classToRooms[`${val} - ${autoClass}`] || [];
                            if (rooms.length === 1) autoRoom = rooms[0];
                          }
                          setFormData({...formData, transferUnit: val, transferClass: autoClass, transferRoom: autoRoom, transferBed: ''});
                        }}>
                          <option value="">-- Pilih Unit --</option>
                          {masterData.units.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</label>
                        <select className="w-full border rounded-lg px-3 py-2.5 text-sm font-bold outline-none bg-white border-blue-200" value={formData.transferClass || ''} onChange={e => {
                          const val = e.target.value;
                          const rooms = masterData.classToRooms[`${formData.transferUnit} - ${val}`] || [];
                          const autoRoom = rooms.length === 1 ? rooms[0] : '';
                          setFormData({...formData, transferClass: val, transferRoom: autoRoom, transferBed: ''});
                        }}>
                          <option value="">-- Pilih Kelas --</option>
                          {availableTransferClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ruangan</label>
                        <select className="w-full border rounded-lg px-3 py-2.5 text-sm font-bold outline-none bg-white border-blue-200" value={formData.transferRoom || ''} onChange={e => {
                          const val = e.target.value;
                          const beds = masterData.roomToBeds[val] || [];
                          const autoBed = beds.length === 1 ? beds[0] : '';
                          setFormData({...formData, transferRoom: val, transferBed: autoBed});
                        }}>
                          <option value="">-- Pilih Ruangan --</option>
                          {availableTransferRooms.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bed</label>
                        <select className="w-full border rounded-lg px-3 py-2.5 text-sm font-bold outline-none bg-white border-blue-200" value={formData.transferBed || ''} onChange={e => setFormData({...formData, transferBed: e.target.value})}>
                          <option value="">-- Bed --</option>
                          {availableTransferBeds.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  {isDischargeStatus(formData.statusDataPasien) && (formData.statusDataPasien.toUpperCase().includes('MENINGGAL')) && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu Kematian</label>
                      <select className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none bg-red-50 text-red-700 border-red-100" value={formData.deathTime || ''} onChange={e => setFormData({...formData, deathTime: e.target.value as any})}>
                        <option value="">-- Pilih --</option>
                        <option value="<48h">Kurang dari 48 Jam</option>
                        <option value=">=48h">Lebih dari atau Sama dengan 48 Jam</option>
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Section 3: DATA MEDIS & DIAGNOSA */}
          <section className="space-y-4 pt-2 border-t border-slate-50">
            <div className="flex items-center gap-2 text-emerald-600 font-black text-[11px] uppercase tracking-widest">
              <Stethoscope size={16}/> Data Medis & Diagnosa
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnosa Medis (Utama)</label>
                <DebouncedTextarea className="w-full border rounded-lg px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 h-20" placeholder="Contoh: Appendicitis Acute..." value={formData.diagnosaUtama || ''} onChangeValue={val => setFormData(prev => ({...prev, diagnosaUtama: val}))}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnosa Sekunder</label>
                <DebouncedTextarea className="w-full border rounded-lg px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 h-20" placeholder="Contoh: Diabetes Mellitus T2..." value={formData.diagnosaSekunder || ''} onChangeValue={val => setFormData(prev => ({...prev, diagnosaSekunder: val}))}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tindakan / Prosedur</label>
                <DebouncedTextarea className="w-full border rounded-lg px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 h-20" placeholder="Contoh: Laparoscopy Appendectomy..." value={formData.tindakanProsedur || ''} onChangeValue={val => setFormData(prev => ({...prev, tindakanProsedur: val}))}/>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Dokter Penanggung Jawab Pelayanan (DPJP)
              </label>
              <div ref={dpjpRef} className="relative font-sans">
                {/* Selected DPJP Display / Toggle Dropdown Button */}
                <div 
                  onClick={() => setIsDpjpDropdownOpen(!isDpjpDropdownOpen)}
                  className="w-full border rounded-xl p-3 bg-white cursor-pointer min-h-11 flex flex-wrap gap-1.5 items-center justify-between transition-all hover:border-slate-350 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <div className="flex flex-wrap gap-1.5 items-center max-w-[90%]">
                    {formData.dpjpList && formData.dpjpList.length > 0 ? (
                      formData.dpjpList.map((doc, idx) => {
                        const isDpjpUtama = idx === 0;
                        return (
                          <span 
                            key={doc}
                            className={`inline-flex items-center gap-1.5 ${isDpjpUtama ? 'bg-[#005B60]/10 text-[#005B60] border-[#005B60]/20' : 'bg-emerald-50 text-emerald-700 border-emerald-150'} font-extrabold text-[9px] uppercase tracking-wider px-2 py-1 rounded-lg border cursor-default`}
                            onClick={(e) => {
                              e.stopPropagation(); // Safe boundary: clicking tag space doesn't toggle
                            }}
                          >
                            {doc} {isDpjpUtama && <span className="text-[7px] bg-[#005B60] text-white px-1 font-black rounded uppercase">UTAMA</span>}
                            {!isDpjpUtama && (
                              <span 
                                className="hover:bg-emerald-200/50 rounded-full p-0.5 text-emerald-600 cursor-pointer transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation(); // Only the click on the visual 'x' will do the removal toggle
                                  handleToggleDPJP(doc);
                                }}
                              >
                                <X size={8} className="stroke-[3px]"/>
                              </span>
                            )}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-slate-400 text-xs font-bold font-sans">-- Pilih DPJP (Dapat memilih lebih dari 1) --</span>
                    )}
                  </div>
                  <ChevronDown size={16} className="text-slate-400 shrink-0"/>
                </div>

                {/* Dropdown Menu block */}
                {isDpjpDropdownOpen && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border rounded-xl shadow-2xl z-[120] overflow-hidden flex flex-col max-h-64">
                    <div className="p-3 border-b bg-slate-50">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input 
                          autoFocus
                          type="text"
                          placeholder="Cari nama DPJP..."
                          className="w-full pl-9 pr-3 py-2 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                          value={dpjpSearch}
                          onChange={e => setDpjpSearch(e.target.value)}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar">
                      {sortedDoctors.length > 0 ? sortedDoctors.map(doc => {
                        const isSelected = formData.dpjpList?.includes(doc);
                        return (
                          <div 
                            key={doc}
                            onClick={() => handleToggleDPJP(doc)}
                            className={`px-4 py-3 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
                              isSelected 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                checked={!!isSelected} 
                                readOnly 
                                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 pointer-events-none"
                              />
                              <span>{doc}</span>
                            </span>
                          </div>
                        );
                      }) : (
                        <div className="p-4 text-center text-[10px] font-bold text-slate-400 italic">Tidak ditemukan.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 4: ADMINISTRASI & PEMBIAYAAN */}
          <section className="space-y-6 pt-2 border-t border-slate-50 pb-6">
            <div className="flex items-center gap-2 text-orange-500 font-black text-[11px] uppercase tracking-widest">
              <Wallet size={16}/> Administrasi & Pembiayaan
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Metode Pembayaran (Bisa Pilih Lebih dari 1)</label>
              <div className="flex flex-wrap gap-2">
                {masterData.refs.caraBayar.map(method => (
                  <button 
                    key={method}
                    type="button"
                    onClick={() => handleTogglePayment(method)}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${formData.paymentMethod?.includes(method) ? 'bg-orange-500 border-orange-500 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-orange-200'}`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor SEP</label>
                <DebouncedInput className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none" placeholder="0001R..." value={formData.noSEP || ''} onChangeValue={val => setFormData(prev => ({...prev, noSEP: val}))}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status SEP</label>
                <select className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none bg-white" value={formData.statusSEP || ''} onChange={e => setFormData({...formData, statusSEP: e.target.value})}>
                  {masterData.refs.statusSep.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jenis Kecelakaan (KLL)</label>
                <select className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none bg-white" value={formData.jenisKLL || 'Bukan KLL'} onChange={e => setFormData({...formData, jenisKLL: e.target.value})}>
                  {masterData.refs.jenisKll.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Laporan Polisi (LP)</label>
                <DebouncedInput className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none" placeholder="No LP..." value={formData.noLP || ''} onChangeValue={val => setFormData(prev => ({...prev, noLP: val}))}/>
              </div>
               <div className="md:col-span-3 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan Tambahan / Catatan Khusus</label>
                <DebouncedTextarea className="w-full border rounded-lg px-4 py-2.5 text-sm font-medium outline-none h-20" placeholder="Alergi obat, catatan risiko, dll..." value={formData.catatanKhusus || ''} onChangeValue={val => setFormData(prev => ({...prev, catatanKhusus: val}))}/>
              </div>
            </div>
          </section>

          {/* Section 5: RIWAYAT & KONTAK DARURAT */}
          <section className="space-y-4 pt-2 border-t border-slate-50 pb-6">
            <div className="flex items-center gap-2 text-rose-500 font-black text-[11px] uppercase tracking-widest">
              <AlertCircle size={16}/> Riwayat & Kontak Darurat
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-12 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-rose-500">Riwayat Alergi</label>
                <DebouncedTextarea className="w-full border border-rose-100 bg-rose-50/20 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500/20 h-20" placeholder="Sebutkan alergi (obat, makanan, dsb) jika ada..." value={formData.allergyHistory || ''} onChangeValue={val => setFormData(prev => ({...prev, allergyHistory: val}))}/>
              </div>
            </div>
          </section>

        </form>

        <div className="px-4 sm:px-8 py-4 sm:py-6 border-t bg-slate-50 flex flex-col sm:flex-row justify-between items-center sticky bottom-0 gap-4">
          <div className="text-red-500 text-[10px] sm:text-xs font-bold order-2 sm:order-1">
            {error && <span className="flex items-center gap-1"><AlertCircle size={14}/> {error}</span>}
          </div>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto order-1 sm:order-2">
            {initialData && (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || (currentUser?.role === 'KARU' && initialData.unitTujuan === currentUser.unit)) && (
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowDeleteConfirm(true);
                }}
                className="bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-widest"
              >
                Hapus
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} className="flex-1 sm:px-6 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-widest">Batal</Button>
            <Button onClick={handleSubmit} className="flex-[2] sm:px-10 py-2.5 font-black uppercase text-[10px] sm:text-[11px] tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg rounded-xl flex items-center justify-center gap-2">
              <Save size={18}/> {initialData ? 'Simpan' : 'Daftar Pasien'}
            </Button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && initialData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl w-full max-w-sm border border-slate-100 relative">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="font-black text-slate-800 text-2xl tracking-tight mb-2">Konfirmasi Hapus</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                Anda yakin ingin menghapus data <b className="text-slate-700">"{initialData.name}"</b>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-4 w-full">
                <Button 
                  variant="secondary" 
                  className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-50"
                  onClick={() => setShowDeleteConfirm(false)}
                  type="button"
                >
                  Batal
                </Button>
                <button 
                  type="button"
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-200"
                  onClick={() => {
                    if (onDelete) {
                      onDelete(initialData.id);
                      onClose();
                    }
                    setShowDeleteConfirm(false);
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
});
