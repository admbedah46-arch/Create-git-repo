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

  const filteredPatients = useMemo(() => {
    let list = appData.patients || [];
    
    // Filter by unit if not super admin or bidang
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'BIDANG') {
      list = list.filter(p => p.unitTujuan === currentUser.unit);
    }
    
    return list.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.noRM.includes(searchTerm)
    );
  }, [appData.patients, searchTerm, currentUser]);

  const selectedPatient = useMemo(() => 
    appData.patients?.find(p => p.id === selectedPatientId),
    [appData.patients, selectedPatientId]
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Manajemen Pasien</h3>
          <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest flex items-center gap-2">
            <User size={14} className="text-blue-500"/> Kelola data identitas dan riwayat klinis pasien
          </p>
        </div>
        <Button onClick={onAddPatient} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
          <UserPlus size={18} className="mr-2" /> Pasien Baru
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Patient List Section */}
        <div className={`lg:col-span-${selectedPatientId ? '5' : '12'} transition-all duration-300`}>
          <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col h-[700px]">
            <div className="p-6 border-b bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Cari Nama atau No. RM..."
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {filteredPatients.length > 0 ? (
                <div className="space-y-1">
                  {filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
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
            <div className="bg-white rounded-[2.5rem] border shadow-sm h-[700px] flex flex-col overflow-hidden">
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
                          if (window.confirm(`Hapus data pasien ${selectedPatient.name}?`)) {
                            onDeletePatient(selectedPatient.id);
                            setSelectedPatientId(null);
                          }
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
                  
                  <div className="relative pl-6 border-l-2 border-slate-100 ml-3 space-y-8">
                    {/* Log Admission */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm"></div>
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                           <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider">Masuk Rawat Inap</span>
                           <span className="text-[10px] font-bold text-slate-400">{selectedPatient.entryDate}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-700">Pasien masuk melalui <span className="text-blue-600">{selectedPatient.origin}</span> menuju unit <span className="text-blue-600">{selectedPatient.unitTujuan}</span></p>
                        <div className="mt-3 text-[10px] font-bold text-slate-400 bg-slate-50 p-2 rounded-xl border border-slate-100">
                          Diagnosa: {selectedPatient.diagnosaUtama || 'Belum diisi'}
                        </div>
                      </div>
                    </div>

                    {/* Log Discharge if applicable */}
                    {selectedPatient.dischargeDate && (
                      <div className="relative">
                        <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm"></div>
                        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                             <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Keluar Rawat Inap</span>
                             <span className="text-[10px] font-bold text-slate-400">{selectedPatient.dischargeDate}</span>
                          </div>
                          <p className="text-xs font-bold text-slate-700">Pasien dinyatakan <span className="text-emerald-600">{selectedPatient.statusDataPasien}</span></p>
                          {selectedPatient.deathTime && (
                           <div className="mt-2 text-[10px] font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-full w-fit">
                             MENINGGAL {selectedPatient.deathTime}
                           </div>
                          )}
                        </div>
                      </div>
                    )}
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
    </div>
  );
};
