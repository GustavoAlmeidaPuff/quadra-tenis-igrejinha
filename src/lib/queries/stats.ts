import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { formatTime } from '@/lib/utils';

const RESERVATION_DURATION_HOURS = 1.5;
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface NextReservationInfo {
  id: string;
  date: string;
  dateLabel: string;
  time: string;
  participants: string[];
}

export interface DayStat {
  day: string;
  count: number;
}

export interface PartnerStat {
  userId: string;
  name: string;
  initials: string;
  count: number;
}

export interface ReservationListItem {
  id: string;
  dateLabel: string;
  time: string;
  participants: string[];
}

export interface UserStats {
  totalHours: number;
  totalReservations: number;
  weekStreak: number;
  dayStats: DayStat[];
  topPartners: PartnerStat[];
  nextReservation: NextReservationInfo | null;
  upcomingReservations: ReservationListItem[];
  pastReservations: ReservationListItem[];
}

async function getReservationIdsForUser(userId: string): Promise<Set<string>> {
  const ids = new Set<string>();

  const asCreator = await getDocs(
    query(
      collection(db, 'reservations'),
      where('createdById', '==', userId)
    )
  );
  asCreator.docs.forEach((d) => ids.add(d.id));

  const asParticipant = await getDocs(
    query(
      collection(db, 'reservationParticipants'),
      where('userId', '==', userId)
    )
  );
  asParticipant.docs.forEach((d) => ids.add(d.data().reservationId));

  return ids;
}

async function getReservationsByIds(
  reservationIds: string[]
): Promise<Array<{ id: string; startAt: Date; endAt: Date; createdById: string }>> {
  if (reservationIds.length === 0) return [];

  const reservations: Array<{
    id: string;
    startAt: Date;
    endAt: Date;
    createdById: string;
  }> = [];

  for (const id of reservationIds) {
    const ref = doc(db, 'reservations', id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      reservations.push({
        id: snap.id,
        startAt: d.startAt?.toDate?.() ?? new Date(),
        endAt: d.endAt?.toDate?.() ?? new Date(),
        createdById: d.createdById,
      });
    }
  }

  return reservations;
}

async function getParticipantNamesForReservation(
  reservationId: string
): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(db, 'reservationParticipants'),
      where('reservationId', '==', reservationId)
    )
  );

  const names: string[] = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.guestName) {
      names.push(data.guestName);
    } else if (data.userId) {
      const userSnap = await getDoc(doc(db, 'users', data.userId));
      if (userSnap.exists()) {
        const u = userSnap.data();
        const isAnonymous = u?.isAnonymous === true;
        names.push(isAnonymous ? 'Anônimo' : `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim());
      }
    }
  }
  return names.sort((a, b) => (a === 'Anônimo' ? 1 : a.localeCompare(b)));
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const sunday = new Date(d);
  sunday.setDate(diff);
  return sunday.toISOString().slice(0, 10);
}

function computeWeekStreak(pastReservationDates: Date[]): number {
  if (pastReservationDates.length === 0) return 0;

  const weekCounts = new Map<string, number>();
  pastReservationDates.forEach((d) => {
    const key = getWeekKey(d);
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
  });

  const sortedWeeks = Array.from(weekCounts.keys()).sort();
  let streak = 0;
  const now = new Date();
  const thisWeek = getWeekKey(now);

  for (let i = sortedWeeks.length - 1; i >= 0; i--) {
    const week = sortedWeeks[i];
    if (week > thisWeek) continue;
    const prevWeek = i === 0 ? null : sortedWeeks[i - 1];
    const expectedPrev =
      prevWeek &&
      new Date(new Date(week).getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    if (prevWeek !== expectedPrev && i < sortedWeeks.length - 1) break;
    streak++;
  }

  return streak;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const reservationIds = await getReservationIdsForUser(userId);
  const allReservations = await getReservationsByIds(Array.from(reservationIds));

  const now = new Date();
  const pastReservations = allReservations.filter((r) => r.endAt <= now);
  // Inclui reservas futuras e em andamento (que ainda não terminaram)
  const futureReservations = allReservations
    .filter((r) => r.endAt > now)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const totalReservations = allReservations.length;
  const totalHours = Math.round(pastReservations.length * RESERVATION_DURATION_HOURS * 10) / 10;
  const weekStreak = computeWeekStreak(pastReservations.map((r) => r.startAt));

  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  pastReservations.forEach((r) => {
    const day = r.startAt.getDay();
    dayCounts[day]++;
  });
  const dayStats: DayStat[] = DAY_NAMES.map((day, i) => ({
    day,
    count: dayCounts[i],
  }));

  const partnerCounts = new Map<string, number>();
  for (const res of pastReservations) {
    const participantsSnap = await getDocs(
      query(
        collection(db, 'reservationParticipants'),
        where('reservationId', '==', res.id)
      )
    );
    participantsSnap.docs.forEach((d) => {
      const data = d.data();
      const uid = data.userId;
      if (uid && uid !== userId) {
        partnerCounts.set(uid, (partnerCounts.get(uid) ?? 0) + 1);
      }
    });
  }

  const topPartnerIds = Array.from(partnerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topPartners: PartnerStat[] = [];
  for (let i = 0; i < topPartnerIds.length; i++) {
    const [uid, count] = topPartnerIds[i];
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const u = userSnap.data();
      const firstName = u?.firstName ?? '';
      const lastName = u?.lastName ?? '';
      const name = `${firstName} ${lastName}`.trim() || 'Jogador';
      topPartners.push({
        userId: uid,
        name,
        initials: `${(firstName || 'J')[0]}${(lastName || '?')[0]}`.toUpperCase(),
        count,
      });
    }
  }

  let nextReservation: NextReservationInfo | null = null;
  const upcomingReservations: ReservationListItem[] = [];
  for (const r of futureReservations) {
    const participants = await getParticipantNamesForReservation(r.id);
    const isTomorrow =
      r.startAt.getDate() === now.getDate() + 1 &&
      r.startAt.getMonth() === now.getMonth() &&
      r.startAt.getFullYear() === now.getFullYear();
    const dateLabel = isTomorrow
      ? 'Amanhã'
      : r.startAt.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        });
    upcomingReservations.push({
      id: r.id,
      dateLabel,
      time: `${formatTime(r.startAt)} - ${formatTime(r.endAt)}`,
      participants,
    });
    if (!nextReservation) {
      nextReservation = {
        id: r.id,
        date: r.startAt.toISOString().slice(0, 10),
        dateLabel: isTomorrow ? 'Amanhã' : dateLabel,
        time: `${formatTime(r.startAt)} – ${formatTime(r.endAt)}`,
        participants,
      };
    }
  }

  const pastReservationsList: ReservationListItem[] = [];
  const pastSorted = [...pastReservations].sort(
    (a, b) => b.startAt.getTime() - a.startAt.getTime()
  );
  for (const r of pastSorted) {
    const participants = await getParticipantNamesForReservation(r.id);
    pastReservationsList.push({
      id: r.id,
      dateLabel: r.startAt.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }),
      time: `${formatTime(r.startAt)} - ${formatTime(r.endAt)}`,
      participants,
    });
  }

  return {
    totalHours,
    totalReservations,
    weekStreak,
    dayStats,
    topPartners,
    nextReservation,
    upcomingReservations,
    pastReservations: pastReservationsList,
  };
}
