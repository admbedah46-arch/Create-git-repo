
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
  indicatorId: string;
  date: string;
  numeratorValue: number;
  denominatorValue: number;
  recordedBy: string;
  notes?: string;
  unit?: string;
}

export interface DailyReportEntry {
  patientId: string;
  date: string;
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
}

export interface Instrument {
  id: string;
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
  financeRecords?: FinanceRecord[];
  incidentReports?: IncidentReport[];
  qualityMeasurements?: QualityMeasurement[];
  instruments?: Instrument[];
  operationReports?: OperationReport[];
}

export interface Patient {
  id: string;
  noRegister: string;
  noRM: string;
  name: string;
  gender: 'L' | 'P';
  birthDate: string;
  address: string;
  entryDate: string;
  origin: string;
  unitTujuan: string;
  kelasRawat: string;
  ruangan: string;
  nomorBed: string;
  statusDataPasien: string;
  diagnosaUtama: string;
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
  status: 'PENDING' | 'ADMITTED' | 'DISCHARGED' | 'SURGERY_SCHEDULED' | 'SURGERY_DONE';
  dischargeDate?: string;
  dischargeTime?: string;
  apsReason?: string;
  referralDestination?: string;
  transferDestinationRoom?: string;
  deathTime?: '<48h' | '>=48h';
  transferHistory?: { date: string, fromUnit: string, toUnit: string }[];
  dynamicData?: Record<string, string>;
}

export interface FinanceRecord {
  id: string;
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
}

export interface IncidentReport {
  id: string;
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
