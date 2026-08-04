
export type UserRole = 'STAFF' | 'PPJA' | 'PIC' | 'SEKRU' | 'KARU' | 'ADMIN_RUANGAN' | 'BIDANG' | 'SUPER_ADMIN';
export type DoctorCategory = 'OPERATOR' | 'ANESTHESIA' | 'NON_OPERATOR';
export type DependencyLevel = 'MINIMAL' | 'PARSIAL' | 'TOTAL';

export interface User {
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  position: string;
  unit?: string; // Room they belong to
  nip?: string;
  lastModified?: string;
  isRecovery?: boolean;
}

export interface CustomField {
  id: string;
  label: string;
  type: 'TEXT' | 'SELECT';
  refCategory?: keyof MasterData['refs'];
}

export interface QualityIndicator {
  id: string;
  title: string;
  numerator: string;
  denominator: string;
  target: number;
  unit: '%' | 'Number';
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  category: string;
}

export interface QualityMeasurement {
  id: string;
  lastModified?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  indicatorId: string;
  date: string;
  numeratorValue: number;
  denominatorValue: number;
  recordedBy: string;
  notes?: string;
  unit?: string;
  auditData?: any;
  meta?: any;
}

export interface DailyReportEntry {
  patientId: string;
  date: string;
  lastModified?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  morningReport?: string;
  afternoonReport?: string;
  nightReport?: string;
  morningDependency?: DependencyLevel;
  afternoonDependency?: DependencyLevel;
  nightDependency?: DependencyLevel;
  morningTherapy?: string;
  afternoonTherapy?: string;
  nightTherapy?: string;
  morningRecordedBy?: string;
  afternoonRecordedBy?: string;
  nightRecordedBy?: string;
  surgeryProcedure?: string;
  surgeryOperator?: string;
  surgeryDate?: string;
  adminNote?: string;
  diagnosis?: string;
  surgeryStatus?: 'SCHEDULED' | 'PERFORMED' | 'DELAYED' | 'CANCELLED';
  surgeryDelayReason?: string;
  surgeryTime?: string;
  surgeryAnesthesiaType?: string;
  surgeryUrgency?: 'ELECTIVE' | 'EMERGENCY';
  surgeryNewDate?: string;
  surgeryNewTime?: string;
  fieldModifiedTimes?: Record<string, string>;
}

export interface DoctorVisitRecord {
  id: string;
  lastModified?: string;
  patientId: string;
  patientName: string;
  noRM: string;
  date: string;
  time: string;
  doctorId: string;
  doctorName: string;
  smf: string;
  paymentMethod: string;
  attendanceStatus: string;
  attendanceStatuses?: string[];
  assistantName?: string;
  visitRole: string;
  recordedBy: string;
  recordedAt: string;
  createdAt?: string;
  unit?: string;
}

export interface Instrument {
  id: string;
  lastModified?: string;
  updatedAt?: string;
  code: string;
  name: string;
  category: string;
  status: 'READY' | 'IN_USE' | 'MAINTENANCE';
  lastMaintenance?: string;
  notes?: string;
  unit?: string;
}

export interface OperationReport {
  id: string;
  lastModified?: string;
  updatedAt?: string;
  patientId: string;
  patientName: string;
  noRM: string;
  date: string;
  startTime: string;
  endTime: string;
  operator: string;
  anesthetist: string;
  scrubNurse: string;
  diagnosisPreOp: string;
  diagnosisPostOp: string;
  procedure: string;
  findings: string;
  complications?: string;
  recordedBy: string;
  createdAt: string;
  unit: string;
}

export interface RoomBooking {
  id: string;
  patientName: string;
  noRM: string;
  bookingDate: string; // YYYY-MM-DD
  bookingTime?: string;
  plannedRoom: string; // Room / Care Unit planned
  patientStatus: string; // "Di Rumah" or "IGD", "HD", "Poliklinik", "Rawat Inap"
  originDetail?: string; // Specific clinic/room name if originating from polyclinic/ward
  notes?: string;
  status: 'PENDING' | 'CHECKED_IN' | 'CANCELLED';
  createdAt: string;
  createdBy?: string;
  createdByName?: string;
  createdByUsername?: string;
  updatedAt?: string;
  checkedInAt?: string;
  checkedInBy?: string;
  lastModified?: string;
  cancellationReason?: string;
}

