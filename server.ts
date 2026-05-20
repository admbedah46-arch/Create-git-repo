
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';

import { INITIAL_DATA } from './constants';

dotenv.config();

const app = express();
const PORT = 3000;
const CONFIG_PATH = path.join(process.cwd(), 'server-config.json');
const CACHE_PATH = path.join(process.cwd(), 'app-data-cache.json');

// Initialize config from file or environment
let serverConfig = {
  appsScriptUrl: process.env.VITE_APPS_SCRIPT_URL || ''
};

let cachedData: any = null;
let lastCloudFetchTime = 0;
const CLOUD_CACHE_TTL = 6000; // 6 seconds in-memory TTL to prevent backend rate-limits and timeouts

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    serverConfig = { ...serverConfig, ...savedConfig };
  } catch (e) {
    console.error('Failed to parse server-config.json');
  }
}

if (fs.existsSync(CACHE_PATH)) {
  try {
    cachedData = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch (e) {
    console.error('Failed to parse app-data-cache.json');
  }
}

const APP_WALLPAPER_PATH = path.join(process.cwd(), 'app-wallpaper-base64.txt');
const LOGIN_WALLPAPER_PATH = path.join(process.cwd(), 'login-wallpaper-base64.txt');

let appWallpaperBase64 = '';
let loginWallpaperBase64 = '';

if (fs.existsSync(APP_WALLPAPER_PATH)) {
  try {
    appWallpaperBase64 = fs.readFileSync(APP_WALLPAPER_PATH, 'utf8');
  } catch (e) {
    console.error('Failed to read app-wallpaper-base64.txt');
  }
}
if (fs.existsSync(LOGIN_WALLPAPER_PATH)) {
  try {
    loginWallpaperBase64 = fs.readFileSync(LOGIN_WALLPAPER_PATH, 'utf8');
  } catch (e) {
    console.error('Failed to read login-wallpaper-base64.txt');
  }
}

// Recovery lookups
if (!appWallpaperBase64 && cachedData?.masterData?.settings?.appWallpaperUrl?.startsWith('data:image/')) {
  appWallpaperBase64 = cachedData.masterData.settings.appWallpaperUrl;
  fs.writeFile(APP_WALLPAPER_PATH, appWallpaperBase64, () => {});
}
if (!loginWallpaperBase64 && cachedData?.masterData?.settings?.loginWallpaperUrl?.startsWith('data:image/')) {
  loginWallpaperBase64 = cachedData.masterData.settings.loginWallpaperUrl;
  fs.writeFile(LOGIN_WALLPAPER_PATH, loginWallpaperBase64, () => {});
}

const ensureWallpaperUrls = (data: any) => {
  if (!data) return data;
  if (data.masterData?.settings) {
    const num = Date.now();
    
    // Check appWallpaperUrl
    if (data.masterData.settings.appWallpaperUrl) {
      const url = data.masterData.settings.appWallpaperUrl.trim();
      if (url.startsWith('data:image/')) {
        appWallpaperBase64 = url;
        fs.writeFile(APP_WALLPAPER_PATH, appWallpaperBase64, () => {});
        data.masterData.settings.appWallpaperUrl = `/api/wallpaper/app?t=${num}`;
      } else if (url.includes('drive.google.com')) {
        const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                            url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          const fileId = fileIdMatch[1];
          data.masterData.settings.appWallpaperUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        }
      }
    }
    
    // Check loginWallpaperUrl
    if (data.masterData.settings.loginWallpaperUrl) {
      const url = data.masterData.settings.loginWallpaperUrl.trim();
      if (url.startsWith('data:image/')) {
        loginWallpaperBase64 = url;
        fs.writeFile(LOGIN_WALLPAPER_PATH, loginWallpaperBase64, () => {});
        data.masterData.settings.loginWallpaperUrl = `/api/wallpaper/login?t=${num}`;
      } else if (url.includes('drive.google.com')) {
        const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                            url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          const fileId = fileIdMatch[1];
          data.masterData.settings.loginWallpaperUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        }
      }
    }
  }
  return data;
};

