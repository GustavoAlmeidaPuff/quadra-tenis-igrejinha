import { NextRequest, NextResponse } from 'next/server';
import { adminDb, hasAdminCredentials } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { normalizeCourtId } from '@/lib/courts';

/**
 * Verifica se um horário está livre para reserva (sem conflitos).
 * GET /api/reservations/check-slot?startAtISO=...&courtId=quadra_1
 */
export async function GET(request: NextRequest) {
  if (!hasAdminCredentials) {
    return NextResponse.json(
      { available: false, error: 'Servidor não configurado.' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const startAtISO = searchParams.get('startAtISO');
    const courtId = normalizeCourtId(searchParams.get('courtId'));

    if (!startAtISO || typeof startAtISO !== 'string') {
      return NextResponse.json(
        { available: false, error: 'startAtISO é obrigatório.' },
        { status: 400 }
      );
    }

    const startAt = new Date(startAtISO);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json(
        { available: false, error: 'Data/horário inválido.' },
        { status: 400 }
      );
    }

    const endAt = new Date(startAt.getTime() + 90 * 60 * 1000);

    // 1. Janela de 7 dias
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 6);
    maxDate.setHours(23, 59, 59, 999);

    if (startAt < today || startAt > maxDate) {
      return NextResponse.json({
        available: false,
        error: 'Reservas disponíveis apenas para os próximos 7 dias.',
      });
    }

    // 2. Verificar conflitos na mesma quadra (filtro in-memory para backward compat)
    const startTimestamp = Timestamp.fromDate(startAt);
    const endTimestamp = Timestamp.fromDate(endAt);

    const conflictingSnap = await adminDb
      .collection('reservations')
      .where('startAt', '<', endTimestamp)
      .where('endAt', '>', startTimestamp)
      .get();

    const conflictDoc = conflictingSnap.docs.find((doc) => {
      const docCourtId = normalizeCourtId(doc.data().courtId);
      return docCourtId === courtId;
    });

    if (conflictDoc) {
      const conflict = conflictDoc.data();
      const participants = await adminDb
        .collection('reservationParticipants')
        .where('reservationId', '==', conflictDoc.id)
        .get();

      const participantNames: string[] = [];
      for (const p of participants.docs) {
        const d = p.data();
        if (d.userId) {
          const u = await adminDb.collection('users').doc(d.userId).get();
          participantNames.push(u.exists ? (u.data()?.firstName ?? 'Jogador') : 'Jogador');
        } else if (d.guestName) {
          participantNames.push(d.guestName);
        }
      }
      const namesText = participantNames.join(' e ');
      const verb = participantNames.length === 1 ? 'vai jogar' : 'vão jogar';
      const startStr = conflict.startAt.toDate().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const endStr = conflict.endAt.toDate().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return NextResponse.json({
        available: false,
        error: `${namesText} ${verb} das ${startStr} às ${endStr}, tente outro horário.`,
      });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error('Erro ao verificar slot:', error);
    return NextResponse.json(
      { available: false, error: 'Erro ao verificar disponibilidade.' },
      { status: 500 }
    );
  }
}
