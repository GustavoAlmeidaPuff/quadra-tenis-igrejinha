'use client';

import { useState } from 'react';
import Image from 'next/image';
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Imagem de fundo */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/cafe-doacao-bg.png"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden />
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
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
      </div>
    </div>
  );
}
