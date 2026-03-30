import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDone={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      className={`toast toast-${toast.type}`}
      initial={{ opacity: 0, y: -40, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {toast.message}
    </motion.div>
  );
}

let toastId = 0;
export function createToast(message, type = 'info') {
  return { id: ++toastId, message, type, timestamp: Date.now() };
}
