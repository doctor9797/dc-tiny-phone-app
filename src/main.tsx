import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error logging for debugging
window.onerror = (msg, src, line, col, err) => {
  console.error('[Global]', msg, err);
};
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Reject]', e.reason);
});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
