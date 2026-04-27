
import React from 'react';
import { 
  ShieldCheck, Activity, Users, FileText, Calendar, 
  AlertCircle, Menu, LogOut, ChevronRight, Settings, 
  BarChart3, Home, Bed, LayoutGrid, ClipboardCheck,
  Stethoscope, Wallet, HeartPulse, UserCog, TrendingUp,
  UserCheck, Gauge, FilePieChart, ClipboardList, X, RefreshCw,
  Search
} from 'lucide-react';
import { User } from '../types';
import { BrandLogo } from './BrandLogo';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  onNavigate: (menu: string) => void;
  activeMenu: string;
  syncStatus?: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  onSync?: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, onNavigate, activeMenu, syncStatus = 'IDLE', onSync, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const allRoles = ['STAFF', 'PPJA', 'PIC', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const managementRoles = ['SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const qualityRoles = ['PPJA', 'PIC', 'SEKRU', 'KARU', 'BIDANG', 'SUPER_ADMIN'];
  const reportReviewRoles = ['PPJA', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const financeRoles = ['PPJA', 'PIC', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const visiteRoles = ['PPJA', 'PIC', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const censusRoles = ['PPJA', 'PIC', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const systemRoles = ['SEKRU', 'KARU', 'BIDANG', 'SUPER_ADMIN']; 
  const inventoryRoles = ['SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];

  const harianRoles = allRoles;
  const pjanaRoles = allRoles;
  const bedRoles = allRoles;
  const serviceRoles = allRoles;
  const reportRoles = ['PPJA', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const nursingRoles = allRoles;
  const incidentReportRoles = allRoles;
  const incidentInvestRoles = ['PPJA', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const incidentMonthlyRoles = ['PPJA', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];

  const menuGroups = [
    {
      title: '1. Administratif',
      icon: <Users size={18}/>,
      items: [
        { id: 'adm-register', label: 'Registrasi Pasien', icon: <ChevronRight size={14}/>, roles: harianRoles },
        { id: 'patients', label: 'Menu Pasien', icon: <Users size={16}/>, roles: pjanaRoles },
        { id: 'adm-census', label: 'Sensus Pasien', icon: <BarChart3 size={16}/>, roles: censusRoles },
        { id: 'adm-data-bed', label: 'Monitoring Bed', icon: <Bed size={16}/>, roles: bedRoles }
      ]
    },
    {
      title: '2. Pelayanan Bedah',
      icon: <Activity size={18}/>,
      items: [
        { id: 'service-schedule', label: 'Jadwal Operasi', icon: <Calendar size={16}/>, roles: serviceRoles },
        { id: 'service-report', label: 'Laporan Operasi', icon: <FileText size={16}/>, roles: reportRoles },
        { id: 'service-nursing', label: 'Laporan Keperawatan', icon: <ClipboardCheck size={16}/>, roles: nursingRoles }
      ]
    },
    {
      title: '3. Keuangan & Visite',
      icon: <Wallet size={18}/>,
      items: [
        { id: 'finance-billing', label: 'Billing Pasien', icon: <FileText size={16}/>, roles: financeRoles },
        { id: 'finance-visite', label: 'Laporan Visite', icon: <Stethoscope size={16}/>, roles: visiteRoles },
        { id: 'finance-summary', label: 'Rekap Finansial', icon: <BarChart3 size={16}/>, roles: financeRoles }
      ]
    },
    {
      title: '4. Indikator Mutu (PIC)',
      icon: <HeartPulse size={18}/>,
      items: [
        { id: 'quality-kpi', label: 'Kertas Kerja Mutu', icon: <ClipboardCheck size={16}/>, roles: qualityRoles },
        { id: 'quality-dpjp-absensi', label: 'Absensi DPJP', icon: <UserCheck size={16}/>, roles: qualityRoles },
        { id: 'quality-visite-compliance', label: 'Kepatuhan Visite', icon: <Gauge size={16}/>, roles: qualityRoles },
        { id: 'quality-dependency', label: 'Ketergantungan Pasien', icon: <BarChart3 size={16}/>, roles: qualityRoles },
        { id: 'quality-pathway', label: 'Clinical Pathway', icon: <ClipboardList size={16}/>, roles: qualityRoles },
        { id: 'quality-diagnosis-top', label: 'Top 10 Diagnosa', icon: <FilePieChart size={16}/>, roles: qualityRoles }
      ]
    },
    {
      title: '5. Insiden & KPRS',
      icon: <AlertCircle size={18}/>,
      items: [
        { id: 'incident-report', label: 'Pelaporan Insiden', icon: <AlertCircle size={16}/>, roles: incidentReportRoles },
        { id: 'incident-investigation', label: 'Investigasi', icon: <Search size={16}/>, roles: incidentInvestRoles },
        { id: 'incident-monthly', label: 'Daftar Insiden Bulanan', icon: <BarChart3 size={16}/>, roles: incidentMonthlyRoles }
      ]
    },
    {
      title: '6. Manajemen Sistem',
      icon: <Settings size={18}/>,
      items: [
        { id: 'system-data', label: 'Master Data', icon: <LayoutGrid size={16}/>, roles: systemRoles },
        { id: 'system-inventory', label: 'Inventaris Alat', icon: <ClipboardList size={16}/>, roles: inventoryRoles }
      ]
    }
  ];

  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => user && item.roles.includes(user.role))
  })).filter(group => group.items.length > 0);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden app-bg-gradient">
      {/* Backdrop for mobile */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-[#144272]/60 backdrop-blur-sm z-[40] transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        ${isMobile ? 'fixed inset-y-0 left-0 z-[50]' : 'relative'}
        ${isSidebarOpen ? (isMobile ? 'w-80' : 'w-72') : (isMobile ? '-translate-x-full' : 'w-24')}
        bg-gradient-to-b from-[#144272] to-[#1e4b8f] text-white transition-all duration-300 flex flex-col shadow-2xl shrink-0
      `}>
        <div className="p-4 h-24 border-b border-white/10 flex items-center justify-between overflow-hidden">
          <div className={`transition-all duration-300 ${!isSidebarOpen && !isMobile ? 'opacity-0 w-0 scale-50' : 'opacity-100 w-full scale-100'}`}>
            <BrandLogo size="sm" />
          </div>
          <div className={`${isSidebarOpen || isMobile ? 'hidden' : 'block'} ml-auto`}>
             <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors"
            >
              <Menu size={24}/>
            </button>
          </div>
          
          {isMobile && (
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-white/70 hover:text-white lg:hidden">
              <X size={24}/>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar">
          <button 
            onClick={() => {
              onNavigate('dashboard');
              if (isMobile) setIsSidebarOpen(false);
            }} 
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeMenu === 'dashboard' ? 'bg-[#3b82f6] shadow-xl shadow-blue-900/30 ring-1 ring-white/20' : 'hover:bg-white/5'}`}
          >
            <Home size={22} className={activeMenu === 'dashboard' ? 'text-white' : 'text-white/50'}/>
            <span className={`font-black text-xs uppercase tracking-widest ${!isSidebarOpen && !isMobile && 'hidden'}`}>Dashboard Overview</span>
          </button>

          {filteredGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className={`px-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 ${!isSidebarOpen && !isMobile && 'justify-center'}`}>
                <span className={`${!isSidebarOpen && !isMobile && 'hidden'}`}>{group.title}</span>
                {!isSidebarOpen && !isMobile && <div className="h-px bg-slate-800 w-full"></div>}
              </div>
              {group.items.map(item => (
                <button 
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    if (isMobile) setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all group ${activeMenu === item.id ? 'bg-[#144272] shadow-inner text-[#8dc63f]' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                >
                  <div className="shrink-0">{item.icon}</div>
                  <span className={`flex-1 text-left font-medium truncate ${!isSidebarOpen && !isMobile && 'hidden'}`}>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
           <div className={`flex items-center gap-3 p-2 rounded-xl bg-slate-800/30 ${!isSidebarOpen && !isMobile && 'justify-center'}`}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-sm text-white shadow-inner">
                {user?.name.charAt(0)}
              </div>
              <div className={`flex-1 overflow-hidden ${!isSidebarOpen && !isMobile && 'hidden'}`}>
                <div className="text-xs font-black truncate text-slate-100">{user?.name}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{user?.role}</div>
              </div>
              <button onClick={onLogout} className={`p-2 text-slate-500 hover:text-red-400 transition-colors ${!isSidebarOpen && !isMobile && 'hidden'}`}>
                <LogOut size={18}/>
              </button>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative w-full">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-4 lg:px-8 z-10">
          <div className="flex items-center gap-3">
             {isMobile && (
               <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg lg:hidden"
               >
                 <Menu size={20}/>
               </button>
             )}
             <div className="hidden sm:block w-1.5 h-6 bg-[#3b82f6] rounded-full"></div>
             <h2 className="font-black text-[#144272] uppercase tracking-widest text-[10px] sm:text-base truncate max-w-[150px] sm:max-w-none">
                {activeMenu.replace('-', ' ').replace('adm', '1. Admin').replace('service', '2. Pelayanan').replace('finance', '3. Keu').replace('quality', '4. Mutu').replace('incident', '5. Insiden').replace('system', '6. Sistem')}
             </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-2">
              {syncStatus !== 'IDLE' && (
                <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  syncStatus === 'SYNCING' ? 'bg-blue-50 text-blue-500 animate-pulse' :
                  syncStatus === 'SUCCESS' ? 'bg-emerald-50 text-emerald-500' :
                  'bg-rose-50 text-rose-500'
                }`}>
                  {syncStatus === 'SYNCING' && <RefreshCw size={10} className="animate-spin" />}
                  {syncStatus === 'SYNCING' ? 'Auto-Syncing' : 
                   syncStatus === 'SUCCESS' ? 'Cloud Updated' : 'Offline Mode'}
                </div>
              )}
              {onSync && (
                <button 
                  onClick={onSync}
                  disabled={syncStatus === 'SYNCING'}
                  className={`p-2 rounded-lg transition-all ${syncStatus === 'SYNCING' ? 'text-blue-500' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                  title="Sinkronisasi Manual"
                >
                  <RefreshCw size={18} className={syncStatus === 'SYNCING' ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
            <div className="hidden md:block text-[11px] text-slate-400 font-black tracking-widest uppercase">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="hidden sm:block w-px h-6 bg-slate-200"></div>
            <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors">
               <AlertCircle size={20}/>
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/30 relative z-0">
          <div className="max-w-7xl mx-auto animate-fade-in pb-20 relative z-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
