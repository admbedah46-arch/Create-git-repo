import React, { Component, useState, useMemo } from 'react';
import { RoomBooking, AppData, User } from '../../types';
import { generatePermanentUUID } from '../../db';
import { Calendar, Plus, Search, CheckCircle2, XCircle, Trash2, UserCheck, Clock, Building2, Filter, AlertCircle, RefreshCw } from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';

interface RoomBookingProps {
  appData?: AppData;
  currentUser?: User | null;
  onSaveBooking?: (booking: RoomBooking) => void;
  onUpdateBookingStatus?: (bookingId: string, status: 'PENDING' | 'CHECKED_IN' | 'CANCELLED') => void;
  onDeleteBooking?: (bookingId: string) => void;
  onCheckInToRegistration?: (booking: RoomBooking) => void;
  // Legacy / alternate prop aliases passed from various routing paths
  bookings?: RoomBooking[];
  masterData?: any;
  onUpdateStatus?: (bookingId: string, status: 'PENDING' | 'CHECKED_IN' | 'CANCELLED') => void;
}

interface RoomBookingErrorBoundaryProps {
  children: React.ReactNode;
}

interface RoomBookingErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Internal Error Boundary to prevent whitescreen crashes
class RoomBookingErrorBoundary extends Component<any, any> {
  state: any;
  props: any;
  setState: any;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('RoomBookingComponent Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-[2.5rem] shadow-lg text-center space-y-4 my-6">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-black text-rose-900 uppercase">Gagal Memuat Menu Booking Ruangan</h3>
          <p className="text-xs font-semibold text-rose-700 max-w-md mx-auto">
            Terjadi kendala saat memuat data booking. Sistem telah memproteksi tampilan agar tidak crash.
          </p>
          <div className="text-[10px] font-mono bg-rose-100/60 p-3 rounded-xl text-rose-800 text-left max-w-lg mx-auto overflow-x-auto">
            {this.state.error?.toString()}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} /> Coba Muat Ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const RoomBookingInner: React.FC<RoomBookingProps> = ({
  appData,
  currentUser,
  onSaveBooking,
  onUpdateBookingStatus,
  onDeleteBooking,
  onCheckInToRegistration,
  bookings,
  masterData,
  onUpdateStatus
}) => {
  const todayStr = new Date().toLocaleDateString('en-CA');
  
  // Safe normalization of data & props
  const safeMasterData = appData?.masterData || masterData || {};
  const safeBookings = Array.isArray(appData?.roomBookings)
    ? appData.roomBookings
    : (Array.isArray(bookings) ? bookings : []);

  const safeOnSaveBooking = onSaveBooking || (() => {});
  const safeOnUpdateStatus = onUpdateBookingStatus || onUpdateStatus || (() => {});
  const safeOnDeleteBooking = onDeleteBooking || (() => {});
  const safeOnCheckInToRegistration = onCheckInToRegistration || (() => {});

  // Form State
  const [patientName, setPatientName] = useState('');
  const [noRM, setNoRM] = useState('');
  const [bookingDate, setBookingDate] = useState(todayStr);
  const [bookingTime, setBookingTime] = useState('08:00');
  const [plannedRoom, setPlannedRoom] = useState('');
  const [patientStatusCategory, setPatientStatusCategory] = useState<'Di Rumah' | 'IGD' | 'HD' | 'Poliklinik' | 'Rawat Inap'>('Di Rumah');
  const [selectedPoli, setSelectedPoli] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [notes, setNotes] = useState('');
  
  // Filter & Search State
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Master Data Options
  const roomOptions = useMemo(() => {
    if (safeMasterData?.rooms && Array.isArray(safeMasterData.rooms) && safeMasterData.rooms.length > 0) {
      return safeMasterData.rooms;
    }
    return [
      'Ruang Bedah',
      'Ruang Dane Rahil',
      'Ruang Intermediet',
      'Ruang Syaraf',
      'Ruang Interna',
      'Ruang Paru',
      'Ruang Anak',
      'Ruang Rinjani/Nifas',
      'Ruang Neonatus',
      'ICU',
      'HCU',
      'IBS'
    ];
  }, [safeMasterData?.rooms]);

  const polyclinicOptions = useMemo(() => {
    const asalMasuk = Array.isArray(safeMasterData?.refs?.asalMasuk) ? safeMasterData.refs.asalMasuk : [];
    const list = asalMasuk.filter((item: string) => 
      typeof item === 'string' && (item.startsWith('P.') || item.toLowerCase().includes('klinik') || item.toLowerCase().includes('poli'))
    );
    if (list.length > 0) return list;
    return [
      'P. Bedah', 'P. Orthopedi', 'P. Bedah Syaraf', 'P. Bedah Onkologi', 'P. Urologi',
      'P. THT', 'P. Mata', 'P. Anak', 'P. Dalam', 'P. Jantung', 'P. Syaraf', 'P. Obgyn'
    ];
  }, [safeMasterData?.refs?.asalMasuk]);

  const wardOptions = useMemo(() => {
    if (Array.isArray(safeMasterData?.units) && safeMasterData.units.length > 0) {
      return safeMasterData.units;
    }
    return [
      'Ruang Bedah', 'Ruang Dane Rahil', 'Ruang Intermediet', 'Ruang Syaraf',
      'Ruang Interna', 'Ruang Paru', 'Ruang Anak', 'Ruang Rinjani/Nifas', 'Ruang Neonatus'
    ];
  }, [safeMasterData?.units]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      alert('Nama Pasien wajib diisi!');
      return;
    }
    if (!noRM.trim()) {
      alert('No. RM wajib diisi!');
      return;
    }
    if (!plannedRoom) {
      alert('Rencana Ruangan wajib dipilih!');
      return;
    }

    let finalPatientStatus = patientStatusCategory as string;
    let originDetail = '';

    if (patientStatusCategory === 'Poliklinik') {
      finalPatientStatus = `Poliklinik (${selectedPoli || 'Klinik Umum'})`;
      originDetail = selectedPoli;
    } else if (patientStatusCategory === 'Rawat Inap') {
      finalPatientStatus = `Rawat Inap (${selectedWard || 'Ruang Perawatan'})`;
      originDetail = selectedWard;
    }

    const newBooking: RoomBooking = {
      id: generatePermanentUUID('BOOK'),
      patientName: patientName.trim().toUpperCase(),
      noRM: noRM.trim(),
      bookingDate: bookingDate || todayStr,
      bookingTime: bookingTime || '08:00',
      plannedRoom: plannedRoom,
      patientStatus: finalPatientStatus,
      originDetail: originDetail,
      notes: notes.trim(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || currentUser?.username || 'SYSTEM',
      lastModified: new Date().toISOString()
    };

    safeOnSaveBooking(newBooking);

    // Reset Form
    setPatientName('');
    setNoRM('');
    setBookingDate(todayStr);
    setBookingTime('08:00');
    setPlannedRoom('');
    setPatientStatusCategory('Di Rumah');
    setSelectedPoli('');
    setSelectedWard('');
    setNotes('');
  };

  // Filter & Sort Bookings Queue
  const bookingsList = useMemo(() => {
    let list = Array.isArray(safeBookings) ? [...safeBookings] : [];

    if (filterDate) {
      list = list.filter(b => b && b.bookingDate === filterDate);
    }

    if (filterStatus !== 'ALL') {
      list = list.filter(b => b && b.status === filterStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(b =>
        b && (
          (b.patientName || '').toLowerCase().includes(q) ||
          (b.noRM || '').toLowerCase().includes(q) ||
          (b.plannedRoom || '').toLowerCase().includes(q) ||
          (b.patientStatus || '').toLowerCase().includes(q)
        )
      );
    }

    list.sort((a, b) => {
      const dateA = `${a?.bookingDate || ''} ${a?.bookingTime || '00:00'}`;
      const dateB = `${b?.bookingDate || ''} ${b?.bookingTime || '00:00'}`;
      if (sortOrder === 'ASC') {
        return dateA.localeCompare(dateB);
      } else {
        return dateB.localeCompare(dateA);
      }
    });

    return list;
  }, [safeBookings, filterDate, filterStatus, searchQuery, sortOrder]);

  const pendingCount = useMemo(() => {
    return (safeBookings || []).filter(b => b && b.status === 'PENDING').length;
  }, [safeBookings]);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-[2.5rem] p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3.5 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-black uppercase tracking-wider border border-blue-400/30">
                1. Administrasi Pasien
              </span>
              <span className="px-3.5 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-black uppercase tracking-wider border border-amber-400/30">
                {pendingCount} Antrian Pending
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Booking Ruangan Pasien</h2>
            <p className="text-slate-300 text-xs sm:text-sm font-medium mt-1">
              Pendaftaran antrian pemesanan ruangan kamar rawat inap pasien terintegrasi
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Input Booking */}
        <div className="lg:col-span-5 bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Plus size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Formulir Booking Pasien</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Input Data Pemesanan Tempat Tidur</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nama Pasien */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Nama Lengkap Pasien <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: NY. SITI RAHMAH"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* No RM */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  No. Rekam Medis (RM) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 12-34-56"
                  value={noRM}
                  onChange={(e) => setNoRM(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Tanggal & Jam Booking */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Tanggal Booking <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Jam Booking
                  </label>
                  <input
                    type="time"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Rencana Ruangan */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Rencana Ruangan Dibooking <span className="text-rose-500">*</span>
                </label>
                <SearchableSelect
                  options={roomOptions}
                  value={plannedRoom}
                  onChange={(val) => setPlannedRoom(val)}
                  placeholder="-- Pilih Rencana Ruangan --"
                  className="w-full"
                />
              </div>

              {/* Status Pasien Saat Ini / Asal Pasien */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  Status Pasien Saat Ini (Asal Pasien) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Di Rumah', 'IGD', 'HD', 'Poliklinik', 'Rawat Inap'] as const).map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setPatientStatusCategory(cat)}
                      className={`py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border text-center ${
                        patientStatusCategory === cat
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Sub-dropdown if Poliklinik */}
                {patientStatusCategory === 'Poliklinik' && (
                  <div className="mt-3">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Pilih Poliklinik Asal
                    </label>
                    <SearchableSelect
                      options={polyclinicOptions}
                      value={selectedPoli}
                      onChange={(val) => setSelectedPoli(val)}
                      placeholder="-- Pilih Poliklinik --"
                      className="w-full"
                    />
                  </div>
                )}

                {/* Sub-dropdown if Rawat Inap */}
                {patientStatusCategory === 'Rawat Inap' && (
                  <div className="mt-3">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Pilih Ruang Asal Pasien
                    </label>
                    <SearchableSelect
                      options={wardOptions}
                      value={selectedWard}
                      onChange={(val) => setSelectedWard(val)}
                      placeholder="-- Pilih Ruang Asal --"
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Membutuhkan isolasi / kelas VIP"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                <Plus size={18} /> Simpan Booking Ruangan
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: List & Queue View */}
        <div className="lg:col-span-7 bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Building2 className="text-blue-600" size={20} /> Daftar Antrian Booking Pasien
                </h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Urutan pemesanan ruangan terurut berdasarkan tanggal
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  Urutan: {sortOrder === 'ASC' ? 'Lama → Baru' : 'Baru → Lama'}
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari RM / Nama Pasien..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date Filter */}
              <div>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="PENDING">PENDING (Antrian)</option>
                  <option value="CHECKED_IN">CHECKED-IN (Terdaftar)</option>
                  <option value="CANCELLED">CANCELLED (Batal)</option>
                </select>
              </div>
            </div>

            {/* Table Queue */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 text-center w-12">No</th>
                    <th className="p-3.5">Tgl & Jam Booking</th>
                    <th className="p-3.5">Pasien (RM / Nama)</th>
                    <th className="p-3.5">Asal Pasien</th>
                    <th className="p-3.5">Rencana Ruangan</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookingsList.length > 0 ? (
                    bookingsList.map((item, idx) => {
                      if (!item) return null;
                      let statusBadge = (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                          <Clock size={10} /> Pending
                        </span>
                      );
                      if (item.status === 'CHECKED_IN') {
                        statusBadge = (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                            <CheckCircle2 size={10} /> Checked-In
                          </span>
                        );
                      } else if (item.status === 'CANCELLED') {
                        statusBadge = (
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                            <XCircle size={10} /> Batal
                          </span>
                        );
                      }

                      return (
                        <tr key={item.id || idx} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="font-extrabold text-slate-800">{item.bookingDate}</div>
                            <div className="text-[10px] font-mono text-slate-400 font-bold">{item.bookingTime || '08:00'} WIB</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-black text-slate-900 uppercase">{item.patientName}</div>
                            <div className="text-[10px] font-extrabold text-blue-600">RM: {item.noRM}</div>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-black uppercase">
                              {item.patientStatus}
                            </span>
                          </td>
                          <td className="p-3.5 font-black text-indigo-900 uppercase">{item.plannedRoom}</td>
                          <td className="p-3.5 text-center whitespace-nowrap">{statusBadge}</td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => safeOnCheckInToRegistration(item)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 cursor-pointer transition-all"
                                    title="Check-In Pasien ke Form Registrasi"
                                  >
                                    <UserCheck size={12} /> Check-In
                                  </button>
                                  <button
                                    onClick={() => safeOnUpdateStatus(item.id, 'CANCELLED')}
                                    className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                                    title="Batalkan Booking"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Hapus booking pasien ${item.patientName}?`)) {
                                    safeOnDeleteBooking(item.id);
                                  }
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                                title="Hapus Data Booking"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400 font-bold italic">
                        Belum ada antrian booking ruangan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RoomBookingComponent: React.FC<RoomBookingProps> = (props) => {
  return (
    <RoomBookingErrorBoundary>
      <RoomBookingInner {...props} />
    </RoomBookingErrorBoundary>
  );
};

