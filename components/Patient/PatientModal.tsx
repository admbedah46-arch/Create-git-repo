
import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Calendar, MapPin, Bed as BedIcon, ClipboardList, Stethoscope, Wallet, Save, Activity, ShieldCheck, FileText, LayoutGrid, Clock, AlertCircle, ChevronDown, Search } from 'lucide-react';
import { Patient, MasterData, User } from '../../types';
import { Button } from '../Button';

interface PatientModalProps {
  onClose: () => void;
  onSave: (patient: Omit<Patient, 'id'>) => void;
  onDelete?: (id: string) => void;
  masterData: MasterData;
  currentUser: User | null;
  initialData?: Patient;
}

export const PatientModal: React.FC<PatientModalProps> = ({ onClose, onSave, onDelete, masterData, currentUser, initialData }) => {
  const [formData, setFormData] = useState<Omit<Patient, 'id'>>({
    noRegister: initialData?.noRegister || '',
    noRM: initialData?.noRM || '',
    name: initialData?.name || '',
    gender: initialData?.gender || 'L',
    birthDate: initialData?.birthDate || '',
    address: initialData?.address || '',
    entryDate: initialData?.entryDate || new Date().toISOString().split('T')[0],
    origin: initialData?.origin || '',
    unitTujuan: initialData?.unitTujuan || '',
    kelasRawat: initialData?.kelasRawat || '',
    ruangan: initialData?.ruangan || '',
    nomorBed: initialData?.nomorBed || '',
    statusDataPasien: initialData?.statusDataPasien || 'Masih Dirawat',
    diagnosaUtama: initialData?.diagnosaUtama || '',
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

  useEffect(() => {
    if (!initialData && currentUser?.unit && currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'BIDANG') {
      const val = currentUser.unit;
      const classes = masterData.unitToClasses[val] || [];
      const autoClass = classes.length === 1 ? classes[0] : '';
      let autoRoom = '';
      if (autoClass) {
        const rooms = masterData.classToRooms[`${val} - ${autoClass}`] || [];
        if (rooms.length === 1) autoRoom = rooms[0];
      }
      setFormData(prev => ({
        ...prev,
        unitTujuan: val,
        kelasRawat: autoClass,
        ruangan: autoRoom
      }));
    }
  }, [currentUser, masterData, initialData]);

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

  const sortedNurses = React.useMemo(() => {
    let list = [...masterData.nurses];
    if (currentUser?.name) {
      list = [currentUser.name, ...list.filter(n => n !== currentUser.name)];
    }
    if (nurseSearch) {
      list = list.filter(n => n.toLowerCase().includes(nurseSearch.toLowerCase()));
    }
    return list;
  }, [masterData.nurses, currentUser, nurseSearch]);

  const handleToggleDPJP = (doctor: string) => {
    const current = formData.dpjpList || [];
    if (current.includes(doctor)) {
      setFormData({ ...formData, dpjpList: current.filter(d => d !== doctor) });
    } else {
      setFormData({ ...formData, dpjpList: [...current, doctor] });
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
      unitTujuan: 'Unit Tujuan'
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!formData[field as keyof typeof requiredFields]) {
        setError(`Mohon lengkapi data wajib: ${label}`);
        return;
      }
    }

    const finalData = { ...formData };
    
    // Auto-update core fields if transferring room
    if (isDischargeStatus(formData.statusDataPasien) && (formData.statusDataPasien.toUpperCase().includes('PINDAH') || formData.statusDataPasien.toUpperCase().includes('RUANGAN LAIN'))) {
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
    return ['BPL', 'APS', 'DIRUJUK', 'DIPINDAH KE RUANGAN LAIN', 'MENINGGAL', 'PINDAH RUANGAN'].includes(s) || 
           s.includes('APS') || 
           s.includes('BPL') || 
           s.includes('MENINGGAL') || 
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
                <input className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Otomatis..." value={formData.noRegister || ''} onChange={e => setFormData({...formData, noRegister: e.target.value})}/>
              </div>
              <div className="md:col-span-3 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Rekam Medis (RM)</label>
                <input required className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="00-00-00" value={formData.noRM || ''} onChange={e => setFormData({...formData, noRM: e.target.value})}/>
              </div>
              <div className="md:col-span-6 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Lengkap Pasien</label>
                <input required className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 uppercase" placeholder="Nama sesuai identitas..." value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}/>
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
                <input className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Alamat lengkap..." value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})}/>
              </div>
            </div>
          </section>

          {/* Section 2: KEDATANGAN & LOKASI RAWAT */}
          <section className="space-y-4 pt-2 border-t border-slate-50">
            <div className="flex items-center gap-2 text-blue-600 font-black text-[11px] uppercase tracking-widest">
              <Calendar size={16}/> Kedatangan & Lokasi Rawat
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal MRS</label>
                <input type="date" required className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.entryDate || ''} onChange={e => setFormData({...formData, entryDate: e.target.value})}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asal Masuk</label>
                <select required className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none bg-white" value={formData.origin || ''} onChange={e => setFormData({...formData, origin: e.target.value})}>
                  <option value="">-- Pilih Asal --</option>
                  {masterData.refs.asalMasuk.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Tujuan</label>
                <select 
                  required 
                  disabled={currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'BIDANG'}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none bg-white disabled:bg-slate-50 disabled:opacity-80" 
                  value={formData.unitTujuan || ''} 
                  onChange={e => {
                    const val = e.target.value;
                    const classes = masterData.unitToClasses[val] || [];
                    const autoClass = classes.length === 1 ? classes[0] : '';
                    let autoRoom = '';
                    if (autoClass) {
                      const rooms = masterData.classToRooms[`${val} - ${autoClass}`] || [];
                      if (rooms.length === 1) autoRoom = rooms[0];
                    }
                    setFormData({...formData, unitTujuan: val, kelasRawat: autoClass, ruangan: autoRoom, nomorBed: ''});
                  }}
                >
                  <option value="">-- Pilih Unit --</option>
                  {masterData.units.filter(u => {
                    if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG') return true;
                    return u === currentUser?.unit;
                  }).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
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
                <select 
                  disabled={!formData.kelasRawat} 
                  className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none bg-white disabled:bg-slate-50 disabled:opacity-60" 
                  value={formData.ruangan || ''} 
                  onChange={e => {
                    const val = e.target.value;
                    const beds = masterData.roomToBeds[val] || [];
                    const autoBed = beds.length === 1 ? beds[0] : '';
                    setFormData({...formData, ruangan: val, nomorBed: autoBed});
                  }}
                >
                  <option value="">-- Pilih Ruangan --</option>
                  {availableRooms.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
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
                  {masterData.refs.statusDataPasien.map(s => <option key={s} value={s}>{s}</option>)}
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
                      <input className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none" placeholder="Sebutkan alasan pasien pulang paksa/APS..." value={formData.apsReason || ''} onChange={e => setFormData({...formData, apsReason: e.target.value})}/>
                    </div>
                  )}
                  {isDischargeStatus(formData.statusDataPasien) && (formData.statusDataPasien.toUpperCase().includes('DIRUJUK') || formData.statusDataPasien.toUpperCase().includes('RUJUK')) && (
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tujuan Rujukan</label>
                      <input className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none" placeholder="Nama RS/Faskes rujukan..." value={formData.referralDestination || ''} onChange={e => setFormData({...formData, referralDestination: e.target.value})}/>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnosa Medis (Utama)</label>
                <textarea className="w-full border rounded-lg px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 h-20" placeholder="Contoh: Appendicitis Acute..." value={formData.diagnosaUtama || ''} onChange={e => setFormData({...formData, diagnosaUtama: e.target.value})}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tindakan / Prosedur</label>
                <textarea className="w-full border rounded-lg px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 h-20" placeholder="Contoh: Laparoscopy Appendectomy..." value={formData.tindakanProsedur || ''} onChange={e => setFormData({...formData, tindakanProsedur: e.target.value})}/>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dokter Penanggung Jawab Pelayanan (DPJP)</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                {masterData.doctors.map(doc => (
                  <label key={doc} className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg transition-all ${formData.dpjpList?.includes(doc) ? 'bg-white shadow-sm ring-1 ring-emerald-500/30' : 'hover:bg-white/50'}`}>
                    <input type="checkbox" checked={formData.dpjpList?.includes(doc)} onChange={() => handleToggleDPJP(doc)} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"/>
                    <span className={`text-[10px] font-bold truncate ${formData.dpjpList?.includes(doc) ? 'text-emerald-700' : 'text-slate-500'}`}>{doc}</span>
                  </label>
                ))}
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
                <input className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none" placeholder="0001R..." value={formData.noSEP || ''} onChange={e => setFormData({...formData, noSEP: e.target.value})}/>
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
                <input className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none" placeholder="No LP..." value={formData.noLP || ''} onChange={e => setFormData({...formData, noLP: e.target.value})}/>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perawat Primer (PPJA)</label>
                <div className="relative">
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
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-xl shadow-2xl z-[110] overflow-hidden flex flex-col max-h-64">
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
                      <div className="overflow-y-auto custom-scrollbar">
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan Tambahan / Catatan Khusus</label>
                <textarea className="w-full border rounded-lg px-4 py-2.5 text-sm font-medium outline-none h-20" placeholder="Alergi obat, catatan risiko, dll..." value={formData.catatanKhusus || ''} onChange={e => setFormData({...formData, catatanKhusus: e.target.value})}/>
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
                <textarea className="w-full border border-rose-100 bg-rose-50/20 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500/20 h-20" placeholder="Sebutkan alergi (obat, makanan, dsb) jika ada..." value={formData.allergyHistory || ''} onChange={e => setFormData({...formData, allergyHistory: e.target.value})}/>
              </div>
              <div className="md:col-span-6 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Kontak Darurat</label>
                <input className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Nama wali/kerabat..." value={formData.emergencyContactName || ''} onChange={e => setFormData({...formData, emergencyContactName: e.target.value})}/>
              </div>
              <div className="md:col-span-6 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor HP Kontak Darurat</label>
                <input className="w-full border rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="08xxxxxx" value={formData.emergencyContactPhone || ''} onChange={e => setFormData({...formData, emergencyContactPhone: e.target.value})}/>
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
};
