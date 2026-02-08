'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs, getDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Reservation } from '@/lib/types';

interface CourtStatusProps {
  showLabel?: boolean;
  className?: string;
}

async function fetchParticipantNames(reservationId: string): Promise<string[]> {
  const participantsSnap = await getDocs(
    query(
      collection(db, 'reservationParticipants'),
      where('reservationId', '==', reservationId)
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
  return names.length > 0 ? names : ['—'];
}

export default function CourtStatus({ showLabel = true, className = '' }: CourtStatusProps) {
  const [isOccupied, setIsOccupied] = useState(false);
  const [participantNames, setParticipantNames] = useState<string[]>([]);

  const updateStatusFromSnapshot = useCallback(async (docs: { id: string; data: () => Reservation }[]) => {
    const now = Date.now();
    let currentReservation: (Reservation & { id: string }) | null = null;

    for (const d of docs) {
      const data = d.data();
      const start = data.startAt.toMillis();
      const end = data.endAt.toMillis();

      if (now >= start && now < end) {
        currentReservation = { ...data, id: d.id };
        break;
      }
    }

    if (currentReservation) {
      setIsOccupied(true);
      const names = await fetchParticipantNames(currentReservation.id);
      setParticipantNames(names);
    } else {
      setIsOccupied(false);
      setParticipantNames([]);
    }
  }, []);

  useEffect(() => {
    const now = new Date();
    const startOfPrevDay = new Date(now);
    startOfPrevDay.setDate(now.getDate() - 1);
    startOfPrevDay.setHours(0, 0, 0, 0);
    const startOfNextDay = new Date(now);
    startOfNextDay.setDate(now.getDate() + 1);
    startOfNextDay.setHours(0, 0, 0, 0);

    const reservationsQuery = query(
      collection(db, 'reservations'),
      where('startAt', '>=', Timestamp.fromDate(startOfPrevDay)),
      where('startAt', '<', Timestamp.fromDate(startOfNextDay)),
      orderBy('startAt', 'asc')
    );

    const unsubscribe = onSnapshot(reservationsQuery, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, data: () => d.data() as Reservation }));
      updateStatusFromSnapshot(docs);
    });

    // Reavalia a cada 30s para atualizar automaticamente quando o período da reserva termina
    // (o onSnapshot só dispara em mudanças no Firestore, não quando o relógio avança)
    const interval = setInterval(async () => {
      const snapshot = await getDocs(reservationsQuery);
      const docs = snapshot.docs.map((d) => ({ id: d.id, data: () => d.data() as Reservation }));
      updateStatusFromSnapshot(docs);
    }, 30 * 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [updateStatusFromSnapshot]);

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
