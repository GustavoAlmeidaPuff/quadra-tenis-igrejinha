import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, hasAdminCredentials } from '@/lib/firebase/admin';
import { isPlayedReservation } from '@/lib/tournaments';

/**
 * Job diário que pré-calcula o ranking de horas jogadas.
 *
 * Os dois clientes (web e app nativo) só leem `rankings/hours`; ninguém mais
 * calcula em tempo real a não ser como fallback. Ver `src/lib/ranking.ts` e
 * `quadra-livre-app/lib/ranking.ts`.
 *
 * Roda pela Vercel Cron (ver vercel.json). Também pode ser chamado à mão para
 * forçar uma atualização — mesma proteção de CRON_SECRET.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Mesma constante de src/lib/queries/stats.ts — toda reserva conta como 1h30 jogada. */
const RESERVATION_DURATION_HOURS = 1.5;

/** Firestore rejeita documento acima de 1 MiB; 150 jogadores cabem folgado, mas o teto protege. */
const MAX_ENTRIES = 500;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Sem segredo configurado a rota fica aberta só em dev; em produção, bloqueia.
  if (!secret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function buildRanking() {
  const [usersSnap, reservationsSnap, participantsSnap] = await Promise.all([
    adminDb.collection('users').get(),
    adminDb.collection('reservations').get(),
    adminDb.collection('reservationParticipants').get(),
  ]);

  const now = Date.now();

  // Reservas que já aconteceram e são jogo de verdade. Blocos 'organizing' do
  // "Quem anima?" e blocos de campeonato moram na mesma coleção e não podem
  // virar horas jogadas de quem os criou.
  const playedReservations = new Map<string, { createdById: string }>();
  for (const d of reservationsSnap.docs) {
    const data = d.data();
    if (!isPlayedReservation(data)) continue;
    const endAt = data.endAt?.toDate?.();
    if (!endAt || endAt.getTime() > now) continue;
    playedReservations.set(d.id, { createdById: data.createdById ?? '' });
  }

  // userId -> ids de reservas, como Set porque quem criou também é participante.
  const byUser = new Map<string, Set<string>>();
  const add = (userId: string, reservationId: string) => {
    if (!userId) return;
    const set = byUser.get(userId);
    if (set) set.add(reservationId);
    else byUser.set(userId, new Set([reservationId]));
  };

  for (const [reservationId, r] of playedReservations) {
    add(r.createdById, reservationId);
  }
  for (const d of participantsSnap.docs) {
    const data = d.data();
    const reservationId = data.reservationId;
    if (!reservationId || !playedReservations.has(reservationId)) continue;
    add(data.userId, reservationId);
  }

  return usersSnap.docs
    .filter((userDoc) => userDoc.data()?.isAnonymous !== true)
    .map((userDoc) => {
      const user = userDoc.data();
      const count = byUser.get(userDoc.id)?.size ?? 0;
      const firstName = typeof user?.firstName === 'string' ? user.firstName : '';
      const lastName = typeof user?.lastName === 'string' ? user.lastName : '';
      const createdAt = user?.createdAt?.toDate?.() ?? new Date(0);
      return {
        id: userDoc.id,
        firstName,
        lastName,
        // Cada cliente prefere derivar as iniciais de firstName/lastName; isto é só fallback.
        initials: `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase(),
        name: `${firstName} ${lastName}`.trim() || 'Jogador',
        pictureUrl: typeof user?.pictureUrl === 'string' ? user.pictureUrl : null,
        hours: Math.round(count * RESERVATION_DURATION_HOURS * 10) / 10,
        createdAt,
      };
    })
    .sort((a, b) =>
      b.hours !== a.hours ? b.hours - a.hours : a.createdAt.getTime() - b.createdAt.getTime()
    )
    .slice(0, MAX_ENTRIES);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  if (!hasAdminCredentials) {
    return NextResponse.json(
      { error: 'Servidor não configurado: chave de conta de serviço do Firebase não definida.' },
      { status: 503 }
    );
  }

  try {
    const entries = await buildRanking();
    await adminDb
      .collection('rankings')
      .doc('hours')
      .set({ entries, computedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ ok: true, count: entries.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao calcular ranking';
    console.error('Erro cron/ranking:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
