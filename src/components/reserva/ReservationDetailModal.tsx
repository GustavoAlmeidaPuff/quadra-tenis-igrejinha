'use client';

import { X, Trash2, Pencil } from 'lucide-react';

export interface ReservationDetailItem {
  id: string;
  dateLabel: string;
  time: string;
  participants: string[];
}

interface ReservationDetailModalProps {
  item: ReservationDetailItem;
  onClose: () => void;
  /** true quando o usuário pode editar/cancelar (ex.: participante da reserva) */
  canManage?: boolean;
  onCancel: (reservationId: string) => void;
  onEditParticipants?: (reservationId: string) => void;
  cancelling: boolean;
}

export default function ReservationDetailModal({
  item,
  onClose,
  canManage,
  onCancel,
  onEditParticipants,
  cancelling,
}: ReservationDetailModalProps) {
  const participantsLabel =
    item.participants.length > 0 ? item.participants.join(', ') : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Detalhes da reserva
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2 mb-6">
          <p className="font-medium text-gray-900 capitalize">
            {item.dateLabel}
          </p>
          <p className="text-sm text-gray-500">{item.time}</p>
          <p className="text-sm text-gray-600">{participantsLabel}</p>
        </div>
        {canManage && (
          <p className="text-xs text-gray-500 mb-4">
            Ao cancelar, a reserva será removida para todos os participantes.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {canManage && onEditParticipants && (
            <button
              type="button"
              onClick={() => {
                onEditParticipants(item.id);
                onClose();
              }}
              disabled={cancelling}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" />
              Editar reserva
            </button>
          )}
          <div className="flex gap-3">
            {canManage && (
              <button
                type="button"
                onClick={() => onCancel(item.id)}
                disabled={cancelling}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {cancelling ? 'Cancelando...' : 'Cancelar reserva'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={cancelling}
              className={
                canManage
                  ? 'py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors'
                  : 'flex-1 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors'
              }
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
