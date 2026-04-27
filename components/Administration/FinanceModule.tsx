
import React, { useState, useMemo } from 'react';
import { FinanceRecord, MasterData, Patient, User as AppUser } from '../../types';
import { Button } from '../Button';
import { Plus, TrendingUp, TrendingDown, Wallet, Calendar, Search, Filter, ChevronDown, Download, BarChart3 } from 'lucide-react';

interface FinanceModuleProps {
  records: FinanceRecord[];
  masterData: MasterData;
  patients: Patient[];
  onAddRecord: (record: FinanceRecord) => void;
  currentUser: AppUser | null;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({ records, masterData, patients, onAddRecord, currentUser }) => {
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [newRecord, setNewRecord] = useState<Partial<FinanceRecord>>({
    type: 'INCOME',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    category: '',
    description: '',
    ksm: '',
    dpjp: '',
    unit: currentUser?.unit || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.amount || !newRecord.category) return;
    
    onAddRecord({
      ...newRecord,
      id: Date.now().toString(),
      recordedBy: currentUser?.name || 'Admin Finansial',
      unit: currentUser?.unit || newRecord.unit
    } as FinanceRecord);
    
    setShowForm(false);
    setNewRecord({ 
      type: 'INCOME', 
      date: new Date().toISOString().split('T')[0], 
      amount: 0, 
      category: '', 
      description: '',
      ksm: '',
      dpjp: ''
    });
  };

  const isInSelectedPeriod = (dateStr: string) => {
    const recordDate = new Date(dateStr);
    const today = new Date();
    if (period === 'DAILY') return recordDate.toDateString() === today.toDateString();
    if (period === 'WEEKLY') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(today.getDate() - 7);
      return recordDate >= oneWeekAgo;
    }
    return recordDate.getMonth() === today.getMonth() && recordDate.getFullYear() === today.getFullYear();
  };

