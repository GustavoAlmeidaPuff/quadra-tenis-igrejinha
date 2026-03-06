'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Reservation } from '@/lib/types';
import { normalizeCourtId, getCourtName, COURTS, CourtId } from '@/lib/courts';
import { ChevronDown } from 'lucide-react';

interface CourtInfo {
  courtId: CourtId;
  name: string;
  isOccupied: boolean;
  participantNames: string[];
}

async function fetchParticipantNames(reservationId: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, 'reservationParticipants'), where('reservationId', '==', reservationId))
  );
  const names: string[] = [];
  for (const pDoc of snap.docs) {
    const { userId, guestName } = pDoc.data();
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

function StatusDot({ isOccupied }: { isOccupied: boolean }) {
  return (
    <div
      className="relative w-5 h-5 flex-shrink-0 animate-spin"
      style={{ animationDuration: '3s' }}
      aria-hidden
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: isOccupied ? '#ef4444' : '#10b981',
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
  );
}

function CourtRow({ court }: { court: CourtInfo }) {
  const displayText = court.isOccupied
    ? court.participantNames.length > 2
      ? `${court.participantNames[0]}, ${court.participantNames[1]} e +${court.participantNames.length - 2}`
      : court.participantNames.join(', ')
    : 'Reserve agora!';

  return (
    <div className="flex items-center gap-2 px-1 py-0.5">
      <StatusDot isOccupied={court.isOccupied} />
      <div className="min-w-0">
        <p className={`text-sm font-medium ${court.isOccupied ? 'text-red-600' : 'text-emerald-600'}`}>
          {court.isOccupied ? `${court.name} ocupada` : `${court.name} livre`}
        </p>
        <p className="text-xs text-gray-500 truncate max-w-[140px]">{displayText}</p>
      </div>
    </div>
  );
}

export default function CourtsStatusSummary() {
  const [courts, setCourts] = useState<CourtInfo[]>(
    COURTS.map((c) => ({ courtId: c.id, name: c.name, isOccupied: false, participantNames: [] }))
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updateFromDocs = useCallback(
    async (docs: { id: string; data: () => Reservation & { courtId?: string } }[]) => {
      const now = Date.now();
      const updated: CourtInfo[] = await Promise.all(
        COURTS.map(async (c) => {
          const normalizedId = normalizeCourtId(c.id);
          let occupied = false;
          let names: string[] = [];

          for (const d of docs) {
            const data = d.data();
            if (normalizeCourtId(data.courtId) !== normalizedId) continue;
            const start = data.startAt.toMillis();
            const end = data.endAt.toMillis();
            if (now >= start && now < end) {
              occupied = true;
              names = await fetchParticipantNames(d.id);
              break;
            }
          }

          return {
            courtId: c.id,
            name: getCourtName(c.id),
            isOccupied: occupied,
            participantNames: names,
          };
        })
      );
      setCourts(updated);
    },
    []
  );

  useEffect(() => {
    const now = new Date();
    const startOfPrevDay = new Date(now);
    startOfPrevDay.setDate(now.getDate() - 1);
    startOfPrevDay.setHours(0, 0, 0, 0);
    const startOfNextDay = new Date(now);
    startOfNextDay.setDate(now.getDate() + 1);
    startOfNextDay.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'reservations'),
      where('startAt', '>=', Timestamp.fromDate(startOfPrevDay)),
      where('startAt', '<', Timestamp.fromDate(startOfNextDay)),
      orderBy('startAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({
        id: d.id,
        data: () => d.data() as Reservation & { courtId?: string },
      }));
      updateFromDocs(docs);
    });

    const interval = setInterval(async () => {
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({
        id: d.id,
        data: () => d.data() as Reservation & { courtId?: string },
      }));
      updateFromDocs(docs);
    }, 30_000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [updateFromDocs]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const freeCourts = courts.filter((c) => !c.isOccupied);
  const showSummary = freeCourts.length > 1;

  if (showSummary) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <StatusDot isOccupied={false} />
          <div className="text-left">
            <p className="text-sm font-medium text-emerald-600 leading-tight">
              {freeCourts.length} quadras livres
            </p>
            <p className="text-xs text-gray-500">Reserve agora!</p>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-2 space-y-1 min-w-[200px]">
            {courts.map((c) => (
              <CourtRow key={c.courtId} court={c} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default: show each court individually
  return (
    <div className="flex items-center gap-3">
      {courts.map((c, i) => (
        <div key={c.courtId} className="flex items-center gap-3">
          {i > 0 && <div className="w-px h-8 bg-gray-200" />}
          <CourtRow court={c} />
        </div>
      ))}
    </div>
  );
}
