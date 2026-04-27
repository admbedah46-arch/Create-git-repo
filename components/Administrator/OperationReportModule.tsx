import React, { useState, useMemo } from 'react';
import { OperationReport, Patient, AppData, User as AppUser } from '../../types';
import { Button } from '../Button';
import { FileText, Plus, Search, Calendar, User, Clock, Edit2 } from 'lucide-react';

interface OperationReportModuleProps {
  reports: OperationReport[];
  patients: Patient[];
  onSaveReport: (report: Omit<OperationReport, 'id' | 'createdAt'>) => void;
  currentUser: AppUser | null;
}

export const OperationReportModule: React.FC<OperationReportModuleProps> = ({ 
  reports, 
  patients, 
  onSaveReport,
  currentUser
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
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

    if (searchTerm) {
      list = list.filter(rep => 
        rep.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.noRM.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.date.includes(searchTerm)
      );
    }
    return list;
  }, [reports, searchTerm, currentUser]);

  const handlePatientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value;
    const p = patients.find(p => p.id === pId);
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.patientId) {
      onSaveReport({
        ...formData,
        recordedBy: currentUser?.name || 'User',
        unit: formData.unit || currentUser?.unit || ''
      } as Omit<OperationReport, 'id' | 'createdAt'>);
      setIsModalOpen(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Laporan Operasi</h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Dokumentasi Prosedur Pembedahan</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white shadow-xl shadow-blue-100">
          <Plus size={18} className="mr-2"/> Buat Laporan Baru
        </Button>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center gap-4">
        <div className="flex-1 relative">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.length > 0 ? filteredReports.map(rep => (
          <div key={rep.id} className="bg-white p-6 rounded-[2rem] border shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
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
            </div>
            <button className="absolute bottom-6 right-6 p-2 bg-slate-900 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg">
              <Edit2 size={14}/>
            </button>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center text-slate-400 font-bold italic">Belum ada laporan operasi.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-10 shadow-2xl animate-fade-in">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-8">Format Laporan Operasi</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pilih Pasien</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                    value={formData.patientId}
                    onChange={handlePatientSelect}
                  >
                    <option value="">-- Pilih Pasien Terdaftar --</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.noRM} - {p.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                   <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal</label>
                      <input type="date" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}/>
                   </div>
                   <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jam Mulai</label>
                      <input type="time" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})}/>
                   </div>
                   <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jam Selesai</label>
                      <input type="time" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})}/>
                   </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tim Bedah (Operator, Anestesi, Scrub Nurse)</label>
                  <div className="space-y-2">
                    <input placeholder="Operator" type="text" className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold" value={formData.operator} onChange={e => setFormData({...formData, operator: e.target.value})}/>
                    <input placeholder="Dokter Anestesi" type="text" className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold" value={formData.anesthetist} onChange={e => setFormData({...formData, anesthetist: e.target.value})}/>
                    <input placeholder="Perawat Instrumen" type="text" className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold" value={formData.scrubNurse} onChange={e => setFormData({...formData, scrubNurse: e.target.value})}/>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Diagnosa & Prosedur</label>
                  <div className="space-y-2">
                    <input placeholder="Diagnosa Pre-Op" type="text" className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold" value={formData.diagnosisPreOp} onChange={e => setFormData({...formData, diagnosisPreOp: e.target.value})}/>
                    <input placeholder="Diagnosa Post-Op" type="text" className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold" value={formData.diagnosisPostOp} onChange={e => setFormData({...formData, diagnosisPostOp: e.target.value})}/>
                    <input placeholder="Prosedur Bedah" type="text" className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold" value={formData.procedure} onChange={e => setFormData({...formData, procedure: e.target.value})}/>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Temuan Intra-Operatif & Komplikasi</label>
                  <textarea rows={4} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold mb-2" value={formData.findings} onChange={e => setFormData({...formData, findings: e.target.value})} placeholder="Tuliskan temuan klinis saat operasi..."></textarea>
                  <input placeholder="Komplikasi (jika ada)" type="text" className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold" value={formData.complications} onChange={e => setFormData({...formData, complications: e.target.value})}/>
                </div>
              </div>

              <div className="col-span-full flex gap-4 pt-6 border-t">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1 py-4">Batal</Button>
                <Button type="submit" className="flex-1 py-4 bg-slate-900 text-white">Simpan Laporan</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
