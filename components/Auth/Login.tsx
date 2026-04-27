
import React, { useState } from 'react';
import { ShieldCheck, User, Lock, Activity, ArrowRight } from 'lucide-react';
import { Button } from '../Button';
import { BrandLogo } from '../BrandLogo';

interface LoginProps {
  onLogin: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        onLogin(data.user);
      } else {
        setError(data.message || 'Login gagal. Periksa username dan password.');
      }
    } catch (err) {
      setError('Terjadi kesalahan sistem. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#144272] via-[#1e4b8f] to-[#3b82f6] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#8dc63f]/10 rounded-full blur-[120px] -mr-64 -mt-64"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#3b82f6]/10 rounded-full blur-[120px] -ml-64 -mb-64"></div>
      
      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6 drop-shadow-2xl">
            <BrandLogo size="lg" variant="dark" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2 italic drop-shadow-lg">
            Si<span className="text-[#8dc63f]">MANTAP</span>
          </h1>
          <p className="text-white/70 font-black uppercase tracking-[0.3em] text-[10px]">
            Manajemen Laporan Terpadu & Akurat
          </p>
        </div>

        <div className="bg-[#144272]/40 backdrop-blur-2xl border border-white/10 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8dc63f]"></div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Username
              </label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  required
                  autoFocus
                  type="text"
                  placeholder="admin"
                  className="w-full bg-slate-800/50 border border-white/5 rounded-2xl px-12 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-slate-800/50 border border-white/5 rounded-2xl px-12 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-4 rounded-xl animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <Button
                disabled={loading}
                className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#3b82f6] text-white shadow-xl shadow-blue-900/40 h-14 ring-1 ring-white/20 transition-all active:scale-95"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Otentikasi...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    Masuk Sekarang <ArrowRight size={18} />
                  </div>
                )}
              </Button>
              
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-white/5"></div>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Atau Gunakan</span>
                <div className="flex-1 h-px bg-white/5"></div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUsername('demo');
                  setPassword('demo123');
                }}
                className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/10 text-slate-400 hover:bg-white/5 transition-all text-center"
              >
                Isi Demo Kredensial
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmReset) {
                    localStorage.clear();
                    window.location.reload();
                  } else {
                    setConfirmReset(true);
                  }
                }}
                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all text-center ${confirmReset ? 'bg-red-600 border-red-600 text-white' : 'border-red-500/20 text-red-400 hover:bg-red-500/5'}`}
              >
                {confirmReset ? 'KLIK LAGI UNTUK KONFIRMASI RESET' : 'Reset & Perbaiki Aplikasi'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center mt-10 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
          SiMANTAP v1.0 &bull; Secure Hospital Platform
        </p>
      </div>
    </div>
  );
};
