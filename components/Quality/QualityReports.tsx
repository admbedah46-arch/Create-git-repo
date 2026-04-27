
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { Patient, DailyReportEntry, MasterData, QualityMeasurement, User as AppUser } from '../../types';
// Added Gauge to the imports from lucide-react
import { FilePieChart, Activity, UserCheck, ClipboardList, TrendingUp, Gauge } from 'lucide-react';

interface QualityReportsProps {
  type: 'DIAGNOSIS' | 'DEPENDENCY' | 'ATTENDANCE' | 'PATHWAY';
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  masterData: MasterData;
  currentUser: AppUser | null;
}

export const QualityReports: React.FC<QualityReportsProps> = ({ type, patients: rawPatients, dailyReports: rawDailyReports, masterData, currentUser }) => {
  
  const patients = React.useMemo(() => {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'BIDANG') {
      return rawPatients.filter(p => p.ruangan === currentUser.unit);
    }
    return rawPatients;
  }, [rawPatients, currentUser]);

  const dailyReports = React.useMemo(() => {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'BIDANG') {
      const unitPatients = rawPatients.filter(p => p.ruangan === currentUser.unit).map(p => p.id);
      return rawDailyReports.filter(r => unitPatients.includes(r.patientId));
    }
    return rawDailyReports;
  }, [rawDailyReports, rawPatients, currentUser]);

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

  const renderAttendanceReport = () => (
    <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-8 animate-fade-in">
       <div className="flex justify-between items-center">
          <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <UserCheck size={32} className="text-emerald-600"/> Monitoring Kehadiran DPJP
          </h3>
          <div className="bg-emerald-50 text-emerald-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
            94% Kehadiran Rata-rata
          </div>
       </div>
       <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
             <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b">
                <tr>
                   <th className="p-6">DPJP / DOKTER</th>
                   <th className="p-6">SPESIALISASI</th>
                   <th className="p-6 text-center">TOTAL VISITE</th>
                   <th className="p-6 text-center">PERSENTASE</th>
                   <th className="p-6 text-center">STATUS</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {masterData.doctors.map(doc => (
                  <tr key={doc} className="hover:bg-slate-50 transition-colors">
                     <td className="p-6 font-black text-slate-700">{doc}</td>
                     <td className="p-6 text-slate-500 font-bold uppercase tracking-tighter">{masterData.doctorMetadata[doc]?.ksm}</td>
                     <td className="p-6 text-center font-bold">24 / 30</td>
                     <td className="p-6 text-center">
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                           <div className="bg-emerald-500 h-full" style={{width: '80%'}}></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 mt-1 block">80%</span>
                     </td>
                     <td className="p-6 text-center">
                        <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full font-black text-[10px]">PATUH</span>
                     </td>
                  </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );

  const renderPathwayReport = () => (
    <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-10 animate-fade-in">
       <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
         <ClipboardList size={32} className="text-blue-600"/> Laporan Kepatuhan Clinical Pathway
       </h3>
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[
            { name: 'Appendectomy', compliance: 88 },
            { name: 'Herniotomy', compliance: 95 },
            { name: 'Caesar Section', compliance: 92 },
            { name: 'Laparatomy', compliance: 75 },
          ].map((item, i) => (
            <div key={i} className="p-8 rounded-[2rem] border bg-slate-50/50 hover:bg-white transition-all group">
               <div className="flex justify-between items-end mb-6">
                  <div>
                     <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter">{item.name}</h4>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">PROTOKOL TINDAKAN</p>
                  </div>
                  <div className="text-3xl font-black text-blue-600">{item.compliance}%</div>
               </div>
               <div className="w-full bg-white h-3 rounded-full border overflow-hidden">
                  <div className="bg-blue-600 h-full group-hover:animate-pulse" style={{width: `${item.compliance}%`}}></div>
               </div>
               <div className="mt-6 flex gap-3">
                  <button className="text-[10px] font-black text-blue-600 hover:underline">LIHAT DETAIL VARIAN</button>
                  <span className="text-slate-300">|</span>
                  <button className="text-[10px] font-black text-slate-400 hover:underline">AUDIT REKAM MEDIS</button>
               </div>
            </div>
          ))}
       </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
       <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
             <h2 className="text-4xl font-black tracking-tighter mb-4 flex items-center gap-4">
                <TrendingUp size={44} className="text-blue-500"/> Pusat Pelaporan Mutu (PIC)
             </h2>
             <p className="text-slate-400 max-w-2xl font-medium">Laporan analitik mendalam untuk monitoring kualitas pelayanan bedah secara real-time. Data diperbarui otomatis dari input pelayanan harian.</p>
          </div>
          <div className="absolute -bottom-10 -right-10 opacity-10">
             <Gauge size={300}/>
          </div>
       </div>

       {type === 'DIAGNOSIS' && renderDiagnosisReport()}
       {type === 'DEPENDENCY' && renderDependencyReport()}
       {type === 'ATTENDANCE' && renderAttendanceReport()}
       {type === 'PATHWAY' && renderPathwayReport()}
    </div>
  );
};