export interface RolePermission {
  role: UserRole;
  allowedMenus: string[]; // List of allowed menu IDs, e.g. ['adm-register', 'adm-booking', ...]
  actions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canPrintPdf: boolean;
    canExportExcel: boolean;
    canPostBilling: boolean;
  };
}

export type DoctorVisit = DoctorVisitRecord;
export type InventoryItem = Instrument;

export interface MasterData {
  doctors: string[];
  doctorMetadata: Record<string, { ksm: string, category?: DoctorCategory }>;
  nurses: string[];
  nurseMetadata: Record<string, { position: string, unit?: string }>;
  users: User[];
  units: string[];
  unitToClasses: Record<string, string[]>;
  classToRooms: Record<string, string[]>;
  roomToBeds: Record<string, string[]>;
  rooms: string[];
  roomClasses: any[];
  bedMapping: Record<string, any>;
  addresses: any[];
  customFields: CustomField[];
  qualityIndicators: QualityIndicator[];
  instrumentCategories?: string[];
  icd10List?: { code: string; name: string }[];
  dpjpList?: string[];
  kamarList?: string[];
  settings?: AppSettings;
  restrictedDrugs?: { drugName: string; maxDays: number; }[];
  rolePermissions?: Record<string, RolePermission>;
  refs: {
    positions: string[];
    ksmList: string[];
    asalMasuk: string[];
    jenisKll: string[];
    caraBayar: string[];
    statusTanggungan: string[];
    statusSep: string[];
    statusDataPasien: string[];
    caraKeluar: string[];
  };
}

export interface AppData {
  timestamp: string;
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  nursingReports: any[];
  operations: any[];
  masterData: MasterData;
  doctorVisits?: DoctorVisitRecord[];
  financeRecords?: FinanceRecord[];
  incidentReports?: IncidentReport[];
  qualityMeasurements?: QualityMeasurement[];
  instruments?: Instrument[];
  operationReports?: OperationReport[];
  roomBookings?: RoomBooking[];
  booking_ruangan?: RoomBooking[];
  deletedIds?: string[];
}

export interface Patient {
  id: string;
  lastModified?: string;
  updatedAt?: string;
  noRegister: string;
  noRM: string;
  name: string;
  gender: 'L' | 'P';
  birthDate: string;
  address: string;
  entryDate: string;
  entryTime?: string;
  origin: string;
  originUnit?: string;
  unitTujuan: string;
  kelasRawat: string;
  ruangan: string;
  nomorBed: string;
  statusDataPasien: string;
  diagnosaUtama: string;
  diagnosaSekunder?: string;
  tindakanProsedur: string;
  dpjpList: string[];
  paymentMethod: string[];
  noSEP: string;
  statusSEP: string;
  jenisKLL: string;
  noLP: string;
  perawatPrimer: string;
  catatanKhusus: string;
  allergyHistory?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  adminResp?: string;
  status: 'PENDING' | 'ADMITTED' | 'DISCHARGED' | 'SURGERY_SCHEDULED' | 'SURGERY_DONE';
  dischargeDate?: string;
  dischargeTime?: string;
  apsReason?: string;
  referralDestination?: string;
  transferDestinationRoom?: string;
  transferUnit?: string;
  transferClass?: string;
  transferRoom?: string;
  transferBed?: string;
  deathTime?: '<48h' | '>=48h' | '';
  transferHistory?: { date: string, fromUnit: string, toUnit: string }[];
  mutationSubLog?: { date: string, log: string }[];
  dpjpHistory?: { date: string, type: string, log: string, user: string }[];
  isRisikoBermasalah?: boolean;
  statusMasalah?: 'SELESAI' | 'ON_PROSES' | '';
  dynamicData?: Record<string, string>;
  dpjp?: string;
  ksm?: string;
  suratKeterangan?: string;
}

export interface DoctorChargeEntry {
  doctorName: string;
  count: number;
  role: 'DPJP_UTAMA' | 'DPJP_RABERAN' | 'DPJP_KONSULAN';
}

export interface FinanceRecord {
  id: string;
  lastModified?: string;
  patientId?: string;
  patientName?: string;
  noRM?: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  recordedBy: string;
  ksm?: string;
  dpjp?: string;
  unit?: string;
  numVisites?: number;
  billingAkomodasi?: number;
  billingTindakan?: number;
  billingGasMedis?: number;
  dischargeDate?: string;
  noSEP?: string;
  ruangRawatAsal?: string;
  entryDate?: string;
  jmlHariRawat?: number;
  diagnosaUtama?: string;
  caraBayar?: string;
  statusDataPasien?: string;
  doctorCharges?: DoctorChargeEntry[];
}

