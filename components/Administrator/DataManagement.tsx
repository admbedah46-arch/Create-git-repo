
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { MasterData, User, UserRole, CustomField, DoctorCategory, QualityIndicator, RolePermission } from '../../types';
import { ALL_MENU_IDS, DEFAULT_ROLE_PERMISSIONS } from '../../constants';
import { getApiUrl, saveApiUrl, clearDeletedIds, registerDeletedId } from '../../db';
import { Button } from '../Button';
import { 
  Trash2, Plus, Edit2, X, Map, Activity, Database, AlertTriangle, 
  CheckCircle2, Eye, EyeOff, User as UserIcon, Settings, 
  Stethoscope, Users, Filter, LayoutGrid, ChevronRight, UserPlus,
  ClipboardCheck, Target, BarChart, Settings2, RefreshCw, Search, Upload,
  Cloud, Lock, Check, LogOut, Copy, Globe, ShieldCheck, FileSpreadsheet, Download
} from 'lucide-react';

interface DataManagementProps {
  masterData: MasterData;
  onSave: (newData: MasterData) => void;
  currentUser: User | null;
  appData?: any;
  onUpdateAppData?: (data: any, immediate?: boolean) => Promise<any>;
  onTriggerSync?: (isForce?: boolean) => Promise<boolean>;
  syncStatus?: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
}

type Tab = 'STAFF' | 'STRUCTURE' | 'MEDICS' | 'REFS' | 'QUALITY' | 'SYSTEM' | 'THEME';
type MedicSubTab = 'DOKTER' | 'PERAWAT';

