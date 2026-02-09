'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, getDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { Reservation } from '@/lib/types';
import ModalNovaReserva from '@/components/reserva/ModalNovaReserva';
import ReservationDetailModal from '@/components/reserva/ReservationDetailModal';

interface DayTab {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface ReservationWithParticipants extends Reservation {
  participants: string[];
  participantIds: string[];
}

export default function ReservarPage() {
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [days, setDays] = useState<DayTab[]>([]);
  const [reservations, setReservations] = useState<ReservationWithParticipants[]>([]);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [reservationsRefreshKey, setReservationsRefreshKey] = useState(0);
  const [initialParticipantIds, setInitialParticipantIds] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [daysWithReservations, setDaysWithReservations] = useState<Set<string>>(new Set());
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithParticipants | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showEditReservationModal, setShowEditReservationModal] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);

  useEffect(() => {
    const adicionarJogador = searchParams.get('adicionarJogador');
    const challenge = searchParams.get('challengeId');
    if (adicionarJogador?.trim()) {
      setInitialParticipantIds([adicionarJogador.trim()]);
      setShowModal(true);
    }
    if (challenge?.trim()) {
      setChallengeId(challenge.trim());
    }
    if (adicionarJogador?.trim() || challenge?.trim()) {
      window.history.replaceState({}, '', '/reservar');
    }
  }, [searchParams]);

  useEffect(() => {
    // Gerar próximos 7 dias
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysArray: DayTab[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      daysArray.push({
        date,
        dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase(),
        dayNumber: date.getDate(),
        isToday: i === 0,
      });
    }
    
    setDays(daysArray);
    setSelectedDate(daysArray[0].date);
  }, []);

  useEffect(() => {
    if (days.length === 0) return;

    const fetchDaysWithReservations = async () => {
      const startOfFirst = new Date(days[0].date);
      startOfFirst.setHours(0, 0, 0, 0);
      const dayBeforeFirst = new Date(startOfFirst);
      dayBeforeFirst.setDate(dayBeforeFirst.getDate() - 1);
      const endOfLast = new Date(days[days.length - 1].date);
      endOfLast.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'reservations'),
        where('startAt', '>=', Timestamp.fromDate(dayBeforeFirst)),
        where('startAt', '<=', Timestamp.fromDate(endOfLast)),
        orderBy('startAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const hasRes: Set<string> = new Set();

      for (const d of snapshot.docs) {
        const data = d.data();
        const resStart = data.startAt?.toDate?.()?.getTime?.() ?? 0;
        const resEnd = data.endAt?.toDate?.()?.getTime?.() ?? 0;

        for (const day of days) {
          const dayStart = new Date(day.date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day.date);
          dayEnd.setHours(23, 59, 59, 999);
          const dayStartMs = dayStart.getTime();
          const dayEndMs = dayEnd.getTime();
          if (resEnd > dayStartMs && resStart <= dayEndMs) {
            hasRes.add(toDateKey(day.date));
          }
        }
      }
      setDaysWithReservations(hasRes);
    };

    fetchDaysWithReservations();
  }, [days, reservationsRefreshKey]);

  useEffect(() => {
    if (!selectedDate) return;

    const fetchReservations = async () => {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      const startOfPrevDay = new Date(selectedDate);
      startOfPrevDay.setDate(selectedDate.getDate() - 1);
      startOfPrevDay.setHours(0, 0, 0, 0);
      const startOfNextDay = new Date(selectedDate);
      startOfNextDay.setDate(selectedDate.getDate() + 1);
      startOfNextDay.setHours(0, 0, 0, 0);

      // Busca reservas que podem sobrepor o dia: início até 1 dia antes OU até 1 dia depois
      const q = query(
        collection(db, 'reservations'),
        where('startAt', '>=', Timestamp.fromDate(startOfPrevDay)),
        where('startAt', '<', Timestamp.fromDate(startOfNextDay)),
        orderBy('startAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const reservationsData: ReservationWithParticipants[] = [];
      const dayStartMs = startOfDay.getTime();
      const dayEndMs = endOfDay.getTime() + 1;

      for (const d of snapshot.docs) {
        const data = d.data();
        const resStart = data.startAt?.toDate?.()?.getTime?.() ?? 0;
        const resEnd = data.endAt?.toDate?.()?.getTime?.() ?? 0;
        // Só inclui se a reserva sobrepõe o dia selecionado
        if (resEnd <= dayStartMs || resStart > dayEndMs) continue;

        const participantsSnap = await getDocs(
          query(
            collection(db, 'reservationParticipants'),
            where('reservationId', '==', d.id)
          )
        );
        const names: string[] = [];
        const ids: string[] = [];
        for (const pDoc of participantsSnap.docs) {
          const userId = pDoc.data().userId;
          if (userId) {
            ids.push(userId);
            const userSnap = await getDoc(doc(db, 'users', userId));
            const u = userSnap.exists() ? userSnap.data() : {};
            names.push(`${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Jogador');
          }
        }
        reservationsData.push({
          id: d.id,
          startAt: data.startAt,
          endAt: data.endAt,
          createdById: data.createdById,
          createdAt: data.createdAt,
          participants: names.length > 0 ? names : ['—'],
          participantIds: ids,
        });
      }

      setReservations(reservationsData);
    };

    fetchReservations();
  }, [selectedDate, reservationsRefreshKey]);

  const visibleDays = days.slice(scrollIndex, scrollIndex + 6);

  const handlePrevious = () => {
    if (scrollIndex > 0) {
      setScrollIndex(scrollIndex - 1);
    }
  };

  const handleNext = () => {
    if (scrollIndex < days.length - 6) {
      setScrollIndex(scrollIndex + 1);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!auth.currentUser) return;
    setCancelling(true);
    try {
      const res = await fetch(
        `/api/reservations?id=${encodeURIComponent(reservationId)}&userId=${encodeURIComponent(auth.currentUser.uid)}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (typeof data?.error === 'string' ? data.error : null) ?? 'Erro ao cancelar reserva';
        alert(msg);
        return;
      }
      setSelectedReservation(null);
      setReservationsRefreshKey((k) => k + 1);
    } catch (e) {
      console.error(e);
      alert('Erro ao cancelar reserva. Verifique sua conexão.');
    } finally {
      setCancelling(false);
    }
  };

  function getDateLabel(res: ReservationWithParticipants): string {
    const start = res.startAt.toDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    if (startDay.getTime() === today.getTime()) return 'Hoje';
    if (startDay.getTime() === tomorrow.getTime()) return 'Amanhã';
    return start.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  // Horários de 00:00 até 23:00 (inclui 00:00 para reservas que atravessam a meia-noite)
  const timeSlots: string[] = [];
  for (let hour = 0; hour <= 23; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
  }

  const ROW_HEIGHT_PX = 64; // h-16
  const isSelectedToday =
    selectedDate && now && selectedDate.toDateString() === now.toDateString();
  const hoursFromMidnight =
    now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const nowLineTop =
    isSelectedToday && hoursFromMidnight >= 0 && hoursFromMidnight < 24
      ? Math.max(0, hoursFromMidnight * ROW_HEIGHT_PX)
      : null;

  return (
    <div className="max-w-md mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Day Selector */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={scrollIndex === 0}
            className="p-1 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-1 flex-1 justify-center">
            {visibleDays.map((day) => (
              <button
                key={day.date.toISOString()}
                onClick={() => setSelectedDate(day.date)}
                className={`flex flex-col items-center px-3 py-2 rounded-xl transition-all ${
                  selectedDate.toDateString() === day.date.toDateString()
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-xs font-medium">{day.dayName}</span>
                <span className="text-lg font-bold">{day.dayNumber}</span>
                {daysWithReservations.has(toDateKey(day.date)) && (
                  <div className="w-1 h-1 rounded-full bg-current mt-0.5" />
                )}
              </button>
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={scrollIndex >= days.length - 6}
            className="p-1 disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4 relative">
        <div className="relative">
          {nowLineTop !== null && (
            <div
              className="absolute left-0 right-0 flex items-center pointer-events-none z-10 -translate-y-1/2"
              style={{ top: nowLineTop }}
              aria-hidden
            >
              <div className="w-14 flex-shrink-0 flex justify-center">
                <span className="text-xs font-semibold text-red-600 tabular-nums bg-white px-1.5 py-0.5 rounded border border-red-200 shadow-sm">
                  {`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`}
                </span>
              </div>
              <div className="flex-1 h-0.5 bg-red-500" />
            </div>
          )}
          {timeSlots.map((time) => {
            const [hour] = time.split(':').map(Number);
            const slotStart = new Date(selectedDate);
            slotStart.setHours(hour, 0, 0, 0);
            const slotEnd = new Date(selectedDate);
            slotEnd.setHours(hour + 1, 0, 0, 0); // hora 23 → 24:00 = 00:00 do dia seguinte

            // Reserva aparece apenas no PRIMEIRO slot em que começa (evita duplicação em 02:00-03:30)
            const reservation = reservations.find((res) => {
              const resStart = res.startAt.toDate();
              const resEnd = res.endAt.toDate();
              if (resStart >= slotEnd || resEnd <= slotStart) return false; // não sobrepõe
              const dayStart = new Date(selectedDate);
              dayStart.setHours(0, 0, 0, 0);
              const firstSlotHour =
                resStart >= dayStart ? resStart.getHours() : 0; // se começou ontem, mostra em 00:00
              return hour === firstSlotHour;
            });

            const resStart = reservation ? reservation.startAt.toDate() : null;
            const resEnd = reservation ? reservation.endAt.toDate() : null;
            const slotStartMs = slotStart.getTime();
            const durationMinutes = resStart && resEnd
              ? (resEnd.getTime() - resStart.getTime()) / (1000 * 60)
              : 0;
            const startOffsetMinutes = resStart
              ? (resStart.getTime() - slotStartMs) / (1000 * 60)
              : 0;
            const topPx = startOffsetMinutes * (ROW_HEIGHT_PX / 60);
            const heightPx = durationMinutes * (ROW_HEIGHT_PX / 60);

            return (
              <div key={time} className="flex gap-3 h-16 border-b border-gray-100">
                <div className="w-14 flex-shrink-0 text-xs text-gray-500 pt-1">
                  {time}
                </div>
                <div className="flex-1 relative min-h-0 overflow-visible">
                  {reservation && (
                    <div
                      className="absolute inset-x-0 top-1 overflow-visible"
                      style={{ top: Math.max(4, topPx), height: heightPx - 8, minHeight: 40 }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedReservation(reservation)}
                        className={`h-full w-full text-left rounded-r-lg p-2 shadow-sm border-l-4 transition-opacity hover:opacity-90 cursor-pointer ${
                          auth.currentUser && reservation.participantIds.includes(auth.currentUser.uid)
                            ? 'bg-gradient-to-r from-emerald-100 to-emerald-50 border-emerald-500'
                            : 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-500'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {reservation.participants.join(', ')}
                        </div>
                        <div className="text-xs text-gray-600">
                          {formatTime(reservation.startAt.toDate())} – {formatTime(reservation.endAt.toDate())}
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-colors z-30"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modal nova reserva */}
      {showModal && (
        <ModalNovaReserva
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setInitialParticipantIds([]);
            setChallengeId(null);
          }}
          onSuccess={() => setReservationsRefreshKey((k) => k + 1)}
          selectedDate={selectedDate}
          initialParticipantIds={initialParticipantIds}
          challengeId={challengeId ?? undefined}
        />
      )}

      {/* Modal detalhes da reserva (ao clicar na agenda) */}
      {selectedReservation && (
        <ReservationDetailModal
          item={{
            id: selectedReservation.id,
            dateLabel: getDateLabel(selectedReservation),
            time: `${formatTime(selectedReservation.startAt.toDate())} - ${formatTime(selectedReservation.endAt.toDate())}`,
            participants: selectedReservation.participants,
          }}
          onClose={() => setSelectedReservation(null)}
          canManage={Boolean(auth.currentUser && selectedReservation.participantIds.includes(auth.currentUser.uid))}
          onCancel={handleCancelReservation}
          onEditParticipants={
            auth.currentUser && selectedReservation.participantIds.includes(auth.currentUser.uid)
              ? (id) => {
                  setSelectedReservation(null);
                  setEditingReservationId(id);
                  setShowEditReservationModal(true);
                }
              : undefined
          }
          cancelling={cancelling}
        />
      )}

      {/* Modal editar participantes (mesmo form da nova reserva em modo edição) */}
      {showEditReservationModal && (
        <ModalNovaReserva
          isOpen={showEditReservationModal}
          onClose={() => {
            setShowEditReservationModal(false);
            setEditingReservationId(null);
          }}
          onSuccess={() => setReservationsRefreshKey((k) => k + 1)}
          reservationId={editingReservationId ?? undefined}
        />
      )}
    </div>
  );
}
