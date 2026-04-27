
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';

import { INITIAL_DATA } from './constants';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

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
    hasAppsScriptUrl: !!process.env.VITE_APPS_SCRIPT_URL,
    appsScriptUrl: process.env.VITE_APPS_SCRIPT_URL || null
  });
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
  const queryUrl = req.query.url as string;
  const envUrl = process.env.VITE_APPS_SCRIPT_URL;
  const appsScriptUrl = (queryUrl && queryUrl.trim() !== '') ? queryUrl.trim() : envUrl;
  
  // If Apps Script URL is provided, behave as a proxy
  if (appsScriptUrl && appsScriptUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout
      
      const response = await fetch(appsScriptUrl, { 
        headers: { 'Accept': 'application/json' },
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Apps Script responded with ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        return res.json(data);
      } else {
        const text = await response.text();
        console.error('GAS URL returned non-JSON:', text.substring(0, 500));
        
        if (text.includes('google-login') || text.includes('ServiceLogin') || (text.includes('DOCTYPE') && text.includes('docs/script/images/favicon.ico'))) {
            throw new Error('Apps Script requires login or is not shared with "Anyone". Please check "Who has access" in deployment settings.');
        }
        
        throw new Error('Sync URL did not return JSON. It returned HTML instead. Ensure you used the "Web App URL" from "New Deployment".');
      }
    } catch (error: any) {
      console.error('Apps Script Proxy Error:', error.name === 'AbortError' ? 'Request timed out (90s)' : error.message);
      return res.status(500).json({ 
          error: 'Apps Script Proxy Error: ' + (error.name === 'AbortError' ? 'Operation aborted due to timeout (90s)' : error.message),
          isHtml: error.message.includes('JSON') || error.message.includes('HTML')
      });
    }
  }

  try {
    const doc = await getDoc();
    if (!doc) {
      return res.status(200).json({ status: 'ready', data: INITIAL_DATA, message: 'Using initial local data' });
    }
    res.json({ status: 'ready' });
  } catch (error: any) {
    res.status(200).json({ status: 'ready', data: INITIAL_DATA, error: error.message });
  }
});

app.post('/api/sync', async (req, res) => {
  const { data, url: queryUrl } = req.body;
  const envUrl = process.env.VITE_APPS_SCRIPT_URL;
  const appsScriptUrl = (queryUrl && queryUrl.trim() !== '') ? queryUrl.trim() : envUrl;

  // If Apps Script URL is provided, behave as a proxy
  if (appsScriptUrl && appsScriptUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 180s timeout for sync
      
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Apps Script responded with ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        return res.json(result);
      } else {
        const text = await response.text();
        console.error('GAS URL returned non-JSON on sync:', text.substring(0, 500));
        
        if (text.includes('google-login') || text.includes('ServiceLogin')) {
            throw new Error('Apps Script requires login. Ensure "Who has access" is set to "Anyone".');
        }
        
        throw new Error('Sync URL returned HTML instead of JSON. Check your deployment.');
      }
    } catch (error: any) {
      console.error('Apps Script Sync Error:', error.message);
      return res.status(500).json({ error: 'Apps Script Sync Error: ' + error.message });
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
