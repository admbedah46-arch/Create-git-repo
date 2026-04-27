import React, { useState, useEffect, useMemo } from 'react';
import { IncidentReport, Patient, SimpleInvestigation, User as UserType } from '../../types';
import { Button } from '../Button';
import { AlertCircle, Plus, CheckCircle2, Clock, ShieldAlert, Send, Bell, Filter, Search, MoreVertical, X, UserSearch, FileText, User as UserIcon, MapPin, Activity, Phone, ClipboardList, PenTool, RefreshCw, Eye, Printer, ChevronRight, Trash2 } from 'lucide-react';
import { InvestigationForm } from './InvestigationForm';

interface IncidentModuleProps {
  reports: IncidentReport[];
  patients: Patient[];
  currentUser?: UserType | null;
  onAddReport: (report: Partial<IncidentReport>) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onDeleteReport: (id: string) => void;
}

const severityStyles = {
  BLUE: 'bg-blue-50 text-blue-600 border-blue-200',
  GREEN: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  YELLOW: 'bg-amber-50 text-amber-600 border-amber-200',
  ORANGE: 'bg-orange-50 text-orange-600 border-orange-200',
  RED: 'bg-rose-50 text-rose-600 border-rose-200'
};

const statusIcons = {
  'NEW': <Clock className="text-amber-500" size={18}/>,
  'INVESTIGATING': <Search className="text-blue-500" size={18}/>,
  'RESOLVED': <CheckCircle2 className="text-emerald-500" size={18}/>
};

const getAgeCategory = (age: number) => {
  if (age < 1) return "< 1 tahun";
  if (age <= 5) return "1 - 5 tahun";
  if (age <= 14) return "> 5 - 14 tahun";
  if (age <= 24) return "> 14 - 24 tahun";
  if (age <= 44) return "> 24 - 44 tahun";
  if (age <= 65) return "> 44 - 65 tahun";
  return "> 65 tahun";
};

