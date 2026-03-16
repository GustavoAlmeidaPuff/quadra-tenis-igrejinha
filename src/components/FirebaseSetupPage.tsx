'use client';

import { AlertCircle, FileCode } from 'lucide-react';

export default function FirebaseSetupPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <div className="flex justify-center mb-4">
          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-600">
            <AlertCircle className="w-7 h-7" aria-hidden />
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center mb-2">
          Firebase não configurado
        </h1>
        <p className="text-gray-600 text-center text-sm sm:text-base mb-6">
          Copie o arquivo <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">.env.example</code> para <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code> e preencha as variáveis do Firebase.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 mb-6">
          <li>Abra o Console do Firebase e vá em Configurações do projeto</li>
          <li>Copie os valores do app Web (apiKey, authDomain, projectId, etc.)</li>
          <li>Cole em <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-xs">.env.local</code> nas chaves <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-xs">NEXT_PUBLIC_FIREBASE_*</code></li>
          <li>Reinicie o servidor (<code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-xs">npm run dev</code>)</li>
        </ol>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          <FileCode className="w-4 h-4 shrink-0 text-gray-400" />
          <span>
            Variáveis obrigatórias: <strong>NEXT_PUBLIC_FIREBASE_API_KEY</strong>, <strong>NEXT_PUBLIC_FIREBASE_PROJECT_ID</strong> e as demais do bloco Firebase do <code>.env.example</code>.
          </span>
        </div>
      </div>
    </div>
  );
}
