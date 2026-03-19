import Link from 'next/link';
import { ArrowLeft, Handshake, Trophy, Store, Wrench } from 'lucide-react';

export default function ParceirosPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4">
          <Link
            href="/perfil/me"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao perfil
          </Link>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3">
              <Handshake className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Parceiros do Tênis</h1>
              <p className="text-sm text-gray-600">
                Marcas, profissionais e serviços recomendados para quem joga em Igrejinha.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <Trophy className="h-4 w-4 text-emerald-600" />
                Treinadores parceiros
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Em breve: lista de professores e horários recomendados.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <Wrench className="h-4 w-4 text-emerald-600" />
                Serviços técnicos
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Encordamento, manutenção e customização de raquetes.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:col-span-2">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <Store className="h-4 w-4 text-emerald-600" />
                Lojas e acessórios
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Equipamentos e acessórios para treinar e competir melhor.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
