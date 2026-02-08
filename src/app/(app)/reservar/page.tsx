'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { Reservation } from '@/lib/types';
import ModalNovaReserva from '@/components/reserva/ModalNovaReserva';

interface DayTab {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}

interface ReservationWithParticipants extends Reservation {
  participants: string[];
}

export default function ReservarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [days, setDays] = useState<DayTab[]>([]);
  const [reservations, setReservations] = useState<ReservationWithParticipants[]>([]);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

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
    if (!selectedDate) return;

    const fetchReservations = async () => {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'reservations'),
        where('startAt', '>=', Timestamp.fromDate(startOfDay)),
        where('startAt', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('startAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const reservationsData: ReservationWithParticipants[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          startAt: data.startAt,
          endAt: data.endAt,
          createdById: data.createdById,
          createdAt: data.createdAt,
          participants: ['Gustavo', 'Ana'], // TODO: buscar participantes reais
        };
      });

      setReservations(reservationsData);
    };

    fetchReservations();
  }, [selectedDate]);

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

  // Gerar horários de 06:00 até 23:00
  const timeSlots = [];
  for (let hour = 6; hour <= 23; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
  }

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
                {day.isToday && (
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
          {timeSlots.map((time) => {
            const [hour] = time.split(':').map(Number);
            
            // Verificar se há reserva neste horário
            const reservation = reservations.find((res) => {
              const resStart = res.startAt.toDate();
              const resHour = resStart.getHours();
              const resMinute = resStart.getMinutes();
              
              return resHour === hour && resMinute === 0;
            });

            return (
              <div key={time} className="flex gap-3 h-16 border-b border-gray-100">
                <div className="w-14 flex-shrink-0 text-xs text-gray-500 pt-1">
                  {time}
                </div>
                <div className="flex-1 relative">
                  {reservation && (
                    <div className="absolute inset-x-0 top-1 bottom-1">
                      <div className="h-full bg-gradient-to-r from-yellow-100 to-yellow-50 border-l-4 border-yellow-500 rounded-r-lg p-2 shadow-sm">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {reservation.participants.join(', ')}
                        </div>
                        <div className="text-xs text-gray-600">
                          {formatTime(reservation.startAt.toDate())} – {formatTime(reservation.endAt.toDate())}
                        </div>
                      </div>
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

      {/* Modal */}
      {showModal && (
        <ModalNovaReserva
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
