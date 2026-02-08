import { NextRequest, NextResponse } from 'next/server';
import { adminDb, hasAdminCredentials } from '@/lib/firebase/admin';
import { validateReservation } from '@/lib/validators/reservationValidator';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  if (!hasAdminCredentials) {
    return NextResponse.json(
      {
        error:
          'Servidor não configurado: chave de conta de serviço do Firebase não definida. Adicione FIREBASE_SERVICE_ACCOUNT_PATH ou FIREBASE_SERVICE_ACCOUNT_KEY no .env.local (veja o README).',
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { userId, date, hour, minute, participantIds } = body;

    const hourNum = typeof hour === 'number' ? hour : parseInt(String(hour), 10);
    const minuteNum = typeof minute === 'number' ? minute : parseInt(String(minute), 10);

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return NextResponse.json(
        { error: 'Usuário não identificado. Faça login novamente.' },
        { status: 400 }
      );
    }
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      return NextResponse.json(
        { error: 'Data inválida. Selecione uma data no formato ano-mês-dia.' },
        { status: 400 }
      );
    }
    if (Number.isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
      return NextResponse.json(
        { error: 'Horário inválido. Hora deve ser entre 0 e 23.' },
        { status: 400 }
      );
    }
    if (Number.isNaN(minuteNum) || minuteNum < 0 || minuteNum > 59) {
      return NextResponse.json(
        { error: 'Minuto inválido. Deve ser entre 0 e 59.' },
        { status: 400 }
      );
    }

    // Construir datas no fuso local (evita UTC que mudava o dia)
    const [y, m, d] = date.trim().split('-').map(Number);
    const startAt = new Date(y, m - 1, d, hourNum, minuteNum, 0, 0);
    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + 90);

    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json(
        { error: 'Data/horário resultante inválido.' },
        { status: 400 }
      );
    }

    // Validar reserva
    const validation = await validateReservation(userId, startAt, endAt);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error?.message, details: validation.error },
        { status: 400 }
      );
    }

    // Criar reserva
    const reservationRef = await adminDb.collection('reservations').add({
      startAt: Timestamp.fromDate(startAt),
      endAt: Timestamp.fromDate(endAt),
      createdById: userId,
      createdAt: Timestamp.now(),
    });

    // Adicionar criador como participante
    await adminDb.collection('reservationParticipants').add({
      reservationId: reservationRef.id,
      userId: userId,
      order: 0,
    });

    // Adicionar outros participantes
    if (participantIds && Array.isArray(participantIds)) {
      for (let i = 0; i < participantIds.length; i++) {
        await adminDb.collection('reservationParticipants').add({
          reservationId: reservationRef.id,
          userId: participantIds[i],
          order: i + 1,
        });
      }
    }

    return NextResponse.json({
      success: true,
      reservationId: reservationRef.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar reserva';
    console.error('Erro ao criar reserva:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!reservationId || !userId) {
      return NextResponse.json(
        { error: 'ID da reserva e userId são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o usuário é o criador
    const reservationDoc = await adminDb.collection('reservations').doc(reservationId).get();
    
    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: 'Reserva não encontrada' },
        { status: 404 }
      );
    }

    const reservationData = reservationDoc.data();
    if (reservationData?.createdById !== userId) {
      return NextResponse.json(
        { error: 'Apenas o criador pode cancelar a reserva' },
        { status: 403 }
      );
    }

    // Verificar se é futura
    const now = new Date();
    const startAt = reservationData.startAt.toDate();
    
    if (startAt < now) {
      return NextResponse.json(
        { error: 'Não é possível cancelar reservas passadas' },
        { status: 400 }
      );
    }

    // Deletar participantes
    const participants = await adminDb
      .collection('reservationParticipants')
      .where('reservationId', '==', reservationId)
      .get();

    const batch = adminDb.batch();
    participants.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Deletar reserva
    batch.delete(reservationDoc.ref);
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao cancelar reserva';
    console.error('Erro ao cancelar reserva:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
