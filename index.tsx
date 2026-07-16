
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Catch and handle Google OAuth redirect popup
if (window.location.hash) {
  const params = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = params.get('access_token');
  if (accessToken) {
    if (window.opener) {
      window.opener.postMessage(
        { type: 'GOOGLE_OAUTH_TOKEN', accessToken },
        window.location.origin
      );
      window.close();
    }
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