export interface IncidentReport {
  id: string;
  lastModified?: string;
  puskesmasName?: string;
  isKPC: boolean;
  
  // Section I: Data Pasien
  patientId?: string;
  patientName?: string;
  noRM?: string;
  room?: string;
  ageCategory?: string;
  gender?: 'L' | 'P';
  paymentMethod?: string;
  admissionDate?: string;
  admissionTime?: string;

  // Section II: Rincian Kejadian
  date: string;
  time: string;
  incidentName: string;
  chronology: string;
  incidentType: 'KNC' | 'KTC' | 'KTD' | 'SENTINEL' | 'KPC';
  
  reporterType: string;
  reporterTypeDetail?: string;
  
  affectedParty: string;
  affectedPartyDetail?: string;
  
  patientServiceCategory: string;
  patientServiceCategoryDetail?: string;
  
  location: string;
  
  specialtyCase: string;
  
  responsibleUnit: string;
  
  impact: string;
  
  immediateAction: string;
  actionPerformer: string;
  actionPerformerDetail?: string;
  
  wasSameIncidentBefore: boolean;
  previousIncidentDetail?: string;
  
  reporterName: string;
  reporterUsername?: string;
  receiverName?: string;
  reportDate: string;
  receiveDate?: string;
  
  severity: 'BLUE' | 'GREEN' | 'YELLOW' | 'RED';
  status: 'NEW' | 'INVESTIGATING' | 'RESOLVED';
  assignedPic?: string;
  resolutionNotes?: string;
  notified?: boolean;
  investigation?: SimpleInvestigation;
}

export interface SimpleInvestigation {
  tabularTimeline: TimelineStep[];
  analysis: FiveWhysAnalysis[];
}

export interface TimelineStep {
  id: string;
  time: string;
  event: string;
  info: string;
  goodPractice: string;
  cmp?: string;
  sdp?: string;
}

export interface FiveWhysAnalysis {
  id: string;
  problem: string; // CMP/SDP
  immediateCause: string;
  why2: string;
  why3: string;
  why4: string;
  rootCause: string;
  contributorComponent: string;
  contributorSubComponent: string;
  recommendations: string[];
  actions: string[];
}

export interface AppSettings {
  themeColor?: string;
  isSidebarAutohide?: boolean;
  appWallpaperUrl?: string;
  loginWallpaperUrl?: string;
  appName?: string;
  appSlogan?: string;
  dangerPrimaryColor?: string; // For alerts/brand secondary
  fontColor?: string;
  settingsTimestamp?: string;
  logoUrl?: string;
  logoLetterLeftUrl?: string;
  logoLetterRightUrl?: string;
}

export const getDpjpStyles = (name: string): { bg: string; text: string; border: string } => {
  const n = (name || '').toUpperCase();
  if (n.includes('SP.B') || n.includes('BEDAH') || n.includes('DIG') || n.includes('ONK') || n.includes('SP.B(')) {
    return {
      bg: 'bg-rose-50/90 border border-rose-200 shadow-sm',
      text: 'text-rose-800 font-black',
      border: 'border-rose-250'
    };
  }
  if (n.includes('SP.U') || n.includes('UROLOGI') || n.includes('SP.U(')) {
    return {
      bg: 'bg-indigo-50/90 border border-indigo-200 shadow-sm',
      text: 'text-indigo-900 font-black',
      border: 'border-indigo-250'
    };
  }
  if (n.includes('SP.OT') || n.includes('ORTHOPEDI') || n.includes('ORTOPEDI') || n.includes('SP.OT(')) {
    return {
      bg: 'bg-emerald-50/90 border border-emerald-250 shadow-sm',
      text: 'text-emerald-800 font-black',
      border: 'border-emerald-300'
    };
  }
  if (n.includes('SP.OG') || n.includes('KANDUNGAN') || n.includes('OBGYN')) {
    return {
      bg: 'bg-purple-50/90 border border-purple-200 shadow-sm',
      text: 'text-purple-800 font-black',
      border: 'border-purple-250'
    };
  }
  return {
    bg: 'bg-amber-50/90 border border-amber-200 shadow-sm',
    text: 'text-amber-800 font-black',
    border: 'border-amber-250'
  };
};