export const IncidentModule: React.FC<IncidentModuleProps> = ({ reports, patients, onAddReport, onUpdateStatus, onDeleteReport, currentUser }) => {
  const [showForm, setShowForm] = useState(false);
  const [isKPC, setIsKPC] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [investigatingReport, setInvestigatingReport] = useState<IncidentReport | null>(null);
  const [viewingReport, setViewingReport] = useState<IncidentReport | null>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);

  useEffect(() => {
    const styleId = 'print-styles-incident';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @media print {
          body > #root > *:not(.print-overlay),
          body > div:not(.print-overlay) {
            display: none !important;
          }
          #print-area, #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            right: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 30px !important;
            background: white !important;
            min-height: 100% !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          /* Ensure scrollable containers show full content in print */
          .overflow-y-auto, .custom-scrollbar {
            overflow: visible !important;
            max-height: none !important;
          }
          /* Reset backgrounds for better printing */
          .bg-slate-900 { background: #1e293b !important; color: white !important; -webkit-print-color-adjust: exact; }
          .bg-indigo-600 { background: #4f46e5 !important; color: white !important; -webkit-print-color-adjust: exact; }
          .bg-slate-50 { background: #f8fafc !important; -webkit-print-color-adjust: exact; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Alert for debugging
    console.log("Tombol cetak ditekan");
    
    try {
      window.focus();
      // Inform the user
      const isIframe = window.self !== window.top;
      
      setTimeout(() => {
        const printSuccess = window.print();
        // Note: window.print() is usually void or returns undefined, so we can't easily detect success
      }, 300);
      
      if (isIframe) {
        console.log("Membuka jendela cetak... Jika tidak muncul, silakan klik 'Buka di Tab Baru' di kanan atas layar.");
      }
    } catch (e) {
      console.error("Print feature failed:", e);
      alert("Gagal mencetak. Silakan klik tombol 'Buka di Tab Baru' (ikon kotak dengan panah) di pojok kanan atas aplikasi ini, lalu coba cetak kembali dari sana.");
    }
  };
  
  const [newReport, setNewReport] = useState<Partial<IncidentReport>>({
    severity: 'BLUE',
    incidentType: 'KNC',
    isKPC: false,
    reporterType: '',
    affectedParty: 'PASIEN',
    patientServiceCategory: '',
    specialtyCase: '',
    wasSameIncidentBefore: false,
    impact: 'Tidak ada cedera',
    actionPerformer: ''
  });

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(patientSearchTerm.toLowerCase()) || 
    p.noRM.includes(patientSearchTerm)
  );

  const displayReports = useMemo(() => {
    let list = reports || [];
    
    if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG') {
      return list;
    }
    
    if (currentUser?.role === 'STAFF') {
      // Staff only sees their own reports
      return list.filter(r => r.reporterUsername === currentUser?.username);
    }
    
    // Others (KARU, SEKRU, PIC, PPJA) see reports for their unit
    return list.filter(r => r.responsibleUnit === currentUser?.unit);
  }, [reports, currentUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReport = {
      ...newReport,
      reporterUsername: currentUser?.username,
      reporterName: currentUser?.name || newReport.reporterName,
      responsibleUnit: currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'BIDANG' ? currentUser?.unit : newReport.responsibleUnit,
      reportDate: new Date().toISOString().split('T')[0]
    };
    onAddReport(finalReport);
    setShowForm(false);
    setNewReport({
      severity: 'BLUE',
      incidentType: 'KNC',
      isKPC: false,
      reporterType: '',
      affectedParty: 'PASIEN',
      patientServiceCategory: '',
      specialtyCase: '',
      wasSameIncidentBefore: false,
      impact: 'Tidak ada cedera',
      actionPerformer: ''
    });
  };

  const handleInvestigationSave = (investigation: SimpleInvestigation) => {
    console.log('Saving investigation:', investigation);
    onUpdateStatus(investigatingReport!.id, 'RESOLVED');
    setInvestigatingReport(null);
  };

  const canInvestigate = ['PIC', 'KARU', 'PPJA', 'SUPER_ADMIN'].includes(currentUser?.role || '');

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Incident Tracking</h2>
          <p className="text-slate-500 font-bold text-sm tracking-tight">Manajemen Pelaporan & Analisis Insiden Keselamatan Pasien</p>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="secondary" className="px-5 rounded-2xl">
             <Filter size={18} className="mr-2"/> Filter
           </Button>
           <Button onClick={() => setShowForm(true)} className="bg-slate-800 text-white px-6 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">
             <Plus size={20} className="mr-2"/> Laporkan Insiden
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 flex items-center justify-center text-rose-600">
            <AlertCircle size={32}/>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-800">{reports.length}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Laporan</div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock size={32}/>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-800">{reports.filter(r => r.status === 'NEW' || !r.status).length}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Menunggu Review</div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={32}/>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-800">{reports.filter(r => r.status === 'RESOLVED').length}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selesai Investigasi</div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border-2 border-slate-100 flex flex-col">
              <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-white">
                       <ShieldAlert size={24}/>
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Formulir Laporan Insiden Baru</h3>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pastikan data yang diinput akurat & objektif</p>
                    </div>
                 </div>
                 <button onClick={() => setShowForm(false)} className="p-3 hover:bg-slate-200 rounded-2xl text-slate-400 transition-all"><X size={24}/></button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar space-y-10">
                 <section className="space-y-6">
                    <div className="flex items-center gap-3 text-rose-600 font-black text-xs uppercase tracking-[0.2em]">
                       <UserSearch size={20}/> I. Informasi Pasien & Identitas
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2 relative">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cari Nama Pasien / No. RM</label>
                          <div className="relative">
                            <input 
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-sm font-black text-slate-800 uppercase tracking-tight focus:ring-2 focus:ring-rose-500/20 outline-none" 
                              placeholder="Ketik nama atau no rekam medis..." 
                              value={patientSearchTerm}
                              onChange={(e) => {
                                setPatientSearchTerm(e.target.value);
                                setShowPatientResults(true);
                              }}
                            />
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                          </div>
                          
                          {showPatientResults && patientSearchTerm && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border shadow-2xl rounded-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                              {filteredPatients.length > 0 ? filteredPatients.map(p => (
                                <button 
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setNewReport({
                                      ...newReport,
                                      patientId: p.id,
                                      patientName: p.name,
                                      noRM: p.noRM,
                                      age: p.age,
                                      gender: p.gender,
                                      paymentMethod: p.paymentMethod,
                                      ageCategory: getAgeCategory(p.age)
                                    });
                                    setPatientSearchTerm(p.name);
                                    setShowPatientResults(false);
                                  }}
                                  className="w-full px-6 py-4 text-left hover:bg-slate-50 flex justify-between items-center border-b last:border-0"
                                >
                                  <div>
                                    <div className="text-sm font-black text-slate-800 uppercase">{p.name}</div>
                                    <div className="text-[10px] font-bold text-slate-400">{p.noRM} • {p.room}</div>
                                  </div>
                                  <ChevronRight size={16} className="text-slate-300"/>
                                </button>
                              )) : (
                                <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase italic">Pasien tidak ditemukan.</div>
                              )}
                            </div>
                          )}
                       </div>

                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Penanggung Biaya</label>
                          <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500/20" value={newReport.paymentMethod || ''} onChange={e => setNewReport({...newReport, paymentMethod: e.target.value})}>
                             <option value="">Pilih Metode Pembayaran</option>
                             <option value="BPJS">BPJS Kesehatan</option>
                             <option value="Umum">Umum / Mandiri</option>
                             <option value="Asuransi Lain">Asuransi Swasta</option>
                             <option value="Jamkesda">Jamkesda</option>
                          </select>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">Nama Pasien</label>
                          <div className="text-sm font-black text-slate-800">{newReport.patientName || '-'}</div>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">No. RM</label>
                          <div className="text-sm font-bold text-slate-600">{newReport.noRM || '-'}</div>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">Kategori Umur</label>
                          <div className="text-sm font-bold text-slate-600">{newReport.ageCategory || '-'}</div>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">Jenis Kelamin</label>
                          <div className="text-sm font-bold text-slate-600">{newReport.gender || '-'}</div>
                       </div>
                    </div>
                 </section>

                 <section className="space-y-6">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-xs uppercase tracking-[0.2em]">
                       <Clock size={20}/> II. Waktu & Lokasi Kejadian
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tanggal</label>
                          <input type="date" required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold outline-none" value={newReport.date || ''} onChange={e => setNewReport({...newReport, date: e.target.value})} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Jam Kejadian</label>
                          <input type="time" required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold outline-none" value={newReport.time || ''} onChange={e => setNewReport({...newReport, time: e.target.value})} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Ruangan / Tempat</label>
                          <input required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-sm font-black text-slate-800 uppercase tracking-tight" placeholder="Ex: Unit Gawat Darurat" value={newReport.location || ''} onChange={e => setNewReport({...newReport, location: e.target.value})} />
                       </div>
                    </div>
                 </section>

                 <section className="space-y-6">
                    <div className="flex items-center gap-3 text-amber-600 font-black text-xs uppercase tracking-[0.2em]">
                       <FileText size={20}/> III. Rincian Kejadian Insiden
                    </div>
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Judul Insiden</label>
                          <input required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-sm font-black text-slate-800 uppercase tracking-tight focus:ring-2 focus:ring-rose-500/20 outline-none" placeholder="Masukkan judul singkat kejadian..." value={newReport.incidentName || ''} onChange={e => setNewReport({...newReport, incidentName: e.target.value})} />
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipe Insiden (KNC / KTC / KPC / KTD / SENTINEL)</label>
                             <div className="grid grid-cols-5 gap-2">
                                {['KNC', 'KTC', 'KTD', 'SENTINEL', 'KPC'].map(type => (
                                   <button 
                                     key={type}
                                     type="button"
                                     onClick={() => setNewReport({...newReport, incidentType: type})}
                                     className={`py-3 rounded-xl text-[10px] font-black transition-all border-2 ${newReport.incidentType === type ? 'bg-slate-800 text-white border-slate-800 scale-105 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                                   >
                                      {type}
                                   </button>
                                ))}
                             </div>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Siapa yang Melaporkan?</label>
                             <select required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold text-slate-700 outline-none" value={newReport.reporterType || ''} onChange={e => setNewReport({...newReport, reporterType: e.target.value})}>
                                <option value="">Pilih Kategori Pelapor</option>
                                <option value="Karyawan">Karyawan (Dokter / Perawat / Staf)</option>
                                <option value="Pasien">Pasien sendiri</option>
                                <option value="Keluarga">Keluarga / Pendamping Pasien</option>
                                <option value="Pengunjung">Pengunjung Puskesmas</option>
                                <option value="Lainnya">Lainnya</option>
                             </select>
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Kronologi Kejadian (Deskripsi lengkap & objektif)</label>
                          <textarea required className="w-full bg-white border border-slate-200 rounded-[2rem] p-6 text-sm font-medium text-slate-600 min-h-[150px] outline-none focus:ring-2 focus:ring-rose-500/20" placeholder="Ceritakan secara detail urutan kejadian..." value={newReport.chronology || ''} onChange={e => setNewReport({...newReport, chronology: e.target.value})}></textarea>
                       </div>
                    </div>
                 </section>

                 <div className="bg-slate-50 p-10 rounded-[3rem] border-2 border-dashed border-slate-200 flex justify-end gap-4">
                    <Button type="button" onClick={() => setShowForm(false)} variant="secondary" className="px-10 rounded-2xl font-black uppercase text-xs tracking-widest">Batalkan</Button>
                    <Button type="submit" className="bg-slate-800 text-white px-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Kirim Laporan</Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {investigatingReport && (
        <InvestigationForm 
          report={investigatingReport}
          onClose={() => setInvestigatingReport(null)}
          onSave={handleInvestigationSave}
        />
      )}

      <div className="grid grid-cols-1 gap-6">
        {displayReports.length > 0 ? displayReports.sort((a,b) => b.id.localeCompare(a.id)).map(report => (
          <div key={report.id} className="bg-white rounded-[2.5rem] border shadow-sm p-8 group hover:shadow-xl transition-all relative overflow-hidden">
             {report.incidentType === 'SENTINEL' && <div className="absolute top-0 left-0 w-2 h-full bg-rose-600"></div>}
             <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                   <div className="flex items-center gap-3">
                      <span className={`px-4 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest ${severityStyles[report.severity || 'BLUE']}`}>
                        GRADE {report.severity}
                      </span>
                      {report.isKPC && <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">KPC REPORT</span>}
                      {report.investigation && (report.investigation.tabularTimeline.length > 0 || report.investigation.analysis.length > 0) && (
                        <span className="bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                          <CheckCircle2 size={10}/> Analysis OK
                        </span>
                      )}
                   </div>
                   <h4 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mt-2">{report.incidentName} <button onClick={() => setViewingReport(report)} className="inline-flex items-center ml-2 text-blue-600 hover:text-blue-800"><Eye size={16}/></button></h4>
                </div>
                <div className="flex items-center gap-3">
                   {statusIcons[report.status]}
                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{report.status}</span>
                   <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><MoreVertical size={18}/></button>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-8">
                   <div className="p-6 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                         <div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Pasien</div>
                            <div className="text-xs font-black text-slate-800 uppercase">{report.patientName}</div>
                         </div>
                         <div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Ruangan</div>
                            <div className="text-xs font-bold text-slate-600">{report.room}</div>
                         </div>
                         <div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Waktu</div>
                            <div className="text-xs font-bold text-slate-600">{report.date} • {report.time}</div>
                         </div>
                         <div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Lokasi</div>
                            <div className="text-xs font-bold text-slate-600 uppercase italic">{report.location}</div>
                         </div>
                      </div>
                   </div>
                </div>
                <div className="md:col-span-4 flex flex-col justify-center gap-4">
                    <div className="flex items-center justify-between px-1">
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tindakan Lanjut</div>
                       <div className="flex flex-wrap gap-2">
                          {canInvestigate ? (
                             <Button 
                               onClick={() => setInvestigatingReport(report)}
                               disabled={report.status === 'RESOLVED'}
                               className={`px-6 rounded-2xl text-[10px] font-bold uppercase transition-all shadow-md ${report.status === 'RESOLVED' ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-white hover:scale-105 shadow-xl'}`}
                             >
                               {report.status === 'RESOLVED' ? 'Internal RCA Selesai' : 'Review & Investigasi'}
                             </Button>
                          ) : (
                            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
                               <Clock size={14} className="text-slate-400"/>
                               <p className="text-[10px] font-black text-slate-400 uppercase">Input Selesai • Menunggu Review Karu / PIC</p>
                            </div>
                          )}
                          {(currentUser?.role === 'SUPER_ADMIN' || 
                            currentUser?.role === 'BIDANG' || 
                            (['KARU', 'SEKRU', 'PPJA', 'PIC'].includes(currentUser?.role || '') && report.responsibleUnit === currentUser?.unit)) && (
                            <Button 
                              onClick={() => {
                                if (window.confirm('Hapus laporan insiden ini?')) {
                                  onDeleteReport(report.id);
                                }
                              }}
                              variant="secondary" 
                              className="px-3 rounded-xl text-red-500 hover:bg-red-50"
                            >
                              <Trash2 size={14}/>
                            </Button>
                          )}
                          <Button onClick={() => setViewingReport(report)} variant="secondary" className="px-3 rounded-xl"><Eye size={14}/></Button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        )) : (
          <div className="bg-white border-4 border-dashed rounded-[3rem] p-32 text-center flex flex-col items-center justify-center opacity-40">
             <ShieldAlert size={80} className="mb-6 text-slate-200"/>
             <p className="text-2xl font-black text-slate-300 uppercase tracking-[0.3em]">Zero Incidents Logged</p>
             <p className="text-sm font-bold text-slate-300 mt-2">Puskesmas dalam status Hijau & Aman.</p>
          </div>
        )}
      </div>

      {viewingReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border flex flex-col relative">
            <button 
              onClick={() => setViewingReport(null)}
              className="absolute top-6 right-6 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-all z-10"
            >
              <X size={24}/>
            </button>
            
            <div className="p-8 sm:p-12 overflow-y-auto custom-scrollbar flex-1">
              <style>{`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #print-area, #print-area * {
                    visibility: visible !important;
                  }
                  #print-area {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 40px !important;
                    background: white !important;
                    height: auto !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                  .overflow-y-auto {
                    overflow: visible !important;
                    max-height: none !important;
                  }
                  .custom-scrollbar {
                    overflow: visible !important;
                  }
                }
              `}</style>
              
              <div id="print-area">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Detail Laporan Insiden Puskesmas</span>
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{viewingReport.puskesmasName || 'Aplikasi Pelaporan Insiden'}</span>
                </div>
                
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${severityStyles[viewingReport.severity || 'BLUE']}`}>
                    GRADE {viewingReport.severity}
                  </span>
                  <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                    {viewingReport.incidentType}
                  </span>
                  {viewingReport.isKPC && (
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                      KPC REPORT
                    </span>
                  )}
                </div>
                
                <h3 className="text-4xl font-black text-slate-800 tracking-tighter uppercase mb-8 border-b pb-8">
                  {viewingReport.incidentName}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-8">
                     <section className="space-y-4">
                        <div className="flex items-center gap-2 text-rose-500 font-black text-[10px] uppercase tracking-[0.2em]">
                          <Activity size={16}/> I. Data Pasien & Administrasi
                        </div>
                        <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase">Nama Pasien</label>
                                <div className="text-sm font-black text-slate-800">{viewingReport.patientName || '-'}</div>
                             </div>
                             <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase">No. RM / Ruangan</label>
                                <div className="text-sm font-bold text-slate-600">{viewingReport.noRM || '-'} • {viewingReport.room || '-'}</div>
                             </div>
                             <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase">Umur / JK</label>
                                <div className="text-sm font-bold text-slate-600">{viewingReport.ageCategory || '-'} / {viewingReport.gender || '-'}</div>
                             </div>
                             <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase">Penanggung Biaya</label>
                                <div className="text-sm font-bold text-slate-600 font-mono">{viewingReport.paymentMethod || '-'}</div>
                             </div>
                          </div>
                        </div>
                     </section>

                     <section className="space-y-4">
                        <div className="flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase tracking-[0.2em]">
                          <Clock size={16}/> II. Waktu Kejadian
                        </div>
                        <div className="bg-blue-50/30 rounded-3xl p-6 border border-blue-100/50">
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase">Tgl Kejadian</label>
                                <div className="text-sm font-black text-slate-700">{viewingReport.date}</div>
                             </div>
                             <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase">Jam Kejadian</label>
                                <div className="text-sm font-black text-slate-700">{viewingReport.time}</div>
                             </div>
                          </div>
                        </div>
                     </section>

                     <section className="space-y-4">
                        <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-[0.2em]">
                          <MapPin size={16}/> III. Detail Lokasi & Unit
                        </div>
                        <div className="bg-emerald-50/30 rounded-3xl p-6 border border-emerald-100/50 space-y-4">
                           <div>
                              <label className="text-[8px] font-black text-slate-400 uppercase">Tempat Kejadian</label>
                              <div className="text-sm font-bold text-slate-700 uppercase tracking-tight">{viewingReport.location}</div>
                           </div>
                           <div>
                              <label className="text-[8px] font-black text-slate-400 uppercase">Unit Kerja Terkait</label>
                              <div className="text-sm font-bold text-slate-700 uppercase tracking-tight">{viewingReport.responsibleUnit}</div>
                           </div>
                        </div>
                     </section>
                  </div>

                  <div className="space-y-8">
                     <section className="space-y-4">
                        <div className="flex items-center gap-2 text-amber-500 font-black text-[10px] uppercase tracking-[0.2em]">
                          <FileText size={16}/> IV. Kronologi & Tindakan
                        </div>
                        <div className="space-y-4">
                           <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl">
                              <label className="text-[8px] font-black text-slate-500 uppercase block mb-3 tracking-widest">Kronologi Kejadian</label>
                              <p className="text-sm font-medium leading-relaxed italic text-slate-300">
                                 "{viewingReport.chronology}"
                              </p>
                           </div>
                           <div className="p-6 bg-white border border-slate-200 rounded-3xl space-y-3">
                              <label className="text-[8px] font-black text-slate-400 uppercase block tracking-widest">Tindakan Langsung</label>
                              <p className="text-sm font-bold text-slate-700">
                                 {viewingReport.immediateAction || '-'}
                              </p>
                              <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                                 <div className="text-[10px] font-black text-slate-400 uppercase">Oleh:</div>
                                 <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{viewingReport.actionPerformer}</div>
                              </div>
                           </div>
                        </div>
                     </section>

                     <section className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">
                          <PenTool size={16}/> V. Pelapor & Administrasi
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-slate-50 rounded-2xl">
                              <label className="text-[8px] font-black text-slate-400 uppercase">Pelapor</label>
                              <div className="text-xs font-black text-slate-700">{viewingReport.reporterName}</div>
                              <div className="text-[9px] font-bold text-slate-400 mt-1">{viewingReport.reporterType}</div>
                           </div>
                           <div className="p-4 bg-slate-50 rounded-2xl">
                              <label className="text-[8px] font-black text-slate-400 uppercase">Penerima</label>
                              <div className="text-xs font-black text-slate-700">{viewingReport.receiverName || '-'}</div>
                           </div>
                        </div>
                     </section>

                     {viewingReport.investigation && (viewingReport.investigation.tabularTimeline.length > 0 || viewingReport.investigation.analysis.length > 0) && (
                       <section className="col-span-full border-t pt-12 mt-4 space-y-10">
                          <div className="flex items-center gap-3 text-indigo-600 font-black text-xs uppercase tracking-[0.3em]">
                            <ShieldAlert size={20}/> VI. Hasil Investigasi & Analisis (RCA)
                          </div>

                          {viewingReport.investigation.tabularTimeline.length > 0 && (
                            <div className="space-y-6">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tabular Timeline</label>
                              <div className="overflow-hidden border border-slate-100 rounded-[2rem] shadow-sm">
                                <table className="w-full text-left border-collapse">
                                  <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Waktu</th>
                                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Kejadian</th>
                                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Informasi Tambahan</th>
                                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Good Practice</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {viewingReport.investigation.tabularTimeline.map((step) => (
                                      <tr key={step.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-5 text-xs font-black text-indigo-600 font-mono">{step.time}</td>
                                        <td className="px-6 py-5 text-xs font-bold text-slate-600">{step.event}</td>
                                        <td className="px-6 py-5 text-xs font-medium text-slate-400">{step.info}</td>
                                        <td className="px-6 py-5 text-xs font-bold text-emerald-600 italic">"{step.goodPractice}"</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {viewingReport.investigation.analysis.length > 0 && (
                            <div className="space-y-8">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analisis Akar Masalah (5 Whys)</label>
                              <div className="grid grid-cols-1 gap-6">
                                {viewingReport.investigation.analysis.map((item) => (
                                  <div key={item.id} className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                                      <ShieldAlert size={120} className="text-slate-900"/>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
                                      <div className="md:col-span-4 space-y-3">
                                        <div className="text-[10px] font-black text-rose-500 uppercase">Identifikasi Masalah (CMP/SDP)</div>
                                        <p className="text-sm font-black text-slate-800 leading-snug">{item.problem}</p>
                                      </div>
                                      <div className="md:col-span-8 flex flex-col md:flex-row gap-4 items-start md:items-center">
                                        <div className="flex-1 space-y-2">
                                          <div className="text-[8px] font-black text-slate-400 uppercase">Mengapa? (Level 1)</div>
                                          <div className="p-3 bg-white rounded-xl text-xs font-bold border">{item.immediateCause}</div>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-300 hidden md:block pt-4"/>
                                        <div className="flex-1 space-y-2">
                                          <div className="text-[8px] font-black text-slate-400 uppercase">Mengapa? (Level 2)</div>
                                          <div className="p-3 bg-white rounded-xl text-xs font-bold border">{item.why2}</div>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-300 hidden md:block pt-4"/>
                                        <div className="flex-1 space-y-2">
                                          <div className="text-[8px] font-black text-slate-400 uppercase">Mengapa? (Level 3)</div>
                                          <div className="p-3 bg-white rounded-xl text-xs font-bold border">{item.why3}</div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-8 pt-8 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                                      <div className="p-5 bg-indigo-600 rounded-3xl shadow-lg relative overflow-hidden">
                                         <div className="text-[9px] font-black text-indigo-200 uppercase mb-2 tracking-widest">Akar Masalah (Root Cause)</div>
                                         <p className="text-sm font-black text-white">{item.rootCause}</p>
                                         <div className="absolute -bottom-2 -right-2 opacity-10">
                                           <CheckCircle2 size={60} className="text-white"/>
                                         </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-white rounded-2xl border">
                                          <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Komponen Kontributor</div>
                                          <div className="text-[10px] font-black text-slate-700">{item.contributorComponent}</div>
                                        </div>
                                        <div className="p-4 bg-white rounded-2xl border">
                                          <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Sub Komponen</div>
                                          <div className="text-[10px] font-black text-slate-700">{item.contributorSubComponent}</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                       </section>
                     )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 px-12 py-8 flex flex-col sm:flex-row justify-between items-center gap-4 border-t no-print relative z-[110]">
               <div className="flex items-center gap-3">
                  <Button 
                    type="button"
                    variant="secondary" 
                    onClick={handlePrint}
                    className="px-6 rounded-2xl font-black uppercase text-[10px] bg-white border-slate-200 hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Printer size={16}/> Cetak Laporan
                  </Button>
               </div>
               <div className="flex gap-4">
                 <Button type="button" variant="secondary" onClick={() => setViewingReport(null)} className="px-8 rounded-2xl font-black uppercase text-[11px]">Tutup</Button>
                 {canInvestigate && (
                   <Button type="button" onClick={() => { setViewingReport(null); setInvestigatingReport(viewingReport); }} className="bg-slate-800 text-white px-8 rounded-2xl font-black uppercase text-[11px]">Buka Investigasi</Button>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
