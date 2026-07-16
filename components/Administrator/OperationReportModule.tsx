import React, { useState, useMemo } from 'react';
import { OperationReport, Patient, AppData, User as AppUser, MasterData } from '../../types';
import { Button } from '../Button';
import { FileText, Plus, Search, Calendar, User, Clock, Edit2, Trash2 } from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';

interface OperationReportModuleProps {
  reports: OperationReport[];
  patients: Patient[];
  onSaveReport: (report: Omit<OperationReport, 'id' | 'createdAt'>) => void;
  onUpdateReport?: (id: string, report: Partial<OperationReport>) => void;
  onDeleteReport?: (id: string) => void;
  currentUser: AppUser | null;
  masterData: MasterData;
}

export const OperationReportModule: React.FC<OperationReportModuleProps> = ({ 
  reports, 
  patients, 
  onSaveReport,
  onUpdateReport,
  onDeleteReport,
  currentUser,
  masterData
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDpjpFilter, setSelectedDpjpFilter] = useState('Semua DPJP');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState(
    currentUser?.unit === "Ruang Bedah" ? "Ruang Bedah" : "Semua Unit"
  );
  const [formData, setFormData] = useState<Partial<OperationReport>>({
    patientId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '10:00',
    operator: '',
    anesthetist: '',
    scrubNurse: '',
    diagnosisPreOp: '',
    diagnosisPostOp: '',
    procedure: '',
    findings: '',
    complications: '-',
    unit: currentUser?.unit || ''
  });

  const filteredReports = useMemo(() => {
    let list = reports || [];
    
    // Role based unit filtering
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'BIDANG') {
      list = list.filter(rep => rep.unit === currentUser.unit);
    }

    if (selectedDpjpFilter !== 'Semua DPJP') {
      list = list.filter(rep => rep.operator === selectedDpjpFilter);
    }

    if (selectedUnitFilter !== 'Semua Unit') {
      list = list.filter(rep => rep.unit === selectedUnitFilter);
    }

    if (searchTerm) {
      list = list.filter(rep => 
        rep.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.noRM.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.date.includes(searchTerm)
      );
    }
    return list;
  }, [reports, searchTerm, currentUser, selectedDpjpFilter, selectedUnitFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.patientId) {
      if (formData.id) {
        if (onUpdateReport) {
          onUpdateReport(formData.id, {
            ...formData,
            recordedBy: currentUser?.name || 'User',
            unit: formData.unit || currentUser?.unit || ''
          });
        }
      } else {
        onSaveReport({
          ...formData,
          recordedBy: currentUser?.name || 'User',
          unit: formData.unit || currentUser?.unit || ''
        } as Omit<OperationReport, 'id' | 'createdAt'>);
      }
      setIsModalOpen(false);
    }
  };

  const selectedPatientHasReport = useMemo(() => {
    if (!formData.patientId) return false;
    return reports.some(r => r.patientId === formData.patientId && r.id !== formData.id);
  }, [reports, formData.patientId, formData.id]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Laporan Operasi (Laporan Keperawatan)</h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Dokumentasi Prosedur Pembedahan</p>
        </div>
        <Button 
          onClick={() => {
            setFormData({
              patientId: '',
              date: new Date().toISOString().split('T')[0],
              startTime: '08:00',
              endTime: '10:00',
              operator: '',
              anesthetist: '',
              scrubNurse: '',
              diagnosisPreOp: '',
              diagnosisPostOp: '',
              procedure: '',
              findings: '',
              complications: '-',
              unit: currentUser?.unit || ''
            });
            setIsModalOpen(true);
          }} 
          className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white shadow-xl shadow-blue-100"
        >
          <Plus size={18} className="mr-2"/> Buat Laporan Baru
        </Button>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col md:flex-row items-end gap-4">
        <div className="flex-1 relative w-full space-y-1.5">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
            PENCARIAN DATA
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari berdasarkan nama pasien, RM, atau tanggal (YYYY-MM-DD)..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end w-full md:w-auto">
          <div className="space-y-1.5 w-48">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
              DPJP OPERATOR
            </label>
            <SearchableSelect
              options={["Semua DPJP"].concat(masterData.doctors || [])}
              value={selectedDpjpFilter}
              onChange={val => setSelectedDpjpFilter(val)}
              placeholder="Filter DPJP..."
            />
          </div>
          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG') && (
            <div className="space-y-1.5 w-48">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                UNIT RELEVAN
              </label>
              <SearchableSelect
                options={["Semua Unit"].concat(masterData.units || [])}
                value={selectedUnitFilter}
                onChange={val => setSelectedUnitFilter(val)}
                placeholder="Filter Unit..."
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.length > 0 ? filteredReports.map(rep => (
          <div key={rep.id} className="bg-white p-6 rounded-[2rem] border shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <FileText size={24} />
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{rep.date}</div>
                  <div className="text-[10px] font-bold text-blue-600">{rep.startTime} - {rep.endTime}</div>
                </div>
              </div>
              <div className="space-y-1 mb-4">
                <div className="text-xs font-black text-blue-700">RM {rep.noRM}</div>
                <div className="text-lg font-black text-slate-800 uppercase leading-tight">{rep.patientName}</div>
              </div>
              <div className="space-y-2 text-xs border-t pt-4 border-dashed">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Operator</span>
                  <span className="text-slate-700 font-black">{rep.operator}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Prosedur</span>
                  <span className="text-slate-700 font-bold text-right truncate max-w-[150px]">{rep.procedure}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Pre-Op</span>
                  <span className="text-slate-650 font-bold text-right truncate max-w-[150px]">{rep.diagnosisPreOp || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Post-Op</span>
                  <span className="text-slate-650 font-bold text-right truncate max-w-[150px]">{rep.diagnosisPostOp || '-'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6 pt-4 border-t border-dashed">
              <button
                type="button"
                onClick={() => {
                  setFormData(rep);
                  setIsModalOpen(true);
                }}
                className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
              >
                <Edit2 size={12} /> Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Apakah Anda yakin ingin menghapus laporan operasi ini?")) {
                    if (onDeleteReport) onDeleteReport(rep.id);
                  }
                }}
                className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
              >
                <Trash2 size={12} /> Hapus
              </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center text-slate-400 font-bold italic">Belum ada laporan operasi.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-10 shadow-2xl animate-fade-in border-t-8 border-indigo-600">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-4">
              {formData.id ? 'Edit Laporan Operasior' : 'Format Laporan Operasi'}
            </h3>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-8">Setiap pasien hanya diperbolehkan memiliki maksimal 1 entri laporan operasi saja.</p>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Pilih Pasien</label>
                  <SearchableSelect
                    options={patients.map(p => {
                      const hasReport = reports.some(r => r.patientId === p.id && r.id !== formData.id);
                      return {
                        label: hasReport ? `${p.noRM} - ${p.name} [TERKUNCI - SUDAH ADA LAPORAN]` : `${p.noRM} - ${p.name}`,
                        value: p.id
                      };
                    })}
                    value={formData.patientId || ''}
                    onChange={val => {
                      const p = patients.find(p => p.id === val);
                      if (p) {
                        setFormData({
                          ...formData,
                          patientId: p.id,
                          patientName: p.name,
                          noRM: p.noRM,
                          unit: p.ruangan || currentUser?.unit || '',
                          procedure: p.tindakanProsedur || '',
                          diagnosisPreOp: p.diagnosaUtama || ''
                        });
                      }
                    }}
                    placeholder="-- Pilih Pasien Terdaftar --"
                  />
                </div>

                {selectedPatientHasReport && (
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-150 text-rose-700 text-[10px] font-black uppercase tracking-wider leading-snug">
                    ⚠️ Peringatan: Pasien ini sudah memiliki riwayat laporan operasi yang terdaftar. Fitur entry dikunci (disabled) untuk menghindari data ganda.
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                   <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal</label>
                      <input type="date" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-100" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}/>
                   </div>
                   <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jam Mulai</label>
                      <input type="time" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-100" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})}/>
                   </div>
                   <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jam Selesai</label>
                      <input type="time" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-100" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})}/>
                   </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tim Bedah (Operator, Anestesi, Scrub Nurse)</label>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Operator</span>
                      <SearchableSelect
                        options={masterData.doctors || []}
                        value={formData.operator || ''}
                        onChange={val => setFormData({ ...formData, operator: val })}
                        placeholder="Operator Bedah..."
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Dokter Anestesi</span>
                      <SearchableSelect
                        options={masterData.doctors || []}
                        value={formData.anesthetist || ''}
                        onChange={val => setFormData({ ...formData, anesthetist: val })}
                        placeholder="Dokter Anestesi..."
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Perawat Instrumen</span>
                      <SearchableSelect
                        options={masterData.nurses || []}
                        value={formData.scrubNurse || ''}
                        onChange={val => setFormData({ ...formData, scrubNurse: val })}
                        placeholder="Perawat Instrumen..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Diagnosa & Prosedur</label>
                  <div className="space-y-2">
                    <input placeholder="Diagnosa Pre-Op" type="text" className="w-full px-4 py-2 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none" value={formData.diagnosisPreOp} onChange={e => setFormData({...formData, diagnosisPreOp: e.target.value})}/>
                    <input placeholder="Diagnosa Post-Op" type="text" className="w-full px-4 py-2 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none" value={formData.diagnosisPostOp} onChange={e => setFormData({...formData, diagnosisPostOp: e.target.value})}/>
                    <input placeholder="Prosedur Bedah" type="text" className="w-full px-4 py-2 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none" value={formData.procedure} onChange={e => setFormData({...formData, procedure: e.target.value})}/>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Temuan Intra-Operatif & Komplikasi</label>
                  <textarea rows={4} className="w-full px-4 py-3 border border-slate-100 rounded-xl text-xs font-bold mb-2 focus:ring-2 focus:ring-indigo-100 outline-none" value={formData.findings} onChange={e => setFormData({...formData, findings: e.target.value})} placeholder="Tuliskan temuan klinis saat operasi..."></textarea>
                  <input placeholder="Komplikasi (jika ada)" type="text" className="w-full px-4 py-2 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none" value={formData.complications} onChange={e => setFormData({...formData, complications: e.target.value})}/>
                </div>
              </div>

              <div className="col-span-full flex gap-4 pt-6 border-t">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1 py-4">Batal</Button>
                <Button 
                  type="submit" 
                  disabled={selectedPatientHasReport || !formData.patientId} 
                  className="flex-1 py-4 bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-405 disabled:pointer-events-none"
                >
                  {formData.id ? 'Perbarui Laporan' : 'Simpan Laporan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
