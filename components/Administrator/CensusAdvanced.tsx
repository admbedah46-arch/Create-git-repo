import React, { useState, useMemo } from 'react';
import { Download, FileBarChart, PieChart, Users, Bed } from 'lucide-react';
import { AppData, Patient } from '../../types';

interface CensusAdvancedProps {
  appData: AppData;
  currentUser: any;
}

export const CensusAdvanced: React.FC<CensusAdvancedProps> = ({ appData, currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedUnit, setSelectedUnit] = useState(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' ? 'Ruang Bedah' : (currentUser?.unit || 'Ruang Bedah'));

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const censusData = useMemo(() => {
    const results: any[] = [];
    const patients = appData.patients || [];
    
    let previousDaySisaSummary = { L: 0, P: 0, classes: {} as Record<string, number> };
    
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
    
    // Initial estimation for Day 1
    const patientsAlreadyIn = patients.filter(p => {
      const isBefore = p.entryDate < startOfMonthStr;
      const isStillIn = !p.dischargeDate || p.dischargeDate >= startOfMonthStr;
      return isBefore && isStillIn && p.unitTujuan === selectedUnit;
    });

    previousDaySisaSummary.L = patientsAlreadyIn.filter(p => p.gender === 'L').length;
    previousDaySisaSummary.P = patientsAlreadyIn.filter(p => p.gender === 'P').length;
    
    patientsAlreadyIn.forEach(p => {
      const cls = p.kelasRawat || 'Non Kelas';
      previousDaySisaSummary.classes[cls] = (previousDaySisaSummary.classes[cls] || 0) + 1;
    });

    daysArray.forEach(day => {
      const currentDate = new Date(selectedYear, selectedMonth, day).toISOString().split('T')[0];
      const dayPatients = patients.filter(p => p.unitTujuan === selectedUnit);
      
      const isNewArrival = (origin: string) => {
        if (!origin) return true;
        const o = origin.toLowerCase();
        return o === 'igd' || o === 'igd ponek' || o.startsWith('p.') || o.includes('poliklinik');
      };

      // 1. Masuk Baru
      const masukBaru = dayPatients.filter(p => p.entryDate === currentDate && isNewArrival(p.origin));
      const masukBaruL = masukBaru.filter(p => p.gender === 'L').length;
      const masukBaruP = masukBaru.filter(p => p.gender === 'P').length;

      // 2. Pindahan (Masuk)
      const pindahanMasuk = dayPatients.filter(p => p.entryDate === currentDate && !isNewArrival(p.origin));
      const pindahanMasukL = pindahanMasuk.filter(p => p.gender === 'L').length;
      const pindahanMasukP = pindahanMasuk.filter(p => p.gender === 'P').length;

      // 3. Keluar Hidup
      const keluarHidup = dayPatients.filter(p => p.dischargeDate === currentDate && p.statusDataPasien === 'Sudah Pulang');
      const keluarHidupL = keluarHidup.filter(p => p.gender === 'L').length;
      const keluarHidupP = keluarHidup.filter(p => p.gender === 'P').length;

      // 4. Pindah Ruang (Keluar)
      const pindahKeluar = dayPatients.filter(p => p.dischargeDate === currentDate && p.statusDataPasien === 'Pindah Ruangan');
      const pindahKeluarL = pindahKeluar.filter(p => p.gender === 'L').length;
      const pindahKeluarP = pindahKeluar.filter(p => p.gender === 'P').length;

      // 5. Mati
      const mati = dayPatients.filter(p => p.dischargeDate === currentDate && p.statusDataPasien === 'Meninggal');
      const matiLess48L = mati.filter(p => p.deathTime === '<48h' && p.gender === 'L').length;
      const matiLess48P = mati.filter(p => p.deathTime === '<48h' && p.gender === 'P').length;
      const matiMore48L = mati.filter(p => p.deathTime === '>=48h' && p.gender === 'L').length;
      const matiMore48P = mati.filter(p => p.deathTime === '>=48h' && p.gender === 'P').length;

      // 6. Total Dirawat
      const totalRawatL = previousDaySisaSummary.L + masukBaruL + pindahanMasukL;
      const totalRawatP = previousDaySisaSummary.P + masukBaruP + pindahanMasukP;

      // 7. Sisa Pasien
      const sisaL = totalRawatL - keluarHidupL - pindahKeluarL - (matiLess48L + matiMore48L);
      const sisaP = totalRawatP - keluarHidupP - pindahKeluarP - (matiLess48P + matiMore48P);

      // Class breakdown for Sisa
      const daySisaClasses: Record<string, number> = {};
      const patientsLeaving = [...keluarHidup, ...mati, ...pindahKeluar];
      
      // We start with yesterday's counts
      Object.assign(daySisaClasses, previousDaySisaSummary.classes);
      
      // Add arriving patients' classes
      [...masukBaru, ...pindahanMasuk].forEach(p => {
        const c = p.kelasRawat || 'Non Kelas';
        daySisaClasses[c] = (daySisaClasses[c] || 0) + 1;
      });
      
      // Subtract leaving patients' classes
      patientsLeaving.forEach(p => {
        const c = p.kelasRawat || 'Non Kelas';
        daySisaClasses[c] = Math.max(0, (daySisaClasses[c] || 0) - 1);
      });

      // Lama Dirawat (for ALOS)
      const lamaDirawatTotal = [...keluarHidup, ...mati, ...pindahKeluar].reduce((sum, p) => {
        const start = new Date(p.entryDate);
        const end = new Date(p.dischargeDate!);
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
        return sum + diff;
      }, 0);

      results.push({
        tanggal: day,
        awal: { L: previousDaySisaSummary.L, P: previousDaySisaSummary.P },
        masuk: { L: masukBaruL, P: masukBaruP },
        pindahan: { L: pindahanMasukL, P: pindahanMasukP },
        total: { L: totalRawatL, P: totalRawatP },
        pindahKeluar: { L: pindahKeluarL, P: pindahKeluarP },
        keluarHidup: { L: keluarHidupL, P: keluarHidupP },
        mati: { less48: matiLess48L + matiLess48P, more48: matiMore48L + matiMore48P },
        sisa: { L: sisaL, P: sisaP },
        lamaDirawat: lamaDirawatTotal,
        sisaClasses: daySisaClasses
      });

      previousDaySisaSummary = { L: sisaL, P: sisaP, classes: daySisaClasses };
    });

    return results;
  }, [selectedMonth, selectedYear, selectedUnit, appData.patients, appData.masterData, daysArray]);

  // Totals for the whole month
  const monthTotals = useMemo(() => {
    const totalMasuk = censusData.reduce((acc, row) => acc + row.masuk.L + row.masuk.P + row.pindahan.L + row.pindahan.P, 0);
    const totalKeluar = censusData.reduce((acc, row) => acc + row.keluarHidup.L + row.keluarHidup.P + row.pindahKeluar.L + row.pindahKeluar.P + row.mati.less48 + row.mati.more48, 0);
    const totalHRP = censusData.reduce((acc, row) => acc + row.sisa.L + row.sisa.P, 0);
    const totalLD = censusData.reduce((acc, row) => acc + row.lamaDirawat, 0);
    const totalMati = censusData.reduce((acc, row) => acc + row.mati.less48 + row.mati.more48, 0);
    const totalMatiOver48 = censusData.reduce((acc, row) => acc + row.mati.more48, 0);
    
    // Attempt to calculate TT for this specific unit
    let tt = 0;
    const roomToBeds = appData.masterData.roomToBeds || {};
    Object.keys(roomToBeds).forEach(roomName => {
      const u = selectedUnit.toLowerCase();
      const r = roomName.toLowerCase();
      // Heuristic matching based on naming conventions in master data
      if (
        (u.includes('bedah') && r.includes('bedah')) ||
        (u.includes('syaraf') && r.includes('syaraf')) ||
        (u.includes('interna') && r.includes('interna')) ||
        (u.includes('anak') && r.includes('anak')) ||
        (u.includes('rinjani') && r.includes('rinjani')) ||
        (u.includes('icu') && r === 'icu') ||
        (u.includes('iccu') && r === 'iccu') ||
        (u.includes('ibs') && r === 'ibs') ||
        (u.includes('dane rahil') && r.startsWith('dr ')) ||
        (u.includes('intermediet') && r.includes('intermediate'))
      ) {
        tt += (roomToBeds[roomName] as string[]).length;
      }
    });
    
    // Fallback if no rooms matched unit name
    if (tt === 0) tt = 30; 

    const bor = (tt > 0 && daysInMonth > 0) ? (totalHRP / (tt * daysInMonth)) * 100 : 0;
    const alos = (totalKeluar > 0) ? totalLD / totalKeluar : 0;
    const bto = (tt > 0) ? totalKeluar / tt : 0;
    const toi = (totalKeluar > 0 && tt > 0) ? (tt * daysInMonth - totalHRP) / totalKeluar : 0;
    const ndr = (totalKeluar > 0) ? (totalMatiOver48 / totalKeluar) * 1000 : 0;
    const gdr = (totalKeluar > 0) ? (totalMati / totalKeluar) * 1000 : 0;

    return { bor, alos, bto, toi, ndr, gdr, totalLD, totalHRP, totalKeluar, tt };
  }, [censusData, appData.masterData, daysInMonth, selectedUnit]);

  return (
    <div className="space-y-6 animate-fade-in pb-20 overflow-x-auto">
      <div className="bg-white rounded-[2.5rem] p-4 border shadow-sm min-w-[1600px] overflow-hidden">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 px-4 mt-4">
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
               <FileBarChart className="text-blue-600" size={24}/> Rekapitulasi Sensus Harian Pasien
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">
              Laporan Kinerja Unit {selectedUnit} • {months[selectedMonth]} {selectedYear}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex bg-slate-50 p-1.5 rounded-2xl border">
               <select 
                 value={selectedUnit} 
                 onChange={e => setSelectedUnit(e.target.value)}
                 className="bg-white border-0 text-[10px] font-black text-slate-600 rounded-xl px-4 py-2 focus:ring-0 outline-none cursor-pointer"
               >
                 {appData.masterData.units.map(u => <option key={u} value={u}>{u}</option>)}
               </select>
             </div>

            <div className="flex bg-slate-50 p-1.5 rounded-2xl border">
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="bg-white border-0 text-[10px] font-black text-slate-600 rounded-xl px-4 py-2 focus:ring-0 outline-none cursor-pointer"
              >
                {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select 
                value={selectedYear} 
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-white border-0 text-[10px] font-black text-slate-600 rounded-xl px-4 py-2 focus:ring-0 outline-none cursor-pointer ml-2"
              >
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            
            <button className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
              <Download size={14}/> Export XLSX
            </button>
          </div>
        </div>

        {/* The Big Table */}
        <div className="overflow-x-auto rounded-[2rem] border-2 border-slate-50">
          <table className="w-full text-[9px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase tracking-widest text-center">
                <th rowSpan={2} className="p-3 border border-slate-700 w-12">Tgl</th>
                <th colSpan={2} className="p-2 border border-slate-700 bg-slate-800">Pasien Awal</th>
                <th colSpan={2} className="p-2 border border-slate-700 bg-blue-900">Pasien Masuk</th>
                <th colSpan={2} className="p-2 border border-slate-700 bg-indigo-900">Ps Pindahan</th>
                <th colSpan={2} className="p-2 border border-slate-700 bg-slate-800">Total Rawat</th>
                <th colSpan={2} className="p-2 border border-slate-700 bg-orange-900">Pindah Ruang</th>
                <th colSpan={2} className="p-2 border border-slate-700 bg-emerald-900">Keluar Hidup</th>
                <th colSpan={2} className="p-2 border border-slate-700 bg-rose-900">Pasien Mati</th>
                <th rowSpan={2} className="p-2 border border-slate-700 bg-slate-800">LD</th>
                <th colSpan={2} className="p-2 border border-slate-700 bg-teal-900" style={{backgroundColor: '#115e59'}}>Sisa Pasien</th>
                <th colSpan={4} className="p-2 border border-slate-700" style={{backgroundColor: '#334155'}}>Perincian Sisa Per Kelas</th>
              </tr>
              <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[8px] text-center">
                <th className="p-1.5 border border-slate-200 w-8">L</th><th className="p-1.5 border border-slate-200 w-8">P</th>
                <th className="p-1.5 border border-slate-200 w-8 text-blue-600">L</th><th className="p-1.5 border border-slate-200 w-8 text-blue-600">P</th>
                <th className="p-1.5 border border-slate-200 w-8 text-indigo-600">L</th><th className="p-1.5 border border-slate-200 w-8 text-indigo-600">P</th>
                <th className="p-1.5 border border-slate-200 w-8">L</th><th className="p-1.5 border border-slate-200 w-8">P</th>
                <th className="p-1.5 border border-slate-200 w-8 text-orange-600">L</th><th className="p-1.5 border border-slate-200 w-8 text-orange-600">P</th>
                <th className="p-1.5 border border-slate-200 w-8 text-emerald-600">L</th><th className="p-1.5 border border-slate-200 w-8 text-emerald-600">P</th>
                <th className="p-1.5 border border-slate-200 w-8 text-rose-600">{"<48"}</th><th className="p-1.5 border border-slate-200 w-8 text-rose-600">{">=48"}</th>
                <th className="p-1.5 border border-slate-200 w-8">L</th><th className="p-1.5 border border-slate-200 w-8">P</th>
                <th className="p-1.5 border border-slate-200 w-12 text-slate-500">VIP/VVIP</th>
                <th className="p-1.5 border border-slate-200 w-12 text-slate-500">Klas I</th>
                <th className="p-1.5 border border-slate-200 w-12 text-slate-500">Klas II</th>
                <th className="p-1.5 border border-slate-200 w-12 text-slate-500">Klas III</th>
              </tr>
            </thead>
            <tbody className="font-bold text-slate-600 text-center">
              {censusData.map((row) => (
                <tr key={row.tanggal} className={`transition-colors ${row.tanggal % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-blue-50/50`}>
                  <td className="p-2 border border-slate-100 bg-slate-50 font-black text-slate-800">{row.tanggal}</td>
                  {/* Pasien Awal */}
                  <td className="p-1.5 border border-slate-100">{row.awal.L || '-'}</td>
                  <td className="p-1.5 border border-slate-100">{row.awal.P || '-'}</td>
                  {/* Masuk Baru */}
                  <td className="p-1.5 border border-slate-100 text-blue-600">{row.masuk.L || '-'}</td>
                  <td className="p-1.5 border border-slate-100 text-blue-600">{row.masuk.P || '-'}</td>
                  {/* Pindahan */}
                  <td className="p-1.5 border border-slate-100 text-indigo-600">{row.pindahan.L || '-'}</td>
                   <td className="p-1.5 border border-slate-100 text-indigo-600">{row.pindahan.P || '-'}</td>
                  {/* Total Rawat */}
                  <td className="p-1.5 border border-slate-100 bg-slate-50 font-black">{row.total.L || '-'}</td>
                  <td className="p-1.5 border border-slate-100 bg-slate-50 font-black">{row.total.P || '-'}</td>
                  {/* Pindah Keluar */}
                  <td className="p-1.5 border border-slate-100 text-orange-600">{row.pindahKeluar.L || '-'}</td>
                  <td className="p-1.5 border border-slate-100 text-orange-600">{row.pindahKeluar.P || '-'}</td>
                  {/* Keluar Hidup */}
                  <td className="p-1.5 border border-slate-100 text-emerald-600">{row.keluarHidup.L || '-'}</td>
                  <td className="p-1.5 border border-slate-100 text-emerald-600">{row.keluarHidup.P || '-'}</td>
                  {/* Mati */}
                  <td className="p-1.5 border border-slate-100 text-rose-600 font-black">{row.mati.less48 || '-'}</td>
                  <td className="p-1.5 border border-slate-100 text-rose-600 font-black">{row.mati.more48 || '-'}</td>
                  {/* LD */}
                  <td className="p-1.5 border border-slate-100 bg-slate-100 text-slate-500">{row.lamaDirawat || '-'}</td>
                  {/* Sisa */}
                  <td className="p-1.5 border border-slate-100 bg-teal-50/30 text-teal-700 font-black">{row.sisa.L || '-'}</td>
                  <td className="p-1.5 border border-slate-100 bg-teal-50/30 text-teal-700 font-black">{row.sisa.P || '-'}</td>
                  {/* Class Breakdown */}
                  <td className="p-1.5 border border-slate-100 text-slate-400">{(row.sisaClasses['Kelas VVIP'] || row.sisaClasses['Kelas VIP']) || '-'}</td>
                  <td className="p-1.5 border border-slate-100 text-slate-400">{(row.sisaClasses['Kelas 1'] || row.sisaClasses['Kelas I']) || '-'}</td>
                  <td className="p-1.5 border border-slate-100 text-slate-400">{(row.sisaClasses['Kelas 2'] || row.sisaClasses['Kelas II']) || '-'}</td>
                  <td className="p-1.5 border border-slate-100 text-slate-400">{(row.sisaClasses['Kelas 3'] || row.sisaClasses['Kelas III']) || '-'}</td>
                </tr>
              ))}
              {/* Grand Total Row */}
              <tr className="bg-slate-900 text-white font-black text-[10px] text-center">
                <td className="p-3 uppercase tracking-tighter" colSpan={1}>Total</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.awal.L, 0)}</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.awal.P, 0)}</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.masuk.L, 0)}</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.masuk.P, 0)}</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.pindahan.L, 0)}</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.pindahan.P, 0)}</td>
                <td className="p-1.5 border border-slate-800" colSpan={2}>-</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.pindahKeluar.L, 0)}</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.pindahKeluar.P, 0)}</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.keluarHidup.L, 0)}</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.keluarHidup.P, 0)}</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.mati.less48, 0)}</td>
                <td className="p-1.5 border border-slate-800">{censusData.reduce((a, b) => a + b.mati.more48, 0)}</td>
                <td className="p-1.5 border border-slate-800 bg-slate-800">{monthTotals.totalLD}</td>
                <td className="p-1.5 border border-slate-800 bg-teal-800" colSpan={2}>-</td>
                <td className="p-1.5 border border-slate-800" colSpan={4}>-</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* KPI Summary Section */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-6 gap-6 px-4 pb-8">
          {[
            { label: 'BOR', value: `${monthTotals.bor.toFixed(2)}%`, desc: 'Occupancy Rate', color: 'blue' },
            { label: 'ALOS', value: monthTotals.alos.toFixed(2), desc: 'Length of Stay', color: 'indigo' },
            { label: 'BTO', value: monthTotals.bto.toFixed(2), desc: 'Bed Turn Over', color: 'emerald' },
            { label: 'TOI', value: monthTotals.toi.toFixed(2), desc: 'Turn Over Interval', color: 'orange' },
            { label: 'NDR', value: monthTotals.ndr.toFixed(2), desc: 'Net Death Rate', color: 'rose' },
            { label: 'GDR', value: monthTotals.gdr.toFixed(2), desc: 'Gross Death Rate', color: 'slate' },
          ].map((kpi, idx) => (
            <div key={idx} className={`p-4 rounded-3xl bg-${kpi.color}-50 border border-${kpi.color}-100 flex flex-col items-center justify-center text-center shadow-sm`}>
              <span className={`text-[8px] font-black text-${kpi.color}-400 uppercase tracking-widest mb-1`}>{kpi.label}</span>
              <span className={`text-xl font-black text-${kpi.color}-700 tracking-tighter`}>{kpi.value}</span>
              <span className="text-[7px] font-bold text-slate-400 mt-1 uppercase leading-none">{kpi.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Summary / Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] p-8 border shadow-sm">
           <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Users size={18} className="text-orange-600"/> Statistik Klasifikasi
           </h4>
           <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                 <div className="text-[10px] font-black text-slate-400 tracking-wider">TOTAL TEMPAT TIDUR</div>
                 <div className="text-xl font-black text-slate-800">{monthTotals.tt}</div>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                 <div className="text-[10px] font-black text-slate-400 tracking-wider">TOTAL HARI RAWAT</div>
                 <div className="text-xl font-black text-slate-700">{monthTotals.totalHRP}</div>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                 <div className="text-[10px] font-black text-slate-400 tracking-wider">PASIEN KELUAR (H+M)</div>
                 <div className="text-xl font-black text-slate-700">{monthTotals.totalKeluar}</div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border shadow-sm">
           <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Bed size={18} className="text-blue-600"/> Perincian Kapasitas & TT {selectedUnit}
           </h4>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: 'NON KELAS (ISO)', hp: censusData.reduce((a, b) => a + (b.sisaClasses['Non Kelas'] || 0), 0) },
                { title: 'KELAS I', hp: censusData.reduce((a, b) => a + (b.sisaClasses['Kelas 1'] || b.sisaClasses['Kelas I'] || 0), 0) },
                { title: 'KELAS II', hp: censusData.reduce((a, b) => a + (b.sisaClasses['Kelas 2'] || b.sisaClasses['Kelas II'] || 0), 0) },
                { title: 'KELAS III', hp: censusData.reduce((a, b) => a + (b.sisaClasses['Kelas 3'] || b.sisaClasses['Kelas III'] || 0), 0) },
              ].map((c, i) => (
                <div key={i} className="p-5 rounded-3xl bg-slate-50 border border-slate-100 text-center flex flex-col items-center hover:shadow-md transition-shadow">
                   <div className="text-[8px] font-black text-slate-400 tracking-widest mb-2">{c.title}</div>
                   <div className="text-2xl font-black text-slate-700">{c.hp}</div>
                   <div className="text-[7px] font-bold text-slate-400 uppercase mt-1">Total Hari Rawat</div>
                </div>
              ))}
           </div>
           <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center px-4">
              <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Input Real-time</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Synchronized with Cloud</span>
                 </div>
              </div>
              <p className="text-[9px] font-bold text-slate-300 uppercase italic">* Data dikalkulasi secara otomatis dari log pergerakan pasien</p>
           </div>
        </div>
      </div>
    </div>
  );
};