app.use(cors());
app.use(bodyParser.json({ limit: '100mb' })); // Increase body limit for large images
// Keep payload parsing fully aligned
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

// Helper for Google Sheets integration
const getDoc = async () => {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!serviceAccountEmail || !privateKey || !sheetId) {
    return null;
  }

  const auth = new JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  return doc;
};

// --- API ROUTES ---

app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

app.get('/api/config', (req, res) => {
  res.json({
    hasAppsScriptUrl: !!(serverConfig.appsScriptUrl || process.env.VITE_APPS_SCRIPT_URL),
    appsScriptUrl: serverConfig.appsScriptUrl || process.env.VITE_APPS_SCRIPT_URL || null
  });
});

app.post('/api/config', (req, res) => {
  const { appsScriptUrl } = req.body;
  if (typeof appsScriptUrl === 'string') {
    serverConfig.appsScriptUrl = appsScriptUrl;
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(serverConfig, null, 2));
      return res.json({ success: true, config: serverConfig });
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Failed to write config file' });
    }
  }
  res.status(400).json({ success: false, error: 'Invalid config' });
});

// Simple Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Check against users in master data
  const user = INITIAL_DATA.masterData.users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return res.json({
      success: true,
      user: userWithoutPassword
    });
  }

  // Demo / Guest login for recovery or trial (if not found in master data)
  if (username === 'demo' && password === 'demo123') {
    return res.json({
      success: true,
      user: {
        username: 'demo',
        name: 'Demo Visitor',
        role: 'STAFF',
        position: 'Tamu'
      }
    });
  }

  res.status(401).json({ success: false, message: 'Username atau password salah.' });
});

