import React, { useState, useEffect } from 'react';
import { 
  signInWithGoogleWorkspace, 
  getWorkspaceAccessToken, 
  clearWorkspaceAccessToken, 
  initWorkspaceAuth,
  openGooglePicker,
  PickedFile
} from '../../googleWorkspace';
import { 
  FileText, Calendar, HardDrive, CheckCircle2, 
  LogOut, Plus, ExternalLink, Sparkles, FolderPlus,
  ShieldCheck, Loader2, ArrowUpRight
} from 'lucide-react';

interface WorkspaceBarProps {
  onFilePicked?: (file: PickedFile) => void;
  onOpenDocsExport?: () => void;
  onOpenCalendarSync?: () => void;
  notify?: (msg: string, type?: 'success' | 'danger') => void;
}

export const WorkspaceBar: React.FC<WorkspaceBarProps> = ({
  onFilePicked,
  onOpenDocsExport,
  onOpenCalendarSync,
  notify,
}) => {
  const [token, setToken] = useState<string | null>(getWorkspaceAccessToken());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastPickedFile, setLastPickedFile] = useState<PickedFile | null>(null);

  useEffect(() => {
    const unsubscribe = initWorkspaceAuth((user, tokenVal) => {
      setToken(tokenVal);
      if (user) {
        setUserEmail(user.email);
      } else {
        setUserEmail(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await signInWithGoogleWorkspace();
      setToken(res.accessToken);
      setUserEmail(res.user.email);
      if (notify) notify(`Terhubung ke Google Workspace: ${res.user.email}`, 'success');
    } catch (err: any) {
      if (notify) notify(err.message || 'Gagal terhubung ke Google Workspace', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearWorkspaceAccessToken();
    setToken(null);
    setUserEmail(null);
    if (notify) notify('Terputus dari Google Workspace', 'success');
  };

  const handleOpenPicker = async () => {
    if (!token) {
      await handleLogin();
    }
    try {
      await openGooglePicker({
        title: 'Pilih Berkas Medis / Rekam Medis dari Google Drive',
        onPicked: (file) => {
          setLastPickedFile(file);
          if (onFilePicked) onFilePicked(file);
          if (notify) notify(`Berkas dipilih: ${file.name}`, 'success');
        },
        onCancel: () => {
          console.log('Picker cancelled');
        },
      });
    } catch (err: any) {
      if (notify) notify(err.message || 'Gagal membuka Google Picker', 'danger');
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-2xl p-4 shadow-xl text-white mb-6 backdrop-blur-md">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm uppercase tracking-wider text-white">
                Google Workspace Integrasi
              </h3>
              {token ? (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={12} />
                  Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  Belum Login
                </span>
              )}
            </div>
            <p className="text-[11px] text-indigo-200/80 font-medium mt-0.5">
              {token && userEmail
                ? `Akun: ${userEmail} • Siap mengakses Drive, Docs & Calendar`
                : 'Hubungkan Google Drive Picker, Google Docs & Google Calendar'}
            </p>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {!token ? (
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full lg:w-auto flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Sign in with Google</span>
            </button>
          ) : (
            <>
              {/* Google Picker Button */}
              <button
                onClick={handleOpenPicker}
                className="flex items-center gap-2 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-200 text-xs font-bold px-3.5 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
                title="Buka Google Drive Picker untuk memilih berkas"
              >
                <HardDrive size={15} className="text-blue-300" />
                <span>Google Picker</span>
              </button>

              {/* Google Docs Button */}
              {onOpenDocsExport && (
                <button
                  onClick={onOpenDocsExport}
                  className="flex items-center gap-2 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-200 text-xs font-bold px-3.5 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
                  title="Ekspor Laporan ke Google Docs"
                >
                  <FileText size={15} className="text-emerald-300" />
                  <span>Google Docs</span>
                </button>
              )}

              {/* Google Calendar Button */}
              {onOpenCalendarSync && (
                <button
                  onClick={onOpenCalendarSync}
                  className="flex items-center gap-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 text-xs font-bold px-3.5 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
                  title="Sinkronisasi Jadwal Operasi ke Google Calendar"
                >
                  <Calendar size={15} className="text-purple-300" />
                  <span>Google Calendar</span>
                </button>
              )}

              {/* Disconnect Button */}
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl transition-all"
                title="Putuskan Akses Google Workspace"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selected File Banner if user used Google Picker */}
      {lastPickedFile && (
        <div className="mt-3 pt-3 border-t border-indigo-800/40 flex items-center justify-between text-xs bg-indigo-950/50 p-2.5 rounded-xl">
          <div className="flex items-center gap-2 overflow-hidden">
            <HardDrive size={14} className="text-blue-400 shrink-0" />
            <span className="text-slate-300 truncate">
              Berkas Terpilih: <strong className="text-white">{lastPickedFile.name}</strong>
            </span>
          </div>
          <a
            href={lastPickedFile.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 font-bold shrink-0 hover:underline"
          >
            <span>Buka di Drive</span>
            <ArrowUpRight size={13} />
          </a>
        </div>
      )}
    </div>
  );
};
