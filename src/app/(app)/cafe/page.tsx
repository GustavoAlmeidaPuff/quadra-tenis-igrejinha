'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Copy, Check } from 'lucide-react';

const PIX_KEY_DISPLAY = '64.523.312/0001-62';
const PIX_KEY_COPY = '64523312000162';

export default function CafePage() {
  const [copied, setCopied] = useState(false);

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY_COPY);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback para navegadores antigos
      const input = document.createElement('input');
      input.value = PIX_KEY_COPY;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Imagem só no topo */}
      <div className="relative w-full h-64 overflow-hidden shrink-0">
        <Image
          src="/images/cafe-doacao-bg.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, transparent 45%, rgb(249 250 251) 100%)',
          }}
          aria-hidden
        />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col items-center px-4 -mt-16 relative z-20 py-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-200 p-6 sm:p-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 text-center mb-2">
            Obrigado pela boa vontade!
          </h1>
          <p className="text-gray-600 text-center text-sm sm:text-base mb-6">
            Se quiser apoiar o app com um cafezinho, use o PIX abaixo.
          </p>

          <div className="flex flex-col items-center gap-4">
            <Image
              src="/images/pix.png"
              alt="QR Code PIX"
              width={200}
              height={200}
              className="rounded-lg"
            />
            <div className="w-full">
              <p className="text-xs text-gray-500 text-center mb-1">Chave PIX (CNPJ)</p>
              <button
                type="button"
                onClick={handleCopyPix}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-mono text-sm transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{PIX_KEY_DISPLAY}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Pra quem vai o café? */}
        <section className="w-full max-w-md mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 text-center mb-4 px-2">
            Pra quem vai o café?
          </h2>
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">
              <div
                className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center"
                aria-hidden
              >
                <Image
                  src="/images/dev.png"
                  alt="Gustavo Almeida"
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                  Olá, me chamo Gustavo Almeida!
                  <br />
                  Sou um desenvolvedor de software que gosta bastante de projetos de final de semana como esse! Fundador do{' '}
                  <Link
                    href="https://bibliotech.tech"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 underline font-medium"
                  >
                    bibliotech.tech
                  </Link>
                  , e estudante antes de tudo. Sempre aberto a um bom feedback!
                </p>
                <p className="mt-3 text-sm">
                  <a
                    href="https://www.linkedin.com/in/gustavo-almeida-bb1088264/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 underline font-medium"
                  >
                    Meu LinkedIn
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
