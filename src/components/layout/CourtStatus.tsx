'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs, getDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Reservation } from '@/lib/types';

interface CourtStatusProps {
  showLabel?: boolean;
  className?: string;
}

export default function CourtStatus({ showLabel = true, className = '' }: CourtStatusProps) {
  const [isOccupied, setIsOccupied] = useState(false);
  const [participantNames, setParticipantNames] = useState<string[]>([]);

  useEffect(() => {
    const now = new Date();
    const startOfPrevDay = new Date(now);
    startOfPrevDay.setDate(now.getDate() - 1);
    startOfPrevDay.setHours(0, 0, 0, 0);
    const startOfNextDay = new Date(now);
    startOfNextDay.setDate(now.getDate() + 1);
    startOfNextDay.setHours(0, 0, 0, 0);

    // Inclui reservas que iniciaram ontem ou hoje (para pegar 23:00→00:30 em andamento)
    const reservationsQuery = query(
      collection(db, 'reservations'),
      where('startAt', '>=', Timestamp.fromDate(startOfPrevDay)),
      where('startAt', '<', Timestamp.fromDate(startOfNextDay)),
      orderBy('startAt', 'asc')
    );

    const unsubscribe = onSnapshot(reservationsQuery, async (snapshot) => {
      const now = Date.now();
      let currentReservation: Reservation | null = null;

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as Reservation;
        const start = data.startAt.toMillis();
        const end = data.endAt.toMillis();

        if (now >= start && now < end) {
          currentReservation = { ...data, id: doc.id };
        }
      });

      if (currentReservation) {
        setIsOccupied(true);
        const participantsSnap = await getDocs(
          query(
            collection(db, 'reservationParticipants'),
            where('reservationId', '==', currentReservation.id)
          )
        );
        const names: string[] = [];
        for (const pDoc of participantsSnap.docs) {
          const userId = pDoc.data().userId;
          const guestName = pDoc.data().guestName;
          if (guestName?.trim()) {
            names.push(guestName.trim());
          } else if (userId) {
            const userSnap = await getDoc(doc(db, 'users', userId));
            const u = userSnap.exists() ? userSnap.data() : {};
            names.push(`${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Jogador');
          }
        }
        setParticipantNames(names.length > 0 ? names : ['—']);
      } else {
        setIsOccupied(false);
        setParticipantNames([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const displayText = isOccupied
    ? participantNames.length > 2
      ? `${participantNames[0]}, ${participantNames[1]} e +${participantNames.length - 2}`
      : participantNames.join(', ')
    : '';

  const statusColor = isOccupied ? 'red' : 'green';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="relative w-6 h-6 flex-shrink-0 animate-spin"
        style={{ animationDuration: '3s' }}
        aria-hidden
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: statusColor === 'green' ? '#10b981' : '#ef4444',
            maskImage: 'url(/images/logo.png)',
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskImage: 'url(/images/logo.png)',
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
          }}
        />
      </div>
      <div className="flex flex-col min-w-0">
        {showLabel && (
          <span
            className={`text-sm font-medium ${
              isOccupied ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            {isOccupied ? 'Quadra ocupada' : 'Quadra livre'}
          </span>
        )}
        {isOccupied && displayText ? (
          <span className="text-xs text-gray-600 truncate max-w-[120px]">
            {displayText}
          </span>
        ) : !isOccupied && showLabel ? (
          <span className="text-xs text-gray-600 font-medium">Reserve agora!</span>
        ) : null}
      </div>
    </div>
  );
}
