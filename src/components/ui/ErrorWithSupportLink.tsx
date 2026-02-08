'use client';

import { getSupportWhatsAppUrl, hasSupportWhatsApp } from '@/lib/support';

interface ErrorWithSupportLinkProps {
  /** Mensagem de erro exibida ao usuário */
  message: string;
  /** Classes CSS do container (ex: para fundo vermelho e texto) */
  className?: string;
  /** Se true, usa role="alert" para acessibilidade */
  roleAlert?: boolean;
}

/**
 * Exibe a mensagem de erro e, abaixo, texto: "Se esse erro não fizer sentido [entre em contato com o suporte]",
 * onde o texto entre colchetes é link para WhatsApp do suporte com a mesma mensagem de erro.
 */
export default function ErrorWithSupportLink({
  message,
  className = '',
  roleAlert = true,
}: ErrorWithSupportLinkProps) {
  const supportUrl = getSupportWhatsAppUrl(message);
  const showSupportLink = hasSupportWhatsApp();

  return (
    <div
      className={className}
      role={roleAlert ? 'alert' : undefined}
    >
      <p>{message}</p>
      <p className="mt-2 text-sm">
        Se esse erro não fizer sentido{' '}
        {showSupportLink ? (
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium hover:opacity-80"
          >
            entre em contato com o suporte
          </a>
        ) : (
          <span className="font-medium">entre em contato com o suporte</span>
        )}
      </p>
    </div>
  );
}
