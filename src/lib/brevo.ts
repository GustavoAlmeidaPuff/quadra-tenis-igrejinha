/**
 * Integração Brevo para envio de emails transacionais.
 * Configure BREVO_API_KEY em .env.local (e na Vercel para produção).
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export interface ChallengeEmailParams {
  toEmail: string;
  toName: string;
  fromUserName: string;
  fromUserPictureUrl: string | null;
  notificationsUrl: string;
  proposedStartAt?: Date | null;
}

function buildChallengeEmailHtml(params: ChallengeEmailParams): string {
  const { fromUserName, fromUserPictureUrl, notificationsUrl, proposedStartAt } = params;
  const dateTimeHtml =
    proposedStartAt && !Number.isNaN(proposedStartAt.getTime())
      ? `
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(
                proposedStartAt
                  .toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                  .replace(/^\w/, (c) => c.toUpperCase())
              )}</p>
              <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#059669;">às ${escapeHtml(
                proposedStartAt.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              )}</p>`
      : '';
  const initial = escapeHtml(fromUserName.charAt(0).toUpperCase());
  const avatarHtml = fromUserPictureUrl
    ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr><td align="center"><img src="${escapeHtml(fromUserPictureUrl)}" alt="" width="80" height="80" border="0" style="width:80px;height:80px;max-width:80px;border-radius:50%;object-fit:cover;display:block;border:2px solid #e5e7eb;" /></td></tr></table>`
    : `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr><td align="center"><div style="width:80px;height:80px;border-radius:50%;background:#059669;color:#fff;font-size:28px;font-weight:700;line-height:80px;text-align:center;margin:0 auto;">${initial}</div></td></tr></table>`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Novo desafio</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:400px;background:#fff;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;">
          <tr>
            <td style="padding:32px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#059669;font-weight:600;">Quadra de Tênis - Igrejinha</p>
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827;">Você recebeu um desafio!</h1>
              ${avatarHtml}
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(fromUserName)}</p>
              <p style="margin:0 0 16px;font-size:15px;color:#6b7280;">te desafiou para um jogo na quadra.</p>
              ${dateTimeHtml}
              <a href="${escapeHtml(notificationsUrl)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;margin-top:8px;">Ver notificação e aceitar</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Este email foi enviado pelo app Quadra de Tênis - Igrejinha.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

export async function sendChallengeNotificationEmail(
  params: ChallengeEmailParams
): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'BREVO_API_KEY não configurada' };
  }

  const senderEmail = (process.env.BREVO_SENDER_EMAIL ?? '').trim();
  const senderName = (process.env.BREVO_SENDER_NAME ?? '').trim();
  if (!senderEmail) {
    return {
      success: false,
      error:
        'BREVO_SENDER_EMAIL não configurado. Defina no .env.local um email de remetente verificado no Brevo (ex.: gustavo@matheus.digital).',
    };
  }

  const htmlContent = buildChallengeEmailHtml(params);

  const body = {
    sender: {
      email: senderEmail,
      name: senderName || 'Quadra Tênis - Igrejinha',
    },
    to: [{ email: params.toEmail, name: params.toName }],
    subject: `${params.fromUserName} te desafiou! 🎾`,
    htmlContent,
  };

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey.trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMessage = `Brevo retornou ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson?.message) errMessage = errJson.message;
    } catch {
      if (errText) errMessage = errText.slice(0, 200);
    }
    return { success: false, error: errMessage };
  }

  const data = (await res.json()) as { messageId?: string };
  return { success: true, messageId: data.messageId ?? '' };
}

// --- Email de confirmação de reserva ---

export interface ReservationConfirmationEmailParams {
  toEmail: string;
  toName: string;
  startAt: Date;
  reservarUrl: string;
}

function buildReservationConfirmationEmailHtml(
  params: ReservationConfirmationEmailParams
): string {
  const { toName, startAt, reservarUrl } = params;
  const dateStr = startAt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = startAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reserva confirmada</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:400px;background:#fff;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;">
          <tr>
            <td style="padding:32px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#059669;font-weight:600;">Quadra de Tênis - Igrejinha</p>
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827;">Deu boa! 🎉<br> Seu horário está marcado! 🎾</h1>
              <div style="width:80px;height:80px;border-radius:50%;background:#059669;color:#fff;font-size:32px;line-height:80px;text-align:center;margin:0 auto 20px;">✓</div>
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(
                dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
              )}</p>
              <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#059669;">às ${escapeHtml(timeStr)}</p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Bora jogar! A quadra está reservada para você.</p>
              <a href="${escapeHtml(reservarUrl)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;margin-top:8px;">Ver minhas reservas</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Este email foi enviado pelo app Quadra de Tênis - Igrejinha.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

export async function sendReservationConfirmationEmail(
  params: ReservationConfirmationEmailParams
): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'BREVO_API_KEY não configurada' };
  }

  const senderEmail = (process.env.BREVO_SENDER_EMAIL ?? '').trim();
  const senderName = (process.env.BREVO_SENDER_NAME ?? '').trim();
  if (!senderEmail) {
    return {
      success: false,
      error:
        'BREVO_SENDER_EMAIL não configurado. Defina no .env.local um email de remetente verificado no Brevo.',
    };
  }

  const htmlContent = buildReservationConfirmationEmailHtml(params);

  const body = {
    sender: {
      email: senderEmail,
      name: senderName || 'Quadra Tênis - Igrejinha',
    },
    to: [{ email: params.toEmail, name: params.toName }],
    subject: 'Reserva confirmada! 🎾 Seu horário tá marcado',
    htmlContent,
  };

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey.trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMessage = `Brevo retornou ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson?.message) errMessage = errJson.message;
    } catch {
      if (errText) errMessage = errText.slice(0, 200);
    }
    return { success: false, error: errMessage };
  }

  const data = (await res.json()) as { messageId?: string };
  return { success: true, messageId: data.messageId ?? '' };
}

// --- Email para participantes adicionados à reserva ---

export interface ParticipantAddedEmailParams {
  toEmail: string;
  toName: string;
  creatorName: string;
  startAt: Date;
  reservarUrl: string;
}

function buildParticipantAddedEmailHtml(params: ParticipantAddedEmailParams): string {
  const { creatorName, startAt, reservarUrl } = params;
  const dateStr = startAt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = startAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Te adicionaram em uma reserva</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:400px;background:#fff;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;">
          <tr>
            <td style="padding:32px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#059669;font-weight:600;">Quadra de Tênis - Igrejinha</p>
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827;line-height:1.4;">Deu boa! 🎉<br><span style="font-weight:600;color:#059669;">${escapeHtml(creatorName)}</span> reservou a quadra pra vocês! 🤝</h1>
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(
                dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
              )}</p>
              <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#059669;">às ${escapeHtml(timeStr)}</p>
              <a href="${escapeHtml(reservarUrl)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;margin-top:8px;">Ver reserva</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Este email foi enviado pelo app Quadra de Tênis - Igrejinha.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

export async function sendParticipantAddedEmail(
  params: ParticipantAddedEmailParams
): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'BREVO_API_KEY não configurada' };
  }

  const senderEmail = (process.env.BREVO_SENDER_EMAIL ?? '').trim();
  const senderName = (process.env.BREVO_SENDER_NAME ?? '').trim();
  if (!senderEmail) {
    return {
      success: false,
      error:
        'BREVO_SENDER_EMAIL não configurado. Defina no .env.local um email de remetente verificado no Brevo.',
    };
  }

  const htmlContent = buildParticipantAddedEmailHtml(params);

  const body = {
    sender: {
      email: senderEmail,
      name: senderName || 'Quadra Tênis - Igrejinha',
    },
    to: [{ email: params.toEmail, name: params.toName }],
    subject: `${params.creatorName} te adicionou numa reserva! 🎾`,
    htmlContent,
  };

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey.trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMessage = `Brevo retornou ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson?.message) errMessage = errJson.message;
    } catch {
      if (errText) errMessage = errText.slice(0, 200);
    }
    return { success: false, error: errMessage };
  }

  const data = (await res.json()) as { messageId?: string };
  return { success: true, messageId: data.messageId ?? '' };
}

// --- Email quando adversário aceita desafio e marca horário ---

export interface ChallengeAcceptedEmailParams {
  toEmail: string;
  toName: string;
  accepterName: string;
  startAt: Date;
  reservarUrl: string;
}

function buildChallengeAcceptedEmailHtml(params: ChallengeAcceptedEmailParams): string {
  const { accepterName, startAt, reservarUrl } = params;
  const dateStr = startAt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = startAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Desafio aceito!</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:400px;background:#fff;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;">
          <tr>
            <td style="padding:32px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#059669;font-weight:600;">Quadra de Tênis - Igrejinha</p>
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827;line-height:1.4;">Seu desafio foi aceito! 🎾</h1>
              <p style="margin:0 0 16px;font-size:18px;color:#111827;"><strong style="color:#059669;">${escapeHtml(accepterName)}</strong> aceitou e marcou a quadra pra vocês!</p>
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(
                dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
              )}</p>
              <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#059669;">às ${escapeHtml(timeStr)}</p>
              <a href="${escapeHtml(reservarUrl)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;margin-top:8px;">Ver reserva</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Este email foi enviado pelo app Quadra de Tênis - Igrejinha.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

export async function sendChallengeAcceptedEmail(
  params: ChallengeAcceptedEmailParams
): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'BREVO_API_KEY não configurada' };
  }

  const senderEmail = (process.env.BREVO_SENDER_EMAIL ?? '').trim();
  const senderName = (process.env.BREVO_SENDER_NAME ?? '').trim();
  if (!senderEmail) {
    return {
      success: false,
      error:
        'BREVO_SENDER_EMAIL não configurado. Defina no .env.local um email de remetente verificado no Brevo.',
    };
  }

  const htmlContent = buildChallengeAcceptedEmailHtml(params);

  const body = {
    sender: {
      email: senderEmail,
      name: senderName || 'Quadra Tênis - Igrejinha',
    },
    to: [{ email: params.toEmail, name: params.toName }],
    subject: `${params.accepterName} aceitou seu desafio! 🎾`,
    htmlContent,
  };

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey.trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMessage = `Brevo retornou ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson?.message) errMessage = errJson.message;
    } catch {
      if (errText) errMessage = errText.slice(0, 200);
    }
    return { success: false, error: errMessage };
  }

  const data = (await res.json()) as { messageId?: string };
  return { success: true, messageId: data.messageId ?? '' };
}
