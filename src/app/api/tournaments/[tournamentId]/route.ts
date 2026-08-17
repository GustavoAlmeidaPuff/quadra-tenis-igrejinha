import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, hasAdminCredentials } from '@/lib/firebase/admin';
import {
  deleteTournamentWithPeriods,
  ensureCourtManager,
  findPeriodConflicts,
  isFailure,
  parsePeriods,
  parseTournamentName,
  replaceTournamentPeriods,
  type ParsedPeriod,
} from '@/lib/tournamentsAdmin';

const NO_CREDENTIALS = {
  error:
    'Servidor não configurado: chave de conta de serviço do Firebase não definida.',
};

async function loadTournament(tournamentId: string) {
  const snap = await adminDb.collection('tournaments').doc(tournamentId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    ref: snap.ref,
    id: snap.id,
    name: String(data.name ?? ''),
    courtId: String(data.courtId ?? ''),
    createdById: String(data.createdById ?? ''),
  };
}

/**
 * Renomeia o campeonato e/ou regrava os períodos.
 * PATCH /api/tournaments/:id { userId, name?, periods? }
 *
 * O nome fica copiado dentro de cada reserva, então renomear reescreve os blocos
 * — é o que faz a agenda mostrar o nome novo sem leitura extra.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tournamentId: string }> }
) {
  if (!hasAdminCredentials) {
    return NextResponse.json(NO_CREDENTIALS, { status: 503 });
  }

  try {
    const { tournamentId } = await context.params;
    if (!tournamentId?.trim()) {
      return NextResponse.json({ error: 'ID do campeonato é obrigatório' }, { status: 400 });
    }

    const tournament = await loadTournament(tournamentId.trim());
    if (!tournament) {
      return NextResponse.json({ error: 'Campeonato não encontrado' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    const manager = await ensureCourtManager(body?.userId, tournament.courtId);
    if (isFailure(manager)) {
      return NextResponse.json({ error: manager.error }, { status: manager.status });
    }

    let name = tournament.name;
    if (body?.name !== undefined) {
      const parsed = parseTournamentName(body.name);
      if (isFailure(parsed)) {
        return NextResponse.json({ error: parsed.error }, { status: parsed.status });
      }
      name = parsed;
    }

    // Sem `periods` no corpo é só renomear: mantém os blocos onde estão.
    let periods: ParsedPeriod[] | null = null;
    if (body?.periods !== undefined) {
      const parsed = parsePeriods(body.periods);
      if (isFailure(parsed)) {
        return NextResponse.json({ error: parsed.error }, { status: parsed.status });
      }
      periods = parsed;
    }

    if (periods) {
      const conflicts = await findPeriodConflicts(tournament.courtId, periods, tournament.id);
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
    }

    await tournament.ref.update({ name, updatedAt: Timestamp.now() });

    if (periods) {
      await replaceTournamentPeriods({
        tournamentId: tournament.id,
        tournamentName: name,
        courtId: tournament.courtId,
        createdById: tournament.createdById || manager.userId,
        periods,
      });
    } else if (name !== tournament.name) {
      // Só o nome mudou: reescreve o rótulo dentro dos blocos já existentes.
      const blocks = await adminDb
        .collection('reservations')
        .where('tournamentId', '==', tournament.id)
        .get();
      const batch = adminDb.batch();
      blocks.docs.forEach((doc) => batch.update(doc.ref, { tournamentName: name }));
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar campeonato';
    console.error('Erro ao atualizar campeonato:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Apaga o campeonato e libera todos os horários que ele bloqueava. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ tournamentId: string }> }
) {
  if (!hasAdminCredentials) {
    return NextResponse.json(NO_CREDENTIALS, { status: 503 });
  }

  try {
    const { tournamentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!tournamentId?.trim()) {
      return NextResponse.json({ error: 'ID do campeonato é obrigatório' }, { status: 400 });
    }

    const tournament = await loadTournament(tournamentId.trim());
    if (!tournament) {
      return NextResponse.json({ error: 'Campeonato não encontrado' }, { status: 404 });
    }

    const manager = await ensureCourtManager(userId, tournament.courtId);
    if (isFailure(manager)) {
      return NextResponse.json({ error: manager.error }, { status: manager.status });
    }

    await deleteTournamentWithPeriods(tournament.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir campeonato';
    console.error('Erro ao excluir campeonato:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
