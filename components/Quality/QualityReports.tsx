
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { Patient, DailyReportEntry, MasterData, QualityMeasurement, User as AppUser } from '../../types';
// Added Gauge to the imports from lucide-react
import { FilePieChart, Activity, UserCheck, ClipboardList, TrendingUp, Gauge, Check, X } from 'lucide-react';

interface QualityReportsProps {
  type: 'DIAGNOSIS' | 'DEPENDENCY' | 'ATTENDANCE' | 'PATHWAY' | 'VISITE_COMPLIANCE' | 'DPJP_ABSENSI';
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  doctorVisits?: any[];
  masterData: MasterData;
  currentUser: AppUser | null;
  qualityMeasurements?: QualityMeasurement[];
}

export const QualityReports: React.FC<QualityReportsProps> = ({ 
  type, 
  patients: rawPatients, 
  dailyReports: rawDailyReports, 
  doctorVisits = [],
  masterData, 
  currentUser,
  qualityMeasurements = []
}) => {
  const [dateRange, setDateRange] = React.useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedUnit, setSelectedUnit] = React.useState(() => {
    const isFullAccess = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || currentUser?.role === 'PIC';
    if (currentUser?.unit && !isFullAccess) {
      return currentUser.unit;
    }
    return 'Semua Unit';
  });

  React.useEffect(() => {
    const isFullAccess = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || currentUser?.role === 'PIC';
    if (currentUser?.unit && !isFullAccess) {
      setSelectedUnit(currentUser.unit);
    }
  }, [currentUser]);

  const units = React.useMemo(() => {
    const isFullAccess = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || currentUser?.role === 'PIC';
    if (currentUser?.unit && !isFullAccess) {
      return [currentUser.unit];
    }
    // Prioritize units from visits but merge with masterData if needed
    const visitsUnits = Array.from(new Set(doctorVisits.map(v => v.unit))).filter(Boolean);
    const masterUnits = masterData.units || [];
    return Array.from(new Set([...visitsUnits, ...masterUnits])).sort();
  }, [doctorVisits, masterData.units, currentUser]);
  
  const patients = React.useMemo(() => {
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
    let list = rawPatients;
    if (selectedUnit !== 'Semua Unit') {
      list = list.filter(p => normalize(p.unitTujuan) === normalize(selectedUnit));
    }
    return list;
  }, [rawPatients, selectedUnit]);

  const dailyReports = React.useMemo(() => {
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
    let list = rawDailyReports;
    if (selectedUnit !== 'Semua Unit') {
      const unitPatients = rawPatients.filter(p => normalize(p.unitTujuan) === normalize(selectedUnit)).map(p => p.id);
      list = list.filter(r => unitPatients.includes(r.patientId));
    }
    return list;
  }, [rawDailyReports, rawPatients, selectedUnit]);

  const renderDiagnosisReport = () => {
    const counts: Record<string, number> = {};
    patients.forEach(p => {
      if (p.diagnosaUtama) {
        counts[p.diagnosaUtama] = (counts[p.diagnosaUtama] || 0) + 1;
      }
    });
    
    const data = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return (
      <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-10 animate-fade-in">
        <div className="flex justify-between items-center">
           <div>
              <h3 className="text-3xl font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter">
                <FilePieChart size={36} className="text-indigo-600"/> Top 10 Diagnosa Terbanyak
              </h3>
              <p className="text-slate-400 mt-2 font-medium">Berdasarkan data input diagnosa utama seluruh pasien aktif dan riwayat bulan ini.</p>
           </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           <div className="lg:col-span-8 h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={data} layout="vertical" margin={{ left: 150 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1}/>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={140} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} axisLine={false} tickLine={false}/>
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="count" fill="#4f46e5" radius={[0, 10, 10, 0]} barSize={32}>
                       {data.map((entry, index) => (
                         <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.08)} />
                       ))}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="lg:col-span-4 space-y-4">
              {data.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <div className="flex items-center gap-4">
                      <span className="w-8 h-8 flex items-center justify-center bg-white rounded-lg border font-black text-xs text-slate-400">{i+1}</span>
                      <span className="text-xs font-black text-slate-700 uppercase tracking-tight truncate max-w-[180px]">{item.name}</span>
                   </div>
                   <span className="text-lg font-black text-indigo-600">{item.count}</span>
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  };

  const renderDependencyReport = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayReports = dailyReports.filter(r => r.date === today);

    // Group dependency data by date for chart
    const dateMap: Record<string, { MINIMAL: number, PARSIAL: number, TOTAL: number }> = {};
    
    dailyReports.forEach(r => {
      if (!dateMap[r.date]) dateMap[r.date] = { MINIMAL: 0, PARSIAL: 0, TOTAL: 0 };
      
      // Use set to count unique patients per date with a specific dependency level
      // This avoids double counting if multiple shifts are marked the same way
      const patientMorning = r.morningDependency;
      const patientAfternoon = r.afternoonDependency;
      const patientNight = r.nightDependency;

      if (patientMorning) dateMap[r.date][patientMorning]++;
      else if (patientAfternoon) dateMap[r.date][patientAfternoon]++;
      else if (patientNight) dateMap[r.date][patientNight]++;
    });

    const chartData = Object.entries(dateMap).map(([date, counts]) => ({
      date: date.split('-').slice(1).join('/'),
      ...counts
    })).sort((a,b) => a.date.localeCompare(b.date)).slice(-7);

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {[
             { label: 'MINIMAL CARE', color: 'emerald', val: todayReports.filter(r => r.morningDependency === 'MINIMAL' || r.afternoonDependency === 'MINIMAL' || r.nightDependency === 'MINIMAL').length },
             { label: 'PARSIAL CARE', color: 'amber', val: todayReports.filter(r => r.morningDependency === 'PARSIAL' || r.afternoonDependency === 'PARSIAL' || r.nightDependency === 'PARSIAL').length },
             { label: 'TOTAL CARE', color: 'rose', val: todayReports.filter(r => r.morningDependency === 'TOTAL' || r.afternoonDependency === 'TOTAL' || r.nightDependency === 'TOTAL').length },
           ].map((stat, i) => (
             <div key={i} className={`bg-white p-8 rounded-[2rem] border shadow-sm border-b-8 border-b-${stat.color}-500 transition-all hover:scale-105`}>
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{stat.label} (Hari Ini)</h5>
                <div className="text-4xl font-black text-slate-800">{stat.val} <span className="text-xs text-slate-300 font-bold">Pasien</span></div>
             </div>
           ))}
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
           <h3 className="text-2xl font-black text-slate-800 mb-10 flex items-center gap-3">
             <Activity size={32} className="text-indigo-600"/> Tren Beban Kerja Keperawatan (7 Hari)
           </h3>
           <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs>
                       <linearGradient id="colorMin" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                       <linearGradient id="colorPar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                       <linearGradient id="colorTot" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" />
                    <Area type="monotone" dataKey="MINIMAL" stroke="#10b981" fillOpacity={1} fill="url(#colorMin)" stackId="1" />
                    <Area type="monotone" dataKey="PARSIAL" stroke="#f59e0b" fillOpacity={1} fill="url(#colorPar)" stackId="1" />
                    <Area type="monotone" dataKey="TOTAL" stroke="#ef4444" fillOpacity={1} fill="url(#colorTot)" stackId="1" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>
    );
  };

  const renderAttendanceReport = () => {
    // Group visits by SMF for summary
    const smfStats: Record<string, { hadir: number, absen: number, izin: number }> = {};
    const docVisitsMap: Record<string, { hadir: number, absen: number, izin: number, smf: string }> = {};
    
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
    // Apply filters
    const filteredVisits = doctorVisits.filter(v => {
      const matchesUnit = selectedUnit === 'Semua Unit' || normalize(v.unit) === normalize(selectedUnit);
      const matchesDate = v.date >= dateRange.start && v.date <= dateRange.end;
      return matchesUnit && matchesDate;
    });

    filteredVisits.forEach(v => {
      const statuses = v.attendanceStatuses || [v.attendanceStatus];
      
      // Interpretation logic for attendance
      let result: 'HADIR' | 'ABSEN' | 'IZIN' = 'ABSEN';
      
      if (statuses.includes('IZIN') || statuses.includes('CUTI')) {
        result = 'IZIN';
      } else if (statuses.includes('TIDAK_HADIR')) {
        result = 'ABSEN';
      } else if (statuses.includes('HADIR') || statuses.includes('ASISTEN')) {
        result = 'HADIR';
      }

      // Doc level
      if (!docVisitsMap[v.doctorName]) {
        docVisitsMap[v.doctorName] = { hadir: 0, absen: 0, izin: 0, smf: v.smf };
      }
      if (result === 'HADIR') docVisitsMap[v.doctorName].hadir++;
      else if (result === 'IZIN') docVisitsMap[v.doctorName].izin++;
      else docVisitsMap[v.doctorName].absen++;

      // SMF level
      if (!smfStats[v.smf]) smfStats[v.smf] = { hadir: 0, absen: 0, izin: 0 };
      if (result === 'HADIR') smfStats[v.smf].hadir++;
      else if (result === 'IZIN') smfStats[v.smf].izin++;
      else smfStats[v.smf].absen++;
    });

    const docData = Object.entries(docVisitsMap).map(([name, stats]) => ({
      name,
      ...stats,
      percentage: Math.round((stats.hadir / (stats.hadir + stats.absen + stats.izin)) * 100) || 0
    }));

    const smfData = Object.entries(smfStats).map(([name, stats]) => ({
      name,
      ...stats,
      percentage: Math.round((stats.hadir / (stats.hadir + stats.absen + stats.izin)) * 100) || 0
    }));

    return (
      <div className="space-y-8 animate-fade-in text-slate-800">
         <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h3 className="text-3xl font-black flex items-center gap-3 tracking-tighter">
                    <UserCheck size={36} className="text-emerald-600"/> INDIKATOR MUTU: ABSENSI DPJP
                  </h3>
                  <p className="text-slate-400 font-medium uppercase text-[10px] tracking-widest mt-1">Monitoring Kehadiran Dokter Penanggung Jawab Pelayanan</p>
               </div>
               <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-100 flex items-center gap-2">
                 Export PDF / Excel
               </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Analisis Per SMF</h4>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={smfData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} />
                           <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                           <Bar dataKey="percentage" fill="#10b981" radius={[8, 8, 0, 0]} barSize={40}>
                              {smfData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.percentage >= 80 ? '#10b981' : '#ef4444'} />
                              ))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Distribusi Kehadiran</h4>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={[
                                { name: 'Hadir', value: docData.reduce((acc, d) => acc + d.hadir, 0) },
                                { name: 'Absen', value: docData.reduce((acc, d) => acc + d.absen, 0) },
                                { name: 'Izin/Cuti', value: docData.reduce((acc, d) => acc + d.izin, 0) }
                              ]}
                              cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                           >
                              <Cell fill="#10b981" />
                              <Cell fill="#ef4444" />
                              <Cell fill="#f59e0b" />
                           </Pie>
                           <Tooltip />
                           <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b">
                     <tr>
                        <th className="p-6">DPJP / DOKTER</th>
                        <th className="p-6">SMF / KSM</th>
                        <th className="p-6 text-center">Hadir</th>
                        <th className="p-6 text-center">Absen</th>
                        <th className="p-6 text-center">Izin/Cuti</th>
                        <th className="p-6 text-center">Persentase</th>
                        <th className="p-6 text-center">Status</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {docData.sort((a,b) => a.percentage - b.percentage).map(doc => (
                       <tr key={doc.name} className="hover:bg-slate-50 transition-colors">
                          <td className="p-6 font-black text-xs text-slate-700 uppercase">{doc.name}</td>
                          <td className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">SMF {doc.smf || 'LAINNYA'}</td>
                          <td className="p-6 text-center font-bold text-emerald-600 text-xs">{doc.hadir}</td>
                          <td className="p-6 text-center font-bold text-rose-600 text-xs">{doc.absen}</td>
                          <td className="p-6 text-center font-bold text-amber-600 text-xs">{doc.izin}</td>
                          <td className="p-6 text-center">
                             <div className="flex items-center gap-3">
                               <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden w-20">
                                  <div className={`${doc.percentage >= 80 ? 'bg-emerald-500' : 'bg-rose-500'} h-full`} style={{width: `${doc.percentage}%`}}></div>
                               </div>
                               <span className="text-[10px] font-black text-slate-600">{doc.percentage}%</span>
                             </div>
                          </td>
                          <td className="p-6 text-center">
                             <span className={`px-4 py-1.5 rounded-full font-black text-[9px] uppercase tracking-widest ${doc.percentage >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                               {doc.percentage >= 80 ? 'TERCAPAI' : 'RENDAH'}
                             </span>
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    );
  };

  const renderPathwayReport = () => {
    // Get all clinical pathway audit data
    const pathwayMeasurements = qualityMeasurements.filter(m => m.indicatorId === 'pathway-1' && m.auditData);
    
    const allAuditRows: any[] = [];
    pathwayMeasurements.forEach(m => {
       (m.auditData || []).forEach((row: any) => {
          allAuditRows.push({ ...row, date: m.date });
       });
    });

    const diagnosisStats: Record<string, { total: number, compliant: number }> = {};
    allAuditRows.forEach(row => {
       const diag = row.diagnosis || 'LAINNYA';
       if (!diagnosisStats[diag]) diagnosisStats[diag] = { total: 0, compliant: 0 };
       diagnosisStats[diag].total++;
       const isFull = Object.values(row.compliance).every(v => v === true);
       if (isFull) diagnosisStats[diag].compliant++;
    });

    const chartData = Object.entries(diagnosisStats).map(([name, stats]) => ({
       name,
       percentage: Math.round((stats.compliant / stats.total) * 100) || 0,
       total: stats.total
    }));

    return (
      <div className="space-y-8 animate-fade-in text-slate-800">
         <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h3 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tighter">
                    <ClipboardList size={36} className="text-indigo-600"/> EVALUASI CLINICAL PATHWAY (CP)
                  </h3>
                  <p className="text-slate-400 font-medium uppercase text-[10px] tracking-widest mt-1">Monitoring Kepatuhan Implementasi Standar CP per Diagnosa</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Pencapaian per Diagnosa (%)</h4>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} />
                           <Tooltip />
                           <Bar dataKey="percentage" fill="#4f46e5" radius={[8, 8, 0, 0]} barSize={40}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.percentage >= 80 ? '#10b981' : '#f59e0b'} />
                              ))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>
               
               <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 flex flex-col justify-center items-center text-center">
                  <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-6 shadow-xl shadow-indigo-100">
                     <ClipboardList size={40}/>
                  </div>
                  <h4 className="text-5xl font-black text-slate-800 tracking-tighter">
                    {allAuditRows.length}
                    <span className="text-sm text-slate-400 ml-2">Total Pasien Diaudit</span>
                  </h4>
                  <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-sm">
                     <div className="p-4 bg-white rounded-2xl border flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Patuh</span>
                        <span className="text-2xl font-black text-emerald-500">{allAuditRows.filter(r => Object.values(r.compliance).every(v => v === true)).length}</span>
                     </div>
                     <div className="p-4 bg-white rounded-2xl border flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Varian</span>
                        <span className="text-2xl font-black text-rose-500">{allAuditRows.filter(r => !Object.values(r.compliance).every(v => v === true)).length}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-slate-100 shadow-inner">
               <table className="w-full text-left text-xs bg-white">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                     <tr>
                        <th className="p-6">Tgl Audit</th>
                        <th className="p-6">Nama / No RM</th>
                        <th className="p-6">Diagnosa</th>
                        <th className="p-6 text-center">Asesmen</th>
                        <th className="p-6 text-center">Penunjang</th>
                        <th className="p-6 text-center">Tindakan</th>
                        <th className="p-6 text-center">Terapi</th>
                        <th className="p-6 text-center">LOS</th>
                        <th className="p-6 text-center">Result</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {allAuditRows.sort((a,b) => b.date.localeCompare(a.date)).map((row, i) => {
                        const isFull = Object.values(row.compliance).every(v => v === true);
                        return (
                          <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                             <td className="p-6 font-bold text-slate-400">{row.date}</td>
                             <td className="p-6 font-black text-slate-700 uppercase">{row.patientName}</td>
                             <td className="p-6 font-bold text-indigo-500 uppercase tracking-tighter">{row.diagnosis}</td>
                             <td className="p-6 text-center">{row.compliance.assess ? <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Check size={12}/></div> : <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><X size={12}/></div>}</td>
                             <td className="p-6 text-center">{row.compliance.labs ? <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Check size={12}/></div> : <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><X size={12}/></div>}</td>
                             <td className="p-6 text-center">{row.compliance.surgery ? <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Check size={12}/></div> : <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><X size={12}/></div>}</td>
                             <td className="p-6 text-center">{row.compliance.pharmacy ? <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Check size={12}/></div> : <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><X size={12}/></div>}</td>
                             <td className="p-6 text-center">{row.compliance.los ? <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"><Check size={12}/></div> : <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto"><X size={12}/></div>}</td>
                             <td className="p-6 text-center">
                                <span className={`px-4 py-1 rounded-full font-black text-[9px] uppercase tracking-widest ${isFull ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                  {isFull ? 'COMPLIANT' : 'VARIANT'}
                                </span>
                             </td>
                          </tr>
                        );
                     })}
                  </tbody>
               </table>
               {allAuditRows.length === 0 && (
                 <div className="p-24 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-20">
                   Belum ada data audit Clinical Pathway hari ini
                 </div>
               )}
            </div>
         </div>
      </div>
    );
  };

  const renderVisiteComplianceReport = () => {
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
    // 1. Filter visits based on user selection
    const filteredVisits = doctorVisits.filter(v => {
      const matchesUnit = selectedUnit === 'Semua Unit' || normalize(v.unit) === normalize(selectedUnit);
      const matchesDate = v.date >= dateRange.start && v.date <= dateRange.end;
      return matchesUnit && matchesDate;
    });

    // 2. Group data by Date and Doctor
    const groupedData: Record<string, Record<string, { total: number, compliant: number, nonCompliant: number, times: string[] }>> = {};
    
    filteredVisits.forEach(v => {
      if (!groupedData[v.date]) groupedData[v.date] = {};
      if (!groupedData[v.date][v.doctorName]) {
        groupedData[v.date][v.doctorName] = { total: 0, compliant: 0, nonCompliant: 0, times: [] };
      }
      
      const stats = groupedData[v.date][v.doctorName];
      stats.total++;
      
      const statuses = v.attendanceStatuses || [v.attendanceStatus];
      if (statuses.includes('HADIR') || statuses.includes('ASISTEN')) {
        stats.compliant++;
      } else if (statuses.includes('TIDAK_HADIR') || statuses.includes('ABSEN')) {
        stats.nonCompliant++;
      }
      
      if (v.recordedAt) {
        stats.times.push(new Date(v.recordedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }));
      }
    });

    // 3. Flatten for Table
    const flatRows: any[] = [];
    Object.entries(groupedData).sort((a,b) => a[0].localeCompare(b[0])).forEach(([date, doctors]) => {
      let firstDate = true;
      Object.entries(doctors).forEach(([doctor, stats]) => {
        flatRows.push({
          date,
          doctor,
          time: stats.times.sort()[0] || '-', // Earliest visit time
          total: stats.total,
          visited: stats.compliant,
          notVisited: stats.nonCompliant,
          showDate: firstDate
        });
        firstDate = false;
      });
    });

    // 4. Analytics Data for Charts
    const smfDataMap: Record<string, { total: number, compliant: number }> = {};
    filteredVisits.forEach(v => {
      const smfName = v.smf || 'NON-SMF';
      if (!smfDataMap[smfName]) smfDataMap[smfName] = { total: 0, compliant: 0 };
      smfDataMap[smfName].total++;
      const statuses = v.attendanceStatuses || [v.attendanceStatus];
      if (statuses.includes('HADIR') || statuses.includes('ASISTEN')) {
        smfDataMap[smfName].compliant++;
      }
    });

    const smfChartData = Object.entries(smfDataMap).map(([name, stats]) => ({
      name,
      total: stats.total,
      visited: stats.compliant,
      notVisited: stats.total - stats.compliant,
      percentage: Math.round((stats.compliant / stats.total) * 100) || 0
    })).sort((a,b) => b.percentage - a.percentage);

    const overallTotal = filteredVisits.length;
    const overallCompliant = filteredVisits.filter(v => {
      const s = v.attendanceStatuses || [v.attendanceStatus];
      return s.includes('HADIR') || s.includes('ASISTEN');
    }).length;
    const overallNotCompliant = overallTotal - overallCompliant;
    const overallPercentage = Math.round((overallCompliant / overallTotal) * 100) || 0;

    const overallChartData = [
      { name: 'Sesuai (Visited)', value: overallCompliant, color: '#10b981' },
      { name: 'Tidak Sesuai', value: overallNotCompliant, color: '#ef4444' }
    ];

    return (
      <div className="space-y-8 animate-fade-in text-slate-800">
         {/* Charts Analytics Section */}
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
            {/* Overall Pie Chart */}
            <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col items-center">
               <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 self-start">Pencapaian Keseluruhan</h4>
               <div className="h-[240px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                           data={overallChartData}
                           innerRadius={60}
                           outerRadius={80}
                           paddingAngle={5}
                           dataKey="value"
                        >
                           {overallChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                           ))}
                        </Pie>
                        <Tooltip 
                           contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                        />
                     </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <div className="text-4xl font-black text-slate-800 tracking-tighter">{overallPercentage}%</div>
                     <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Compliant</div>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4 w-full mt-6">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center group/item hover:bg-emerald-100 transition-colors">
                     <span className="text-[9px] font-black text-emerald-600/50 uppercase">VISITED</span>
                     <span className="text-xl font-black text-emerald-600">{overallCompliant}</span>
                     <span className="text-[10px] font-black text-emerald-600 mt-1">{overallTotal > 0 ? Math.round((overallCompliant/overallTotal)*100) : 0}%</span>
                  </div>
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex flex-col items-center group/item hover:bg-rose-100 transition-colors">
                     <span className="text-[9px] font-black text-rose-600/50 uppercase">TIDAK VISITE</span>
                     <span className="text-xl font-black text-rose-600">{overallNotCompliant}</span>
                     <span className="text-[10px] font-black text-rose-600 mt-1">{overallTotal > 0 ? Math.round((overallNotCompliant/overallTotal)*100) : 0}%</span>
                  </div>
               </div>
            </div>

            {/* Per SMF Bar Chart */}
            <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col">
               <div className="flex justify-between items-center mb-8">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Analisis Kepatuhan per SMF</h4>
                  <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase">Visited</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-slate-200 rounded-full"></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase">Not Visited</span>
                     </div>
                  </div>
               </div>
               <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={smfChartData} layout="vertical" margin={{ left: 80, right: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.05} />
                        <XAxis type="number" hide />
                        <YAxis 
                           dataKey="name" 
                           type="category" 
                           axisLine={false} 
                           tickLine={false} 
                           tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                           width={80}
                        />
                        <Tooltip 
                           cursor={{ fill: '#f8fafc' }}
                           contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                           formatter={(val, name, props) => {
                             if (name === 'visited') return [`${val} (${props.payload.percentage}%)`, 'Visite'];
                             return [val, 'Tidak Visite'];
                           }}
                        />
                        <Bar dataKey="visited" stackId="a" fill="#10b981" barSize={24} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="notVisited" stackId="a" fill="#f1f5f9" barSize={24} radius={[0, 10, 10, 0]} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
               <div className="mt-4 flex flex-wrap gap-2">
                  {smfChartData.map((item, idx) => (
                     <div key={idx} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase">{item.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">({item.visited}/{item.total})</span>
                        <span className={`text-[10px] font-black ${item.percentage >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>{item.percentage}%</span>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Work Table */}
         <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-10 relative">
            <div className="absolute top-6 right-6 no-print opacity-20">
               <Gauge size={100} />
            </div>
            
            <div className="text-center font-black uppercase space-y-1 mb-8">
               <div className="text-xs tracking-widest text-slate-400">LEMBAR KERJA</div>
               <h3 className="text-2xl md:text-3xl tracking-tighter">INDIKATOR MUTU UNIT KEPATUHAN VISITE</h3>
            </div>

            <div className="flex flex-col md:flex-row justify-between border-b border-slate-100 pb-8 mb-8 gap-6 md:gap-0">
               <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UNIT / RUANGAN</div>
                  <div className="text-lg font-black text-indigo-600 uppercase tracking-tighter">{selectedUnit}</div>
               </div>
               <div className="space-y-2 md:text-right">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PERIODE LAPORAN</div>
                  <div className="text-lg font-black text-slate-700 uppercase tracking-tighter">
                    {new Date(dateRange.start).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {new Date(dateRange.end).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
               </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border-2 border-[#84c44c]">
               <table className="w-full text-[10px] text-left border-collapse">
                  <thead className="bg-[#84c44c] text-white font-black uppercase text-center">
                     <tr className="divide-x divide-white/10">
                       <th className="p-4 border border-emerald-700/20 w-12">NO</th>
                       <th className="p-4 border border-emerald-700/20 w-32">HARI TANGGAL</th>
                       <th className="p-4 border border-emerald-700/20">DOKTER</th>
                       <th className="p-4 border border-emerald-700/20 w-28">JAM VISITE</th>
                       <th className="p-4 border border-emerald-700/20 w-24 bg-black/5">JML PASIEN</th>
                       <th className="p-4 border border-emerald-700/20 w-24 bg-emerald-600/30">VISITE</th>
                       <th className="p-4 border border-emerald-700/20 w-24 bg-rose-600/30 text-rose-50">TIDAK VISITE</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {flatRows.length > 0 ? flatRows.map((row, i) => (
                       <tr key={i} className="hover:bg-emerald-50/50 transition-colors divide-x divide-slate-100 text-center">
                         <td className="p-4 font-bold text-slate-300">{i + 1}</td>
                         <td className="p-4 font-black text-slate-600 bg-slate-50/30">
                           {row.showDate ? new Date(row.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: '2-digit' }) : ''}
                         </td>
                         <td className="p-4 text-left font-black text-slate-700 pl-8 uppercase tracking-tighter">{row.doctor}</td>
                         <td className="p-4 text-slate-500 font-bold">{row.time}</td>
                         <td className="p-4 font-black text-slate-600 bg-slate-50/30">{row.total}</td>
                         <td className="p-4 font-black text-emerald-600 bg-emerald-50/40 text-sm">{row.visited}</td>
                         <td className="p-4 font-black text-rose-600 bg-rose-50/40 text-sm">{row.notVisited}</td>
                       </tr>
                     )) : (
                       <tr>
                         <td colSpan={7} className="p-32 text-center text-slate-300 italic font-medium uppercase tracking-[0.2em] bg-slate-50/50">Belum ada data kunjungan yang tercatat.</td>
                       </tr>
                     )}
                  </tbody>
                  {flatRows.length > 0 && (
                    <tfoot className="bg-slate-800 text-white font-black uppercase text-center">
                       <tr className="divide-x divide-white/10">
                         <td colSpan={4} className="p-5 text-right pr-10 tracking-widest text-slate-400">TOTAL KESELURUHAN</td>
                         <td className="p-5">{flatRows.reduce((a, b) => a + b.total, 0)}</td>
                         <td className="p-5 text-emerald-400">{flatRows.reduce((a, b) => a + b.visited, 0)}</td>
                         <td className="p-5 text-rose-400">{flatRows.reduce((a, b) => a + b.notVisited, 0)}</td>
                       </tr>
                    </tfoot>
                  )}
               </table>
            </div>

            <div className="flex justify-between items-center no-print">
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                     <div className="w-4 h-4 bg-emerald-500 rounded-md"></div>
                     <span className="text-[10px] font-black uppercase text-slate-400">Visited</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-4 h-4 bg-rose-500 rounded-md"></div>
                     <span className="text-[10px] font-black uppercase text-slate-400">Not Visited</span>
                  </div>
               </div>
               <button 
                 onClick={() => window.print()}
                 className="bg-emerald-500 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-emerald-200 transition-all active:scale-95 flex items-center gap-3"
               >
                 Export & Cetak Laporan <TrendingUp size={16}/>
               </button>
            </div>
         </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-20">
       <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden no-print">
          <div className="relative z-10">
             <h2 className="text-4xl font-black tracking-tighter mb-4 flex items-center gap-4">
                <TrendingUp size={44} className="text-blue-500"/> Pusat Pelaporan Mutu (PIC)
             </h2>
             <p className="text-slate-400 max-w-2xl font-medium text-xs">Laporan analitik mendalam untuk monitoring kualitas pelayanan bedah secara real-time. Data diperbarui otomatis dari input pelayanan harian.</p>
          </div>
          <div className="absolute -bottom-10 -right-10 opacity-10">
             <Gauge size={300}/>
          </div>
       </div>

       {/* Global Filters Section */}
       <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Filter Ruangan/Unit</label>
            <select 
              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              disabled={!!(currentUser?.unit && currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'BIDANG' && currentUser?.role !== 'PIC')}
            >
              <option>Semua Unit</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rentang Tanggal Laporan</label>
            <div className="flex items-center gap-3">
              <input 
                type="date"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
              <span className="text-slate-300 font-bold">s/d</span>
              <input 
                type="date"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>
          </div>
       </div>

       {type === 'DIAGNOSIS' && renderDiagnosisReport()}
       {type === 'DEPENDENCY' && renderDependencyReport()}
       {(type === 'ATTENDANCE' || type === 'DPJP_ABSENSI') && renderAttendanceReport()}
       {type === 'PATHWAY' && renderPathwayReport()}
       {type === 'VISITE_COMPLIANCE' && renderVisiteComplianceReport()}
    </div>
  );
};
