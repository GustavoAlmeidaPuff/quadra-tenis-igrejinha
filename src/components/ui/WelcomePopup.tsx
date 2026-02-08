'use client';

import { X } from 'lucide-react';

interface WelcomePopupProps {
  isOpen: boolean;
  firstName: string;
  onClose: () => void;
}

export default function WelcomePopup({ isOpen, firstName, onClose }: WelcomePopupProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="text-center -mt-2">
            <div className="text-5xl mb-3">👋</div>
            <h1 id="welcome-title" className="text-2xl font-bold text-gray-900">
              Bem-vindo, {firstName}!
            </h1>
          </div>

          <div className="space-y-3 text-left bg-gray-50 rounded-xl p-4">
            <h2 className="font-semibold text-gray-900">Regras da quadra:</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>Cada partida tem duração de <strong>1h30</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>Máximo de <strong>1 reserva por dia</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>Máximo de <strong>4 reservas por semana</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>Reservas disponíveis para os <strong>próximos 7 dias</strong></span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-emerald-600 text-white rounded-xl px-6 py-3 font-medium hover:bg-emerald-700 transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
