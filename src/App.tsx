/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Register from './pages/Register';
import PetRegistration from './pages/PetRegistration';

import PetManagement from './pages/PetManagement';
import Home from './pages/Home';
import Statistics from './pages/Statistics';
import Report from './pages/Report';

import BudgetSettings from './pages/BudgetSettings';
import Notifications from './pages/Notifications';
import ManualInput from './pages/ManualInput';
import Transactions from './pages/Transactions';
import TransactionDetail from './pages/TransactionDetail';
import Profile from './pages/Profile';
import ProfileEdit from './pages/ProfileEdit';
import Withdrawal from './pages/Withdrawal';
import RecurringSettings from './pages/RecurringSettings';
import Settings from './pages/Settings';
import Security from './pages/Security';
import Terms from './pages/Terms';
import TermDetail from './pages/TermDetail';
import FAQ from './pages/FAQ';
import Inquiry from './pages/Inquiry';
import InquiryHistory from './pages/InquiryHistory';
import KakaoCallback from './pages/KakaoCallback';
import NotificationSettings from './pages/NotificationSettings';
import Admin from './pages/Admin';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { ToastProvider } from './contexts/ToastContext';
import { trackEvent } from './lib/analytics';
import { isPetLogDebug } from './lib/utils';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-8 h-8 border-2 border-[#3B82F6]/20 border-t-[#3B82F6] rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

// 실시간 알림 리스너 (Firestore 알림 컬렉션 감시)
function NotificationListener() {
  const { user } = useAuth();
  const startTime = React.useRef(new Date());

  React.useEffect(() => {
    if (!user) return;

    const initListener = async () => {
      try {
        const { db } = await import('./lib/firebase');
        const { collection, onSnapshot, query, orderBy, limit } = await import('firebase/firestore');
        
        // [v3.0.1] Wrap notificationService in a separate catch to prevent app crash on stale bundles
        let sendLocalNotification: any = null;
        try {
          const mod = await import('./lib/notificationService');
          sendLocalNotification = mod.sendLocalNotification;
        } catch (err) {
          if (isPetLogDebug()) {
            console.warn('notificationService dynamic import skipped (stale bundle):', err);
          }
        }

        const q = query(
          collection(db, 'users', user.uid, 'notifications'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              const createdAt = data.createdAt?.toDate();
              
              // 앱 실행 시점 이후에 생성된 알림만 브라우저/핸드폰 알림으로 표시
              if (createdAt && createdAt > startTime.current) {
                if (sendLocalNotification) {
                  sendLocalNotification(
                    user.uid,
                    (data.type?.toLowerCase() || 'notice') as any,
                    data.title || 'petlog 알림',
                    data.message || ''
                  );
                }
              }
            }
          });
        });

        return unsubscribe;
      } catch (error) {
        if (isPetLogDebug()) {
          console.error('NotificationListener critical error:', error);
        }
        return () => {}; // Return dummy unsubscribe
      }
    };

    let unsubPromise = initListener();

    return () => {
      unsubPromise.then(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      }).catch(err => {
        if (isPetLogDebug()) {
          console.warn('NotificationListener cleanup failed:', err);
        }
      });
    };
  }, [user]);

  return null;
}

function PageTracker() {
  const location = useLocation();
  const { user } = useAuth();

  React.useEffect(() => {
    trackEvent(user?.uid, {
      type: 'page_view',
      page: location.pathname,
    });
  }, [location.pathname, user?.uid]);

  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <div className="max-w-[480px] mx-auto min-h-screen bg-white font-sans shadow-sm transition-colors duration-300">
        <PageTracker />
        <NotificationListener />
        <PWAInstallPrompt />
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
          <Route path="/pet-registration" element={<ProtectedRoute><PetRegistration /></ProtectedRoute>} />

          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/pet-management" element={<ProtectedRoute><PetManagement /></ProtectedRoute>} />
          <Route path="/budget-settings" element={<ProtectedRoute><BudgetSettings /></ProtectedRoute>} />
          <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />

          <Route path="/input" element={<ProtectedRoute><ManualInput /></ProtectedRoute>} />
          <Route path="/manual-input" element={<Navigate to="/input" replace />} />
          <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/transaction/:id" element={<ProtectedRoute><TransactionDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile-edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
          <Route path="/withdrawal" element={<ProtectedRoute><Withdrawal /></ProtectedRoute>} />
          <Route path="/recurring-settings" element={<ProtectedRoute><RecurringSettings /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/terms/:id" element={<TermDetail />} />
          <Route path="/faq" element={<ProtectedRoute><FAQ /></ProtectedRoute>} />
          <Route path="/inquiry" element={<ProtectedRoute><Inquiry /></ProtectedRoute>} />
          <Route path="/inquiry-history" element={<ProtectedRoute><InquiryHistory /></ProtectedRoute>} />
          <Route path="/notification-settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        </Routes>
      </div>
    </ToastProvider>
  );
}
