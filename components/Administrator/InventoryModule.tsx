import React, { useState } from 'react';
import { Instrument, AppData, User as AppUser } from '../../types';
import { Button } from '../Button';
import { Search, Plus, Wrench, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

interface InventoryModuleProps {
  instruments: Instrument[];
  onAddInstrument: (instrument: Omit<Instrument, 'id'>) => void;
  onUpdateInstrument: (id: string, updates: Partial<Instrument>) => void;
  currentUser: AppUser | null;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ 
  instruments, 
  onAddInstrument, 
  onUpdateInstrument,
  currentUser
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Omit<Instrument, 'id'>>({
    code: '',
    name: '',
    category: 'Alat Bedah Umum',
    status: 'READY'
  });

  const filteredInstruments = React.useMemo(() => {
    let list = instruments || [];
    
    // Filter by unit if not super admin or bidang
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'BIDANG') {
      // Assuming Instrument has a unit field or we filter based on current context
      // If Instrument doesn't have a unit field, we should probably add it to the type
      // But for now, let's assume we match the user's unit if we were to add it.
      // Requirements say "khusus ruangan/unit nya".
      // I'll filter by a unit property which I'll add to Instrument if it's missing.
      list = list.filter(inst => (inst as any).unit === currentUser.unit);
    }

    return list.filter(inst => 
      inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [instruments, searchTerm, currentUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddInstrument({
      ...formData,
      unit: currentUser?.unit || ''
    } as any);
    setIsModalOpen(false);
    setFormData({ code: '', name: '', category: 'Alat Bedah Umum', status: 'READY' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Inventaris Alat Bedah</h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Manajemen Alat & Pemeliharaan</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white shadow-xl shadow-blue-100">
          <Plus size={18} className="mr-2"/> Tambah Alat Baru
        </Button>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari berdasarkan nama atau kode alat..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
            <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
              <th className="p-6">Kode</th>
              <th className="p-6">Nama Alat</th>
              <th className="p-6">Kategori</th>
              <th className="p-6 text-center">Status</th>
              <th className="p-6">Terakhir Rawat</th>
              <th className="p-6 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {filteredInstruments.length > 0 ? filteredInstruments.map(inst => (
              <tr key={inst.id} className="hover:bg-slate-50 transition-colors group">
                <td className="p-6 font-black text-blue-600">{inst.code}</td>
                <td className="p-6 font-bold text-slate-800 uppercase">{inst.name}</td>
                <td className="p-6 text-slate-500 font-medium">{inst.category}</td>
                <td className="p-6 text-center">
                  <span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase flex items-center justify-center gap-1 mx-auto w-fit ${
                    inst.status === 'READY' ? 'bg-emerald-50 text-emerald-600' :
                    inst.status === 'IN_USE' ? 'bg-blue-50 text-blue-600' :
                    'bg-orange-50 text-orange-600'
                  }`}>
                    {inst.status === 'READY' && <CheckCircle2 size={10}/>}
                    {inst.status === 'IN_USE' && <Activity size={10}/>}
                    {inst.status === 'MAINTENANCE' && <Wrench size={10}/>}
                    {inst.status}
                  </span>
                </td>
                <td className="p-6 text-slate-500 font-bold">{inst.lastMaintenance || '-'}</td>
                <td className="p-6 text-right space-x-2">
                  <button 
                    onClick={() => onUpdateInstrument(inst.id, { status: 'IN_USE' })}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white"
                    title="Gunakan"
                  >
                    <Activity size={14}/>
                  </button>
                  <button 
                    onClick={() => onUpdateInstrument(inst.id, { status: 'MAINTENANCE', lastMaintenance: new Date().toISOString().split('T')[0] })}
                    className="p-2 bg-orange-50 text-orange-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-orange-600 hover:text-white"
                    title="Perawatan"
                  >
                    <Wrench size={14}/>
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="p-20 text-center text-slate-400 font-bold italic">Data alat tidak ditemukan.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-fade-in">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-6">Tambah Alat Baru</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kode Alat</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Alat</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kategori</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                  <option>Alat Bedah Umum</option>
                  <option>Instrumen Ortopedi</option>
                  <option>Laparoskopi</option>
                  <option>Anestesi</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1 py-3">Batal</Button>
                <Button type="submit" className="flex-1 py-3 bg-blue-600 text-white">Simpan</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
