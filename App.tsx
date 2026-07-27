
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout } from './components/Layout';
import { Login } from './components/Auth/Login';
import { DataManagement } from './components/Administrator/DataManagement';
import { FinanceModule } from './components/Administration/FinanceModule';
import { IncidentModule } from './components/Incidents/IncidentModule';
import { IncidentMonthlyReport } from './components/Incidents/IncidentMonthlyReport';
import { PatientModal } from './components/Patient/PatientModal';
import { PatientModule } from './components/Patient/PatientModule';
import { RoomBookingComponent } from './components/Patient/RoomBookingComponent';
import { CensusAdvanced } from './components/Administrator/CensusAdvanced';
import { InventoryModule } from './components/Administrator/InventoryModule';
import { OperationReportModule } from './components/Administrator/OperationReportModule';
import { ServiceMatrix } from './components/Nursing/ServiceMatrix';
import { QualityWorksheet } from './components/Quality/QualityWorksheet';
import { PrintQualityWorksheet } from './components/Quality/PrintQualityWorksheet';
import { QualityReports } from './components/Quality/QualityReports';
import { DoctorVisitAdmin } from './components/Finance/DoctorVisitAdmin';
import { FinanceSummaryView } from './components/Finance/FinanceSummaryView';
import { AdminRegistrasiModule } from './components/Finance/AdminRegistrasiModule';
import { AsesmenAwalMedisWorksheet } from './components/Quality/AsesmenAwalMedisWorksheet';
import { MonitoringPasienKeluarMasuk } from './components/Patient/MonitoringPasienKeluarMasuk';
import { PatientDetailModal } from './components/Patient/PatientDetailModal';
import { WorkspaceBar } from './components/GoogleWorkspace/WorkspaceBar';
import { DocsExportModal } from './components/GoogleWorkspace/DocsExportModal';
import { CalendarSyncModal } from './components/GoogleWorkspace/CalendarSyncModal';
import { PickedFile } from './googleWorkspace';
import { Button } from './components/Button';
import { SearchableSelect } from './components/SearchableSelect';
import { getDB, saveDB, uploadDataBackground, mergeData, getApiUrl, saveApiUrl, syncData, uploadData, registerDeletedId, getDeletedIds, getIsCurrentlyUploading, resilientParse, normalizeDatesInDb, triggerOfflineQueueUpload, getLocalSnapshotFromDB, requestPersistentStorage, generatePermanentUUID, getLatestTimestamp, mergeRecordProperties, TAB_ID, setPendingUploadInDB, hasAppDataChanged } from './db';
import { testFirestoreConnection } from './firebase';
import { initFirestoreRealtimeSync, subscribeDataChange, subscribeConnectionStatus, pushToFirestore, loadFromFirestore } from './firestoreSync';
import { INITIAL_DATA } from './constants';
import { AppData, User, FinanceRecord, IncidentReport, Patient, DailyReportEntry, QualityMeasurement, DependencyLevel, Instrument, OperationReport, DoctorVisitRecord, RoomBooking, getRoomBedStyles, getPaymentMethodStyles, getShiftFromTime } from './types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area
} from 'recharts';
import { 
  Activity, Wallet, AlertCircle, Calendar, Plus, Search, Filter, 
  TrendingUp, Users, ShieldAlert, BarChart3, Clock, 
  CheckCircle2, Stethoscope, HeartPulse, ClipboardCheck, FileText,
  UserCheck, ClipboardList, FilePieChart, Bed, ArrowRight,
  Edit, Trash2, X
} from 'lucide-react';

const mergeDailyReportItems = (local: any, incoming: any): any => {
  if (!local) return incoming;
  if (!incoming) return local;

  const localTimes = local.fieldModifiedTimes || {};
  const incomingTimes = incoming.fieldModifiedTimes || {};

  const localLm = getLatestTimestamp(local);
  const incomingLm = getLatestTimestamp(incoming);

  const merged: any = {
    patientId: local.patientId || incoming.patientId,
    date: local.date || incoming.date,
    fieldModifiedTimes: {
      ...(incoming.fieldModifiedTimes || {}),
      ...(local.fieldModifiedTimes || {})
    }
  };

  const fields = [
    'morningReport', 'morningTherapy', 'morningRecordedBy', 'morningDependency',
    'afternoonReport', 'afternoonTherapy', 'afternoonRecordedBy', 'afternoonDependency',
    'nightReport', 'nightTherapy', 'nightRecordedBy', 'nightDependency',
    'diagnosis', 'surgeryProcedure', 'surgeryOperator', 'surgeryDate',
    'surgeryStatus', 'surgeryDelayReason', 'surgeryTime', 'surgeryAnesthesiaType',
    'surgeryUrgency', 'surgeryNewDate', 'surgeryNewTime', 'adminNote'
  ];

  fields.forEach(f => {
    const localVal = local[f];
    const incomingVal = incoming[f];

    const localTime = localTimes[f] ? new Date(localTimes[f]).getTime() : 0;
    const incomingTime = incomingTimes[f] ? new Date(incomingTimes[f]).getTime() : 0;

    if (localTime > 0 || incomingTime > 0) {
      if (localTime >= incomingTime) {
        merged[f] = localVal !== undefined && localVal !== null ? localVal : incomingVal;
        if (localTimes[f]) merged.fieldModifiedTimes[f] = localTimes[f];
      } else {
        merged[f] = incomingVal !== undefined && incomingVal !== null ? incomingVal : localVal;
        if (incomingTimes[f]) merged.fieldModifiedTimes[f] = incomingTimes[f];
      }
    } else {
      if (localLm >= incomingLm) {
        merged[f] = localVal !== undefined && localVal !== null ? localVal : incomingVal;
      } else {
        merged[f] = incomingVal !== undefined && incomingVal !== null ? incomingVal : localVal;
      }
    }
  });

  const maxLm = Math.max(localLm, incomingLm);
  merged.lastModified = maxLm > 0 ? new Date(maxLm).toISOString() : (local.lastModified || incoming.lastModified);

  return merged;
};

