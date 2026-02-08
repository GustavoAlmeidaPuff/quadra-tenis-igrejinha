'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default function NivelPage({ params }: PageProps) {
  const { userId } = use(params);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-6">
      <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-200">
        <Link
          href={`/perfil/${userId}`}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Nível de jogo</h1>
      </div>

      <div className="px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-4">
          <Trophy className="w-8 h-8 text-gray-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Em breve</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Estamos preparando a visualização do seu nível de jogo. Em breve você poderá ver e evoluir seu ranking.
        </p>
      </div>
    </div>
  );
}