export const getRoomBedStyles = (roomName: string): { bg: string; text: string; border: string } => {
  const r = (roomName || '').toUpperCase();
  if (r.includes('3A')) {
    return {
      bg: 'bg-sky-50 border border-sky-200 shadow-sm',
      text: 'text-sky-700 font-black',
      border: 'border-sky-300'
    };
  }
  if (r.includes('3B')) {
    return {
      bg: 'bg-emerald-50 border border-emerald-200 shadow-sm',
      text: 'text-emerald-700 font-black',
      border: 'border-emerald-300'
    };
  }
  if (r.includes('3C')) {
    return {
      bg: 'bg-amber-50 border border-amber-200 shadow-sm',
      text: 'text-amber-700 font-black',
      border: 'border-amber-300'
    };
  }
  if (r.includes('3D')) {
    return {
      bg: 'bg-rose-50 border border-rose-200 shadow-sm',
      text: 'text-rose-700 font-black',
      border: 'border-rose-300'
    };
  }
  if (r.includes('3E')) {
    return {
      bg: 'bg-orange-50 border border-orange-200 shadow-sm',
      text: 'text-orange-750 font-black',
      border: 'border-orange-300'
    };
  }
  return {
    bg: 'bg-purple-50 border border-purple-200 shadow-sm',
    text: 'text-purple-700 font-black',
    border: 'border-purple-300'
  };
};

export const getPaymentMethodStyles = (method: string): { bg: string; text: string; border: string } => {
  const m = (method || '').toUpperCase();
  if (m.includes('BPJS')) {
    return {
      bg: 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs',
      text: 'text-emerald-850 font-black',
      border: 'border-emerald-300'
    };
  }
  if (m.includes('UMUM') || m.includes('MANDIRI') || m.includes('TUNAI') || m.includes('CASH')) {
    return {
      bg: 'bg-sky-50 text-sky-800 border border-sky-300 shadow-xs',
      text: 'text-sky-850 font-black',
      border: 'border-sky-300'
    };
  }
  if (m.includes('ASURANSI') || m.includes('SWASTA')) {
    return {
      bg: 'bg-purple-50 text-purple-800 border border-purple-300 shadow-xs',
      text: 'text-purple-850 font-black',
      border: 'border-purple-300'
    };
  }
  if (m.includes('JASA RAHARJA') || m.includes('JR') || m.includes('RAHARJA')) {
    return {
      bg: 'bg-amber-50 text-amber-800 border border-amber-300 shadow-xs',
      text: 'text-amber-850 font-black',
      border: 'border-amber-300'
    };
  }
  return {
    bg: 'bg-slate-50 text-slate-700 border border-slate-300 shadow-xs',
    text: 'text-slate-800 font-black',
    border: 'border-slate-300'
  };
};

export const getShiftFromTime = (timeStr: string | undefined | null): 'PAGI' | 'SIANG' | 'MALAM' => {
  if (!timeStr) return 'PAGI'; // Default
  const parts = timeStr.trim().split(':');
  if (parts.length === 0) return 'PAGI';
  const hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return 'PAGI';
  
  if (hour >= 7 && hour < 14) return 'PAGI';
  if (hour >= 14 && hour < 21) return 'SIANG';
  return 'MALAM';
};

