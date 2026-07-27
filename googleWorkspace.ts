import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';

// Google Workspace Scopes
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

// Memory cache for Google OAuth Access Token
let cachedAccessToken: string | null = null;
let isSigningIn = false;

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

/**
 * Configure Google Auth Provider with Workspace scopes
 */
export const getWorkspaceProvider = (): GoogleAuthProvider => {
  const provider = new GoogleAuthProvider();
  WORKSPACE_SCOPES.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
};

/**
 * Sign in with Google to get Google Workspace OAuth access token
 */
export const signInWithGoogleWorkspace = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const provider = getWorkspaceProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan Google Access Token dari login. Mohon coba lagi.');
    }

    cachedAccessToken = credential.accessToken;
    // Store token in session cache memory for current tab duration
    sessionStorage.setItem('google_workspace_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('[Google Workspace Auth Error]', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get cached access token or restore from sessionStorage
 */
export const getWorkspaceAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  const stored = sessionStorage.getItem('google_workspace_token');
  if (stored) {
    cachedAccessToken = stored;
    return cachedAccessToken;
  }
  return null;
};

/**
 * Clear Workspace Access Token on logout
 */
export const clearWorkspaceAccessToken = () => {
  cachedAccessToken = null;
  sessionStorage.removeItem('google_workspace_token');
};

/**
 * Initialize Auth listener
 */
export const initWorkspaceAuth = (onAuthChange: (user: User | null, token: string | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      const token = getWorkspaceAccessToken();
      onAuthChange(user, token);
    } else {
      clearWorkspaceAccessToken();
      onAuthChange(null, null);
    }
  });
};

// ==========================================
// GOOGLE PICKER API
// ==========================================

let isPickerApiLoaded = false;

/**
 * Dynamically load Google API client script (gapi)
 */
export const loadPickerApi = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isPickerApiLoaded && window.gapi && window.google?.picker) {
      resolve();
      return;
    }

    if (document.getElementById('google-gapi-script')) {
      // Script tag exists, wait for gapi
      const checkGapi = setInterval(() => {
        if (window.gapi) {
          clearInterval(checkGapi);
          window.gapi.load('picker', {
            callback: () => {
              isPickerApiLoaded = true;
              resolve();
            },
            onerror: () => reject(new Error('Gagal memuat Google Picker API')),
          });
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gapi-script';
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('picker', {
        callback: () => {
          isPickerApiLoaded = true;
          resolve();
        },
        onerror: () => reject(new Error('Gagal memuat Google Picker API')),
      });
    };
    script.onerror = () => reject(new Error('Gagal memuat skrip gapi Google'));
    document.body.appendChild(script);
  });
};

export interface PickedFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  iconUrl?: string;
  sizeBytes?: number;
}

/**
 * Open Google Picker to select files from Google Drive
 */
export const openGooglePicker = async (options: {
  onPicked: (file: PickedFile) => void;
  onCancel?: () => void;
  title?: string;
  viewId?: string; // DOCS, DOCS_IMAGES, etc.
}): Promise<void> => {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Anda belum terhubung ke Google Workspace. Silakan klik tombol Sign in with Google terlebih dahulu.');
  }

  await loadPickerApi();

  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
  view.setIncludeFolders(true);

  const pickerBuilder = new window.google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(token)
    .setCallback((data: any) => {
      if (data.action === window.google.picker.Action.PICKED) {
        const file = data.docs[0];
        const picked: PickedFile = {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          url: file.url || `https://drive.google.com/file/d/${file.id}/view`,
          iconUrl: file.iconUrl,
          sizeBytes: file.sizeBytes,
        };
        options.onPicked(picked);
      } else if (data.action === window.google.picker.Action.CANCEL) {
        if (options.onCancel) options.onCancel();
      }
    })
    .setOrigin(pickerOrigin);

  if (options.title) {
    pickerBuilder.setTitle(options.title);
  }

  const picker = pickerBuilder.build();
  picker.setVisible(true);
};

// ==========================================
// GOOGLE DOCS API
// ==========================================

export interface CreateDocOptions {
  title: string;
  content: string; // Plain text or structured document text
  folderId?: string;
}

export interface GoogleDocResult {
  documentId: string;
  title: string;
  documentUrl: string;
}

/**
 * Create a new Google Doc with content via Google Docs API
 */
export const createGoogleDoc = async (options: CreateDocOptions): Promise<GoogleDocResult> => {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Token Google Workspace tidak ditemukan. Silakan login terlebih dahulu.');
  }

  // 1. Create empty document
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: options.title,
    }),
  });

  if (!createRes.ok) {
    const errorJson = await createRes.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || 'Gagal membuat Google Doc baru.');
  }

  const docData = await createRes.json();
  const documentId = docData.documentId;

  // 2. Insert text content if provided
  if (options.content && options.content.trim() !== '') {
    const batchRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: options.content,
            },
          },
        ],
      }),
    });

    if (!batchRes.ok) {
      console.warn('Document created, but failed to insert initial text content.');
    }
  }

  const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  return {
    documentId,
    title: options.title,
    documentUrl,
  };
};

/**
 * Fetch Google Doc details
 */
export const getGoogleDocDetails = async (documentId: string): Promise<any> => {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Token Google Workspace tidak ditemukan.');
  }

  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error('Gagal mengambil data Google Doc.');
  }

  return await res.json();
};

// ==========================================
// GOOGLE CALENDAR API
// ==========================================

export interface CalendarEventData {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string; // ISO String e.g. 2026-07-24T09:00:00+07:00
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{ email: string; displayName?: string }>;
}

/**
 * List events from primary Google Calendar
 */
export const listCalendarEvents = async (timeMin?: string, timeMax?: string): Promise<CalendarEventData[]> => {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Token Google Workspace tidak ditemukan.');
  }

  const params = new URLSearchParams({
    calendarId: 'primary',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (timeMin) params.append('timeMin', timeMin);
  if (timeMax) params.append('timeMax', timeMax);

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal mengambil jadwal dari Google Calendar.');
  }

  const data = await res.json();
  return data.items || [];
};

/**
 * Create an event in primary Google Calendar
 */
export const createCalendarEvent = async (eventData: CalendarEventData): Promise<any> => {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Token Google Workspace tidak ditemukan. Silakan login dengan Google.');
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventData),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal menambahkan jadwal ke Google Calendar.');
  }

  return await res.json();
};

/**
 * Delete an event from primary Google Calendar (requires user confirmation before calling)
 */
export const deleteCalendarEvent = async (eventId: string): Promise<void> => {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Token Google Workspace tidak ditemukan.');
  }

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal menghapus jadwal dari Google Calendar.');
  }
};
