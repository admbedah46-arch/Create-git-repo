
import React, { useState } from 'react';
import { IncidentReport, SimpleInvestigation, TimelineStep, FiveWhysAnalysis } from '../../types';
import { Button } from '../Button';
import { X, Plus, Trash2, ArrowDown, ChevronRight, Save, ClipboardList, Activity, GitBranch } from 'lucide-react';

interface InvestigationFormProps {
  report: IncidentReport;
  onSave: (investigation: SimpleInvestigation) => void;
  onClose: () => void;
}

const CONTRIBUTOR_FACTORS = [
  {
    category: "A. FAKTOR STAF",
    components: [
      { name: "1. Faktor Kognitif", sub: ["Persepsi/Pemahaman", "Pengetahuan/Pemecahan Masalah"] },
      { name: "2. Faktor Kinerja", sub: ["Kesalahan Teknis", "Kesalahan Prosedur", "Pemilihan/Seleksi", "Bias"] },
      { name: "3. Tingkah Laku", sub: ["Masalah Perhatian", "Kelelahan", "Terlalu Percaya Diri", "Ketidakpatuhan", "Pelanggaran Rutin", "Perilaku Berisiko", "Sabotase"] },
      { name: "4. Komunikasi", sub: ["Metode Komunikasi", "Perbedaan Bahasa", "Health Literacy", "Dengan Staf/Pasien"] }
    ]
  },
  {
    category: "B. FAKTOR PASIEN",
    components: [
      { name: "1. Faktor Kognitif", sub: ["Persepsi/Pemahaman", "Pengetahuan/Pemecahan Masalah"] },
      { name: "2. Tingkah Laku", sub: ["Masalah Perhatian", "Kelelahan", "Ketidakpatuhan", "Perilaku Berisiko"] },
      { name: "3. Komunikasi", sub: ["Metode Komunikasi", "Health Literacy"] }
    ]
  },
  {
    category: "C. FAKTOR EKSTERNAL",
    components: [
      { name: "1. Lingkungan Alam", sub: [] },
      { name: "2. Produk Teknologi / Infrastruktur", sub: [] },
      { name: "3. Pelayanan, Sistem, Kebijakan", sub: [] }
    ]
  },
  {
    category: "D. FAKTOR FASYANKES",
    components: [
      { name: "1. Kebijakan, Prosedur, Protokol", sub: [] },
      { name: "2. Keputusan Organisasi", sub: [] },
      { name: "3. Kerjasama Tim", sub: [] },
      { name: "4. Sumber Daya / Beban Kerja", sub: [] }
    ]
  },
  {
    category: "E. FAKTOR LINGKUNGAN",
    components: [
      { name: "1. Lingkungan Fisik / Infrastruktur", sub: [] },
      { name: "2. Lokasi jauh / Remote area", sub: [] },
      { name: "3. Asesmen Resiko Lingkungan", sub: [] },
      { name: "4. Regulasi / Kode", sub: [] }
    ]
  }
];

