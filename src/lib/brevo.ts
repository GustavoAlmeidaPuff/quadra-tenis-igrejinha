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
}

function buildChallengeEmailHtml(params: ChallengeEmailParams): string {
  const { fromUserName, fromUserPictureUrl, notificationsUrl } = params;
  const avatarHtml = fromUserPictureUrl
    ? `<img src="${escapeHtml(fromUserPictureUrl)}" alt="" width="80" height="80" style="width:80px;height:80px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 16px;" />`
    : `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-size:28px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">${escapeHtml(fromUserName.charAt(0).toUpperCase())}</div>`;

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
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">te desafiou para um jogo na quadra.</p>
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
