import Image from 'next/image';

export default function AulasPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative overflow-hidden">
        {/* Fundo decorativo */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 rounded-full bg-sky-100/70 blur-3xl" />
        <div className="pointer-events-none absolute top-80 -right-24 h-72 w-72 rounded-full bg-amber-100/60 blur-3xl" />

        <main className="relative mx-auto max-w-3xl px-4 py-10 text-center">
          {/* Logo */}
          <div className="mx-auto">
            <div className="relative inline-flex items-center justify-center">
              <div className="absolute -inset-6 rounded-full bg-white/60 blur-sm" />
              <Image
                src="/images/logo%20rafitos.png"
                alt="Logo Rafitos"
                className="relative w-56 sm:w-72 md:w-96 h-auto drop-shadow-sm"
                width={512}
                height={512}
                priority
              />
            </div>
          </div>

          <h1 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">
            Aulas de Tenis com Rafitos
          </h1>
          <p className="mt-2 text-gray-600">
            Prazer! Sou Rafitos Alcaraz, irmão brasileiro de Carlos Alcaraz.
          </p>

          {/* Bloco principal */}
          <section className="mt-7 rounded-3xl border border-gray-200 bg-white/70 p-6 text-left shadow-sm backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <div className="text-4xl leading-none">🎾</div>
                <div className="mt-2 font-semibold text-gray-900">
                  Aulas para iniciantes e intermediários
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <div className="text-4xl leading-none">🎾</div>
                <div className="mt-2 font-semibold text-gray-900">
                  Treinos focados em técnica, tática e confiança em quadra
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <div className="text-4xl leading-none">🎾</div>
                <div className="mt-2 font-semibold text-gray-900">
                  Ambiente leve, mas com treino de verdade (sem enrolação 😅)
                </div>
              </div>
            </div>

            <div className="mt-6 text-gray-700">
              <div className="font-semibold text-gray-900">Além das aulas, também ofereço:</div>
              <ul className="mt-2 space-y-2">
                <li className="flex gap-3">
                  <span className="shrink-0">🔧</span>
                  <span>Encordamento de raquetes</span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0">🎒🎾</span>
                  <span>Acessórios e equipamentos para jogar tênis</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 rounded-2xl bg-emerald-50 p-5 border border-emerald-100">
              <div className="text-gray-900 font-semibold">
                Seja pra começar do zero ou melhorar teu nível, é só chamar 👇
              </div>
              <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <a
                  href="https://wa.me/5551997188572?text=Oi%20Rafitos!%20Quero%20saber%20sobre%20aulas%20de%20tenis."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                  📲 Me chama e bora pra quadra
                </a>
                <div className="text-sm text-gray-600">
                  Respondo rápido por WhatsApp.
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