export const InvestigationForm: React.FC<InvestigationFormProps> = ({ report, onSave, onClose }) => {
  const [activeTab, setActiveTab] = useState<'TIMELINE' | '5WHYS'>('TIMELINE');
  const [investigation, setInvestigation] = useState<SimpleInvestigation>(
    report.investigation || {
      tabularTimeline: [],
      analysis: []
    }
  );

  const addTimelineStep = () => {
    const newStep: TimelineStep = {
      id: Date.now().toString(),
      time: '',
      event: '',
      info: '',
      goodPractice: '',
      cmp: '',
      sdp: ''
    };
    setInvestigation({
      ...investigation,
      tabularTimeline: [...investigation.tabularTimeline, newStep]
    });
  };

  const updateTimelineStep = (id: string, updates: Partial<TimelineStep>) => {
    setInvestigation({
      ...investigation,
      tabularTimeline: investigation.tabularTimeline.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  const removeTimelineStep = (id: string) => {
    setInvestigation({
      ...investigation,
      tabularTimeline: investigation.tabularTimeline.filter(s => s.id !== id)
    });
  };

  const addAnalysis = () => {
      const newAnalysis: FiveWhysAnalysis = {
        id: Date.now().toString(),
        problem: '',
        immediateCause: '',
        why2: '',
        why3: '',
        why4: '',
        rootCause: '',
        contributorComponent: '',
        contributorSubComponent: '',
        recommendations: ['', '', ''],
        actions: ['', '', '']
      };
      setInvestigation({
        ...investigation,
        analysis: [...investigation.analysis, newAnalysis]
      });
  };

  const updateAnalysis = (id: string, updates: Partial<FiveWhysAnalysis>) => {
    setInvestigation({
      ...investigation,
      analysis: investigation.analysis.map(a => a.id === id ? { ...a, ...updates } : a)
    });
  };

  const removeAnalysis = (id: string) => {
    setInvestigation({
      ...investigation,
      analysis: investigation.analysis.filter(a => a.id !== id)
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-7xl h-[95vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border">
        {/* Header */}
        <div className="px-10 py-6 border-b flex justify-between items-center bg-slate-50/50">
          <div>
            <div className="flex items-center gap-3">
              <ClipboardList className="text-blue-600" size={24}/>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Investigasi Sederhana Insiden</h3>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
              Case Ref: <span className="text-blue-500">{report.id}</span> • {report.incidentName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={24}/>
          </button>
        </div>

        {/* Tabs navigation */}
        <div className="px-10 py-4 bg-white border-b flex gap-6">
          <button 
            onClick={() => setActiveTab('TIMELINE')}
            className={`flex items-center gap-2 pb-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'TIMELINE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
          >
            <Activity size={16}/> 1. Tabular Timeline
          </button>
          <button 
            onClick={() => setActiveTab('5WHYS')}
            className={`flex items-center gap-2 pb-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === '5WHYS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
          >
            <GitBranch size={16}/> 2. Flow Chart : 5 Why's
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === 'TIMELINE' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Pemetakan Kronologi (Tabular Timeline)</h4>
                <Button onClick={addTimelineStep} className="bg-blue-600 text-white rounded-xl px-6 py-2 text-xs font-black uppercase">
                  <Plus size={16} className="mr-2"/> Tambah Baris Waktu
                </Button>
              </div>

              <div className="overflow-x-auto rounded-[2rem] border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="p-4 w-32 border-r border-slate-700">Waktu</th>
                      <th className="p-4 w-64 border-r border-slate-700">Kejadian</th>
                      <th className="p-4 w-64 border-r border-slate-700">Informasi Tambahan</th>
                      <th className="p-4 w-64 border-r border-slate-700">Good Practice</th>
                      <th className="p-4 w-64 border-r border-slate-700">Masalah (CMP)</th>
                      <th className="p-4 w-64">Masalah (SDP)</th>
                      <th className="p-4 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {investigation.tabularTimeline.length > 0 ? investigation.tabularTimeline.map((step, idx) => (
                      <tr key={step.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2 border-r">
                          <input 
                            type="datetime-local" 
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-black text-slate-600 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                            value={step.time}
                            onChange={e => updateTimelineStep(step.id, { time: e.target.value })}
                          />
                        </td>
                        <td className="p-2 border-r">
                   <textarea 
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 min-h-[80px]" 
                            placeholder="Uraian kejadian..."
                            value={step.event}
                            onChange={e => updateTimelineStep(step.id, { event: e.target.value })}
                          />
                        </td>
                        <td className="p-2 border-r">
                   <textarea 
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 min-h-[80px]" 
                            placeholder="Info pendukung..."
                            value={step.info}
                            onChange={e => updateTimelineStep(step.id, { info: e.target.value })}
                          />
                        </td>
                        <td className="p-2 border-r">
                   <textarea 
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 min-h-[80px]" 
                            placeholder="Praktek seharusnya..."
                            value={step.goodPractice}
                            onChange={e => updateTimelineStep(step.id, { goodPractice: e.target.value })}
                          />
                        </td>
                        <td className="p-2 border-r">
                   <textarea 
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 min-h-[80px] bg-red-50/20 border-red-100" 
                            placeholder="Permasalahan Asuhan..."
                            value={step.cmp}
                            onChange={e => updateTimelineStep(step.id, { cmp: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                   <textarea 
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 min-h-[80px] bg-amber-50/20 border-amber-100" 
                            placeholder="Permasalahan Fasilitas..."
                            value={step.sdp}
                            onChange={e => updateTimelineStep(step.id, { sdp: e.target.value })}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button onClick={() => removeTimelineStep(step.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={16}/>
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="p-20 text-center">
                           <div className="flex flex-col items-center opacity-30">
                              <Activity size={48} className="mb-4"/>
                              <p className="text-sm font-black uppercase tracking-widest italic">Belum ada timeline kronologi</p>
                           </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-6 bg-slate-900 rounded-3xl text-white">
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest opacity-80">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div> CMP = Care Management Problem (Masalah Terkait Asuhan)
                  <div className="w-2 h-2 bg-amber-500 rounded-full ml-4"></div> SDP = Service Delivery Problem (Masalah Terkait Fasilitas & Sarpras)
                </div>
              </div>
            </div>
          )}

          {activeTab === '5WHYS' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Analisis Masalah (5 Why's & Faktor Kontributor)</h4>
                <Button onClick={addAnalysis} className="bg-indigo-600 text-white rounded-xl px-6 py-2 text-xs font-black uppercase">
                  <Plus size={16} className="mr-2"/> Tambah Masalah Baru
                </Button>
              </div>

              <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar">
                {investigation.analysis.length > 0 ? investigation.analysis.map((a, idx) => (
                  <div key={a.id} className="min-w-[400px] bg-white border border-slate-200 rounded-[2.5rem] shadow-sm flex flex-col overflow-hidden">
                    <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase tracking-widest">Masalah #{idx + 1}</span>
                       <button onClick={() => removeAnalysis(a.id)} className="p-1 hover:bg-white/10 rounded-lg text-white/50"><X size={14}/></button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                       {/* Problem Entry */}
                       <div className="space-y-2">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">MASALAH (CMP/SDP)</label>
                          <textarea 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-black uppercase" 
                            rows={2}
                            value={a.problem}
                            onChange={e => updateAnalysis(a.id, { problem: e.target.value })}
                          />
                       </div>

                       <div className="flex flex-col items-center gap-2 text-slate-300">
                          <ArrowDown size={16}/>
                          <span className="text-[8px] font-bold">Kenapa ? (1)</span>
                       </div>

                       <div className="space-y-2">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Penyebab Langsung (Immediate Cause)</label>
                          <input 
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-bold" 
                            value={a.immediateCause}
                            onChange={e => updateAnalysis(a.id, { immediateCause: e.target.value })}
                          />
                       </div>

                       {[2, 3, 4].map(w => (
                         <React.Fragment key={w}>
                            <div className="flex flex-col items-center gap-1 text-slate-300">
                               <ArrowDown size={14}/>
                               <span className="text-[8px] font-bold">Kenapa ? ({w})</span>
                            </div>
                            <input 
                              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold" 
                              value={(a as any)[`why${w}`]}
                              onChange={e => updateAnalysis(a.id, { [`why${w}`]: e.target.value } as any)}
                            />
                         </React.Fragment>
                       ))}

                       <div className="flex flex-col items-center gap-1 text-blue-600">
                          <ArrowDown size={14}/>
                          <span className="text-[10px] font-black uppercase">Root Cause</span>
                       </div>

                       <div className="space-y-2 p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                          <label className="text-[8px] font-black text-white/70 uppercase tracking-widest">AKAR MASALAH (ROOT CAUSE)</label>
                          <textarea 
                            className="w-full bg-white rounded-xl p-3 text-xs font-black text-slate-800" 
                            rows={3}
                            value={a.rootCause}
                            onChange={e => updateAnalysis(a.id, { rootCause: e.target.value })}
                          />
                       </div>

                       {/* Contributor Section */}
                       <div className="p-6 bg-slate-50 rounded-3xl border border-dashed space-y-4">
                          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">FAKTOR KONTRIBUTOR</div>
                          <div className="space-y-3">
                             <select 
                               className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-black uppercase outline-none"
                               value={a.contributorComponent}
                               onChange={e => updateAnalysis(a.id, { contributorComponent: e.target.value })}
                             >
                                <option value="">-- Pilih Komponen --</option>
                                {CONTRIBUTOR_FACTORS.map(f => (
                                  <optgroup key={f.category} label={f.category}>
                                     {f.components.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                  </optgroup>
                                ))}
                             </select>
                             <select 
                               className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-black uppercase outline-none"
                               value={a.contributorSubComponent}
                               onChange={e => updateAnalysis(a.id, { contributorSubComponent: e.target.value })}
                             >
                                <option value="">-- Pilih Sub-Komponen --</option>
                                {CONTRIBUTOR_FACTORS.flatMap(f => f.components)
                                  .find(c => c.name === a.contributorComponent)?.sub.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                             </select>
                          </div>
                       </div>

                       {/* Recommendations & Actions */}
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">REKOMENDASI</div>
                             {a.recommendations.map((r, i) => (
                               <div key={i} className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-300">{i+1}</span>
                                  <input 
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold" 
                                    value={r}
                                    onChange={e => {
                                      const newRecs = [...a.recommendations];
                                      newRecs[i] = e.target.value;
                                      updateAnalysis(a.id, { recommendations: newRecs });
                                    }}
                                  />
                               </div>
                             ))}
                          </div>
                          <div className="space-y-2">
                             <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">TINDAKAN</div>
                             {a.actions.map((act, i) => (
                               <div key={i} className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-300">{i+1}</span>
                                  <input 
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold" 
                                    value={act}
                                    onChange={e => {
                                      const newActs = [...a.actions];
                                      newActs[i] = e.target.value;
                                      updateAnalysis(a.id, { actions: newActs });
                                    }}
                                  />
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  </div>
                )) : (
                  <div className="w-full flex flex-col items-center justify-center p-20 border-2 border-dashed rounded-[3rem] opacity-20">
                    <GitBranch size={48} className="mb-4"/>
                    <p className="text-lg font-black uppercase tracking-widest">Belum ada analisis akar masalah</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-10 py-8 border-t bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <ClipboardList size={16}/> Laporan Investigasi akan tersimpan di riwayat insiden
           </div>
           <div className="flex gap-4 w-full sm:w-auto">
              <Button onClick={onClose} variant="secondary" className="flex-1 sm:flex-none px-10 rounded-2xl py-3 font-black">Batal</Button>
              <Button 
                onClick={() => onSave(investigation)} 
                className="flex-1 sm:flex-none px-12 rounded-2xl py-3 bg-blue-600 text-white font-black hover:bg-blue-700 shadow-xl shadow-blue-200"
              >
                <Save size={18} className="mr-2"/> Update Investigasi
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
};
