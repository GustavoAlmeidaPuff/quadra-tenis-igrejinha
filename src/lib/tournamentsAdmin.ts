import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { normalizeCourtId, isCourtId } from '@/lib/courts';
import { canManageCourt } from '@/lib/permissions';
import { formatConflictMessage } from '@/lib/reservationConflicts';
import {
  MAX_TOURNAMENT_PERIODS,
  TOURNAMENT_RESERVATION_TYPE,
  describePeriod,
  formatZonedDateTime,
  sanitizeTournamentName,
  validatePeriods,
} from '@/lib/tournaments';

export interface ParsedPeriod {
  startAt: Date;
  endAt: Date;
  label: string;
}

export interface AdminFailure {
  status: number;
  error: string;
  /** Detalhe por período, quando a falha é conflito de horário. */
  conflicts?: string[];
}

/** Converte o corpo da requisição em períodos já rotulados, ou devolve o erro. */
export function parsePeriods(raw: unknown): ParsedPeriod[] | AdminFailure {
  if (!Array.isArray(raw)) {
    return { status: 400, error: 'Envie a lista de períodos do campeonato.' };
  }
  if (raw.length > MAX_TOURNAMENT_PERIODS) {
    return {
      status: 400,
      error: `Um campeonato pode ter no máximo ${MAX_TOURNAMENT_PERIODS} períodos.`,
    };
  }

  const periods: ParsedPeriod[] = [];
  for (const item of raw) {
    const startAtISO = (item as { startAtISO?: unknown })?.startAtISO;
    const endAtISO = (item as { endAtISO?: unknown })?.endAtISO;
    if (typeof startAtISO !== 'string' || typeof endAtISO !== 'string') {
      return { status: 400, error: 'Período sem horário de início ou término.' };
    }
    const startAt = new Date(startAtISO);
    const endAt = new Date(endAtISO);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return { status: 400, error: 'Período com data ou horário inválido.' };
    }
    periods.push({ startAt, endAt, label: describePeriod(startAt, endAt) });
  }

  const invalid = validatePeriods(periods);
  if (invalid) return { status: 400, error: invalid };

  return periods.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** Nome válido do campeonato, ou o erro pronto para responder. */
export function parseTournamentName(raw: unknown): string | AdminFailure {
  const name = sanitizeTournamentName(raw);
  if (!name) {
    return { status: 400, error: 'Dê um nome ao campeonato (entre 2 e 60 caracteres).' };
  }
  return name;
}

/**
 * Só chefe da quadra (ou o desenvolvedor) mexe em campeonato. A checagem é feita
 * aqui no servidor porque as rotas recebem o userId pelo corpo da requisição.
 */
export async function ensureCourtManager(
  userId: unknown,
  courtId: string
): Promise<{ userId: string } | AdminFailure> {
  if (typeof userId !== 'string' || !userId.trim()) {
    return { status: 400, error: 'Usuário não identificado. Faça login novamente.' };
  }
  const uid = userId.trim();

  const [courtSnap, userSnap] = await Promise.all([
    adminDb.collection('courts').doc(courtId).get(),
    adminDb.collection('users').doc(uid).get(),
  ]);

  const managerIds: string[] = courtSnap.exists ? (courtSnap.data()?.managerIds ?? []) : [];
  const email: string | undefined = userSnap.data()?.email;

  if (!canManageCourt(uid, email, managerIds)) {
    return { status: 403, error: 'Só o chefe desta quadra pode gerenciar campeonatos.' };
  }
  return { userId: uid };
}

/** Quadra válida vinda do corpo da requisição. */
export function parseCourtId(raw: unknown): string | AdminFailure {
  if (typeof raw !== 'string' || !isCourtId(raw)) {
    return { status: 400, error: 'Quadra inválida.' };
  }
  return raw;
}

/**
 * Procura reservas que impedem os períodos pedidos.
 *
 * Faz uma única consulta cobrindo do primeiro ao último período e cruza tudo em
 * memória — um campeonato de fim de semana inteiro custa uma leitura, não uma
 * por período. Reservas do próprio campeonato são ignoradas, senão editar um
 * período conflitaria com ele mesmo.
 */
