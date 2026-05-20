
import React from 'react';
import { 
  ShieldCheck, Activity, Users, FileText, Calendar, 
  AlertCircle, Menu, LogOut, ChevronRight, Settings, 
  BarChart3, Home, Bed, LayoutGrid, ClipboardCheck,
  Stethoscope, Wallet, HeartPulse, UserCog, TrendingUp,
  UserCheck, Gauge, FilePieChart, ClipboardList, X, RefreshCw,
  Search
} from 'lucide-react';
import { User, AppSettings } from '../types';
import { BrandLogo } from './BrandLogo';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  onNavigate: (menu: string) => void;
  activeMenu: string;
  syncStatus?: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  onSync?: () => void;
  lastSyncTime?: Date | null;
  settings?: AppSettings;
  children: React.ReactNode;
}

const getDirectWallpaperUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                        url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch) {
      const fileId = fileIdMatch[1];
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }
  return url;
};

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, onNavigate, activeMenu, syncStatus = 'IDLE', onSync, lastSyncTime, settings, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const resolvedAppWallpaperUrl = getDirectWallpaperUrl(settings?.appWallpaperUrl);

  // Auto-hide sidebar if setting is enabled and not mobile
  React.useEffect(() => {
    if (settings?.isSidebarAutohide && !isMobile) {
      const timer = setTimeout(() => setIsSidebarOpen(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [activeMenu, settings?.isSidebarAutohide, isMobile]);

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
  const qualityRoles = ['PIC', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const reportReviewRoles = ['PPJA', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const financeRoles = ['PPJA', 'PIC', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
  const visiteRoles = ['PIC', 'SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN'];
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
    <div className={`flex h-screen text-slate-900 font-sans overflow-hidden app-bg-gradient ${resolvedAppWallpaperUrl ? 'bg-transparent' : 'bg-slate-50'}`} style={{ backgroundColor: settings?.themeColor ? `${settings.themeColor}10` : undefined }}>
      {/* Background Wallpaper if any */}
      {resolvedAppWallpaperUrl && (
        <div 
          className="fixed inset-0 pointer-events-none z-0"
          style={{ 
            backgroundImage: `url(${resolvedAppWallpaperUrl})`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            opacity: 0.15,
            filter: 'contrast(1.1) saturate(1.2)'
          }}
        />
      )}

      {/* Sidebar Overlay for mobile */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[40]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-[50]' : 'relative z-10'}
          ${isSidebarOpen ? (isMobile ? 'w-80' : 'w-72') : (isMobile ? '-translate-x-full' : 'w-24')}
          transition-all duration-300 flex flex-col shadow-2xl shrink-0
          ${resolvedAppWallpaperUrl ? 'backdrop-blur-2xl border-r border-white/10' : ''}
        `}
        style={{ 
          background: settings?.themeColor 
            ? `linear-gradient(to bottom, ${settings.themeColor}${resolvedAppWallpaperUrl ? 'e6' : ''}, ${settings.themeColor}${resolvedAppWallpaperUrl ? 'cc' : ''})` 
            : resolvedAppWallpaperUrl ? 'rgba(20, 66, 114, 0.85)' : 'linear-gradient(to bottom, #144272, #1e4b8f)',
          color: settings?.fontColor || 'white'
        }}
        onMouseEnter={() => { if (settings?.isSidebarAutohide && !isMobile) setIsSidebarOpen(true); }}
        onMouseLeave={() => { if (settings?.isSidebarAutohide && !isMobile) setIsSidebarOpen(false); }}
      >
        <div className="p-4 h-24 border-b border-white/10 flex items-center justify-between overflow-hidden">
          <div className={`transition-all duration-300 ${!isSidebarOpen && !isMobile ? 'opacity-0 w-0 scale-50' : 'opacity-100 w-full scale-100'}`}>
            <BrandLogo size="sm" appName={settings?.appName} appSlogan={settings?.appSlogan} fontColor={settings?.fontColor} />
          </div>
          <div className={`${isSidebarOpen || isMobile ? 'hidden' : 'block'} ml-auto`}>
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="p-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-all"
               style={{ color: settings?.fontColor || 'white' }}
             >
                <ChevronRight size={20}/>
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
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeMenu === 'dashboard' ? 'bg-white/15 backdrop-blur-md shadow-xl ring-1 ring-white/10' : 'hover:bg-white/5'}`}
            style={{ color: activeMenu === 'dashboard' ? (settings?.fontColor || 'white') : undefined }}
          >
            <Home size={22} className={activeMenu === 'dashboard' ? '' : 'opacity-40'} style={{ color: settings?.fontColor || 'white' }}/>
            <span className={`font-black text-xs uppercase tracking-widest ${!isSidebarOpen && !isMobile && 'hidden'}`}>Dashboard Overview</span>
          </button>

          {filteredGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div 
                className={`px-3 text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2 ${!isSidebarOpen && !isMobile && 'justify-center'}`}
                style={{ color: settings?.fontColor ? `${settings.fontColor}80` : 'rgba(255,255,255,0.4)' }}
              >
                <span className={`${!isSidebarOpen && !isMobile && 'hidden'}`}>{group.title}</span>
                {!isSidebarOpen && !isMobile && <div className="h-px bg-white/10 w-full"></div>}
              </div>
              {group.items.map(item => (
                <button 
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    if (isMobile) setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all group ${activeMenu === item.id ? 'bg-white/25 backdrop-blur-md shadow-inner ring-1 ring-white/20' : 'opacity-60 hover:bg-white/5 hover:opacity-100'}`}
                  style={{ color: settings?.fontColor || 'white' }}
                >
                  <div className={`shrink-0 ${activeMenu === item.id ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>{item.icon}</div>
                  <span className={`flex-1 text-left truncate ${!isSidebarOpen && !isMobile && 'hidden'} ${activeMenu === item.id ? 'font-black' : ''}`}>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/10 bg-black/5">
           <div className={`flex items-center gap-3 p-2 rounded-xl bg-white/5 ${!isSidebarOpen && !isMobile && 'justify-center'}`}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-sm text-white shadow-inner flex-shrink-0">
                {user?.name.charAt(0)}
              </div>
              <div className={`flex-1 min-w-0 ${!isSidebarOpen && !isMobile && 'hidden'}`}>
                <div className="text-xs font-black truncate" style={{ color: settings?.fontColor || 'white' }}>{user?.name}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest truncate opacity-50" style={{ color: settings?.fontColor || 'white' }}>{user?.role}</div>
              </div>
              <button 
                onClick={onLogout} 
                className={`p-2 transition-colors opacity-50 hover:opacity-100 hover:text-red-400 ${!isSidebarOpen && !isMobile && 'hidden'}`}
                style={{ color: settings?.fontColor || 'white' }}
              >
                <LogOut size={18}/>
              </button>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative w-full z-10">
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
             <h2 className="font-black uppercase tracking-widest text-[10px] sm:text-base truncate max-w-[150px] sm:max-w-none transition-colors" style={{ color: settings?.themeColor || '#144272' }}>
                {activeMenu.replace('-', ' ').replace('adm', '1. Admin').replace('service', '2. Pelayanan').replace('finance', '3. Keu').replace('quality', '4. Mutu').replace('incident', '5. Insiden').replace('system', '6. Sistem')}
              </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-2">
              {onSync && (
                <div className="flex items-center gap-3 bg-white/40 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/20 shadow-sm group">
                  <div className={`w-2 h-2 rounded-full ${syncStatus === 'SYNCING' ? 'bg-blue-500 animate-ping' : syncStatus === 'ERROR' ? 'bg-red-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
                  <div className="flex flex-col">
                    <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${syncStatus === 'SYNCING' ? 'text-blue-600' : syncStatus === 'ERROR' ? 'text-red-700' : 'text-emerald-700'}`}>
                      {syncStatus === 'SYNCING' ? 'Syncing...' : syncStatus === 'ERROR' ? 'Cloud Error' : 'Server Online'}
                    </span>
                    {lastSyncTime && (
                      <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                        Update: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={onSync}
                    disabled={syncStatus === 'SYNCING'}
                    className={`ml-1 p-1 hover:bg-white rounded-lg transition-all ${syncStatus === 'SYNCING' ? 'text-blue-500' : 'text-slate-300 hover:text-blue-600'}`}
                    title="Paksa Sinkron"
                  >
                    <RefreshCw size={14} className={syncStatus === 'SYNCING' ? 'animate-spin' : ''} />
                  </button>
                </div>
              )}
            </div>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest" style={{ color: settings?.fontColor || undefined }}>
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em]" style={{ color: settings?.fontColor ? `${settings.fontColor}88` : undefined }}>
                Masa Depan 2026
              </span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-slate-200"></div>
            <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors" style={{ color: settings?.fontColor || undefined }}>
               <AlertCircle size={20}/>
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto p-4 sm:p-8 relative z-10 ${resolvedAppWallpaperUrl ? 'bg-white/10' : 'bg-slate-50/30'}`}>
          <div className="w-full animate-fade-in pb-20 relative z-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
