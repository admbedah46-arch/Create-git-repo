
import React, { useState } from 'react';
import { Search, Download, Filter, Calendar, Stethoscope, ChevronDown, PieChart as PieChartIcon } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { MasterData, DoctorVisitRecord, User as AppUser, Patient } from '../../types';
import { Button } from '../Button';

interface DoctorVisitAdminProps {
  doctorVisits: DoctorVisitRecord[];
  patients: Patient[];
  masterData: MasterData;
  currentUser: AppUser | null;
}

export const DoctorVisitAdmin: React.FC<DoctorVisitAdminProps> = ({ doctorVisits, patients, masterData, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSMF, setSelectedSMF] = useState('Semua SMF');
  const [selectedPayment, setSelectedPayment] = useState('Semua Cara Bayar');
  const [selectedUnit, setSelectedUnit] = useState(() => {
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
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const filteredVisits = doctorVisits.filter(v => {
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/ruang\s+/g, '').replace(/r\.\s+/g, '').trim();
    const statuses = v.attendanceStatuses || [v.attendanceStatus];
    const isVisite = statuses.includes('HADIR') || statuses.includes('ASISTEN');
    
    const matchesSearch = v.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (v.patientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (v.noRM || '').includes(searchTerm);
    const matchesSMF = selectedSMF === 'Semua SMF' || v.smf === selectedSMF;
    const matchesPayment = selectedPayment === 'Semua Cara Bayar' || v.paymentMethod.includes(selectedPayment);
    const matchesUnit = selectedUnit === 'Semua Unit' || 
                        normalize(v.unit) === normalize(selectedUnit) ||
                        (v.patientId && patients.find(p => p.id === v.patientId && (normalize(p.unitTujuan) === normalize(selectedUnit) || normalize(p.ruangan) === normalize(selectedUnit))));
    const matchesDate = v.date >= dateRange.start && v.date <= dateRange.end;
    
    return isVisite && matchesSearch && matchesSMF && matchesPayment && matchesUnit && matchesDate;
  });

  // Unique values for filters
  const smfList = Array.from(new Set(doctorVisits.map(v => v.smf))).filter(Boolean);
  const units = React.useMemo(() => {
    const isFullAccess = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || currentUser?.role === 'PIC';
    if (currentUser?.unit && !isFullAccess) {
       return [currentUser.unit];
    }
    const visitsUnits = Array.from(new Set(doctorVisits.map(v => v.unit))).filter(Boolean);
    const masterUnits = masterData.units || [];
    return Array.from(new Set([...visitsUnits, ...masterUnits])).sort();
  }, [doctorVisits, masterData.units, currentUser]);

  const smfsToDisplay = selectedSMF === 'Semua SMF' ? smfList : [selectedSMF];

  // Summary Logic for the Consolidated Table (Gambar 2)
  const consolidatedStats = smfsToDisplay.map(smf => {
    const smfVisits = filteredVisits.filter(v => v.smf === smf);
    const doctors = Array.from(new Set(smfVisits.map(v => v.doctorName)));
    
    const doctorStats = doctors.map(docName => {
      const docVisits = smfVisits.filter(v => v.doctorName === docName);
      
      return {
        name: docName,
        // Pasien DPJP Utama: Unique patients where role is DPJP_UTAMA
        pasienDPJP: new Set(docVisits.filter(v => v.visitRole === 'DPJP_UTAMA').map(v => v.patientId)).size,
        // Visite DPJP + Raberan: All visits where role is DPJP_UTAMA or DPJP_KONSULEN
        visiteDPJP: docVisits.filter(v => v.visitRole === 'DPJP_UTAMA' || v.visitRole === 'DPJP_KONSULEN').length,
        // Pasien Konsulan: Unique patients where role is KONSULEN
        pasienKonsul: new Set(docVisits.filter(v => v.visitRole === 'KONSULEN' || v.visitRole === 'DPJP_KONSULEN').map(v => v.patientId)).size,
        // Visite Konsulan: All visits where role is KONSULEN or DPJP_KONSULEN
        visiteKonsul: docVisits.filter(v => v.visitRole === 'KONSULEN' || v.visitRole === 'DPJP_KONSULEN').length,
      };
    }).sort((a, b) => b.visiteDPJP - a.visiteDPJP);

    return {
      smfName: smf,
      doctors: doctorStats,
      totals: {
        pasienDPJP: doctorStats.reduce((sum, d) => sum + d.pasienDPJP, 0),
        visiteDPJP: doctorStats.reduce((sum, d) => sum + d.visiteDPJP, 0),
        pasienKonsul: doctorStats.reduce((sum, d) => sum + d.pasienKonsul, 0),
        visiteKonsul: doctorStats.reduce((sum, d) => sum + d.visiteKonsul, 0),
      }
    };
  }).filter(s => s.doctors.length > 0);

  const paymentSummary = (masterData.refs?.caraBayar || []).map(pm => ({
    name: pm,
    count: filteredVisits.filter(v => v.paymentMethod.includes(pm)).length
  })).filter(p => p.count > 0).sort((a,b) => b.count - a.count);

  // Assistant Summary
  const assistantCounts: Record<string, number> = {};
  filteredVisits.forEach(v => {
    if (v.assistantName && (v.attendanceStatuses || [v.attendanceStatus]).includes('ASISTEN')) {
      assistantCounts[v.assistantName] = (assistantCounts[v.assistantName] || 0) + 1;
    }
  });
  const assistantSummary = Object.entries(assistantCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a,b) => b.count - a.count);

  return (
    <div className="space-y-8 animate-fade-in text-slate-800">
      <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-black flex items-center gap-4 tracking-tighter">
              <Stethoscope size={36} className="text-indigo-600" /> LAPORAN KERJA VISITE
            </h2>
            <p className="text-slate-400 font-medium mt-1 uppercase text-[10px] tracking-widest">Admin Finance & Audit Dashboard</p>
          </div>
          <Button onClick={() => window.print()} className="bg-slate-900 border-none shadow-xl shadow-slate-100 px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2">
            <Download size={16}/> Export Excel / PDF
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-indigo-50 p-8 rounded-[2rem] border border-indigo-100">
            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6">Rekapitulasi per SMF</h4>
            <div className="space-y-3">
              {consolidatedStats.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-white/60 p-3 rounded-xl border border-white">
                  <span className="text-[10px] font-black uppercase text-slate-600">{s.smfName}</span>
                  <div className="flex gap-4">
                    <div className="text-right">
                      <div className="text-[8px] font-bold text-slate-400 uppercase">Visite</div>
                      <div className="text-xs font-black text-indigo-600">{s.totals.visiteDPJP + s.totals.visiteKonsul}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-emerald-50 p-8 rounded-[2rem] border border-emerald-100/50">
            <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-6">Rekapitulasi Asisten (DU)</h4>
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
              {assistantSummary.length > 0 ? assistantSummary.map((a, i) => (
                <div key={i} className="flex items-center justify-between bg-white/60 p-3 rounded-xl border border-white">
                   <div className="flex items-center gap-2">
                     <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black">
                       {i + 1}
                     </div>
                     <span className="text-[9px] font-black uppercase text-slate-600 truncate max-w-[120px]">{a.name}</span>
                   </div>
                   <div className="text-right">
                     <span className="text-xs font-black text-emerald-600">{a.count} <span className="text-[8px] opacity-50">Visit</span></span>
                   </div>
                </div>
              )) : (
                <div className="text-center py-8 text-[10px] font-bold text-slate-400 italic">Belum ada kunjungan asisten</div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Rekapitulasi Cara Bayar</h4>
            <div className="grid grid-cols-2 gap-3">
              {paymentSummary.map((p, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                   <span className="text-[9px] font-black uppercase text-slate-400 tracking-tight">{p.name}</span>
                   <div className="text-2xl font-black text-slate-800 mt-2">{p.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Consolidated Table (Gambar 2 Format) */}
        <div className="bg-white rounded-[2rem] border-2 border-orange-400/30 overflow-hidden shadow-lg shadow-orange-50">
           <div className="bg-orange-500 p-6 text-white text-center font-black">
              <div className="text-xs uppercase tracking-widest opacity-80">LAPORAN REKAP VISITE DOKTER</div>
              <div className="text-sm md:text-base uppercase tracking-tighter mt-1">
                {selectedPayment} - {selectedSMF} ({dateRange.start} s/d {dateRange.end})
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse text-left">
                 <thead className="bg-orange-100/50 text-orange-900 font-black uppercase text-center border-b border-orange-200">
                    <tr>
                       <th rowSpan={2} className="p-3 border-r border-orange-200 w-10">NO</th>
                       <th rowSpan={2} className="p-3 border-r border-orange-200 min-w-[200px]">NAMA DOKTER</th>
                       <th colSpan={2} className="p-3 border-r border-orange-200 bg-orange-200/40">DPJP UTAMA</th>
                       <th colSpan={2} className="p-3 border-r border-orange-200 bg-indigo-200/40 text-indigo-900">KONSULER</th>
                       <th rowSpan={2} className="p-3">KETERANGAN</th>
                    </tr>
                    <tr className="border-t border-orange-200">
                       <th className="p-2 border-r border-orange-200 bg-orange-50 w-24">JML PASIEN</th>
                       <th className="p-2 border-r border-orange-200 bg-orange-50 w-24">JML VISITE*</th>
                       <th className="p-2 border-r border-orange-200 bg-indigo-50 text-indigo-800 w-24">JML PASIEN</th>
                       <th className="p-2 border-r border-orange-200 bg-indigo-50 text-indigo-800 w-24">JML VISITE</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-orange-100">
                    {consolidatedStats.map((smf, smfIdx) => (
                      <React.Fragment key={smfIdx}>
                        {/* SMF Header Row */}
                        <tr className="bg-orange-50 font-black text-slate-600">
                           <td colSpan={7} className="p-3 pl-6 uppercase tracking-widest text-[9px]">
                             SMF {smf.smfName}
                           </td>
                        </tr>
                        {smf.doctors.map((doc, docIdx) => (
                          <tr key={docIdx} className="hover:bg-slate-50 transition-colors">
                             <td className="p-3 text-center border-r border-slate-100 font-bold text-slate-400">{docIdx + 1}</td>
                             <td className="p-3 border-r border-slate-100 font-black text-slate-800 uppercase pl-6">{doc.name}</td>
                             <td className="p-3 text-center border-r border-slate-100 font-black text-orange-600 bg-orange-50/20">{doc.pasienDPJP}</td>
                             <td className="p-3 text-center border-r border-slate-100 font-black text-orange-700 bg-orange-50/40">{doc.visiteDPJP}</td>
                             <td className="p-3 text-center border-r border-slate-100 font-black text-indigo-600 bg-indigo-50/20">{doc.pasienKonsul}</td>
                             <td className="p-3 text-center border-r border-slate-100 font-black text-indigo-700 bg-indigo-50/40">{doc.visiteKonsul}</td>
                             <td className="p-3 text-[8px] font-medium text-slate-400 italic">Terverifikasi sistem</td>
                          </tr>
                        ))}
                        {/* SMF Subtotal Row */}
                        <tr className="bg-orange-100/30 font-black text-slate-800 border-t-2 border-orange-200">
                           <td colSpan={2} className="p-3 text-right uppercase tracking-tighter text-[9px] pr-8">Sub Total {smf.smfName}</td>
                           <td className="p-3 text-center bg-orange-100/50">{smf.totals.pasienDPJP}</td>
                           <td className="p-3 text-center bg-orange-200/50">{smf.totals.visiteDPJP}</td>
                           <td className="p-3 text-center bg-indigo-100/50">{smf.totals.pasienKonsul}</td>
                           <td className="p-3 text-center bg-indigo-200/50">{smf.totals.visiteKonsul}</td>
                           <td className="p-3"></td>
                        </tr>
                      </React.Fragment>
                    ))}
                    {consolidatedStats.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-20 text-center text-slate-400 font-black italic uppercase tracking-widest">
                          Belum ada data untuk periode terpilih
                        </td>
                      </tr>
                    )}
                 </tbody>
                 {consolidatedStats.length > 0 && (
                   <tfoot className="bg-slate-800 text-white font-black uppercase">
                      <tr>
                        <td colSpan={2} className="p-4 pl-10 text-xs tracking-tighter">TOTAL KESELURUHAN</td>
                        <td className="p-4 text-center text-xs">{consolidatedStats.reduce((sum, s) => sum + s.totals.pasienDPJP, 0)}</td>
                        <td className="p-4 text-center text-xs">{consolidatedStats.reduce((sum, s) => sum + s.totals.visiteDPJP, 0)}</td>
                        <td className="p-4 text-center text-xs">{consolidatedStats.reduce((sum, s) => sum + s.totals.pasienKonsul, 0)}</td>
                        <td className="p-4 text-center text-xs">{consolidatedStats.reduce((sum, s) => sum + s.totals.visiteKonsul, 0)}</td>
                        <td className="p-4"></td>
                      </tr>
                   </tfoot>
                 )}
              </table>
           </div>
           <div className="p-4 bg-slate-50 text-[8px] font-bold text-slate-400 italic">
              * Visite DPJP Utama termasuk Visite Raberan/Bersama | Laporan digenerate otomatis berdasarkan entry perawat.
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cari Pasien/Dokter</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Nama / No. RM..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">SMF / KSM</label>
            <select 
              className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedSMF}
              onChange={(e) => setSelectedSMF(e.target.value)}
            >
              <option>Semua SMF</option>
              {smfList.map(smf => <option key={smf} value={smf}>{smf}</option>)}
            </select>
          </div>

          <div className="space-y-2 text-[10px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Ruangan/Unit</label>
            <select 
              className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              disabled={!!(currentUser?.unit && currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'BIDANG' && currentUser?.role !== 'PIC')}
            >
              <option>Semua Unit</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rentang Tanggal</label>
            <div className="flex items-center gap-1">
              <input 
                type="date"
                className="w-full px-3 py-3 bg-white border border-slate-200 rounded-2xl text-[9px] font-bold outline-none"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
              <span className="text-slate-300">-</span>
              <input 
                type="date"
                className="w-full px-3 py-3 bg-white border border-slate-200 rounded-2xl text-[9px] font-bold outline-none"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cara Bayar</label>
            <select 
              className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
            >
              <option>Semua Cara Bayar</option>
              {(masterData.refs?.caraBayar || []).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b">
              <tr>
                <th className="p-6">Waktu Input</th>
                <th className="p-6">Pasien / RM</th>
                <th className="p-6">Dokter / SMF</th>
                <th className="p-6 text-center">Status</th>
                <th className="p-6 text-center">Peran Visite</th>
                <th className="p-6">Cara Bayar</th>
                <th className="p-6">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisits.length > 0 ? filteredVisits.map((v, i) => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-6 text-[10px] font-bold text-slate-500">
                    <div>{v.date}</div>
                    <div className="text-[8px] opacity-60 uppercase">{new Date(v.recordedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </td>
                  <td className="p-6">
                    <div className="font-black text-xs uppercase tracking-tighter text-slate-800">{v.patientName}</div>
                    <div className="text-[10px] font-bold text-indigo-500">RM: {v.noRM}</div>
                  </td>
                  <td className="p-6">
                    <div className="font-black text-xs uppercase text-slate-700">{v.doctorName}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{v.smf}</div>
                    {v.assistantName && (
                      <div className="mt-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block uppercase">Asisten: {v.assistantName}</div>
                    )}
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex flex-wrap gap-1 justify-center max-w-[150px] mx-auto">
                      {(v.attendanceStatuses || [v.attendanceStatus]).map(status => {
                        const colors: Record<string, string> = {
                          'HADIR': 'bg-emerald-500 text-white',
                          'TIDAK_HADIR': 'bg-rose-500 text-white',
                          'IZIN': 'bg-amber-500 text-white',
                          'CUTI': 'bg-slate-500 text-white',
                          'ASISTEN': 'bg-indigo-600 text-white'
                        };
                        return (
                          <span key={status} className={`px-2 py-1 rounded-lg font-black text-[8px] uppercase tracking-tighter ${colors[status] || 'bg-slate-200 text-slate-600'}`}>
                            {status === 'TIDAK_HADIR' ? 'ABSEN' : status}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-tight">
                      {v.visitRole.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-wrap gap-1">
                      {(v.paymentMethod || '').split(', ').map(pm => (
                        <span key={pm} className="text-[10px] font-bold text-slate-500 italic pr-2 border-r last:border-0">{pm}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="text-[10px] font-black text-slate-400 uppercase">{v.recordedBy}</div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-slate-400 font-bold italic">
                    Belum ada data visite yang sesuai dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-between items-center pt-4">
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
             Total Records: {filteredVisits.length}
           </div>
           <div className="flex gap-2">
             <Button variant="secondary" className="px-6 py-2 rounded-xl text-[10px] font-black uppercase">Prev</Button>
             <Button variant="secondary" className="px-6 py-2 rounded-xl text-[10px] font-black uppercase">Next</Button>
           </div>
        </div>
      </div>
    </div>
  );
};
