import { NextRequest, NextResponse } from 'next/server';
import { adminDb, hasAdminCredentials } from '@/lib/firebase/admin';
import { sendParticipantAddedEmail } from '@/lib/brevo';

const APP_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://teniscreas.vercel.app';

type RouteContext = { params: Promise<{ reservationId: string }> | { reservationId: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
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
    const { reservationId } = typeof params.then === 'function' ? await params : params;
    if (!reservationId?.trim()) {
      return NextResponse.json(
        { error: 'ID da reserva é obrigatório' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { userId, participantIds } = body;

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return NextResponse.json(
        { error: 'Usuário não identificado. Faça login novamente.' },
        { status: 400 }
      );
    }

    const reservationRef = adminDb.collection('reservations').doc(reservationId.trim());
    const reservationDoc = await reservationRef.get();

    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: 'Reserva não encontrada' },
        { status: 404 }
      );
    }

    const reservationData = reservationDoc.data();
    const participantsSnapCheck = await adminDb
      .collection('reservationParticipants')
      .where('reservationId', '==', reservationId.trim())
      .where('userId', '==', userId)
      .limit(1)
      .get();
    if (participantsSnapCheck.empty) {
      return NextResponse.json(
        { error: 'Apenas participantes da reserva podem editar.' },
        { status: 403 }
      );
    }

    const endAt = reservationData?.endAt?.toDate?.() ?? new Date(0);
    if (endAt <= new Date()) {
      return NextResponse.json(
        { error: 'Não é possível editar participantes de reservas já encerradas.' },
        { status: 400 }
      );
    }

    const participantsSnap = await adminDb
      .collection('reservationParticipants')
      .where('reservationId', '==', reservationId.trim())
      .get();

    const batch = adminDb.batch();
    participantsSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    await adminDb.collection('reservationParticipants').add({
      reservationId: reservationId.trim(),
      userId,
      order: 0,
    });

    const ids = Array.isArray(participantIds) ? participantIds : [];
    for (let i = 0; i < ids.length; i++) {
      const uid = ids[i];
      if (uid && typeof uid === 'string' && uid.trim() && uid !== userId) {
        await adminDb.collection('reservationParticipants').add({
          reservationId: reservationId.trim(),
          userId: uid.trim(),
          order: i + 1,
        });
      }
    }

    const startAt = reservationData?.startAt?.toDate?.() ?? new Date();
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const userData = userSnap.data();
    const creatorName = `${userData?.firstName ?? ''} ${userData?.lastName ?? ''}`.trim() || 'Jogador';

    for (const pId of ids) {
      if (!pId || pId === userId) continue;
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
          reservarUrl: `${APP_BASE_URL}/reservar`,
        }).catch((err) => console.error('Erro ao enviar email para participante:', err));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar participantes';
    console.error('Erro ao atualizar participantes da reserva:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
