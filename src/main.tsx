import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { UsageProvider } from './contexts/UsageContext';
import { db } from './lib/firebase';
import { terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import App from './App.tsx';
import './index.css';

// Force clear Firestore persistence to resolve internal assertion errors
const resetFirestore = async () => {
  try {
    // If firestore was already initialized, we need to terminate it
    // But since this is at the start, it's safer to just try clearing
    await clearIndexedDbPersistence(db);
    console.log('Firestore persistence cleared');
  } catch (err) {
    console.debug('Firestore persistence not enabled or already cleared');
  }
};

resetFirestore().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <UsageProvider>
              <App />
            </UsageProvider>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </StrictMode>
  );
});

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered!', reg))
      .catch(err => console.log('SW registration failed:', err));
  });
}
