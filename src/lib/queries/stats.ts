import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  documentId,
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
  pictureUrl?: string;
  count: number;
}

export interface MonthlyHours {
  monthKey: string;
  monthLabel: string;
  hours: number;
}

export interface WeeklyHours {
  weekKey: string;
  weekLabel: string;
  hours: number;
}

export interface ReservationListItem {
  id: string;
  dateLabel: string;
  time: string;
  participants: string[];
  /** ID de quem criou a reserva — só o criador pode editar participantes. */
  createdById: string;
}

export interface UserStats {
  totalHours: number;
  totalReservations: number;
  weekStreak: number;
  dayStats: DayStat[];
  monthlyHours: MonthlyHours[];
  weeklyHours: WeeklyHours[];
  topPartners: PartnerStat[];
  nextReservation: NextReservationInfo | null;
  upcomingReservations: ReservationListItem[];
  pastReservations: ReservationListItem[];
}

async function getReservationIdsForUser(userId: string): Promise<Set<string>> {
  const [asCreatorSnap, asParticipantSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'reservations'),
        where('createdById', '==', userId)
      )
    ),
    getDocs(
      query(
        collection(db, 'reservationParticipants'),
        where('userId', '==', userId)
      )
    ),
  ]);

  const ids = new Set<string>();
  asCreatorSnap.docs.forEach((d) => ids.add(d.id));
  asParticipantSnap.docs.forEach((d) => ids.add(d.data().reservationId));
  return ids;
}

const FIRESTORE_IN_QUERY_LIMIT = 30;

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

  // Busca em lotes (Firestore limita 'in' a 30 valores)
  for (let i = 0; i < reservationIds.length; i += FIRESTORE_IN_QUERY_LIMIT) {
    const batch = reservationIds.slice(i, i + FIRESTORE_IN_QUERY_LIMIT);
    const q = query(
      collection(db, 'reservations'),
      where(documentId(), 'in', batch)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data();
      reservations.push({
        id: d.id,
        startAt: data.startAt?.toDate?.() ?? new Date(),
        endAt: data.endAt?.toDate?.() ?? new Date(),
        createdById: data.createdById ?? '',
      });
    });
  }

  return reservations;
}

/** Retorna o total de horas jogadas (reservas passadas × 1,5h) para um usuário. */
export async function getTotalHoursForUser(userId: string): Promise<number> {
  const reservationIds = await getReservationIdsForUser(userId);
  const allReservations = await getReservationsByIds(Array.from(reservationIds));
  const now = new Date();
  const pastReservations = allReservations.filter((r) => r.endAt <= now);
  return Math.round(pastReservations.length * RESERVATION_DURATION_HOURS * 10) / 10;
}

/** Retorna jogadores com quem o usuário já jogou (parceiros de quadra), ordenados por frequência. */
export async function getRecommendedPartners(
  userId: string,
  limit = 10
): Promise<PartnerStat[]> {
  const reservationIds = await getReservationIdsForUser(userId);
  const allReservations = await getReservationsByIds(Array.from(reservationIds));
  const now = new Date();
  const pastReservations = allReservations.filter((r) => r.endAt <= now);

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
    .slice(0, limit);

  const topPartners: PartnerStat[] = [];
  for (let i = 0; i < topPartnerIds.length; i++) {
    const [uid, count] = topPartnerIds[i];
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const u = userSnap.data();
      if (u?.isAnonymous === true) continue;
      const firstName = u?.firstName ?? '';
      const lastName = u?.lastName ?? '';
      const name = `${firstName} ${lastName}`.trim() || 'Jogador';
      topPartners.push({
        userId: uid,
        name,
        initials: `${(firstName || 'J')[0]}${(lastName || '?')[0]}`.toUpperCase(),
        pictureUrl: u?.pictureUrl,
        count,
      });
    }
  }
  return topPartners;
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