const App: React.FC = () => {
  const [user, rawSetUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('surgihub_user') || sessionStorage.getItem('surgihub_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const setUser = (newUser: User | null) => {
    rawSetUser(newUser);
    try {
      if (newUser) {
        localStorage.setItem('surgihub_user', JSON.stringify(newUser));
        sessionStorage.setItem('surgihub_user', JSON.stringify(newUser));
      } else {
        localStorage.removeItem('surgihub_user');
        sessionStorage.removeItem('surgihub_user');
      }
    } catch (e) {
      console.warn('Failed to write user session to storage:', e);
    }
  };

  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [appData, setAppData] = useState<AppData>(getDB());
  const safeAppData: AppData = useMemo(() => {
    return {
      ...INITIAL_DATA,
      ...(appData || {}),
      masterData: {
        ...INITIAL_DATA.masterData,
        ...(appData?.masterData || {}),
        settings: {
          ...INITIAL_DATA.masterData.settings,
          ...(appData?.masterData?.settings || {})
        }
      }
    };
  }, [appData]);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [bedUnitFilter, setBedUnitFilter] = useState('Ruang Bedah');
  const [isMobile, setIsMobile] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'danger'} | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [qualityFilterDate, setQualityFilterDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [lastLocalAction, setLastLocalAction] = useState(0);
  const lastLocalActionRef = useRef<number>(Date.now());
  const saveTimeoutRef = useRef<any>(null);
  const retrySyncTimerRef = useRef<any>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; name: string; type: 'patient' | 'incident' | 'cache' } | null>(null);
  const [scheduleFilterDate, setScheduleFilterDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [scheduleFilterRoom, setScheduleFilterRoom] = useState<string>('');
  const [scheduleFilterDpjp, setScheduleFilterDpjp] = useState<string>('');
  const [scheduleGlobalSearch, setScheduleGlobalSearch] = useState<string>('');
  const [editingScheduleSurgery, setEditingScheduleSurgery] = useState<any | null>(null);
  const [monitoringFilterDate, setMonitoringFilterDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [monitoringFilterShift, setMonitoringFilterShift] = useState<'PAGI' | 'SIANG' | 'MALAM'>('PAGI');
  const [selectedDetailPatientId, setSelectedDetailPatientId] = useState<string | null>(null);
  const [patientLocks, setPatientLocks] = useState<{ [patientId: string]: { username: string; lockedAt: number } }>({});
  const [isFirestoreOnline, setIsFirestoreOnline] = useState<boolean>(true);

  // Subscribe to Realtime Firestore Delta Updates across all devices
  useEffect(() => {
    // 1. Subscribe to connection status updates
    const unsubConn = subscribeConnectionStatus((online) => {
      setIsFirestoreOnline(online);
    });

    // 2. Subscribe to real-time data changes broadcast from Firestore
    const unsubData = subscribeDataChange((newMergedData) => {
      if (hasAppDataChanged(newMergedData)) {
        setAppData(newMergedData);
        setLastSyncTime(new Date());
      }
    });

    // 3. Force read & reconcile all chunks on initial load from Firestore
    setSyncStatus('SYNCING');
    loadFromFirestore().then((resData) => {
      if (resData && hasAppDataChanged(resData)) {
        setAppData(resData);
        setLastSyncTime(new Date());
      }
      setSyncStatus('IDLE');
    }).catch(() => {
      setSyncStatus('IDLE');
    });

    // 4. Initialize real-time listener
    const stopFirestoreSync = initFirestoreRealtimeSync();

    return () => {
      unsubConn();
      unsubData();
      stopFirestoreSync();
    };
  }, []);

  // Google Workspace States & Modals
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [docsExportTitle, setDocsExportTitle] = useState('Laporan Medis SiMANTAP Bedah');
  const [docsExportContent, setDocsExportContent] = useState('');
  const [attachedDriveFiles, setAttachedDriveFiles] = useState<PickedFile[]>([]);

  const handleOpenDocsExport = (title?: string, content?: string) => {
    if (title) setDocsExportTitle(title);
    if (content) setDocsExportContent(content);
    setIsDocsModalOpen(true);
  };

  const handleFilePickedFromDrive = (file: PickedFile) => {
    setAttachedDriveFiles(prev => [...prev, file]);
  };

  const notify = (message: string, type: 'success' | 'danger' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (user?.unit) setBedUnitFilter(user.unit);
  }, [user?.unit]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // FORCE FETCH ALL MODULES FROM GOOGLE SHEETS (Absolute Centrally Governed Overwrite)
  const ForceFetchAllModules = async () => {
    try {
      console.log('[Aggressive Fetch] Executing ForceFetchAllModules...');
      setSyncStatus('SYNCING');
      let apiUrl = getApiUrl();
      const response = await fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&force=true&t=${Date.now()}`);
      const result = await response.json();
      
      let fetchedData = null;
      if (result) {
        if (result.data && (result.data.patients || result.data.dailyReports || result.data.operationReports)) {
          fetchedData = result.data;
        } else if (result.patients || result.dailyReports || result.operationReports) {
          fetchedData = result;
        }
      }
      const isPayloadEmpty = !fetchedData || 
                             (!fetchedData.patients || fetchedData.patients.length === 0) &&
                             (!fetchedData.dailyReports || fetchedData.dailyReports.length === 0) &&
                             (!fetchedData.operationReports || fetchedData.operationReports.length === 0);
      
      if (isPayloadEmpty) {
        console.warn('[Safety Buffer] Force fetch payload is empty! Retrying with text-plain raw bypass...');
        try {
          const bypassResponse = await fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&force=true&bypass=true&t=${Date.now()}`);
          const bypassResult = await bypassResponse.json();
          if (bypassResult) {
            let bypassData = null;
            if (bypassResult.data && (bypassResult.data.patients || bypassResult.data.dailyReports || bypassResult.data.operationReports)) {
              bypassData = bypassResult.data;
            } else if (bypassResult.patients || bypassResult.dailyReports || bypassResult.operationReports) {
              bypassData = bypassResult;
            }
            const bypassHasRecords = bypassData && 
                                     ((bypassData.patients && bypassData.patients.length > 0) ||
                                      (bypassData.dailyReports && bypassData.dailyReports.length > 0) ||
                                      (bypassData.operationReports && bypassData.operationReports.length > 0));
            if (bypassHasRecords) {
              console.log('[Safety Buffer] Successfully retrieved and parsed raw data on retry!', bypassData);
              fetchedData = bypassData;
            }
          }
        } catch (bypassErr) {
          console.error('[Safety Buffer] Text-plain raw bypass retry failed:', bypassErr);
        }
      }

      if (fetchedData) {
        const localDb = getDB();
        const merged = mergeData(localDb, fetchedData);
        setAppData(merged);
        saveDB(merged);
        setSyncStatus('SUCCESS');
        setTimeout(() => setSyncStatus('IDLE'), 2000);
        return merged;
      }
    } catch (e) {
      console.warn('ForceFetchAllModules failed:', e);
      setSyncStatus('ERROR');
    }
    return null;
  };

  // INITIAL DATA FETCH
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('surgihub_user') || sessionStorage.getItem('surgihub_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && (!user || user.username !== parsed.username)) {
          setUser(parsed);
        }
      }
    } catch (e) {
      console.warn('Silent session restore error:', e);
    }
    
    const initData = async () => {
      // 0. Request Persistent Browser Storage permission (Chrome/Edge Anti-Eviction)
      requestPersistentStorage().catch(() => {});

      // 1. Load from local database immediately to make application startup instantaneous (Stale-While-Revalidate)!
      const localDb = getDB();
      setAppData(localDb);
      setIsReady(true); // App is now immediately interactive!

      // Asynchronously load persistent snapshot from IndexedDB to ensure zero local data loss
      getLocalSnapshotFromDB().then(idbSnapshot => {
        if (idbSnapshot) {
          const currentLocal = getDB();
          const mergedIdb = mergeData(currentLocal, idbSnapshot);
          saveDB(mergedIdb);
          setAppData(mergedIdb);
        }
      }).catch(() => {});

      try {
        let apiUrl = getApiUrl();
        setSyncStatus('SYNCING');
        
        const robustParse = (rawText: string) => {
          try {
            const parsed = resilientParse(rawText);
            return parsed ? normalizeDatesInDb(parsed) : null;
          } catch (e) {
            return null;
          }
        };

        const extractStandardData = (obj: any): any => {
          if (!obj) return null;
          const target = obj.data || obj;
          if (target && typeof target === 'object') {
            const standardKeys = ['patients', 'dailyReports', 'nursingReports', 'operations', 'doctorVisits', 'financeRecords', 'incidentReports', 'qualityMeasurements', 'instruments', 'operationReports'];
            standardKeys.forEach(k => {
              if (!Array.isArray(target[k])) {
                target[k] = [];
              }
            });
            return target;
          }
          return null;
        };

        // STEP 1: Fetch Server configuration first to resolve correct Apps Script URL and theme before querying data
        let configJson: any = null;
        try {
          const configResponse = await fetch('/api/config').catch(() => null);
          if (configResponse && configResponse.ok) {
            configJson = await configResponse.json();
            if (configJson && configJson.appsScriptUrl && configJson.appsScriptUrl.trim() !== '') {
              apiUrl = configJson.appsScriptUrl;
              saveApiUrl(apiUrl);
            }
          }
        } catch (configErr) {
          console.warn('[On-Load Sync] Failed to load server config first:', configErr);
        }

        // STEP 2: Now perform parallel data sync queries using the verified, correct Apps Script URL!
        console.log('[On-Load Sync] Initiating Parallel data acquisition pipeline...');
        const [fastResponse, locksResponse] = await Promise.all([
          fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&force=false&excludeHeavy=true&t=${Date.now()}`).catch(() => null),
          fetch('/api/patients/locks').catch(() => null)
        ]);

        // Process Configuration theme parameters if retrieved
        if (configJson) {
          try {
            if (configJson.appsScriptUrl && apiUrl !== configJson.appsScriptUrl) {
              console.log('[API URL Sync] Propagating customized client Apps Script URL to server:', apiUrl);
              fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appsScriptUrl: apiUrl })
              }).catch(() => {});
            }
          } catch (e) {
            console.warn('Failed to post synchronized config:', e);
          }
        }

        // Process locks in background
        if (locksResponse && locksResponse.ok) {
          locksResponse.json().then(res => {
            if (res.success) setPatientLocks(res.locks || {});
          }).catch(() => {});
        }

        let fetchedData: any = null;

        // Process Fast Snappy Cache
        if (fastResponse && fastResponse.ok) {
          try {
            const rawText = await fastResponse.text();
            const result = robustParse(rawText);
            if (result) {
              const tempFetched = extractStandardData(result);
              const isCacheNotEmpty = tempFetched && 
                                      ((tempFetched.patients && tempFetched.patients.length > 0) ||
                                       (tempFetched.dailyReports && tempFetched.dailyReports.length > 0));
              if (isCacheNotEmpty) {
                console.log('[On-Load Sync] Snappy server cache retrieved successfully in parallel!', tempFetched.patients?.length, 'patients.');
                fetchedData = tempFetched;
              }
            }
          } catch (fastErr) {
            console.warn('[On-Load Sync] Parallel cache parse failed:', fastErr);
          }
        }

        // STEP B: Only do blocking fresh pull if server cache was empty or invalid
        if (!fetchedData) {
          let retries = 3;
          while (retries > 0) {
            try {
              console.log(`[On-Load Sync] Server cache empty. Forcing central Google Sheets fresh pull (Attempts remaining: ${retries})...`);
              const response = await fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&force=true&t=${Date.now()}`);
              if (response.ok) {
                const rawText = await response.text();
                const result = robustParse(rawText);
                if (result) {
                  const tempFetched = extractStandardData(result);
                  const isEmpty = !tempFetched || 
                                  (!tempFetched.patients || tempFetched.patients.length === 0) &&
                                  (!tempFetched.dailyReports || tempFetched.dailyReports.length === 0) &&
                                  (!tempFetched.operationReports || tempFetched.operationReports.length === 0);
                  
                  if (!isEmpty) {
                    fetchedData = tempFetched;
                    break;
                  }
                }
              }
            } catch (e) {
              console.warn(`[On-Load Sync] Attempt failed:`, e);
            }
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        const isPayloadEmpty = !fetchedData || 
                               (!fetchedData.patients || fetchedData.patients.length === 0) &&
                               (!fetchedData.dailyReports || fetchedData.dailyReports.length === 0) &&
                               (!fetchedData.operationReports || fetchedData.operationReports.length === 0);
        
        if (isPayloadEmpty) {
          console.warn('[Safety Buffer] On-load fetched payload is empty! Retrying with text-plain raw bypass...');
          try {
            const bypassResponse = await fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&force=true&bypass=true&t=${Date.now()}`);
            const rawText = await bypassResponse.text();
            const bypassResult = robustParse(rawText);
            if (bypassResult) {
              const bypassData = extractStandardData(bypassResult);
              const bypassHasRecords = bypassData && 
                                       ((bypassData.patients && bypassData.patients.length > 0) ||
                                        (bypassData.dailyReports && bypassData.dailyReports.length > 0) ||
                                        (bypassData.operationReports && bypassData.operationReports.length > 0));
              if (bypassHasRecords) {
                console.log('[Safety Buffer] Successfully retrieved and parsed raw data on retry!', bypassData);
                fetchedData = bypassData;
              }
            }
          } catch (bypassErr) {
            console.error('[Safety Buffer] Text-plain raw bypass retry failed:', bypassErr);
          }
        }
        
        if (fetchedData) {
          console.log('[On-Load Sync] Fresh central data retrieved successfully. Merging with local state.');
          if (configJson) {
            if (!fetchedData.masterData) fetchedData.masterData = {};
            fetchedData.masterData.settings = {
              ...(fetchedData.masterData.settings || {}),
              appName: configJson.appName || fetchedData.masterData.settings?.appName || 'SiMANTAP',
              appSlogan: configJson.appSlogan || fetchedData.masterData.settings?.appSlogan || 'Manajemen Laporan Terpadu & Akurat',
              logoUrl: configJson.logoUrl || fetchedData.masterData.settings?.logoUrl || '',
              logoLetterLeftUrl: configJson.logoLetterLeftUrl || fetchedData.masterData.settings?.logoLetterLeftUrl || '',
              logoLetterRightUrl: configJson.logoLetterRightUrl || fetchedData.masterData.settings?.logoLetterRightUrl || '',
              loginWallpaperUrl: configJson.loginWallpaperUrl || fetchedData.masterData.settings?.loginWallpaperUrl || '',
              appWallpaperUrl: configJson.appWallpaperUrl || fetchedData.masterData.settings?.appWallpaperUrl || '',
              themeColor: configJson.themeColor || fetchedData.masterData.settings?.themeColor || '#144272',
              fontColor: configJson.fontColor || fetchedData.masterData.settings?.fontColor || '#ffffff',
              isSidebarAutohide: configJson.isSidebarAutohide !== undefined ? configJson.isSidebarAutohide : !!fetchedData.masterData.settings?.isSidebarAutohide
            };
          }
          const merged = mergeData(localDb, fetchedData);
          setAppData(merged);
          saveDB(merged);
          setSyncStatus('SUCCESS');
          setTimeout(() => setSyncStatus('IDLE'), 2000);
        } else {
          console.warn('[On-Load Sync] Server responded but data lists were invalid. Using local memory database.');
          const currentLocal = getDB();
          if (configJson) {
            if (!currentLocal.masterData) {
              currentLocal.masterData = JSON.parse(JSON.stringify(INITIAL_DATA.masterData));
            }
            currentLocal.masterData.settings = {
              ...(currentLocal.masterData.settings || {}),
              appName: configJson.appName || currentLocal.masterData.settings?.appName || 'SiMANTAP',
              appSlogan: configJson.appSlogan || currentLocal.masterData.settings?.appSlogan || 'Manajemen Laporan Terpadu & Akurat',
              logoUrl: configJson.logoUrl || currentLocal.masterData.settings?.logoUrl || '',
              logoLetterLeftUrl: configJson.logoLetterLeftUrl || currentLocal.masterData.settings?.logoLetterLeftUrl || '',
              logoLetterRightUrl: configJson.logoLetterRightUrl || currentLocal.masterData.settings?.logoLetterRightUrl || '',
              loginWallpaperUrl: configJson.loginWallpaperUrl || currentLocal.masterData.settings?.loginWallpaperUrl || '',
              appWallpaperUrl: configJson.appWallpaperUrl || currentLocal.masterData.settings?.appWallpaperUrl || '',
              themeColor: configJson.themeColor || currentLocal.masterData.settings?.themeColor || '#144272',
              fontColor: configJson.fontColor || currentLocal.masterData.settings?.fontColor || '#ffffff',
              isSidebarAutohide: configJson.isSidebarAutohide !== undefined ? configJson.isSidebarAutohide : !!currentLocal.masterData.settings?.isSidebarAutohide
            };
          }
          setAppData(currentLocal);
          setSyncStatus('IDLE');
        }
        const loadHeavyTablesInChunks = async (url: string) => {
          const tables = ['patients', 'dailyReports', 'financeRecords'];
          const CHUNK_SIZE = 250;

          for (const table of tables) {
            let page = 1;
            let hasMore = true;
            console.log(`[Chunk Loading] Starting async background pipeline for table: ${table}`);

            while (hasMore) {
              try {
                const res = await fetch(`/api/data?url=${encodeURIComponent(url)}&chunkTable=${table}&chunkPage=${page}&chunkSize=${CHUNK_SIZE}&t=${Date.now()}`);
                if (res.ok) {
                  const json = await res.json();
                  if (json && Array.isArray(json.data)) {
                    const chunk = json.data;
                    console.log(`[Chunk Loading] Received ${table} Page ${page}: ${chunk.length} items of ${json.total}`);
                    
                    if (chunk.length > 0) {
                      const currentDb = getDB();
                      const normalizedDb = normalizeDatesInDb(currentDb);
                      const existingList = normalizedDb[table] || [];
                      
                      const existingMap = new Map();
                      existingList.forEach((item: any) => {
                        const key = item.id || (item.patientId + '_' + item.date) || JSON.stringify(item);
                        existingMap.set(key, item);
                      });
                      
                      const tempObj = { [table]: chunk };
                      normalizeDatesInDb(tempObj);
                      const normalizedChunk = tempObj[table];

                      const activeDeletedIds = getDeletedIds();
                      normalizedChunk.forEach((item: any) => {
                        if (!item) return;
                        const key = item.id || (item.patientId ? `${item.patientId}_${item.date}` : null) || JSON.stringify(item);
                        
                        // Check soft deletions
                        if (item.isDeleted || item.deleted) return;
                        if (key && activeDeletedIds.includes(key)) return;
                        if (item.id && activeDeletedIds.includes(String(item.id))) return;
                        if (item.patientId && activeDeletedIds.includes(String(item.patientId))) return;
                        if (item.indicatorId && activeDeletedIds.includes(String(item.indicatorId))) return;

                        const existing = existingMap.get(key);
                        if (existing) {
                          existingMap.set(key, mergeRecordProperties(existing, item));
                        } else {
                          existingMap.set(key, item);
                        }
                      });
                      
                      normalizedDb[table] = Array.from(existingMap.values());
                      saveDB(normalizedDb);
                      setAppData({ ...normalizedDb });
                    }
                    
                    hasMore = json.hasMore && chunk.length > 0;
                    page++;
                    
                    // Small yield to let browser process UI frames smoothly
                    await new Promise(resolve => setTimeout(resolve, 30));
                  } else {
                    hasMore = false;
                  }
                } else {
                  hasMore = false;
                }
              } catch (err) {
                console.warn(`[Chunk Loading] Failed to fetch chunk for ${table} Page ${page}:`, err);
                hasMore = false;
              }
            }
          }
          console.log('[Chunk Loading] Completed all background table pipelines successfully!');
        };

        // Trigger background asynchronous chunk loading pipeline
        loadHeavyTablesInChunks(apiUrl);

        // Check and trigger any pending offline uploads on start
        triggerOfflineQueueUpload();

      } catch (e) {
        console.warn('On-load sync unsuccessful, loading local memory database:', e);
        const currentLocal = getDB();
        setAppData(currentLocal);
        setSyncStatus('ERROR');
      }
    };
    
    initData();
  }, []);

  // FETCH INITIAL PATIENT LOCKS
  useEffect(() => {
    fetch('/api/patients/locks')
      .then(res => res.json())
      .then(res => {
        if (res.success) setPatientLocks(res.locks || {});
      })
      .catch(() => {});
  }, []);

  // BACKGROUND POLLING
  useEffect(() => {
    let isLocalSyncing = false;

    const syncNow = async () => {
      if (isLocalSyncing) return;
      // Avoid polling if background upload is currently in progress
      if (getIsCurrentlyUploading()) return;
      // Avoid polling if we just made a local update within 5 seconds
      if (Date.now() - lastLocalAction < 5000) return;

      isLocalSyncing = true;
      try {
        const res = await syncData(false);
        if (res.success) {
          const freshData = getDB();
          if (hasAppDataChanged(freshData)) {
            setAppData(freshData);
            setLastSyncTime(new Date());
          }
          
          // Auto-heal: Clear any previous visual error states once connection is restored
          setSyncStatus(prev => prev === 'ERROR' ? 'SUCCESS' : prev);
          setTimeout(() => {
            setSyncStatus(prev => prev === 'SUCCESS' ? 'IDLE' : prev);
          }, 2000);
        }
      } catch (e) {
        console.warn('Background auto-sync silently suspended:', e);
      } finally {
        isLocalSyncing = false;
      }
    };

    const interval = setInterval(() => {
      if (!document.hidden) syncNow();
    }, 25000); // Poll every 25 seconds (instead of 3s) for major CPU load savings, since real-time SSE already handles instant updates!

    const handleVisibility = () => {
      if (!document.hidden) syncNow();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [lastLocalAction]);

  // --- REAL-TIME SERVER-SENT EVENTS (SSE) LISTENER ---
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      console.log("Connecting to SIMANTAP real-time sync event stream...");
      if (eventSource) {
        eventSource.close();
      }
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === 'handshake') {
            const serverVersion = payload.version;
            const CLIENT_VERSION = "2.2.0-recovery-sync";
            console.log(`[SSE Handshake] Server Build: ${serverVersion} | Local Build: ${CLIENT_VERSION}`);
            
            // If the server changed versions (user completed code updates in AI Studio), trigger smooth live hot reload!
            if (serverVersion && serverVersion !== CLIENT_VERSION) {
              console.log("[Live Update] Outdated browser build detected! Clearing storage & hot reloading...");
              setNotification({ 
                message: "Aplikasi SIMANTAP diperbarui ke versi terbaru. Memuat ulang sistem secara real-time...", 
                type: 'success' 
              });
              
              if ('caches' in window) {
                try {
                  const names = await caches.keys();
                  await Promise.all(names.map(name => caches.delete(name)));
                } catch (e) {}
              }
              
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            }
          } else if (payload.type === 'delta-update') {
            const table = payload.table;
            const items = payload.items || [];
            console.log(`[SSE Delta Event] Delta update received for ${table}:`, items);
            if (items.length > 0 && table) {
              const currentDB = getDB();
              const activeDeletedIds = getDeletedIds();
              let localList = [...(currentDB[table] || [])];
              let updatedLocal = false;
              const keyField = 'id';

              items.forEach((newItem: any) => {
                if (!newItem) return;
                
                // FILTER DELETED ITEMS FROM SSE DELTAS
                if (newItem.isDeleted || newItem.deleted) return;
                if (newItem.id && activeDeletedIds.includes(String(newItem.id))) return;
                if (newItem.patientId && activeDeletedIds.includes(String(newItem.patientId))) return;
                if (newItem.indicatorId && activeDeletedIds.includes(String(newItem.indicatorId))) return;

                if (table === 'dailyReports') {
                  if (!newItem.patientId || !newItem.date) return;
                  const key = `${newItem.patientId}_${newItem.date}`;
                  if (activeDeletedIds.includes(key)) return;

                  const localIdx = localList.findIndex(r => `${r.patientId}_${r.date}` === key);
                  if (localIdx > -1) {
                    const localItem = localList[localIdx];
                    const mergedItem = mergeDailyReportItems(localItem, newItem);
                    if (JSON.stringify(localItem) !== JSON.stringify(mergedItem)) {
                      localList[localIdx] = mergedItem;
                      updatedLocal = true;
                    }
                  } else {
                    localList.push(newItem);
                    updatedLocal = true;
                  }
                } else {
                  if (newItem[keyField] === undefined || newItem[keyField] === null) return;
                  const itemId = String(newItem[keyField]);
                  if (activeDeletedIds.includes(itemId)) return;

                  const localIdx = localList.findIndex(r => String(r[keyField]) === itemId);
                  if (localIdx > -1) {
                    const localItem = localList[localIdx];
                    localList[localIdx] = mergeRecordProperties(localItem, newItem);
                    updatedLocal = true;
                  } else {
                    localList.push(newItem);
                    updatedLocal = true;
                  }
                }
              });

              if (updatedLocal) {
                const updatedDB = { ...currentDB, [table]: localList };
                saveDB(updatedDB);
              }

              // Update in active React state reference
              setAppData(prev => {
                const stateList = [...(prev[table] || [])];
                let updatedState = false;
                items.forEach((newItem: any) => {
                  if (!newItem) return;
                  if (newItem.isDeleted || newItem.deleted) return;
                  if (newItem.id && activeDeletedIds.includes(String(newItem.id))) return;
                  if (newItem.patientId && activeDeletedIds.includes(String(newItem.patientId))) return;
                  if (newItem.indicatorId && activeDeletedIds.includes(String(newItem.indicatorId))) return;

                  if (table === 'dailyReports') {
                    const key = `${newItem.patientId}_${newItem.date}`;
                    if (activeDeletedIds.includes(key)) return;

                    const idx = stateList.findIndex(r => `${r.patientId}_${r.date}` === key);
                    if (idx > -1) {
                      const stateItem = stateList[idx];
                      const mergedItem = mergeDailyReportItems(stateItem, newItem);
                      if (JSON.stringify(stateItem) !== JSON.stringify(mergedItem)) {
                        stateList[idx] = mergedItem;
                        updatedState = true;
                      }
                    } else {
                      stateList.push(newItem);
                      updatedState = true;
                    }
                  } else {
                    if (newItem[keyField] === undefined || newItem[keyField] === null) return;
                    const itemId = String(newItem[keyField]);
                    if (activeDeletedIds.includes(itemId)) return;

                    const idx = stateList.findIndex(r => String(r[keyField]) === itemId);
                    if (idx > -1) {
                      const stateItem = stateList[idx];
                      stateList[idx] = mergeRecordProperties(stateItem, newItem);
                      updatedState = true;
                    } else {
                      stateList.push(newItem);
                      updatedState = true;
                    }
                  }
                });
                if (updatedState) {
                  return { ...prev, [table]: stateList };
                }
                return prev;
              });
              setLastSyncTime(new Date());
            }
          } else if (payload.type === 'hard-sync') {
            // Force Sync / Hard Pull: Triggered by other devices' changes
            // To prevent self-override loops, skip if we recently edited (within 10 seconds)
            const timeSinceLastLocal = Date.now() - lastLocalActionRef.current;
            if (timeSinceLastLocal < 10000) {
              console.log("[SSE Event] Hard sync skipped on originating device due to recent local action.");
              return;
            }
            console.log("[SSE Event] Hard sync signal received. Triggering immediate Hard Pull...");
            (async () => {
              const res = await syncData(true); // force pull from Google Sheets
              if (res.success) {
                setAppData(getDB());
                setLastSyncTime(new Date());
              }
            })();
          } else if (payload.type === 'data-update') {
            // Anti-rollback/race condition check: If this device recently performed a local edit (within 10s),
            // it's highly likely that this data-update event was triggered by our own push, or we are currently editing.
            // Under these high-concurrency conditions, skip downloading to prevent overwriting static client state.
            const timeSinceLastLocal = Date.now() - lastLocalActionRef.current;
            if (timeSinceLastLocal < 10000) {
              console.log("[SSE Event] Data change detected, but skipped because of recent local action in progress.");
              return;
            }
            console.log("[SSE Event] Data change detected, triggering silent sync now.");
            // Silent sync
            const res = await syncData(false);
            if (res.success) {
              setAppData(getDB());
              setLastSyncTime(new Date());
            }
          } else if (payload.type === 'patient-locks') {
            setPatientLocks(payload.locks || {});
          } else if (payload.type === 'theme-update') {
            console.log("[SSE Event] Theme update received from server:", payload.settings);
            const settings = payload.settings;
            if (settings) {
              setAppData(prev => {
                if (!prev) return prev;
                const next = { ...prev };
                if (!next.masterData) next.masterData = {};
                next.masterData.settings = {
                  ...(next.masterData.settings || {}),
                  ...settings
                };
                saveDB(next);
                return next;
              });
            }
          }
        } catch (err) {
          console.error("[SSE Event error] Error processing SSE payload:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("[SSE Connection] Stream lost, trying to reconnect in 5 seconds...");
        if (eventSource) {
          eventSource.close();
        }
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    const handleOnline = () => {
      console.log("[SSE Network] Network online, forcing immediate reconnection...");
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      connectSSE();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // BroadcastChannel listener for instant zero-latency tab-to-tab & device sync
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channelNames = ['simantap_global_sync', 'simantap_sync_channel'];
    const activeChannels: BroadcastChannel[] = [];
    let bcDebounceTimer: any = null;

    channelNames.forEach((chName) => {
      try {
        const bc = new BroadcastChannel(chName);
        bc.onmessage = (event) => {
          if (
            event.data &&
            (event.data.type === 'SIMANTAP_GLOBAL_SYNC' ||
              event.data.type === 'LOCAL_TAB_SYNC' ||
              event.data.type === 'LOCAL_DATA_UPDATE')
          ) {
            if (event.data.senderId === TAB_ID) return; // Prevent echo loop from origin tab

            // 1. FAST DELTA HANDLING (O(1) lightweight update)
            if (event.data.delta) {
              const { table, item, action } = event.data.delta;
              const currentLocal = getDB();
              if (table && item && Array.isArray(currentLocal[table as keyof AppData])) {
                let list = [...((currentLocal[table as keyof AppData] as any[]) || [])];
                const getItemKey = (i: any) => i.id || (i.patientId && i.date ? `${i.patientId}_${i.date}` : null);
                const targetKey = getItemKey(item);

                if (action === 'DELETE') {
                  list = list.filter((i) => getItemKey(i) !== targetKey);
                } else {
                  const idx = list.findIndex((i) => getItemKey(i) === targetKey);
                  if (idx > -1) {
                    list[idx] = { ...list[idx], ...item };
                  } else {
                    list.push(item);
                  }
                }

                const updatedData = { ...currentLocal, [table]: list };
                saveDB(updatedData, true); // Pass skipBroadcast = true
                if (hasAppDataChanged(updatedData)) {
                  setAppData(updatedData);
                  setLastSyncTime(new Date());
                }
                return;
              }
            }

            // 2. FULL PAYLOAD FALLBACK (Debounced + change checked)
            const payloadData = event.data.data || event.data.payload;
            if (payloadData) {
              if (bcDebounceTimer) clearTimeout(bcDebounceTimer);
              bcDebounceTimer = setTimeout(() => {
                const currentLocal = getDB();
                const merged = mergeData(currentLocal, payloadData);
                saveDB(merged, true); // Pass skipBroadcast = true
                if (hasAppDataChanged(merged)) {
                  setAppData(merged);
                  setLastSyncTime(new Date());
                }
              }, 150);
            }
          }
        };
        activeChannels.push(bc);
      } catch (e) {}
    });

    return () => {
      if (bcDebounceTimer) clearTimeout(bcDebounceTimer);
      activeChannels.forEach((bc) => {
        try {
          bc.close();
        } catch (e) {}
      });
    };
  }, []);

  // Listen for background successful offline uploads and update state dynamically
  useEffect(() => {
    const handleOfflineSynced = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        console.log('[Offline Queue Synced] Dynamic state refresh initiated.');
        const updated = syncCatatanKhususToAdminNote(customEv.detail);
        setAppData(updated);
        setNotification({
          message: 'Sinkronisasi antrean data offline selesai. Data Anda kini 100% aman di server.',
          type: 'success'
        });
      }
    };
    const handleSurgihubToast = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        setNotification({
          message: customEv.detail.message,
          type: customEv.detail.type || 'success'
        });
        setTimeout(() => setNotification(null), 3000);
      }
    };
    window.addEventListener('surgihub_offline_queue_synced', handleOfflineSynced);
    window.addEventListener('surgihub_toast', handleSurgihubToast);
    testFirestoreConnection();
    return () => {
      window.removeEventListener('surgihub_offline_queue_synced', handleOfflineSynced);
      window.removeEventListener('surgihub_toast', handleSurgihubToast);
    };
  }, []);

  const syncCatatanKhususToAdminNote = (data: AppData): AppData => {
    if (!data || !data.patients) return data;
    const reports = [...(data.dailyReports || [])];
    let touched = false;

    data.patients.forEach(p => {
      // Kolom keterangan di registrasi pasien (catatanKhusus) wajib terisi langsung ke adminNote pada laporan keperawatan untuk tanggal MRS (entryDate)
      const targetDate = p.entryDate || new Date().toISOString().split('T')[0];
      
      let noteValue = p.catatanKhusus || '';
      const badges: string[] = [];
      if (p.isRisikoBermasalah) badges.push('💥 RISIKO BERMASALAH');
      if (p.statusMasalah === 'ON_PROSES') badges.push('⏳ ON PROSES');
      if (p.statusMasalah === 'SELESAI') badges.push('✅ MASALAH SELESAI');

      if (badges.length > 0) {
        noteValue = `${noteValue} [${badges.join(' | ')}]`.trim();
      }
      
      const idx = reports.findIndex(r => r.patientId === p.id && r.date === targetDate);
      if (idx > -1) {
        if (reports[idx].adminNote !== noteValue) {
          reports[idx] = {
            ...reports[idx],
            adminNote: noteValue,
            lastModified: new Date().toISOString()
          };
          touched = true;
        }
      } else if (noteValue.trim() !== '') {
        const newReport = {
          patientId: p.id,
          date: targetDate,
          adminNote: noteValue,
          lastModified: new Date().toISOString()
        };
        reports.push(newReport as any);
        touched = true;
      }
    });

    if (touched) {
      return {
        ...data,
        dailyReports: reports
      };
    }
    return data;
  };

  const handleUpdateAppData = async (newData: AppData, immediate: boolean = false): Promise<any> => {
    if (user?.isRecovery) {
      setNotification({
        message: 'Mode Pemulihan Read-Only aktif: Perubahan data dinonaktifkan.',
        type: 'danger'
      });
      setTimeout(() => setNotification(null), 3000);
      return { success: false, error: 'Read-only mode active' };
    }

    const now = Date.now();
    lastLocalActionRef.current = now;
    setLastLocalAction(now);
    
    const syncedData = syncCatatanKhususToAdminNote(newData);
    
    // Instantly update UI and lock locally (Optimistic UI & Local State Lock)
    setAppData(syncedData);
    saveDB(syncedData); // saveDB automatically broadcasts to other tabs safely with senderId
    setSyncStatus('SYNCING');
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    if (immediate) {
      try {
        const res = await uploadData(syncedData, true);
        if (res.success) {
          setSyncStatus('SUCCESS');
          setTimeout(() => setSyncStatus(prev => prev === 'SUCCESS' ? 'IDLE' : prev), 3000);
          return res;
        } else {
          throw new Error(res.error || 'Sync failed');
        }
      } catch (e: any) {
        console.warn('Google Sheets immediate sync failed (silent fallback to resilient queue):', e);
        setSyncStatus('IDLE');
        await setPendingUploadInDB(syncedData);
        triggerOfflineQueueUpload();
        return { success: true, fallback: true, error: e.message };
      }
    } else {
      return new Promise((resolve) => {
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            const res = await uploadData(syncedData);
            if (res.success) {
              setSyncStatus('SUCCESS');
              setTimeout(() => setSyncStatus(prev => prev === 'SUCCESS' ? 'IDLE' : prev), 3000);
              resolve(res);
            } else {
              throw new Error(res.error || 'Sync failed');
            }
          } catch (e: any) {
            console.warn('Google Sheets sync failed (silent background retry queue initiated):', e);
            setSyncStatus('IDLE');
            await setPendingUploadInDB(syncedData);
            triggerOfflineQueueUpload();
            resolve({ success: true, fallback: true, error: e.message });
          }
        }, 1000);
      });
    }
  };

  const handleTriggerSyncManual = async (isForce: boolean = false): Promise<boolean> => {
    try {
      const apiUrl = getApiUrl();
      setSyncStatus('SYNCING');
      const response = await fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&force=${isForce}&excludeHeavy=true&t=${Date.now()}`);
      const result = await response.json();
      let fetchedDb: any = null;
      if (result) {
        if (result.data && (result.data.patients || result.data.dailyReports || result.data.operationReports)) {
          fetchedDb = result.data;
        } else if (result.patients || result.dailyReports || result.operationReports) {
          fetchedDb = result;
        }
      }
      if (fetchedDb) {
        const localDb = getDB();
        const merged = mergeData(localDb, fetchedDb);
        setAppData(merged);
        saveDB(merged);
        setSyncStatus('SUCCESS');
        setTimeout(() => setSyncStatus('IDLE'), 2000);

        // Run background async chunk loading pipeline for heavy tables
        (async () => {
          const tables = ['patients', 'dailyReports', 'financeRecords'];
          const CHUNK_SIZE = 250;
          for (const table of tables) {
            let page = 1;
            let hasMore = true;
            while (hasMore) {
              try {
                const chunkRes = await fetch(`/api/data?url=${encodeURIComponent(apiUrl)}&chunkTable=${table}&chunkPage=${page}&chunkSize=${CHUNK_SIZE}&t=${Date.now()}`);
                if (chunkRes.ok) {
                  const json = await chunkRes.json();
                  if (json && Array.isArray(json.data)) {
                    const chunk = json.data;
                    if (chunk.length > 0) {
                      const currentDb = getDB();
                      const normalizedDb = normalizeDatesInDb(currentDb);
                      const existingList = normalizedDb[table] || [];
                      const existingMap = new Map();
                      existingList.forEach((item: any) => {
                        const key = item.id || (item.patientId + '_' + item.date) || JSON.stringify(item);
                        existingMap.set(key, item);
                      });
                      
                      const tempObj = { [table]: chunk };
                      normalizeDatesInDb(tempObj);
                      const normalizedChunk = tempObj[table];
                      const deletedIds = getDeletedIds();

                      normalizedChunk.forEach((item: any) => {
                        if (!item) return;
                        const key = item.id || (item.patientId ? `${item.patientId}_${item.date}` : null) || JSON.stringify(item);
                        
                        // Check deletions
                        if (item.isDeleted || item.deleted) return;
                        if (key && deletedIds.includes(key)) return;
                        if (item.id && deletedIds.includes(String(item.id))) return;
                        if (item.patientId && deletedIds.includes(String(item.patientId))) return;
                        if (item.indicatorId && deletedIds.includes(String(item.indicatorId))) return;

                        const existing = existingMap.get(key);
                        if (existing) {
                          existingMap.set(key, mergeRecordProperties(existing, item));
                        } else {
                          existingMap.set(key, item);
                        }
                      });
                      
                      normalizedDb[table] = Array.from(existingMap.values());
                      saveDB(normalizedDb);
                      setAppData({ ...normalizedDb });
                    }
                    hasMore = json.hasMore && chunk.length > 0;
                    page++;
                    await new Promise(resolve => setTimeout(resolve, 30));
                  } else {
                    hasMore = false;
                  }
                } else {
                  hasMore = false;
                }
              } catch (err) {
                console.warn(`[Manual Chunk Loading] Failed for ${table} Page ${page}:`, err);
                hasMore = false;
              }
            }
          }
        })();

        return true;
      }
    } catch (e) {
      console.warn('Manual sync pull failed:', e);
    }
    setSyncStatus('ERROR');
    setTimeout(() => setSyncStatus('IDLE'), 2000);
    return false;
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('surgihub_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('surgihub_user');
  };

  const handleSaveRoomBooking = (bookingData: Omit<RoomBooking, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newBooking: RoomBooking = {
      ...bookingData,
      id: generatePermanentUUID(),
      createdAt: now,
      updatedAt: now,
      createdByName: user?.name || 'Petugas',
      createdByUsername: user?.username || 'user'
    };

    const currentBookings = appData.roomBookings || [];
    const updatedBookings = [newBooking, ...currentBookings];

    const newData: AppData = {
      ...appData,
      roomBookings: updatedBookings
    };

    handleUpdateAppData(newData, true);
    notify('Booking ruangan berhasil dibuat!');
  };

  const handleUpdateBookingStatus = (id: string, status: RoomBooking['status'], cancellationReason?: string) => {
    const currentBookings = appData.roomBookings || [];
    const updatedBookings = currentBookings.map(b => {
      if (b.id === id) {
        return {
          ...b,
          status,
          cancellationReason: cancellationReason || b.cancellationReason,
          updatedAt: new Date().toISOString()
        };
      }
      return b;
    });

    const newData: AppData = {
      ...appData,
      roomBookings: updatedBookings
    };

    handleUpdateAppData(newData, true);
    notify(`Status booking berhasil diperbarui ke: ${status}`);
  };

  const handleDeleteRoomBooking = (id: string) => {
    const currentBookings = appData.roomBookings || [];
    const updatedBookings = currentBookings.filter(b => b.id !== id);

    registerDeletedId(id);

    const newData: AppData = {
      ...appData,
      roomBookings: updatedBookings
    };

    handleUpdateAppData(newData, true);
    notify('Data booking ruangan berhasil dihapus.');
  };

  const handleCheckInBookingToRegistration = (booking: RoomBooking) => {
    handleUpdateBookingStatus(booking.id, 'CHECKED_IN');

    const prefilledPatient: Patient = {
      id: generatePermanentUUID(),
      noRegister: `REG-${Date.now().toString().slice(-6)}`,
      noRM: booking.noRM,
      name: booking.patientName,
      gender: 'L',
      birthDate: '',
      address: '',
      entryDate: booking.bookingDate || new Date().toISOString().split('T')[0],
      entryTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
      origin: booking.patientStatus || 'Di Rumah',
      originUnit: booking.patientStatus || 'Di Rumah',
      unitTujuan: booking.plannedRoom || 'Ruang Bedah',
      kelasRawat: 'Kelas 3',
      ruangan: booking.plannedRoom || 'Ruang Bedah',
      nomorBed: '',
      paymentMethod: ['BPJS KESEHATAN'],
      noSEP: '',
      statusSEP: 'Belum Terbit',
      jenisKLL: 'Bukan KLL',
      noLP: '',
      perawatPrimer: user?.name || '',
      catatanKhusus: booking.notes || '',
      diagnosaUtama: booking.notes || '',
      tindakanProsedur: '',
      dpjpList: [],
      statusDataPasien: 'Masih Dirawat',
      status: 'ADMITTED'
    };

    setEditingPatient(prefilledPatient);
    setIsPatientModalOpen(true);
  };

  const handleStartEditPatient = async (p: Patient) => {
    if (user?.isRecovery) {
      setNotification({
        message: 'Mode Pemulihan Read-Only aktif: Edit data pasien dinonaktifkan.',
        type: 'danger'
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    const username = user?.username || 'Guest';
    try {
      const res = await fetch(`/api/patients/${p.id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      if (result.success === false) {
        alert(`[CONCURRENCY LOCK] Pasien [${p.name}] sedang diedit oleh [${result.lockedBy}]. Anda tidak dapat menyimpan perubahan hingga kunci dilepaskan atau masa berlaku habis (10 menit).`);
        return;
      }
      setEditingPatient(p);
      setIsPatientModalOpen(true);
    } catch (e) {
      // Fallback
      setEditingPatient(p);
      setIsPatientModalOpen(true);
    }
  };

  const enforceMasihDirawatBypass = (pData: any): any => {
    const statusUpper = (pData.statusDataPasien || '').toUpperCase().trim();
    const isMasihDirawat = statusUpper === 'MASIH DIRAWAT' || statusUpper === 'AKTIF' || statusUpper === '';
    if (isMasihDirawat) {
      return {
        ...pData,
        statusDataPasien: 'Masih Dirawat',
        status: 'ADMITTED',
        dischargeDate: '',
        dischargeTime: '',
        apsReason: '',
        referralDestination: '',
        deathTime: '',
        transferDestinationRoom: ''
      };
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toTimeString().split(' ')[0].substring(0, 5);
    return {
      ...pData,
      status: 'DISCHARGED',
      dischargeDate: pData.dischargeDate || todayStr,
      dischargeTime: pData.dischargeTime || nowTimeStr
    };
  };

  const checkBedDoubleBooking = (patientId: string | null, rgn: string, bNo: string): string | null => {
    if (!rgn || !bNo || rgn === '-' || bNo === '-') return null;
    const cleanRoom = rgn.trim().toLowerCase();
    const cleanBed = bNo.trim().toLowerCase();

    const conflictingPatient = (appData.patients || []).find(p => {
      if (patientId && p.id === patientId) return false;
      const statusUpper = (p.statusDataPasien || '').toUpperCase().trim();
      const isActive = statusUpper === 'MASIH DIRAWAT' || statusUpper === 'AKTIF' || statusUpper === '';
      if (!isActive) return false;

      return (p.ruangan || '').trim().toLowerCase() === cleanRoom &&
             (p.nomorBed || '').trim().toLowerCase() === cleanBed;
    });

    if (conflictingPatient) {
      return `Kamar / Bed "${cleanBed}" di Ruangan "${rgn}" sudah ditempati oleh pasien "${conflictingPatient.name}" (RM: ${conflictingPatient.noRM}) yang saat ini berstatus "Masih Dirawat".`;
    }
    return null;
  };

  const handleAddPatient = (patientData: Omit<Patient, 'id'>) => {
    const newData = { ...appData };
    
    // Check double-booking for the added / edited patient
    const statusUpper = (patientData.statusDataPasien || '').toUpperCase().trim();
    const isAdmitted = statusUpper === 'MASIH DIRAWAT' || statusUpper === 'AKTIF' || statusUpper === '';
    
    if (isAdmitted) {
      const conflictMsg = checkBedDoubleBooking(editingPatient ? editingPatient.id : null, patientData.ruangan || '', patientData.nomorBed || '');
      if (conflictMsg) {
        alert(`[DETEKSI DOUBLE-BOOKING]\n\n${conflictMsg}\n\nTransaksi dibatalkan. Selesaikan status pasien sebelumnya atau ganti alokasi Bed.`);
        return;
      }
    }

    if (editingPatient) {
      const pId = editingPatient.id;
      const username = user?.username || 'Guest';
      fetch(`/api/patients/${pId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      }).catch(() => {});

      const dbPatient = (newData.patients || []).find(p => p.id === editingPatient.id);
      if (dbPatient && dbPatient.lastModified && editingPatient.lastModified && dbPatient.lastModified !== editingPatient.lastModified) {
        const confirmOverride = window.confirm(
          `[CONCURRENCY LOCK] Pasien telah diperbarui oleh perangkat lain pada ${new Date(dbPatient.lastModified).toLocaleTimeString()}.\n\nApakah Anda yakin ingin menimpa data terbaru tersebut?`
        );
        if (!confirmOverride) return;
      }

      newData.patients = (newData.patients || []).map(p => {
        if (p.id === editingPatient.id) {
          const merged = { ...p, ...patientData };
          if (patientData.dpjpList !== undefined) {
            const firstDoc = patientData.dpjpList?.[0] || '';
            merged.dpjp = firstDoc;
            merged.ksm = firstDoc ? (newData.masterData.doctorMetadata?.[firstDoc]?.ksm || '') : '';
          }
          const cleanPatient = enforceMasihDirawatBypass(merged);
          const nowIso = new Date().toISOString();
          return { ...cleanPatient, lastModified: nowIso, updatedAt: nowIso };
        }
        return p;
      });
    } else {
      const mergedNew = { ...patientData };
      if (patientData.dpjpList !== undefined) {
        const firstDoc = patientData.dpjpList?.[0] || '';
        mergedNew.dpjp = firstDoc;
        mergedNew.ksm = firstDoc ? (newData.masterData.doctorMetadata?.[firstDoc]?.ksm || '') : '';
      }
      const cleanNew = enforceMasihDirawatBypass({
        ...mergedNew,
        id: generatePermanentUUID('P')
      });
      const nowIso = new Date().toISOString();
      const newPatient: Patient = {
        ...cleanNew,
        lastModified: nowIso,
        updatedAt: nowIso
      };
      newData.patients = [...(newData.patients || []), newPatient];
    }
    handleUpdateAppData(newData);
    notify(editingPatient ? 'DATA PASIEN DIPERBARUI' : 'PASIEN BARU BERHASIL TERDAFTAR');
    setIsPatientModalOpen(false);
    setEditingPatient(null);
  };

  const handleUpdatePatient = (id: string, updates: Partial<Patient>) => {
    // Extract _autoRegisterNewRecord if present
    const autoRegisterNewRecord = (updates as any)._autoRegisterNewRecord;
    const batchUpdates = (updates as any)._batchUpdates as { id: string; updates: Partial<Patient> }[] | undefined;
    const cleanUpdates = { ...updates };
    delete (cleanUpdates as any)._autoRegisterNewRecord;
    delete (cleanUpdates as any)._batchUpdates;

    // Check double-booking for update
    const currentPatient = (appData.patients || []).find(p => p.id === id);
    if (currentPatient) {
      const targetRuangan = cleanUpdates.ruangan !== undefined ? cleanUpdates.ruangan : currentPatient.ruangan;
      const targetBed = cleanUpdates.nomorBed !== undefined ? cleanUpdates.nomorBed : currentPatient.nomorBed;
      const targetStatus = cleanUpdates.statusDataPasien !== undefined ? cleanUpdates.statusDataPasien : currentPatient.statusDataPasien;
      const statusUpper = (targetStatus || '').toUpperCase().trim();
      const isAdmitted = statusUpper === 'MASIH DIRAWAT' || statusUpper === 'AKTIF' || statusUpper === '';

      if (isAdmitted && (cleanUpdates.nomorBed !== undefined || cleanUpdates.ruangan !== undefined || cleanUpdates.statusDataPasien !== undefined)) {
        const conflictMsg = checkBedDoubleBooking(id, targetRuangan || '', targetBed || '');
        if (conflictMsg) {
          alert(`[DETEKSI DOUBLE-BOOKING]\n\n${conflictMsg}\n\nPerubahan Bed/Ruangan atau status dibatalkan.`);
          return;
        }
      }
    }

    const newData = { ...appData };
    newData.patients = (newData.patients || []).map(p => {
      // Check if there is a batch update for this patient
      const matchBatch = batchUpdates?.find(bu => bu.id === p.id);
      const activeUpdates = p.id === id ? cleanUpdates : (matchBatch ? matchBatch.updates : null);

      if (activeUpdates) {
        const merged = { ...p, ...activeUpdates };
        if (activeUpdates.dpjpList !== undefined) {
          const firstDoc = activeUpdates.dpjpList?.[0] || '';
          merged.dpjp = firstDoc;
          merged.ksm = firstDoc ? (newData.masterData.doctorMetadata?.[firstDoc]?.ksm || '') : '';
        }
        const cleanPatient = enforceMasihDirawatBypass(merged);
        const nowIso = new Date().toISOString();
        return { ...cleanPatient, lastModified: nowIso, updatedAt: nowIso };
      }
      return p;
    });

    if (autoRegisterNewRecord) {
      const nowIso = new Date().toISOString();
      const permanentAutoRecord = {
        ...autoRegisterNewRecord,
        id: autoRegisterNewRecord.id && !autoRegisterNewRecord.id.startsWith('P-17') ? autoRegisterNewRecord.id : generatePermanentUUID('P'),
        lastModified: nowIso,
        updatedAt: nowIso
      };
      newData.patients.push(permanentAutoRecord);
    }

    handleUpdateAppData(newData);
    if (cleanUpdates.perawatPrimer) notify('PENUGASAN PPJA DIPERBARUI');
  };

  const handleCreateEmptyPatient = () => {
    const savedAdmin = typeof window !== 'undefined' ? localStorage.getItem('simantap_admin_pj') || '' : '';
    const newPatient: Patient = {
      id: generatePermanentUUID('P'),
      noRegister: `REG-${Date.now().toString().slice(-6)}`,
      noRM: '',
      name: 'PASIEN BARU',
      gender: 'L',
      birthDate: '1985-01-01',
      address: '',
      entryDate: new Date().toISOString().split('T')[0],
      origin: 'IGD',
      unitTujuan: 'Rawat Inap',
      kelasRawat: 'Kelas 3',
      ruangan: safeAppData.masterData.rooms[0] || '3A1',
      nomorBed: '',
      statusDataPasien: 'AKTIF',
      diagnosaUtama: '',
      diagnosaSekunder: '',
      tindakanProsedur: '',
      dpjpList: [],
      paymentMethod: ['BPJS'],
      noSEP: '',
      statusSEP: 'Selesai SEP',
      jenisKLL: 'Bukan KLL',
      noLP: '',
      perawatPrimer: '',
      adminResp: savedAdmin,
      catatanKhusus: '',
      status: 'ADMITTED',
      lastModified: new Date().toISOString()
    };
    
    const newData = {
      ...appData,
      patients: [...(appData.patients || []), newPatient]
    };
    handleUpdateAppData(newData);
    notify('BARIS DATA PASIEN BARU BERHASIL DITAMBAHKAN');
  };

  const handleAddDoctorVisit = (visit: DoctorVisitRecord) => {
    const visitWithLm = { ...visit, lastModified: new Date().toISOString() };
    const patientObj = (appData.patients || []).find(p => p.id === visit.patientId);
    
    // Propagate doctor to Registrasi Admin (patient's dpjpList) without destroying manual data
    const updatedPatients = (appData.patients || []).map(p => {
      if (p.id === visit.patientId) {
        const currentDpjpList = p.dpjpList || [];
        if (!currentDpjpList.includes(visit.doctorName)) {
          return {
            ...p,
            dpjpList: [...currentDpjpList, visit.doctorName],
            lastModified: new Date().toISOString()
          };
        }
      }
      return p;
    });

    const newData = {
      ...appData,
      patients: updatedPatients,
      doctorVisits: [...(appData.doctorVisits || []), visitWithLm]
    };
    handleUpdateAppData(newData);
    notify('VISITE DOKTER BERHASIL DICATAT KE MEDIS & ABSENSI');
  };

  const handleUpdateDoctorVisit = (id: string, updates: Partial<DoctorVisitRecord>) => {
    const updatedLM = new Date().toISOString();
    const originalVisit = (appData.doctorVisits || []).find(v => v.id === id);
    let updatedPatients = appData.patients || [];
    
    if (originalVisit && updates.doctorName && originalVisit.doctorName !== updates.doctorName) {
      updatedPatients = updatedPatients.map(p => {
        if (p.id === originalVisit.patientId) {
          const currentDpjpList = p.dpjpList || [];
          const filtered = currentDpjpList.filter(d => d !== originalVisit.doctorName);
          if (!filtered.includes(updates.doctorName!)) {
            filtered.push(updates.doctorName!);
          }
          return {
            ...p,
            dpjpList: filtered,
            lastModified: updatedLM
          };
        }
        return p;
      });
    }

    const newData = {
      ...appData,
      patients: updatedPatients,
      doctorVisits: (appData.doctorVisits || []).map(v => v.id === id ? { ...v, ...updates, lastModified: updatedLM } : v)
    };
    handleUpdateAppData(newData);
  };

  const handleDeleteDoctorVisit = (id: string) => {
    registerDeletedId(id);
    const newData = {
      ...appData,
      doctorVisits: (appData.doctorVisits || []).filter(v => v.id !== id)
    };
    handleUpdateAppData(newData);
    notify('DATA VISITE DOKTER DIHAPUS', 'danger');
  };

  const handleUpdateDailyReport = async (patientId: string, type: keyof DailyReportEntry | 'BATCH', content: any, date?: string) => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    let reports = [...(appData.dailyReports || [])];

    // Check if the update is setting / editing surgery fields
    const isEditingSurgery = 
      (type === 'BATCH' && (content.surgeryProcedure !== undefined || content.surgeryStatus !== undefined)) ||
      type === 'surgeryProcedure' || type === 'surgeryStatus';

    const isRescheduling = isEditingSurgery && 
      ((type === 'BATCH' && content.surgeryStatus === 'RESCHEDULED' && content.surgeryNewDate) ||
       (type === 'surgeryStatus' && content === 'RESCHEDULED'));

    const allowedDates = [targetDate];
    if (isRescheduling) {
      if (type === 'BATCH' && content.surgeryNewDate) {
        allowedDates.push(content.surgeryNewDate);
      } else {
        const currentReport = reports.find(r => r.patientId === patientId && r.date === targetDate);
        if (currentReport?.surgeryNewDate) {
          allowedDates.push(currentReport.surgeryNewDate);
        }
      }
    }

    // Auto-deduplication: If this patient already has a surgery record on another date,
    // we must clear other duplicate surgery records for this patient to ensure they don't show up in quality reports.
    if (isEditingSurgery) {
      reports = reports.map(r => {
        if (r.patientId === patientId && !allowedDates.includes(r.date)) {
          if (r.surgeryProcedure) {
            return {
              ...r,
              surgeryProcedure: "",
              surgeryOperator: "",
              surgeryDate: "",
              surgeryTime: "",
              surgeryAnesthesiaType: "",
              surgeryUrgency: "ELECTIVE",
              surgeryStatus: "SCHEDULED",
              surgeryDelayReason: "",
              surgeryNewDate: "",
              surgeryNewTime: "",
              lastModified: new Date().toISOString()
            };
          }
        }
        return r;
      });
    }

    const nowStr = new Date().toISOString();
    const existingIdx = reports.findIndex(r => r.patientId === patientId && r.date === targetDate);
    const existingReport = existingIdx > -1 ? reports[existingIdx] : null;
    const existingFieldTimes = existingReport?.fieldModifiedTimes || {};
    
    const newFieldTimes = { ...existingFieldTimes };
    if (type === 'BATCH') {
      Object.keys(content).forEach(k => {
        newFieldTimes[k] = nowStr;
      });
    } else {
      newFieldTimes[type] = nowStr;
    }

    let updatedReports;
    if (existingIdx > -1) {
      if (type === 'BATCH') {
        updatedReports = reports.map((r, i) => i === existingIdx ? { ...r, ...content, fieldModifiedTimes: newFieldTimes, lastModified: nowStr, updatedAt: nowStr } : r);
      } else {
        updatedReports = reports.map((r, i) => i === existingIdx ? { ...r, [type]: content, fieldModifiedTimes: newFieldTimes, lastModified: nowStr, updatedAt: nowStr } : r);
      }
    } else {
      const newEntry: DailyReportEntry = {
        patientId,
        date: targetDate,
        ...(type === 'BATCH' ? content : { [type]: content }),
        fieldModifiedTimes: newFieldTimes,
        lastModified: nowStr,
        updatedAt: nowStr
      } as DailyReportEntry;
      updatedReports = [...reports, newEntry];
    }

    // Handle automatic rescheduling copy/move
    if (isRescheduling) {
      const currentReport = updatedReports.find(r => r.patientId === patientId && r.date === targetDate) || {};
      const newDate = currentReport.surgeryNewDate;
      if (newDate) {
        const newTime = currentReport.surgeryNewTime || currentReport.surgeryTime || "08:00";
        const newDateIdx = updatedReports.findIndex(r => r.patientId === patientId && r.date === newDate);
        
        const surgeryDataForNewDate = {
          surgeryProcedure: currentReport.surgeryProcedure || "",
          surgeryOperator: currentReport.surgeryOperator || "",
          surgeryDate: newDate,
          surgeryTime: newTime,
          surgeryAnesthesiaType: currentReport.surgeryAnesthesiaType || "",
          surgeryUrgency: currentReport.surgeryUrgency || "ELECTIVE",
          surgeryStatus: "SCHEDULED", // Scheduled on the new date
          surgeryDelayReason: "",
          surgeryNewDate: "",
          surgeryNewTime: "",
        };

        const rescheduledFieldTimes: Record<string, string> = {
          ...(newDateIdx > -1 ? (updatedReports[newDateIdx].fieldModifiedTimes || {}) : {})
        };
        Object.keys(surgeryDataForNewDate).forEach(k => {
          rescheduledFieldTimes[k] = nowStr;
        });

        if (newDateIdx > -1) {
          updatedReports = updatedReports.map((r, i) => 
            i === newDateIdx ? { ...r, ...surgeryDataForNewDate, fieldModifiedTimes: rescheduledFieldTimes, lastModified: nowStr } : r
          );
        } else {
          const newDateEntry = {
            patientId,
            date: newDate,
            ...surgeryDataForNewDate,
            fieldModifiedTimes: rescheduledFieldTimes,
            lastModified: nowStr
          };
          updatedReports = [...updatedReports, newDateEntry];
        }
      }
    }
    
    const newData = {
      ...appData,
      dailyReports: updatedReports
    };
    const res = await handleUpdateAppData(newData, false);
    if (typeof type === 'string' && type.includes('Report')) notify('LAPORAN SHIFT DISIMPAN');
    if (typeof type === 'string' && type.includes('Therapy')) notify('TERAPI MEDIS DIPERBARUI');
    return res;
  };

  const handleUpdateDependency = (patientId: string, shift: 'morning' | 'afternoon' | 'night', level: DependencyLevel, date?: string) => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const reports = [...(appData.dailyReports || [])];
    const existingIdx = reports.findIndex(r => r.patientId === patientId && r.date === targetDate);
    
    const fieldName = `${shift}Dependency` as keyof DailyReportEntry;
    
    let updatedReports;
    if (existingIdx > -1) {
      updatedReports = reports.map((r, i) => i === existingIdx ? { ...r, [fieldName]: level, lastModified: new Date().toISOString() } as any : r);
    } else {
      const newEntry: DailyReportEntry = {
        patientId,
        date: targetDate,
        [fieldName]: level,
        lastModified: new Date().toISOString()
      } as any;
      updatedReports = [...reports, newEntry];
    }
    
    const newData = {
      ...appData,
      dailyReports: updatedReports
    };
    handleUpdateAppData(newData);
    notify(`TINGKAT KETERGANTUNGAN ${level} CARE BERHASIL DISIMPAN`);
  };

  const handleAddFinance = (rec: FinanceRecord) => {
    const newData = { ...appData };
    const recWithLm = { ...rec, lastModified: new Date().toISOString() };
    const exists = (newData.financeRecords || []).some(r => r.id === rec.id);
    if (exists) {
      newData.financeRecords = (newData.financeRecords || []).map(r => r.id === rec.id ? recWithLm : r);
      notify('TRANSAKSI KEUANGAN BERHASIL DIPERBARUI');
    } else {
      newData.financeRecords = [...(newData.financeRecords || []), recWithLm];
      notify('TRANSAKSI KEUANGAN BERHASIL DIPOSTING');
    }
    handleUpdateAppData(newData);
  };

  const handleDeleteFinance = (id: string) => {
    registerDeletedId(id);
    const newData = { ...appData };
    newData.financeRecords = (newData.financeRecords || []).filter(r => r.id !== id);
    handleUpdateAppData(newData, true);
    notify('DATA ENTRY KEUANGAN BERHASIL DIHAPUS', 'danger');
  };

  const handleImportFinance = (recs: FinanceRecord[]) => {
    const newData = { ...appData };
    const recsWithLm = recs.map(r => ({ ...r, lastModified: new Date().toISOString() }));
    newData.financeRecords = [...(newData.financeRecords || []), ...recsWithLm];
    handleUpdateAppData(newData);
    notify(`${recs.length} BARIS TRANSAKSI BERHASIL DIIMPOR`);
  };

  const handleAddIncident = (rep: IncidentReport) => {
    const newData = { ...appData };
    const repWithLm = { ...rep, lastModified: new Date().toISOString() };
    newData.incidentReports = [...(newData.incidentReports || []), repWithLm];
    handleUpdateAppData(newData);
    notify('LAPORAN INSIDEN BERHASIL TERKIRIM');
  };

  const handleUpdateIncident = (id: string, update: string | Partial<IncidentReport>) => {
    const newData = { ...appData };
    const updates = typeof update === 'string' ? { status: update as IncidentReport['status'] } : update;
    newData.incidentReports = (newData.incidentReports || []).map(r => r.id === id ? { ...r, ...updates, lastModified: new Date().toISOString() } : r);
    handleUpdateAppData(newData);
    notify('STATUS & INVESTIGASI INSIDEN DIPERBARUI');
  };

  const handleUpdateMasterData = (newMasterData: AppData['masterData']) => {
    if (typeof window !== "undefined") {
      (window as any).isCloudError = false;
      (window as any).cloudStatus = 'CONNECTED';
    }
    const updatedSettings = {
      ...(newMasterData?.settings || {}),
      settingsTimestamp: new Date().toISOString()
    };
    const updatedMaster = {
      ...(newMasterData || {}),
      settings: updatedSettings
    };
    const newData = { ...appData, masterData: updatedMaster as any };
    // Purely asynchronous background sync to satisfy the globalization and zero-delay requirements
    handleUpdateAppData(newData, false).catch(() => {});
  };

  const handleSync = async () => {
    if (syncStatus === 'SYNCING') return;
    setSyncStatus('SYNCING');
    try {
      const res = await syncData(true);
      if (res.success) {
        setAppData(getDB());
        setSyncStatus('SUCCESS');
        setLastSyncTime(new Date());
        setTimeout(() => setSyncStatus('IDLE'), 3000);
      } else {
        setSyncStatus('ERROR');
        if (res.error) setNotification({ message: `Sync Gagal: ${res.error}`, type: 'danger' });
      }
    } catch (e) {
      console.warn('Manual sync failed:', e);
      setSyncStatus('ERROR');
      setTimeout(() => setSyncStatus('IDLE'), 3000);
    }
  };

  const handleSaveQualityMeasurement = (measurement: QualityMeasurement | QualityMeasurement[], immediate: boolean = false) => {
    const newData = { ...appData };
    const nowIso = new Date().toISOString();
    
    if (Array.isArray(measurement)) {
      const currentList = [...(newData.qualityMeasurements || [])];
      measurement.forEach(m => {
        const mWithLm: QualityMeasurement = {
          ...m,
          id: m.id || `qm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          lastModified: nowIso,
          updatedAt: nowIso
        };
        const idx = currentList.findIndex(existing => 
          (existing.id && mWithLm.id && existing.id === mWithLm.id) || 
          (existing.indicatorId === mWithLm.indicatorId && existing.date === mWithLm.date)
        );
        if (idx > -1) {
          currentList[idx] = mWithLm;
        } else {
          currentList.push(mWithLm);
        }
      });
      newData.qualityMeasurements = currentList;
    } else {
      const measurements = [...(newData.qualityMeasurements || [])];
      const existingIdx = measurements.findIndex(m => 
        (m.id && measurement.id && m.id === measurement.id) || 
        (m.indicatorId === measurement.indicatorId && m.date === measurement.date)
      );
      
      const measurementWithLm: QualityMeasurement = {
        ...measurement,
        id: measurement.id || `qm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        lastModified: nowIso,
        updatedAt: nowIso
      };
      if (existingIdx > -1) {
        measurements[existingIdx] = measurementWithLm;
      } else {
        measurements.push(measurementWithLm);
      }
      newData.qualityMeasurements = measurements;
    }
    
    notify('DATA PENGUKURAN MUTU TERSIMPAN');
    return handleUpdateAppData(newData, immediate);
  };

  const handleAddInstrument = (inst: Omit<Instrument, 'id'>) => {
    const newData = { ...appData };
    const nowIso = new Date().toISOString();
    const newInstrument: Instrument = { ...inst, id: `INST-${Date.now()}`, lastModified: nowIso, updatedAt: nowIso };
    newData.instruments = [...(newData.instruments || []), newInstrument];
    handleUpdateAppData(newData);
    notify('INSTRUMEN BARU BERHASIL DITAMBAHKAN');
  };

  const handleUpdateInstrument = (id: string, updates: Partial<Instrument>) => {
    const newData = { ...appData };
    const nowIso = new Date().toISOString();
    newData.instruments = (newData.instruments || []).map(i => i.id === id ? { ...i, ...updates, lastModified: nowIso, updatedAt: nowIso } : i);
    handleUpdateAppData(newData);
    notify('DATA INSTRUMEN DIPERBARUI');
  };

  const handleAddOperationReport = (report: Omit<OperationReport, 'id' | 'createdAt'>) => {
    const newData = { ...appData };
    const nowIso = new Date().toISOString();
    const newReport: OperationReport = { 
      ...report, 
      id: `OPR-${Date.now()}`,
      createdAt: nowIso,
      lastModified: nowIso,
      updatedAt: nowIso
    };
    newData.operationReports = [...(newData.operationReports || []), newReport];
    handleUpdateAppData(newData);
    notify('LAPORAN OPERASI BERHASIL DISIMPAN');
  };

  const handleUpdateOperationReport = (id: string, report: Partial<OperationReport>) => {
    const newData = { ...appData };
    const nowIso = new Date().toISOString();
    newData.operationReports = (newData.operationReports || []).map(r => 
      r.id === id ? { ...r, ...report, lastModified: nowIso, updatedAt: nowIso } : r
    );
    handleUpdateAppData(newData);
    notify('LAPORAN OPERASI BERHASIL DIPERBARUI');
  };

  const handleDeleteOperationReport = (id: string) => {
    registerDeletedId(id);
    const newData = { ...appData };
    newData.operationReports = (newData.operationReports || []).filter(r => r.id !== id);
    handleUpdateAppData(newData, true);
    notify('LAPORAN OPERASI BERHASIL DIHAPUS', 'danger');
  };

  const handleDeletePatient = (id: string) => {
    registerDeletedId(id);
    const targetPat = (appData.patients || []).find(p => p.id === id);
    if (targetPat && targetPat.noRM) registerDeletedId(targetPat.noRM);
    (appData.dailyReports || []).forEach(r => {
      if (r.patientId === id) registerDeletedId(`${r.patientId}_${r.date}`);
    });
    (appData.financeRecords || []).forEach(f => {
      if (f.patientId === id && f.id) registerDeletedId(f.id);
    });
    (appData.doctorVisits || []).forEach(v => {
      if (v.patientId === id && v.id) registerDeletedId(v.id);
    });
    const newData = { ...appData };
    newData.patients = (newData.patients || []).filter(p => p.id !== id);
    handleUpdateAppData(newData, true);
    notify('DATA PASIEN DIHAPUS DARI SISTEM', 'danger');
  };

  const handleDeleteIncident = (id: string) => {
    registerDeletedId(id);
    const newData = { ...appData };
    newData.incidentReports = (newData.incidentReports || []).filter(r => r.id !== id);
    handleUpdateAppData(newData, true);
    notify('LAPORAN INSIDEN TELAH DIHAPUS', 'danger');
  };

  const renderContent = () => {
    const today = new Date().toISOString().split('T')[0];
    const financeRecords = appData.financeRecords || [];
    const incidentReports = appData.incidentReports || [];
    const openIncidents = incidentReports.filter(i => i.status !== 'RESOLVED');

    // Safe adaptive design parameters to ensure full accessibility on different backgrounds
    const hasWallpaper = !!safeAppData.masterData?.settings?.appWallpaperUrl;
    const originalFontColor = safeAppData.masterData?.settings?.fontColor || '#1e293b';
    const safeTitleColor = hasWallpaper ? originalFontColor : '#1e293b';
    const safeSubTitleColor = hasWallpaper ? (originalFontColor === '#ffffff' ? '#ffffffcc' : `${originalFontColor}cc`) : '#64748b';

    // Stats calculations
    const patients = appData.patients || [];
    const patientsToday = patients.filter(p => p.entryDate === today).length;
    // Helper to check if patient is effectively discharged
    const isDischarged = (p: Patient) => {
      if ((p.status as string) === 'DISCHARGED') return true;
      const s = (p.statusDataPasien || '').toUpperCase();
      return (
        s.includes('PULANG') || 
        s.includes('BPL') || 
        s.includes('APS') || 
        s.includes('DIRUJUK') || 
        s.includes('MENINGGAL') || 
        s.includes('PINDAH') || 
        s.includes('BATAL') || 
        s.includes('KELUAR') || 
        (p.status as string) === 'DISCHARGED'
      );
    };

    const dischargedToday = patients.filter(isDischarged).length;
    const occupiedBedsCount = patients.filter(p => !isDischarged(p)).length;

    // Helper functions to get deduplicated surgery reports per patient per surgery date
    const getUniqueSurgeryReports = (list: any[]) => {
      const map = new Map<string, any>();
      (list || []).forEach(r => {
        if (!r.surgeryDate) return;
        const key = `${r.patientId}_${r.surgeryDate}`;
        const existing = map.get(key);
        // Overwrite if newer report is found
        if (!existing || (r.lastModified && existing.lastModified && r.lastModified > existing.lastModified) || r.date > existing.date) {
          map.set(key, r);
        }
      });
      return Array.from(map.values());
    };

    const uniqueSurgeryReports = getUniqueSurgeryReports(appData.dailyReports || []);
    const surgeryToday = uniqueSurgeryReports.filter(r => r.surgeryDate === today).length;
    
    // Bed Occupancy (BOR)
    const totalBedsAcrossUnits: number = (Object.values(safeAppData.masterData.roomToBeds || {}) as string[][]).reduce((acc: number, beds: string[]) => acc + beds.length, 0) || 1;
    const bor = Math.round((occupiedBedsCount / totalBedsAcrossUnits) * 100);

    // Quality Compliance Rate Calculation
    const qualityList = appData.qualityMeasurements || [];
    let complianceRate = '98.2%';
    if (qualityList.length > 0) {
      const scoredList = qualityList.filter((q: any) => q.score !== undefined);
      if (scoredList.length > 0) {
        const avg = scoredList.reduce((acc: number, q: any) => acc + (Number(q.score) || 0), 0) / scoredList.length;
        complianceRate = `${avg.toFixed(1)}%`;
      }
    }

    // Charts data
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const performanceData = last7Days.map(date => ({
      day: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][new Date(date).getDay()],
      val: uniqueSurgeryReports.filter(r => r.surgeryDate === date).length
    }));

    const financeByMonth = Array.from({ length: 4 }, (_, i) => {
      const monthIdx = (new Date().getMonth() - (3 - i) + 12) % 12;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const monthYear = `${monthIdx + 1}`.padStart(2, '0');
      const rev = (appData.financeRecords || [])
        .filter(f => f.type === 'INCOME' && f.date.includes(`-${monthYear}-`))
        .reduce((sum, r) => sum + r.amount, 0) / 1000000;
      return { month: monthNames[monthIdx], rev };
    });

    const surgeriesTodayList = (appData.patients || [])
      .filter(p => {
        const report = uniqueSurgeryReports.find(r => r.patientId === p.id && r.surgeryDate === today);
        return !!report;
      })
      .map(p => {
        const report = uniqueSurgeryReports.find(r => r.patientId === p.id && r.surgeryDate === today);
        return {
          id: p.id,
          time: report?.surgeryTime || '08:00',
          patient: p.name,
          op: report?.surgeryProcedure || p.diagnosaUtama || 'Proses Pembedahan',
          doc: report?.surgeryOperator || p.dpjp || 'dr. Bedah, Sp.B'
        };
      });

    switch (activeMenu) {
      case 'dashboard':
        return (
          <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black tracking-tight" style={{ color: safeTitleColor }}>Dashboard Overview</h3>
                <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: safeSubTitleColor }}>Monitoring Real-time Pelayanan Bedah</p>
              </div>
              <Button onClick={() => setIsPatientModalOpen(true)} className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white shadow-xl shadow-blue-100">
                <Plus size={18} className="mr-2"/> Registrasi Pasien Baru
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                { label: 'Operasi Hari Ini', val: surgeryToday, icon: <Activity/>, color: 'blue', desc: 'Real-time schedule' },
                { label: 'Revenue Pelayanan', val: `Rp${(financeRecords.filter(f => f.type === 'INCOME').reduce((a, b) => a + b.amount, 0) / 1000000).toFixed(1)}M`, icon: <Wallet/>, color: 'emerald', desc: 'Bulan berjalan' },
                { label: 'Indikator Mutu', val: complianceRate, icon: <HeartPulse/>, color: 'indigo', desc: 'Compliance Rate' },
                { label: 'Insiden Aktif', val: openIncidents.length, icon: <AlertCircle/>, color: 'red', desc: 'Segera tindak lanjuti' }
              ].map((stat, idx) => (
                <div key={`${stat.label}-${idx}`} className="p-5 sm:p-6 rounded-3xl sm:rounded-[2rem] border shadow-sm group hover:shadow-xl transition-all border-b-4 bg-white/70 backdrop-blur-md" style={{ borderColor: `var(--tw-color-${stat.color}-500)` }}>
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div className={`p-2 sm:p-3 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl group-hover:scale-110 transition-transform`}>
                      {React.cloneElement(stat.icon as React.ReactElement, { size: isMobile ? 20 : 24 })}
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-800">{stat.val}</div>
                  <div className="text-[10px] sm:text-[11px] font-bold mt-1 uppercase tracking-wider text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 p-8 rounded-[2.5rem] border shadow-sm flex flex-col relative overflow-hidden group bg-white/70 backdrop-blur-md">
                <div className="flex justify-between items-center mb-12">
                  <h4 className="font-black text-2xl tracking-tight flex items-center gap-3 text-slate-800">
                     <BarChart3 className="text-blue-600"/> Analisis Performance Bedah
                  </h4>
                </div>
                <div className="flex-1 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={12} tick={{fill: '#94a3b8', fontWeight: 700}} />
                      <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{fill: '#94a3b8', fontWeight: 700}} />
                      <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="val" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="lg:col-span-4">
                <div className="bg-slate-900/90 backdrop-blur-xl p-8 rounded-[2.5rem] border shadow-2xl flex flex-col h-full relative overflow-hidden group">
                  <h4 className="font-black text-white text-xl tracking-tight flex items-center gap-3 mb-6">
                    <ShieldAlert className="text-red-500" size={24}/> Critical Alerts
                  </h4>
                  <div className="space-y-4">
                    {incidentReports.length > 0 ? incidentReports.slice(-3).reverse().map((i, idx) => (
                      <div key={`${i.id}-${idx}`} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                          <span className="text-red-400">{i.severity} RISK</span>
                          <span className="text-slate-500">{i.date}</span>
                        </div>
                        <div className="text-xs font-black text-slate-100">{i.incidentType}</div>
                      </div>
                    )) : (
                      <div className="py-8 text-center text-slate-500 font-bold text-xs">Semua aman & terkendali.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'adm-register':
        return (
          <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-12 shadow-sm border text-center animate-fade-in">
             <div className="w-20 h-20 bg-blue-50/50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                <Users size={40}/>
             </div>
              <h3 className="text-2xl font-black tracking-tighter text-slate-800">Registrasi Pasien</h3>
             <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <Button onClick={() => setIsPatientModalOpen(true)} className="py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-100">
                  <Plus size={18} className="mr-2"/> Input Pasien Baru
                </Button>
                <Button variant="secondary" onClick={() => setActiveMenu('patients')} className="py-4 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer">
                  <Search size={18} className="mr-2"/> Cari Data Pasien
                </Button>
             </div>
              <div className="mt-12 text-left">
                <h4 className="font-black text-sm uppercase tracking-widest mb-4 text-slate-800">Pendaftaran Terbaru</h4>
                <div className="rounded-3xl p-6 border border-dashed border-slate-200 overflow-x-auto bg-white/40 backdrop-blur-sm">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase font-black tracking-tighter text-[10px] border-b">
                        <th className="p-4 text-left">Tgl Masuk</th>
                        <th className="p-4 text-left">No. RM</th>
                        <th className="p-4 text-left">Nama Pasien</th>
                        <th className="p-4 text-left">Lokasi Rawat</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(appData.patients || []).length > 0 ? (appData.patients || []).slice(-5).reverse().map((p, idx) => (
                        <tr key={`${p.id}-${idx}`} className="border-b last:border-0 hover:bg-white transition-colors group">
                          <td className="p-4 font-bold text-slate-600">{p.entryDate}</td>
                          <td className="p-4 font-black text-blue-600">{p.noRM}</td>
                          <td className="p-4 font-black text-slate-800 uppercase">{p.name}</td>
                          <td className="p-4 text-slate-500 font-medium">{p.ruangan} - {p.nomorBed}</td>
                          <td className="p-4 text-center">
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full font-black text-[9px] uppercase">{p.statusDataPasien}</span>
                          </td>
                          <td className="p-4 text-right flex items-center justify-end gap-2">
                             <button 
                               onClick={() => handleStartEditPatient(p)}
                               className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase transition-all hover:bg-blue-600 hover:text-white"
                             >
                               Edit
                             </button>
                             {(user?.role === 'SUPER_ADMIN' || user?.role === 'BIDANG') && (
                               <button 
                                 onClick={() => {
                                   setDeleteConfirmTarget({ id: p.id, name: p.name, type: 'patient' });
                                 }}
                                 className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase transition-all hover:bg-rose-600 hover:text-white"
                               >
                                 Hapus
                               </button>
                             )}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-slate-400 font-bold italic">Belum ada data pendaftaran pasien.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        );

      case 'adm-booking':
      case 'booking':
      case 'booking-ruangan':
      case 'patient-booking':
        return (
          <RoomBookingComponent
            appData={appData}
            bookings={appData?.roomBookings || []}
            masterData={safeAppData?.masterData}
            currentUser={user}
            onSaveBooking={handleSaveRoomBooking}
            onUpdateBookingStatus={handleUpdateBookingStatus}
            onUpdateStatus={handleUpdateBookingStatus}
            onDeleteBooking={handleDeleteRoomBooking}
            onCheckInToRegistration={handleCheckInBookingToRegistration}
          />
        );

      case 'adm-census':
        return <CensusAdvanced appData={appData} currentUser={user} />;

      case 'patients':
        return (
          <PatientModule 
            appData={appData} 
            onAddPatient={() => setIsPatientModalOpen(true)}
            onEditPatient={handleStartEditPatient}
            onDeletePatient={handleDeletePatient}
            currentUser={user}
          />
        );

      case 'monitoring-keluar-masuk':
        return (
          <MonitoringPasienKeluarMasuk 
            appData={appData}
            currentUser={user}
            onPatientClick={(id) => setSelectedDetailPatientId(id)}
          />
        );

      case 'quality-asesmen-awal-medis':
        return (
          <AsesmenAwalMedisWorksheet 
            appData={appData}
            onSaveMeasurement={handleSaveQualityMeasurement}
            currentUser={user}
            selectedDate={qualityFilterDate}
            setSelectedDate={setQualityFilterDate}
          />
        );

      case 'adm-data-bed': {
        const targetUnit = bedUnitFilter;
        const unitClasses = safeAppData.masterData.unitToClasses[targetUnit] || [];
        
        const bedPatients = appData.patients || [];
        
        // Define clean occupants logic based on the dynamic Sensus Date (monitoringFilterDate)
        const pOccupiesBedOnDate = (p: any, date: string, unitStr: string, rm: string, b: string) => {
          // Exactly the same logic as ServiceMatrix.tsx
          const isCurrentlyTreated = (p.statusDataPasien === "Masih Dirawat" || !p.statusDataPasien || (p.status !== "DISCHARGED" && (p.statusDataPasien === "Pindah Ruangan" || p.statusDataPasien === "Dipindah ke Ruangan Lain"))) && !String(p.statusDataPasien || '').toUpperCase().includes('BATAL');
          const matchesMasihDirawat = isCurrentlyTreated && !!p.entryDate && p.entryDate <= date && (!p.dischargeDate || p.dischargeDate > date);
          
          if (!matchesMasihDirawat) return false;
          
          const activeUnit = p.unitTujuan;
          const activeRoom = p.ruangan;
          const activeBed = p.nomorBed;

          return activeUnit === unitStr && activeRoom === rm && activeBed === b;
        };

        const getShiftRank = (shift: 'PAGI' | 'SIANG' | 'MALAM') => {
          if (shift === 'PAGI') return 1;
          if (shift === 'SIANG') return 2;
          return 3;
        };

        // GLOBAL ACTIVE COUNT - 100% SINKRON DENGAN REGISTRASI ADMIN
        const globalActivePatientsCount = bedPatients.filter(p => {
          const isDischarged = ['BPL', 'APS', 'DIRUJUK', 'MENINGGAL', 'PINDAH RUANGAN', 'BATAL'].some(s => (p.statusDataPasien || '').toUpperCase().includes(s)) || 
                               (p.statusDataPasien || '').toUpperCase().includes('PINDAH') ||
                               p.status === 'DISCHARGED';
          return !isDischarged;
        }).length;

        // Origin/Active Unit for a patient in transition today
        const getActiveUnitOnDate = (p: any, date: string) => {
          const isTransferredToday = (p.statusDataPasien === "Pindah Ruangan" || p.statusDataPasien === "Dipindah ke Ruangan Lain" || p.status === "DISCHARGED") && p.dischargeDate === date;
          return isTransferredToday ? (p.transferUnit || p.unitTujuan) : p.unitTujuan;
        };

        // DAILY ACCUMULATION (TOTAL SEHARI) - FOR SELECTED DATE
        // 1. Total Daily New Patients
        const dailyNewCount = bedPatients.filter(p => p.entryDate === monitoringFilterDate && p.unitTujuan === targetUnit).length;

        // 2. Total Daily Discharged Patients (filtered by original unit)
        const dailyDischargedPatients = bedPatients.filter(p => {
          const isDischargedToday = p.dischargeDate === monitoringFilterDate;
          const originUnit = getActiveUnitOnDate(p, monitoringFilterDate);
          return isDischargedToday && originUnit === targetUnit;
        });
        const dailyDischargedCount = dailyDischargedPatients.length;

        const dailyBPL = dailyDischargedPatients.filter(p => {
          const st = String(p.statusDataPasien || '').toLowerCase();
          return st.includes('bpl') || st.includes('pulang') || st.includes('boleh');
        }).length;

        const dailyAPS = dailyDischargedPatients.filter(p => {
          const st = String(p.statusDataPasien || '').toLowerCase();
          return st.includes('aps') || st.includes('atas permintaan sendiri') || st.includes('paksa');
        }).length;

        const dailyMeninggal = dailyDischargedPatients.filter(p => {
          const st = String(p.statusDataPasien || '').toLowerCase();
          return st.includes('meninggal');
        }).length;

        const dailyRujuk = dailyDischargedPatients.filter(p => {
          const st = String(p.statusDataPasien || '').toLowerCase();
          return st.includes('rujuk') || st.includes('dirujuk');
        }).length;

        const dailyPindah = dailyDischargedPatients.filter(p => {
          const st = String(p.statusDataPasien || '').toLowerCase();
          return st.includes('pindah') || st.includes('ruangan lain') || st.includes('transfer');
        }).length;

        // 3. Total Daily Active
        const dailyActiveCount = bedPatients.filter(p => {
          const isCurrentlyTreated = p.statusDataPasien === "Masih Dirawat" || !p.statusDataPasien || (p.status !== "DISCHARGED" && (p.statusDataPasien === "Pindah Ruangan" || p.statusDataPasien === "Dipindah ke Ruangan Lain"));
          const matchesMasihDirawat = isCurrentlyTreated && !!p.entryDate && p.entryDate <= monitoringFilterDate && (!p.dischargeDate || p.dischargeDate > monitoringFilterDate);
          return matchesMasihDirawat && p.unitTujuan === targetUnit;
        }).length;


        // SHIFT-SPECIFIC COUNTS (PILIHAN SHIFT) - FOR SELECTED DATE & SHIFT
        // 1. New Patients in shift
        const shiftNewCount = bedPatients.filter(p => 
          p.entryDate === monitoringFilterDate && 
          p.unitTujuan === targetUnit && 
          getShiftFromTime(p.entryTime) === monitoringFilterShift
        ).length;

        // 2. Discharged Patients in shift
        const shiftDischargedPatients = dailyDischargedPatients.filter(p => 
          getShiftFromTime(p.dischargeTime || '08:00') === monitoringFilterShift
        );
        const shiftDischargedCount = shiftDischargedPatients.length;

        const shiftBPL = shiftDischargedPatients.filter(p => {
          const st = String(p.statusDataPasien || '').toLowerCase();
          return st.includes('bpl') || st.includes('pulang') || st.includes('boleh');
        }).length;

        const shiftAPS = shiftDischargedPatients.filter(p => {
          const st = String(p.statusDataPasien || '').toLowerCase();
          return st.includes('aps') || st.includes('atas permintaan sendiri') || st.includes('paksa');
        }).length;

        const shiftMeninggal = shiftDischargedPatients.filter(p => {
          const st = String(p.statusDataPasien || '').toLowerCase();
          return st.includes('meninggal');
        }).length;

        const shiftRujuk = shiftDischargedPatients.filter(p => {
          const st = String(p.statusDataPasien || '').toLowerCase();
          return st.includes('rujuk') || st.includes('dirujuk');
        }).length;

        const shiftPindah = shiftDischargedPatients.filter(p => {
          const st = String(p.statusDataPasien || '').toLowerCase();
          return st.includes('pindah') || st.includes('ruangan lain') || st.includes('transfer');
        }).length;

        // 3. Active in shift
        const shiftActiveCount = bedPatients.filter(p => {
          if (!p.entryDate || p.entryDate > monitoringFilterDate) return false;
          if (p.entryDate === monitoringFilterDate && getShiftRank(getShiftFromTime(p.entryTime)) > getShiftRank(monitoringFilterShift)) return false;
          
          if (p.dischargeDate && p.dischargeDate < monitoringFilterDate) return false;
          if (p.dischargeDate && p.dischargeDate === monitoringFilterDate) {
            if (getShiftRank(getShiftFromTime(p.dischargeTime || '08:00')) <= getShiftRank(monitoringFilterShift)) {
              return false;
            }
          }
          
          return p.unitTujuan === targetUnit;
        }).length;

        // 4. Calculate Bed stats per room dynamically
        const targetRoomsStats = (() => {
          const statsList: { roomName: string; className: string; totalBeds: number; occupiedBeds: number; emptyBeds: number; occupancyRate: number }[] = [];
          unitClasses.forEach(cls => {
            const classRooms = safeAppData.masterData.classToRooms[`${targetUnit} - ${cls}`] || [];
            classRooms.forEach(rm => {
              const roomBeds = safeAppData.masterData.roomToBeds[rm] || [];
              const occupiedInRoom = roomBeds.filter(b => (appData.patients || []).some(p => pOccupiesBedOnDate(p, monitoringFilterDate, targetUnit, rm, b))).length;
              const emptyInRoom = roomBeds.length - occupiedInRoom;
              const occupancyRate = roomBeds.length > 0 ? (occupiedInRoom / roomBeds.length) * 100 : 0;
              statsList.push({
                roomName: rm,
                className: cls,
                totalBeds: roomBeds.length,
                occupiedBeds: occupiedInRoom,
                emptyBeds: emptyInRoom,
                occupancyRate
              });
            });
          });
          return statsList;
        })();

        return (
          <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-8 border shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800">Monitoring Bed & Pasien</h3>
                  <p className="text-xs font-bold mt-1 uppercase tracking-widest text-slate-500">Visualisasi ketersediaan ruangan real-time</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border">
                  <span className="text-[10px] font-black text-slate-400 ml-3 uppercase">Pilih Unit:</span>
                  <select 
                    value={bedUnitFilter}
                    onChange={(e) => setBedUnitFilter(e.target.value)}
                    disabled={user?.role !== 'SUPER_ADMIN' && user?.role !== 'BIDANG'}
                    className="bg-white border-0 text-xs font-black text-blue-600 rounded-xl px-4 py-2 focus:ring-0 cursor-pointer outline-none disabled:opacity-50"
                  >
                    {safeAppData.masterData.units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Sensus & Filter Panel (Date & Shift) */}
              <div className="mb-10 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                    <Filter size={14} className="text-[#144272]"/> Sensus Harian Pasien
                  </div>
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tanggal Sensus:</span>
                      <input 
                        type="date" 
                        value={monitoringFilterDate}
                        onChange={(e) => setMonitoringFilterDate(e.target.value)}
                        className="border-2 border-slate-100 rounded-xl px-3 py-1.5 text-xs font-black outline-none focus:border-blue-500 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shift Sensus:</span>
                      <select 
                        value={monitoringFilterShift}
                        onChange={(e) => setMonitoringFilterShift(e.target.value as any)}
                        className="border-2 border-slate-100 rounded-xl px-3 py-1.5 text-xs font-black text-blue-600 outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="PAGI">PAGI (07:00 - 14:00)</option>
                        <option value="SIANG">SIANG (14:00 - 21:00)</option>
                        <option value="MALAM">MALAM (21:00 - 07:00)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Real-time Global Sync Indicator */}
                <div className="flex items-center justify-between px-6 py-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-black uppercase text-indigo-950 tracking-wider">Status Sinkronisasi Data Pasien Aktif</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-500">Pasien Aktif Rawat (Global Se-RS):</span>
                    <span className="px-3.5 py-1 bg-[#144272] text-white rounded-full text-[11px] font-black tracking-wide border border-blue-800 shadow-sm">{globalActivePatientsCount} Pasien</span>
                  </div>
                </div>

                {/* Grid Layout containing Shift Sensus and Accumulation */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  {/* Left Column: Shift-specific Sensus Details */}
                  <div className="xl:col-span-7 bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">Sensus Shift {monitoringFilterShift}</h4>
                      </div>
                      <span className="bg-blue-50 text-blue-700 text-[8.5px] font-black px-2.5 py-1 rounded-md border border-blue-100">FILTER AKTIF ({monitoringFilterShift})</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Shift Pasien Baru */}
                      <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/50 flex flex-col justify-between">
                        <div>
                          <div className="text-[8.5px] font-black text-emerald-600 uppercase tracking-widest">Pasien Baru (Shift)</div>
                          <div className="text-2xl font-black text-emerald-800 mt-1">{shiftNewCount}</div>
                        </div>
                        <span className="text-[8px] text-emerald-500 font-bold block mt-2 uppercase">MASUK SHIFT INI</span>
                      </div>

                      {/* Shift Pasien Dirawat */}
                      <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100 flex flex-col justify-between">
                        <div>
                          <div className="text-[8.5px] font-black text-blue-600 uppercase tracking-widest">Sisa Di Rawat (Shift)</div>
                          <div className="text-2xl font-black text-blue-900 mt-1">{shiftActiveCount}</div>
                        </div>
                        <span className="text-[8px] text-blue-500 font-bold block mt-2 uppercase">UNIT {targetUnit}</span>
                      </div>

                      {/* Shift Pasien Keluar */}
                      <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-100/50 flex flex-col justify-between">
                        <div>
                          <div className="text-[8.5px] font-black text-rose-600 uppercase tracking-widest">Pasien Keluar (Shift)</div>
                          <div className="text-2xl font-black text-rose-800 mt-1">{shiftDischargedCount}</div>
                        </div>
                        <span className="text-[8px] text-rose-500 font-bold block mt-2 uppercase">PULANG/PINDAH/APS</span>
                      </div>
                    </div>

                    {/* Breakdown Pasien Keluar Shift */}
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                      <div className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest mb-2.5">Rincian Pasien Keluar pada Shift {monitoringFilterShift}:</div>
                      <div className="grid grid-cols-5 gap-1.5 text-center">
                        <div className="bg-white p-2 rounded-xl border border-slate-150">
                          <div className="text-[8px] font-black text-slate-400" title="Boleh Pulang / Sembuh">BPL</div>
                          <div className="text-xs font-black text-rose-700 mt-0.5">{shiftBPL}</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-150">
                          <div className="text-[8px] font-black text-slate-400" title="Atas Permintaan Sendiri">APS</div>
                          <div className="text-xs font-black text-rose-700 mt-0.5">{shiftAPS}</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-150">
                          <div className="text-[8px] font-black text-slate-400" title="Meninggal">Mng</div>
                          <div className="text-xs font-black text-rose-700 mt-0.5">{shiftMeninggal}</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-150">
                          <div className="text-[8px] font-black text-slate-400" title="Rujuk">Rjk</div>
                          <div className="text-xs font-black text-rose-700 mt-0.5">{shiftRujuk}</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-150">
                          <div className="text-[8px] font-black text-slate-400" title="Pindah Ruangan">Pndh</div>
                          <div className="text-xs font-black text-rose-700 mt-0.5">{shiftPindah}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Daily Accumulation */}
                  <div className="xl:col-span-5 bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-purple-600 rounded-full"></span>
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">Total Akumulasi Pasien Sehari</h4>
                      </div>
                      <span className="bg-purple-50 text-purple-750 text-[8.5px] font-black px-2.5 py-1 rounded-md border border-purple-100 uppercase">AKUMULASI HARIAN</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {/* Daily Pasien Baru */}
                      <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-500/15 flex flex-col justify-between">
                        <div>
                          <div className="text-[8.5px] font-black text-emerald-700 uppercase tracking-widest">Total Baru (Hari)</div>
                          <div className="text-2xl font-black text-emerald-900 mt-1">{dailyNewCount}</div>
                        </div>
                        <span className="text-[8px] text-emerald-600 font-bold block mt-2 uppercase">SEMUA SHIFT MASUK</span>
                      </div>

                      {/* Daily Pasien Active */}
                      <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-500/15 flex flex-col justify-between">
                        <div>
                          <div className="text-[8.5px] font-black text-blue-700 uppercase tracking-widest">Total Rawat (Hari)</div>
                          <div className="text-2xl font-black text-blue-900 mt-1">{dailyActiveCount}</div>
                        </div>
                        <span className="text-[8px] text-blue-600 font-bold block mt-2 uppercase">UNIT {targetUnit}</span>
                      </div>

                      {/* Daily Pasien Keluar */}
                      <div className="bg-rose-50/30 p-4 rounded-2xl border border-rose-500/15 flex flex-col justify-between">
                        <div>
                          <div className="text-[8.5px] font-black text-rose-700 uppercase tracking-widest">Total Keluar (Hari)</div>
                          <div className="text-2xl font-black text-rose-900 mt-1">{dailyDischargedCount}</div>
                        </div>
                        <span className="text-[8px] text-rose-600 font-bold block mt-2 uppercase">SEMUA KELUAR</span>
                      </div>
                    </div>

                    {/* Breakdown Pasien Keluar Daily */}
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                      <div className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest mb-2.5">Rincian Total Pasien Keluar Sehari (Semua Shift):</div>
                      <div className="grid grid-cols-5 gap-1.5 text-center">
                        <div className="bg-white p-2 rounded-xl border border-slate-150">
                          <div className="text-[8px] font-black text-slate-400" title="Boleh Pulang / Sembuh">BPL</div>
                          <div className="text-xs font-black text-slate-700 mt-0.5">{dailyBPL}</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-150">
                          <div className="text-[8px] font-black text-slate-400" title="Atas Permintaan Sendiri">APS</div>
                          <div className="text-xs font-black text-slate-700 mt-0.5">{dailyAPS}</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-150">
                          <div className="text-[8px] font-black text-slate-400" title="Meninggal">Mng</div>
                          <div className="text-xs font-black text-slate-700 mt-0.5">{dailyMeninggal}</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-150">
                          <div className="text-[8px] font-black text-slate-400" title="Rujuk">Rjk</div>
                          <div className="text-xs font-black text-slate-700 mt-0.5">{dailyRujuk}</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-150">
                          <div className="text-[8px] font-black text-slate-400" title="Pindah Ruangan">Pndh</div>
                          <div className="text-xs font-black text-slate-700 mt-0.5">{dailyPindah}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div> </div>

              {/* Garis Besar Penggunaan Bed Per Ruangan Overview */}
              <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-indigo-650 bg-indigo-600 rounded-full"></span>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Garis Besar Penggunaan Bed Per Ruangan ({targetUnit})</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ikhtisar kapasitas, keterisian, dan sisa kuota kamar</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 text-[8.5px] font-black uppercase">
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">Kosong</span>
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-100">Hampir Penuh</span>
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-md border border-rose-100 animate-pulse">Penuh</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {targetRoomsStats.map((item) => {
                    const isFull = item.emptyBeds === 0;
                    const isAlmostFull = item.occupancyRate >= 75 && !isFull;
                    const statusColor = isFull 
                      ? { bg: 'bg-rose-50/50', border: 'border-rose-100', text: 'text-rose-700 font-bold', bar: 'bg-rose-500', badge: 'bg-rose-100 text-rose-800' }
                      : isAlmostFull
                      ? { bg: 'bg-amber-50/50', border: 'border-amber-100', text: 'text-amber-800 font-bold', bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' }
                      : { bg: 'bg-emerald-50/30', border: 'border-emerald-100/50', text: 'text-emerald-700 font-bold', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' };

                    return (
                      <div key={item.roomName} className={`p-4 rounded-2xl border ${statusColor.bg} ${statusColor.border} flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-xs`}>
                        <div>
                          <div className="flex justify-between items-start mb-2.5">
                            <div>
                              <span className="text-xs font-black text-slate-800 uppercase block tracking-tight">{item.roomName}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{item.className}</span>
                            </div>
                            <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-md ${statusColor.badge}`}>
                              {isFull ? 'FULL' : `${Math.round(item.occupancyRate)}%`}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-1 shadow-xs rounded-xl overflow-hidden text-center my-2.5 border border-slate-100 bg-white">
                            <div className="bg-white/95 p-1.5 border-r border-slate-100">
                              <div className="text-[7.5px] font-black text-slate-400 uppercase">Limit</div>
                              <div className="text-[12px] font-black text-slate-700 mt-0.5">{item.totalBeds}</div>
                            </div>
                            <div className="bg-white/95 p-1.5 border-r border-slate-100">
                              <div className="text-[7.5px] font-black text-slate-400 uppercase">Isi</div>
                              <div className="text-[12px] font-black text-indigo-700 mt-0.5">{item.occupiedBeds}</div>
                            </div>
                            <div className="bg-white/95 p-1.5">
                              <div className="text-[7.5px] font-black text-slate-400 uppercase">Sisa</div>
                              <div className={`text-[12px] font-black mt-0.5 ${item.emptyBeds > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{item.emptyBeds}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-1.5 rounded-full ${statusColor.bar}`} style={{ width: `${item.occupancyRate}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {targetRoomsStats.length === 0 && (
                    <div className="col-span-full text-center py-6 text-slate-400 italic text-xs font-bold">
                      Tidak ada data ruangan untuk unit ini.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-12">
                {unitClasses.map(cls => (
                  <div key={cls} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-slate-100"></div>
                      <h4 className="px-6 py-2 bg-slate-800 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em]">{cls}</h4>
                      <div className="h-px flex-1 bg-slate-100"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {(safeAppData.masterData.classToRooms[`${targetUnit} - ${cls}`] || []).map(rm => {
                        const roomBeds = safeAppData.masterData.roomToBeds[rm] || [];
                        const occupiedInRoom = roomBeds.filter(b => (appData.patients || []).some(p => pOccupiesBedOnDate(p, monitoringFilterDate, targetUnit, rm, b))).length;
                        const emptyInRoom = roomBeds.length - occupiedInRoom;
                        
                        return (
                          <div key={rm} className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                              <h5 className="text-xs font-black text-slate-800 flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl w-fit shadow-sm">
                                <Bed size={14} className="text-[#144272]"/> {rm}
                              </h5>
                              <div className="flex gap-2">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[8px] font-black uppercase">Terisi: {occupiedInRoom}</span>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md text-[8px] font-black uppercase">Kosong: {emptyInRoom}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                            {(safeAppData.masterData.roomToBeds[rm] || []).map(b => {
                              const residents = (appData.patients || []).filter(p => pOccupiesBedOnDate(p, monitoringFilterDate, targetUnit, rm, b));
                              const resident = residents[0];
                              const isDoubleBooked = residents.length > 1;
                              return (
                                <div 
                                  key={b} 
                                  onClick={() => resident && setSelectedDetailPatientId(resident.id)}
                                  className={`p-4 rounded-2xl border transition-all ${
                                    isDoubleBooked 
                                      ? 'bg-red-50/70 border-red-500 shadow-md shadow-red-500/10 cursor-pointer hover:scale-[1.02] hover:border-red-600 animate-pulse' 
                                      : resident 
                                        ? 'bg-white border-blue-200 shadow-md shadow-blue-500/5 cursor-pointer hover:scale-[1.02] hover:border-indigo-400' 
                                        : 'bg-white/40 border-slate-200 border-dashed opacity-60'
                                  }`}
                                  id={`bed-card-${rm}-${b}`}
                                >
                                  <div className="flex justify-between items-start">
                                    {(() => {
                                      const roomBedStyle = getRoomBedStyles(rm);
                                      return (
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                                          isDoubleBooked 
                                            ? 'bg-red-600 text-white border-red-700' 
                                            : resident 
                                              ? `${roomBedStyle.bg} ${roomBedStyle.text} ${roomBedStyle.border}` 
                                              : 'bg-slate-100 text-slate-500 border-slate-250'
                                        }`}>
                                          BED {b}
                                        </span>
                                      );
                                    })()}
                                    {isDoubleBooked ? (
                                      <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-lg bg-red-600 text-white">
                                        DOUBLE BOOKED
                                      </span>
                                    ) : resident ? (
                                      (() => {
                                        const payStyle = getPaymentMethodStyles(resident.paymentMethod?.[0] || 'UMUM');
                                        return (
                                          <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-lg ${payStyle.bg} ${payStyle.text}`}>
                                            {resident.paymentMethod?.[0] || 'UMUM'}
                                          </span>
                                        );
                                      })()
                                    ) : (
                                      <span className="text-[9px] font-bold text-slate-300 uppercase italic">Kosong</span>
                                    )}
                                  </div>
                                  
                                  {isDoubleBooked ? (
                                    <div className="mt-3 space-y-3">
                                      {residents.map((r, rIdx) => (
                                        <div key={r.id} className={`p-2 rounded-lg bg-white border border-red-100 ${rIdx > 0 ? 'mt-2' : ''}`}>
                                          <div className="text-xs font-black text-red-700 uppercase leading-tight">{r.name}</div>
                                          <div className="flex items-center gap-2 text-[9px] text-red-600 font-bold mt-0.5">
                                            <span>RM: {r.noRM}</span>
                                            <span>•</span>
                                            <span className="truncate max-w-[120px]">{r.address}</span>
                                          </div>
                                        </div>
                                      ))}
                                      <div className="px-2.5 py-1 bg-red-600 text-white text-[8.5px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 justify-center">
                                        ⚠️ PERINGATAN: KELOLAAN GANDA
                                      </div>
                                    </div>
                                  ) : resident ? (
                                    <div className="mt-3 space-y-1">
                                      <div className="text-sm font-black text-slate-800 uppercase leading-tight">{resident.name}</div>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                                        <span className="text-blue-600">RM: {resident.noRM}</span>
                                        <span>•</span>
                                        <span className="truncate max-w-[150px]">{resident.address}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-3 flex items-center justify-center py-2 h-[40px]">
                                      <Plus size={16} className="text-slate-200"/>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        );
      }

      case 'service-schedule': {
        const calculateAgeObj = (birthDateStr?: string) => {
          if (!birthDateStr) return '';
          const birthDate = new Date(birthDateStr);
          if (isNaN(birthDate.getTime())) return '';
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          return `${age} tahun`;
        };

        const getBedBadgeStyle = (bedNameStr: string, roomNameStr?: string) => {
          const roomToUse = roomNameStr || bedNameStr;
          const style = getRoomBedStyles(roomToUse);
          return `${style.bg} ${style.text} ${style.border} border px-2.5 py-1 rounded-[10px] text-[10px] font-black shadow-xs block text-center`;
        };

        const getJaminanStyle = (insStr: string) => {
          const style = getPaymentMethodStyles(insStr);
          return `${style.bg} ${style.text} px-2.5 py-1 rounded-[10px] text-[10.5px] uppercase font-black`;
        };

        // Assemble all surgery schedules
        const allSchedules = (appData.patients || []).flatMap(p => {
          // Find all daily reports for this patient that have a surgeryDate from the deduplicated list
          const reports = uniqueSurgeryReports.filter(r => r.patientId === p.id);
          if (reports.length === 0) return [];
          
          const entries: any[] = [];
          reports.forEach(r => {
            // Original Entry
            entries.push({
              id: p.id,
              patientName: p.name,
              noRM: p.noRM,
              gender: p.gender === 'L' ? 'Laki-Laki' : p.gender === 'P' ? 'Perempuan' : '-',
              age: calculateAgeObj(p.birthDate),
              address: p.address || '-',
              insurance: Array.isArray(p.paymentMethod) ? p.paymentMethod.join(', ') : (p.paymentMethod || '-'),
              diagnosis: p.diagnosaUtama || r.diagnosis || '-',
              unitTujuan: p.unitTujuan || 'Rawat Jalan/IGD',
              ruangan: p.ruangan || '-',
              nomorBed: p.nomorBed || '-',
              procedure: r.surgeryProcedure || p.tindakanProsedur || 'Proses Pembedahan',
              operator: r.surgeryOperator || p.dpjpList?.[0] || 'dr. Bedah, Sp.B',
              date: r.surgeryDate, // e.g. YYYY-MM-DD
              time: r.surgeryTime || '08:00',
              status: r.surgeryStatus || 'SCHEDULED',
              report: r
            });

            // Rescheduled/Delayed New Date Entry (duplicate/move visibility on new date)
            const isTundaOrRescheduled = 
              r.surgeryStatus === 'DELAYED' || 
              r.surgeryStatus === 'RESCHEDULED' || 
              r.surgeryStatus === 'TERTUNDA' || 
              r.surgeryStatus === 'TUNDA';

            if (isTundaOrRescheduled && r.surgeryNewDate && r.surgeryNewDate !== r.surgeryDate) {
              entries.push({
                id: p.id,
                patientName: p.name,
                noRM: p.noRM,
                gender: p.gender === 'L' ? 'Laki-Laki' : p.gender === 'P' ? 'Perempuan' : '-',
                age: calculateAgeObj(p.birthDate),
                address: p.address || '-',
                insurance: Array.isArray(p.paymentMethod) ? p.paymentMethod.join(', ') : (p.paymentMethod || '-'),
                diagnosis: p.diagnosaUtama || r.diagnosis || '-',
                unitTujuan: p.unitTujuan || 'Rawat Jalan/IGD',
                ruangan: p.ruangan || '-',
                nomorBed: p.nomorBed || '-',
                procedure: r.surgeryProcedure || p.tindakanProsedur || 'Proses Pembedahan',
                operator: r.surgeryOperator || p.dpjpList?.[0] || 'dr. Bedah, Sp.B',
                date: r.surgeryNewDate, // Appears on the NEW rescheduled date!
                time: r.surgeryNewTime || r.surgeryTime || '08:00',
                status: 'RESCHEDULED_ACTIVE',
                originalDate: r.surgeryDate,
                report: r
              });
            }
          });
          return entries;
        });

        // Filter Units and DPJP dynamically for dropdown selection options
        const uniqueUnitsList = Array.from(new Set([
          ...(appData.masterData?.units || []),
          ...(appData.patients || []).map(p => p.unitTujuan)
        ])).filter(Boolean).sort();

        const rawDoctorStrings = [
          ...(appData.masterData?.doctors || []),
          ...(appData.patients || []).flatMap(p => p.dpjpList || []),
          ...(appData.dailyReports || []).map(r => r.surgeryOperator)
        ].filter(Boolean);

        // Split by comma, semicolon, '&', or ' dan ' to get clean individual doctor names
        const parsedDoctors = rawDoctorStrings.flatMap(docStr => {
          if (typeof docStr !== 'string') return [];
          return docStr
            .split(/[,;&]|\s+dan\s+/gi)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        });

        const uniqueDpjpList = Array.from(new Set(parsedDoctors)).sort();

        // Prepare options for searchable select
        const unitOptions = [
          { label: "Semua Unit", value: "" },
          ...uniqueUnitsList.map(unit => ({ label: unit, value: unit }))
        ];

        const dpjpOptions = [
          { label: "Semua DPJP", value: "" },
          ...uniqueDpjpList.map(doc => ({ label: doc, value: doc }))
        ];

        // Apply filters
        const filteredSchedulesList = allSchedules.filter(s => {
          const matchesDate = !scheduleFilterDate || s.date === scheduleFilterDate;
          const matchesUnit = !scheduleFilterRoom || s.unitTujuan === scheduleFilterRoom;
          
          // Partial/Substring match for DPJP to support multi-DPJP/multi-operator scenarios
          const matchesDpjp = !scheduleFilterDpjp || (s.operator || '').toLowerCase().includes(scheduleFilterDpjp.toLowerCase());
          
          // Real-time Global Search query: Patient Name, RM, Address, Diagnosis, and Procedure
          let matchesSearch = true;
          if (scheduleGlobalSearch) {
            const query = scheduleGlobalSearch.toLowerCase().trim();
            const nameMatch = (s.patientName || '').toLowerCase().includes(query);
            const rmMatch = (s.noRM || '').toLowerCase().includes(query);
            const addrMatch = (s.address || '').toLowerCase().includes(query);
            const diagMatch = (s.diagnosis || '').toLowerCase().includes(query);
            const procMatch = (s.procedure || '').toLowerCase().includes(query);
            matchesSearch = nameMatch || rmMatch || addrMatch || diagMatch || procMatch;
          }

          return matchesDate && matchesUnit && matchesDpjp && matchesSearch;
        });

        // Sort automatically: by date, then alphabetically and numerically by Room (ruangan), then by Bed (nomorBed)
        filteredSchedulesList.sort((a, b) => {
          // 1. Sort by date first
          const dateDiff = (a.date || '').localeCompare(b.date || '');
          if (dateDiff !== 0) return dateDiff;

          // 2. Sort by Room (ruangan) - place empty/dash at the end
          const rA = a.ruangan && a.ruangan !== '-' ? a.ruangan : 'ZZZZZZZZ';
          const rB = b.ruangan && b.ruangan !== '-' ? b.ruangan : 'ZZZZZZZZ';
          const roomDiff = rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
          if (roomDiff !== 0) return roomDiff;

          // 3. Sort by Bed (nomorBed) - place empty/dash at the end
          const bA = a.nomorBed && a.nomorBed !== '-' ? a.nomorBed : 'ZZZZZZZZ';
          const bB = b.nomorBed && b.nomorBed !== '-' ? b.nomorBed : 'ZZZZZZZZ';
          return bA.localeCompare(bB, undefined, { numeric: true, sensitivity: 'base' });
        });

        return (
          <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-8 border shadow-sm animate-fade-in">
            <h3 className="text-xl font-black tracking-tight mb-8 flex items-center gap-3" style={{ color: appData.masterData.settings?.fontColor || '#1e293b' }}>
              <Calendar className="text-blue-600"/> Jadwal Operasi (Real-time)
            </h3>

            {/* Filters Panel */}
            <div className="mb-8 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col gap-6">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                <Filter size={14} className="text-blue-500"/> Filter Jadwal Operasi
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 1. Date Filter */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Tindakan</label>
                  <div className="flex gap-2">
                    <input 
                      type="date" 
                      value={scheduleFilterDate}
                      onChange={(e) => setScheduleFilterDate(e.target.value)}
                      className="flex-1 border-2 border-slate-100 rounded-2xl px-4 py-2 text-xs font-black uppercase outline-none focus:border-blue-500 bg-white"
                    />
                    {scheduleFilterDate && (
                      <button 
                        onClick={() => setScheduleFilterDate('')}
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-black uppercase transition-all"
                        title="Tampilkan Semua Tanggal"
                      >
                        Semua
                      </button>
                    )}
                    {scheduleFilterDate !== today && (
                      <button 
                        onClick={() => setScheduleFilterDate(today)}
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl text-[10px] font-black uppercase transition-all"
                        title="Set Hari Ini"
                      >
                        Hari Ini
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Room Filter with SearchableSelect */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Perawatan</label>
                  <SearchableSelect 
                    options={unitOptions}
                    value={scheduleFilterRoom}
                    onChange={(val) => setScheduleFilterRoom(val)}
                    placeholder="Pilih Unit..."
                  />
                </div>

                {/* 3. DPJP Filter with SearchableSelect */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DPJP Bedah</label>
                  <SearchableSelect 
                    options={dpjpOptions}
                    value={scheduleFilterDpjp}
                    onChange={(val) => setScheduleFilterDpjp(val)}
                    placeholder="Pilih DPJP..."
                  />
                </div>

                {/* 4. Global Search */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pencarian Pintar</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text"
                      value={scheduleGlobalSearch}
                      onChange={(e) => setScheduleGlobalSearch(e.target.value)}
                      placeholder="Cari Nama, No RM, Alamat, Diagnosa..."
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-550 outline-none shadow-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Reset Control */}
              {(scheduleFilterDate || scheduleFilterRoom || scheduleFilterDpjp || scheduleGlobalSearch) && (
                <div className="flex justify-end">
                  <button 
                    onClick={() => {
                      setScheduleFilterDate('');
                      setScheduleFilterRoom('');
                      setScheduleFilterDpjp('');
                      setScheduleGlobalSearch('');
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-[#ef4444] hover:text-red-700 transition"
                  >
                    × Reset Semua Filter & Pencarian
                  </button>
                </div>
              )}
            </div>

            {/* List results in a beautiful, structured Spreadsheet columns style */}
            <div className="overflow-x-auto rounded-[1.5rem] border border-slate-100 bg-white shadow-inner">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#f8fafc] text-slate-500 font-black uppercase tracking-wider border-b border-slate-150">
                  <tr className="divide-x divide-slate-100">
                    <th className="p-4 font-black whitespace-nowrap bg-yellow-400 text-slate-900 border-b-2 border-slate-200">Nama Ruangan & No Bed</th>
                    <th className="p-4 font-black whitespace-nowrap bg-yellow-400 text-slate-900 border-b-2 border-slate-200">Identitas (Nama/Umur/No RM/JK)</th>
                    <th className="p-4 font-black whitespace-nowrap bg-yellow-400 text-slate-900 border-b-2 border-slate-200">Jaminan & Alamat</th>
                    <th className="p-4 font-black whitespace-nowrap bg-yellow-400 text-slate-900 border-b-2 border-slate-200">Diagnosa</th>
                    <th className="p-4 font-black whitespace-nowrap bg-yellow-400 text-slate-900 border-b-2 border-slate-200">Nama Tindakan</th>
                    <th className="p-4 font-black whitespace-nowrap bg-yellow-400 text-slate-900 border-b-2 border-slate-200">Nama Operator</th>
                    <th className="p-4 font-black whitespace-nowrap bg-yellow-400 text-slate-900 border-b-2 border-slate-200">Tanggal Rencana Operasi</th>
                    <th className="p-4 font-black whitespace-nowrap bg-yellow-400 text-slate-900 border-b-2 border-slate-200 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchedulesList.length > 0 ? filteredSchedulesList.map((o, idx) => {
                    let statusColor = 'bg-blue-50 text-blue-700 border border-blue-100';
                    if (o.status === 'PERFORMED' || o.status === 'SURGERY_DONE') {
                      statusColor = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                    } else if (o.status === 'DELAYED') {
                      statusColor = 'bg-amber-50 text-amber-700 border border-amber-100';
                    } else if (o.status === 'CANCELLED') {
                      statusColor = 'bg-rose-50 text-rose-700 border border-rose-100';
                    } else if (o.status === 'RESCHEDULED_ACTIVE') {
                      statusColor = 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-bold animate-pulse';
                    }
 
                    return (
                      <tr key={`${o.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors duration-200 divide-x divide-slate-100">
                        {/* 1. Nama Ruangan dan Nomor Bed */}
                        <td className="p-4 bg-slate-50/25 whitespace-nowrap">
                          <div className="font-extrabold text-slate-800 text-xs uppercase tracking-tight">{o.ruangan || '-'}</div>
                          {o.nomorBed && o.nomorBed !== '-' ? (
                            <div className="mt-1.5 inline-block">
                              <span className={getBedBadgeStyle(o.nomorBed, o.ruangan)}>
                                BED {o.nomorBed}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 font-bold italic mt-0.5">Bed -</div>
                          )}
                        </td>
                        
                        {/* 2. Identitas (Nama/Umur/No RM/JK) */}
                        <td className="p-4">
                           <div className="font-black text-slate-900 text-sm uppercase tracking-tight">{o.patientName}</div>
                           <div className="text-[10px] font-bold text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                             <span className="bg-slate-100 text-slate-700 font-black px-1.5 py-0.5 rounded">RM: {o.noRM}</span>
                             {o.age && <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded font-black border border-slate-150">{o.age}</span>}
                             {o.gender === 'Laki-Laki' ? (
                               <span className="bg-blue-50 text-blue-700 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase border border-blue-100">L</span>
                             ) : o.gender === 'Perempuan' ? (
                               <span className="bg-pink-50 text-pink-700 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase border border-pink-100">P</span>
                             ) : null}
                           </div>
                        </td>
                        
                        {/* 3. Jaminan & Alamat */}
                        <td className="p-4 max-w-[180px]">
                          <div className="mb-1.5">
                            <span className={getJaminanStyle(o.insurance)}>
                              {o.insurance}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold leading-normal truncate" title={o.address}>
                            {o.address}
                          </div>
                        </td>
                        
                        {/* 4. Diagnosa */}
                        <td className="p-4 max-w-[200px]" title={o.diagnosis}>
                          <div className="text-slate-600 font-bold text-xs max-h-12 overflow-hidden leading-normal line-clamp-2">
                            {o.diagnosis}
                          </div>
                        </td>
                        
                        {/* 5. Nama Tindakan */}
                        <td className="p-4 max-w-[200px]" title={o.procedure}>
                          <div className="text-slate-800 font-black text-xs max-h-12 overflow-hidden leading-normal line-clamp-2">
                            {o.procedure}
                          </div>
                        </td>
                        
                        {/* 6. Nama Operator */}
                        <td className="p-4">
                          <div className="bg-purple-50 border border-purple-100 text-purple-750 font-black px-3 py-1.5 rounded-xl text-[10px] tracking-tight inline-block uppercase whitespace-normal max-w-[140px] leading-snug">
                            {o.operator}
                          </div>
                        </td>
                        
                        {/* 7. Tanggal Rencana Operasi */}
                        <td className="p-4 whitespace-nowrap">
                          <div className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                            <Calendar size={13} className="text-blue-500 shrink-0"/> {o.date}
                          </div>
                          <div className="font-semibold text-slate-400 text-[10px] flex items-center gap-1 mt-1 font-mono">
                            <Clock size={11} className="text-slate-300"/> {o.time} WIB
                          </div>
                          <div className="mt-2 text-left">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider inline-block ${statusColor}`}>
                              {o.status === 'RESCHEDULED_ACTIVE' ? 'RESCHEDULED' : o.status}
                            </span>
                          </div>
                          {o.status === 'RESCHEDULED_ACTIVE' && o.originalDate && (
                            <div className="mt-1 text-[9px] text-indigo-600 font-extrabold uppercase">
                              🔄 Tunda Dari: {o.originalDate}
                            </div>
                          )}
                        </td>

                        {/* 8. Aksi (Edit & Hapus) */}
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingScheduleSurgery(o)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-[9px] font-black uppercase tracking-wider border border-blue-105 cursor-pointer flex items-center gap-1 transition-all"
                            >
                              <Edit size={10} /> Edit Jadwal
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("Apakah Anda yakin ingin menghapus jadwal operasi ini?")) {
                                  handleUpdateDailyReport(
                                    o.id,
                                    "BATCH",
                                    {
                                      surgeryProcedure: "",
                                      surgeryOperator: "",
                                      surgeryDate: "",
                                      surgeryTime: "",
                                      surgeryAnesthesiaType: "",
                                      surgeryUrgency: "ELECTIVE",
                                      surgeryStatus: "SCHEDULED",
                                      surgeryDelayReason: "",
                                      surgeryNewDate: "",
                                      surgeryNewTime: ""
                                    },
                                    o.report?.date || o.date
                                  );
                                  notify('JADWAL OPERASI BERHASIL DIHAPUS');
                                }
                              }}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[9px] font-black uppercase tracking-wider border border-rose-105 cursor-pointer flex items-center gap-1 transition-all"
                            >
                              <Trash2 size={10} /> Hapus Jadwal
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={8} className="py-24 text-center text-slate-400 font-bold italic bg-slate-50/10">
                        Tidak ada jadwal operasi yang cocok dengan filter aktif.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Edit Schedule Surgery Modal */}
            {editingScheduleSurgery && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] p-10 w-full max-w-lg shadow-2xl animate-fade-in border-t-8 border-indigo-650 max-h-[90vh] overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <Edit className="text-indigo-600" size={18} /> Edit Rencana & Jadwal Bedah
                    </h4>
                    <button 
                      onClick={() => setEditingScheduleSurgery(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition duration-150"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nama Pasien</label>
                      <input 
                        type="text" 
                        disabled 
                        className="w-full bg-slate-50 text-slate-500 font-bold px-4 py-2.5 rounded-xl text-xs" 
                        value={`${editingScheduleSurgery.patientName} (${editingScheduleSurgery.noRM})`} 
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tanggal Rencana</label>
                        <input 
                          type="date" 
                          className="w-full bg-slate-50 border border-slate-100 font-bold px-4 py-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-100 outline-none" 
                          value={editingScheduleSurgery.date} 
                          onChange={e => setEditingScheduleSurgery({ ...editingScheduleSurgery, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Jam Rencana</label>
                        <input 
                          type="time" 
                          className="w-full bg-slate-50 border border-slate-100 font-bold px-4 py-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-100 outline-none" 
                          value={editingScheduleSurgery.time} 
                          onChange={e => setEditingScheduleSurgery({ ...editingScheduleSurgery, time: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nama Tindakan Operasi</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-100 font-extrabold px-4 py-2.5 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none" 
                        value={editingScheduleSurgery.procedure} 
                        onChange={e => setEditingScheduleSurgery({ ...editingScheduleSurgery, procedure: e.target.value })}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Dokter Operator (DPJP)</label>
                      <select 
                        className="w-full bg-slate-55 bg-slate-50 border border-slate-100 font-extrabold px-4 py-2.5 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none" 
                        value={editingScheduleSurgery.operator} 
                        onChange={e => setEditingScheduleSurgery({ ...editingScheduleSurgery, operator: e.target.value })}
                      >
                        <option value="">-- Pilih DPJP --</option>
                        {appData.masterData?.doctors?.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Urgensi Operasi</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-100 font-black px-4 py-2.5 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none"
                          value={editingScheduleSurgery.report?.surgeryUrgency || 'ELECTIVE'}
                          onChange={e => setEditingScheduleSurgery({
                            ...editingScheduleSurgery,
                            report: { ...editingScheduleSurgery.report, surgeryUrgency: e.target.value }
                          })}
                        >
                          <option value="ELECTIVE">ELEKTIF</option>
                          <option value="EMERGENCY">CYTO / EMERGENCY</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Status Operasi</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-100 font-black px-4 py-2.5 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none"
                          value={editingScheduleSurgery.status}
                          onChange={e => setEditingScheduleSurgery({ ...editingScheduleSurgery, status: e.target.value })}
                        >
                          <option value="SCHEDULED">SCHEDULED (DIJADWALKAN)</option>
                          <option value="PERFORMED">PERFORMED (DILAKSANAKAN)</option>
                          <option value="DELAYED">DELAYED (TERTUNDA)</option>
                          <option value="CANCELLED">CANCELLED (BATAL)</option>
                        </select>
                      </div>
                    </div>
                    
                    {(editingScheduleSurgery.status === 'DELAYED' || editingScheduleSurgery.status === 'CANCELLED') && (
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-3">
                        <div>
                          <label className="block text-[9px] font-black text-amber-800 uppercase tracking-wider mb-1.5">
                            {editingScheduleSurgery.status === 'CANCELLED' ? 'Alasan Pembatalan' : 'Alasan Penundaan'}
                          </label>
                          <textarea 
                            className="w-full bg-white border border-amber-200 font-medium p-3 rounded-xl text-xs focus:ring-2 focus:ring-amber-200 outline-none" 
                            rows={2}
                            placeholder={editingScheduleSurgery.status === 'CANCELLED' ? 'Tuliskan alasan pembatalan medis/non-medis...' : 'Tuliskan alasan penundaan medis/non-medis...'}
                            value={editingScheduleSurgery.report?.surgeryDelayReason || ''}
                            onChange={e => setEditingScheduleSurgery({
                              ...editingScheduleSurgery,
                              report: { ...editingScheduleSurgery.report, surgeryDelayReason: e.target.value }
                            })}
                          />
                        </div>
                        {editingScheduleSurgery.status !== 'CANCELLED' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-black text-amber-800 uppercase tracking-wider mb-1.5">Tanggal Reschedule Baru</label>
                              <input 
                                type="date" 
                                className="w-full bg-white border border-amber-200 font-bold px-3 py-2 rounded-lg text-xs outline-none" 
                                value={editingScheduleSurgery.report?.surgeryNewDate || ''}
                                onChange={e => setEditingScheduleSurgery({
                                  ...editingScheduleSurgery,
                                  report: { ...editingScheduleSurgery.report, surgeryNewDate: e.target.value }
                                })}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-amber-800 uppercase tracking-wider mb-1.5">Jam Reschedule Baru</label>
                              <input 
                                type="time" 
                                className="w-full bg-white border border-amber-200 font-bold px-3 py-2 rounded-lg text-xs outline-none" 
                                value={editingScheduleSurgery.report?.surgeryNewTime || ''}
                                onChange={e => setEditingScheduleSurgery({
                                  ...editingScheduleSurgery,
                                  report: { ...editingScheduleSurgery.report, surgeryNewTime: e.target.value }
                                })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                    <button 
                      type="button"
                      onClick={() => setEditingScheduleSurgery(null)}
                      className="px-6 py-2.5 bg-slate-50 border hover:bg-slate-100 rounded-xl text-xs font-black uppercase text-slate-500"
                    >
                      Batal
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const s = editingScheduleSurgery;
                        const actualStatus = s.status === 'RESCHEDULED_ACTIVE' ? 'DELAYED' : s.status;
                        handleUpdateDailyReport(
                          s.id,
                          'BATCH',
                          {
                            surgeryProcedure: s.procedure,
                            surgeryOperator: s.operator,
                            surgeryDate: s.date,
                            surgeryTime: s.time,
                            surgeryUrgency: s.report?.surgeryUrgency || 'ELECTIVE',
                            surgeryStatus: actualStatus,
                            surgeryDelayReason: (actualStatus === 'DELAYED' || actualStatus === 'CANCELLED') ? (s.report?.surgeryDelayReason || '') : '',
                            surgeryNewDate: actualStatus === 'DELAYED' ? (s.report?.surgeryNewDate || '') : '',
                            surgeryNewTime: actualStatus === 'DELAYED' ? (s.report?.surgeryNewTime || '') : '',
                            surgeryAnesthesiaType: s.report?.surgeryAnesthesiaType || ''
                          },
                          s.report?.date || s.date
                        );
                        setEditingScheduleSurgery(null);
                        notify('JADWAL OPERASI BERHASIL DIPERBARUI');
                      }}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-150"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'service-schedule-old':
        return (
          <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-8 border shadow-sm animate-fade-in">
            <h3 className="text-xl font-black tracking-tight mb-8 flex items-center gap-3" style={{ color: appData.masterData.settings?.fontColor || '#1e293b' }}>
              <Calendar className="text-blue-600"/> Jadwal Operasi (Real-time)
            </h3>
            <div className="space-y-4">
               {surgeriesTodayList.length > 0 ? surgeriesTodayList.map((o, idx) => (
                 <div key={`${o.id}-${idx}`} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white rounded-2xl border flex flex-col items-center justify-center">
                         <div className="text-lg font-black text-slate-800">{o.time}</div>
                         <div className="text-[8px] font-black text-slate-400">WIB</div>
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800 uppercase truncate max-w-[200px]">{o.patient}</div>
                        <div className="text-xs font-medium text-slate-500 truncate max-w-[250px]">{o.op}</div>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs font-black text-blue-600 uppercase tracking-tight">{o.doc}</div>
                       <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-black uppercase mt-1 inline-block">Scheduled</span>
                    </div>
                 </div>
               )) : (
                 <div className="py-20 text-center text-slate-400 font-bold italic border-2 border-dashed rounded-3xl">
                    Belum ada jadwal operasi untuk hari ini.
                 </div>
               )}
            </div>
          </div>
        );

      case 'service-report':
        return (
          <OperationReportModule 
            reports={appData.operationReports || []}
            patients={appData.patients || []}
            onSaveReport={handleAddOperationReport}
            onUpdateReport={handleUpdateOperationReport}
            onDeleteReport={handleDeleteOperationReport}
            currentUser={user}
            masterData={safeAppData.masterData}
          />
        );

      case 'finance-summary':
        return (
          <FinanceSummaryView 
            financeRecords={appData.financeRecords || []}
            patients={appData.patients || []}
            masterData={appData.masterData}
          />
        );

      case 'incident-investigation':
        const rawIncidents = appData.incidentReports || [];
        const allIncidents = rawIncidents.filter(r => {
          if (!user) return false;
          if (user.role === 'SUPER_ADMIN' || user.role === 'BIDANG') return true;
          return r.responsibleUnit === user.unit;
        });
        const newIncidents = allIncidents.filter(r => r.status === 'NEW' || !r.status);
        const activeInvestigations = allIncidents.filter(r => r.status === 'INVESTIGATING');
        const resolvedIncidents = allIncidents.filter(r => r.status === 'RESOLVED');

        return (
          <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  <Search className="text-blue-600"/> Dashboard Investigasi
                </h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Status & Manajemen Analisis Keselamatan Pasien</p>
              </div>
              <Button 
                onClick={() => setActiveMenu('incident-report')} 
                className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-slate-900 text-white shadow-xl"
              >
                <Plus size={18} className="mr-2"/> Input Laporan Insiden Baru
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Belum Diinvestigasi', val: newIncidents.length, color: 'blue', icon: <FileText/> },
                { label: 'Proses Investigasi', val: activeInvestigations.length, color: 'amber', icon: <Search/> },
                { label: 'Selesai Investigasi', val: resolvedIncidents.length, color: 'emerald', icon: <CheckCircle2/> }
              ].map((stat, idx) => (
                <div key={`incident-stat-${stat.label}-${idx}`} className="bg-white/70 backdrop-blur-md p-6 rounded-[2rem] border shadow-sm flex items-center gap-6">
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-600`}>
                      {React.cloneElement(stat.icon as React.ReactElement, { size: 28 })}
                   </div>
                   <div>
                      <div className="text-3xl font-black tracking-tighter" style={{ color: appData.masterData.settings?.fontColor || '#1e293b' }}>{stat.val}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: appData.masterData.settings?.fontColor || '#64748b' }}>{stat.label}</div>
                   </div>
                </div>
              ))}
            </div>

            <div className="space-y-12">
              {/* Section 1: Belum Diinvestigasi */}
              <section className="space-y-6">
                 <div className="flex items-center gap-4">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap opacity-60" style={{ color: appData.masterData.settings?.fontColor || '#94a3b8' }}>I. Menunggu Investigasi ({newIncidents.length})</h4>
                    <div className="h-px w-full bg-slate-100/20"></div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {newIncidents.length > 0 ? newIncidents.map(r => (
                      <div key={r.id} className="bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-slate-200/50 shadow-sm relative group overflow-hidden">
                         <div className="absolute top-0 right-0 p-4">
                            <span className={`px-2 py-1 rounded text-[8px] font-black uppercase text-white`} style={{ backgroundColor: r.severity === 'RED' ? '#ef4444' : r.severity === 'YELLOW' ? '#f59e0b' : r.severity === 'GREEN' ? '#10b981' : '#3b82f6' }}>
                               {r.severity}
                            </span>
                         </div>
                         <div className="text-[10px] font-bold text-slate-400 mb-2">{r.date}</div>
                         <h5 className="text-sm font-black text-slate-800 uppercase leading-snug mb-2 line-clamp-2">{r.incidentName}</h5>
                         <p className="text-[10px] text-slate-500 font-medium line-clamp-2 mb-4">{r.chronology}</p>
                         <Button 
                           variant="secondary" 
                           onClick={() => setActiveMenu('incident-report')}
                           className="w-full text-[9px] font-black uppercase"
                         >
                           Mulai Investigasi <ArrowRight size={12} className="ml-2"/>
                         </Button>
                      </div>
                    )) : (
                      <div className="col-span-full py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 text-slate-400 font-bold italic text-sm">
                        Semua laporan sudah diproses.
                      </div>
                    )}
                 </div>
              </section>

              {/* Section 2: Sedang Diinvestigasi */}
              <section className="space-y-6">
                 <div className="flex items-center gap-4">
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-[0.2em] whitespace-nowrap">II. Dalam Proses Investigasi/RCA ({activeInvestigations.length})</h4>
                    <div className="h-px w-full bg-slate-100"></div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeInvestigations.length > 0 ? activeInvestigations.map(r => (
                      <div key={r.id} className="bg-amber-50/30 p-6 rounded-3xl border border-amber-100 shadow-sm relative group overflow-hidden">
                         <div className="absolute top-0 right-0 p-4">
                           <Clock className="text-amber-500 animate-pulse" size={16}/>
                         </div>
                         <div className="text-[10px] font-bold text-amber-600 mb-2">{r.date}</div>
                         <h5 className="text-sm font-black text-slate-800 uppercase leading-snug mb-2 line-clamp-2">{r.incidentName}</h5>
                         <div className="flex items-center gap-2 mb-4">
                            <div className="text-[9px] font-black text-slate-400 uppercase">Unit:</div>
                            <div className="text-[9px] font-black text-amber-700">{r.responsibleUnit}</div>
                         </div>
                         <Button 
                           onClick={() => setActiveMenu('incident-report')}
                           className="w-full text-[9px] font-black uppercase bg-amber-600 text-white"
                         >
                           Lanjutkan RCA <ArrowRight size={12} className="ml-2"/>
                         </Button>
                      </div>
                    )) : (
                      <div className="col-span-full py-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 text-slate-400 font-bold italic text-sm">
                        Tidak ada investigasi yang sedang berjalan.
                      </div>
                    )}
                 </div>
              </section>

              {/* Section 3: Selesai Investigasi */}
              <section className="space-y-6">
                 <div className="flex items-center gap-4">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap opacity-60" style={{ color: appData.masterData.settings?.fontColor || '#10b981' }}>III. Selesai Investigasi ({resolvedIncidents.length})</h4>
                    <div className="h-px w-full bg-slate-100/20"></div>
                 </div>
                 <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] border shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                       <thead className="bg-slate-50/50">
                          <tr>
                             <th className="px-8 py-4 text-[9px] font-black uppercase opacity-40" style={{ color: appData.masterData.settings?.fontColor || '#64748b' }}>Waktu</th>
                             <th className="px-8 py-4 text-[9px] font-black uppercase opacity-40" style={{ color: appData.masterData.settings?.fontColor || '#64748b' }}>Nama Insiden</th>
                             <th className="px-8 py-4 text-[9px] font-black uppercase opacity-40 text-center" style={{ color: appData.masterData.settings?.fontColor || '#64748b' }}>Grading</th>
                             <th className="px-8 py-4 text-[9px] font-black uppercase opacity-40 text-right" style={{ color: appData.masterData.settings?.fontColor || '#64748b' }}>Aksi</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y">
                          {resolvedIncidents.length > 0 ? resolvedIncidents.slice(-5).map((r, idx) => (
                            <tr key={`${r.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                               <td className="px-8 py-4 text-xs font-bold text-slate-500">{r.date}</td>
                               <td className="px-8 py-4">
                                  <div className="text-xs font-black text-slate-800 uppercase">{r.incidentName}</div>
                                  <div className="text-[9px] text-slate-400">{r.responsibleUnit}</div>
                               </td>
                               <td className="px-8 py-4 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black text-white`} style={{ backgroundColor: r.severity === 'RED' ? '#ef4444' : r.severity === 'YELLOW' ? '#f59e0b' : r.severity === 'GREEN' ? '#10b981' : '#3b82f6' }}>
                                     {r.severity}
                                  </span>
                               </td>
                               <td className="px-8 py-4 text-right">
                                  <Button 
                                    variant="secondary" 
                                    onClick={() => setActiveMenu('incident-report')}
                                    className="text-[9px] font-black uppercase h-8 px-4"
                                  >
                                    Detail
                                  </Button>
                               </td>
                            </tr>
                          )) : (
                            <tr>
                               <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-bold italic text-xs">Belum ada investigasi yang selesai.</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </section>
            </div>
          </div>
        );

      case 'incident-monthly':
        return <IncidentMonthlyReport reports={appData.incidentReports || []} />;

      case 'service-nursing':
        return (
          <ServiceMatrix 
            patients={appData.patients || []}
            dailyReports={appData.dailyReports || []}
            patientLocks={patientLocks}
            masterData={safeAppData.masterData}
            onAddPatient={() => setIsPatientModalOpen(true)}
            onUpdateReport={handleUpdateDailyReport}
            onUpdateDependency={handleUpdateDependency}
            onUpdatePatient={handleUpdatePatient}
            onAddDoctorVisit={handleAddDoctorVisit}
            onUpdateDoctorVisit={handleUpdateDoctorVisit}
            onRemoveDoctorVisit={handleDeleteDoctorVisit}
            appData={appData}
            currentUser={user}
            onPatientClick={(id) => setSelectedDetailPatientId(id)}
            syncStatus={syncStatus}
          />
        );

      case 'finance-reg-admin':
        return (
          <AdminRegistrasiModule 
            patients={appData.patients || []}
            masterData={safeAppData.masterData}
            currentUser={user}
            onUpdatePatient={handleUpdatePatient}
            onAddPatient={handleAddPatient}
            onDeletePatient={handleDeletePatient}
            onCreateEmptyPatient={handleCreateEmptyPatient}
            onNavigate={setActiveMenu}
          />
        );

      case 'finance-visite':
        return (
          <DoctorVisitAdmin 
            financeRecords={appData.financeRecords || []}
            patients={appData.patients || []}
            masterData={safeAppData.masterData}
            currentUser={user}
          />
        );

      case 'quality-kpi':
        return (
          <QualityWorksheet 
            indicators={safeAppData.masterData.qualityIndicators || []}
            measurements={appData.qualityMeasurements || []}
            onSaveMeasurement={handleSaveQualityMeasurement}
            currentUser={user}
            masterData={safeAppData.masterData}
            patients={appData.patients || []}
            dailyReports={appData.dailyReports || []}
            selectedDate={qualityFilterDate}
            setSelectedDate={setQualityFilterDate}
            onUpdateMasterData={handleUpdateMasterData}
          />
        );

      case 'quality-print':
        return (
          <PrintQualityWorksheet
            indicators={safeAppData.masterData.qualityIndicators || []}
            measurements={appData.qualityMeasurements || []}
            patients={appData.patients || []}
            dailyReports={appData.dailyReports || []}
            selectedDate={qualityFilterDate}
            setSelectedDate={setQualityFilterDate}
          />
        );

      case 'quality-dpjp-absensi':
        return <QualityReports type="DPJP_ABSENSI" patients={appData.patients} dailyReports={appData.dailyReports} doctorVisits={appData.doctorVisits} masterData={safeAppData.masterData} currentUser={user} qualityMeasurements={appData.qualityMeasurements} />;
      case 'quality-visite-compliance':
        return <QualityReports type="VISITE_COMPLIANCE" patients={appData.patients} dailyReports={appData.dailyReports} doctorVisits={appData.doctorVisits} masterData={safeAppData.masterData} currentUser={user} qualityMeasurements={appData.qualityMeasurements} />;
      case 'quality-dependency':
        return <QualityReports type="DEPENDENCY" patients={appData.patients} dailyReports={appData.dailyReports} masterData={safeAppData.masterData} currentUser={user} qualityMeasurements={appData.qualityMeasurements} />;
      case 'quality-pathway':
        return <QualityReports type="PATHWAY" patients={appData.patients} dailyReports={appData.dailyReports} masterData={safeAppData.masterData} currentUser={user} qualityMeasurements={appData.qualityMeasurements} />;
      case 'quality-aps-mutu':
        return <QualityReports type="APS_MUTU" patients={appData.patients} dailyReports={appData.dailyReports} masterData={safeAppData.masterData} currentUser={user} qualityMeasurements={appData.qualityMeasurements} />;
      case 'quality-diagnosis-top':
        return <QualityReports type="DIAGNOSIS" patients={appData.patients} dailyReports={appData.dailyReports} masterData={safeAppData.masterData} currentUser={user} qualityMeasurements={appData.qualityMeasurements} />;
      case 'quality-operasi-elektif':
        return <QualityReports type="OPERASI_ELEKTIF" patients={appData.patients} dailyReports={appData.dailyReports} masterData={safeAppData.masterData} currentUser={user} qualityMeasurements={appData.qualityMeasurements} onUpdateReport={handleUpdateDailyReport} />;

      case 'system-data':
        return (
          <DataManagement 
            masterData={safeAppData.masterData} 
            onSave={handleUpdateMasterData} 
            currentUser={user} 
            appData={appData}
            onUpdateAppData={handleUpdateAppData}
            onTriggerSync={handleTriggerSyncManual}
            syncStatus={syncStatus}
          />
        );
      case 'system-inventory':
        return (
          <InventoryModule 
            instruments={appData.instruments || []}
            onAddInstrument={handleAddInstrument}
            onUpdateInstrument={handleUpdateInstrument}
            currentUser={user}
          />
        );
      case 'finance-billing':
        return <FinanceModule 
          records={financeRecords} 
          masterData={safeAppData.masterData} 
          patients={appData.patients || []} 
          doctorVisits={appData.doctorVisits || []}
          onAddRecord={handleAddFinance}
          onDeleteRecord={handleDeleteFinance}
          onImportRecords={handleImportFinance}
          currentUser={user}
        />;
      case 'incident-report':
        return <IncidentModule 
          reports={incidentReports} 
          patients={appData.patients || []} 
          onAddReport={handleAddIncident} 
          onUpdateStatus={handleUpdateIncident} 
          onDeleteReport={handleDeleteIncident}
          currentUser={user}
          settings={safeAppData.masterData.settings}
        />;

      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400 p-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-inner">
            <p className="text-2xl font-black text-slate-800 uppercase tracking-widest">Under Development</p>
            <Button onClick={() => setActiveMenu('dashboard')} className="mt-10 px-10 py-4 rounded-2xl shadow-xl shadow-blue-100">Kembali ke Dashboard</Button>
          </div>
        );
    }
  };

  if (!isReady) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-6"></div>
        <h2 className="text-white text-xl font-black uppercase tracking-widest mb-2">Inisialisasi Sistem</h2>
        <p className="text-slate-400 text-xs font-medium max-w-xs leading-relaxed mb-8">
          Menghubungkan ke database cloud dan memuat data master... Mohon tunggu sebentar.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button 
            onClick={() => {
              setUser({
                username: 'recovery_guest',
                name: 'Mode Pemulihan Read-Only',
                role: 'SUPER_ADMIN',
                position: 'Pengunjung',
                unit: 'Ruang Bedah',
                isRecovery: true
              });
              setIsReady(true);
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all shadow-lg shadow-blue-900/40"
          >
            Masuk Mode Pemulihan (Read-Only)
          </button>
          <button 
            onClick={() => setIsReady(true)}
            className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            Lewati & Gunakan Data Lokal (Offline)
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} settings={safeAppData.masterData.settings} />;
  }

  const allSurgicalOperations = [
    ...(appData.dailyReports || [])
      .filter(dr => dr.surgeryProcedure || dr.surgeryDate)
      .map(dr => {
        const patient = (appData.patients || []).find(p => p.id === dr.patientId);
        return {
          id: dr.patientId,
          patientName: patient?.name || 'Pasien Bedah',
          medRecNo: patient?.noRM || '-',
          operator: dr.surgeryOperator || 'dr. Operator Bedah',
          procedure: dr.surgeryProcedure || 'Tindakan Operasi',
          room: patient?.ruangan || 'Kamar Operasi',
          date: dr.surgeryDate || dr.date || new Date().toISOString().split('T')[0],
          startTime: dr.surgeryTime || '08:00',
        };
      }),
    ...(appData.operationReports || []).map(opr => ({
      id: opr.id,
      patientName: opr.patientName || 'Pasien',
      medRecNo: opr.noRM || '-',
      operator: opr.operator || 'dr. Operator',
      procedure: opr.procedureName || 'Operasi Bedah',
      room: opr.room || 'Kamar Operasi',
      date: opr.date || new Date().toISOString().split('T')[0],
      startTime: opr.startTime || '08:00',
    })),
  ];

  return (
    <Layout 
      user={user} 
      rolePermissions={safeAppData.masterData?.rolePermissions}
      onLogout={handleLogout} 
      onNavigate={setActiveMenu} 
      activeMenu={activeMenu}
      syncStatus={syncStatus}
      isFirestoreOnline={isFirestoreOnline}
      onSync={handleSync}
      lastSyncTime={lastSyncTime}
      settings={safeAppData.masterData.settings}
    >
      <WorkspaceBar
        onFilePicked={handleFilePickedFromDrive}
        onOpenDocsExport={() => handleOpenDocsExport()}
        onOpenCalendarSync={() => setIsCalendarModalOpen(true)}
        notify={notify}
      />

      {renderContent()}
      
      <DocsExportModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
        defaultTitle={docsExportTitle}
        defaultContent={docsExportContent}
        notify={notify}
      />

      <CalendarSyncModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        operations={allSurgicalOperations}
        notify={notify}
      />
      
      {isPatientModalOpen && (
        <PatientModal 
          masterData={safeAppData.masterData}
          onClose={() => {
            if (editingPatient) {
              const pId = editingPatient.id;
              const username = user?.username || 'Guest';
              fetch(`/api/patients/${pId}/unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
              }).catch(() => {});
            }
            setIsPatientModalOpen(false);
            setEditingPatient(null);
          }}
          onSave={handleAddPatient}
          onDelete={handleDeletePatient}
          currentUser={user}
          initialData={editingPatient || undefined}
        />
      )}

      {(() => {
        if (!selectedDetailPatientId) return null;
        const patient = appData.patients?.find(p => p.id === selectedDetailPatientId);
        if (!patient) return null;
        return (
          <PatientDetailModal
            patient={patient}
            dailyReports={appData.dailyReports || []}
            onClose={() => setSelectedDetailPatientId(null)}
            onSave={handleUpdatePatient}
            masterData={safeAppData.masterData}
          />
        );
      })()}

      {/* Custom Delete Confirmation Modal to prevent native confirm iframe block */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in animate-duration-200">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl w-full max-w-md border border-slate-100 relative">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="font-black text-slate-800 text-2xl tracking-tight mb-2">Konfirmasi Hapus</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                Anda yakin ingin menghapus data <b className="text-slate-700">"{deleteConfirmTarget.name}"</b>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-4 w-full">
                <Button 
                  variant="secondary" 
                  className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-50"
                  onClick={() => setDeleteConfirmTarget(null)}
                >
                  Batal
                </Button>
                <button 
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-200"
                  onClick={() => {
                    if (deleteConfirmTarget.type === 'patient') {
                      handleDeletePatient(deleteConfirmTarget.id);
                    } else if (deleteConfirmTarget.type === 'incident') {
                      handleDeleteIncident(deleteConfirmTarget.id);
                    }
                    setDeleteConfirmTarget(null);
                  }}
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Notification */}
      {notification && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] ${notification.type === 'danger' ? 'bg-rose-900 border-rose-500/50' : 'bg-slate-900 border-blue-500/50'} text-white px-8 py-4 rounded-full flex items-center gap-3 shadow-2xl border animate-fade-in`}>
          <CheckCircle2 size={18} className={notification.type === 'danger' ? 'text-rose-400' : 'text-emerald-400'}/>
          <span className="text-xs font-black uppercase tracking-widest">{notification.message}</span>
        </div>
      )}
    </Layout>
  );
};

export default App;
