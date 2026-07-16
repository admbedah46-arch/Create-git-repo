import React, { useState, useMemo } from 'react';
import { Search, Download, Calendar, Stethoscope, BarChart3, Users, DollarSign, ArrowUpRight, TrendingUp } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend
} from 'recharts';
import { MasterData, FinanceRecord, User as AppUser, Patient, parseToStandardDateString } from '../../types';
import { Button } from '../Button';

interface DoctorVisitAdminProps {
  financeRecords: FinanceRecord[];
  patients: Patient[];
  masterData: MasterData;
  currentUser: AppUser | null;
}

export const DoctorVisitAdmin: React.FC<DoctorVisitAdminProps> = ({ financeRecords = [], patients = [], masterData, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSMF, setSelectedSMF] = useState('Semua SMF');
  const [selectedDoctor, setSelectedDoctor] = useState('Semua Dokter');
  const [filterPeriod, setFilterPeriod] = useState<'MONTHLY' | 'YEARLY' | 'CUSTOM'>('MONTHLY');
  
  // Bulanan / Tahunan date states
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  });
  
  const [selectedYear, setSelectedYear] = useState(() => {
    return String(new Date().getFullYear()); // YYYY
  });

  const [customDateRange, setCustomDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Filter financeRecords based on selected period and search terms
  const filteredRecords = useMemo(() => {
    return financeRecords.filter(r => {
      // Must be income category pertaining to patient billing/visites
      if (r.category !== 'Visite & Billing Pasien Pulang') return false;

      // Filter by period
      const recordDate = r.date || r.dischargeDate || '';
      if (!recordDate) return false;
      const stdDate = parseToStandardDateString(recordDate);
      if (!stdDate) return false;

      if (filterPeriod === 'MONTHLY') {
        if (!stdDate.startsWith(selectedMonth)) return false;
      } else if (filterPeriod === 'YEARLY') {
        if (!stdDate.startsWith(selectedYear)) return false;
      } else if (filterPeriod === 'CUSTOM') {
        if (stdDate < customDateRange.start || stdDate > customDateRange.end) return false;
      }

      // Filter by search terms
      const matchesSearch = 
        (r.patientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.noRM || '').includes(searchTerm) ||
        (r.dpjp || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSMF = selectedSMF === 'Semua SMF' || r.ksm === selectedSMF;
      const matchesDoctor = selectedDoctor === 'Semua Dokter' || r.dpjp === selectedDoctor;

      return matchesSearch && matchesSMF && matchesDoctor;
    });
  }, [financeRecords, filterPeriod, selectedMonth, selectedYear, customDateRange, searchTerm, selectedSMF, selectedDoctor]);

  // Aggregate rekap statistics by Doctor
  const doctorStats = useMemo(() => {
    const map: Record<string, {
      doctorName: string;
      smf: string;
      uniquePatients: Set<string>;
      totalVisites: number;
      totalBilling: number;
      akomodasi: number;
      tindakan: number;
      gasMedis: number;
    }> = {};

    filteredRecords.forEach(r => {
      const docName = r.dpjp || 'Tidak Diketahui';
      const smfName = r.ksm || 'Umum';
      const patientId = r.patientId || r.noRM || 'Unknown-Patient';

      if (!map[docName]) {
        map[docName] = {
          doctorName: docName,
          smf: smfName,
          uniquePatients: new Set<string>(),
          totalVisites: 0,
          totalBilling: 0,
          akomodasi: 0,
          tindakan: 0,
          gasMedis: 0
        };
      }

      map[docName].uniquePatients.add(patientId);
      map[docName].totalVisites += r.numVisites || 0;
      map[docName].totalBilling += r.amount || 0;
      map[docName].akomodasi += r.billingAkomodasi || 0;
      map[docName].tindakan += r.billingTindakan || 0;
      map[docName].gasMedis += r.billingGasMedis || 0;
    });

    return Object.values(map).sort((a, b) => b.totalVisites - a.totalVisites);
  }, [filteredRecords]);

  // Grand stats
  const aggregateTotals = useMemo(() => {
    return doctorStats.reduce((acc, curr) => {
      acc.patients += curr.uniquePatients.size;
      acc.visites += curr.totalVisites;
      acc.billing += curr.totalBilling;
      return acc;
    }, { patients: 0, visites: 0, billing: 0 });
  }, [doctorStats]);

  // Chart data
  const chartData = useMemo(() => {
    return doctorStats.slice(0, 10).map(d => ({
      name: d.doctorName.split(',')[0], // Short name
      'Jml Visite': d.totalVisites,
      'Pasien Pulang': d.uniquePatients.size
    }));
  }, [doctorStats]);

  const ksmList = Array.from(new Set(financeRecords.map(r => r.ksm).filter(Boolean)));

  return (
    <div className="space-y-8 animate-fade-in text-slate-800">
      <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-8">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
          <div>
            <h2 className="text-3xl font-black flex items-center gap-4 tracking-tighter text-slate-800">
              <Stethoscope size={36} className="text-indigo-600 animate-pulse" /> LAPORAN KERJA VISITE
            </h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
              REKAP LAPORAN VISITE &bull; HASIL REKAP LAPORAN VISITE DAN KEUANGAN
            </p>
          </div>
          <Button 
            onClick={() => window.print()} 
            className="bg-slate-900 hover:bg-slate-800 border-none text-white shadow-xl px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2"
          >
            <Download size={16}/> Export Excel / PDF
          </Button>
        </div>

        {/* Filters and Date Period Controllers */}
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b pb-4 border-slate-200/50">
            {/* Period selector */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 w-full md:w-auto">
              <button 
                onClick={() => setFilterPeriod('MONTHLY')}
                className={`flex-1 md:px-5 py-2 text-[10px] font-black rounded-xl transition-all ${filterPeriod === 'MONTHLY' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >
                REKAP BULANAN
              </button>
              <button 
                onClick={() => setFilterPeriod('YEARLY')}
                className={`flex-1 md:px-5 py-2 text-[10px] font-black rounded-xl transition-all ${filterPeriod === 'YEARLY' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >
                REKAP TAHUNAN
              </button>
              <button 
                onClick={() => setFilterPeriod('CUSTOM')}
                className={`flex-1 md:px-5 py-2 text-[10px] font-black rounded-xl transition-all ${filterPeriod === 'CUSTOM' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >
                KUSTOM TANGGAL
              </button>
            </div>

            {/* Dynamic Date Pickers depending on period */}
            <div className="w-full md:w-auto flex items-center gap-3">
              {filterPeriod === 'MONTHLY' && (
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full">
                  <Calendar size={14} className="text-slate-400" />
                  <input 
                    type="month" 
                    className="text-[11px] font-black focus:outline-none w-full"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                  />
                </div>
              )}

              {filterPeriod === 'YEARLY' && (
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border w-full">
                  <Calendar size={14} className="text-slate-400" />
                  <select 
                    className="text-[11px] font-black focus:outline-none w-full bg-white"
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                  >
                    {[2024, 2025, 2026, 2027].map(yr => (
                      <option key={yr} value={yr}>{yr} TAHUNAN</option>
                    ))}
                  </select>
                </div>
              )}

              {filterPeriod === 'CUSTOM' && (
                <div className="flex items-center gap-2 w-full">
                  <input 
                    type="date" 
                    className="text-[10px] font-bold p-2.5 bg-white border rounded-xl"
                    value={customDateRange.start}
                    onChange={e => setCustomDateRange({...customDateRange, start: e.target.value})}
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input 
                    type="date" 
                    className="text-[10px] font-bold p-2.5 bg-white border rounded-xl"
                    value={customDateRange.end}
                    onChange={e => setCustomDateRange({...customDateRange, end: e.target.value})}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Standard filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Cari Nama Dokter / RM</label>
              <input 
                type="text"
                placeholder="Ketik nama atau kata kunci..."
                className="w-full px-4 py-2.5 bg-white border rounded-xl text-[10px] font-bold"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Filter KSM / SMF</label>
              <select 
                className="w-full px-4 py-2.5 bg-white border rounded-xl text-[10px] font-bold"
                value={selectedSMF}
                onChange={e => setSelectedSMF(e.target.value)}
              >
                <option>Semua SMF</option>
                {ksmList.map(smf => <option key={smf} value={smf}>{smf}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Filter Dokter DPJP</label>
              <select 
                className="w-full px-4 py-2.5 bg-white border rounded-xl text-[10px] font-bold"
                value={selectedDoctor}
                onChange={e => setSelectedDoctor(e.target.value)}
              >
                <option>Semua Dokter</option>
                {masterData.doctors.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Statistical Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">Total Visites (Kunjungan)</span>
              <h3 className="text-3xl font-black text-indigo-900 mt-1">{aggregateTotals.visites} Visit</h3>
            </div>
            <div className="p-4 bg-indigo-100/50 text-indigo-700 rounded-xl"><Stethoscope size={24} /></div>
          </div>
          <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block">Pasien Pulang Terlayani</span>
              <h3 className="text-3xl font-black text-emerald-950 mt-1">{aggregateTotals.patients} Pasien</h3>
            </div>
            <div className="p-4 bg-emerald-100/50 text-emerald-700 rounded-xl"><Users size={24} /></div>
          </div>
          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block">Total Billing Rekap</span>
              <h3 className="text-3xl font-black text-amber-900 mt-1">Rp {aggregateTotals.billing.toLocaleString('id-ID')}</h3>
            </div>
            <div className="p-4 bg-amber-100/50 text-amber-700 rounded-xl"><DollarSign size={24} /></div>
          </div>
        </div>

        {/* Chart visualisation */}
        {chartData.length > 0 && (
          <div className="bg-slate-50/50 p-6 rounded-3xl border">
            <h3 className="text-xs font-black uppercase tracking-widest ml-2 mb-4 text-slate-500">10 Bintang Dokter - Frekuensi Visite Terbanyak</h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15}/>
                  <XAxis dataKey="name" fontSize={8} tickLine={false} tick={{fill: '#475569', fontWeight: 'bold'}} />
                  <YAxis fontSize={9} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  <Bar dataKey="Jml Visite" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pasien Pulang" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Main Consolidate Table: HASIL REKAP VISITE DOKTER */}
        <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
          <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest">TABEL REKAP KERJA VISITE DOKTER</h3>
              <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase">Dihitung dari sub-menu "Laporan Visite & Keuangan"</p>
            </div>
            <span className="text-[9px] font-black bg-white/20 px-3 py-1.5 rounded-lg uppercase">
              {filterPeriod === 'MONTHLY' ? `Bulan: ${selectedMonth}` : filterPeriod === 'YEARLY' ? `Tahun: ${selectedYear}` : 'KUSTOM'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse text-left">
              <thead className="bg-[#144272]/5 text-[#144272] border-b text-center font-black uppercase tracking-wider">
                <tr>
                  <th className="p-4 w-12 border-r text-center">No</th>
                  <th className="p-4 border-r text-left">Nama Dokter DPJP</th>
                  <th className="p-4 border-r text-left">KSM / SMF</th>
                  <th className="p-4 border-r text-center bg-emerald-50/40 text-emerald-950">Jumlah Pasien</th>
                  <th className="p-4 border-r text-center bg-indigo-50/40 text-indigo-950">Jumlah Visite</th>
                  <th className="p-4 border-r text-right">Rata-rata Visite/Pasien</th>
                  <th className="p-4 border-r text-right">Subtotal Billing Akomodasi</th>
                  <th className="p-4 text-right bg-amber-500/10 text-amber-950">Total Billing (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctorStats.map((d, index) => {
                  const avgVisites = d.uniquePatients.size > 0 
                    ? (d.totalVisites / d.uniquePatients.size).toFixed(1)
                    : '0.0';

                  return (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-center border-r font-bold text-slate-400">{index + 1}</td>
                      <td className="p-4 border-r font-black text-slate-800 uppercase tracking-tight">{d.doctorName}</td>
                      <td className="p-4 border-r font-black text-slate-500">{d.smf}</td>
                      <td className="p-4 border-r text-center bg-emerald-50/10 font-bold text-emerald-700">{d.uniquePatients.size}</td>
                      <td className="p-4 border-r text-center bg-indigo-50/10 font-black text-indigo-700">{d.totalVisites}</td>
                      <td className="p-4 border-r text-right font-medium text-slate-500">{avgVisites} x</td>
                      <td className="p-4 border-r text-right font-medium text-slate-600">Rp {d.akomodasi.toLocaleString('id-ID')}</td>
                      <td className="p-4 text-right font-black bg-amber-500/5 text-slate-800">Rp {d.totalBilling.toLocaleString('id-ID')}</td>
                    </tr>
                  );
                })}

                {doctorStats.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/20">
                      Tidak ada rekap data visite untuk periode terpilih.
                    </td>
                  </tr>
                )}
              </tbody>
              {doctorStats.length > 0 && (
                <tfoot className="bg-slate-800 text-white font-black uppercase text-xs">
                  <tr>
                    <td colSpan={3} className="p-4 pl-8">TOTAL KESELURUHAN</td>
                    <td className="p-4 text-center bg-emerald-950 text-white">{aggregateTotals.patients}</td>
                    <td className="p-4 text-center bg-indigo-950 text-white">{aggregateTotals.visites}</td>
                    <td className="p-4 border-r"></td>
                    <td className="p-4 border-r"></td>
                    <td className="p-4 text-right bg-amber-650 text-white">Rp {aggregateTotals.billing.toLocaleString('id-ID')}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