  const filteredRecords = useMemo(() => {
    let list = records.filter(r => isInSelectedPeriod(r.date));
    
    // Filter by unit if not super admin or bidang
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'BIDANG') {
      list = list.filter(r => r.unit === currentUser.unit);
    }
    
    return list;
  }, [records, period, currentUser]);

  const totals = filteredRecords.reduce((acc, curr) => {
    if (curr.type === 'INCOME') acc.income += curr.amount;
    else acc.expense += curr.amount;
    return acc;
  }, { income: 0, expense: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border shadow-sm">
        <div>
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <BarChart3 className="text-blue-600"/> Laporan Keuangan Periode
          </h3>
          <p className="text-xs text-gray-400">Monitoring real-time pendapatan dan biaya operasional.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1 w-full md:w-auto">
          {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(p => (
            <button 
              key={p} 
              onClick={() => setPeriod(p)} 
              className={`flex-1 md:px-6 py-2 text-[11px] font-bold rounded-lg transition-all ${period === p ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {p === 'DAILY' ? 'HARIAN' : p === 'WEEKLY' ? 'MINGGUAN' : 'BULANAN'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-8 border-l-emerald-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Income</p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={18}/></div>
          </div>
          <h3 className="text-3xl font-black text-emerald-600 mt-2">Rp {totals.income.toLocaleString('id-ID')}</h3>
          <p className="text-[10px] text-gray-400 mt-1 italic">Dihitung dari {filteredRecords.filter(f => f.type === 'INCOME').length} transaksi</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-8 border-l-red-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Expenses</p>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><TrendingDown size={18}/></div>
          </div>
          <h3 className="text-3xl font-black text-red-600 mt-2">Rp {totals.expense.toLocaleString('id-ID')}</h3>
          <p className="text-[10px] text-gray-400 mt-1 italic">Dihitung dari {filteredRecords.filter(f => f.type === 'EXPENSE').length} transaksi</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-8 border-l-blue-600 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Balance</p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Wallet size={18}/></div>
          </div>
          <h3 className="text-3xl font-black text-blue-600 mt-2">Rp {(totals.income - totals.expense).toLocaleString('id-ID')}</h3>
          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
             <div className="bg-emerald-500 h-full" style={{ width: totals.income > 0 ? `${Math.min(100, (totals.income / (totals.income + totals.expense)) * 100)}%` : '0%' }}></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={() => setShowForm(true)} size="sm" className="px-6 rounded-full"><Plus size={16} className="mr-2"/> Catat Transaksi</Button>
            <Button variant="ghost" size="sm" className="rounded-full border"><Download size={14} className="mr-2"/> Ekspor PDF</Button>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
            <input className="w-full pl-9 pr-4 py-2 border rounded-full text-xs" placeholder="Cari keterangan / DPJP..."/>
          </div>
        </div>

        {showForm && (
          <div className="p-8 border-b bg-blue-50/50 animate-fade-in">
            <div className="max-w-4xl mx-auto">
              <h4 className="font-bold text-blue-900 mb-6 flex items-center gap-2"><Plus size={18}/> Form Input Transaksi Baru</h4>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5 tracking-widest">Tipe Transaksi</label>
                  <div className="flex bg-white p-1 rounded-lg border">
                    <button type="button" onClick={() => setNewRecord({...newRecord, type: 'INCOME'})} className={`flex-1 py-2 text-[10px] font-bold rounded ${newRecord.type === 'INCOME' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'}`}>INCOME</button>
                    <button type="button" onClick={() => setNewRecord({...newRecord, type: 'EXPENSE'})} className={`flex-1 py-2 text-[10px] font-bold rounded ${newRecord.type === 'EXPENSE' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500'}`}>EXPENSE</button>
                  </div>
                </div>
                <div className="md:col-span-4">
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5 tracking-widest">Kategori</label>
                  <input required className="w-full border rounded-lg p-3 text-sm shadow-sm" placeholder="Misal: Biaya Visite, Pembelian BMHP..." value={newRecord.category} onChange={e => setNewRecord({...newRecord, category: e.target.value})}/>
                </div>
                <div className="md:col-span-5">
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5 tracking-widest">Nominal Transaksi (Rp)</label>
                  <input required type="number" className="w-full border rounded-lg p-3 text-sm font-black text-blue-600 shadow-sm" placeholder="0" value={newRecord.amount} onChange={e => setNewRecord({...newRecord, amount: Number(e.target.value)})}/>
                </div>
                
                {newRecord.type === 'INCOME' && (
                  <>
                    <div className="md:col-span-12">
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5 tracking-widest">Pilih Pasien (Opsional)</label>
                      <select 
                        className="w-full border rounded-lg p-3 text-sm shadow-sm bg-white font-bold"
                        value={newRecord.patientId || ''}
                        onChange={e => {
                          const p = patients.find(pat => pat.id === e.target.value);
                          setNewRecord({
                            ...newRecord,
                            patientId: p?.id,
                            patientName: p?.name,
                            noRM: p?.noRM,
                            dpjp: p?.dpjpList?.[0] || newRecord.dpjp
                          });
                        }}
                      >
                        <option value="">-- TANPA PASIEN (UMUM/INSTALASI) --</option>
                        {patients.map(p => (
                          <option key={p.id} value={p.id}>{p.noRM} - {p.name} ({p.ruangan})</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5 tracking-widest">SMF / KSM Relevan</label>
                      <select className="w-full border rounded-lg p-3 text-sm shadow-sm" value={newRecord.ksm} onChange={e => setNewRecord({...newRecord, ksm: e.target.value})}>
                        <option value="">-- Pilih KSM --</option>
                        {masterData.refs.ksmList.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-5">
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5 tracking-widest">DPJP Terkait</label>
                      <select className="w-full border rounded-lg p-3 text-sm shadow-sm" value={newRecord.dpjp} onChange={e => setNewRecord({...newRecord, dpjp: e.target.value})}>
                        <option value="">-- Pilih Dokter --</option>
                        {masterData.doctors.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5 tracking-widest">Tanggal</label>
                      <input type="date" className="w-full border rounded-lg p-3 text-sm shadow-sm" value={newRecord.date} onChange={e => setNewRecord({...newRecord, date: e.target.value})}/>
                    </div>
                  </>
                )}

                {newRecord.type === 'EXPENSE' && (
                  <div className="md:col-span-12">
                     <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5 tracking-widest">Keterangan Biaya</label>
                     <textarea className="w-full border rounded-lg p-3 text-sm shadow-sm min-h-[80px]" placeholder="Deskripsikan tujuan pengeluaran..." value={newRecord.description} onChange={e => setNewRecord({...newRecord, description: e.target.value})}/>
                  </div>
                )}
                
                {newRecord.type === 'INCOME' && (
                   <div className="md:col-span-12">
                     <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5 tracking-widest">Catatan Tambahan</label>
                     <input className="w-full border rounded-lg p-3 text-sm shadow-sm" placeholder="Misal: Invoice #12345" value={newRecord.description} onChange={e => setNewRecord({...newRecord, description: e.target.value})}/>
                  </div>
                )}

                <div className="md:col-span-12 flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="px-8 rounded-full">Batal</Button>
                  <Button type="submit" className="px-10 rounded-full shadow-lg hover:scale-105 transition-transform">Simpan & Posting</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest border-b">
              <tr>
                <th className="p-5">Tanggal</th>
                <th className="p-5">Kategori & Asal KSM</th>
                <th className="p-5">DPJP / Dokter</th>
                <th className="p-5 text-right">Nominal (IDR)</th>
                <th className="p-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.sort((a,b) => b.date.localeCompare(a.date)).map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-5 font-bold text-gray-700">{r.date}</td>
                  <td className="p-5">
                    <div className="font-black text-slate-800">{r.category}</div>
                    <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">{r.ksm || '-'}</div>
                  </td>
                  <td className="p-5 text-gray-500 font-medium">{r.dpjp || '-'}</td>
                  <td className={`p-5 text-right font-black text-lg ${r.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {r.type === 'INCOME' ? '+' : '-'} {r.amount.toLocaleString('id-ID')}
                  </td>
                  <td className="p-5 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${r.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                      {r.type}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr><td colSpan={5} className="p-20 text-center text-gray-400 italic">
                  <BarChart3 className="mx-auto opacity-10 mb-2" size={48}/>
                  Tidak ada catatan keuangan ditemukan untuk filter ini.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