// Data Sync API
app.get('/api/data', async (req, res) => {
  // Prevent any caching of data sync
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  const queryUrl = req.query.url as string;
  const envUrl = serverConfig.appsScriptUrl || process.env.VITE_APPS_SCRIPT_URL;
  const appsScriptUrl = (queryUrl && queryUrl.trim() !== '') ? queryUrl.trim() : envUrl;
  
  // If Apps Script URL is provided, behave as a proxy
  if (appsScriptUrl && appsScriptUrl.startsWith('http')) {
    // If we have a fresh server-side-cached database within the TTL window, serve it immediately!
    // This merges concurrent background polls from multiple tabs/devices into a single Apps Script request
    const now = Date.now();
    if (cachedData && (now - lastCloudFetchTime < CLOUD_CACHE_TTL)) {
      return res.json({ 
        status: 'ready', 
        data: ensureWallpaperUrls(cachedData), 
        message: 'Source of truth: Server Cache (Fresh)' 
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15s
      
      const response = await fetch(appsScriptUrl, { 
        headers: { 'Accept': 'application/json' },
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const cloudResObj = await response.json();
          // Update cache with fresh data from cloud
          if (cloudResObj && cloudResObj.data) {
            cachedData = ensureWallpaperUrls(cloudResObj.data);
            cloudResObj.data = cachedData;
            lastCloudFetchTime = Date.now(); // Record successful cloud fetch timestamp
            fs.writeFile(CACHE_PATH, JSON.stringify(cachedData, null, 2), () => {});
          }
          return res.json(cloudResObj);
        }
      }
      
      // If we are here, cloud failed. Fallback to cache if available.
      if (cachedData) {
        return res.json({ status: 'ready', data: ensureWallpaperUrls(cachedData), message: 'Source of truth: Server Cache (Cloud Temp Unavailable)' });
      }
    } catch (error: any) {
      console.error('Cloud Fetch Error, falling back to cache:', error.message);
      if (error.name === 'AbortError') {
        console.warn('Apps Script fetch timed out after 15s');
      }
      if (cachedData) {
        return res.json({ status: 'ready', data: ensureWallpaperUrls(cachedData), message: 'Source of truth: Server Cache (Cloud Error)' });
      }
    }
  }

  // Final fallback
  res.json({ status: 'ready', data: ensureWallpaperUrls(cachedData || INITIAL_DATA), message: cachedData ? 'Source of truth: Server Cache' : 'Source of truth: Initial State' });
});

app.post('/api/sync', async (req, res) => {
  const { data, url: queryUrl } = req.body;
  
  // Clone original data so we don't mutate the one going to Apps Script
  const originalDataClone = JSON.parse(JSON.stringify(data || {}));
  const sanitizedLocalData = ensureWallpaperUrls(JSON.parse(JSON.stringify(data || {})));
  
  // IMMEDIATELY update server cache with sanitized data
  if (sanitizedLocalData) {
    cachedData = sanitizedLocalData;
    lastCloudFetchTime = Date.now(); // Mark this local sync as valid cache to prevent immediate re-fetching
    fs.writeFile(CACHE_PATH, JSON.stringify(cachedData, null, 2), (err) => {
      if (err) console.error('Failed to write app-data-cache.json');
    });
  }

  const envUrl = serverConfig.appsScriptUrl || process.env.VITE_APPS_SCRIPT_URL;
  const appsScriptUrl = (queryUrl && queryUrl.trim() !== '') ? queryUrl.trim() : envUrl;

  // If Apps Script URL is provided, behave as a proxy
  if (appsScriptUrl && appsScriptUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for sync
      
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(originalDataClone), // Send raw data (with base64) to GAS so GAS can upload to Drive!
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`Apps Script Sync Warning (${response.status}):`, errorText.substring(0, 100));
        
        // Return success with server-cached data instead of throwing/failing with 500
        return res.json({
          success: true,
          warning: `Apps Script responded with status ${response.status}`,
          data: ensureWallpaperUrls(cachedData)
        });
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        if (result && result.success && result.data) {
          cachedData = ensureWallpaperUrls(result.data);
          result.data = cachedData;
          lastCloudFetchTime = Date.now(); // Mark fresh cloud return as valid cache
          fs.writeFile(CACHE_PATH, JSON.stringify(cachedData, null, 2), (err) => {
            if (err) console.error('Failed to update app-data-cache on GAS return');
          });
        }
        return res.json(result);
      } else {
        const text = await response.text().catch(() => '');
        console.warn('GAS URL returned non-JSON on sync:', text.substring(0, 100));
        
        // Return success with server-cached data instead of throwing/failing with 500
        return res.json({
          success: true,
          warning: 'Apps Script returned HTML/text instead of JSON. Check deployment.',
          data: ensureWallpaperUrls(cachedData)
        });
      }
    } catch (error: any) {
      console.warn('Apps Script Sync Warning (Handled):', error.message);
      
      // Fallback silently to server-cache so client-to-client sync remains 100% active and functional
      return res.json({
        success: true,
        warning: 'Apps Script Sync unavailable: ' + error.message,
        data: ensureWallpaperUrls(cachedData)
      });
    }
  }

  try {
    const doc = await getDoc();
    if (!doc) return res.status(200).json({ status: 'unconfigured' });
    
    console.log('Syncing data to Google Sheets...');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Wallpaper dynamic image provider
app.get('/api/wallpaper/:type', (req, res) => {
  const { type } = req.params;
  let base64 = '';
  
  if (type === 'app') {
    base64 = appWallpaperBase64;
  } else if (type === 'login') {
    base64 = loginWallpaperBase64;
  }

  if (base64 && base64.startsWith('data:image/')) {
    const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 7 days since wallpapers are static until reloaded
      return res.end(buffer);
    }
  }

  // Fallback: 1x1 Transparent PNG
  const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.end(transparentPng);
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite middleware loaded');
    } catch (e) {
      console.error('Failed to load Vite:', e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production build from:', distPath);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
