'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  const supportNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(
    /\D/g,
    ''
  );
  const supportUrl = supportNumber
    ? `https://wa.me/${supportNumber}?text=${encodeURIComponent(
        `Olá, o app travou com um erro: ${error.message}`
      )}`
    : null;

  return (
    <html lang="pt-BR">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: '#f9fafb',
          color: '#111827',
        }}
      >
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 16px',
              borderRadius: '9999px',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
            aria-hidden
          >
            ⚠️
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Algo deu muito errado
          </h1>
          <p
            style={{
              fontSize: 14,
              color: '#4b5563',
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            O app travou inesperadamente. Tente recarregar — se continuar, fale
            com o suporte e descreveremos o que aconteceu.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Tentar novamente
            </button>
            {supportUrl && (
              <a
                href={supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 13,
                  color: '#6b7280',
                  textDecoration: 'underline',
                }}
              >
                Falar com o suporte
              </a>
            )}
            {error.digest && (
              <p
                style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  marginTop: 4,
                  fontFamily: 'monospace',
                }}
              >
                {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
