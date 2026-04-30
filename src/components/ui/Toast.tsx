'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { getFriendlyError } from '@/lib/errors';

type ToastVariant = 'error' | 'success' | 'info';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  showError: (err: unknown, fallbackTitle?: string) => void;
  showSuccess: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail-safe: never crash if a component uses useToast outside the provider
    return {
      showToast: () => {},
      showError: (err) => console.error('[toast-fallback]', err),
      showSuccess: () => {},
    };
  }
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback<ToastContextValue['showToast']>((toast) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const showError = useCallback<ToastContextValue['showError']>(
    (err, fallbackTitle) => {
      console.error('[toast-error]', err);
      const friendly = getFriendlyError(err);
      showToast({
        variant: 'error',
        title: fallbackTitle ?? friendly.title,
        description: friendly.message,
      });
    },
    [showToast]
  );

  const showSuccess = useCallback<ToastContextValue['showSuccess']>(
    (title, description) => {
      showToast({ variant: 'success', title, description });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess }}>
      {children}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const [enter, setEnter] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEnter(true), 10);
    return () => clearTimeout(t);
  }, []);

  const variantStyles =
    toast.variant === 'error'
      ? 'bg-white border-red-200'
      : toast.variant === 'success'
      ? 'bg-white border-emerald-200'
      : 'bg-white border-gray-200';

  const Icon =
    toast.variant === 'error'
      ? AlertTriangle
      : toast.variant === 'success'
      ? CheckCircle2
      : Info;

  const iconColor =
    toast.variant === 'error'
      ? 'text-red-500'
      : toast.variant === 'success'
      ? 'text-emerald-500'
      : 'text-gray-500';

  return (
    <div
      className={`pointer-events-auto rounded-xl border shadow-lg px-4 py-3 flex gap-3 transition-all duration-200 ${variantStyles} ${
        enter ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
      role={toast.variant === 'error' ? 'alert' : 'status'}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
        {toast.description && (
          <p className="text-sm text-gray-600 mt-0.5 leading-snug">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