export const DataManagement: React.FC<DataManagementProps> = ({ 
  masterData, 
  onSave, 
  currentUser,
  appData,
  onUpdateAppData,
  onTriggerSync,
  syncStatus
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('STAFF');
  const [serverConfig, setServerConfig] = useState<{ hasAppsScriptUrl: boolean; appsScriptUrl: string | null; enableGoogleSheets: boolean }>({
    hasAppsScriptUrl: false,
    appsScriptUrl: null,
    enableGoogleSheets: false
  });
  const [manualApiUrl, setManualApiUrl] = useState(getApiUrl());
  const [googleSpreadsheetId, setGoogleSpreadsheetId] = useState('');

  // Google OAuth 2.0 Integration State
  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('google_oauth_client_id') || '');
  const [googleAuthToken, setGoogleAuthToken] = useState<string | null>(() => localStorage.getItem('google_oauth_access_token'));
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [createdSpreadsheetId, setCreatedSpreadsheetId] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isAdvancedOauthOpen, setIsAdvancedOauthOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSelfHealing, setIsSelfHealing] = useState(false);
  const [healingLogs, setHealingLogs] = useState<string[]>([]);
  const [healingAiMessage, setHealingAiMessage] = useState<string>('');
  
  // Client-Side Dual-Engine Backup & Restore Local States
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);

  // Granular RBAC Matrix State
  const [isRbacModalOpen, setIsRbacModalOpen] = useState(false);
  const [selectedRoleForRbac, setSelectedRoleForRbac] = useState<UserRole>('KARU');
  const [rbacPermissions, setRbacPermissions] = useState<Record<string, RolePermission>>(() => {
    return masterData.rolePermissions || (DEFAULT_ROLE_PERMISSIONS as Record<string, RolePermission>);
  });

  const handleDownloadUserTemplate = () => {
    const templateData = [
      {
        'NO': 1,
        'NAMA STAF': 'DR. AHMAD RIADI, SP.B',
        'NIP / NI PPPK / NIPPPK PW / NIK RS': '198501012010011001',
        'UNIT KERJA': 'Ruang Bedah',
        'POSISI JABATAN': 'Kepala Ruangan',
        'ROLE AKSES': 'KARU'
      },
      {
        'NO': 2,
        'NAMA STAF': 'NS. SITI NURHALIZA, S.KEP',
        'NIP / NI PPPK / NIPPPK PW / NIK RS': '199002022015022002',
        'UNIT KERJA': 'Ruang Bedah',
        'POSISI JABATAN': 'Sekretaris Ruangan',
        'ROLE AKSES': 'SEKRU'
      },
      {
        'NO': 3,
        'NAMA STAF': 'SITI AMINAH, A.MD.KEP',
        'NIP / NI PPPK / NIPPPK PW / NIK RS': '199203032018032003',
        'UNIT KERJA': 'Ruang Bedah',
        'POSISI JABATAN': 'Perawat Primer',
        'ROLE AKSES': 'PPJA'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Import Staf');
    XLSX.writeFile(wb, 'Template_Import_User_Staf_SiMANTAP.xlsx');
    notify("Template Excel Import Staf berhasil diunduh.");
  };

  const handleImportUsersExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rows || rows.length === 0) {
          alert("File Excel kosong atau tidak memiliki data!");
          return;
        }

        const validRoles: UserRole[] = ['SUPER_ADMIN', 'BIDANG', 'KARU', 'SEKRU', 'ADMIN_RUANGAN', 'PPJA', 'PIC', 'STAFF'];
        const currentUsers = [...masterData.users];
        let importedCount = 0;

        rows.forEach((row) => {
          const name = (row['NAMA STAF'] || row['Nama'] || row['NAMA'] || '').toString().trim();
          const nip = (row['NIP / NI PPPK / NIPPPK PW / NIK RS'] || row['NIP'] || row['NIP/NI PPPK'] || '').toString().trim();
          const unit = (row['UNIT KERJA'] || row['UNIT'] || row['Unit'] || '').toString().trim();
          const position = (row['POSISI JABATAN'] || row['POSISI'] || row['Posisi'] || 'Staff').toString().trim();
          const rawRole = (row['ROLE AKSES'] || row['ROLE'] || row['Role'] || 'STAFF').toString().trim().toUpperCase().replace(/\s+/g, '_');

          if (!name) return;

          let role: UserRole = 'STAFF';
          if (validRoles.includes(rawRole as UserRole)) {
            role = rawRole as UserRole;
          }

          let username = nip ? nip.replace(/\s+/g, '') : name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!username) username = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

          const existingIdx = currentUsers.findIndex(u => u.username === username || (nip && u.nip === nip));
          const newUser: User = {
            username: username,
            password: existingIdx > -1 ? currentUsers[existingIdx].password : '123456',
            name: name.toUpperCase(),
            role: role,
            unit: unit || 'Ruang Bedah',
            position: position,
            nip: nip
          };

          if (existingIdx > -1) {
            currentUsers[existingIdx] = { ...currentUsers[existingIdx], ...newUser };
          } else {
            currentUsers.push(newUser);
          }
          importedCount++;
        });

        const newData = {
          ...masterData,
          users: currentUsers
        };

        handleSaveMaster(newData);
        notify(`Sukses! ${importedCount} data staf berhasil diimpor.`);
      } catch (err: any) {
        alert("Gagal mengimpor file Excel: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleSaveRbacPermissions = () => {
    const newData: MasterData = {
      ...masterData,
      rolePermissions: rbacPermissions
    };
    handleSaveMaster(newData);
    setIsRbacModalOpen(false);
    notify("Matriks Hak Akses (RBAC) berhasil disimpan!");
  };

  const getTimestampString = () => {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${YYYY}${MM}${DD}_${hh}${mm}${ss}`;
  };

  const handleExportLocalJSON = () => {
    if (!appData) {
      alert("Gagal mengekspor: Data tidak ditemukan.");
      return;
    }
    const dateStr = getTimestampString();
    const filename = `SiMANTAP_Backup_${dateStr}.json`;
    
    const jsonStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("Backup (.json) berhasil diunduh.");
  };

  const handleExportLocalXLSX = () => {
    if (!appData) {
      alert("Gagal mengekspor: Data tidak ditemukan.");
      return;
    }
    const dateStr = getTimestampString();
    const filename = `SiMANTAP_Backup_${dateStr}.xlsx`;

    const wb = XLSX.utils.book_new();

    // Helper to safely convert arrays or objects to sheets with correct shapes
    const patientsData = (appData.patients || []).map((p: any) => ({
      id: p.id,
      noRegister: p.noRegister || '',
      noRM: p.noRM || '',
      name: p.name || '',
      gender: p.gender || '',
      birthDate: p.birthDate || '',
      address: p.address || '',
      entryDate: p.entryDate || '',
      entryTime: p.entryTime || '',
      origin: p.origin || '',
      unitTujuan: p.unitTujuan || '',
      kelasRawat: p.kelasRawat || '',
      ruangan: p.ruangan || '',
      nomorBed: p.nomorBed || '',
      dpjp: p.dpjp || '',
      suratKeterangan: p.suratKeterangan || ''
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patientsData), 'Patients');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appData.dailyReports || []), 'DailyReports');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appData.doctorVisits || []), 'DoctorVisits');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appData.financeRecords || []), 'FinanceRecords');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appData.incidentReports || []), 'IncidentReports');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appData.qualityMeasurements || []), 'QualityMeasurements');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appData.instruments || []), 'Instruments');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appData.operationReports || []), 'OperationReports');

    // Store masterData in a tabular format (Key-Value)
    const masterRows = Object.keys(appData.masterData || {}).map(key => ({
      Key: key,
      Value: JSON.stringify(appData.masterData[key])
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(masterRows), 'MasterData');

    XLSX.writeFile(wb, filename);
    notify("Backup (.xlsx) berhasil diunduh.");
  };

  const processImportFile = (file: File) => {
    const reader = new FileReader();
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'json') {
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          
          if (parsed && (parsed.patients || parsed.masterData)) {
            setPendingRestoreData(parsed);
            setIsRestoreConfirmOpen(true);
          } else {
            alert("Format file JSON tidak valid.");
          }
        } catch (err) {
          alert("Gagal membaca file JSON: " + (err as Error).message);
        }
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx') {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const reconstructed: any = {
            timestamp: new Date().toISOString(),
            patients: [],
            dailyReports: [],
            nursingReports: [],
            operations: [],
            masterData: {
              doctors: [],
              doctorMetadata: {},
              nurses: [],
              nurseMetadata: {},
              users: [],
              units: [],
              unitToClasses: {},
              classToRooms: {},
              roomToBeds: {},
              rooms: [],
              roomClasses: [],
              bedMapping: {},
              addresses: [],
              customFields: [],
              qualityIndicators: [],
              refs: {
                positions: [],
                ksmList: [],
                asalMasuk: [],
                jenisKll: [],
                caraBayar: [],
                statusTanggungan: [],
                statusSep: [],
                statusDataPasien: [],
                caraKeluar: []
              }
            }
          };

          const parseSheet = (sheetName: string) => {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) return [];
            return XLSX.utils.sheet_to_json(sheet);
          };

          if (workbook.Sheets['Patients']) reconstructed.patients = parseSheet('Patients');
          if (workbook.Sheets['DailyReports']) reconstructed.dailyReports = parseSheet('DailyReports');
          if (workbook.Sheets['DoctorVisits']) reconstructed.doctorVisits = parseSheet('DoctorVisits');
          if (workbook.Sheets['FinanceRecords']) reconstructed.financeRecords = parseSheet('FinanceRecords');
          if (workbook.Sheets['IncidentReports']) reconstructed.incidentReports = parseSheet('IncidentReports');
          if (workbook.Sheets['QualityMeasurements']) reconstructed.qualityMeasurements = parseSheet('QualityMeasurements');
          if (workbook.Sheets['Instruments']) reconstructed.instruments = parseSheet('Instruments');
          if (workbook.Sheets['OperationReports']) reconstructed.operationReports = parseSheet('OperationReports');

          const masterSheet = workbook.Sheets['MasterData'];
          if (masterSheet) {
            const rows: any[] = XLSX.utils.sheet_to_json(masterSheet);
            rows.forEach(row => {
              const key = row.Key;
              const valStr = row.Value;
              if (key && valStr) {
                try {
                  reconstructed.masterData[key] = JSON.parse(valStr);
                } catch (e) {
                  console.error("Error parsing masterData key from XLSX", key, e);
                }
              }
            });
          }

          if (reconstructed.patients.length > 0 || reconstructed.masterData.doctors.length > 0 || reconstructed.masterData.users.length > 0) {
            setPendingRestoreData(reconstructed);
            setIsRestoreConfirmOpen(true);
          } else {
            alert("Format file Excel tidak dikenali atau kosong.");
          }
        } catch (err) {
          alert("Gagal membaca file Excel: " + (err as Error).message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("Hanya berkas .json atau .xlsx yang didukung.");
    }
  };

  const handleExecuteRestore = async () => {
    if (!pendingRestoreData) return;
    try {
      if (onUpdateAppData) {
        await onUpdateAppData(pendingRestoreData, true);
        notify("Pemulihan data (Restore) berhasil diselesaikan secara utuh!");
        setIsRestoreConfirmOpen(false);
        setPendingRestoreData(null);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        alert("Sistem state update callback tidak aktif.");
      }
    } catch (err) {
      alert("Gagal melakukan restore: " + (err as Error).message);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://ais-pre-5yx5np5byvmf4dw3uf7moi-256092545608.asia-southeast1.run.app");
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const fetchGoogleProfile = async (token: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const profile = await res.json();
        setGoogleUser(profile);
      } else {
        setGoogleAuthToken(null);
        setGoogleUser(null);
        localStorage.removeItem('google_oauth_access_token');
      }
    } catch (e) {
      console.error('Failed to get Google user info:', e);
    }
  };

  React.useEffect(() => {
    if (googleAuthToken) {
      fetchGoogleProfile(googleAuthToken);
    }
  }, [googleAuthToken]);

  React.useEffect(() => {
    const handleOauthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'GOOGLE_OAUTH_TOKEN') {
        const { accessToken } = event.data;
        setGoogleAuthToken(accessToken);
        localStorage.setItem('google_oauth_access_token', accessToken);
        fetchGoogleProfile(accessToken);
        notify("Google Account Berhasil Terkoneksi!");
      }
    };
    window.addEventListener('message', handleOauthMessage);
    return () => window.removeEventListener('message', handleOauthMessage);
  }, []);

  const handleGoogleLogin = () => {
    if (!googleClientId.trim()) {
      alert('Tuliskan OAuth Client ID Anda terlebih dahulu!');
      return;
    }
    localStorage.setItem('google_oauth_client_id', googleClientId.trim());
    
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId.trim())}&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=token&scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email')}`;
    
    window.open(authUrl, 'google-oauth-popup', `width=${width},height=${height},left=${left},top=${top}`);
  };

  const handleGoogleDisconnect = () => {
    setGoogleAuthToken(null);
    setGoogleUser(null);
    localStorage.removeItem('google_oauth_access_token');
    notify("Koneksi Akun Google Terputus.");
  };

  const handleCreateTemplate = async () => {
    if (!googleAuthToken) {
      alert('Silakan hubungkan akun Google Anda terlebih dahulu!');
      return;
    }
    
    setIsCreatingTemplate(true);
    setCreatedSpreadsheetId(null);
    try {
      // 1. Create Spreadsheet
      const driveRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'SiMANTAP OR-Manager Database',
          mimeType: 'application/vnd.google-apps.spreadsheet'
        })
      });
      
      if (!driveRes.ok) {
        throw new Error('Gagal membuat spreadsheet di Drive. Periksa hak akses Client ID Anda.');
      }
      
      const driveData = await driveRes.json();
      const spreadsheetId = driveData.id;
      
      // 2. Rename Sheet to DB
      const metadataRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: 0,
                  title: 'DB'
                },
                fields: 'title'
              }
            }
          ]
        })
      });
      
      if (!metadataRes.ok) {
        throw new Error('Gagal merubah nama lembar kerja Spreadsheet Default menjadi "DB".');
      }

      // 3. Write default structures
      const initialDbLoad = appData || { masterData: masterData, patients: [], financeRecords: [], incidentReports: [] };
      
      const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DB!A1:A1?valueInputOption=RAW`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${googleAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: 'DB!A1:A1',
          majorDimension: 'ROWS',
          values: [
            [
              JSON.stringify(initialDbLoad)
            ]
          ]
        })
      });

      if (!writeRes.ok) {
        throw new Error('Gagal menulis data database awal ke baris spreadsheet.');
      }

      setCreatedSpreadsheetId(spreadsheetId);
      notify("Spreadsheet Template Berhasil Diciptakan!");
    } catch (err: any) {
      alert(err.message || 'Error occurred while generating template');
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  React.useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setServerConfig({
          hasAppsScriptUrl: data.hasAppsScriptUrl,
          appsScriptUrl: data.appsScriptUrl,
          enableGoogleSheets: !!data.enableGoogleSheets
        });
        if (data.appsScriptUrl) {
          saveApiUrl(data.appsScriptUrl);
          setManualApiUrl(data.appsScriptUrl);
        }
        if (data.googleSpreadsheetId) {
          setGoogleSpreadsheetId(data.googleSpreadsheetId);
        }
      })
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
  const [bypassValidation, setBypassValidation] = useState(true);
  const [isConfirmClearCacheOpen, setIsConfirmClearCacheOpen] = useState(false);
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
  const [tempSettings, setTempSettings] = useState<MasterData['settings']>({});

  // Backup & Restore Engine state variables
  const [serverBackups, setServerBackups] = useState<any[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [backupNote, setBackupNote] = useState('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState<string | null>(null);

  // Fetch all backups from server
  const fetchBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const res = await fetch('/api/backups');
      const d = await res.json();
      if (d.success) {
        setServerBackups(d.backups);
      }
    } catch (err) {
      console.error('Gagal mengambil daftar backup dari server:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  // Create a manual backup on the server
  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const res = await fetch('/api/backups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: backupNote.trim() || undefined })
      });
      const d = await res.json();
      if (d.success) {
        notify("Sukses! Backup manual berhasil dibuat.");
        setBackupNote('');
        fetchBackups();
      } else {
        alert('Gagal membuat backup: ' + (d.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Gagal menghubungi server: ' + err.message);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Restore a specific backup
  const handleRestoreBackup = async (filename: string) => {
    const isConfirmed = window.confirm(`PERINGATAN KRITIKAL:\n\nApakah Anda yakin ingin memulihkan (Restore) database dari file cadangan:\n"${filename}"?\n\nTindakan ini akan menimpa seluruh data saat ini.`);
    if (!isConfirmed) return;

    setIsRestoringBackup(filename);
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      const d = await res.json();
      if (d.success) {
        notify("Berhasil! Database berhasil dipulihkan.");
        if (onTriggerSync) {
          // Pull updated cache state to client immediately
          await onTriggerSync(true);
        }
        fetchBackups();
      } else {
        alert('Gagal merestore backup: ' + (d.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Gagal menghubungi server: ' + err.message);
    } finally {
      setIsRestoringBackup(null);
    }
  };

  // Delete a specific backup
  const handleDeleteBackup = async (filename: string) => {
    const isConfirmed = window.confirm(`Apakah Anda yakin ingin menghapus permanen file backup "${filename}"?`);
    if (!isConfirmed) return;

    try {
      const res = await fetch('/api/backups/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      const d = await res.json();
      if (d.success) {
        notify("File backup telah berhasil dihapus.");
        fetchBackups();
      } else {
        alert('Gagal menghapus file backup: ' + (d.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Gagal menghubungi server: ' + err.message);
    }
  };

  // SheetJS Excel full structured database exporter
  const handleExportAllToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Patients
      const patientsData = (appData?.patients || []).map((p: any, idx: number) => ({
        'No': idx + 1,
        'No RM': p.noRM || '-',
        'Nama Pasien': p.name || '-',
        'Jenis Kelamin': p.gender === 'L' ? 'Laki-Laki' : 'Perempuan',
        'Tanggal Lahir': p.birthDate || '-',
        'Alamat': p.address || '-',
        'Suku/Agama': p.religion || '-',
        'Kelas Rawat': p.class || '-',
        'Pembiayaan/Penjamin': p.payment || '-',
        'Unit/Ruangan': p.unitTujuan || '-',
        'Nomor Bed': p.nomorBed || '-',
        'Status Rawat': p.statusRawat || 'AKTIF',
        'Diagnosa Medis Utama': p.diagnosaUtama || '-',
        'DPJP': p.dpjpName || '-',
        'Tanggal Masuk': p.entryDate || '-'
      }));
      const wsPatients = XLSX.utils.json_to_sheet(patientsData);
      XLSX.utils.book_append_sheet(wb, wsPatients, 'Pasien Matriks Ruang Bedah');

      // Sheet 2: Daily Nursing Reports (Shift Reports)
      const dailyReportsData = (appData?.dailyReports || []).map((r: any, idx: number) => {
        const patientName = (appData?.patients || []).find((p: any) => p.id === r.patientId)?.name || 'Tidak Dikenal';
        const patientRM = (appData?.patients || []).find((p: any) => p.id === r.patientId)?.noRM || '-';
        return {
          'No': idx + 1,
          'No RM': patientRM,
          'Nama Pasien': patientName,
          'Tanggal Pelayanan': r.date || '-',
          'Shift Pagi - Laporan': r.morningReport || '-',
          'Shift Pagi - Dep Level': r.morningDependency || '-',
          'Shift Pagi - Terapi': r.morningTherapy || '-',
          'Shift Sore - Laporan': r.afternoonReport || '-',
          'Shift Sore - Dep Level': r.afternoonDependency || '-',
          'Shift Sore - Terapi': r.afternoonTherapy || '-',
          'Shift Malam - Laporan': r.nightReport || '-',
          'Shift Malam - Dep Level': r.nightDependency || '-',
          'Shift Malam - Terapi': r.nightTherapy || '-',
          'Prosedur Operasi': r.surgeryProcedure || '-',
          'Operator Bedah': r.surgeryOperator || '-',
          'Status Operasi': r.surgeryStatus || '-',
          'Diagnosa Update Shift': r.diagnosis || '-',
          'Catatan Admin': r.adminNote || '-'
        };
      });
      const wsDaily = XLSX.utils.json_to_sheet(dailyReportsData);
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Laporan Shift Keperawatan Bedah');

      // Sheet 3: Doctor Visits
      const visitsData = (appData?.doctorVisits || []).map((v: any, idx: number) => ({
        'No': idx + 1,
        'No RM': v.noRM || '-',
        'Nama Pasien': v.patientName || '-',
        'Tanggal Visite': v.date || '-',
        'Waktu': v.time || '-',
        'Nama Dokter DPJP': v.doctorName || '-',
        'SMF Spesialisasi': v.smf || '-',
        'Metode Pembayaran': v.paymentMethod || '-',
        'Status Kehadiran': v.attendanceStatus || '-',
        'Peran Visite': v.visitRole || '-',
        'Dicatat Oleh': v.recordedBy || '-'
      }));
      const wsVisits = XLSX.utils.json_to_sheet(visitsData);
      XLSX.utils.book_append_sheet(wb, wsVisits, 'Rujukan Visite DPJP & Konsul');

      // Sheet 4: Quality Measurements
      const qualityData = (appData?.qualityMeasurements || []).map((q: any, idx: number) => {
        const indicator = masterData.qualityIndicators?.find((ind: any) => ind.id === q.indicatorId);
        return {
          'No': idx + 1,
          'Tanggal': q.date || '-',
          'Kategori Indikator': indicator?.category || '-',
          'Nama Indikator Mutu': indicator?.title || '-',
          'Numerator / Pembilang': q.numeratorValue ?? 0,
          'Denominator / Penyebut': q.denominatorValue ?? 0,
          'Pencapaian (%)': q.denominatorValue > 0 ? ((q.numeratorValue / q.denominatorValue) * 100).toFixed(1) + '%' : '0%',
          'Unit': q.unit || 'Ruang Bedah',
          'Catatan': q.notes || '-'
        };
      });
      const wsQuality = XLSX.utils.json_to_sheet(qualityData);
      XLSX.utils.book_append_sheet(wb, wsQuality, 'Indikator Mutu Ruang Bedah');

      XLSX.writeFile(wb, `Database_SIP_SIMANTAP_Ruang_Bedah_Full_${new Date().toISOString().split('T')[0]}.xlsx`);
      notify("Database terekstraksi sukses menjadi Excel!");
    } catch (err: any) {
      alert('Gagal mengekspor data ke Excel: ' + err.message);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'SYSTEM') {
      fetchBackups();
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab === 'THEME') {
      setTempSettings(prev => {
        if (!prev || Object.keys(prev).length === 0) {
          return masterData.settings || {};
        }
        return prev;
      });
    } else {
      setTempSettings({});
    }
  }, [activeTab]);

  const notify = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3000);
  };

  const normalizeWallpaperUrl = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.includes('drive.google.com')) {
      const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                          trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        return `https://lh3.googleusercontent.com/d/${fileId}`;
      }
    }
    return trimmed;
  };

  const handleSaveMaster = (newData: MasterData) => {
    onSave(newData);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, targetKey: 'logoUrl' | 'logoLetterLeftUrl' | 'logoLetterRightUrl' = 'logoUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/png');
        
        setTempSettings(prev => ({
          ...prev,
          [targetKey]: compressedBase64
        }));
        notify("Logo berhasil diunggah & dikompresi. Silakan klik 'Simpan Perubahan' di bawah.");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'login' | 'app') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (optional, but good for UX)
    if (file.size > 5 * 1024 * 1024) {
      notify("Ukuran file terlalu besar. Mencoba mengompresi...");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas for compression
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max width/height for wallpaper to keep size low (e.g., Full HD is usually enough)
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 720;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);

        // Compress as JPEG with 0.6 quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        
        setTempSettings(prev => ({
          ...prev,
          [type === 'login' ? 'loginWallpaperUrl' : 'appWallpaperUrl']: compressedBase64
        }));
        notify("Wallpaper berhasil dikompresi. Silakan klik 'Simpan Perubahan' di bawah.");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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
        if (onUpdateAppData && appData) {
          const deleted = [...(appData.deletedIds || [])];
          const userKey = `USER_${deleteTarget.id}`;
          if (!deleted.includes(userKey)) {
            deleted.push(userKey);
          }
          // Register in local device deleted registry for active protection
          registerDeletedId(userKey);

          const updatedSettings = {
            ...(newData.settings || {}),
            settingsTimestamp: new Date().toISOString()
          };
          onUpdateAppData({
            ...appData,
            deletedIds: deleted,
            masterData: {
              ...newData,
              settings: updatedSettings
            }
          }, true).then(() => {
            notify("Akun pengguna berhasil dihapus.");
            setDeleteTarget(null);
          }).catch(() => {
            notify("Gagal menghapus akun pengguna.");
          });
          return;
        }
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
            <div className="flex items-center gap-1 transition-opacity">
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
    <div className="bg-white/80 backdrop-blur-md rounded-[2rem] shadow-sm border min-h-[750px] flex flex-col overflow-hidden relative">
      
      {showNotification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-8 py-4 rounded-full flex items-center gap-3 shadow-2xl border border-blue-500/50 animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-400"/>
          <span className="text-xs font-black uppercase tracking-widest">{showNotification}</span>
        </div>
      )}

      <div className="flex border-b overflow-x-auto bg-slate-50/20 shrink-0">
        {[
          { id: 'STAFF', icon: <UserIcon size={16}/>, label: 'Pengguna & Staf', roles: ['SUPER_ADMIN', 'BIDANG', 'KARU', 'SEKRU', 'ADMIN_RUANGAN'] },
          { id: 'STRUCTURE', icon: <Map size={16}/>, label: 'Hierarki Unit', roles: ['SUPER_ADMIN', 'BIDANG'] },
          { id: 'MEDICS', icon: <Activity size={16}/>, label: 'DPJP & Medis', roles: ['SUPER_ADMIN', 'BIDANG', 'KARU', 'SEKRU', 'ADMIN_RUANGAN'] },
          { id: 'QUALITY', icon: <ClipboardCheck size={16}/>, label: 'Kertas Kerja Mutu', roles: ['SUPER_ADMIN', 'BIDANG', 'KARU', 'PIC'] },
          { id: 'THEME', icon: <Map size={16}/>, label: 'Personalisasi Tema', roles: ['SUPER_ADMIN', 'BIDANG'] },
          { id: 'SYSTEM', icon: <Settings2 size={16}/>, label: 'Koneksi Cloud', roles: ['SUPER_ADMIN'] },
          { id: 'REFS', icon: <Database size={16}/>, label: 'Referensi & Form', roles: ['SUPER_ADMIN'] }
        ].filter(tab => tab.roles.includes(currentUser?.role || '')).map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)} 
            className={`px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] flex shrink-0 items-center gap-3 transition-all ${activeTab === tab.id ? 'text-blue-600 border-b-4 border-blue-600 bg-white/50' : 'text-slate-400 hover:bg-white/30'}`}
            style={{ color: activeTab === tab.id ? undefined : (masterData.settings?.fontColor ? `${masterData.settings.fontColor}cc` : undefined) }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30">
        
        {activeTab === 'STAFF' && (
          <div className="p-10 space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">Manajemen Pengguna</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Kelola kredensial, import massal, dan hak akses petugas ruangan.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                  <input 
                    type="text" 
                    placeholder="Cari nama, NIP, username..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:border-blue-500 outline-none w-64 shadow-xs"
                  />
                </div>

                <button
                  onClick={() => setIsRbacModalOpen(true)}
                  className="px-5 py-3.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <ShieldCheck size={16} /> Matriks RBAC
                </button>

                <button
                  onClick={handleDownloadUserTemplate}
                  className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
                  title="Unduh Template Excel Import User"
                >
                  <Download size={16} /> Template Excel
                </button>

                <label className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20">
                  <FileSpreadsheet size={16} /> Import Excel
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportUsersExcel}
                    className="hidden"
                  />
                </label>

                <Button onClick={() => setIsAddUserOpen(true)} className="rounded-2xl px-6 py-3.5 shadow-xl shadow-blue-100 uppercase text-[10px] font-black tracking-widest">
                  <Plus size={18} className="mr-1.5"/> Tambah Akun
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
                            <div className="flex justify-end gap-2 transition-all">
                              {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BIDANG' || ((currentUser?.role === 'KARU' || currentUser?.role === 'SEKRU' || currentUser?.role === 'ADMIN_RUANGAN') && u.unit === currentUser?.unit)) && (
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
                                <div className="flex justify-end gap-2 transition-all">
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
                    <RefreshCw className={`text-emerald-600 ${serverConfig.enableGoogleSheets ? 'animate-spin-slow' : ''}`} size={32}/> Dual-Engine Database & Spreadsheet Sync
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Hubungkan database dengan Google Sheets secara GRATIS melalui integrasi Google Apps Script secara real-time.
                  </p>
               </div>
            </div>

            {/* BANNER INFORMASI GRATIIS */}
            <div className="p-6 bg-emerald-50/50 border border-emerald-100/80 rounded-[1.5rem] flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                💡
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider">💡 INFORMASI SINKRONISASI DATABASE: 100% GRATIS SELAMANYA</h4>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  Sistem sinkronisasi rekam medis utama menggunakan <strong>Metode 1 (Google Apps Script Web App)</strong>. Metode ini memanfaatkan platform Google Apps Script bawaan akun Google pribadi Anda, sehingga <strong>100% GRATIS SELAMANYA</strong> tanpa pendaftaran Google Cloud Console komersial berbayar, tanpa setup billing, dan tanpa meminta pendaftaran kartu kredit. Data Anda tersimpan aman, rahasia, dan terhubung secara global di Google Drive milik Anda sendiri.
                </p>
              </div>
            </div>

            {/* LINK AKSES PUBLIK (TIDAK BUTUH LOGIN GOOGLE) */}
            <div className="p-6 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-100 rounded-[1.5rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
                  <Globe size={24} className="text-blue-600 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-blue-800 uppercase tracking-widest flex items-center gap-2">
                    🌐 Link Akses Publik Aplikasi (Tanpa Butuh Login Google)
                  </h4>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    Gunakan link di bawah ini agar user lain dapat langsung membuka aplikasi tanpa perlu login ke akun Google.
                  </p>
                  <a 
                    href="https://ais-pre-5yx5np5byvmf4dw3uf7moi-256092545608.asia-southeast1.run.app" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-xs font-mono text-blue-600 hover:underline select-all font-bold break-all inline-block mt-1"
                  >
                    https://ais-pre-5yx5np5byvmf4dw3uf7moi-256092545608.asia-southeast1.run.app
                  </a>
                </div>
              </div>
              <button
                onClick={handleCopyLink}
                className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 ${copiedLink ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                {copiedLink ? 'BERHASIL DISALIN!' : 'SALIN LINK APLIKASI'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* KOLOM 1: METODE 1 - GOOGLE APPS SCRIPT WEB APP (100% GRATIS SELAMANYA) */}
              <div className="bg-white p-8 rounded-[2rem] border shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center">
                    <Cloud className="text-emerald-700" size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Metode 1: Google Apps Script</h4>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase tracking-wider rounded-md">100% GRATIS</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Sangat Mudah, Otomatis & Terkoneksi Global</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                        TAUTAN GOOGLE APPS SCRIPT WEB APP
                      </label>
                      <span className="text-[8px] text-slate-400 font-medium block mt-0.5">
                        Konfigurasikan tautan deployment Apps Script Anda (pastikan dideploy sebagai 'Anyone' di editor script Anda).
                      </span>
                    </div>
                    <div className="relative">
                      <Map size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-3.5 text-xs font-mono text-slate-600 outline-none focus:ring-2 focus:ring-[#144272] focus:bg-white"
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={manualApiUrl}
                        onChange={(e) => setManualApiUrl(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={async () => {
                        if (!manualApiUrl.trim()) {
                          alert("Tautan Apps Script tidak boleh kosong!");
                          return;
                        }
                        try {
                          const res = await fetch('/api/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ appsScriptUrl: manualApiUrl })
                          });
                          const result = await res.json();
                          if (result.success) {
                            saveApiUrl(manualApiUrl);
                            setServerConfig(prev => ({ ...prev, hasAppsScriptUrl: true, appsScriptUrl: manualApiUrl, enableGoogleSheets: true }));
                            notify("Tautan Terkoneksi & Tersimpan Global!");
                          } else {
                            notify("Gagal simpan global.");
                          }
                        } catch (e) {
                          notify("Error simpan global.");
                        }
                      }}
                      className="w-full py-3 bg-[#144272] hover:bg-[#1d5b9c] text-white text-[10px] font-black uppercase rounded-2xl shadow-lg transition-all"
                    >
                      UJI KONEKSI & SIMPAN URL SCRIPT
                    </Button>
                  </div>

                  <hr className="border-slate-100" />

                  <div className="space-y-1.5">
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                        ID GOOGLE SPREADSHEET UTAMA
                      </label>
                      <span className="text-[8px] text-slate-400 font-medium block mt-0.5">
                        Masukkan ID Spreadsheet dari Google Drive Anda untuk memaksa penarikan data secara langsung.
                      </span>
                    </div>
                    <div className="relative">
                      <Database size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-3.5 text-xs font-mono text-slate-600 outline-none focus:ring-2 focus:ring-emerald-555 focus:bg-white"
                        placeholder="Masukkan ID Spreadsheet dari URL sheet Anda"
                        value={googleSpreadsheetId}
                        onChange={(e) => setGoogleSpreadsheetId(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={async () => {
                        if (!googleSpreadsheetId.trim()) {
                          alert("ID Spreadsheet tidak boleh kosong!");
                          return;
                        }
                        try {
                          const res = await fetch('/api/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ googleSpreadsheetId })
                          });
                          const result = await res.json();
                          if (result.success) {
                            notify("ID Spreadsheet Tersimpan!");
                            if (onTriggerSync) {
                              const success = await onTriggerSync(true); // Trigger force pull bypassing cache!
                              if (success) {
                                notify("Koneksi & Sinkronisasi Paksa Sukses!");
                              } else {
                                alert("Gagal melakukan sinkronisasi paksa.");
                              }
                            }
                          } else {
                            notify("Gagal menautkan spreadsheet.");
                          }
                        } catch (e) {
                          notify("Error menautkan spreadsheet.");
                        }
                      }}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-2xl shadow-lg transition-all"
                    >
                      HUBUNGKAN & SINKRONKAN PAKSA
                    </Button>
                  </div>
                </div>
              </div>

              {/* KOLOM 2: STATUS, MANUAL SYNC ENGINE & METODE LANJUTAN */}
              <div className="bg-white p-8 rounded-[2rem] border shadow-sm space-y-6">
                <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Status & Manual Sync Engine (Pull & Push)</h4>

                <div className="space-y-4">
                  {/* Status DB Mode */}
                  <div className={`p-6 rounded-3xl border transition-all duration-300 ${serverConfig.enableGoogleSheets ? 'bg-emerald-50/20 border-emerald-100' : 'bg-blue-50/20 border-blue-100'} flex items-center justify-between gap-4`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${serverConfig.enableGoogleSheets ? 'bg-emerald-500 text-white font-bold' : 'bg-blue-600 text-white font-bold'} rounded-xl flex items-center justify-center`}>
                        <Database size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800 uppercase tracking-tight">
                          {serverConfig.enableGoogleSheets ? 'Google Sheets Terintegrasi' : 'Standalone Database Aktif'}
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold leading-tight mt-0.5">
                          {serverConfig.enableGoogleSheets 
                            ? 'Mencadangkan & sinkronisasi data secara otomatis secara real-time.' 
                            : 'Sinkronisasi instan real-time lokal antar-perangkat.'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Double Toggle Custom */}
                    <button
                      type="button"
                      onClick={async () => {
                        const nextVal = !serverConfig.enableGoogleSheets;
                        try {
                          const res = await fetch('/api/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ enableGoogleSheets: nextVal })
                          });
                          const result = await res.json();
                          if (result.success) {
                            setServerConfig(prev => ({ ...prev, enableGoogleSheets: nextVal }));
                            notify(nextVal ? "Google Sheets Sync Diaktifkan!" : "Google Sheets Sync Dinonaktifkan!");
                          }
                        } catch (e) {
                          notify("Gagal mendaftarkan perubahan mode database.");
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus:ring-0 ${serverConfig.enableGoogleSheets ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${serverConfig.enableGoogleSheets ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Pull & Push Sync Panel */}
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">Dinamika Manual Sync Engine (Steril)</h5>
                      <span className={`px-2.5 py-1 text-[8px] font-black rounded-lg ${
                        syncStatus === 'SYNCING' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                        syncStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' :
                        syncStatus === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        STATUS: {syncStatus || 'IDLE'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        disabled={isPulling || syncStatus === 'SYNCING'}
                        onClick={async () => {
                          setIsPulling(true);
                          if (onTriggerSync) {
                            const success = await onTriggerSync(true); // Always force sync pull when clicking manual Pull
                            if (success) notify("Data Pull (Unduh) Sukses Terintegrasi!");
                            else alert("Gagal mengunduh data. Periksa isi Deployment URL!");
                          }
                          setIsPulling(false);
                        }}
                        className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <RefreshCw size={12} className={isPulling ? 'animate-spin' : ''} /> PULL (Unduh)
                      </Button>

                      <Button 
                        disabled={isPushing || syncStatus === 'SYNCING'}
                        onClick={async () => {
                          setIsPushing(true);
                          if (onUpdateAppData && appData) {
                            try {
                              await onUpdateAppData(appData, true);
                              notify("Data Push (Unggah) Sukses Menimpa Cloud!");
                            } catch (e) {
                              alert("Gagal melakukan steril Push.");
                            }
                          }
                          setIsPushing(false);
                        }}
                        className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Upload size={12} className={isPushing ? 'animate-pulse' : ''} /> PUSH (Unggah)
                      </Button>
                    </div>

                    <p className="text-[8px] text-slate-400 font-bold uppercase leading-relaxed text-center">
                      *Tindakan steril di atas menjaga keutuhan baris rekam medis tanpa merusak cache.
                    </p>
                  </div>

                  {/* COLLAPSIBLE ACCORDION FOR GOOGLE OAUTH */}
                  <div className="border border-slate-200 rounded-3xl overflow-hidden bg-slate-50 transition-all">
                    <button 
                      onClick={() => setIsAdvancedOauthOpen(!isAdvancedOauthOpen)}
                      className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Lock className="text-slate-500" size={16} />
                        <div>
                          <span className="text-xs font-black text-slate-700 uppercase tracking-tight block">Metode 2 (Lanjutan): Google OAuth API</span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">Khusus Pengembang / Developer Google Cloud</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-450 font-black">
                        {isAdvancedOauthOpen ? 'Sembunyikan ▴' : 'Tampilkan ▾'}
                      </span>
                    </button>

                    {isAdvancedOauthOpen && (
                      <div className="p-6 border-t border-slate-200 space-y-4 bg-white animate-fade-in">
                        <div className="bg-amber-50 text-amber-950 p-4 rounded-2xl border border-amber-100 text-[10px] leading-relaxed font-bold space-y-1">
                          <p className="text-amber-800 uppercase flex items-center gap-1">
                            <AlertTriangle size={12} /> PEMBERITAHUAN METODE OAUTH DEVELOPER:
                          </p>
                          <p className="font-medium text-slate-600 normal-case">
                            Metode OAuth ini opsional dan memerlukan verifikasi kredensial Google Cloud Developer. Anda mungkin melihat peringatan keamanan atau pembatasan kuota jika kuota developer terlewati. Kami merekomendasikan menggunakan <strong>Metode 1 (Web Option)</strong> di sebelah kiri yang sepenuhnya gratis, mudah, dan bebas dari pembatasan.
                          </p>
                        </div>

                        {!googleAuthToken ? (
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 font-sans">Google OAuth Client ID</label>
                              <input 
                                type="text" 
                                className="w-full bg-slate-50 border rounded-2xl px-5 py-3.5 text-xs font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Masukkan Client ID dari Google Cloud Console"
                                value={googleClientId}
                                onChange={(e) => setGoogleClientId(e.target.value)}
                              />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl border text-[10px] leading-relaxed text-slate-400 font-medium space-y-2">
                              <p className="font-bold text-[#144272] uppercase">💡 Cara membuat OAuth Client ID:</p>
                              <ol className="list-decimal list-inside space-y-1 text-[9px] font-bold">
                                <li>Buka kredensial di <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-600 underline">Google Cloud Console</a>.</li>
                                <li>Buat Kredensial &gt; <strong>OAuth Client ID</strong> (tipe: <em>Web Application</em>).</li>
                                <li>Authorized Javascript Origins: <span className="text-indigo-600 font-mono select-all font-black">{window.location.origin}</span></li>
                              </ol>                    
                            </div>

                            <Button 
                              onClick={handleGoogleLogin}
                              className="w-full py-4 bg-[#144272] hover:bg-[#1d5b9c] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
                            >
                              <Lock size={14} /> Hubungkan Akun Google (Login Popup)
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Logged in User Badge */}
                            <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                {googleUser?.picture ? (
                                  <img 
                                    src={googleUser.picture} 
                                    alt="Google User" 
                                    className="w-12 h-12 rounded-full border-2 border-emerald-400 shadow-sm"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center text-lg font-black uppercase">
                                    {googleUser?.name?.slice(0, 1) || 'G'}
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs font-black text-slate-800 uppercase tracking-tight">{googleUser?.name || 'Terkoneksi'}</div>
                                  <div className="text-[10px] text-slate-400 font-black tracking-wider lowercase mt-0.5">{googleUser?.email || 'Akun Aktif'}</div>
                                </div>
                              </div>
                              <button 
                                onClick={handleGoogleDisconnect}
                                className="p-3 text-red-500 hover:bg-slate-100 rounded-xl transition-all border border-red-100 bg-white shadow-sm font-bold text-xs"
                                title="Putuskan Akun"
                              >
                                <LogOut size={16} />
                              </button>
                            </div>

                            {/* Template Generator Panel */}
                            <div className="p-6 bg-slate-50 rounded-3xl border space-y-4">
                              <div>
                                <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">1-Click Google Drive Template Creator</h5>
                                <p className="text-[10px] text-slate-400 font-medium mt-1 leading-normal">
                                  Buat Google Spreadsheet database template steril baru langsung di dalam penyimpanan Google Drive Anda dengan sekali klik.
                                </p>
                              </div>

                              <Button 
                                onClick={handleCreateTemplate}
                                disabled={isCreatingTemplate}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md flex items-center justify-center gap-2"
                              >
                                {isCreatingTemplate ? 'Sedang Memproses...' : 'Buat Spreadsheet Baru'}
                              </Button>

                              {createdSpreadsheetId && (
                                <div className="p-4 bg-emerald-50 text-emerald-950 border border-emerald-100 rounded-2xl space-y-2">
                                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-emerald-500" /> Spreadsheet Berhasil Dibuat!
                                  </p>
                                  <div className="flex gap-2">
                                    <Button 
                                      onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${createdSpreadsheetId}/edit`, '_blank')}
                                      className="px-4 py-2 bg-[#144272] hover:bg-[#1f5891] text-white text-[9px] font-black uppercase rounded-lg"
                                    >
                                      Buka Spreadsheet
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsConfirmClearCacheOpen(true);
                    }}
                    className="text-red-400 hover:text-red-55 hover:bg-red-50 text-[10px] uppercase tracking-wide font-black"
                  >
                    Clear Local Cache & Refresh
                  </Button>
                </div>
              </div>

            </div>

            {/* BACKUP, RESTORE & DATA EXTRACTION SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 shrink-0">
               {/* CARD 1: EXPORT & EXTRACTION */}
               <div className="bg-white p-8 rounded-[2rem] border shadow-sm space-y-6 flex flex-col justify-between">
                 <div className="space-y-4">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                       <Upload size={20} className="text-emerald-600" />
                     </div>
                     <div>
                       <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Ekstraksi & Unduh Database</h4>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Format Excel Komprehensif (.xlsx)</p>
                     </div>
                   </div>
                   <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                     Ekstrak seluruh data rekam medis, laporan shift perawat, rujukan visite DPJP, kunjungan, serta kertas kerja indikator mutu secara utuh dengan sekali klik. Sistem akan menyusun tab spreadsheet terpisah yang siap dianalisis atau dipresentasikan.
                   </p>
                   
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                     <h5 className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Struktur Spreadsheet Hasil Ekstraksi:</h5>
                     <ul className="text-[10px] text-slate-500 font-semibold space-y-1">
                       <li className="flex items-center gap-2">🟢 <span className="font-bold text-slate-700">Tab 1:</span> Daftar Pasien Matriks Ruang Bedah (Identitas & Diagnosa Utama)</li>
                       <li className="flex items-center gap-2">🟢 <span className="font-bold text-slate-700">Tab 2:</span> Laporan Shift Keperawatan Bedah (Komparasi Dependensi & Terapi)</li>
                       <li className="flex items-center gap-2">🟢 <span className="font-bold text-slate-700">Tab 3:</span> Rujukan Visite DPJP & Konsultan (SMF Spesialis Bedah)</li>
                       <li className="flex items-center gap-2">🟢 <span className="font-bold text-slate-700">Tab 4:</span> Indikator Mutu Pemicu (Numerator/Denominator Kertas Kerja Ruang Bedah)</li>
                     </ul>
                   </div>
                 </div>

                 <Button
                   onClick={handleExportAllToExcel}
                   className="w-full py-4 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2.5 transition-all"
                 >
                   📥 Ekstrak Seluruh Database ke Excel
                 </Button>
               </div>

               {/* CARD 2: BACKUP & RESTORE */}
               <div className="bg-white p-8 rounded-[2rem] border shadow-sm space-y-6">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center shrink-0">
                       <Database size={20} className="text-blue-600" />
                     </div>
                     <div>
                       <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Pencadangan & Restore Data</h4>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Auto Backup (Daily, Weekly, Monthly, Yearly)</p>
                     </div>
                   </div>
                   <button 
                     onClick={fetchBackups} 
                     disabled={isLoadingBackups} 
                     className="p-2 hover:bg-slate-100 rounded-lg text-slate-550 border border-slate-150 transition-all shadow-sm"
                     title="Segarkan daftar"
                   >
                     <RefreshCw size={14} className={isLoadingBackups ? 'animate-spin' : ''} />
                   </button>
                 </div>

                 {/* Pembuatan Backup Manual */}
                 <div className="p-5 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
                   <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-widest block font-mono">Buat Titik Pemulihan (Manual Backup Snapshot)</h5>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       placeholder="Catatan backup (cth: Sebelum update unit rawat bedah)..."
                       className="flex-grow bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                       value={backupNote}
                       onChange={(e) => setBackupNote(e.target.value)}
                     />
                     <Button
                       onClick={handleCreateBackup}
                       disabled={isCreatingBackup}
                       className="bg-[#144272] hover:bg-[#1d5b9c] text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl shrink-0"
                     >
                       {isCreatingBackup ? 'Sedang Menyimpan...' : 'Backup Data'}
                     </Button>
                   </div>
                 </div>

                 {/* Daftar Backup */}

                  {/* Pencadangan & Pemulihan Lokal (Dual-Engine) */}
                  <div className="py-5 border-t border-b border-slate-100 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs">💾</span>
                      <h5 className="text-[10px] font-black text-slate-700 uppercase tracking-widest block font-mono">Pencadangan & Pemulihan Lokal (Dual-Engine Client)</h5>
                    </div>
                    
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Unduh seluruh basis data ke penyimpanan lokal komputer Anda, atau lakukan restore data rekam medis secara instan dari berkas backup <code className="bg-indigo-50 text-indigo-700 font-bold font-mono px-1 py-0.5 rounded text-[10px]">.json</code> atau <code className="bg-emerald-50 text-emerald-700 font-bold font-mono px-1 py-0.5 rounded text-[10px]">.xlsx</code> secara client-side.
                    </p>

                    {/* Export Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={handleExportLocalJSON}
                        className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border-none cursor-pointer shadow-sm active:scale-95"
                      >
                        📥 Unduh Backup (.json)
                      </button>
                      <button
                        onClick={handleExportLocalXLSX}
                        className="py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border-none cursor-pointer shadow-sm active:scale-95"
                      >
                        📥 Unduh Backup (.xlsx)
                      </button>
                    </div>

                    {/* Drag-and-Drop Dropzone Uploader */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const file = e.dataTransfer.files[0];
                        if (file) processImportFile(file);
                      }}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center gap-2 ${
                        dragOver 
                          ? 'border-indigo-600 bg-indigo-50/50 scale-[1.01]' 
                          : 'border-slate-200 hover:border-slate-350 bg-slate-50/40 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-2xl animate-pulse">📂</span>
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-none mt-1">
                        Seret & Lepas Berkas Backup Di Sini
                      </p>
                      <p className="text-[9px] text-slate-450 font-semibold leading-normal">
                        Format yang didukung: <code className="font-bold text-slate-600 font-mono">.json</code> atau <code className="font-bold text-slate-600 font-mono">.xlsx</code>
                      </p>
                      <label className="mt-2 py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-250 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer shadow-sm active:scale-95 transition-all">
                        Pilih Berkas Manual
                        <input
                          type="file"
                          accept=".json,.xlsx"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) processImportFile(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                 <div className="space-y-3">
                   <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-widest block font-mono">Hasil Pencadangan Aktif di Server</h5>
                   <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-100 custom-scrollbar">
                     {isLoadingBackups ? (
                       <div className="p-6 text-center text-xs font-semibold text-slate-450">Sedang memuat daftar backup...</div>
                     ) : serverBackups.length === 0 ? (
                       <div className="p-6 text-center text-xs font-semibold text-slate-400">Tidak ada backup yang tersimpan di server.</div>
                     ) : (
                       serverBackups.map((bk: any) => {
                         let labelBg = 'bg-slate-100 text-slate-600';
                         let friendlyName = bk.backupType;
                         if (bk.backupType === 'daily') { labelBg = 'bg-teal-100 text-teal-850 font-black'; friendlyName = 'HARIAN'; }
                         else if (bk.backupType === 'weekly') { labelBg = 'bg-blue-100 text-blue-800 font-black'; friendlyName = 'MINGGUAN'; }
                         else if (bk.backupType === 'monthly') { labelBg = 'bg-indigo-100 text-indigo-850 font-black'; friendlyName = 'BULANAN'; }
                         else if (bk.backupType === 'yearly') { labelBg = 'bg-purple-100 text-purple-800 font-black'; friendlyName = 'TAHUNAN'; }
                         else if (bk.backupType === 'manual') { labelBg = 'bg-emerald-100 text-emerald-850 font-black'; friendlyName = 'MANUAL'; }

                         const formattedSize = bk.size ? (bk.size / 1024).toFixed(1) + ' KB' : '-';

                         return (
                           <div key={bk.filename} className="p-3.5 hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs leading-relaxed">
                             <div className="space-y-1 flex-1 pr-2">
                               <div className="flex items-center gap-2 flex-wrap">
                                 <span className={`px-2 py-0.5 text-[8px] rounded-md tracking-wider ${labelBg}`}>
                                   {friendlyName}
                                 </span>
                                 <span className="font-mono text-[10px] text-slate-500 font-semibold">{new Date(bk.timestamp).toLocaleString('id-ID')}</span>
                                 <span className="text-[9px] text-slate-350 font-semibold font-mono">({formattedSize})</span>
                               </div>
                               <p className="text-[11px] text-slate-600 font-semibold">
                                 {bk.note || (bk.backupType.startsWith('auto') ? `Sistem Auto-Backup (${bk.backupKey})` : bk.filename)}
                               </p>
                             </div>
                             
                             <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                               <Button
                                 onClick={() => handleRestoreBackup(bk.filename)}
                                 disabled={isRestoringBackup !== null}
                                 className="px-2.5 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm"
                               >
                                 🔄 {isRestoringBackup === bk.filename ? 'Restoring...' : 'Restore'}
                               </Button>
                               <button
                                 onClick={() => handleDeleteBackup(bk.filename)}
                                 disabled={isRestoringBackup !== null}
                                 className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg border border-transparent hover:border-red-100 transition-all font-bold ml-1 text-xs"
                                 title="Hapus backup"
                               >
                                 🗑️
                               </button>
                             </div>
                           </div>
                         );
                       })
                     )}
                   </div>
                 </div>
               </div>
            </div>

            {/* AI SYSTEM HOLISTIC SELF-REPAIR & AUTO-HEALING ENGINE (EXPLICIT USER INTENT ADHERED) */}
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-[#144272] text-white p-8 md:p-10 rounded-[2.5rem] border border-indigo-500/20 shadow-2xl space-y-8 relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/15 rounded-full filter blur-[80px] -mr-20 -mt-20 pointer-events-none animate-pulse"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-3.5 w-3.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                    </span>
                    <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/20 rounded-full text-[9px] font-black uppercase tracking-widest text-indigo-300">
                      SISTEM HEALING MANDIRI AI
                    </span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    🧠 AI Self-Healing & Autodiagnostik Sistem
                  </h3>
                  <p className="text-slate-300 text-xs font-semibold max-w-2xl leading-relaxed">
                    Sistem pemulihan mandiri bertenaga kecerdasan buatan (Gemini). AI akan memindai database rekam medis, men-deduplikasi rekam medis ganda secara steril, memulihkan stempel waktu sinkronisasi, dan otomatis menyelaras-ulang data indikator mutu & tingkat ketergantungan pasien dari laporan keperawatan secara aman tanpa menghapus entri yang sudah ada.
                  </p>
                </div>

                <Button
                  disabled={isSelfHealing}
                  onClick={async () => {
                    setIsSelfHealing(true);
                    setHealingLogs(['[START] Menjalankan pemindaian dan perbaikan di browser...']);
                    try {
                      await new Promise(resolve => setTimeout(resolve, 800));
                      setHealingLogs(prev => [...prev, '[INFO] Cache browser berhasil diverifikasi. Mengirim instruksi pemulihan ke AI Server...']);
                      
                      const res = await fetch('/api/ai-self-heal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      const result = await res.json();
                      if (result.success) {
                        setHealingLogs(prev => [...prev, ...result.logs, '[COMPLETE] AI berhasil mensterilkan database & memperbaiki bug!']);
                        setHealingAiMessage(result.aiExplanation || '');
                        notify("Sistem Berhasil Diperbaiki oleh AI!");
                        
                        if (onTriggerSync) {
                          await onTriggerSync(true);
                        }
                      } else {
                        setHealingLogs(prev => [...prev, '[ERROR] AI Server gagal menyelesaikan perbaikan: ' + (result.error || 'Unknown Error')]);
                      }
                    } catch (err: any) {
                      setHealingLogs(prev => [...prev, '[ERROR] Gagal menghubungi AI Server: ' + err.message]);
                    } finally {
                      setIsSelfHealing(false);
                    }
                  }}
                  className="px-8 py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] transform transition-all text-white shadow-xl shadow-emerald-950/40 shrink-0 self-start md:self-center cursor-pointer"
                >
                  {isSelfHealing ? 'Sedang Memperbaiki Bug...' : 'JALANKAN AI AUTO-REPAIR SYSTEM'}
                </Button>
              </div>

              {/* Status checks grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-teal-400 font-bold block text-lg">✓ AKTIF</span>
                  <span className="text-[10px] text-slate-400 uppercase font-black">SANITY CHECKER</span>
                </div>
                <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-emerald-400 font-bold block text-lg">✓ SEHAT</span>
                  <span className="text-[10px] text-slate-400 uppercase font-black">INTEGRITAS CACHE</span>
                </div>
                <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-indigo-400 font-bold block text-lg">✓ STERIL</span>
                  <span className="text-[10px] text-slate-400 uppercase font-black">REKONSILIASI PENYAKIT</span>
                </div>
                <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-purple-400 font-bold block text-lg">✓ AUTO-FIX</span>
                  <span className="text-[10px] text-slate-400 uppercase font-black">DEPENDENCY ALIGNER</span>
                </div>
              </div>

              {/* Console & AI Analysis Log Area */}
              {(healingLogs.length > 0 || healingAiMessage) && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 border-t border-white/10 pt-6 animate-fade-in text-left">
                  
                  {/* Console logs */}
                  <div className="lg:col-span-5 bg-black/60 rounded-2xl p-6 border border-white/5 font-mono text-[11px] text-slate-300 space-y-2 h-64 overflow-y-auto custom-scrollbar">
                    <p className="text-orange-400 uppercase tracking-wider font-extrabold text-[9px] border-b border-white/10 pb-1 flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500 block"></span> CONSOLE OUTPUT LOGS
                    </p>
                    {healingLogs.map((log, index) => (
                      <div key={index} className={`leading-relaxed ${
                        log.startsWith('[ERROR]') ? 'text-red-400 font-bold' : 
                        log.startsWith('[SUCCESS]') ? 'text-emerald-400 font-bold' : 
                        log.startsWith('[REPAIR]') || log.startsWith('[AI') ? 'text-amber-400 font-bold' : 'text-slate-300'
                      }`}>
                        {log}
                      </div>
                    ))}
                    {isSelfHealing && (
                      <div className="text-teal-400 animate-pulse">_ Mengolah algoritma audit AI...</div>
                    )}
                  </div>

                  {/* Gemini explain */}
                  <div className="lg:col-span-7 bg-white/5 p-6 rounded-2xl border border-white/5 space-y-3 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] text-indigo-300 uppercase font-black tracking-widest flex items-center gap-2 mb-2">
                        💬 LAPORAN ANALISIS SISTEM UTAMA OLEH GEMINI AI
                      </h4>
                      {healingAiMessage ? (
                        <p className="text-xs text-slate-200 leading-relaxed font-semibold whitespace-pre-line">
                          {healingAiMessage}
                        </p>
                      ) : (
                        <div className="text-xs text-slate-400 italic">
                          {isSelfHealing ? 'AI sedang menganalisis kesehatan database rekam medis Anda...' : 'Klik jalankan untuk menerima ringkasan otomatisasi AI.'}
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center gap-2 italic">
                      <span>🩺</span> Semua data rekam medis saat ini dijamin aman dan aman digunakan di banyak perangkat sirkulasi Ruang Bedah.
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        )}

        {activeTab === 'THEME' && (
          <div className="p-10 space-y-8 animate-fade-in flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center shrink-0">
               <div>
                 <h3 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                   <Settings className="text-indigo-600" size={32}/> Personalisasi Tampilan
                 </h3>
                 <p className="text-xs text-slate-400 font-medium mt-1">Ubah identitas aplikasi, warna, dan tema sesuai unit pelayanan Anda.</p>
               </div>
               <Button 
                 onClick={async () => {
                   const timestamp = new Date().toISOString();
                   const updatedSettings = {
                     ...tempSettings,
                     settingsTimestamp: timestamp
                   };
                   handleSaveMaster({
                     ...masterData,
                     settings: updatedSettings
                   });
                   
                   try {
                     const response = await fetch('/api/config', {
                       method: 'POST',
                       headers: {
                         'Content-Type': 'application/json'
                       },
                       body: JSON.stringify(updatedSettings)
                     });
                     if (response.ok) {
                       const resJson = await response.json();
                       if (resJson.success && resJson.config) {
                         setTempSettings({
                           ...updatedSettings,
                           logoUrl: resJson.config.logoUrl || updatedSettings.logoUrl,
                            logoLetterLeftUrl: resJson.config.logoLetterLeftUrl || updatedSettings.logoLetterLeftUrl,
                            logoLetterRightUrl: resJson.config.logoLetterRightUrl || updatedSettings.logoLetterRightUrl,
                           loginWallpaperUrl: resJson.config.loginWallpaperUrl || updatedSettings.loginWallpaperUrl,
                           appWallpaperUrl: resJson.config.appWallpaperUrl || updatedSettings.appWallpaperUrl,
                         });
                       }
                     }
                   } catch (err) {
                     console.error('Failed to sync theme to server:', err);
                   }

                   notify("TEMA BERHASIL DITERAPKAN SECARA GLOBAL");
                 }} 
                 className="rounded-2xl px-10 py-4 shadow-xl shadow-blue-100 uppercase text-[10px] font-black tracking-widest bg-emerald-600 text-white"
               >
                 <RefreshCw size={18} className="mr-2"/> Simpan Perubahan Tema
               </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-l-4 border-blue-600 pl-4">Identitas Aplikasi</h4>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nama Aplikasi</label>
                       <input 
                         type="text"
                         className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                         value={tempSettings?.appName || 'SiMANTAP'}
                         onChange={e => setTempSettings({ ...tempSettings, appName: e.target.value })}
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Slogan / Deskripsi Singkat</label>
                       <input 
                         type="text"
                         className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                         value={tempSettings?.appSlogan || 'Sistem Manajemen Laporan Terpadu'}
                         onChange={e => setTempSettings({ ...tempSettings, appSlogan: e.target.value })}
                       />
                    </div>
                    <div className="space-y-1.5 pt-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pengaturan 1: Logo Aplikasi (Sidebar & Login)</label>
                       <div className="flex gap-3">
                          <input 
                            type="text"
                            className="flex-1 bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="URL Logo Aplikasi (PNG/JPEG/Base64)..."
                            value={tempSettings?.logoUrl || ''}
                            onChange={e => setTempSettings({ ...tempSettings, logoUrl: normalizeWallpaperUrl(e.target.value) })}
                          />
                          <label className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all flex items-center justify-center shrink-0">
                             <Upload size={20}/>
                             <input type="file" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'logoUrl')} />
                          </label>
                       </div>
                       {tempSettings?.logoUrl && (
                          <div className="mt-2 relative w-16 h-16 rounded-xl border border-slate-150 p-2 bg-white overflow-hidden group flex items-center justify-center">
                            <img src={tempSettings.logoUrl} className="max-w-full max-h-full object-contain" />
                            <button onClick={() => setTempSettings({ ...tempSettings, logoUrl: '' })} className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                              <Trash2 size={12}/>
                            </button>
                          </div>
                       )}
                       <p className="text-[8px] text-slate-400 font-medium italic mt-1">*Logo utama untuk visual branding pada bilah navigasi (sidebar) dan halaman masuk (login).</p>
                     </div>

                     {/* Pengaturan 2: Logo Kop Surat Kiri */}
                     <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pengaturan 2: Logo Kop Surat Kiri (Dokumen Cetak)</label>
                        <div className="flex gap-3">
                           <input 
                             type="text"
                             className="flex-1 bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                             placeholder="URL Logo Kop Kiri (PNG/JPEG/Base64)..."
                             value={tempSettings?.logoLetterLeftUrl || ''}
                             onChange={e => setTempSettings({ ...tempSettings, logoLetterLeftUrl: normalizeWallpaperUrl(e.target.value) })}
                           />
                           <label className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all flex items-center justify-center shrink-0">
                              <Upload size={20}/>
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'logoLetterLeftUrl')} />
                           </label>
                        </div>
                        {tempSettings?.logoLetterLeftUrl && (
                           <div className="mt-2 relative w-16 h-16 rounded-xl border border-slate-150 p-2 bg-white overflow-hidden group flex items-center justify-center">
                             <img src={tempSettings.logoLetterLeftUrl} className="max-w-full max-h-full object-contain" />
                             <button onClick={() => setTempSettings({ ...tempSettings, logoLetterLeftUrl: '' })} className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                               <Trash2 size={12}/>
                             </button>
                           </div>
                        )}
                        <p className="text-[8px] text-slate-400 font-medium italic mt-1">*Logo khusus diletakkan di sisi KIRI kop surat resmi.</p>
                     </div>

                     {/* Pengaturan 3: Logo Kop Surat Kanan */}
                     <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pengaturan 3: Logo Kop Surat Kanan (Dokumen Cetak)</label>
                        <div className="flex gap-3">
                           <input 
                             type="text"
                             className="flex-1 bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                             placeholder="URL Logo Kop Kanan (PNG/JPEG/Base64)..."
                             value={tempSettings?.logoLetterRightUrl || ''}
                             onChange={e => setTempSettings({ ...tempSettings, logoLetterRightUrl: normalizeWallpaperUrl(e.target.value) })}
                           />
                           <label className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all flex items-center justify-center shrink-0">
                              <Upload size={20}/>
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'logoLetterRightUrl')} />
                           </label>
                        </div>
                        {tempSettings?.logoLetterRightUrl && (
                           <div className="mt-2 relative w-16 h-16 rounded-xl border border-slate-150 p-2 bg-white overflow-hidden group flex items-center justify-center">
                             <img src={tempSettings.logoLetterRightUrl} className="max-w-full max-h-full object-contain" />
                             <button onClick={() => setTempSettings({ ...tempSettings, logoLetterRightUrl: '' })} className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                               <Trash2 size={12}/>
                             </button>
                           </div>
                        )}
                        <p className="text-[8px] text-slate-400 font-medium italic mt-1">*Logo khusus diletakkan di sisi KANAN kop surat resmi.</p>
                    </div>
                  </div>
               </div>

               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-l-4 border-indigo-600 pl-4">Warna & Latar Belakang</h4>
                  
                  <div className="space-y-4">
                    <div className="flex gap-4 items-center">
                       <div className="flex-1 space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Warna Utama (Hex)</label>
                          <div className="flex gap-3">
                            <input 
                              type="color"
                              className="w-12 h-12 rounded-xl overflow-hidden border-none cursor-pointer"
                              value={tempSettings?.themeColor || '#144272'}
                              onChange={e => setTempSettings({ ...tempSettings, themeColor: e.target.value })}
                            />
                            <input 
                              type="text"
                              className="flex-1 bg-slate-50 border-none rounded-xl p-3 text-xs font-mono font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                              value={tempSettings?.themeColor || '#144272'}
                              onChange={e => setTempSettings({ ...tempSettings, themeColor: e.target.value })}
                            />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Wallpaper Latar Belakang</label>
                       
                       <div className="bg-slate-50 p-6 rounded-3xl space-y-6">
                         <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1 italic">1. Halaman Login (Homescreen)</label>
                            <div className="flex gap-3">
                               <input 
                                 type="text"
                                 className="flex-1 bg-white border border-slate-100 rounded-2xl p-4 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                 placeholder="URL Wallpaper Login..."
                                 value={tempSettings?.loginWallpaperUrl || ''}
                                 onChange={e => setTempSettings({ ...tempSettings, loginWallpaperUrl: normalizeWallpaperUrl(e.target.value) })}
                               />
                               <label className="bg-blue-50 text-blue-600 p-4 rounded-2xl cursor-pointer hover:bg-blue-100 transition-all flex items-center justify-center shrink-0">
                                  <Upload size={20}/>
                                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleWallpaperUpload(e, 'login')} />
                               </label>
                            </div>
                            {tempSettings?.loginWallpaperUrl && (
                               <div className="mt-2 relative w-full h-16 rounded-xl border border-slate-100 overflow-hidden group">
                                 <img src={tempSettings.loginWallpaperUrl} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                                 <button onClick={() => setTempSettings({ ...tempSettings, loginWallpaperUrl: '' })} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                   <Trash2 size={10}/>
                                 </button>
                               </div>
                            )}
                         </div>

                         <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1 italic">2. Halaman Aplikasi (Dashboard)</label>
                            <div className="flex gap-3">
                               <input 
                                 type="text"
                                 className="flex-1 bg-white border border-slate-100 rounded-2xl p-4 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                 placeholder="URL Wallpaper Aplikasi..."
                                 value={tempSettings?.appWallpaperUrl || ''}
                                 onChange={e => setTempSettings({ ...tempSettings, appWallpaperUrl: normalizeWallpaperUrl(e.target.value) })}
                               />
                               <label className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl cursor-pointer hover:bg-indigo-100 transition-all flex items-center justify-center shrink-0">
                                  <Upload size={20}/>
                                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleWallpaperUpload(e, 'app')} />
                               </label>
                            </div>
                            {tempSettings?.appWallpaperUrl && (
                               <div className="mt-2 relative w-full h-16 rounded-xl border border-slate-100 overflow-hidden group">
                                 <img src={tempSettings.appWallpaperUrl} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                                 <button onClick={() => setTempSettings({ ...tempSettings, appWallpaperUrl: '' })} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                   <Trash2 size={10}/>
                                 </button>
                               </div>
                            )}
                         </div>
                       </div>
                       
                       <p className="text-[8px] text-slate-400 font-medium italic mt-1">*Anda bisa membedakan suasana halaman login dan area kerja aplikasi.</p>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Warna Font Dashboard (Adaptif)</label>
                       <div className="flex gap-3">
                          <input 
                            type="color"
                            className="w-12 h-12 rounded-xl overflow-hidden border-none cursor-pointer"
                            value={tempSettings?.fontColor || '#144272'}
                            onChange={e => setTempSettings({ ...tempSettings, fontColor: e.target.value })}
                          />
                          <input 
                            type="text"
                            className="flex-1 bg-slate-50 border-none rounded-xl p-3 text-xs font-mono font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            value={tempSettings?.fontColor || '#144272'}
                            onChange={e => setTempSettings({ ...tempSettings, fontColor: e.target.value })}
                          />
                       </div>
                       <p className="text-[8px] text-slate-400 font-medium italic mt-1">*Gunakan warna kontras (misal: putih jika wallpaper gelap, hitam jika wallpaper terang).</p>
                    </div>
                  </div>
               </div>

               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6 md:col-span-2">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-l-4 border-emerald-600 pl-4">Perilaku Sidebar</h4>
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl">
                     <div>
                        <h5 className="text-xs font-black text-slate-700 uppercase tracking-widest">Autohide Sidebar Otomatis</h5>
                        <p className="text-[10px] text-slate-400 font-medium">Sembunyikan menu samping secara otomatis untuk area kerja yang lebih luas.</p>
                     </div>
                     <button 
                       onClick={() => setTempSettings({ ...tempSettings, isSidebarAutohide: !tempSettings?.isSidebarAutohide })}
                       className={`w-14 h-8 rounded-full transition-all relative ${tempSettings?.isSidebarAutohide ? 'bg-emerald-500 shadow-lg shadow-emerald-100' : 'bg-slate-300'}`}
                     >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${tempSettings?.isSidebarAutohide ? 'left-7' : 'left-1'}`}></div>
                     </button>
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
                      <div className="flex items-center gap-1">
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
                      <div className="flex items-center gap-1">
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
                            <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 transition-opacity">
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
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity">
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
                            <div className="flex justify-end gap-2 transition-all">
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

            <section className="space-y-6 pt-6 border-t border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h4 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <AlertTriangle size={24} className="text-rose-600"/> Master Data Obat Restriksi (Warning & Monitoring)
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Konfigurasi daftar nama obat berpembatasan dan batas waktu (hari) maksimal penggunaan berturut-turut.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const drugName = prompt("Masukkan nama obat (contoh: Ketorolac):");
                    if (!drugName) return;
                    const maxDaysStr = prompt("Masukkan batas maksimal hari penggunaan berturut-turut (contoh: 3):");
                    if (!maxDaysStr) return;
                    const maxDays = parseInt(maxDaysStr, 10);
                    if (isNaN(maxDays)) {
                      alert("Jumlah hari harus berupa angka!");
                      return;
                    }
                    const currentRestricted = masterData.restrictedDrugs || [
                      { drugName: 'Ketorolac', maxDays: 3 },
                      { drugName: 'Ceftriaxone', maxDays: 5 },
                      { drugName: 'Meropenem', maxDays: 7 },
                      { drugName: 'Levofloxacin', maxDays: 5 },
                      { drugName: 'Dexamethasone', maxDays: 3 },
                      { drugName: 'Methylprednisolone', maxDays: 5 },
                      { drugName: 'Ranitidine', maxDays: 5 },
                      { drugName: 'Ketoprofen', maxDays: 3 },
                    ];
                    const updated = [...currentRestricted, { drugName, maxDays }];
                    handleSaveMaster({ ...masterData, restrictedDrugs: updated });
                    notify(`Aturan restriksi ${drugName} (${maxDays} hari) berhasil disimpan.`);
                  }}
                  className="rounded-2xl px-6 py-3.5 bg-rose-600 text-white font-black text-[10px] tracking-widest uppercase flex items-center gap-2 hover:bg-rose-700 transition-all cursor-pointer shadow-lg shadow-rose-100"
                >
                  <Plus size={16}/> Tambah Aturan Restriksi Obat
                </button>
              </div>
              <div className="bg-white border rounded-[2rem] p-6 shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {(() => {
                    const list = masterData.restrictedDrugs || [
                      { drugName: 'Ketorolac', maxDays: 3 },
                      { drugName: 'Ceftriaxone', maxDays: 5 },
                      { drugName: 'Meropenem', maxDays: 7 },
                      { drugName: 'Levofloxacin', maxDays: 5 },
                      { drugName: 'Dexamethasone', maxDays: 3 },
                      { drugName: 'Methylprednisolone', maxDays: 5 },
                      { drugName: 'Ranitidine', maxDays: 5 },
                      { drugName: 'Ketoprofen', maxDays: 3 },
                    ];
                    return list.map((item, index) => (
                      <div key={index} className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex items-center justify-between group hover:border-rose-100 transition-all">
                        <div>
                          <p className="font-extrabold text-xs text-slate-800 uppercase tracking-tight">{item.drugName}</p>
                          <p className="text-[10px] font-black text-rose-500 uppercase mt-1 bg-rose-50 px-2 py-0.5 rounded-md inline-block">Maksimal: {item.maxDays} Hari</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const newName = prompt("Ubah nama obat:", item.drugName);
                              if (!newName) return;
                              const newDaysStr = prompt("Ubah batas maksimal hari penggunaan berturut-turut:", String(item.maxDays));
                              if (!newDaysStr) return;
                              const newDays = parseInt(newDaysStr, 10);
                              if (isNaN(newDays)) {
                                alert("Jumlah hari harus berupa angka!");
                                return;
                              }
                              const updated = list.map((d, idx) => idx === index ? { drugName: newName, maxDays: newDays } : d);
                              handleSaveMaster({ ...masterData, restrictedDrugs: updated });
                              notify(`Aturan restriksi obat ${newName} berhasil diperbarui.`);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                            title="Edit Aturan"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Hapus konfigurasi restriksi untuk obat ${item.drugName}?`)) {
                                const updated = list.filter((_, idx) => idx !== index);
                                handleSaveMaster({ ...masterData, restrictedDrugs: updated });
                                notify(`Aturan obat ${item.drugName} telah dihapus.`);
                              }
                            }}
                            className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
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

      {/* Clear Cache Confirmation Modal */}
      {isConfirmClearCacheOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-sm shadow-2xl animate-fade-in text-center">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8"><AlertTriangle size={40}/></div>
            <h3 className="font-black text-2xl mb-2 text-slate-800">Clear Local Cache?</h3>
            <p className="text-sm text-slate-400 mb-10 leading-relaxed font-medium">Hapus cache data lokal? (Data di Spreadsheet tetap aman)</p>
            <div className="flex flex-col gap-3">
              <Button 
                variant="danger" 
                className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-rose-600 hover:bg-rose-700 text-white" 
                onClick={() => {
                  localStorage.removeItem('si_baru_db_stable_production_v5');
                  window.location.reload();
                }}
              >
                Ya, Hapus Cache
              </Button>
              <Button variant="ghost" className="w-full py-4 font-bold text-slate-400" onClick={() => setIsConfirmClearCacheOpen(false)}>Batalkan</Button>
            </div>
          </div>
        </div>
      )}

      {/* Client-Side Restore Confirmation Modal */}
      {isRestoreConfirmOpen && pendingRestoreData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl animate-fade-in text-center">
            <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
              <AlertTriangle size={40}/>
            </div>
            <h3 className="font-black text-2xl mb-3 text-slate-800 uppercase tracking-tight">Konfirmasi Restore Data</h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-6">
              Tindakan ini akan menimpa basis data aktif dan melakukan refresh state data rekam medis secara instan di sisi client. Seluruh data historis yang belum disinkronkan mungkin akan terhapus.
            </p>
            
            {/* Stats Preview */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-8 text-left space-y-2.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Ringkasan Berkas Restore:</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-600">
                <div>👥 Pasien: <b className="text-slate-850">{(pendingRestoreData.patients || []).length}</b></div>
                <div>🩺 Dokter: <b className="text-slate-850">{(pendingRestoreData.masterData?.doctors || []).length}</b></div>
                <div>📝 Laporan Shift: <b className="text-slate-850">{(pendingRestoreData.dailyReports || []).length}</b></div>
                <div>👤 Akun Pengguna: <b className="text-slate-850">{(pendingRestoreData.masterData?.users || []).length}</b></div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                variant="danger" 
                className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-[#144272] hover:bg-[#1d5b9c] text-white cursor-pointer" 
                onClick={handleExecuteRestore}
              >
                Ya, Lakukan Restore Sekarang
              </Button>
              <Button 
                variant="ghost" 
                className="w-full py-4 font-bold text-slate-400 cursor-pointer" 
                onClick={() => {
                  setIsRestoreConfirmOpen(false);
                  setPendingRestoreData(null);
                }}
              >
                Batalkan
              </Button>
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
              if (!bypassValidation && otherUsers.some(u => u.username.toLowerCase() === uData.username?.toLowerCase())) {
                notify("Username sama dengan staf lain");
                return;
              }

              // Validation 2: Identical Name, NIP, and Room
              if (!bypassValidation && otherUsers.some(u => 
                u.name.toLowerCase() === uData.name?.toLowerCase() && 
                (u.nip || '') === (uData.nip || '') && 
                (u.unit || '') === (uData.unit || '')
              )) {
                notify("User sudah ditambahkan");
                return;
              }

              const newData = JSON.parse(JSON.stringify(masterData)) as MasterData;
              let cleanUsername = '';
              let oldUsernameToMarkDeleted: string | null = null;
              
              if (isEditUserOpen && editingUser) {
                const idx = newData.users.findIndex(u => u.username === editingUser.oldUsername);
                if (idx > -1) {
                  const updatedUser = {
                    ...editingUser.data,
                    lastModified: new Date().toISOString()
                  };
                  newData.users[idx] = updatedUser as User;
                  cleanUsername = updatedUser.username;
                  
                  if (editingUser.oldUsername && editingUser.oldUsername !== updatedUser.username) {
                    oldUsernameToMarkDeleted = editingUser.oldUsername;
                  }
                }
              } else {
                const newUserWithLm = {
                  ...newUser,
                  lastModified: new Date().toISOString()
                };
                newData.users.push(newUserWithLm as User);
                cleanUsername = newUserWithLm.username;
              }

              const updatedSettings = {
                ...(newData.settings || {}),
                settingsTimestamp: new Date().toISOString()
              };

              // Clear from local device deleted registry to prevent tombstone resurrecting deletion
              clearDeletedIds([`USER_${cleanUsername}`]);

              if (onUpdateAppData && appData) {
                let deleted = (appData.deletedIds || []).filter(id => id !== `USER_${cleanUsername}`);
                if (oldUsernameToMarkDeleted) {
                  const oldKey = `USER_${oldUsernameToMarkDeleted}`;
                  if (!deleted.includes(oldKey)) {
                    deleted.push(oldKey);
                  }
                  registerDeletedId(oldKey);
                }
                onUpdateAppData({
                  ...appData,
                  deletedIds: deleted,
                  masterData: {
                    ...newData,
                    settings: updatedSettings
                  }
                }, true).then(() => {
                  notify("Akun pengguna diperbarui.");
                  setIsAddUserOpen(false);
                  setIsEditUserOpen(false);
                  // Reset newUser form state
                  setNewUser({
                    name: '',
                    username: '',
                    password: '',
                    role: 'PERAWAT',
                    unit: 'Ruang Bedah',
                    lastModified: ''
                  });
                }).catch(() => {
                  notify("Gagal memperbarui data akun pengguna.");
                });
              } else {
                handleSaveMaster({
                  ...newData,
                  settings: updatedSettings
                });
                notify("Akun pengguna diperbarui.");
                setIsAddUserOpen(false);
                setIsEditUserOpen(false);
                // Reset newUser form state
                setNewUser({
                  name: '',
                  username: '',
                  password: '',
                  role: 'PERAWAT',
                  unit: 'Ruang Bedah',
                  lastModified: ''
                });
              }
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
                <select className="w-full border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500 bg-white" value={isEditUserOpen ? editingUser?.data.role : newUser.role} onChange={e => {
                  const selectedRole = e.target.value as UserRole;
                  if (isEditUserOpen) {
                    const updated = { ...editingUser!.data, role: selectedRole };
                    if (selectedRole === 'ADMIN_RUANGAN') {
                      updated.position = 'Admin Ruangan';
                    }
                    setEditingUser({ ...editingUser!, data: updated });
                  } else {
                    const updated = { ...newUser, role: selectedRole };
                    if (selectedRole === 'ADMIN_RUANGAN') {
                      updated.position = 'Admin Ruangan';
                    }
                    setNewUser(updated);
                  }
                }}>
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
              <div className="col-span-2">
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800">
                  <input 
                    type="checkbox" 
                    id="bypass-validation-checkbox"
                    checked={bypassValidation} 
                    onChange={e => setBypassValidation(e.target.checked)}
                    className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="bypass-validation-checkbox" className="text-xs font-black uppercase tracking-wider select-none cursor-pointer flex-1">
                    🔓 AKSES SUPER USER BYPASS (Aktifkan untuk menimpa langsung tanpa verifikasi duplikasi)
                  </label>
                </div>
              </div>
              <div className="col-span-2 pt-4 flex gap-4">
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

      {/* Granular RBAC Matrix Modal */}
      {isRbacModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 w-full max-w-4xl shadow-2xl animate-fade-in border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start pb-6 mb-6 border-b border-slate-100">
                <div>
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-purple-200">
                    Sistem Hak Akses Granular
                  </span>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-2">Matriks Hak Akses Peran (RBAC)</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Atur izin menu & tindakan untuk tiap peran staf medis dan administrasi.
                  </p>
                </div>
                <button
                  onClick={() => setIsRbacModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Role Selection Tabs */}
              <div className="flex flex-wrap gap-2 mb-6 p-2 bg-slate-100/70 rounded-2xl">
                {(['SUPER_ADMIN', 'BIDANG', 'KARU', 'SEKRU', 'ADMIN_RUANGAN', 'PPJA', 'PIC', 'STAFF'] as UserRole[]).map((r) => {
                  const active = selectedRoleForRbac === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setSelectedRoleForRbac(r)}
                      className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                        active
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                          : 'bg-white text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      {r.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>

              {/* Permissions Config Form for Selected Role */}
              {(() => {
                const currentPerm = rbacPermissions[selectedRoleForRbac] || {
                  role: selectedRoleForRbac,
                  allowedMenus: ALL_MENU_IDS,
                  actions: { canCreate: true, canEdit: true, canDelete: true, canPrintPdf: true, canExportExcel: true, canPostBilling: true }
                };

                const toggleMenu = (menuId: string) => {
                  const allowed = currentPerm.allowedMenus.includes(menuId)
                    ? currentPerm.allowedMenus.filter((m) => m !== menuId)
                    : [...currentPerm.allowedMenus, menuId];

                  setRbacPermissions({
                    ...rbacPermissions,
                    [selectedRoleForRbac]: {
                      ...currentPerm,
                      allowedMenus: allowed
                    }
                  });
                };

                const toggleAction = (actionKey: keyof RolePermission['actions']) => {
                  setRbacPermissions({
                    ...rbacPermissions,
                    [selectedRoleForRbac]: {
                      ...currentPerm,
                      actions: {
                        ...currentPerm.actions,
                        [actionKey]: !currentPerm.actions[actionKey]
                      }
                    }
                  });
                };

                const menuGroupsUI = [
                  {
                    title: '1. Administrasi Pasien',
                    menus: [
                      { id: 'adm-register', label: 'Registrasi Pasien' },
                      { id: 'adm-booking', label: 'Booking Ruangan' },
                      { id: 'patients', label: 'Daftar Pasien & Kamar' },
                      { id: 'monitoring-keluar-masuk', label: 'Keluar/Masuk Pasien' },
                      { id: 'adm-census', label: 'Sensus Harian Ruangan' },
                      { id: 'adm-data-bed', label: 'Master Ketersediaan Tempat Tidur' }
                    ]
                  },
                  {
                    title: '2. Pelayanan Keperawatan',
                    menus: [
                      { id: 'service-nursing', label: 'Laporan Keperawatan & Shift' },
                      { id: 'service-schedule', label: 'Jadwal Jaga & Jadwal Operasi' }
                    ]
                  },
                  {
                    title: '3. Billing & Keuangan',
                    menus: [
                      { id: 'finance-reg-admin', label: 'Status Kelengkapan Berkas' },
                      { id: 'finance-billing', label: 'Rincian Operasi & Biaya' },
                      { id: 'finance-visite', label: 'Visite DPJP & Konsultasi' },
                      { id: 'finance-summary', label: 'Rekapitulasi Keuangan' }
                    ]
                  },
                  {
                    title: '4. Indikator Mutu',
                    menus: [
                      { id: 'quality-kpi', label: 'Ringkasan Kinerja Mutu' },
                      { id: 'quality-operasi-elektif', label: 'Kepatuhan Operasi Elektif' },
                      { id: 'quality-asesmen-awal-medis', label: 'Asesmen Awal Medis' },
                      { id: 'quality-dpjp-absensi', label: 'Absensi Jam Visite DPJP' },
                      { id: 'quality-visite-compliance', label: 'Kepatuhan Visite DPJP' },
                      { id: 'quality-dependency', label: 'Tingkat Ketergantungan Pasien' },
                      { id: 'quality-pathway', label: 'Kepatuhan Clinical Pathway' },
                      { id: 'quality-aps-mutu', label: 'Laporan Pasien APS' },
                      { id: 'quality-diagnosis-top', label: 'Top Diagnosa Kasus' }
                    ]
                  },
                  {
                    title: '5. Keselamatan Pasien',
                    menus: [
                      { id: 'incident-report', label: 'Laporan Insiden (IKP)' },
                      { id: 'incident-investigation', label: 'Investigasi Sederhana' },
                      { id: 'incident-monthly', label: 'Laporan Bulanan IKP' }
                    ]
                  },
                  {
                    title: '6. Pengaturan Sistem',
                    menus: [
                      { id: 'system-data', label: 'Master Data & Pengguna' },
                      { id: 'system-inventory', label: 'Restriksi Obat & Alkes' }
                    ]
                  }
                ];

                return (
                  <div className="space-y-6">
                    {/* Action Permissions Flags */}
                    <div className="p-5 bg-purple-50/50 rounded-2xl border border-purple-100">
                      <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 mb-3">
                        Izin Tindakan (Action Flags) - Peran {selectedRoleForRbac}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'canCreate', label: 'Tambah Data Baru' },
                          { key: 'canEdit', label: 'Ubah / Edit Data' },
                          { key: 'canDelete', label: 'Hapus Data' },
                          { key: 'canPrintPdf', label: 'Cetak Laporan / PDF' },
                          { key: 'canExportExcel', label: 'Ekspor File Excel' },
                          { key: 'canPostBilling', label: 'Post Billing & Kunci Data' }
                        ].map((act) => {
                          const isChecked = currentPerm.actions[act.key as keyof RolePermission['actions']];
                          return (
                            <label
                              key={act.key}
                              className="flex items-center gap-2.5 p-2.5 bg-white rounded-xl border border-purple-200/60 cursor-pointer hover:border-purple-300 transition-all"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleAction(act.key as keyof RolePermission['actions'])}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                              />
                              <span className="text-xs font-bold text-slate-800">{act.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Menu Access Checkboxes */}
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3">
                        Akses Menu Modul Aplikasi
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {menuGroupsUI.map((group) => (
                          <div key={group.title} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                            <h5 className="text-[11px] font-black uppercase tracking-wide text-slate-600 mb-2.5 pb-1.5 border-b border-slate-200">
                              {group.title}
                            </h5>
                            <div className="space-y-2">
                              {group.menus.map((m) => {
                                const isAllowed = currentPerm.allowedMenus.includes(m.id);
                                return (
                                  <label
                                    key={m.id}
                                    className="flex items-center justify-between p-2 hover:bg-white rounded-xl cursor-pointer transition-all"
                                  >
                                    <span className="text-xs font-bold text-slate-700">{m.label}</span>
                                    <input
                                      type="checkbox"
                                      checked={isAllowed}
                                      onChange={() => toggleMenu(m.id)}
                                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
              <Button variant="ghost" className="font-bold px-6 rounded-xl" onClick={() => setIsRbacModalOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSaveRbacPermissions} className="px-8 rounded-2xl shadow-lg bg-purple-600 hover:bg-purple-700 text-white font-black">
                Simpan Matriks Hak Akses
              </Button>
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
