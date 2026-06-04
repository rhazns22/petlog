import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { trackEvent } from '../lib/analytics';

interface UsageState {
  ocrUsedToday: number;
  reportUsedToday: number;
  ocrSoftLimit: number;
  reportSoftLimit: number;
  isBetaUser: boolean;
  isPro: boolean;
}

interface UsageContextType extends UsageState {
  incrementOCR: () => Promise<void>;
  incrementReport: () => Promise<void>;
  isOCRLimitReached: boolean;
  isReportLimitReached: boolean;
  togglePro: () => void;
}

const UsageContext = createContext<UsageContextType | undefined>(undefined);

export const UsageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<UsageState>({
    ocrUsedToday: 0,
    reportUsedToday: 0,
    ocrSoftLimit: 5,
    reportSoftLimit: 5,
    isBetaUser: true,
    isPro: false,
  });

  useEffect(() => {
    if (!user) return;

    // Add a delay to ensure auth token is fully propagated
    const initUsage = async () => {
      // Use shorter delay for better UX, but keep it for token propagation
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!user) return; 
      
      const today = getLocalDateString();
      const usageRef = doc(db, 'users', user.uid, 'usage', today);
      
      return onSnapshot(usageRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setState(prev => ({
            ...prev,
            ocrUsedToday: data.ocrUsedToday || 0,
            reportUsedToday: data.reportUsedToday || 0,
          }));
        } else {
          setDoc(usageRef, {
            ocrUsedToday: 0,
            reportUsedToday: 0,
            ocrSoftLimit: 5,
            date: today,
            updatedAt: serverTimestamp()
          }).catch(err => {
            if (err.code !== 'permission-denied') {
              console.error('Error initializing usage doc:', err);
            }
          });
          
          setState(prev => ({
            ...prev,
            ocrUsedToday: 0,
            reportUsedToday: 0,
          }));
        }
      }, (err) => {
        if (err.code === 'permission-denied') {
          console.warn('Usage subscription: waiting for auth propagation...');
        } else {
          console.error('Usage subscription error:', err);
        }
      });
    };

    let unsubscribe: (() => void) | undefined;
    initUsage().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const getLocalDateString = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
    } catch (e) {
      // Fallback if Intl is not supported
      const now = new Date();
      const kstOffset = 9 * 60;
      const kstTime = new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);
      return kstTime.toISOString().slice(0, 10);
    }
  };

  const incrementOCR = async () => {
    if (!user) return;
    const today = getLocalDateString();
    const usageRef = doc(db, 'users', user.uid, 'usage', today);

    try {
      await updateDoc(usageRef, {
        ocrUsedToday: increment(1),
        updatedAt: serverTimestamp()
      });
      
      const newCount = state.ocrUsedToday + 1;
      if (newCount >= state.ocrSoftLimit) {
        trackEvent(user.uid, { type: 'ocr_limit_reached' as any });
      }
    } catch (e) {
      console.error('Error incrementing OCR usage:', e);
      // If update fails because doc doesn't exist (race condition), try setDoc
      try {
        await setDoc(usageRef, {
          ocrUsedToday: 1,
          reportUsedToday: 0,
          ocrSoftLimit: 5,
          date: today,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (innerE) {
        console.error('Final fallback for usage failed:', innerE);
      }
    }
  };

  const incrementReport = async () => {
    if (!user) return;
    const today = getLocalDateString();
    const usageRef = doc(db, 'users', user.uid, 'usage', today);

    const isLimitReachedBefore = state.reportUsedToday >= state.reportSoftLimit;

    try {
      await updateDoc(usageRef, {
        reportUsedToday: increment(1)
      });
      
      const newCount = state.reportUsedToday + 1;
      // Note: State will be updated via onSnapshot automatically

      if (!isLimitReachedBefore && newCount >= state.reportSoftLimit) {
        trackEvent(user.uid, { type: 'report_limit_reached' as any });
      } else if (newCount > state.reportSoftLimit) {
        trackEvent(user.uid, { type: 'report_continue_after_limit' as any });
      }
    } catch (e) {
      console.error('Error incrementing report usage:', e);
    }
  };

  const isOCRLimitReached = state.ocrUsedToday >= state.ocrSoftLimit;
  const isReportLimitReached = state.reportUsedToday >= state.reportSoftLimit;

  const togglePro = () => {
    setState(prev => ({ ...prev, isPro: !prev.isPro }));
  };

  return (
    <UsageContext.Provider value={{ 
      ...state, 
      incrementOCR, 
      incrementReport, 
      isOCRLimitReached, 
      isReportLimitReached,
      togglePro
    }}>
      {children}
    </UsageContext.Provider>
  );
};

export const useUsage = () => {
  const context = useContext(UsageContext);
  if (context === undefined) {
    throw new Error('useUsage must be used within a UsageProvider');
  }
  return context;
};
