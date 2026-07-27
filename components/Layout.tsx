
import React from 'react';
import { 
  ShieldCheck, Activity, Users, FileText, Calendar, 
  AlertCircle, AlertTriangle, Menu, LogOut, ChevronRight, Settings, 
  BarChart3, Home, Bed, LayoutGrid, ClipboardCheck,
  Stethoscope, Wallet, HeartPulse, UserCog, TrendingUp,
  UserCheck, Gauge, FilePieChart, ClipboardList, X, RefreshCw,
  Search, Copy, Check, Globe, Printer
} from 'lucide-react';
import { User, AppSettings, RolePermission } from '../types';
import { DEFAULT_ROLE_PERMISSIONS } from '../constants';
import { BrandLogo } from './BrandLogo';

interface LayoutProps {
  user: User | null;
  rolePermissions?: Record<string, RolePermission>;
  onLogout: () => void;
  onNavigate: (menu: string) => void;
  activeMenu: string;
  syncStatus?: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  isFirestoreOnline?: boolean;
  isQuotaExceeded?: boolean;
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

const getHeaderTitle = (menu: string) => {
  switch (menu) {
    case 'dashboard': return 'Dashboard Overview';
    case 'adm-register': return '1. Registrasi Pasien';
    case 'adm-booking': return '1. Booking Ruangan Pasien';
    case 'patients': return '1. Menu Pasien';
    case 'monitoring-keluar-masuk': return '1. Monitoring Pasien Keluar Masuk';
    case 'adm-census': return '1. Sensus Pasien';
    case 'adm-data-bed': return '1. Monitoring Bed';
    case 'service-nursing': return '2. Laporan Keperawatan';
    case 'service-schedule': return '2. Jadwal Operasi';
    case 'finance-billing': return '3. Laporan Visite & Keuangan';
    case 'finance-visite': return '3. Laporan Kerja Visite';
    case 'finance-summary': return '3. Rekap Finansial Layanan';
    case 'finance-reg-admin': return '3. Registrasi Admin';
    case 'quality-kpi': return '4. Kertas Kerja Mutu';
    case 'quality-operasi-elektif': return '4. Kepatuhan Operasi Elektif';
    case 'quality-print': return '4. Cetak Kertas Kerja';
    case 'quality-asesmen-awal-medis': return '4. MUTU Asesmen Awal Medis';
    case 'quality-dpjp-absensi': return '4. Absensi DPJP';
    case 'quality-visite-compliance': return '4. Kepatuhan Visite';
    case 'quality-dependency': return '4. Ketergantungan Pasien';
    case 'quality-pathway': return '4. Clinical Pathway';
    case 'quality-diagnosis-top': return '4. Top 10 Diagnosa';
    case 'incident-report': return '5. Pelaporan Insiden';
    case 'incident-investigation': return '5. Investigasi';
    case 'incident-monthly': return '5. Daftar Insiden Bulanan';
    case 'system-data': return '6. Master Data';
    case 'system-inventory': return '6. Inventaris Alat';
    default:
      return menu.replace('-', ' ').toUpperCase();
  }
};

export const Layout: React.FC<LayoutProps> = ({ user, rolePermissions, onLogout, onNavigate, activeMenu, syncStatus = 'IDLE', isFirestoreOnline = true, isQuotaExceeded = false, onSync, lastSyncTime, settings, children }) => {
  const safeThemeColor = settings?.themeColor && settings.themeColor.trim() !== '' ? settings.themeColor : '#144272';
  const safeFontColor = settings?.fontColor && settings.fontColor.trim() !== '' ? settings.fontColor : '#ffffff';
  const safeAppName = settings?.appName && settings.appName.trim() !== '' ? settings.appName : 'SiMANTAP';
  const safeAppSlogan = settings?.appSlogan && settings.appSlogan.trim() !== '' ? settings.appSlogan : 'Manajemen Laporan Terpadu & Akurat';

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);

  const publicUrl = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') 
    ? window.location.origin 
    : "https://simantapbedah.vercel.app";

