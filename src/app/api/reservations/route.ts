import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { validateReservation } from '@/lib/validators/reservationValidator';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const { userId, date, hour, minute, participantIds } = await request.json();

    if (!userId || !date || hour === undefined || minute === undefined) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Construir datas no fuso local (evita UTC que mudava o dia)
    const [y, m, d] = date.split('-').map(Number);
    const startAt = new Date(y, m - 1, d, hour, minute, 0, 0);
    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + 90);

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
