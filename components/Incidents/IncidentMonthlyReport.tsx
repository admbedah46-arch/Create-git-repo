
import React, { useState, useMemo } from 'react';
import { IncidentReport } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { 
  FileText, Calendar, Filter, TrendingUp, AlertCircle, 
  ChevronRight, ArrowRight, Download, BarChart2, PieChart as PieChartIcon,
  ShieldAlert
} from 'lucide-react';
import { Button } from '../Button';

interface IncidentMonthlyReportProps {
  reports: IncidentReport[];
}

const COLORS = {
  KNC: '#3b82f6',
  KTC: '#10b981',
  KTD: '#f59e0b',
  SENTINEL: '#ef4444',
  KPC: '#8b5cf6',
  BLUE: '#3b82f6',
  GREEN: '#10b981',
  YELLOW: '#facc15',
  RED: '#ef4444'
};

export const IncidentMonthlyReport: React.FC<IncidentMonthlyReportProps> = ({ reports }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const filteredReportsByMonth = useMemo(() => {
    return reports.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [reports, selectedMonth, selectedYear]);

  const chartDataByType = useMemo(() => {
    const types = ['KNC', 'KTC', 'KTD', 'SENTINEL', 'KPC'];
    return types.map(type => ({
      name: type,
      value: filteredReportsByMonth.filter(r => r.incidentType === type).length,
      fill: COLORS[type as keyof typeof COLORS] || '#94a3b8'
    })).filter(d => d.value > 0);
  }, [filteredReportsByMonth]);

  const chartDataBySeverity = useMemo(() => {
    const severities = ['BLUE', 'GREEN', 'YELLOW', 'RED'];
    return severities.map(sev => ({
      name: sev,
      value: filteredReportsByMonth.filter(r => r.severity === sev).length,
      fill: COLORS[sev as keyof typeof COLORS] || '#94a3b8'
    })).filter(d => d.value > 0);
  }, [filteredReportsByMonth]);

  const chartDataByMonthTrend = useMemo(() => {
    return monthNames.map((name, index) => {
      const count = reports.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === index && d.getFullYear() === selectedYear;
      }).length;
      return { name: name.substring(0, 3), count };
    });
  }, [reports, selectedYear]);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
             <BarChart2 className="text-blue-600"/> Laporan Insiden Bulanan
          </h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Monitoring & Analisis Tren Insiden Keselamatan Pasien</p>
        </div>
        
        <div className="flex gap-3 bg-white p-2 rounded-2xl border shadow-sm self-end md:self-auto">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-slate-50 border-0 text-xs font-black text-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {monthNames.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-slate-50 border-0 text-xs font-black text-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border shadow-sm group hover:shadow-xl transition-all h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500"/> Tren Insiden Per Bulan ({selectedYear})
            </h4>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataByMonthTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#94a3b8', fontWeight: 800}} />
                <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#94a3b8', fontWeight: 800}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 800, color: '#1e293b' }}
                />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={4} dot={{ r: 6, fill: '#2563eb', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stats Column */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden group">
            <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Insiden</h4>
            <div className="text-5xl font-black mb-2 relative z-10">{filteredReportsByMonth.length}</div>
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest relative z-10">{monthNames[selectedMonth]} {selectedYear}</div>
          </div>
          
          <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Grading Severity</h4>
            <div className="space-y-3">
              {['RED', 'YELLOW', 'GREEN', 'BLUE'].map(sev => {
                const count = filteredReportsByMonth.filter(r => r.severity === sev).length;
                const percent = filteredReportsByMonth.length > 0 ? (count / filteredReportsByMonth.length) * 100 : 0;
                const colors = {
                  RED: 'bg-rose-500',
                  YELLOW: 'bg-amber-400',
                  GREEN: 'bg-emerald-500',
                  BLUE: 'bg-blue-500'
                };
                return (
                  <div key={sev} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[9px] font-black uppercase">
                      <span className="text-slate-500">{sev}</span>
                      <span className="text-slate-800">{count} Kasus</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[sev as keyof typeof colors]}`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Type Distribution */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col items-center">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-8 self-start">
            <PieChartIcon size={16} className="text-emerald-500"/> Distribusi Jenis Insiden
          </h4>
          <div className="w-full h-[250px]">
            {chartDataByType.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {chartDataByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="middle" align="right" layout="vertical" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-bold italic text-xs">Belum ada data di bulan ini</div>
            )}
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col items-center">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-8 self-start">
            <ShieldAlert size={16} className="text-rose-500"/> Distribusi Grading (Risk)
          </h4>
          <div className="w-full h-[250px]">
            {chartDataBySeverity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataBySeverity}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {chartDataBySeverity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="middle" align="right" layout="vertical" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-bold italic text-xs">Belum ada data di bulan ini</div>
            )}
          </div>
        </div>
      </div>

      {/* Incident List Table */}
      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
        <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <FileText size={16} className="text-indigo-500"/> Daftar Insiden - {monthNames[selectedMonth]} {selectedYear}
          </h4>
          <Button variant="secondary" className="px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 bg-white">
            <Download size={14}/> Export Data
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white border-b">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">Tanggal</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">Nama Insiden</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">Pasien</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-tighter text-center">Jenis</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-tighter text-center">Grading</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-tighter text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredReportsByMonth.length > 0 ? filteredReportsByMonth.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5 text-xs font-bold text-slate-600">{r.date}</td>
                  <td className="px-8 py-5">
                    <div className="text-xs font-black text-slate-800 uppercase leading-snug group-hover:text-blue-600 transition-colors">{r.incidentName}</div>
                    <div className="text-[9px] font-medium text-slate-400 mt-0.5">{r.location}</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="text-xs font-black text-slate-700">{r.patientName || '-'}</div>
                    <div className="text-[9px] font-bold text-slate-400">{r.noRM || '-'}</div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase text-white shadow-sm`} style={{ backgroundColor: COLORS[r.incidentType as keyof typeof COLORS] }}>
                      {r.incidentType}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="flex justify-center">
                      <div className={`w-4 h-4 rounded-full shadow-sm ring-2 ring-offset-2`} style={{ backgroundColor: COLORS[r.severity as keyof typeof COLORS], ringColor: `${COLORS[r.severity as keyof typeof COLORS]}33` }}></div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                      r.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      r.status === 'INVESTIGATING' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold italic text-sm">
                    Tidak ada insiden yang dilaporkan di bulan ini.
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
