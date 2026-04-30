import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <p className="text-6xl font-bold text-emerald-600 mb-2">404</p>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          Página não encontrada
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          O endereço que você acessou não existe ou foi movido.
        </p>
        <Link
          href="/home"
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl px-5 py-2.5 transition-colors"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