export const parseToStandardDateString = (dateStr: any): string => {
  try {
    if (dateStr === null || dateStr === undefined) return '';
    
    // If it's already a Date object
    if (dateStr instanceof Date) {
      if (!isNaN(dateStr.getTime())) {
        const y = dateStr.getFullYear();
        const m = String(dateStr.getMonth() + 1).padStart(2, '0');
        const d = String(dateStr.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return '';
    }

    // Convert to string safely
    let clean = String(dateStr).trim();
    if (!clean) return '';

    // Split time portion if present
    if (clean.includes('T')) {
      clean = clean.split('T')[0];
    } else if (clean.includes(' ')) {
      const parts = clean.split(' ');
      const monthNamesIndo = [
        'januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
        'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'agu', 'agt', 'sep', 'okt', 'nov', 'des'
      ];
      const hasIndoMonth = parts.some(p => monthNamesIndo.includes(p.toLowerCase()));
      if (hasIndoMonth) {
        clean = parts.slice(0, 3).join(' ');
      } else if (parts[0].includes('-') || parts[0].includes('/')) {
        clean = parts[0];
      }
    }

    // 1. Try parsing YYYY-MM-DD or YYYY/MM/DD
    let match = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      const y = match[1];
      const m = match[2].padStart(2, '0');
      const d = match[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    
    // 2. Try parsing DD-MM-YYYY or DD/MM/YYYY
    match = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (match) {
      const d = match[1].padStart(2, '0');
      const m = match[2].padStart(2, '0');
      const y = match[3];
      return `${y}-${m}-${d}`;
    }

    // 3. Try parsing Indonesian/English textual dates (e.g. "03 Juli 2026", "3 Jul 2026", "Juli 3, 2026")
    const lowerClean = clean.toLowerCase();
    const monthsMap: Record<string, string> = {
      januari: '01', jan: '01',
      februari: '02', feb: '02',
      maret: '03', mar: '03',
      april: '04', apr: '04',
      mei: '05',
      juni: '06', jun: '06',
      juli: '07', jul: '07',
      agustus: '08', agu: '08', agt: '08',
      september: '09', sep: '09',
      oktober: '10', okt: '10',
      november: '11', nov: '11',
      desember: '12', des: '12'
    };

    // e.g. "03 Juli 2026"
    const textMatch1 = lowerClean.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (textMatch1) {
      const day = textMatch1[1].padStart(2, '0');
      const monthName = textMatch1[2];
      const year = textMatch1[3];
      const monthNum = monthsMap[monthName];
      if (monthNum) {
        return `${year}-${monthNum}-${day}`;
      }
    }

    // e.g. "Juli 03, 2026" or "Jul 3 2026"
    const textMatch2 = lowerClean.match(/^([a-z]+)\s+(\d{1,2})[,\s]+(\d{4})/);
    if (textMatch2) {
      const monthName = textMatch2[1];
      const day = textMatch2[2].padStart(2, '0');
      const year = textMatch2[3];
      const monthNum = monthsMap[monthName];
      if (monthNum) {
        return `${year}-${monthNum}-${day}`;
      }
    }

    // Try standard JS date parsing
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // If it's a number (Excel date or timestamp)
    const num = Math.floor(Number(clean));
    if (!isNaN(num) && num > 0) {
      if (num > 100000000000) {
        const dObj = new Date(num);
        if (!isNaN(dObj.getTime())) {
          const y = dObj.getFullYear();
          const m = String(dObj.getMonth() + 1).padStart(2, '0');
          const d = String(dObj.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      } else if (num > 10000 && num < 60000) {
        const excelEpoch = new Date(1899, 11, 30);
        const dObj = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
        if (!isNaN(dObj.getTime())) {
          const y = dObj.getFullYear();
          const m = String(dObj.getMonth() + 1).padStart(2, '0');
          const d = String(dObj.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      }
    }
    
    return clean;
  } catch (error) {
    console.warn("Date parsing error caught safely:", error);
    return '';
  }
};

export const compareDatesSafe = (dateA: any, dateB: any, descending: boolean = true): number => {
  try {
    const stdA = parseToStandardDateString(dateA) || "1970-01-01";
    const stdB = parseToStandardDateString(dateB) || "1970-01-01";
    return descending ? stdB.localeCompare(stdA) : stdA.localeCompare(stdB);
  } catch (e) {
    return 0;
  }
};

/**
 * Formats a Date object or string to YYYY-MM-DD in local WITA time (Asia/Makassar, UTC+8)
 */
export const formatLocalDate = (input?: any): string => {
  try {
    const d = input ? new Date(input) : new Date();
    if (isNaN(d.getTime())) return '';
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' });
      return formatter.format(d);
    } catch (tzErr) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) {
    return '';
  }
};

/**
 * Returns today's date in YYYY-MM-DD format based on local time
 */
export const getTodayLocalDateString = (): string => formatLocalDate();

/**
 * Checks if a given timestamp or ISO/date string falls within a specific local date
 */
export const isSameLocalDate = (val1: any, val2: any): boolean => {
  if (!val1 || !val2) return false;
  const std1 = parseToStandardDateString(val1);
  const std2 = parseToStandardDateString(val2);
  return std1 === std2;
};