export interface ProfileSummary {
  totalHours: number;
  totalReservations: number;
  weekStreak: number;
}

/** Resumo rápido para o perfil: só números, sem participantes nem usuários. */
export async function getProfileSummary(userId: string): Promise<ProfileSummary> {
  const reservationIds = await getReservationIdsForUser(userId);
  const allReservations = await getReservationsByIds(Array.from(reservationIds));
  const now = new Date();
  const pastReservations = allReservations.filter((r) => r.endAt <= now);
  const totalHours =
    Math.round(pastReservations.length * RESERVATION_DURATION_HOURS * 10) / 10;
  const weekStreak = computeWeekStreak(pastReservations.map((r) => r.startAt));
  return {
    totalHours,
    totalReservations: allReservations.length,
    weekStreak,
  };
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
  const participantsSnaps = await Promise.all(
    pastReservations.map((res) =>
      getDocs(
        query(
          collection(db, 'reservationParticipants'),
          where('reservationId', '==', res.id)
        )
      )
    )
  );
  for (const participantsSnap of participantsSnaps) {
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

  const topPartnerDocs = await Promise.all(
    topPartnerIds.map(([uid]) => getDoc(doc(db, 'users', uid)))
  );
  const topPartners: PartnerStat[] = [];
  for (let i = 0; i < topPartnerIds.length; i++) {
    const [uid, count] = topPartnerIds[i];
    const userSnap = topPartnerDocs[i];
    if (userSnap.exists()) {
      const u = userSnap.data();
      const firstName = u?.firstName ?? '';
      const lastName = u?.lastName ?? '';
      const name = `${firstName} ${lastName}`.trim() || 'Jogador';
      topPartners.push({
        userId: uid,
        name,
        initials: `${(firstName || 'J')[0]}${(lastName || '?')[0]}`.toUpperCase(),
        pictureUrl: u?.pictureUrl,
        count,
      });
    }
  }

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthlyHours: MonthlyHours[] = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const count = pastReservations.filter(
      (r) => r.startAt.getFullYear() === year && r.startAt.getMonth() === month
    ).length;
    const hours = Math.round(count * RESERVATION_DURATION_HOURS * 10) / 10;
    monthlyHours.push({
      monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
      monthLabel: monthNames[month],
      hours,
    });
  }

  const weeklyHours: WeeklyHours[] = [];
  for (let i = 4; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7);
    const weekKey = getWeekKey(weekStart);
    const count = pastReservations.filter((r) => getWeekKey(r.startAt) === weekKey).length;
    const hours = Math.round(count * RESERVATION_DURATION_HOURS * 10) / 10;
    const weekLabel = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    weeklyHours.push({ weekKey, weekLabel, hours });
  }

  const pastSorted = [...pastReservations].sort(
    (a, b) => b.startAt.getTime() - a.startAt.getTime()
  );

  const [futureParticipants, pastParticipants] = await Promise.all([
    Promise.all(futureReservations.map((r) => getParticipantNamesForReservation(r.id))),
    Promise.all(pastSorted.map((r) => getParticipantNamesForReservation(r.id))),
  ]);

  let nextReservation: NextReservationInfo | null = null;
  const upcomingReservations: ReservationListItem[] = [];
  for (let i = 0; i < futureReservations.length; i++) {
    const r = futureReservations[i];
    const participants = futureParticipants[i];
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
      createdById: r.createdById,
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

  const pastReservationsList: ReservationListItem[] = pastSorted.map((r, i) => ({
    id: r.id,
    dateLabel: r.startAt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }),
    time: `${formatTime(r.startAt)} - ${formatTime(r.endAt)}`,
    participants: pastParticipants[i],
    createdById: r.createdById,
  }));

  return {
    totalHours,
    totalReservations,
    weekStreak,
    dayStats,
    monthlyHours,
    weeklyHours,
    topPartners,
    nextReservation,
    upcomingReservations,
    pastReservations: pastReservationsList,
  };
}
