import { NextRequest, NextResponse } from 'next/server';
import { adminDb, hasAdminCredentials } from '@/lib/firebase/admin';
import { sendChallengeNotificationEmail } from '@/lib/brevo';

const NOTIFICATIONS_URL = 'https://teniscreas.vercel.app/notificacoes';

export async function POST(request: NextRequest) {
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
    const body = await request.json().catch(() => ({}));
    const { fromUserId, toUserId, proposedStartAtISO } = body;

    if (!fromUserId || typeof fromUserId !== 'string' || !fromUserId.trim()) {
      return NextResponse.json(
        { error: 'fromUserId é obrigatório.' },
        { status: 400 }
      );
    }
    if (!toUserId || typeof toUserId !== 'string' || !toUserId.trim()) {
      return NextResponse.json(
        { error: 'toUserId é obrigatório.' },
        { status: 400 }
      );
    }

    const [fromSnap, toSnap] = await Promise.all([
      adminDb.collection('users').doc(fromUserId.trim()).get(),
      adminDb.collection('users').doc(toUserId.trim()).get(),
    ]);

    if (!fromSnap.exists) {
      return NextResponse.json(
        { error: 'Usuário que desafiou não encontrado.' },
        { status: 404 }
      );
    }
    if (!toSnap.exists) {
      return NextResponse.json(
        { error: 'Usuário desafiado não encontrado.' },
        { status: 404 }
      );
    }

    const fromData = fromSnap.data();
    const toData = toSnap.data();

    const fromUserName =
      `${fromData?.firstName ?? ''} ${fromData?.lastName ?? ''}`.trim() || 'Jogador';
    const fromUserPictureUrl =
      typeof fromData?.pictureUrl === 'string' ? fromData.pictureUrl : null;

    const toEmail = typeof toData?.email === 'string' ? toData.email.trim() : '';
    const toName =
      `${toData?.firstName ?? ''} ${toData?.lastName ?? ''}`.trim() || 'Jogador';

    if (!toEmail) {
      return NextResponse.json(
        { ok: true, skipped: 'Usuário desafiado não possui email (conta anônima).' },
        { status: 200 }
      );
    }

    const proposedStartAt =
      proposedStartAtISO && typeof proposedStartAtISO === 'string'
        ? new Date(proposedStartAtISO)
        : null;

    const result = await sendChallengeNotificationEmail({
      toEmail,
      toName,
      fromUserName,
      fromUserPictureUrl,
      notificationsUrl: NOTIFICATIONS_URL,
      proposedStartAt,
    });

    if (!result.success) {
      console.error('Brevo notify-challenge:', result.error);
      return NextResponse.json(
        { error: 'Falha ao enviar email de notificação.', details: result.error },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erro ao enviar notificação';
    console.error('Erro notify-challenge:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
