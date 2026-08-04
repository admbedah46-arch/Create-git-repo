import React, { useState, useMemo, useCallback } from 'react';
import { Patient, AppData } from '../../types';
import { Button } from '../Button';
import { 
  Calendar, Users, ArrowUpRight, ArrowDownRight, 
  Smile, Frown, LogOut, ArrowRightLeft, Heart, 
  Download, Search, ShieldAlert, BadgeInfo, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MonitoringPasienKeluarMasukProps {
  appData: AppData;
  currentUser: any;
  onPatientClick?: (patientId: string) => void;
}

export const MonitoringPasienKeluarMasuk: React.FC<MonitoringPasienKeluarMasukProps> = ({ appData, currentUser, onPatientClick }) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [filterMode, setFilterMode] = useState<'MONTH' | 'DAY'>('MONTH');
  const [activeTab, setActiveTab] = useState<'BARU' | 'BPL' | 'MENINGGAL' | 'RUJUK' | 'PINDAH' | 'APS' | 'BATAL'>('BARU');
  const [searchTerm, setSearchTerm] = useState('');

  const isDateMatch = useCallback((dStr?: string) => {
    if (!dStr) return false;
    if (filterMode === 'MONTH') {
      const monthPrefix = selectedDate.substring(0, 7); // e.g. "2026-07"
      return dStr.startsWith(monthPrefix);
    }
    return dStr === selectedDate;
  }, [selectedDate, filterMode]);

  const patients = useMemo(() => {
    let list = appData.patients || [];
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'BIDANG') {
      list = list.filter(p => p.unitTujuan === currentUser.unit || p.ruangan === currentUser.unit);
    }
    return list;
  }, [appData.patients, currentUser]);

  // Pasien Baru (MRS) pada Rentang Bulan Ini / Tanggal Pelayanan yang dipilih
  const pasienBaru = useMemo(() => {
    return patients.filter(p => isDateMatch(p.entryDate));
  }, [patients, isDateMatch]);

  // Pasien Pulang / KRS pada Rentang Bulan Ini / Tanggal Pelayanan yang dipilih
  const krsPatients = useMemo(() => {
    return patients.filter(p => isDateMatch(p.dischargeDate) || (p.statusDataPasien || '').toUpperCase().includes('BATAL'));
  }, [patients, isDateMatch]);

  const pasienBPL = useMemo(() => {
    return krsPatients.filter(p => {
      const statusStr = String(p.statusDataPasien || '').toLowerCase();
      return (statusStr.includes('bpl') || statusStr.includes('pulang') || statusStr.includes('boleh')) && !statusStr.includes('batal');
    });
  }, [krsPatients]);

  const pasienMeninggal = useMemo(() => {
    return krsPatients.filter(p => {
      const statusStr = String(p.statusDataPasien || '').toLowerCase();
      return statusStr.includes('meninggal') && !statusStr.includes('batal');
    });
  }, [krsPatients]);

  const pasienRujuk = useMemo(() => {
    return krsPatients.filter(p => {
      const statusStr = String(p.statusDataPasien || '').toLowerCase();
      return (statusStr.includes('rujuk') || statusStr.includes('dirujuk')) && !statusStr.includes('batal');
    });
  }, [krsPatients]);

  const pasienPindah = useMemo(() => {
    return krsPatients.filter(p => {
      const statusStr = String(p.statusDataPasien || '').toLowerCase();
      return (statusStr.includes('pindah') || statusStr.includes('ruangan lain') || statusStr.includes('transfer')) && !statusStr.includes('batal');
    });
  }, [krsPatients]);

  const pasienAPS = useMemo(() => {
    return krsPatients.filter(p => {
      const statusStr = String(p.statusDataPasien || '').toLowerCase();
      return (statusStr.includes('aps') || statusStr.includes('atas permintaan sendiri') || statusStr.includes('paksa')) && !statusStr.includes('batal');
    });
  }, [krsPatients]);

  const pasienBatal = useMemo(() => {
    // If the patient status contains "batal", they show up here.
    return patients.filter(p => {
      const statusStr = String(p.statusDataPasien || '').toLowerCase();
      const dateMatched = isDateMatch(p.dischargeDate) || isDateMatch(p.entryDate);
      return statusStr.includes('batal') && dateMatched;
    });
  }, [patients, isDateMatch]);

  const currentTabList = useMemo(() => {
    let list: Patient[] = [];
    switch (activeTab) {
      case 'BARU': list = pasienBaru; break;
      case 'BPL': list = pasienBPL; break;
      case 'MENINGGAL': list = pasienMeninggal; break;
      case 'RUJUK': list = pasienRujuk; break;
      case 'PINDAH': list = pasienPindah; break;
      case 'APS': list = pasienAPS; break;
      case 'BATAL': list = pasienBatal; break;
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.noRM.includes(query) || 
        String(p.diagnosaUtama || '').toLowerCase().includes(query)
      );
    }
    return list;
  }, [activeTab, pasienBaru, pasienBPL, pasienMeninggal, pasienRujuk, pasienPindah, pasienAPS, pasienBatal, searchTerm]);

  const handleExportExcel = () => {
    const dataToExport = currentTabList.map((p, idx) => ({
      'No': idx + 1,
      'No. Register': p.noRegister || '-',
      'No. RM': p.noRM,
      'Nama Pasien': p.name,
      'Gender': p.gender === 'L' ? 'Laki-laki' : 'Perempuan',
      'Asal Masuk': p.origin,
      'Ruang/Bed': `${p.ruangan || '-'} / ${p.nomorBed || '-'}`,
      'Diagnosis Utama': p.diagnosaUtama || '-',
      'DPJP': (p.dpjpList || []).join(', '),
      'Status Keluar': p.statusDataPasien,
      'Tanggal MRS': p.entryDate,
      'Tanggal KRS': p.dischargeDate || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Laporan_${activeTab}`);
    XLSX.writeFile(wb, `Monitoring_Keluar_Masuk_${activeTab}_${selectedDate}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Top Bar Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] border shadow-sm">
        <div>
          <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800">Monitoring Pasien Keluar-Masuk</h3>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
            <Users size={14} className="text-blue-500" /> Sensus & Monitoring Pasien Baru, Pulang (BPL), Meninggal, Rujuk, Pindah Ruangan, APS
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as 'MONTH' | 'DAY')}
            className="border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-black text-slate-700 bg-slate-50 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="MONTH">Rentang Bulan Ini</option>
            <option value="DAY">Tanggal Spesifik</option>
          </select>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-600" />
            <input
              type="date"
              className="border-2 border-slate-100 rounded-xl px-4 py-2 text-xs font-black outline-none focus:border-blue-500 cursor-pointer bg-slate-50"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Grid Summary Stat/Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {/* Pasien Baru */}
        <button
          onClick={() => setActiveTab('BARU')}
          className={`flex flex-col justify-between p-6 rounded-[2rem] text-left border transition-all duration-300 relative overflow-hidden ${
            activeTab === 'BARU' 
              ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-100 scale-102' 
              : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="text-[9px] font-black uppercase tracking-widest">Pasien Baru (MRS)</span>
            <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'BARU' ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <ArrowDownRight size={16} />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black">{pasienBaru.length}</span>
            <span className="text-[10px] font-bold block opacity-60 uppercase tracking-tighter mt-1">Registrasi MRS Hari Ini</span>
          </div>
        </button>

        {/* Pasien BPL */}
        <button
          onClick={() => setActiveTab('BPL')}
          className={`flex flex-col justify-between p-6 rounded-[2rem] text-left border transition-all duration-300 relative overflow-hidden ${
            activeTab === 'BPL' 
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-100 scale-102' 
              : 'bg-white border-slate-100 text-slate-600 hover:border-emerald-200'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="text-[9px] font-black uppercase tracking-widest">Boleh Pulang (BPL)</span>
            <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'BPL' ? 'bg-white/10 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
              <Smile size={16} />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black">{pasienBPL.length}</span>
            <span className="text-[10px] font-bold block opacity-60 uppercase tracking-tighter mt-1">KRS BPL Dokter</span>
          </div>
        </button>

        {/* Pasien Rujuk */}
        <button
          onClick={() => setActiveTab('RUJUK')}
          className={`flex flex-col justify-between p-6 rounded-[2rem] text-left border transition-all duration-300 relative overflow-hidden ${
            activeTab === 'RUJUK' 
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100 scale-102' 
              : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="text-[9px] font-black uppercase tracking-widest">Dirujuk Layanan</span>
            <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'RUJUK' ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
              <LogOut size={16} />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black">{pasienRujuk.length}</span>
            <span className="text-[10px] font-bold block opacity-60 uppercase tracking-tighter mt-1">KRS Rujuk Rumah Sakit</span>
          </div>
        </button>

        {/* Pasien Meninggal */}
        <button
          onClick={() => setActiveTab('MENINGGAL')}
          className={`flex flex-col justify-between p-6 rounded-[2rem] text-left border transition-all duration-300 relative overflow-hidden ${
            activeTab === 'MENINGGAL' 
              ? 'bg-rose-600 text-white border-rose-600 shadow-xl shadow-rose-100 scale-102' 
              : 'bg-white border-slate-100 text-slate-600 hover:border-rose-200'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="text-[9px] font-black uppercase tracking-widest">Meninggal Dunia</span>
            <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'MENINGGAL' ? 'bg-white/10 text-white' : 'bg-rose-50 text-rose-600'}`}>
              <Heart size={16} />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black">{pasienMeninggal.length}</span>
            <span className="text-[10px] font-bold block opacity-60 uppercase tracking-tighter mt-1">Kasus Meninggal MRS</span>
          </div>
        </button>

        {/* Pasien Pindah */}
        <button
          onClick={() => setActiveTab('PINDAH')}
          className={`flex flex-col justify-between p-6 rounded-[2rem] text-left border transition-all duration-300 relative overflow-hidden ${
            activeTab === 'PINDAH' 
              ? 'bg-amber-600 text-white border-amber-600 shadow-xl shadow-amber-100 scale-102' 
              : 'bg-white border-slate-100 text-slate-600 hover:border-amber-200'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="text-[9px] font-black uppercase tracking-widest">Pindah Ruangan</span>
            <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'PINDAH' ? 'bg-white/10 text-white' : 'bg-amber-50 text-amber-600'}`}>
              <ArrowRightLeft size={16} />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black">{pasienPindah.length}</span>
            <span className="text-[10px] font-bold block opacity-60 uppercase tracking-tighter mt-1">Pindah Layanan Rawat</span>
          </div>
        </button>

        {/* Pasien APS */}
        <button
          onClick={() => setActiveTab('APS')}
          className={`flex flex-col justify-between p-6 rounded-[2rem] text-left border transition-all duration-300 relative overflow-hidden ${
            activeTab === 'APS' 
              ? 'bg-purple-600 text-white border-purple-600 shadow-xl shadow-purple-100 scale-102' 
              : 'bg-white border-slate-100 text-slate-600 hover:border-purple-200'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="text-[9px] font-black uppercase tracking-widest font-black">Pulang Paksa (APS)</span>
            <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'APS' ? 'bg-white/10 text-white' : 'bg-purple-50 text-purple-600'}`}>
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black">{pasienAPS.length}</span>
            <span className="text-[10px] font-bold block opacity-60 uppercase tracking-tighter mt-1">Keluar APS Keluarga</span>
          </div>
        </button>

        {/* Pasien Batal */}
        <button
          onClick={() => setActiveTab('BATAL')}
          className={`flex flex-col justify-between p-6 rounded-[2rem] text-left border transition-all duration-300 relative overflow-hidden ${
            activeTab === 'BATAL' 
              ? 'bg-rose-950 text-white border-rose-950 shadow-xl shadow-rose-100 scale-102' 
              : 'bg-white border-slate-100 text-slate-600 hover:border-rose-200'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="text-[9px] font-black uppercase tracking-widest font-black">Batal Rawat Inap</span>
            <div className={`p-2 rounded-xl shrink-0 ${activeTab === 'BATAL' ? 'bg-white/10 text-white' : 'bg-rose-50 text-rose-600'}`}>
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black">{pasienBatal.length}</span>
            <span className="text-[10px] font-bold block opacity-60 uppercase tracking-tighter mt-1">Batal Rawat Bedah</span>
          </div>
        </button>
      </div>

      {/* Main Table Grid List */}
      <div className="bg-white border rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
        {/* Table Filter Panel */}
        <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-ping"></div>
             <div>
               <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight">Detail Pasien • Kategori {activeTab}</h4>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Jumlah: {currentTabList.length} data ditemukan (Tanggal: {selectedDate})</p>
             </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari Nama, No RM, Diagnosa..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Button
              onClick={handleExportExcel}
              disabled={currentTabList.length === 0}
              className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl py-2.5 px-6 uppercase text-[9px] font-black tracking-widest shrink-0 disabled:opacity-45"
            >
              <Download size={16} className="mr-2" /> Unduh Laporan
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/70 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="p-6">No. RM</th>
                <th className="p-6">Nama Pasien</th>
                <th className="p-6">Asal Masuk / Ruangan</th>
                <th className="p-6">DPJP Principal</th>
                <th className="p-6">Utama Diagnosa</th>
                <th className="p-6">Perawat Primer</th>
                <th className="p-6">Cara Bayar</th>
                <th className="p-6">Status Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentTabList.map((p) => (
                <tr 
                  key={p.id} 
                  onClick={() => onPatientClick?.(p.id)}
                  className="hover:bg-indigo-50/20 transition-all cursor-pointer group"
                >
                  <td className="p-6 font-mono text-[11px] text-slate-500 font-bold whitespace-nowrap">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200/50">{p.noRM}</span>
                  </td>
                  <td className="p-6 font-black text-slate-700 text-sm tracking-tight capitalize whitespace-nowrap">
                    {p.name.toLowerCase()}
                    <span className="text-[10px] text-slate-400 block font-semibold mt-1 uppercase">Gender: {p.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                  </td>
                  <td className="p-6 font-bold whitespace-nowrap">
                    <span className="text-xs text-slate-600 block">{p.origin}</span>
                    <span className="text-[10px] uppercase font-bold tracking-tight inline-flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200">RUANG: {p.ruangan || '-'}</span>
                      <span className="bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-lg border border-amber-500 font-extrabold shadow-sm">BED {p.nomorBed || '-'}</span>
                    </span>
                  </td>
                  <td className="p-6 text-slate-600 font-semibold max-w-[200px] truncate">
                    {(p.dpjpList || []).join(', ') || '-'}
                  </td>
                  <td className="p-6 font-mono text-[11px] text-slate-500 max-w-[220px] truncate leading-relaxed">
                    {p.diagnosaUtama || '-'}
                  </td>
                  <td className="p-6 font-medium text-slate-500 whitespace-nowrap text-xs">
                    {p.perawatPrimer || '-'}
                  </td>
                  <td className="p-6 font-semibold text-slate-600 whitespace-nowrap">
                    {(p.paymentMethod || []).join('/') || '-'}
                  </td>
                  <td className="p-6 whitespace-nowrap font-bold text-xs">
                    <span className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                      p.status === 'ADMITTED' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {p.statusDataPasien || p.status}
                    </span>
                  </td>
                </tr>
              ))}

              {currentTabList.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-slate-400">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BadgeInfo size={32} />
                    </div>
                    <p className="text-sm font-black uppercase tracking-widest text-slate-500">Tidak ada data pasien</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">Tidak ada kriteria pasien yang keluar/masuk untuk tanggal {selectedDate}.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
