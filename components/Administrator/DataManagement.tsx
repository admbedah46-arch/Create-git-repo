
import React, { useState } from 'react';
import { MasterData, User, UserRole, CustomField, DoctorCategory, QualityIndicator } from '../../types';
import { getApiUrl, saveApiUrl } from '../../db';
import { Button } from '../Button';
import { 
  Trash2, Plus, Edit2, X, Map, Activity, Database, AlertTriangle, 
  CheckCircle2, Eye, EyeOff, User as UserIcon, Settings, 
  Stethoscope, Users, Filter, LayoutGrid, ChevronRight, UserPlus,
  ClipboardCheck, Target, BarChart, Settings2, RefreshCw, Search
} from 'lucide-react';

interface DataManagementProps {
  masterData: MasterData;
  onSave: (newData: MasterData) => void;
  currentUser: User | null;
}

type Tab = 'STAFF' | 'STRUCTURE' | 'MEDICS' | 'REFS' | 'QUALITY' | 'SYSTEM';
type MedicSubTab = 'DOKTER' | 'PERAWAT';

export const DataManagement: React.FC<DataManagementProps> = ({ masterData, onSave, currentUser }) => {
  const [activeTab, setActiveTab] = useState<Tab>('STAFF');
  const [serverConfig, setServerConfig] = useState<{ hasAppsScriptUrl: boolean; appsScriptUrl: string | null }>({
    hasAppsScriptUrl: false,
    appsScriptUrl: null
  });
  const [manualApiUrl, setManualApiUrl] = useState(getApiUrl());

  React.useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setServerConfig(data))
      .catch(err => console.error('Failed to fetch config:', err));
  }, []);

  const [medicSubTab, setMedicSubTab] = useState<MedicSubTab>('DOKTER');
  const [selectedUnit, setSelectedUnit] = useState<string>(masterData.units[0] || '');
  const [selectedClassGroup, setSelectedClassGroup] = useState<string>('');
  const [selectedKsmFilter, setSelectedKsmFilter] = useState<string>('Semua Dokter');
  
  const filteredDoctors = selectedKsmFilter === 'Semua Dokter'
    ? masterData.doctors
    : masterData.doctors.filter(doc => masterData.doctorMetadata[doc]?.ksm === selectedKsmFilter);
  
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'STAFF', position: 'Perawat Assosiate', unit: currentUser?.unit || '' });
  const [editingUser, setEditingUser] = useState<{ oldUsername: string; data: Partial<User> } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ type: string, id: string, name: string, parentId?: string, subCategory?: keyof MasterData['refs'] } | null>(null);
  const [editTarget, setEditTarget] = useState<{ type: string, id: string, currentValue: string, parentId?: string, subCategory?: keyof MasterData['refs'], extra?: any, category?: DoctorCategory } | null>(null);
  const [addTarget, setAddTarget] = useState<{ type: string, label: string, parentId?: string, subCategory?: keyof MasterData['refs'] } | null>(null);

  const [isCustomFieldModalOpen, setIsCustomFieldModalOpen] = useState(false);
  const [newCustomField, setNewCustomField] = useState<Partial<CustomField>>({ type: 'TEXT' });

  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false);
  const [editingQuality, setEditingQuality] = useState<Partial<QualityIndicator> | null>(null);

  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const notify = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3000);
  };

  const handleSaveMaster = (newData: MasterData) => {
    onSave(newData);
  };

  const handleAddData = (name: string, extra?: string, category?: DoctorCategory, unit?: string) => {
    if (!addTarget || !name) return;
    const newData = JSON.parse(JSON.stringify(masterData)) as MasterData;

    switch (addTarget.type) {
      case 'UNIT':
        if (!newData.units.includes(name)) {
          newData.units.push(name);
          newData.unitToClasses[name] = [];
        }
        break;
      case 'CLASS':
        if (addTarget.parentId) {
          const list = newData.unitToClasses[addTarget.parentId] || [];
          if (!list.includes(name)) {
            list.push(name);
            newData.unitToClasses[addTarget.parentId] = list;
            newData.classToRooms[`${addTarget.parentId} - ${name}`] = [];
          }
        }
        break;
      case 'ROOM':
        if (addTarget.parentId) {
          const list = newData.classToRooms[addTarget.parentId] || [];
          if (!list.includes(name)) {
            list.push(name);
            newData.classToRooms[addTarget.parentId] = list;
            newData.roomToBeds[name] = [];
          }
        }
        break;
      case 'BED':
        if (addTarget.parentId) {
          const list = newData.roomToBeds[addTarget.parentId] || [];
          if (!list.includes(name)) {
            list.push(name);
            newData.roomToBeds[addTarget.parentId] = list;
          }
        }
        break;
      case 'DOCTOR':
        if (!newData.doctors.includes(name)) {
          newData.doctors.push(name);
          const finalKsm = extra || 'Umum';
          let finalCategory = category || 'NON_OPERATOR';
          
          if (finalKsm === 'Anestesi') finalCategory = 'ANESTHESIA';
          
          newData.doctorMetadata[name] = { 
            ksm: finalKsm,
            category: finalCategory
          };
        }
        break;
      case 'NURSE':
        if (!newData.nurses.includes(name)) {
          newData.nurses.push(name);
          newData.nurseMetadata[name] = { 
            position: extra || 'Perawat Assosiate',
            unit: unit || currentUser?.unit || ''
          };
        }
        break;
      case 'REF_ADD':
        if (addTarget.subCategory) {
          const list = newData.refs[addTarget.subCategory] as string[];
          if (!list.includes(name)) list.push(name);
        }
        break;
      case 'KSM':
        if (!newData.refs.ksmList.includes(name)) newData.refs.ksmList.push(name);
        break;
    }

    handleSaveMaster(newData);
    setAddTarget(null);
    notify("Berhasil ditambahkan.");
  };

  const handleEditReference = (newValue: string, extraVal?: string, categoryVal?: DoctorCategory, unitVal?: string) => {
    if (!editTarget || !newValue) return;
    const newData = JSON.parse(JSON.stringify(masterData)) as MasterData;

    switch (editTarget.type) {
      case 'UNIT_EDIT':
        const uIdx = newData.units.indexOf(editTarget.id);
        if (uIdx > -1) {
          newData.units[uIdx] = newValue;
          const oldClasses = newData.unitToClasses[editTarget.id] || [];
          newData.unitToClasses[newValue] = oldClasses;
          delete newData.unitToClasses[editTarget.id];
          oldClasses.forEach(cls => {
            const oldKey = `${editTarget.id} - ${cls}`;
            const newKey = `${newValue} - ${cls}`;
            newData.classToRooms[newKey] = newData.classToRooms[oldKey] || [];
            delete newData.classToRooms[oldKey];
          });
          if (selectedUnit === editTarget.id) setSelectedUnit(newValue);
        }
        break;
      case 'CLASS_EDIT':
        if (editTarget.parentId) {
          const list = newData.unitToClasses[editTarget.parentId] || [];
          const idx = list.indexOf(editTarget.id);
          if (idx > -1) {
            list[idx] = newValue;
            const oldKey = `${editTarget.parentId} - ${editTarget.id}`;
            const newKey = `${editTarget.parentId} - ${newValue}`;
            newData.classToRooms[newKey] = newData.classToRooms[oldKey] || [];
            delete newData.classToRooms[oldKey];
            if (selectedClassGroup === oldKey) setSelectedClassGroup(newKey);
          }
        }
        break;
      case 'ROOM_EDIT':
        if (editTarget.parentId) {
          const list = newData.classToRooms[editTarget.parentId] || [];
          const idx = list.indexOf(editTarget.id);
          if (idx > -1) {
            list[idx] = newValue;
            const oldBeds = newData.roomToBeds[editTarget.id] || [];
            newData.roomToBeds[newValue] = oldBeds;
            delete newData.roomToBeds[editTarget.id];
          }
        }
        break;
      case 'BED_EDIT':
        if (editTarget.parentId) {
          const list = newData.roomToBeds[editTarget.parentId] || [];
          const idx = list.indexOf(editTarget.id);
          if (idx > -1) list[idx] = newValue;
        }
        break;
      case 'DOCTOR_EDIT':
        const dIdx = newData.doctors.indexOf(editTarget.id);
        if (dIdx > -1) {
          newData.doctors[dIdx] = newValue;
          const meta = newData.doctorMetadata[editTarget.id];
          delete newData.doctorMetadata[editTarget.id];
          
          let finalCategory = categoryVal !== undefined ? categoryVal : meta.category;
          const finalKsm = extraVal || meta.ksm;
          
          if (finalKsm === 'Anestesi') finalCategory = 'ANESTHESIA';
          
          newData.doctorMetadata[newValue] = { 
            ...meta, 
            ksm: finalKsm,
            category: finalCategory 
          };
        }
        break;
      case 'NURSE_EDIT':
        const nIdx = newData.nurses.indexOf(editTarget.id);
        if (nIdx > -1) {
          newData.nurses[nIdx] = newValue;
          const meta = newData.nurseMetadata[editTarget.id];
          delete newData.nurseMetadata[editTarget.id];
          newData.nurseMetadata[newValue] = { 
            ...meta, 
            position: extraVal || meta.position,
            unit: unitVal || meta.unit
          };
        }
        break;
      case 'REF_EDIT':
        if (editTarget.subCategory) {
          const list = newData.refs[editTarget.subCategory] as string[];
          const idx = list.indexOf(editTarget.id);
          if (idx > -1) list[idx] = newValue;
        }
        break;
      case 'KSM_EDIT':
        const kIdx = newData.refs.ksmList.indexOf(editTarget.id);
        if (kIdx > -1) {
          newData.refs.ksmList[kIdx] = newValue;
          Object.keys(newData.doctorMetadata).forEach(doc => {
            if (newData.doctorMetadata[doc].ksm === editTarget.id) {
              newData.doctorMetadata[doc].ksm = newValue;
            }
          });
          if (selectedKsmFilter === editTarget.id) setSelectedKsmFilter(newValue);
        }
        break;
    }
    
    handleSaveMaster(newData);
    setEditTarget(null);
    notify("Berhasil diperbarui.");
  };

  const handleConfirmedDelete = () => {
    if (!deleteTarget) return;
    const newData = JSON.parse(JSON.stringify(masterData)) as MasterData;

    switch (deleteTarget.type) {
      case 'UNIT':
        newData.units = newData.units.filter(u => u !== deleteTarget.id);
        delete newData.unitToClasses[deleteTarget.id];
        if (selectedUnit === deleteTarget.id) setSelectedUnit('');
        break;
      case 'CLASS':
        if (deleteTarget.parentId) {
          newData.unitToClasses[deleteTarget.parentId] = (newData.unitToClasses[deleteTarget.parentId] || []).filter(c => c !== deleteTarget.id);
          delete newData.classToRooms[`${deleteTarget.parentId} - ${deleteTarget.id}`];
        }
        break;
      case 'ROOM':
        if (deleteTarget.parentId) {
          newData.classToRooms[deleteTarget.parentId] = (newData.classToRooms[deleteTarget.parentId] || []).filter(r => r !== deleteTarget.id);
          delete newData.roomToBeds[deleteTarget.id];
        }
        break;
      case 'BED':
        if (deleteTarget.parentId) {
          newData.roomToBeds[deleteTarget.parentId] = (newData.roomToBeds[deleteTarget.parentId] || []).filter(b => b !== deleteTarget.id);
        }
        break;
      case 'DOCTOR':
        newData.doctors = newData.doctors.filter(d => d !== deleteTarget.id);
        delete newData.doctorMetadata[deleteTarget.id];
        break;
      case 'NURSE':
        newData.nurses = newData.nurses.filter(n => n !== deleteTarget.id);
        delete newData.nurseMetadata[deleteTarget.id];
        break;
      case 'REF_ITEM':
        if (deleteTarget.subCategory) {
          (newData.refs as any)[deleteTarget.subCategory] = (newData.refs[deleteTarget.subCategory] as string[]).filter(i => i !== deleteTarget.id);
        }
        break;
      case 'KSM':
        newData.refs.ksmList = newData.refs.ksmList.filter(k => k !== deleteTarget.id);
        if (selectedKsmFilter === deleteTarget.id) setSelectedKsmFilter('Semua Dokter');
        break;
      case 'USER':
        newData.users = newData.users.filter(u => u.username !== deleteTarget.id);
        break;
      case 'QUALITY_INDICATOR':
        newData.qualityIndicators = (newData.qualityIndicators || []).filter(qi => qi.id !== deleteTarget.id);
        break;
    }

    handleSaveMaster(newData);
    setDeleteTarget(null);
    notify("Data telah dihapus.");
  };

  const ReferenceCard = ({ title, category, items }: { title: string, category: keyof MasterData['refs'], items: string[] }) => (
    <div className="bg-white border rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
      <div className="p-6 bg-slate-50 border-b flex justify-between items-center shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</span>
        <button onClick={() => setAddTarget({ type: 'REF_ADD', label: title, subCategory: category })} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
          <Plus size={16}/>
        </button>
      </div>
      <div className="flex-1 max-h-64 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {items.map(item => (
          <div key={item} className="group flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
            <span className="text-[11px] font-bold text-slate-600 truncate">{item}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditTarget({ type: 'REF_EDIT', id: item, currentValue: item, subCategory: category })} className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors">
                <Edit2 size={12}/>
              </button>
              <button onClick={() => setDeleteTarget({ type: 'REF_ITEM', id: item, name: item, subCategory: category })} className="p-1.5 text-red-200 hover:text-red-500 transition-colors">
                <Trash2 size={12}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const handleSaveQuality = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuality?.title) return;
    
    const newData = { ...masterData };
    if (editingQuality.id) {
        newData.qualityIndicators = (newData.qualityIndicators || []).map(qi => qi.id === editingQuality.id ? (editingQuality as QualityIndicator) : qi);
    } else {
        const newQi = { ...editingQuality, id: `qi-${Date.now()}` } as QualityIndicator;
        newData.qualityIndicators = [...(newData.qualityIndicators || []), newQi];
    }
    
    handleSaveMaster(newData);
    setIsQualityModalOpen(false);
    setEditingQuality(null);
    notify("Konfigurasi indikator disimpan.");
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border min-h-[750px] flex flex-col overflow-hidden relative">
      
      {showNotification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-8 py-4 rounded-full flex items-center gap-3 shadow-2xl border border-blue-500/50 animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-400"/>
          <span className="text-xs font-black uppercase tracking-widest">{showNotification}</span>
        </div>
      )}

      <div className="flex border-b overflow-x-auto bg-slate-50/50 shrink-0">
        {[
          { id: 'STAFF', icon: <UserIcon size={16}/>, label: 'Pengguna & Staf', roles: ['SUPER_ADMIN', 'BIDANG', 'KARU', 'SEKRU'] },
          { id: 'STRUCTURE', icon: <Map size={16}/>, label: 'Hierarki Unit', roles: ['SUPER_ADMIN', 'BIDANG'] },
          { id: 'MEDICS', icon: <Activity size={16}/>, label: 'DPJP & Medis', roles: ['SUPER_ADMIN', 'BIDANG', 'KARU', 'SEKRU'] },
          { id: 'QUALITY', icon: <ClipboardCheck size={16}/>, label: 'Kertas Kerja Mutu', roles: ['SUPER_ADMIN', 'BIDANG', 'KARU', 'PIC'] },
          { id: 'SYSTEM', icon: <Settings2 size={16}/>, label: 'Koneksi Cloud', roles: ['SUPER_ADMIN'] },
          { id: 'REFS', icon: <Database size={16}/>, label: 'Referensi & Form', roles: ['SUPER_ADMIN'] }
        ].filter(tab => tab.roles.includes(currentUser?.role || '')).map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)} 
            className={`px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] flex shrink-0 items-center gap-3 transition-all ${activeTab === tab.id ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-slate-400 hover:bg-white'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30">
        
        {activeTab === 'STAFF' && (
          <div className="p-10 space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">Manajemen Pengguna</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Kelola kredensial dan hak akses petugas ruangan.</p>
              </div>
              <div className="flex gap-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                  <input 
                    type="text" 
                    placeholder="Cari nama atau username..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:border-blue-500 outline-none w-72 shadow-sm"
                  />
                </div>
                <Button onClick={() => setIsAddUserOpen(true)} className="rounded-2xl px-10 py-4 shadow-xl shadow-blue-100 uppercase text-[10px] font-black tracking-widest">
                  <Plus size={18} className="mr-2"/> Tambah Akun
                </Button>
              </div>
            </div>
            
            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-widest border-b">
                  <tr>
                    <th className="p-8">NAMA LENGKAP</th>
                    <th className="p-8">NIP</th>
                    <th className="p-8">USERNAME</th>
                    <th className="p-8">ROLE</th>
                    <th className="p-8">RUANGAN</th>
                    <th className="p-8">POSISI</th>
                    <th className="p-8 text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const filteredUsers = masterData.users
                      .filter(u => {
                        const searchLower = userSearch.toLowerCase();
                        const matchesSearch = 
                          u.name.toLowerCase().includes(searchLower) || 
                          u.username.toLowerCase().includes(searchLower) ||
                          (u.nip && u.nip.toLowerCase().includes(searchLower)) ||
                          (u.unit && u.unit.toLowerCase().includes(searchLower));

                        if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG') return matchesSearch;
                        return u.unit === currentUser?.unit && matchesSearch;
                      })
                      .sort((a, b) => {
                        // Priority 1: Unit Grouping (Only for SUPER_ADMIN or BIDANG)
                        if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG') {
                          // Define priority for units: Admin roles with no unit/special unit to the top
                          const getUnitPriority = (unit?: string) => {
                            if (!unit || unit === 'Semua') return '000_ADMIN';
                            return unit.toLowerCase();
                          };
                          const unitA = getUnitPriority(a.unit);
                          const unitB = getUnitPriority(b.unit);
                          if (unitA !== unitB) return unitA.localeCompare(unitB);
                        }

                        // Priority 2: Role Hierarchy
                        const getRolePriority = (role: string) => {
                          const r = role.toUpperCase();
                          if (r === 'SUPER_ADMIN') return 0;
                          if (r === 'BIDANG') return 1;
                          if (r === 'KARU' || r === 'ADMIN_RUANGAN') return 2;
                          if (r === 'SEKRU') return 3;
                          if (r === 'PIC') return 4;
                          if (r === 'PPJA') return 5;
                          if (r === 'STAFF') return 6;
                          return 10;
                        };
                        
                        const pA = getRolePriority(a.role);
                        const pB = getRolePriority(b.role);
                        if (pA !== pB) return pA - pB;

                        // Priority 3: Alphabetical Name
                        return a.name.localeCompare(b.name);
                      });

                    let lastUnitLabel: string | null = null;
                    const rows: React.ReactNode[] = [];

                    filteredUsers.forEach((u, idx) => {
                      const displayUnit = u.unit || 'TIDAK TERDAFTAR RUANGAN';
                      const isSuperOrBidang = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG';
                      
                      // Add unit header if unit changes (only for SUPER_ADMIN or BIDANG)
                      if (isSuperOrBidang && u.unit !== (lastUnitLabel === 'TIDAK TERDAFTAR RUANGAN' ? undefined : lastUnitLabel)) {
                        const groupCount = filteredUsers.filter(fu => (fu.unit || 'TIDAK TERDAFTAR RUANGAN') === displayUnit).length;
                        rows.push(
                          <tr key={`header-${displayUnit}-${idx}`} className="bg-slate-100/50">
                            <td colSpan={7} className="p-4 px-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-y border-slate-200/50">
                              <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                UNIT: {displayUnit === 'Semua' ? 'ADMINISTRATOR / MANAJEMEN' : displayUnit}
                                <span className="ml-2 text-slate-300 font-bold">({groupCount} Petugas)</span>
                              </div>
                            </td>
                          </tr>
                        );
                        lastUnitLabel = u.unit || 'TIDAK TERDAFTAR RUANGAN';
                      }

                      rows.push(
                        <tr key={u.username} className="hover:bg-blue-50/20 transition-all group">
                          <td className="p-8">
                            <div className="font-black text-slate-700 text-sm tracking-tight">{u.name}</div>
                          </td>
                          <td className="p-8 text-slate-400 font-mono font-bold tracking-tight">{u.nip || '-'}</td>
                          <td className="p-8 text-slate-400 font-mono font-bold tracking-tight">{u.username}</td>
                          <td className="p-8">
                            <span className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter border ${u.role === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                              {u.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-8 text-slate-500 font-bold uppercase text-[10px]">{u.unit || '-'}</td>
                          <td className="p-8 text-slate-500 font-bold italic">{u.position}</td>
                          <td className="p-8 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || ((currentUser?.role === 'KARU' || currentUser?.role === 'SEKRU') && u.unit === currentUser?.unit)) && (
                                <>
                                  <button onClick={() => { setEditingUser({ oldUsername: u.username, data: { ...u } }); setIsEditUserOpen(true); }} className="p-3 text-blue-500 hover:bg-blue-100 rounded-2xl transition-all shadow-sm bg-white border"><Edit2 size={16}/></button>
                                  <button onClick={() => setDeleteTarget({ type: 'USER', id: u.username, name: u.name })} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all shadow-sm bg-white border"><Trash2 size={16}/></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });

                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'QUALITY' && (
          <div className="p-10 space-y-8 animate-fade-in flex flex-col h-full overflow-hidden">
             <div className="flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <ClipboardCheck className="text-blue-600" size={32}/> Kertas Kerja Indikator Mutu
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">Konfigurasi standar pengukuran, target, dan metodologi indikator mutu pelayanan.</p>
                </div>
                <Button onClick={() => { setEditingQuality({ unit: '%', frequency: 'MONTHLY', category: 'INM' }); setIsQualityModalOpen(true); }} className="rounded-2xl px-10 py-4 shadow-xl shadow-blue-100 uppercase text-[10px] font-black tracking-widest bg-blue-600 text-white">
                  <Plus size={18} className="mr-2"/> Tambah Indikator
                </Button>
              </div>

              <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                   <table className="w-full text-xs text-left">
                     <thead className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-widest border-b sticky top-0 z-10">
                        <tr>
                           <th className="p-8">JUDUL INDIKATOR</th>
                           <th className="p-8">NUMERATOR / DENOMINATOR</th>
                           <th className="p-8 text-center">TARGET</th>
                           <th className="p-8">FREKUENSI</th>
                           <th className="p-8 text-right">AKSI</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {(masterData.qualityIndicators || []).map(qi => (
                          <tr key={qi.id} className="hover:bg-blue-50/20 transition-all group">
                             <td className="p-8">
                                <div className="font-black text-slate-700 text-sm tracking-tight">{qi.title}</div>
                                <span className="px-3 py-1 bg-slate-100 text-[8px] font-black text-slate-500 rounded-full border mt-2 inline-block">{qi.category}</span>
                             </td>
                             <td className="p-8 max-w-md">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Num: <span className="text-slate-600 normal-case">{qi.numerator}</span></div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Den: <span className="text-slate-600 normal-case">{qi.denominator}</span></div>
                             </td>
                             <td className="p-8 text-center">
                                <div className="inline-flex flex-col items-center">
                                   <div className="text-xl font-black text-blue-600 tracking-tighter">{qi.target}{qi.unit === '%' ? '%' : ''}</div>
                                   <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">MINIMUM</span>
                                </div>
                             </td>
                             <td className="p-8">
                                <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-blue-100">
                                   {qi.frequency}
                                </span>
                             </td>
                             <td className="p-8 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                   <button onClick={() => { setEditingQuality(qi); setIsQualityModalOpen(true); }} className="p-3 text-blue-500 hover:bg-blue-100 rounded-2xl transition-all shadow-sm bg-white border"><Edit2 size={16}/></button>
                                   <button onClick={() => setDeleteTarget({ type: 'QUALITY_INDICATOR', id: qi.id, name: qi.title })} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all shadow-sm bg-white border"><Trash2 size={16}/></button>
                                </div>
                             </td>
                          </tr>
                        ))}
                     </tbody>
                   </table>
                </div>
              </div>
          </div>
        )}

        {activeTab === 'SYSTEM' && (
          <div className="p-10 space-y-8 animate-fade-in flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center shrink-0">
               <div>
                 <h3 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                   <RefreshCw className={`text-emerald-600 ${serverConfig.hasAppsScriptUrl ? 'animate-spin-slow' : ''}`} size={32}/> Koneksi Cloud Spreadsheet
                 </h3>
                 <p className="text-xs text-slate-400 font-medium mt-1">Integrasikan database aplikasi dengan Drive Anda menggunakan Google Apps Script secara gratis.</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2rem] border shadow-sm space-y-6">
                <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Status Koneksi</h4>
                
                {serverConfig.hasAppsScriptUrl ? (
                  <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                        <Database size={24}/>
                    </div>
                    <div>
                        <div className="text-xs font-black text-emerald-800 uppercase tracking-widest">Google Apps Script</div>
                        <div className="text-[10px] text-emerald-600 font-bold">Terhubung & Siap Sinkronisasi</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200">
                        <AlertTriangle size={24}/>
                    </div>
                    <div>
                        <div className="text-xs font-black text-amber-800 uppercase tracking-widest">Belum Terkonfigurasi</div>
                        <div className="text-[10px] text-amber-600 font-bold">Ikuti panduan untuk menghubungkan</div>
                    </div>
                  </div>
                )}
                
                 <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Web App Deployment URL</label>
                    <div className="relative">
                      <Map size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        className="w-full bg-white border border-slate-200 rounded-2xl px-12 py-4 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={manualApiUrl}
                        onChange={(e) => setManualApiUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        saveApiUrl(manualApiUrl);
                        notify("URL Tersimpan di Browser!");
                      }}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase rounded-2xl"
                    >
                      Simpan URL Lokal
                    </Button>
                    <Button 
                      variant="ghost"
                      onClick={() => window.open(manualApiUrl, '_blank')}
                      disabled={!manualApiUrl}
                      className="p-3 text-blue-500 rounded-2xl"
                    >
                      Tes Link
                    </Button>
                  </div>

                  <div className="space-y-1.5 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest pl-1 flex items-center gap-2">
                       Akses Publik (Shared Link)
                    </label>
                    <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">Gunakan link ini untuk dibagikan ke rekan kerja.</p>
                    <div className="flex gap-2">
                       <input 
                          type="text" 
                          readOnly
                          className="flex-1 bg-white border border-blue-100 rounded-xl px-4 py-2 text-[10px] font-mono text-blue-500 outline-none"
                          value="https://ais-pre-5yx5np5byvmf4dw3uf7moi-256092545608.asia-southeast1.run.app"
                        />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText("https://ais-pre-5yx5np5byvmf4dw3uf7moi-256092545608.asia-southeast1.run.app");
                            notify("Link disalin!");
                          }}
                          className="px-4 py-2 bg-blue-600 text-white text-[9px] font-black uppercase rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          Salin
                        </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 italic">
                    {serverConfig.hasAppsScriptUrl 
                      ? 'Koneksi aktif. Data akan otomatis tersimpan ke Google Sheets.' 
                      : 'Buka Menu Settings (ikon gir) di AI Studio, tambahkan variabel VITE_APPS_SCRIPT_URL.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-50">
                   <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm('Hapus cache data lokal? (Data di Spreadsheet tetap aman)')) {
                        localStorage.removeItem('si_baru_db_stable_production_v5');
                        window.location.reload();
                      }
                    }}
                    className="text-red-400 hover:text-red-500 hover:bg-red-50"
                   >
                     Clear Local Cache & Refresh
                   </Button>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                 <h4 className="text-lg font-black text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                    <ClipboardCheck className="text-blue-400"/> Panduan Integrasi
                 </h4>
                 <div className="space-y-4 relative z-10">
                    {[
                      "Buka Google Sheets & buat spreadsheet baru.",
                      "Klik Extensions > Apps Script.",
                      "Salin kode dari file GOOGLE_APPS_SCRIPT.js.",
                      "Deploy sebagai Web App (Who has access: Anyone).",
                      "Tempel URL ke Settings > VITE_APPS_SCRIPT_URL."
                    ].map((step, i) => (
                      <div key={i} className="flex gap-4">
                         <div className="w-6 h-6 shrink-0 bg-white/10 rounded-lg flex items-center justify-center text-[10px] font-black">{i+1}</div>
                         <p className="text-xs text-slate-300 font-medium leading-relaxed">{step}</p>
                      </div>
                    ))}
                 </div>
                 
                 <div className="pt-6 space-y-3">
                   <Button 
                    onClick={async () => {
                      try {
                        const response = await fetch('/GOOGLE_APPS_SCRIPT.js');
                        const code = await response.text();
                        await navigator.clipboard.writeText(code);
                        notify("Kode berhasil disalin!");
                      } catch (err) {
                        notify("Gagal menyalin kode.");
                      }
                    }}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-900/40"
                   >
                      Salin Kode Script (.js)
                   </Button>
                   
                   <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Penting:</p>
                      <p className="text-[9px] text-slate-500 leading-normal">
                        Pastikan tab pertama di spreadsheet Anda bernama <span className="text-white font-black">"DB"</span> agar skrip dapat menyimpan data dengan benar.
                      </p>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* Other existing tabs (STRUCTURE, MEDICS, REFS, STAFF) remain unchanged... */}
        {activeTab === 'STRUCTURE' && (
          <div className="p-10 h-full flex flex-col animate-fade-in overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-1 min-h-0">
              <div className="bg-white border rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest">1. Unit Pelayanan</span>
                  <button onClick={() => setAddTarget({ type: 'UNIT', label: 'Unit Baru' })} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><Plus size={16}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                  {masterData.units.map(unit => (
                    <div key={unit} onClick={() => { setSelectedUnit(unit); setSelectedClassGroup(''); }} className={`group flex items-center justify-between p-5 rounded-2xl transition-all cursor-pointer ${selectedUnit === unit ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-600'}`}>
                      <span className="text-xs font-bold truncate">{unit}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={(e) => { e.stopPropagation(); setEditTarget({ type: 'UNIT_EDIT', id: unit, currentValue: unit }); }} className="p-1.5 hover:bg-white/20 rounded-lg"><Edit2 size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'UNIT', id: unit, name: unit }); }} className="p-1.5 hover:bg-white/20 rounded-lg"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
                <div className="p-6 bg-slate-800 text-white flex justify-between items-center shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest">2. Kelompok Kelas</span>
                  {selectedUnit && (
                    <button onClick={() => setAddTarget({ type: 'CLASS', label: `Kelas di ${selectedUnit}`, parentId: selectedUnit })} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><Plus size={16}/></button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                  {selectedUnit ? (masterData.unitToClasses[selectedUnit] || []).map(cls => (
                    <div key={cls} onClick={() => setSelectedClassGroup(`${selectedUnit} - ${cls}`)} className={`group flex items-center justify-between p-5 rounded-2xl transition-all cursor-pointer ${selectedClassGroup === `${selectedUnit} - ${cls}` ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`}>
                      <span className="text-xs font-bold truncate">{cls}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={(e) => { e.stopPropagation(); setEditTarget({ type: 'CLASS_EDIT', id: cls, currentValue: cls, parentId: selectedUnit }); }} className="p-1.5 hover:bg-white/20 rounded-lg"><Edit2 size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'CLASS', id: cls, name: cls, parentId: selectedUnit }); }} className="p-1.5 hover:bg-white/20 rounded-lg"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  )) : <div className="h-full flex items-center justify-center text-[10px] font-black uppercase text-slate-300 tracking-widest">Pilih Unit Terlebih Dahulu</div>}
                </div>
              </div>
              <div className="bg-white border rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
                <div className="p-6 bg-slate-700 text-white flex justify-between items-center shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest">3. Ruangan & Bed</span>
                  {selectedClassGroup && (
                    <button onClick={() => setAddTarget({ type: 'ROOM', label: `Ruang di ${selectedClassGroup}`, parentId: selectedClassGroup })} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><Plus size={16}/></button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {selectedClassGroup ? (masterData.classToRooms[selectedClassGroup] || []).map(room => (
                    <div key={room} className="bg-slate-50/50 rounded-2xl border-2 border-slate-50 overflow-hidden group/room">
                      <div className="px-5 py-4 bg-white border-b flex justify-between items-center">
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{room}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setAddTarget({ type: 'BED', label: `Bed di ${room}`, parentId: room })} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Plus size={16}/></button>
                          <button onClick={() => setEditTarget({ type: 'ROOM_EDIT', id: room, currentValue: room, parentId: selectedClassGroup })} className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg"><Edit2 size={14}/></button>
                          <button onClick={() => setDeleteTarget({ type: 'ROOM', id: room, name: room, parentId: selectedClassGroup })} className="p-1.5 text-red-300 hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
                        </div>
                      </div>
                      <div className="p-5 grid grid-cols-4 gap-3">
                        {(masterData.roomToBeds[room] || []).map(bed => (
                          <div key={bed} className="relative bg-white border rounded-xl py-3 text-center text-[9px] font-black text-slate-400 group/bed hover:border-blue-200 transition-all">
                            {bed}
                            <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 opacity-0 group-hover/bed:opacity-100 transition-opacity">
                              <button onClick={() => setEditTarget({ type: 'BED_EDIT', id: bed, currentValue: bed, parentId: room })} className="bg-blue-500 text-white rounded-full p-1 shadow-sm"><Edit2 size={8}/></button>
                              <button onClick={() => setDeleteTarget({ type: 'BED', id: bed, name: bed, parentId: room })} className="bg-red-500 text-white rounded-full p-1 shadow-sm"><X size={8}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )) : <div className="h-full flex items-center justify-center text-[10px] font-black uppercase text-slate-300 tracking-widest">Pilih Kelompok Kelas</div>}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'MEDICS' && (
          <div className="flex-1 flex flex-col p-10 gap-8 animate-fade-in overflow-hidden">
            <div className="flex bg-white p-1 rounded-2xl border shadow-sm w-fit shrink-0">
              <button onClick={() => setMedicSubTab('DOKTER')} className={`px-12 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${medicSubTab === 'DOKTER' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}>
                <Stethoscope size={20}/> Dokter (DPJP)
              </button>
              <button onClick={() => setMedicSubTab('PERAWAT')} className={`px-12 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${medicSubTab === 'PERAWAT' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}>
                <Users size={20}/> Perawat Ruangan
              </button>
            </div>
            <div className="flex-1 flex gap-8 overflow-hidden">
              {medicSubTab === 'DOKTER' && (
                <div className="w-72 bg-white border rounded-[2rem] shadow-sm flex flex-col shrink-0 overflow-hidden">
                  <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                      <Filter size={16} className="text-blue-500"/> Filter SMF / KSM
                    </span>
                    <button onClick={() => setAddTarget({ type: 'KSM', label: 'KSM Baru' })} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-all"><Plus size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    <button onClick={() => setSelectedKsmFilter('Semua Dokter')} className={`w-full text-left px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-tighter transition-all ${selectedKsmFilter === 'Semua Dokter' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>Semua Dokter</button>
                    {masterData.refs.ksmList.map(ksm => (
                      <div key={ksm} className="group relative">
                        <button onClick={() => setSelectedKsmFilter(ksm)} className={`w-full text-left px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-tighter transition-all ${selectedKsmFilter === ksm ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>{ksm}</button>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={(e) => { e.stopPropagation(); setEditTarget({ type: 'KSM_EDIT', id: ksm, currentValue: ksm }); }} className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors"><Edit2 size={12}/></button>
                           <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'KSM', id: ksm, name: ksm }); }} className="p-1.5 text-red-200 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-1 bg-white border rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
                <div className="p-8 border-b flex justify-between items-center bg-white">
                  <div className="flex items-center gap-4">
                    <h3 className="font-black text-slate-800 text-2xl tracking-tight">
                      {medicSubTab === 'DOKTER' ? 'Daftar Dokter (DPJP)' : 'Daftar Perawat Ruangan'}
                    </h3>
                    <div className="bg-blue-50 text-blue-600 text-[10px] font-black px-5 py-2 rounded-full border border-blue-100 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      {medicSubTab === 'DOKTER' ? filteredDoctors.length : masterData.nurses.filter(n => {
                        if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG') return true;
                        return masterData.nurseMetadata[n]?.unit === currentUser?.unit;
                      }).length} Total
                    </div>
                  </div>
                  <Button 
                    onClick={() => setAddTarget({ type: medicSubTab === 'DOKTER' ? 'DOCTOR' : 'NURSE', label: medicSubTab === 'DOKTER' ? 'Dokter Baru' : 'Perawat Baru' })} 
                    className="rounded-2xl px-12 py-4 shadow-xl shadow-blue-100 uppercase text-[10px] font-black tracking-widest"
                  >
                    <Plus size={20} className="mr-2"/> {medicSubTab === 'DOKTER' ? 'Tambah Dokter' : 'Tambah Perawat'}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b sticky top-0 z-10">
                      <tr>
                        <th className="p-8">{medicSubTab === 'DOKTER' ? 'NAMA DOKTER' : 'NAMA PERAWAT'}</th>
                        <th className="p-8">{medicSubTab === 'DOKTER' ? 'KSM / PERAN KLINIS' : 'POSISI / UNIT'}</th>
                        <th className="p-8 text-right">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(medicSubTab === 'DOKTER' ? filteredDoctors : masterData.nurses.filter(n => {
                        if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG') return true;
                        return masterData.nurseMetadata[n]?.unit === currentUser?.unit;
                      })).map(person => (
                        <tr key={person} className="hover:bg-blue-50/20 transition-all group">
                          <td className="p-8 font-black text-slate-700 text-sm tracking-tight">{person}</td>
                          <td className="p-8">
                            <div className="flex flex-wrap gap-2">
                              <span className="px-6 py-2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter border border-blue-100">
                                {medicSubTab === 'DOKTER' ? (masterData.doctorMetadata[person]?.ksm || 'UMUM') : (masterData.nurseMetadata[person]?.position || 'PERAWAT ASSOSIATE')}
                              </span>
                              {medicSubTab === 'PERAWAT' && (
                                <span className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-tighter border border-emerald-100">
                                  {masterData.nurseMetadata[person]?.unit || '-'}
                                </span>
                              )}
                              {medicSubTab === 'DOKTER' && (
                                <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter border ${
                                  masterData.doctorMetadata[person]?.category === 'OPERATOR' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                  masterData.doctorMetadata[person]?.category === 'ANESTHESIA' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                  'bg-slate-50 text-slate-400 border-slate-100'
                                }`}>
                                  {masterData.doctorMetadata[person]?.category === 'OPERATOR' ? 'OPERATOR TINDAKAN' : 
                                   masterData.doctorMetadata[person]?.category === 'ANESTHESIA' ? 'ANESTESI TINDAKAN' :
                                   'BUKAN OPERATOR'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-8 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => setEditTarget({ 
                                type: medicSubTab === 'DOKTER' ? 'DOCTOR_EDIT' : 'NURSE_EDIT', 
                                id: person, 
                                currentValue: person,
                                extra: medicSubTab === 'DOKTER' ? masterData.doctorMetadata[person]?.ksm : masterData.nurseMetadata[person]?.position,
                                category: medicSubTab === 'DOKTER' ? masterData.doctorMetadata[person]?.category : undefined
                              })} className="p-3 text-blue-500 hover:bg-blue-100 rounded-2xl transition-all shadow-sm bg-white border"><Edit2 size={16}/></button>
                              <button onClick={() => setDeleteTarget({ type: medicSubTab === 'DOKTER' ? 'DOCTOR' : 'NURSE', id: person, name: person })} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all shadow-sm bg-white border"><Trash2 size={16}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'REFS' && (
          <div className="p-10 animate-fade-in overflow-y-auto custom-scrollbar space-y-12">
            <section className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <LayoutGrid size={24} className="text-indigo-600"/> Manajemen Kolom Form Pasien
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-1">Tambahkan kolom input dinamis yang akan muncul pada form registrasi pasien.</p>
                </div>
                <Button onClick={() => setIsCustomFieldModalOpen(true)} className="rounded-2xl px-8 py-3.5 shadow-xl shadow-indigo-100 uppercase text-[10px] font-black tracking-widest bg-indigo-600 text-white">
                  <Plus size={18} className="mr-2"/> Tambah Kolom Baru
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(masterData.customFields || []).map(field => (
                  <div key={field.id} className="bg-white p-6 rounded-[1.5rem] border shadow-sm group hover:border-indigo-200 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${field.type === 'TEXT' ? 'bg-slate-50 text-slate-500 border-slate-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                          {field.type === 'TEXT' ? 'Input Manual' : 'Pilihan Dropdown'}
                        </span>
                        <button onClick={() => {
                           const newData = { ...masterData };
                           newData.customFields = newData.customFields.filter(f => f.id !== field.id);
                           handleSaveMaster(newData);
                           notify("Kolom kustom dihapus.");
                        }} className="text-red-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                      <h5 className="font-black text-slate-800 text-sm uppercase tracking-tight">{field.label}</h5>
                      {field.type === 'SELECT' && <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">SUMBER: {field.refCategory}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="space-y-6">
              <h4 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <Database size={24} className="text-blue-600"/> Master Data Referensi
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                <ReferenceCard title="Asal Masuk" category="asalMasuk" items={masterData.refs.asalMasuk} />
                <ReferenceCard title="Cara Bayar" category="caraBayar" items={masterData.refs.caraBayar} />
                <ReferenceCard title="Status Jaminan" category="statusTanggungan" items={masterData.refs.statusTanggungan} />
                <ReferenceCard title="Status SEP" category="statusSep" items={masterData.refs.statusSep} />
                <ReferenceCard title="Jenis KLL" category="jenisKll" items={masterData.refs.jenisKll} />
                <ReferenceCard title="Status Data Pasien" category="statusDataPasien" items={masterData.refs.statusDataPasien} />
                <ReferenceCard title="Cara Keluar" category="caraKeluar" items={masterData.refs.caraKeluar} />
                <ReferenceCard title="Jabatan Staf" category="positions" items={masterData.refs.positions} />
              </div>
            </section>
          </div>
        )}
      </div>

      {isQualityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-2xl shadow-2xl animate-fade-in border-t-8 border-blue-600 max-h-[90vh] overflow-y-auto custom-scrollbar">
             <h3 className="font-black text-2xl mb-8 text-slate-800 tracking-tight flex items-center gap-3">
                <Target className="text-blue-600" size={28}/> Definisi Indikator Mutu
             </h3>
             <form onSubmit={handleSaveQuality} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Judul Indikator</label>
                   <input required className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 outline-none" placeholder="Masukkan judul..." value={editingQuality?.title || ''} onChange={e => setEditingQuality({...editingQuality!, title: e.target.value})}/>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kategori</label>
                   <select className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 outline-none bg-white" value={editingQuality?.category || 'INM'} onChange={e => setEditingQuality({...editingQuality!, category: e.target.value})}>
                      <option value="INM">Indikator Mutu Nasional (INM)</option>
                      <option value="IMP">Indikator Mutu Prioritas (IMP)</option>
                      <option value="IMU">Indikator Mutu Unit (IMU)</option>
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Frekuensi Laporan</label>
                   <select className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 outline-none bg-white" value={editingQuality?.frequency || 'MONTHLY'} onChange={e => setEditingQuality({...editingQuality!, frequency: e.target.value as any})}>
                      <option value="DAILY">Harian</option>
                      <option value="WEEKLY">Mingguan</option>
                      <option value="MONTHLY">Bulanan</option>
                   </select>
                </div>
                <div className="col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Numerator (Pembilang)</label>
                   <textarea required className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 outline-none min-h-[80px]" placeholder="Definisi teknis numerator..." value={editingQuality?.numerator || ''} onChange={e => setEditingQuality({...editingQuality!, numerator: e.target.value})}/>
                </div>
                <div className="col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Denominator (Penyebut)</label>
                   <textarea required className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 outline-none min-h-[80px]" placeholder="Definisi teknis denominator..." value={editingQuality?.denominator || ''} onChange={e => setEditingQuality({...editingQuality!, denominator: e.target.value})}/>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Performance</label>
                   <div className="flex items-center gap-3">
                      <input required type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-black text-blue-600 focus:border-blue-500 outline-none" placeholder="0" value={editingQuality?.target || 0} onChange={e => setEditingQuality({...editingQuality!, target: Number(e.target.value)})}/>
                      <select className="border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 outline-none bg-white" value={editingQuality?.unit || '%'} onChange={e => setEditingQuality({...editingQuality!, unit: e.target.value as any})}>
                         <option value="%">%</option>
                         <option value="Number">Angka</option>
                      </select>
                   </div>
                </div>
                <div className="col-span-2 pt-8 flex gap-4 border-t">
                  <Button type="button" variant="ghost" className="flex-1 font-bold py-4 rounded-2xl" onClick={() => setIsQualityModalOpen(false)}>Batal</Button>
                  <Button type="submit" className="flex-[2] rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-100 py-4 bg-blue-600 text-white">Simpan Konfigurasi</Button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-sm shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8"><AlertTriangle size={40}/></div>
            <h3 className="font-black text-2xl mb-2 text-center text-slate-800">Konfirmasi Hapus</h3>
            <p className="text-sm text-slate-400 text-center mb-10 leading-relaxed font-medium">Hapus <b className="text-slate-800">"{deleteTarget.name}"</b>? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex flex-col gap-3">
              <Button variant="danger" className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest" onClick={handleConfirmedDelete}>Ya, Hapus Sekarang</Button>
              <Button variant="ghost" className="w-full py-4 font-bold text-slate-400" onClick={() => setDeleteTarget(null)}>Batalkan</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {(isAddUserOpen || isEditUserOpen) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <h3 className="font-black text-3xl text-slate-800 tracking-tight flex items-center gap-4">
                {isEditUserOpen ? <Settings className="text-blue-600" size={32}/> : <Plus className="text-blue-600" size={32}/>}
                {isEditUserOpen ? 'Pengaturan Akun' : 'Daftarkan Akun Baru'}
              </h3>
              <button onClick={() => { setIsAddUserOpen(false); setIsEditUserOpen(false); }} className="text-slate-400 hover:text-slate-600 transition-colors p-2"><X size={32}/></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              
              const uData = isEditUserOpen ? editingUser?.data : newUser;
              if (!uData.username || !uData.name) return;

              const otherUsers = isEditUserOpen 
                ? masterData.users.filter(u => u.username !== editingUser?.oldUsername)
                : masterData.users;

              // Validation 1: Username
              if (otherUsers.some(u => u.username.toLowerCase() === uData.username?.toLowerCase())) {
                notify("Username sama dengan staf lain");
                return;
              }

              // Validation 2: Identical Name, NIP, and Room
              if (otherUsers.some(u => 
                u.name.toLowerCase() === uData.name?.toLowerCase() && 
                (u.nip || '') === (uData.nip || '') && 
                (u.unit || '') === (uData.unit || '')
              )) {
                notify("User sudah ditambahkan");
                return;
              }

              const newData = JSON.parse(JSON.stringify(masterData)) as MasterData;
              if (isEditUserOpen && editingUser) {
                const idx = newData.users.findIndex(u => u.username === editingUser.oldUsername);
                if (idx > -1) newData.users[idx] = editingUser.data as User;
              } else {
                newData.users.push(newUser as User);
              }
              handleSaveMaster(newData);
              setIsAddUserOpen(false);
              setIsEditUserOpen(false);
              notify("Akun pengguna diperbarui.");
            }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nama Lengkap</label>
                <input required className="w-full border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500" value={isEditUserOpen ? editingUser?.data.name : newUser.name} onChange={e => isEditUserOpen ? setEditingUser({...editingUser!, data: {...editingUser!.data, name: e.target.value}}) : setNewUser({...newUser, name: e.target.value})}/>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">NIP (Opsional)</label>
                <input className="w-full border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500" value={isEditUserOpen ? editingUser?.data.nip : newUser.nip} onChange={e => isEditUserOpen ? setEditingUser({...editingUser!, data: {...editingUser!.data, nip: e.target.value}}) : setNewUser({...newUser, nip: e.target.value})}/>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Username</label>
                <input required className="w-full border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500" value={isEditUserOpen ? editingUser?.data.username : newUser.username} onChange={e => { const v = e.target.value.toLowerCase().replace(/\s/g, ''); isEditUserOpen ? setEditingUser({...editingUser!, data: {...editingUser!.data, username: v}}) : setNewUser({...newUser, username: v}); }}/>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Password</label>
                <div className="relative">
                  <input required type={showPassword ? 'text' : 'password'} className="w-full border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500" value={isEditUserOpen ? editingUser?.data.password : newUser.password} onChange={e => isEditUserOpen ? setEditingUser({...editingUser!, data: {...editingUser!.data, password: e.target.value}}) : setNewUser({...newUser, password: e.target.value})}/>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500">{showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Role Akses</label>
                <select className="w-full border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500 bg-white" value={isEditUserOpen ? editingUser?.data.role : newUser.role} onChange={e => isEditUserOpen ? setEditingUser({...editingUser!, data: {...editingUser!.data, role: e.target.value as UserRole}}) : setNewUser({...newUser, role: e.target.value as UserRole})}>
                  <option value="STAFF">STAFF</option>
                  <option value="PPJA">PPJA</option>
                  <option value="PIC">PIC</option>
                  <option value="SEKRU">SEKRU</option>
                  <option value="KARU">KARU</option>
                  <option value="ADMIN_RUANGAN">ADMIN RUANGAN</option>
                  <option value="BIDANG">BIDANG</option>
                  <option value="SUPER_ADMIN">SUPER ADMIN</option>
                </select>
              </div>
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unit / Ruangan</label>
                 <select className="w-full border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500 bg-white" value={isEditUserOpen ? editingUser?.data.unit : newUser.unit} onChange={e => isEditUserOpen ? setEditingUser({...editingUser!, data: {...editingUser!.data, unit: e.target.value}}) : setNewUser({...newUser, unit: e.target.value})}>
                    <option value="">Pilih Unit</option>
                    {masterData.units.map(u => <option key={u} value={u}>{u}</option>)}
                 </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Posisi Staf</label>
                <select className="w-full border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500 bg-white" value={isEditUserOpen ? editingUser?.data.position : newUser.position} onChange={e => isEditUserOpen ? setEditingUser({...editingUser!, data: {...editingUser!.data, position: e.target.value}}) : setNewUser({...newUser, position: e.target.value})}>
                  {masterData.refs.positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-span-2 pt-8 flex gap-4">
                <Button variant="ghost" className="flex-1 font-bold py-4 rounded-2xl" onClick={() => { setIsAddUserOpen(false); setIsEditUserOpen(false); }}>Batal</Button>
                <Button type="submit" className="flex-[2] rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-100 py-4">{isEditUserOpen ? 'Perbarui Akun' : 'Aktifkan Akun'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Other generic add/edit modals (UNIT, CLASS, ROOM, BED, DOCTOR, NURSE, etc.) follow the same pattern... */}
      {addTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-md shadow-2xl animate-fade-in border-t-8 border-blue-600 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-black text-2xl mb-8 text-slate-800 tracking-tight">Tambah {addTarget.label}</h3>
            <div className="space-y-6">
               <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nama Baru</label>
                <input autoFocus id="add-data-input" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 outline-none" placeholder={`Masukkan nama...`}/>
               </div>
               {addTarget.type === 'DOCTOR' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pilih KSM (SMF)</label>
                    <select id="add-data-extra" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 bg-white outline-none">
                      {masterData.refs.ksmList.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kategori Tindakan</label>
                    <select id="add-data-category" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 bg-white outline-none">
                      <option value="OPERATOR">Operator Tindakan</option>
                      <option value="ANESTHESIA">Anestesi Tindakan</option>
                      <option value="NON_OPERATOR">Bukan Operator Tindakan</option>
                    </select>
                  </div>
                </>
               )}
               {addTarget.type === 'NURSE' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Posisi / Jabatan</label>
                    <select id="add-data-extra" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 bg-white outline-none">
                      {masterData.refs.positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unit Ruangan</label>
                    <select id="add-data-unit" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 bg-white outline-none" defaultValue={currentUser?.unit || ''}>
                      {masterData.units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </>
               )}
            </div>
            <div className="flex justify-end gap-3 mt-10">
              <Button variant="ghost" className="font-bold px-8 rounded-xl" onClick={() => setAddTarget(null)}>Batal</Button>
              <Button className="px-10 rounded-2xl shadow-lg bg-blue-600 text-white" onClick={() => {
                const name = (document.getElementById('add-data-input') as HTMLInputElement).value;
                const extra = (document.getElementById('add-data-extra') as HTMLSelectElement)?.value;
                const category = (document.getElementById('add-data-category') as HTMLSelectElement)?.value as DoctorCategory;
                const unit = (document.getElementById('add-data-unit') as HTMLSelectElement)?.value;
                handleAddData(name, extra, category, unit);
              }}>Simpan Data</Button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-md shadow-2xl animate-fade-in border-t-8 border-blue-600 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-black text-2xl mb-8 text-slate-800 tracking-tight">Edit Data</h3>
            <div className="space-y-6">
               <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nama</label>
                <input autoFocus id="edit-data-input" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 outline-none" defaultValue={editTarget.currentValue}/>
               </div>
               {(editTarget.type === 'DOCTOR_EDIT') && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">SMF / KSM</label>
                    <select id="edit-data-extra" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 bg-white outline-none" defaultValue={editTarget.extra}>
                      {masterData.refs.ksmList.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kategori</label>
                    <select id="edit-data-category" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 bg-white outline-none" defaultValue={editTarget.category}>
                      <option value="OPERATOR">Operator Tindakan</option>
                      <option value="ANESTHESIA">Anestesi Tindakan</option>
                      <option value="NON_OPERATOR">Bukan Operator Tindakan</option>
                    </select>
                  </div>
                </>
               )}
               {(editTarget.type === 'NURSE_EDIT') && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Posisi</label>
                    <select id="edit-data-extra" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 bg-white outline-none" defaultValue={editTarget.extra}>
                      {masterData.refs.positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unit Ruangan</label>
                    <select id="edit-data-unit" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 bg-white outline-none" defaultValue={masterData.nurseMetadata[editTarget.id]?.unit}>
                      {masterData.units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </>
               )}
            </div>
            <div className="flex justify-end gap-3 mt-10">
              <Button variant="ghost" className="font-bold px-8 rounded-xl" onClick={() => setEditTarget(null)}>Batal</Button>
              <Button className="px-10 rounded-2xl shadow-lg bg-blue-600 text-white" onClick={() => {
                const name = (document.getElementById('edit-data-input') as HTMLInputElement).value;
                const extra = (document.getElementById('edit-data-extra') as HTMLSelectElement)?.value;
                const category = (document.getElementById('edit-data-category') as HTMLSelectElement)?.value as DoctorCategory;
                const unit = (document.getElementById('edit-data-unit') as HTMLSelectElement)?.value;
                handleEditReference(name, extra, category, unit);
              }}>Simpan Perubahan</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
