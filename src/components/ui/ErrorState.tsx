'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { FriendlyError } from '@/lib/errors';
import { getSupportWhatsAppUrl, hasSupportWhatsApp } from '@/lib/support';

interface ErrorStateProps {
  error: FriendlyError;
  onRetry?: () => void;
  fullPage?: boolean;
  className?: string;
}

export default function ErrorState({
  error,
  onRetry,
  fullPage = false,
  className = '',
}: ErrorStateProps) {
  const supportMessage = error.rawCode
    ? `${error.title} (${error.rawCode})`
    : error.title;
  const supportUrl = getSupportWhatsAppUrl(supportMessage);
  const showSupport = hasSupportWhatsApp();

  const wrapperClass = fullPage
    ? 'min-h-[60vh] flex items-center justify-center px-4'
    : 'py-8 px-4';

  return (
    <div className={`${wrapperClass} ${className}`} role="alert">
      <div className="max-w-sm w-full text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {error.title}
        </h2>
        <p className="text-sm text-gray-600 mb-5 leading-relaxed">
          {error.message}
        </p>
        <div className="flex flex-col gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl px-5 py-2.5 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
          )}
          {showSupport && (
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-emerald-600 transition-colors underline"
            >
              Falar com o suporte
            </a>
          )}
          {error.rawCode && (
            <p className="text-xs text-gray-400 mt-1">
              Código: <span className="font-mono">{error.rawCode}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
