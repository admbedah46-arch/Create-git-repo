
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Login } from './components/Auth/Login';
import { DataManagement } from './components/Administrator/DataManagement';
import { FinanceModule } from './components/Administration/FinanceModule';
import { IncidentModule } from './components/Incidents/IncidentModule';
import { IncidentMonthlyReport } from './components/Incidents/IncidentMonthlyReport';
import { PatientModal } from './components/Patient/PatientModal';
import { PatientModule } from './components/Patient/PatientModule';
import { CensusAdvanced } from './components/Administrator/CensusAdvanced';
import { InventoryModule } from './components/Administrator/InventoryModule';
import { OperationReportModule } from './components/Administrator/OperationReportModule';
import { ServiceMatrix } from './components/Nursing/ServiceMatrix';
import { QualityWorksheet } from './components/Quality/QualityWorksheet';
import { QualityReports } from './components/Quality/QualityReports';
import { Button } from './components/Button';
import { getDB, saveDB, uploadDataBackground, mergeData, getApiUrl, syncData, uploadData } from './db';
import { AppData, User, FinanceRecord, IncidentReport, Patient, DailyReportEntry, QualityMeasurement, DependencyLevel, Instrument, OperationReport } from './types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area
} from 'recharts';
import { 
  Activity, Wallet, AlertCircle, Calendar, Plus, Search, Filter, 
  TrendingUp, Users, ShieldAlert, BarChart3, Clock, 
  CheckCircle2, Stethoscope, HeartPulse, ClipboardCheck, FileText,
  UserCheck, ClipboardList, FilePieChart, Bed, ArrowRight
} from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [appData, setAppData] = useState<AppData>(getDB());
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [bedUnitFilter, setBedUnitFilter] = useState('Ruang Bedah');
  const [isMobile, setIsMobile] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'danger'} | null>(null);
  const [lastLocalAction, setLastLocalAction] = useState(0);

  const notify = (message: string, type: 'success' | 'danger' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (user?.unit) setBedUnitFilter(user.unit);
  }, [user]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Persistent login check from localStorage
    const savedUser = localStorage.getItem('surgihub_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    // Fetch initial data from server
    const fetchData = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&t=${Date.now()}`);
        const result = await response.json();
        // Apps Script returns { status: "ready", data: ... }
        if ((result.status === 'ready' || result.status === 'success') && result.data) {
          const merged = mergeData(getDB(), result.data);
          setAppData(merged);
          saveDB(merged);
        }
      } catch (e) {
        console.warn('Backend sync unavailable, using local data');
      } finally {
        setIsReady(true);
      }
    };
    
    fetchData();

    // BACKGROUND POLLING: Auto-sync every 30 seconds
    const interval = setInterval(async () => {
      // Avoid polling if we just made a local update (prevents "reappearing data" bug)
      if (Date.now() - lastLocalAction < 10000) return;

      try {
        setSyncStatus('SYNCING');
        const res = await syncData(true);
        if (res.success) {
          const localData = getDB();
          setAppData(localData);
          setSyncStatus('SUCCESS');
          setTimeout(() => setSyncStatus('IDLE'), 2000);
        } else {
          setSyncStatus('IDLE');
        }
      } catch (e) {
        console.warn('Auto-sync check failed');
        setSyncStatus('ERROR');
        setTimeout(() => setSyncStatus('IDLE'), 2000);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [appData]);

  const handleUpdateAppData = async (newData: AppData) => {
    setLastLocalAction(Date.now());
    setAppData(newData);
    saveDB(newData);
    setSyncStatus('SYNCING');
    
    try {
      const res = await uploadData(newData);
      if (res.success) {
        setSyncStatus('SUCCESS');
        setTimeout(() => setSyncStatus('IDLE'), 3000);
      } else {
        setSyncStatus('ERROR');
      }
    } catch (e) {
      console.warn('Google Sheets sync failed, data saved locally');
      setSyncStatus('ERROR');
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('surgihub_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('surgihub_user');
  };

  const handleAddPatient = (patientData: Omit<Patient, 'id'>) => {
    const newData = { ...appData };
    if (editingPatient) {
      newData.patients = (newData.patients || []).map(p => 
        p.id === editingPatient.id ? { ...p, ...patientData } : p
      );
    } else {
      const newPatient: Patient = {
        ...patientData,
        id: `P-${Date.now()}`
      };
      newData.patients = [...(newData.patients || []), newPatient];
    }
    handleUpdateAppData(newData);
    notify(editingPatient ? 'DATA PASIEN DIPERBARUI' : 'PASIEN BARU BERHASIL TERDAFTAR');
    setIsPatientModalOpen(false);
    setEditingPatient(null);
  };

  const handleUpdatePatient = (id: string, updates: Partial<Patient>) => {
    setAppData(prev => {
      const newData = { ...prev };
      newData.patients = (newData.patients || []).map(p => p.id === id ? { ...p, ...updates } : p);
      saveDB(newData);
      uploadDataBackground();
      return newData;
    });
    if (updates.perawatPrimer) notify('PENUGASAN PPJA DIPERBARUI');
  };

  const handleUpdateDailyReport = (patientId: string, type: keyof DailyReportEntry, content: any, date?: string) => {
    setAppData(prev => {
      const newData = { ...prev };
      const targetDate = date || new Date().toISOString().split('T')[0];
      const reports = [...(newData.dailyReports || [])];
      const existingIdx = reports.findIndex(r => r.patientId === patientId && r.date === targetDate);
      
      if (existingIdx > -1) {
        reports[existingIdx] = { ...reports[existingIdx], [type]: content };
      } else {
        const newEntry: DailyReportEntry = {
          patientId,
          date: targetDate,
          [type]: content
        } as DailyReportEntry;
        reports.push(newEntry);
      }
      newData.dailyReports = reports;
      saveDB(newData);
      uploadDataBackground();
      return newData;
    });
    if (type.includes('Report')) notify('LAPORAN SHIFT DISIMPAN');
    if (type.includes('Therapy')) notify('TERAPI MEDIS DIPERBARUI');
  };

  const handleUpdateDependency = (patientId: string, shift: 'morning' | 'afternoon' | 'night', level: DependencyLevel, date?: string) => {
    setAppData(prev => {
      const newData = { ...prev };
      const targetDate = date || new Date().toISOString().split('T')[0];
      const reports = [...(newData.dailyReports || [])];
      const existingIdx = reports.findIndex(r => r.patientId === patientId && r.date === targetDate);
      
      const fieldName = `${shift}Dependency` as keyof DailyReportEntry;
      
      if (existingIdx > -1) {
        reports[existingIdx] = { ...reports[existingIdx], [fieldName]: level } as any;
      } else {
        const newEntry: DailyReportEntry = {
          patientId,
          date: targetDate,
          [fieldName]: level
        } as any;
        reports.push(newEntry);
      }
      newData.dailyReports = reports;
      saveDB(newData);
      uploadDataBackground();
      return newData;
    });
    notify(`TINGKAT KETERGANTUNGAN ${level} CARE BERHASIL DISIMPAN`);
  };

  const handleAddFinance = (rec: FinanceRecord) => {
    const newData = { ...appData };
    newData.financeRecords = [...(newData.financeRecords || []), rec];
    handleUpdateAppData(newData);
    notify('TRANSAKSI KEUANGAN BERHASIL DIPOSTING');
  };

  const handleAddIncident = (rep: IncidentReport) => {
    const newData = { ...appData };
    newData.incidentReports = [...(newData.incidentReports || []), rep];
    handleUpdateAppData(newData);
    notify('LAPORAN INSIDEN BERHASIL TERKIRIM');
  };

  const handleUpdateIncident = (id: string, update: string | Partial<IncidentReport>) => {
    const newData = { ...appData };
    const updates = typeof update === 'string' ? { status: update as IncidentReport['status'] } : update;
    newData.incidentReports = (newData.incidentReports || []).map(r => r.id === id ? { ...r, ...updates } : r);
    handleUpdateAppData(newData);
    notify('STATUS & INVESTIGASI INSIDEN DIPERBARUI');
  };

  const handleUpdateMasterData = (newMasterData: AppData['masterData']) => {
    const newData = { ...appData, masterData: newMasterData };
    handleUpdateAppData(newData);
    // DataManagement has its own notify, but we can call global one too if desired
  };

  const handleSync = async () => {
    setSyncStatus('SYNCING');
    try {
      const res = await syncData(true);
      if (res.success) {
        setAppData(getDB());
        setSyncStatus('SUCCESS');
        setTimeout(() => setSyncStatus('IDLE'), 3000);
      } else {
        setSyncStatus('ERROR');
        if (res.error) setNotification({ message: `Sync Gagal: ${res.error}`, type: 'danger' });
        setTimeout(() => setSyncStatus('IDLE'), 3000);
      }
    } catch (e) {
      console.error('Manual sync failed:', e);
      setSyncStatus('ERROR');
      setTimeout(() => setSyncStatus('IDLE'), 3000);
    }
  };

  const handleSaveQualityMeasurement = (measurement: QualityMeasurement) => {
    const newData = { ...appData };
    const measurements = [...(newData.qualityMeasurements || [])];
    const existingIdx = measurements.findIndex(m => m.indicatorId === measurement.indicatorId && m.date === measurement.date);
    
    if (existingIdx > -1) {
      measurements[existingIdx] = measurement;
    } else {
      measurements.push(measurement);
    }
    
    newData.qualityMeasurements = measurements;
    handleUpdateAppData(newData);
    notify('DATA PENGUKURAN MUTU TERSIMPAN');
  };

  const handleAddInstrument = (inst: Omit<Instrument, 'id'>) => {
    const newData = { ...appData };
    const newInstrument: Instrument = { ...inst, id: `INST-${Date.now()}` };
    newData.instruments = [...(newData.instruments || []), newInstrument];
    handleUpdateAppData(newData);
    notify('INSTRUMEN BARU BERHASIL DITAMBAHKAN');
  };

  const handleUpdateInstrument = (id: string, updates: Partial<Instrument>) => {
    const newData = { ...appData };
    newData.instruments = (newData.instruments || []).map(i => i.id === id ? { ...i, ...updates } : i);
    handleUpdateAppData(newData);
    notify('DATA INSTRUMEN DIPERBARUI');
  };

  const handleAddOperationReport = (report: Omit<OperationReport, 'id' | 'createdAt'>) => {
    const newData = { ...appData };
    const newReport: OperationReport = { 
      ...report, 
      id: `OPR-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    newData.operationReports = [...(newData.operationReports || []), newReport];
    handleUpdateAppData(newData);
    notify('LAPORAN OPERASI BERHASIL DISIMPAN');
  };

  const handleDeletePatient = (id: string) => {
    const newData = { ...appData };
    newData.patients = (newData.patients || []).filter(p => p.id !== id);
    handleUpdateAppData(newData);
    notify('DATA PASIEN DIHAPUS DARI SISTEM', 'danger');
  };

  const handleDeleteIncident = (id: string) => {
    const newData = { ...appData };
    newData.incidentReports = (newData.incidentReports || []).filter(r => r.id !== id);
    handleUpdateAppData(newData);
    notify('LAPORAN INSIDEN TELAH DIHAPUS', 'danger');
  };

  const renderContent = () => {
    const today = new Date().toISOString().split('T')[0];
    const financeRecords = appData.financeRecords || [];
    const incidentReports = appData.incidentReports || [];
    const openIncidents = incidentReports.filter(i => i.status !== 'RESOLVED');

    // Stats calculations
    const patients = appData.patients || [];
    const patientsToday = patients.filter(p => p.entryDate === today).length;
    // Helper to check if patient is effectively discharged
    const isDischarged = (p: Patient) => {
      if (p.status === 'DISCHARGED') return true;
      const s = p.statusDataPasien || '';
      return s.includes('Pulang') || s === 'APS' || s === 'Dirujuk' || s === 'Dipindah ke Ruangan Lain';
    };

    const dischargedToday = patients.filter(isDischarged).length;
    const occupiedBedsCount = patients.filter(p => !isDischarged(p)).length;
    const surgeryToday = (appData.dailyReports || []).filter(r => r.surgeryDate === today).length;
    
    // Bed Occupancy (BOR)
    const totalBedsAcrossUnits: number = (Object.values(appData.masterData.roomToBeds || {}) as string[][]).reduce((acc: number, beds: string[]) => acc + beds.length, 0) || 1;
    const bor = Math.round((occupiedBedsCount / totalBedsAcrossUnits) * 100);

    // Charts data
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const performanceData = last7Days.map(date => ({
      day: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][new Date(date).getDay()],
      val: (appData.dailyReports || []).filter(r => r.surgeryDate === date).length
    }));

    const financeByMonth = Array.from({ length: 4 }, (_, i) => {
      const monthIdx = (new Date().getMonth() - (3 - i) + 12) % 12;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const monthYear = `${monthIdx + 1}`.padStart(2, '0');
      const rev = (appData.financeRecords || [])
        .filter(f => f.type === 'INCOME' && f.date.includes(`-${monthYear}-`))
        .reduce((sum, r) => sum + r.amount, 0) / 1000000;
      return { month: monthNames[monthIdx], rev };
    });

    const surgeriesTodayList = (appData.patients || [])
      .filter(p => {
        const report = (appData.dailyReports || []).find(r => r.patientId === p.id && r.surgeryDate === today);
        return !!report;
      })
      .map(p => {
        const report = (appData.dailyReports || []).find(r => r.patientId === p.id && r.surgeryDate === today);
        return {
          id: p.id,
          time: report?.surgeryDate?.split('T')[1]?.slice(0, 5) || '08:00',
          patient: p.name,
          op: p.diagnosaUtama || 'Proses Pembedahan',
          doc: p.dpjp || 'dr. Bedah, Sp.B'
        };
      });

    switch (activeMenu) {
      case 'dashboard':
        return (
          <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Dashboard Overview</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Monitoring Real-time Pelayanan Bedah</p>
              </div>
              <Button onClick={() => setIsPatientModalOpen(true)} className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white shadow-xl shadow-blue-100">
                <Plus size={18} className="mr-2"/> Registrasi Pasien Baru
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                { label: 'Operasi Hari Ini', val: surgeryToday, icon: <Activity/>, color: 'blue', desc: 'Real-time schedule' },
                { label: 'Revenue Pelayanan', val: `Rp${(financeRecords.filter(f => f.type === 'INCOME').reduce((a, b) => a + b.amount, 0) / 1000000).toFixed(1)}M`, icon: <Wallet/>, color: 'emerald', desc: 'Bulan berjalan' },
                { label: 'Indikator Mutu', val: '98.2%', icon: <HeartPulse/>, color: 'indigo', desc: 'Compliance Rate' },
                { label: 'Insiden Aktif', val: openIncidents.length, icon: <AlertCircle/>, color: 'red', desc: 'Segera tindak lanjuti' }
              ].map((stat) => (
                <div key={stat.label} className="bg-white p-5 sm:p-6 rounded-3xl sm:rounded-[2rem] border shadow-sm group hover:shadow-xl transition-all border-b-4" style={{ borderColor: `var(--tw-color-${stat.color}-500)` }}>
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div className={`p-2 sm:p-3 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl group-hover:scale-110 transition-transform`}>
                      {React.cloneElement(stat.icon as React.ReactElement, { size: isMobile ? 20 : 24 })}
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tighter">{stat.val}</div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold mt-1 uppercase tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col relative overflow-hidden group">
                <div className="flex justify-between items-center mb-12">
                  <h4 className="font-black text-slate-800 text-2xl tracking-tight flex items-center gap-3">
                     <BarChart3 className="text-blue-600"/> Analisis Performance Bedah
                  </h4>
                </div>
                <div className="flex-1 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={12} tick={{fill: '#94a3b8', fontWeight: 700}} />
                      <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{fill: '#94a3b8', fontWeight: 700}} />
                      <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="val" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="lg:col-span-4">
                <div className="bg-slate-900 p-8 rounded-[2.5rem] border shadow-2xl flex flex-col h-full relative overflow-hidden group">
                  <h4 className="font-black text-white text-xl tracking-tight flex items-center gap-3 mb-6">
                    <ShieldAlert className="text-red-500" size={24}/> Critical Alerts
                  </h4>
                  <div className="space-y-4">
                    {incidentReports.length > 0 ? incidentReports.slice(-3).reverse().map(i => (
                      <div key={i.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                          <span className="text-red-400">{i.severity} RISK</span>
                          <span className="text-slate-500">{i.date}</span>
                        </div>
                        <div className="text-xs font-black text-slate-100">{i.incidentType}</div>
                      </div>
                    )) : (
                      <div className="py-8 text-center text-slate-500 font-bold text-xs">Semua aman & terkendali.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'adm-register':
        return (
          <div className="bg-white rounded-[2.5rem] p-12 shadow-sm border text-center animate-fade-in">
             <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                <Users size={40}/>
             </div>
             <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Registrasi Pasien</h3>
             <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <Button onClick={() => setIsPatientModalOpen(true)} className="py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-100">
                  <Plus size={18} className="mr-2"/> Input Pasien Baru
                </Button>
                <Button variant="secondary" className="py-4 rounded-2xl font-black text-xs uppercase tracking-widest">
                  <Search size={18} className="mr-2"/> Cari Data Pasien
                </Button>
             </div>
              <div className="mt-12 text-left">
                <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-4">Pendaftaran Terbaru</h4>
                <div className="bg-slate-50 rounded-3xl p-6 border border-dashed border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase font-black tracking-tighter text-[10px] border-b">
                        <th className="p-4 text-left">Tgl Masuk</th>
                        <th className="p-4 text-left">No. RM</th>
                        <th className="p-4 text-left">Nama Pasien</th>
                        <th className="p-4 text-left">Lokasi Rawat</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(appData.patients || []).length > 0 ? (appData.patients || []).slice(-5).reverse().map(p => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-white transition-colors group">
                          <td className="p-4 font-bold text-slate-600">{p.entryDate}</td>
                          <td className="p-4 font-black text-blue-600">{p.noRM}</td>
                          <td className="p-4 font-black text-slate-800 uppercase">{p.name}</td>
                          <td className="p-4 text-slate-500 font-medium">{p.ruangan} - {p.nomorBed}</td>
                          <td className="p-4 text-center">
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full font-black text-[9px] uppercase">{p.statusDataPasien}</span>
                          </td>
                          <td className="p-4 text-right">
                             <button 
                               onClick={() => {
                                 setEditingPatient(p);
                                 setIsPatientModalOpen(true);
                               }}
                               className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white"
                             >
                               Edit
                             </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-slate-400 font-bold italic">Belum ada data pendaftaran pasien.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        );

      case 'adm-census':
        return <CensusAdvanced appData={appData} currentUser={user} />;

      case 'patients':
        return (
          <PatientModule 
            appData={appData} 
            onAddPatient={() => setIsPatientModalOpen(true)}
            onEditPatient={(p) => {
              setEditingPatient(p);
              setIsPatientModalOpen(true);
            }}
            onDeletePatient={handleDeletePatient}
            currentUser={user}
          />
        );

      case 'adm-data-bed':
        const targetUnit = bedUnitFilter;
        const unitClasses = appData.masterData.unitToClasses[targetUnit] || [];
        
        return (
          <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-white rounded-[2.5rem] p-8 border shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Monitoring Bed & Pasien</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Visualisasi ketersediaan ruangan real-time</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border">
                  <span className="text-[10px] font-black text-slate-400 ml-3 uppercase">Pilih Unit:</span>
                  <select 
                    value={bedUnitFilter}
                    onChange={(e) => setBedUnitFilter(e.target.value)}
                    disabled={user?.role !== 'SUPER_ADMIN' && user?.role !== 'BIDANG'}
                    className="bg-white border-0 text-xs font-black text-blue-600 rounded-xl px-4 py-2 focus:ring-0 cursor-pointer outline-none disabled:opacity-50"
                  >
                    {appData.masterData.units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-12">
                {unitClasses.map(cls => (
                  <div key={cls} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-slate-100"></div>
                      <h4 className="px-6 py-2 bg-slate-800 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em]">{cls}</h4>
                      <div className="h-px flex-1 bg-slate-100"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {(appData.masterData.classToRooms[`${targetUnit} - ${cls}`] || []).map(rm => {
                        const roomBeds = appData.masterData.roomToBeds[rm] || [];
                        const occupiedInRoom = roomBeds.filter(b => (appData.patients || []).some(p => p.ruangan === rm && p.nomorBed === b && p.status !== 'DISCHARGED')).length;
                        const emptyInRoom = roomBeds.length - occupiedInRoom;
                        
                        return (
                          <div key={rm} className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                              <h5 className="text-xs font-black text-slate-700 flex items-center gap-2">
                                <Bed size={14} className="text-blue-500"/> {rm}
                              </h5>
                              <div className="flex gap-2">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[8px] font-black uppercase">Terisi: {occupiedInRoom}</span>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md text-[8px] font-black uppercase">Kosong: {emptyInRoom}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                            {(appData.masterData.roomToBeds[rm] || []).map(b => {
                              const resident = (appData.patients || []).find(p => p.ruangan === rm && p.nomorBed === b && p.status !== 'DISCHARGED');
                              return (
                                <div key={b} className={`p-4 rounded-2xl border transition-all ${resident ? 'bg-white border-blue-200 shadow-md shadow-blue-500/5' : 'bg-white/40 border-slate-200 border-dashed opacity-60'}`}>
                                  <div className="flex justify-between items-start">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${resident ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                      BED {b}
                                    </span>
                                    {resident ? (
                                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-tight">{resident.paymentMethod?.[0] || 'UMUM'}</span>
                                    ) : (
                                      <span className="text-[9px] font-bold text-slate-300 uppercase italic">Kosong</span>
                                    )}
                                  </div>
                                  
                                  {resident ? (
                                    <div className="mt-3 space-y-1">
                                      <div className="text-sm font-black text-slate-800 uppercase leading-tight">{resident.name}</div>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                                        <span className="text-blue-600">RM: {resident.noRM}</span>
                                        <span>•</span>
                                        <span className="truncate max-w-[150px]">{resident.address}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-3 flex items-center justify-center py-2 h-[40px]">
                                      <Plus size={16} className="text-slate-200"/>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        );

      case 'service-schedule':
        return (
          <div className="bg-white rounded-[2.5rem] p-8 border shadow-sm animate-fade-in">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-8 flex items-center gap-3">
              <Calendar className="text-blue-600"/> Jadwal Operasi (Real-time)
            </h3>
            <div className="space-y-4">
               {surgeriesTodayList.length > 0 ? surgeriesTodayList.map((o) => (
                 <div key={o.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white rounded-2xl border flex flex-col items-center justify-center">
                         <div className="text-lg font-black text-slate-800">{o.time}</div>
                         <div className="text-[8px] font-black text-slate-400">WIB</div>
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800 uppercase truncate max-w-[200px]">{o.patient}</div>
                        <div className="text-xs font-medium text-slate-500 truncate max-w-[250px]">{o.op}</div>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs font-black text-blue-600 uppercase tracking-tight">{o.doc}</div>
                       <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-black uppercase mt-1 inline-block">Scheduled</span>
                    </div>
                 </div>
               )) : (
                 <div className="py-20 text-center text-slate-400 font-bold italic border-2 border-dashed rounded-3xl">
                    Belum ada jadwal operasi untuk hari ini.
                 </div>
               )}
            </div>
          </div>
        );

      case 'service-report':
        return (
          <OperationReportModule 
            reports={appData.operationReports || []}
            patients={appData.patients || []}
            onSaveReport={handleAddOperationReport}
            currentUser={user}
          />
        );

      case 'finance-visite':
        return (
          <div className="bg-white rounded-[2.5rem] p-8 border shadow-sm animate-fade-in">
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-8">Rekapitulasi Visite Dokter</h3>
             <div className="overflow-hidden border rounded-2xl">
                <table className="w-full text-xs text-left">
                   <thead className="bg-slate-50 font-black text-slate-500 uppercase tracking-widest text-[9px]">
                      <tr>
                        <th className="p-4">Dokter DPJP</th>
                        <th className="p-4">Pasien</th>
                        <th className="p-4">Tanggal</th>
                        <th className="p-4">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y">
                      <tr>
                        <td className="p-4 font-bold">dr. Ahmad, Sp.An</td>
                        <td className="p-4 font-bold">Tn. Budiman</td>
                        <td className="p-4">17/04/2026</td>
                        <td className="p-4"><span className="text-emerald-500 font-bold">Terverifikasi</span></td>
                      </tr>
                   </tbody>
                </table>
             </div>
          </div>
        );

      case 'finance-summary':
        return (
          <div className="bg-white rounded-[2.5rem] p-8 border shadow-sm animate-fade-in">
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-8">Rekap Finansial Layanan (Juta Rp)</h3>
             <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financeByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#94a3b8', fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#94a3b8', fontWeight: 700}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="rev" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        );

      case 'incident-investigation':
        const rawIncidents = appData.incidentReports || [];
        const allIncidents = rawIncidents.filter(r => {
          if (!user) return false;
          if (user.role === 'SUPER_ADMIN' || user.role === 'BIDANG') return true;
          return r.responsibleUnit === user.unit;
        });
        const newIncidents = allIncidents.filter(r => r.status === 'NEW' || !r.status);
        const activeInvestigations = allIncidents.filter(r => r.status === 'INVESTIGATING');
        const resolvedIncidents = allIncidents.filter(r => r.status === 'RESOLVED');

        return (
          <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  <Search className="text-blue-600"/> Dashboard Investigasi
                </h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Status & Manajemen Analisis Keselamatan Pasien</p>
              </div>
              <Button 
                onClick={() => setActiveMenu('incident-report')} 
                className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-slate-900 text-white shadow-xl"
              >
                <Plus size={18} className="mr-2"/> Input Laporan Insiden Baru
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Belum Diinvestigasi', val: newIncidents.length, color: 'blue', icon: <FileText/> },
                { label: 'Proses Investigasi', val: activeInvestigations.length, color: 'amber', icon: <Search/> },
                { label: 'Selesai Investigasi', val: resolvedIncidents.length, color: 'emerald', icon: <CheckCircle2/> }
              ].map((stat) => (
                <div key={`incident-stat-${stat.label}`} className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center gap-6">
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-600`}>
                      {React.cloneElement(stat.icon as React.ReactElement, { size: 28 })}
                   </div>
                   <div>
                      <div className="text-3xl font-black text-slate-800 tracking-tighter">{stat.val}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{stat.label}</div>
                   </div>
                </div>
              ))}
            </div>

            <div className="space-y-12">
              {/* Section 1: Belum Diinvestigasi */}
              <section className="space-y-6">
                 <div className="flex items-center gap-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">I. Menunggu Investigasi ({newIncidents.length})</h4>
                    <div className="h-px w-full bg-slate-100"></div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {newIncidents.length > 0 ? newIncidents.map(r => (
                      <div key={r.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group overflow-hidden">
                         <div className="absolute top-0 right-0 p-4">
                            <span className={`px-2 py-1 rounded text-[8px] font-black uppercase text-white`} style={{ backgroundColor: r.severity === 'RED' ? '#ef4444' : r.severity === 'YELLOW' ? '#f59e0b' : r.severity === 'GREEN' ? '#10b981' : '#3b82f6' }}>
                               {r.severity}
                            </span>
                         </div>
                         <div className="text-[10px] font-bold text-slate-400 mb-2">{r.date}</div>
                         <h5 className="text-sm font-black text-slate-800 uppercase leading-snug mb-2 line-clamp-2">{r.incidentName}</h5>
                         <p className="text-[10px] text-slate-500 font-medium line-clamp-2 mb-4">{r.chronology}</p>
                         <Button 
                           variant="secondary" 
                           onClick={() => setActiveMenu('incident-report')}
                           className="w-full text-[9px] font-black uppercase"
                         >
                           Mulai Investigasi <ArrowRight size={12} className="ml-2"/>
                         </Button>
                      </div>
                    )) : (
                      <div className="col-span-full py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 text-slate-400 font-bold italic text-sm">
                        Semua laporan sudah diproses.
                      </div>
                    )}
                 </div>
              </section>

              {/* Section 2: Sedang Diinvestigasi */}
              <section className="space-y-6">
                 <div className="flex items-center gap-4">
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-[0.2em] whitespace-nowrap">II. Dalam Proses Investigasi/RCA ({activeInvestigations.length})</h4>
                    <div className="h-px w-full bg-slate-100"></div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeInvestigations.length > 0 ? activeInvestigations.map(r => (
                      <div key={r.id} className="bg-amber-50/30 p-6 rounded-3xl border border-amber-100 shadow-sm relative group overflow-hidden">
                         <div className="absolute top-0 right-0 p-4">
                           <Clock className="text-amber-500 animate-pulse" size={16}/>
                         </div>
                         <div className="text-[10px] font-bold text-amber-600 mb-2">{r.date}</div>
                         <h5 className="text-sm font-black text-slate-800 uppercase leading-snug mb-2 line-clamp-2">{r.incidentName}</h5>
                         <div className="flex items-center gap-2 mb-4">
                            <div className="text-[9px] font-black text-slate-400 uppercase">Unit:</div>
                            <div className="text-[9px] font-black text-amber-700">{r.responsibleUnit}</div>
                         </div>
                         <Button 
                           onClick={() => setActiveMenu('incident-report')}
                           className="w-full text-[9px] font-black uppercase bg-amber-600 text-white"
                         >
                           Lanjutkan RCA <ArrowRight size={12} className="ml-2"/>
                         </Button>
                      </div>
                    )) : (
                      <div className="col-span-full py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 text-slate-400 font-bold italic text-sm">
                        Tidak ada investigasi yang sedang berjalan.
                      </div>
                    )}
                 </div>
              </section>

              {/* Section 3: Selesai Investigasi */}
              <section className="space-y-6">
                 <div className="flex items-center gap-4">
                    <h4 className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em] whitespace-nowrap">III. Selesai Investigasi ({resolvedIncidents.length})</h4>
                    <div className="h-px w-full bg-slate-100"></div>
                 </div>
                 <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                       <thead className="bg-slate-50">
                          <tr>
                             <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase">Waktu</th>
                             <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase">Nama Insiden</th>
                             <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase text-center">Grading</th>
                             <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Aksi</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y">
                          {resolvedIncidents.length > 0 ? resolvedIncidents.slice(-5).map(r => (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                               <td className="px-8 py-4 text-xs font-bold text-slate-500">{r.date}</td>
                               <td className="px-8 py-4">
                                  <div className="text-xs font-black text-slate-800 uppercase">{r.incidentName}</div>
                                  <div className="text-[9px] text-slate-400">{r.responsibleUnit}</div>
                               </td>
                               <td className="px-8 py-4 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black text-white`} style={{ backgroundColor: r.severity === 'RED' ? '#ef4444' : r.severity === 'YELLOW' ? '#f59e0b' : r.severity === 'GREEN' ? '#10b981' : '#3b82f6' }}>
                                     {r.severity}
                                  </span>
                               </td>
                               <td className="px-8 py-4 text-right">
                                  <Button 
                                    variant="secondary" 
                                    onClick={() => setActiveMenu('incident-report')}
                                    className="text-[9px] font-black uppercase h-8 px-4"
                                  >
                                    Detail
                                  </Button>
                               </td>
                            </tr>
                          )) : (
                            <tr>
                               <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-bold italic text-xs">Belum ada investigasi yang selesai.</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </section>
            </div>
          </div>
        );

      case 'incident-monthly':
        return <IncidentMonthlyReport reports={appData.incidentReports || []} />;

      case 'service-nursing':
        return (
          <ServiceMatrix 
            patients={appData.patients || []}
            dailyReports={appData.dailyReports || []}
            masterData={appData.masterData}
            onAddPatient={() => setIsPatientModalOpen(true)}
            onUpdateReport={handleUpdateDailyReport}
            onUpdateDependency={handleUpdateDependency}
            onUpdatePatient={handleUpdatePatient}
            currentUser={user}
          />
        );

      case 'quality-kpi':
        return (
          <QualityWorksheet 
            indicators={appData.masterData.qualityIndicators || []}
            measurements={appData.qualityMeasurements || []}
            onSaveMeasurement={handleSaveQualityMeasurement}
            currentUser={user}
          />
        );

      case 'quality-dpjp-absensi':
        return <QualityReports type="ATTENDANCE" patients={appData.patients} dailyReports={appData.dailyReports} masterData={appData.masterData} currentUser={user} />;
      case 'quality-visite-compliance':
        return <QualityReports type="PATHWAY" patients={appData.patients} dailyReports={appData.dailyReports} masterData={appData.masterData} currentUser={user} />;
      case 'quality-dependency':
        return <QualityReports type="DEPENDENCY" patients={appData.patients} dailyReports={appData.dailyReports} masterData={appData.masterData} currentUser={user} />;
      case 'quality-pathway':
        return <QualityReports type="PATHWAY" patients={appData.patients} dailyReports={appData.dailyReports} masterData={appData.masterData} currentUser={user} />;
      case 'quality-diagnosis-top':
        return <QualityReports type="DIAGNOSIS" patients={appData.patients} dailyReports={appData.dailyReports} masterData={appData.masterData} currentUser={user} />;

      case 'system-data':
        return <DataManagement masterData={appData.masterData} onSave={handleUpdateMasterData} currentUser={user} />;
      case 'system-inventory':
        return (
          <InventoryModule 
            instruments={appData.instruments || []}
            onAddInstrument={handleAddInstrument}
            onUpdateInstrument={handleUpdateInstrument}
            currentUser={user}
          />
        );
      case 'finance-billing':
        return <FinanceModule 
          records={financeRecords} 
          masterData={appData.masterData} 
          patients={appData.patients || []} 
          onAddRecord={handleAddFinance}
          currentUser={user}
        />;
      case 'incident-report':
        return <IncidentModule 
          reports={incidentReports} 
          patients={appData.patients || []} 
          onAddReport={handleAddIncident} 
          onUpdateStatus={handleUpdateIncident} 
          onDeleteReport={handleDeleteIncident}
          currentUser={user}
        />;

      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400 p-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-inner">
            <p className="text-2xl font-black text-slate-800 uppercase tracking-widest">Under Development</p>
            <Button onClick={() => setActiveMenu('dashboard')} className="mt-10 px-10 py-4 rounded-2xl shadow-xl shadow-blue-100">Kembali ke Dashboard</Button>
          </div>
        );
    }
  };

  if (!isReady) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-6"></div>
        <h2 className="text-white text-xl font-black uppercase tracking-widest mb-2">Inisialisasi Sistem</h2>
        <p className="text-slate-400 text-xs font-medium max-w-xs leading-relaxed mb-8">
          Menghubungkan ke database cloud dan memuat data master... Mohon tunggu sebentar.
        </p>
        <button 
          onClick={() => setIsReady(true)}
          className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          Lewati & Gunakan Data Lokal (Offline)
        </button>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      onNavigate={setActiveMenu} 
      activeMenu={activeMenu}
      syncStatus={syncStatus}
      onSync={handleSync}
    >
      {renderContent()}
      
      {isPatientModalOpen && (
        <PatientModal 
          masterData={appData.masterData}
          onClose={() => {
            setIsPatientModalOpen(false);
            setEditingPatient(null);
          }}
          onSave={handleAddPatient}
          currentUser={user}
          initialData={editingPatient || undefined}
        />
      )}
      {/* Global Notification */}
      {notification && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] ${notification.type === 'danger' ? 'bg-rose-900 border-rose-500/50' : 'bg-slate-900 border-blue-500/50'} text-white px-8 py-4 rounded-full flex items-center gap-3 shadow-2xl border animate-fade-in`}>
          <CheckCircle2 size={18} className={notification.type === 'danger' ? 'text-rose-400' : 'text-emerald-400'}/>
          <span className="text-xs font-black uppercase tracking-widest">{notification.message}</span>
        </div>
      )}
    </Layout>
  );
};

export default App;
