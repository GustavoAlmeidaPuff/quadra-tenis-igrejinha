import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, hasAdminCredentials } from '@/lib/firebase/admin';
import {
  ensureCourtManager,
  findPeriodConflicts,
  isFailure,
  parseCourtId,
  parsePeriods,
  parseTournamentName,
  replaceTournamentPeriods,
} from '@/lib/tournamentsAdmin';

const NO_CREDENTIALS = {
  error:
    'Servidor não configurado: chave de conta de serviço do Firebase não definida.',
};

/**
 * Cria um campeonato e bloqueia a quadra em cada período dele.
 * POST /api/tournaments { userId, courtId, name, periods: [{ startAtISO, endAtISO }] }
 */
export async function POST(request: NextRequest) {
  if (!hasAdminCredentials) {
    return NextResponse.json(NO_CREDENTIALS, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const courtId = parseCourtId(body?.courtId);
    if (isFailure(courtId)) {
      return NextResponse.json({ error: courtId.error }, { status: courtId.status });
    }

    const manager = await ensureCourtManager(body?.userId, courtId);
    if (isFailure(manager)) {
      return NextResponse.json({ error: manager.error }, { status: manager.status });
    }

    const name = parseTournamentName(body?.name);
    if (isFailure(name)) {
      return NextResponse.json({ error: name.error }, { status: name.status });
    }

    const periods = parsePeriods(body?.periods);
    if (isFailure(periods)) {
      return NextResponse.json({ error: periods.error }, { status: periods.status });
    }

    const conflicts = await findPeriodConflicts(courtId, periods);
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error:
            'Alguns períodos batem com reservas já existentes. Fale com os jogadores ou escolha outro horário.',
          conflicts,
        },
        { status: 409 }
      );
    }

    const tournamentRef = adminDb.collection('tournaments').doc();
    await tournamentRef.set({
      name,
      courtId,
      createdById: manager.userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await replaceTournamentPeriods({
      tournamentId: tournamentRef.id,
      tournamentName: name,
      courtId,
      createdById: manager.userId,
      periods,
    });

    return NextResponse.json({ success: true, tournamentId: tournamentRef.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar campeonato';
    console.error('Erro ao criar campeonato:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
