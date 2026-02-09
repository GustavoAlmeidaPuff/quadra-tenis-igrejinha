import { NextRequest, NextResponse } from 'next/server';
import { adminDb, hasAdminCredentials } from '@/lib/firebase/admin';
import { validateReservation } from '@/lib/validators/reservationValidator';
import { sendReservationConfirmationEmail, sendParticipantAddedEmail, sendChallengeAcceptedEmail } from '@/lib/brevo';
import { Timestamp } from 'firebase-admin/firestore';

const APP_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://teniscreas.vercel.app';

export async function POST(request: NextRequest) {
  if (!hasAdminCredentials) {
    return NextResponse.json(
      {
        error:
          'Servidor não configurado: chave de conta de serviço do Firebase não definida. Adicione FIREBASE_SERVICE_ACCOUNT_KEY ou FIREBASE_SERVICE_ACCOUNT_PATH (local) nas variáveis de ambiente.',
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { userId, startAtISO, date, hour, minute, participantIds, challengeId } = body;

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return NextResponse.json(
        { error: 'Usuário não identificado. Faça login novamente.' },
        { status: 400 }
      );
    }

    let startAt: Date;

    if (startAtISO && typeof startAtISO === 'string') {
      startAt = new Date(startAtISO);
    } else if (date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      const hourNum = typeof hour === 'number' ? hour : parseInt(String(hour), 10);
      const minuteNum = typeof minute === 'number' ? minute : parseInt(String(minute), 10);
      if (Number.isNaN(hourNum) || hourNum < 0 || hourNum > 23 || Number.isNaN(minuteNum) || minuteNum < 0 || minuteNum > 59) {
        return NextResponse.json(
          { error: 'Horário inválido. Hora (0–23) e minuto (0–59) são obrigatórios.' },
          { status: 400 }
        );
      }
      const [y, m, d] = date.trim().split('-').map(Number);
      startAt = new Date(y, m - 1, d, hourNum, minuteNum, 0, 0);
    } else {
      return NextResponse.json(
        { error: 'Envie o horário de início: startAtISO (recomendado) ou date + hour + minute.' },
        { status: 400 }
      );
    }

    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json(
        { error: 'Data/horário de início inválido.' },
        { status: 400 }
      );
    }

    const endAt = new Date(startAt.getTime() + 90 * 60 * 1000);

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

    // Quando é aceite de desafio, quem desafiou (fromUserId) recebe "desafio aceito", não "te adicionou"
    let challengerUserId: string | null = null;
    if (challengeId && typeof challengeId === 'string' && challengeId.trim()) {
      const challengeSnap = await adminDb.collection('challenges').doc(challengeId.trim()).get();
      if (challengeSnap.exists) {
        challengerUserId = challengeSnap.data()?.fromUserId ?? null;
      }
    }

    // Enviar email de confirmação ao criador (não bloqueia a resposta em caso de falha)
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const userData = userSnap.data();
    const userEmail = typeof userData?.email === 'string' ? userData.email.trim() : '';
    const creatorName = `${userData?.firstName ?? ''} ${userData?.lastName ?? ''}`.trim() || 'Jogador';
    if (userEmail) {
      sendReservationConfirmationEmail({
        toEmail: userEmail,
        toName: creatorName,
        startAt,
        reservarUrl: `${APP_BASE_URL}/reservar`,
      }).catch((err) => console.error('Erro ao enviar email de confirmação da reserva:', err));
    }

    // Enviar email aos participantes adicionados (exceto quem desafiou em caso de aceite de desafio)
    if (participantIds && Array.isArray(participantIds)) {
      const reservarUrl = `${APP_BASE_URL}/reservar`;
      for (const pId of participantIds) {
        if (challengerUserId && pId === challengerUserId) continue; // já recebe "desafio aceito"
        const pSnap = await adminDb.collection('users').doc(pId).get();
        const pData = pSnap.data();
        const pEmail = typeof pData?.email === 'string' ? pData.email.trim() : '';
        if (pEmail) {
          const pName = `${pData?.firstName ?? ''} ${pData?.lastName ?? ''}`.trim() || 'Jogador';
          sendParticipantAddedEmail({
            toEmail: pEmail,
            toName: pName,
            creatorName,
            startAt,
            reservarUrl,
          }).catch((err) => console.error('Erro ao enviar email para participante:', err));
        }
      }
    }

    // Enviar email para quem desafiou quando adversário aceita e marca horário
    if (challengerUserId) {
      const challengerSnap = await adminDb.collection('users').doc(challengerUserId).get();
      const challengerData = challengerSnap.data();
      const challengerEmail = typeof challengerData?.email === 'string' ? challengerData.email.trim() : '';
      if (challengerEmail) {
        const challengerName = `${challengerData?.firstName ?? ''} ${challengerData?.lastName ?? ''}`.trim() || 'Jogador';
        sendChallengeAcceptedEmail({
          toEmail: challengerEmail,
          toName: challengerName,
          accepterName: creatorName,
          startAt,
          reservarUrl: `${APP_BASE_URL}/reservar`,
        }).catch((err) => console.error('Erro ao enviar email de desafio aceito:', err));
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
  if (!hasAdminCredentials) {
    return NextResponse.json(
      {
        error:
          'Servidor não configurado: chave de conta de serviço do Firebase não definida.',
      },
      { status: 503 }
    );
  }

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

    const reservationDoc = await adminDb.collection('reservations').doc(reservationId).get();

    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: 'Reserva não encontrada' },
        { status: 404 }
      );
    }

    const reservationData = reservationDoc.data();
    if (!reservationData?.startAt || !reservationData?.endAt) {
      return NextResponse.json(
        { error: 'Reserva inválida' },
        { status: 400 }
      );
    }

    // Qualquer participante da reserva pode cancelar
    const participants = await adminDb
      .collection('reservationParticipants')
      .where('reservationId', '==', reservationId)
      .get();

    const isParticipant = participants.docs.some((d) => d.data().userId === userId);
    if (!isParticipant) {
      return NextResponse.json(
        { error: 'Apenas participantes da reserva podem cancelá-la.' },
        { status: 403 }
      );
    }

    // Permitir cancelar se a reserva ainda não terminou (futuras ou em andamento)
    const now = new Date();
    const endAt = reservationData.endAt.toDate();

    if (endAt <= now) {
      return NextResponse.json(
        { error: 'Não é possível cancelar reservas que já terminaram' },
        { status: 400 }
      );
    }

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
