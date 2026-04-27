
import React, { useState, useMemo } from 'react';
import { QualityIndicator, QualityMeasurement, MasterData, User as AppUser } from '../../types';
import { Button } from '../Button';
import { 
  ClipboardCheck, Target, TrendingUp, TrendingDown, 
  Calendar, Info, Save, CheckCircle2, AlertTriangle,
  History, Search, Filter, LayoutGrid
} from 'lucide-react';

interface QualityWorksheetProps {
  indicators: QualityIndicator[];
  measurements: QualityMeasurement[];
  onSaveMeasurement: (m: QualityMeasurement) => void;
  currentUser: AppUser | null;
}

export const QualityWorksheet: React.FC<QualityWorksheetProps> = ({ 
  indicators, 
  measurements, 
  onSaveMeasurement,
  currentUser
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'ENTRY' | 'SUMMARY'>('ENTRY');
  
  const [localValues, setLocalValues] = useState<Record<string, { num: number, den: number }>>({});

  const filteredMeasurements = useMemo(() => {
    let list = measurements || [];
    // If restricted role, only see measurements from their unit
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'BIDANG') {
      list = list.filter(m => m.unit === currentUser.unit);
    }
    return list;
  }, [measurements, currentUser]);

  const handleInputChange = (id: string, field: 'num' | 'den', val: string) => {
    const numVal = parseInt(val) || 0;
    setLocalValues(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { num: 0, den: 0 }),
        [field]: numVal
      }
    }));
  };

  const getExistingMeasurement = (indicatorId: string) => {
    return filteredMeasurements.find(m => m.indicatorId === indicatorId && m.date === selectedDate);
  };

  const saveMeasurement = (indicator: QualityIndicator) => {
    const values = localValues[indicator.id] || { num: 0, den: 0 };
    const measurement: QualityMeasurement = {
      id: getExistingMeasurement(indicator.id)?.id || `m-${Date.now()}`,
      indicatorId: indicator.id,
      date: selectedDate,
      numeratorValue: values.num,
      denominatorValue: values.den,
      recordedBy: currentUser?.name || 'User',
      unit: currentUser?.unit || ''
    };
    onSaveMeasurement(measurement);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Dynamic Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="max-w-xl">
            <h3 className="text-4xl font-black tracking-tighter mb-3 flex items-center gap-4">
              <ClipboardCheck size={40}/> Kertas Kerja PIC Mutu {currentUser?.unit && ` - ${currentUser.unit}`}
            </h3>
            <p className="text-indigo-100 font-medium text-sm leading-relaxed">
              Input harian untuk pengukuran indikator mutu nasional (INM) dan prioritas unit. 
              Gunakan data objektif dari rekam medis atau observasi langsung.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/20 shadow-inner flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <Calendar size={24}/>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200 mb-1">Pilih Tgl Pengukuran</label>
              <input 
                type="date" 
                className="bg-transparent border-none text-xl font-black focus:ring-0 outline-none p-0 cursor-pointer"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  setLocalValues({}); // Clear local draft on date change
                }}
              />
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <Target size={280} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white p-1 rounded-2xl border shadow-sm w-fit">
        <button 
          onClick={() => setActiveTab('ENTRY')}
          className={`px-12 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ENTRY' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          Form Entri Harian
        </button>
        <button 
          onClick={() => setActiveTab('SUMMARY')}
          className={`px-12 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SUMMARY' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          Ringkasan Capaian
        </button>
      </div>

      {activeTab === 'ENTRY' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {indicators.map(indicator => {
            const existing = getExistingMeasurement(indicator.id);
            const currentDraft = localValues[indicator.id] || { 
              num: existing?.numeratorValue || 0, 
              den: existing?.denominatorValue || 0 
            };
            const result = currentDraft.den > 0 ? (currentDraft.num / currentDraft.den) * 100 : 0;
            const isAchieved = result >= indicator.target;

            return (
              <div key={indicator.id} className="bg-white rounded-[2rem] border shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all">
                <div className="p-8 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="px-4 py-1.5 bg-slate-100 text-[9px] font-black text-slate-500 rounded-full border uppercase tracking-widest mb-3 inline-block">
                        {indicator.category}
                      </span>
                      <h4 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{indicator.title}</h4>
                    </div>
                    <div className="text-right">
                       <div className={`text-4xl font-black tracking-tighter ${isAchieved ? 'text-emerald-500' : 'text-rose-500'}`}>
                         {result.toFixed(1)}%
                       </div>
                       <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">TARGET: {indicator.target}%</div>
                    </div>
                  </div>

                  <div className="bg-slate-50/80 p-6 rounded-2xl border-2 border-dashed border-slate-100 mb-8">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl mt-1">
                        <Info size={16}/>
                      </div>
                      <div className="space-y-3 flex-1">
                        <div>
                          <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Numerator (Pembilang)</div>
                          <p className="text-xs text-slate-500 font-medium">{indicator.numerator}</p>
                        </div>
                        <div className="h-px bg-slate-200"></div>
                        <div>
                          <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Denominator (Penyebut)</div>
                          <p className="text-xs text-slate-500 font-medium">{indicator.denominator}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mt-auto">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Numerator</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xl font-black text-slate-700 focus:border-indigo-500 outline-none transition-all"
                        value={currentDraft.num}
                        onChange={e => handleInputChange(indicator.id, 'num', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Isi Denominator</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xl font-black text-slate-700 focus:border-indigo-500 outline-none transition-all"
                        value={currentDraft.den}
                        onChange={e => handleInputChange(indicator.id, 'den', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-8 py-5 bg-slate-50 border-t flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {existing ? (
                      <>
                        <CheckCircle2 size={16} className="text-emerald-500"/>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tersimpan oleh {existing.recordedBy}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} className="text-amber-500"/>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada input hari ini</span>
                      </>
                    )}
                  </div>
                  <Button 
                    onClick={() => saveMeasurement(indicator)}
                    className="rounded-xl px-8 py-2.5 shadow-xl shadow-indigo-100 text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white"
                  >
                    <Save size={16} className="mr-2"/> {existing ? 'Perbarui Data' : 'Simpan Entri'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'SUMMARY' && (
        <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden animate-fade-in">
          <div className="p-8 border-b flex justify-between items-center">
            <h4 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <History className="text-indigo-600"/> Riwayat Pengukuran Bulan Ini
            </h4>
            <div className="flex gap-2">
              <Button variant="ghost" className="border rounded-xl text-[10px] font-black"><Filter size={14} className="mr-2"/> Filter Unit</Button>
              <Button variant="ghost" className="border rounded-xl text-[10px] font-black">Export Excel</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b">
                <tr>
                  <th className="p-6">TANGGAL</th>
                  <th className="p-6">INDIKATOR</th>
                  <th className="p-6 text-center">NUM / DEN</th>
                  <th className="p-6 text-center">CAPAIAN</th>
                  <th className="p-6 text-center">TARGET</th>
                  <th className="p-6">PETUGAS PIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMeasurements.sort((a,b) => b.date.localeCompare(a.date)).map(m => {
                  const ind = indicators.find(i => i.id === m.indicatorId);
                  const result = m.denominatorValue > 0 ? (m.numeratorValue / m.denominatorValue) * 100 : 0;
                  const isAchieved = result >= (ind?.target || 0);
                  
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-bold text-slate-600">{m.date}</td>
                      <td className="p-6 font-black text-slate-800 uppercase">{ind?.title}</td>
                      <td className="p-6 text-center font-bold text-slate-500">{m.numeratorValue} / {m.denominatorValue}</td>
                      <td className="p-6 text-center">
                         <span className={`px-4 py-1.5 rounded-full font-black ${isAchieved ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                           {result.toFixed(1)}%
                         </span>
                      </td>
                      <td className="p-6 text-center font-bold text-slate-400">{ind?.target}%</td>
                      <td className="p-6 text-slate-500 italic">{m.recordedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {measurements.length === 0 && (
              <div className="p-24 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-20">
                Belum ada data riwayat pengukuran
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