  const handleCopyLink = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(publicUrl);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };
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
  const systemRoles = ['SEKRU', 'KARU', 'ADMIN_RUANGAN', 'BIDANG', 'SUPER_ADMIN']; 
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
        { id: 'adm-booking', label: 'Booking Ruangan', icon: <Calendar size={16}/>, roles: harianRoles },
        { id: 'patients', label: 'Menu Pasien', icon: <Users size={16}/>, roles: pjanaRoles },
        { id: 'monitoring-keluar-masuk', label: 'Monitoring Keluar Masuk', icon: <Activity size={16}/>, roles: pjanaRoles },
        { id: 'adm-census', label: 'Sensus Pasien', icon: <BarChart3 size={16}/>, roles: censusRoles },
        { id: 'adm-data-bed', label: 'Monitoring Bed', icon: <Bed size={16}/>, roles: bedRoles }
      ]
    },
    {
      title: '2. Laporan Pelayanan',
      icon: <Activity size={18}/>,
      items: [
        { id: 'service-nursing', label: 'Laporan Keperawatan', icon: <ClipboardCheck size={16}/>, roles: nursingRoles },
        { id: 'service-schedule', label: 'Jadwal Operasi', icon: <Calendar size={16}/>, roles: serviceRoles }
      ]
    },
    {
      title: '3. LAPORAN ADMIN',
      icon: <Wallet size={18}/>,
      items: [
        { id: 'finance-reg-admin', label: 'Registrasi Admin', icon: <Users size={16}/>, roles: financeRoles },
        { id: 'finance-billing', label: 'Laporan Visite & Keuangan', icon: <FileText size={16}/>, roles: financeRoles },
        { id: 'finance-visite', label: 'Laporan Kerja Visite', icon: <Stethoscope size={16}/>, roles: visiteRoles },
        { id: 'finance-summary', label: 'Rekap Finansial Layanan', icon: <BarChart3 size={16}/>, roles: financeRoles }
      ]
    },
    {
      title: '4. Indikator Mutu (PIC)',
      icon: <HeartPulse size={18}/>,
      items: [
        { id: 'quality-kpi', label: 'Kertas Kerja Mutu', icon: <ClipboardCheck size={16}/>, roles: qualityRoles },
        { id: 'quality-operasi-elektif', label: 'Operasi Elektif', icon: <ClipboardCheck size={16}/>, roles: qualityRoles },
        { id: 'quality-print', label: 'Cetak Kertas Kerja', icon: <Printer size={16}/>, roles: qualityRoles },
        { id: 'quality-asesmen-awal-medis', label: 'MUTU Asesmen Awal Medis', icon: <ClipboardCheck size={16}/>, roles: qualityRoles },
        { id: 'quality-dpjp-absensi', label: 'Absensi DPJP', icon: <UserCheck size={16}/>, roles: qualityRoles },
        { id: 'quality-visite-compliance', label: 'Kepatuhan Visite', icon: <Gauge size={16}/>, roles: qualityRoles },
        { id: 'quality-dependency', label: 'Ketergantungan Pasien', icon: <BarChart3 size={16}/>, roles: qualityRoles },
        { id: 'quality-pathway', label: 'Clinical Pathway', icon: <ClipboardList size={16}/>, roles: qualityRoles },
        { id: 'quality-aps-mutu', label: 'Mutu Pasien APS', icon: <AlertTriangle size={16}/>, roles: qualityRoles },
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
    items: group.items.filter(item => {
      if (!user) return false;
      
      const effectivePermissions = (rolePermissions && rolePermissions[user.role]) 
        || (DEFAULT_ROLE_PERMISSIONS && (DEFAULT_ROLE_PERMISSIONS as any)[user.role]);

      if (effectivePermissions && Array.isArray(effectivePermissions.allowedMenus)) {
        return effectivePermissions.allowedMenus.includes(item.id);
      }

      return item.roles.includes(user.role);
    })
  })).filter(group => group.items.length > 0);

  return (
    <div className={`flex h-screen text-slate-900 font-sans overflow-hidden app-bg-gradient ${resolvedAppWallpaperUrl ? 'bg-transparent' : 'bg-slate-50'}`} style={{ backgroundColor: `${safeThemeColor}10` }}>
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
          background: `linear-gradient(to bottom, ${safeThemeColor}${resolvedAppWallpaperUrl ? 'e6' : ''}, ${safeThemeColor}${resolvedAppWallpaperUrl ? 'cc' : ''})`,
          color: safeFontColor
        }}
        onMouseEnter={() => { if (settings?.isSidebarAutohide && !isMobile) setIsSidebarOpen(true); }}
        onMouseLeave={() => { if (settings?.isSidebarAutohide && !isMobile) setIsSidebarOpen(false); }}
      >
        <div className="p-4 h-24 border-b border-white/10 flex items-center justify-between overflow-hidden">
          <div className={`transition-all duration-300 ${!isSidebarOpen && !isMobile ? 'opacity-0 w-0 scale-50' : 'opacity-100 w-full scale-100'}`}>
            <BrandLogo size="sm" appName={safeAppName} appSlogan={safeAppSlogan} fontColor={safeFontColor} logoUrl={settings?.logoUrl} />
          </div>
          <div className={`${isSidebarOpen || isMobile ? 'hidden' : 'block'} ml-auto`}>
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="p-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-all"
               style={{ color: safeFontColor }}
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
            style={{ color: activeMenu === 'dashboard' ? safeFontColor : undefined }}
          >
            <Home size={22} className={activeMenu === 'dashboard' ? '' : 'opacity-40'} style={{ color: safeFontColor }}/>
            <span className={`font-black text-xs uppercase tracking-widest ${!isSidebarOpen && !isMobile && 'hidden'}`}>Dashboard Overview</span>
          </button>

          {filteredGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div 
                className={`px-3 text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2 ${!isSidebarOpen && !isMobile && 'justify-center'}`}
                style={{ color: `${safeFontColor}80` }}
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
                  style={{ color: safeFontColor }}
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
                <div className="text-xs font-black truncate" style={{ color: safeFontColor }}>{user?.name}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest truncate opacity-50" style={{ color: safeFontColor }}>{user?.role}</div>
              </div>
              <button 
                onClick={onLogout} 
                className={`p-2 transition-colors opacity-50 hover:opacity-100 hover:text-red-400 ${!isSidebarOpen && !isMobile && 'hidden'}`}
                style={{ color: safeFontColor }}
              >
                <LogOut size={18}/>
              </button>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative w-full z-10 min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-4 lg:px-8 z-10">
          <div className="flex items-center gap-3 min-w-0">
             {isMobile && (
               <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg lg:hidden shrink-0"
               >
                 <Menu size={20}/>
               </button>
             )}
             <div className="hidden sm:block w-1.5 h-6 bg-[#3b82f6] rounded-full shrink-0"></div>
             <h2 className="font-black uppercase tracking-widest text-[10px] sm:text-base truncate transition-colors" style={{ color: safeThemeColor }}>
                {getHeaderTitle(activeMenu)}
              </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-6 shrink-0">
            {/* Shareable / Public Link Badge */}
            <div className="hidden md:flex items-center gap-2 bg-blue-50/70 hover:bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 transition-all shadow-sm group/link">
              <Globe size={13} className="text-blue-500 shrink-0 animate-pulse" />
              <div className="flex flex-col text-left">
                <span className="text-[7.5px] font-black text-blue-400 uppercase tracking-widest leading-none">Akses Tanpa Login Google</span>
                <a 
                  href={publicUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[9.5px] font-mono text-blue-600 hover:underline select-all truncate max-w-[180px] font-bold mt-0.5"
                  title="Klik untuk membuka link akses publik"
                >
                  {publicUrl}
                </a>
              </div>
              <button 
                onClick={handleCopyLink}
                className={`ml-1 p-1.5 rounded-lg transition-all text-slate-300 hover:text-blue-600 ${copiedLink ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-blue-100/50'}`}
                title="Salin Link Akses"
              >
                {copiedLink ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-blue-500" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {onSync && (
                <div className="flex items-center gap-3 bg-emerald-50/80 backdrop-blur-sm px-3.5 py-1.5 rounded-2xl border border-emerald-200/80 shadow-sm group">
                  <div className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'SYNCING' ? 'bg-blue-500 animate-ping' : isFirestoreOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse' : 'bg-amber-500'}`}></div>
                  <div className="flex flex-col">
                    <span className={`text-[8.5px] font-black uppercase tracking-wider leading-none ${syncStatus === 'SYNCING' ? 'text-blue-600' : isFirestoreOnline ? 'text-emerald-800' : 'text-amber-700'}`}>
                      {syncStatus === 'SYNCING' ? 'MENYINKRONKAN CHUNKS...' : 'SINKRONISASI REALTIME AKTIF'}
                    </span>
                    {lastSyncTime && (
                      <span className="text-[7px] font-bold text-emerald-600/70 uppercase tracking-tighter mt-0.5">
                        Update: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={onSync}
                    disabled={syncStatus === 'SYNCING'}
                    className={`ml-1 p-1 hover:bg-emerald-100/50 rounded-lg transition-all ${syncStatus === 'SYNCING' ? 'text-blue-500' : 'text-emerald-500 hover:text-emerald-700'}`}
                    title="Paksa Sinkron"
                  >
                    <RefreshCw size={13} className={syncStatus === 'SYNCING' ? 'animate-spin' : ''} />
                  </button>
                </div>
              )}
            </div>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                Masa Depan 2026
              </span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-slate-200"></div>
            <button className="relative p-2 text-slate-500 hover:text-blue-600 transition-colors">
               <AlertCircle size={20}/>
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {isQuotaExceeded && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 sm:px-8 py-2.5 text-amber-800 text-xs font-medium flex flex-wrap items-center justify-between gap-3 z-40 animate-fade-in shadow-inner">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">
                <strong className="font-bold">Mode Lokal & Sync Google Sheets Aktif:</strong> Kuota harian Firestore (Free Tier) telah tercapai. Data Anda 100% tersimpan aman di Penyimpanan Lokal (IndexedDB) & Server.
              </span>
            </div>
            <a
              href="https://console.firebase.google.com/project/gen-lang-client-0234581338/firestore/databases/ai-studio-simantapbedah-c6a38a36-4082-4d85-9040-78110b8f6ff4/data?openUpgradeDialog=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition-colors shrink-0 shadow-sm"
            >
              Cek / Upgrade Kuota Firebase
            </a>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto p-4 sm:p-8 relative z-10 ${resolvedAppWallpaperUrl ? 'bg-white/10' : 'bg-slate-50/30'}`}>
          <div className="w-full animate-fade-in pb-20 relative z-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
