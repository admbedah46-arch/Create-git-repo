import React, { useState, useMemo } from 'react';
import { Download, Calendar, DollarSign, Wallet, TrendingUp, BarChart3, PieChart as PieIcon, Briefcase, FileText } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, PieChart, Pie, Cell
} from 'recharts';
import { FinanceRecord, MasterData, Patient, parseToStandardDateString } from '../../types';
import { Button } from '../Button';

interface FinanceSummaryViewProps {
  financeRecords: FinanceRecord[];
  patients: Patient[];
  masterData: MasterData;
}

const COLORS = ['#4f46e5', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6'];

export const FinanceSummaryView: React.FC<FinanceSummaryViewProps> = ({ financeRecords = [], patients = [], masterData }) => {
  const [selectedKSM, setSelectedKSM] = useState('Semua KSM');
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState('Semua Bulan');

  const monthsList = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' }
  ];

  // Filter financeRecords which represent patient billing and match dates/KSM
  const filteredRecords = useMemo(() => {
    return financeRecords.filter(r => {
      // Must be patient billing and visite inputs
      if (r.category !== 'Visite & Billing Pasien Pulang') return false;

      const recordDate = r.date || r.dischargeDate || '';
      if (!recordDate) return false;
      const stdDate = parseToStandardDateString(recordDate);
      if (!stdDate) return false;

      // Filter by Year
      if (!stdDate.startsWith(selectedYear)) return false;

      // Filter by Month
      if (selectedMonth !== 'Semua Bulan') {
        const monthPart = stdDate.split('-')[1]; // YYYY-MM-DD -> MM
        if (monthPart !== selectedMonth) return false;
      }

      // Filter by KSM
      if (selectedKSM !== 'Semua KSM' && r.ksm !== selectedKSM) return false;

      return true;
    });
  }, [financeRecords, selectedYear, selectedMonth, selectedKSM]);

  // Aggregate totals
  const aggregates = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => {
      acc.total += curr.amount || 0;
      acc.akomodasi += curr.billingAkomodasi || 0;
      acc.tindakan += curr.billingTindakan || 0;
      acc.gasMedis += curr.billingGasMedis || 0;
      acc.visites += curr.numVisites || 0;
      return acc;
    }, { total: 0, akomodasi: 0, tindakan: 0, gasMedis: 0, visites: 0 });
  }, [filteredRecords]);

  // Aggregate by KSM column for table and KSM contributions chart
  const ksmStats = useMemo(() => {
    const ksmMap: Record<string, {
      ksmName: string;
      totalBilling: number;
      akomodasi: number;
      tindakan: number;
      gasMedis: number;
      visites: number;
      patientCount: Set<string>;
    }> = {};

    // Initialize all master KSM to ensure zero rows are listed too if nice
    (masterData.refs?.ksmList || []).forEach(ksm => {
      ksmMap[ksm] = {
        ksmName: ksm,
        totalBilling: 0,
        akomodasi: 0,
        tindakan: 0,
        gasMedis: 0,
        visites: 0,
        patientCount: new Set<string>()
      };
    });

    filteredRecords.forEach(r => {
      const ksm = r.ksm || 'Umum';
      const patientId = r.patientId || r.noRM || 'Unknown';

      if (!ksmMap[ksm]) {
        ksmMap[ksm] = {
          ksmName: ksm,
          totalBilling: 0,
          akomodasi: 0,
          tindakan: 0,
          gasMedis: 0,
          visites: 0,
          patientCount: new Set<string>()
        };
      }

      ksmMap[ksm].totalBilling += r.amount || 0;
      ksmMap[ksm].akomodasi += r.billingAkomodasi || 0;
      ksmMap[ksm].tindakan += r.billingTindakan || 0;
      ksmMap[ksm].gasMedis += r.billingGasMedis || 0;
      ksmMap[ksm].visites += r.numVisites || 0;
      ksmMap[ksm].patientCount.add(patientId);
    });

    return Object.values(ksmMap).sort((a, b) => b.totalBilling - a.totalBilling);
  }, [filteredRecords, masterData.refs?.ksmList]);

  // Monthly breakdown for selected year
  const monthlyTimeline = useMemo(() => {
    const monthsData = monthsList.map(monthObj => {
      let total = 0;
      let akomodasi = 0;
      let tindakan = 0;
      let gasMedis = 0;

      financeRecords.forEach(r => {
        if (r.category !== 'Visite & Billing Pasien Pulang') return;
        const rDate = r.date || r.dischargeDate || '';
        if (rDate.startsWith(`${selectedYear}-${monthObj.value}`)) {
          total += r.amount || 0;
          akomodasi += r.billingAkomodasi || 0;
          tindakan += r.billingTindakan || 0;
          gasMedis += r.billingGasMedis || 0;
        }
      });

      return {
        month: monthObj.label.slice(0, 3),
        'Total Billing': Math.round(total / 1000000 * 10) / 10, // in Millions
        'Akomodasi': Math.round(akomodasi / 1000000 * 10) / 10,
        'Tindakan': Math.round(tindakan / 1000000 * 10) / 10,
        'Gas Medis': Math.round(gasMedis / 1000000 * 10) / 10
      };
    });

    return monthsData;
  }, [financeRecords, selectedYear]);

  // Pie chart breakdown for services
  const pieData = useMemo(() => {
    return [
      { name: 'Akomodasi', value: aggregates.akomodasi },
      { name: 'Tindakan Klinis', value: aggregates.tindakan },
      { name: 'Gas Medis', value: aggregates.gasMedis }
    ].filter(p => p.value > 0);
  }, [aggregates]);

  return (
    <div className="space-y-8 animate-fade-in text-slate-800">
      
      {/* Banner */}
      <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm border-l-8 border-l-indigo-600 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black flex items-center gap-4 tracking-tighter text-slate-800">
            <TrendingUp size={36} className="text-indigo-600" /> REKAP FINANSIAL LAYANAN
          </h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
            HASIL REKAPAN FINANSIAL KEUANGAN DARI ENTRYAN LAPORAN VISITE & KEUANGAN PASIEN PULANG
          </p>
        </div>
        <Button 
          onClick={() => window.print()} 
          className="bg-[#144272] text-white px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 border-0 shadow-lg"
        >
          <Download size={16}/> Cetak / PDF Report
        </Button>
      </div>

      {/* Date and KSM Filters */}
      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Year Selector */}
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Pilih Tahun</label>
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border">
            <Calendar size={14} className="text-slate-400" />
            <select 
              className="text-xs font-black focus:outline-none w-full bg-white text-slate-700"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
            >
              {[2024, 2025, 2026, 2027].map(yr => (
                <option key={yr} value={yr}>Tahun Buku {yr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Month Selector */}
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Pilih Bulan</label>
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border">
            <Calendar size={14} className="text-slate-400" />
            <select 
              className="text-xs font-black focus:outline-none w-full bg-white text-slate-700"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              <option value="Semua Bulan">Semua Bulan (Kumulatif Tahunan)</option>
              {monthsList.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KSM filter */}
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Pilih KSM / SMF</label>
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border">
            <Briefcase size={14} className="text-slate-400" />
            <select 
              className="text-xs font-black focus:outline-none w-full bg-white text-slate-700"
              value={selectedKSM}
              onChange={e => setSelectedKSM(e.target.value)}
            >
              <option>Semua KSM</option>
              {(masterData.refs?.ksmList || []).map(ksm => (
                <option key={ksm} value={ksm}>{ksm}</option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* Numerical Financial Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Total revenue */}
        <div className="bg-slate-900 text-white p-8 rounded-[2rem] border shadow-xl shadow-slate-100 flex flex-col justify-between">
          <div>
            <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest block">GRAND TOTAL BILLING REVENUE</span>
            <h2 className="text-3xl font-black mt-2">Rp {aggregates.total.toLocaleString('id-ID')}</h2>
          </div>
          <span className="text-[8px] text-slate-400 block mt-4 font-bold border-t border-white/10 pt-2">Bulan: {selectedMonth !== 'Semua Bulan' ? monthsList.find(m => m.value === selectedMonth)?.label : 'Setahun'}</span>
        </div>

        {/* Akomodasi total */}
        <div className="bg-[#144272]/5 border-2 border-dashed border-[#144272]/20 p-8 rounded-[2rem] flex flex-col justify-between">
          <div>
            <span className="text-[8px] font-black text-[#144272] uppercase tracking-widest block">SUBTOTAL BILLING AKOMODASI</span>
            <h2 className="text-2xl font-black mt-2 text-slate-800">Rp {aggregates.akomodasi.toLocaleString('id-ID')}</h2>
          </div>
          <span className="text-[8px] text-slate-400 block mt-4 font-bold">Akomodasi Ruangan & Bed Pasien</span>
        </div>

        {/* Tindakan total */}
        <div className="bg-emerald-50/50 border-2 border-dashed border-emerald-500/20 p-8 rounded-[2rem] flex flex-col justify-between">
          <div>
            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block">SUBTOTAL BILLING TINDAKAN</span>
            <h2 className="text-2xl font-black mt-2 text-emerald-800">Rp {aggregates.tindakan.toLocaleString('id-ID')}</h2>
          </div>
          <span className="text-[8px] text-slate-400 block mt-4 font-bold">Prosedur Bedah & Tindakan Medis</span>
        </div>

        {/* Gas Medis total */}
        <div className="bg-amber-50/50 border-2 border-dashed border-amber-500/20 p-8 rounded-[2rem] flex flex-col justify-between">
          <div>
            <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest block">SUBTOTAL BILLING GAS MEDIS</span>
            <h2 className="text-2xl font-black mt-2 text-amber-800">Rp {aggregates.gasMedis.toLocaleString('id-ID')}</h2>
          </div>
          <span className="text-[8px] text-slate-400 block mt-4 font-bold">Penggunaan Oksigen & Anestesi Gas</span>
        </div>

      </div>

      {/* Visual Charts Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Trend Bar Chart */}
        <div className="md:col-span-8 bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-600" /> TREN PENDAPATAN BULANAN (JUTA RUPIAH) - TAHUN BUKU {selectedYear}
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTimeline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15}/>
                <XAxis dataKey="month" fontSize={9} stroke="#94a3b8" tickLine={false} tick={{fontWeight: 'bold'}} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                <Bar dataKey="Akomodasi" stackId="revenue" fill="#3b82f6" />
                <Bar dataKey="Tindakan" stackId="revenue" fill="#10b981" />
                <Bar dataKey="Gas Medis" stackId="revenue" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie breakdown */}
        <div className="md:col-span-4 bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col justify-between">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <PieIcon size={16} className="text-indigo-600" /> PROPORSI REVENUE UTAMA
          </h3>
          
          {pieData.length > 0 ? (
            <>
              <div className="h-[180px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `Rp ${value.toLocaleString('id-ID')}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 pt-2 border-t text-[9px] font-bold">
                {pieData.map((item, idx) => {
                  const percentage = aggregates.total > 0 
                    ? ((item.value / aggregates.total) * 100).toFixed(1)
                    : '0';

                  return (
                    <div key={item.name} className="flex justify-between items-center text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="uppercase text-[8px] tracking-tight">{item.name}</span>
                      </div>
                      <span className="font-black text-slate-800">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 font-bold uppercase text-[9px] italic">
              Belum ada data visual
            </div>
          )}
        </div>

      </div>

      {/* Tabular summary sheet per KSM */}
      <div className="bg-white rounded-[2.5rem] border overflow-hidden shadow-sm">
        <div className="bg-[#144272] p-6 text-white">
          <h3 className="text-sm font-black uppercase tracking-widest">TABEL REKAPITULASI FINANSIAL PER KSM</h3>
          <p className="text-[9px] text-indigo-200 mt-1 uppercase font-bold">Analisis kontribusi pemasukan finansial dan kunjungan per SMF pelayanan</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse text-left">
            <thead className="bg-[#144272]/5 text-[#144272] border-b text-center font-black uppercase tracking-wider">
              <tr>
                <th className="p-4 w-12 border-r text-center">No</th>
                <th className="p-4 border-r text-left">Nama Kelompok KSM (SMF)</th>
                <th className="p-4 border-r text-center bg-indigo-50/50">Jml Pasien</th>
                <th className="p-4 border-r text-center bg-teal-50/50">Kunjungan Visite</th>
                <th className="p-4 border-r text-right">Rekap Akomodasi (Rp)</th>
                <th className="p-4 border-r text-right">Rekap Tindakan (Rp)</th>
                <th className="p-4 border-r text-right">Rekap Gas Medis (Rp)</th>
                <th className="p-4 text-right bg-indigo-500/10 text-indigo-950 font-black">Total Kontribusi Financial (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ksmStats.map((k, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center border-r font-bold text-slate-400">{index + 1}</td>
                  <td className="p-4 border-r font-black text-slate-800 uppercase tracking-tight">SMF {k.ksmName}</td>
                  <td className="p-4 border-r text-center bg-indigo-50/10 font-bold text-indigo-700">{k.patientCount.size} Pac.</td>
                  <td className="p-4 border-r text-center bg-teal-50/10 font-bold text-teal-700">{k.visites} Visit</td>
                  <td className="p-4 border-r text-right font-medium text-slate-600">Rp {k.akomodasi.toLocaleString('id-ID')}</td>
                  <td className="p-4 border-r text-right font-medium text-slate-600">Rp {k.tindakan.toLocaleString('id-ID')}</td>
                  <td className="p-4 border-r text-right font-medium text-slate-600">Rp {k.gasMedis.toLocaleString('id-ID')}</td>
                  <td className="p-4 text-right font-black bg-indigo-500/5 text-indigo-700 text-xs">Rp {k.totalBilling.toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-black uppercase text-xs border-t">
              <tr>
                <td colSpan={2} className="p-5 pl-10 text-xs">GRAND TOTAL REKAPAN SEBAGAI RUJUKAN</td>
                <td className="p-5 text-center bg-indigo-950 text-white text-xs">{ksmStats.reduce((sum, k) => sum + k.patientCount.size, 0)} Pac.</td>
                <td className="p-5 text-center bg-teal-950 text-white text-xs">{aggregates.visites} Visit</td>
                <td className="p-5 text-right text-[10px]">Rp {aggregates.akomodasi.toLocaleString('id-ID')}</td>
                <td className="p-5 text-right text-[10px]">Rp {aggregates.tindakan.toLocaleString('id-ID')}</td>
                <td className="p-5 text-right text-[10px]">Rp {aggregates.gasMedis.toLocaleString('id-ID')}</td>
                <td className="p-5 text-right bg-indigo-800 text-white text-xs">Rp {aggregates.total.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
};
