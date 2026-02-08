/**
 * Número do WhatsApp do suporte (apenas dígitos, com DDI).
 * Configure em .env.local: NEXT_PUBLIC_SUPPORT_WHATSAPP=5551999999999
 */
const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, '') || '';

/**
 * Gera o link do WhatsApp para contato com o suporte, com a mensagem de erro pré-preenchida.
 */
export function getSupportWhatsAppUrl(errorMessage: string): string {
  if (!SUPPORT_WHATSAPP) return '#';
  const text = encodeURIComponent(
    `Olá, encontrei um erro no app: ${errorMessage}`
  );
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${text}`;
}

export function hasSupportWhatsApp(): boolean {
  return SUPPORT_WHATSAPP.length > 0;
}
