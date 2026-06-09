import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-[9999] px-4 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="bg-[#0B2F2A] text-white px-5 py-4 rounded-[20px] shadow-2xl flex items-center gap-3 w-full backdrop-blur-md bg-opacity-95 border border-white/10"
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#12B886] flex-shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-[#F04452] flex-shrink-0" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-[#FFB020] flex-shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-[#20C997] flex-shrink-0" />}
              <span className="text-sm font-bold leading-tight flex-1">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