export async function findPeriodConflicts(
  courtId: string,
  periods: ParsedPeriod[],
  excludeTournamentId?: string
): Promise<string[]> {
  if (periods.length === 0) return [];

  const normalizedCourtId = normalizeCourtId(courtId);
  const minStart = new Date(Math.min(...periods.map((p) => p.startAt.getTime())));
  const maxEnd = new Date(Math.max(...periods.map((p) => p.endAt.getTime())));

  const snap = await adminDb
    .collection('reservations')
    .where('startAt', '<', Timestamp.fromDate(maxEnd))
    .where('endAt', '>', Timestamp.fromDate(minStart))
    .get();

  const conflicts: string[] = [];

  for (const period of periods) {
    for (const doc of snap.docs) {
      const data = doc.data();
      if (normalizeCourtId(data.courtId) !== normalizedCourtId) continue;
      if (excludeTournamentId && data.tournamentId === excludeTournamentId) continue;

      const start = data.startAt?.toDate?.();
      const end = data.endAt?.toDate?.();
      if (!start || !end) continue;
      if (start >= period.endAt || end <= period.startAt) continue;

      const participantNames = data.type
        ? []
        : await fetchParticipantNames(doc.id);

      conflicts.push(
        `${period.label} (${formatZonedDateTime(period.startAt)}): ` +
          formatConflictMessage(
            {
              startAt: start,
              endAt: end,
              type: data.type,
              tournamentName: data.tournamentName,
            },
            participantNames
          )
      );
      break; // um conflito por período já explica o problema
    }
  }

  return conflicts;
}

async function fetchParticipantNames(reservationId: string): Promise<string[]> {
  const snap = await adminDb
    .collection('reservationParticipants')
    .where('reservationId', '==', reservationId)
    .get();

  const names: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.guestName) {
      names.push(String(data.guestName));
    } else if (data.userId) {
      const user = await adminDb.collection('users').doc(data.userId).get();
      names.push(user.exists ? (user.data()?.firstName ?? 'Jogador') : 'Jogador');
    }
  }
  return names;
}

/**
 * Regrava os blocos do campeonato: apaga os antigos e cria os novos num único
 * batch. Nada aponta para o id dessas reservas (não têm participante nem
 * desafio), então recriar sai mais barato e mais seguro que fazer diff.
 */
export async function replaceTournamentPeriods(params: {
  tournamentId: string;
  tournamentName: string;
  courtId: string;
  createdById: string;
  periods: ParsedPeriod[];
}): Promise<void> {
  const { tournamentId, tournamentName, courtId, createdById, periods } = params;

  const existing = await adminDb
    .collection('reservations')
    .where('tournamentId', '==', tournamentId)
    .get();

  const batch = adminDb.batch();
  existing.docs.forEach((doc) => batch.delete(doc.ref));

  const createdAt = Timestamp.now();
  for (const period of periods) {
    batch.set(adminDb.collection('reservations').doc(), {
      startAt: Timestamp.fromDate(period.startAt),
      endAt: Timestamp.fromDate(period.endAt),
      createdById,
      createdAt,
      courtId,
      type: TOURNAMENT_RESERVATION_TYPE,
      tournamentId,
      tournamentName,
      periodLabel: period.label,
    });
  }

  await batch.commit();
}

/** Apaga o campeonato e todos os blocos que ele ocupava na agenda. */
export async function deleteTournamentWithPeriods(tournamentId: string): Promise<void> {
  const existing = await adminDb
    .collection('reservations')
    .where('tournamentId', '==', tournamentId)
    .get();

  const batch = adminDb.batch();
  existing.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(adminDb.collection('tournaments').doc(tournamentId));
  await batch.commit();
}

export function isFailure(value: unknown): value is AdminFailure {
  return typeof value === 'object' && value !== null && 'status' in value && 'error' in value;
}
