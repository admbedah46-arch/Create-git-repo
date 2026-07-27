import React, { useState, useMemo } from 'react';
import { Search, UserPlus, History, Eye, Filter, User, Calendar, CreditCard, ChevronRight, Activity, AlertCircle, Phone } from 'lucide-react';
import { AppData, Patient, User as AppUser } from '../../types';
import { Button } from '../Button';

interface PatientModuleProps {
  appData: AppData;
  onEditPatient: (patient: Patient) => void;
  onAddPatient: () => void;
  onDeletePatient: (id: string) => void;
  currentUser: AppUser | null;
}

export const PatientModule: React.FC<PatientModuleProps> = ({ appData, onEditPatient, onAddPatient, onDeletePatient, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Patient | null>(null);

  const [selectedUnit, setSelectedUnit] = useState<string>('Semua Unit');

  const filteredPatients = useMemo(() => {
    let list = appData.patients || [];
    
    if (selectedUnit !== 'Semua Unit') {
      list = list.filter(p => p.unitTujuan === selectedUnit);
    }
    
    return list.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.noRM.includes(searchTerm)
    );
  }, [appData.patients, searchTerm, selectedUnit]);

  const selectedPatient = useMemo(() => 
    appData.patients?.find(p => p.id === selectedPatientId),
    [appData.patients, selectedPatientId]
  );

  const patientStays = useMemo(() => {
    if (!selectedPatient?.noRM) return [];
    return (appData.patients || [])
      .filter(p => p.noRM === selectedPatient.noRM)
      .sort((a, b) => {
        const dateA = new Date(`${a.entryDate}T${a.entryTime || '00:00'}`);
        const dateB = new Date(`${b.entryDate}T${b.entryTime || '00:00'}`);
        return dateA.getTime() - dateB.getTime();
      });
  }, [appData.patients, selectedPatient]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black uppercase tracking-tight" style={{ color: appData.masterData.settings?.fontColor || '#1e293b' }}>Manajemen Pasien</h3>
          <p className="text-xs font-bold mt-1 uppercase tracking-widest flex items-center gap-2" style={{ color: appData.masterData.settings?.fontColor ? `${appData.masterData.settings.fontColor}99` : '#94a3b8' }}>
            <User size={14} className="text-blue-500"/> Kelola data identitas dan riwayat klinis pasien
          </p>
        </div>
        <Button onClick={onAddPatient} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
          <UserPlus size={18} className="mr-2" /> Pasien Baru
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Patient List Section */}
        <div className={`transition-all duration-300 ${selectedPatientId ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col h-[700px]">
            <div className="p-6 border-b bg-slate-50/50 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Cari Nama atau No. RM..."
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="py-3 px-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
              >
                <option value="Semua Unit">Semua Unit ({appData.patients?.length || 0})</option>
                {(appData.masterData?.units || []).map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {filteredPatients.length > 0 ? (
                <div className="space-y-1">
                  {filteredPatients.map((patient, idx) => (
                    <button
                      key={`${patient.id}-${idx}`}
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-3xl text-left transition-all group ${
                        selectedPatientId === patient.id 
                        ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' 
                        : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                        selectedPatientId === patient.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-black uppercase truncate ${selectedPatientId === patient.id ? 'text-white' : 'text-slate-800'}`}>
                          {patient.name}
                        </div>
                        <div className={`text-[10px] font-bold flex items-center gap-2 ${selectedPatientId === patient.id ? 'text-blue-100' : 'text-slate-400'}`}>
                          <span className="bg-current/10 px-2 py-0.5 rounded-full">{patient.noRM}</span>
                          <span>{patient.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className={`opacity-0 group-hover:opacity-100 transition-opacity ${selectedPatientId === patient.id ? 'text-white' : 'text-slate-300'}`} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <User size={32} />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-widest">Pasien tidak ditemukan</p>
                  <p className="text-[10px] mt-1">Coba gunakan kata kunci lain</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History Detail Section */}
        {selectedPatient && (
          <div className="lg:col-span-7 animate-in slide-in-from-right duration-500">
            <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] border shadow-sm h-[700px] flex flex-col overflow-hidden">
              {/* Header Details */}
              <div className="p-8 border-b bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                       <span className="px-3 py-1 bg-blue-500 text-[10px] font-black uppercase rounded-full tracking-wider">No. RM {selectedPatient.noRM}</span>
                       <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full tracking-wider ${
                         selectedPatient.status === 'ADMITTED' ? 'bg-emerald-500' : 'bg-slate-600'
                       }`}>
                         {selectedPatient.status === 'ADMITTED' ? 'Sedang Dirawat' : 'Sudah Keluar'}
                       </span>
                    </div>
                    <h4 className="text-3xl font-black uppercase tracking-tight leading-none mb-1">{selectedPatient.name}</h4>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                       {selectedPatient.gender === 'L' ? 'Laki-laki' : 'Perempuan'} • {selectedPatient.birthDate || 'Tanggal Lahir Tidak Ada'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => onEditPatient(selectedPatient)}
                      className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl"
                    >
                      Edit Data
                    </Button>
                    {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || (['KARU', 'SEKRU', 'PPJA', 'PIC'].includes(currentUser?.role || '') && selectedPatient.unitTujuan === currentUser?.unit)) && (
                      <Button 
                        onClick={() => {
                          setDeleteConfirmTarget(selectedPatient);
                        }}
                        className="bg-rose-600/40 hover:bg-rose-600 text-white border border-rose-500/30 rounded-2xl"
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs / Content History */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-slate-50/30">
                {/* Profile Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unit Terakhir</label>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Activity size={16}/></div>
                      <span className="font-black text-slate-700 uppercase text-sm">{selectedPatient.unitTujuan}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Cara Bayar</label>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><CreditCard size={16}/></div>
                      <span className="font-black text-slate-700 uppercase text-sm">{selectedPatient.paymentMethod?.join(', ') || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Allergy & Emergency Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-rose-50 rounded-3xl border border-rose-100 shadow-sm transition-all hover:shadow-md">
                    <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-2">Riwayat Alergi</label>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
                        <AlertCircle size={16}/>
                      </div>
                      <span className="font-bold text-rose-700 text-xs italic">
                        {selectedPatient.allergyHistory || 'Tidak ada riwayat alergi'}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100 shadow-sm transition-all hover:shadow-md">
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Kontak Darurat</label>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <Phone size={16}/>
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-sm font-black text-blue-800 uppercase truncate">
                          {selectedPatient.emergencyContactName || '-'}
                        </div>
                        <div className="text-xs font-bold text-blue-600 truncate">
                          {selectedPatient.emergencyContactPhone || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Patient Journey / Activity Log */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-widest">
                    <History size={16} className="text-indigo-500" /> Riwayat Aktivitas & Pergerakan
                  </div>
                  
                  <div className="relative pl-6 border-l-2 border-slate-100 ml-3 space-y-6">
                    {patientStays.map((stay, stayIdx) => {
                      const isActive = ["Masih Dirawat", "AKTIF"].includes(stay.statusDataPasien || '') || stay.status === 'ADMITTED';
                      return (
                        <div key={stay.id} className="relative">
                          <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-white shadow-sm ${
                            isActive ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}></div>
                          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider ${
                                isActive ? 'text-emerald-500' : 'text-slate-500'
                              }`}>
                                Periode {stayIdx + 1}: {stay.unitTujuan} {isActive ? '(Sedang Dirawat)' : '(Selesai Rawat)'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">
                                {stay.entryDate} {stay.entryTime ? `@ ${stay.entryTime}` : ''}
                                {stay.dischargeDate ? ` s/d ${stay.dischargeDate} ${stay.dischargeTime ? `@ ${stay.dischargeTime}` : ''}` : ' s/d Sekarang'}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-700 leading-normal">
                              Kamar/Ruangan: <span className="text-indigo-600 font-extrabold">{stay.ruangan || '-'}</span> | Bed: <span className="text-indigo-600 font-extrabold">{stay.nomorBed || '-'}</span> | Kelas: <span className="text-slate-500">{stay.kelasRawat || '-'}</span>
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 items-center justify-between">
                              <div className="text-[10px] font-bold text-slate-400">
                                Diagnosa: <span className="text-slate-600 font-extrabold">{stay.diagnosaUtama || '-'}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'bg-slate-50 text-slate-600 border border-slate-200'
                              }`}>
                                Status: {stay.statusDataPasien || 'Masih Dirawat'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Additional Clinical Info */}
                <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                   <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Catatan Khusus Medis</h5>
                   <p className="text-xs font-bold text-indigo-700 leading-relaxed italic">
                     {selectedPatient.catatanKhusus || '"Tidak ada catatan khusus untuk pasien ini."'}
                   </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteConfirmTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl w-full max-w-md border border-slate-100 relative">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="font-black text-slate-800 text-2xl tracking-tight mb-2">Konfirmasi Hapus</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                Anda yakin ingin menghapus data <b className="text-slate-700">"{deleteConfirmTarget.name}"</b>? Tindakan ini tidak dapat dibatalkan.
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
                    onDeletePatient(deleteConfirmTarget.id);
                    setSelectedPatientId(null);
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
