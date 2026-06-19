import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
};

const COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: '#F0FDF4', border: '#86EFAC', text: '#16A34A' },
  error:   { bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626' },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB' },
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const c = COLORS[toast.type];

  useEffect(() => {
    // Fade in
    const show = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss after 3.5s
    const hide = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 3500);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [onDismiss]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border shadow-md text-sm font-medium transition-all duration-300"
      style={{
        backgroundColor: c.bg,
        borderColor: c.border,
        color: c.text,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        minWidth: '260px',
        maxWidth: '360px',
      }}
    >
      <span className="font-bold text-base">{ICONS[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        className="opacity-50 hover:opacity-100 text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

// Hook for managing toast state
let _nextId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function addToast(message: string, type: ToastType = 'info') {
    const id = _nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, addToast, dismissToast };
}
