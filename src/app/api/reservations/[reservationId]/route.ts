import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, hasAdminCredentials } from '@/lib/firebase/admin';
import { sendParticipantAddedEmail } from '@/lib/brevo';

const APP_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://teniscreas.vercel.app';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ reservationId: string }> }
) {
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
    const { reservationId } = await context.params;
    if (!reservationId?.trim()) {
      return NextResponse.json(
        { error: 'ID da reserva é obrigatório' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { userId, participantIds, startAtISO } = body;

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
    const participantsSnap = await adminDb
      .collection('reservationParticipants')
      .where('reservationId', '==', reservationId.trim())
      .get();

    const isParticipant = participantsSnap.docs.some((d) => d.data().userId === userId);
    if (!isParticipant) {
      return NextResponse.json(
        { error: 'Apenas participantes da reserva podem editar.' },
        { status: 403 }
      );
    }

    const currentEndAt = reservationData?.endAt?.toDate?.() ?? new Date(0);
    if (currentEndAt <= new Date()) {
      return NextResponse.json(
        { error: 'Não é possível editar reservas já encerradas.' },
        { status: 400 }
      );
    }

    let startAt: Date;
    if (typeof startAtISO === 'string' && startAtISO.trim()) {
      const newStartAt = new Date(startAtISO.trim());
      if (Number.isNaN(newStartAt.getTime())) {
        return NextResponse.json(
          { error: 'Data/horário inválido.' },
          { status: 400 }
        );
      }
      const newEndAt = new Date(newStartAt.getTime() + 90 * 60 * 1000);
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() + 6);
      maxDate.setHours(23, 59, 59, 999);
      if (newStartAt < now) {
        return NextResponse.json(
          { error: 'Não é possível agendar reserva no passado.' },
          { status: 400 }
        );
      }
      if (newStartAt < today || newStartAt > maxDate) {
        return NextResponse.json(
          { error: 'Reservas disponíveis apenas para os próximos 7 dias.' },
          { status: 400 }
        );
      }
      const startTs = Timestamp.fromDate(newStartAt);
      const endTs = Timestamp.fromDate(newEndAt);
      const conflicting = await adminDb
        .collection('reservations')
        .where('startAt', '<', endTs)
        .where('endAt', '>', startTs)
        .get();
      const conflictDoc = conflicting.docs.find((doc) => doc.id !== reservationId.trim());
      if (conflictDoc) {
        const conflictData = conflictDoc.data();
        const participants = await adminDb
          .collection('reservationParticipants')
          .where('reservationId', '==', conflictDoc.id)
          .get();
        const names: string[] = [];
        for (const p of participants.docs) {
          const u = await adminDb.collection('users').doc(p.data().userId).get();
          names.push(u.exists ? (u.data()?.firstName ?? 'Jogador') : 'Jogador');
        }
        const namesText = names.join(' e ');
        const verb = names.length === 1 ? 'vai jogar' : 'vão jogar';
        const startStr = conflictData.startAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const endStr = conflictData.endAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return NextResponse.json(
          { error: `${namesText} ${verb} das ${startStr} às ${endStr}, tente outro horário.` },
          { status: 400 }
        );
      }
      await reservationRef.update({
        startAt: startTs,
        endAt: endTs,
      });
      startAt = newStartAt;
    } else {
      startAt = reservationData?.startAt?.toDate?.() ?? new Date();
    }

    const ids = Array.isArray(participantIds) ? participantIds : [];
    const batch = adminDb.batch();
    participantsSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    await adminDb.collection('reservationParticipants').add({
      reservationId: reservationId.trim(),
      userId,
      order: 0,
    });

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
