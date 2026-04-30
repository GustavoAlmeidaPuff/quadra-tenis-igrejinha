import Image from 'next/image';
import { GraduationCap, Target, Zap } from 'lucide-react';

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
                <GraduationCap className="w-10 h-10 text-emerald-600" />
                <div className="mt-2 font-semibold text-gray-900">
                  Aulas para iniciantes e intermediários
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <Target className="w-10 h-10 text-emerald-600" />
                <div className="mt-2 font-semibold text-gray-900">
                  Treinos focados em técnica, tática e confiança em quadra
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <Zap className="w-10 h-10 text-emerald-600" />
                <div className="mt-2 font-semibold text-gray-900">
                  Ambiente leve, mas com treino de verdade (sem enrolação 😅)
                </div>
              </div>
            </div>

            <div className="mt-6 text-gray-700">
              <div className="font-semibold text-gray-900">Além das aulas, também ofereço:</div>
              <ul className="mt-2 space-y-2 list-disc list-inside marker:text-gray-500">
                <li>
                  🔧 Encordamento de raquetes
                </li>
                <li>
                  🎒🎾 Acessórios e equipamentos para jogar tênis
                </li>
              </ul>
            </div>

            <div className="mt-6 rounded-2xl bg-emerald-50 p-5 border border-emerald-100">
              <div className="text-gray-900 font-semibold">
                Seja pra começar do zero ou melhorar teu nível, é só chamar 👇
              </div>
              <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <a
                  href="https://wa.me/555199160036?text=Oi%20Rafitos!%20Quero%20saber%20sobre%20aulas%20de%20tenis."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="w-5 h-5 shrink-0"
                    fill="currentColor"
                  >
                    <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.16 1.59 5.98L0 24l6.3-1.65a11.83 11.83 0 0 0 5.76 1.47h.01c6.55 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.44ZM12.07 21.8h-.01a9.8 9.8 0 0 1-4.98-1.36l-.36-.22-3.74.98 1-3.64-.24-.37a9.82 9.82 0 0 1-1.5-5.28c0-5.42 4.41-9.83 9.84-9.83 2.63 0 5.11 1.02 6.97 2.89a9.8 9.8 0 0 1 2.87 6.96c0 5.42-4.41 9.83-9.84 9.83Zm5.39-7.35c-.29-.14-1.72-.85-1.99-.94-.27-.1-.46-.14-.66.14-.2.28-.76.94-.93 1.13-.17.2-.34.21-.63.07-.29-.14-1.2-.44-2.3-1.4-.85-.76-1.43-1.7-1.6-1.99-.17-.28-.02-.43.12-.57.13-.13.29-.34.43-.5.14-.17.19-.28.29-.47.1-.2.05-.37-.02-.52-.07-.14-.66-1.58-.9-2.17-.24-.57-.49-.49-.66-.5h-.56c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.06 2.89 1.2 3.09.14.2 2.08 3.17 5.03 4.45.7.3 1.24.48 1.66.61.7.22 1.34.19 1.85.11.57-.08 1.72-.7 1.96-1.38.24-.68.24-1.25.17-1.38-.07-.13-.26-.2-.55-.34Z" />
                  </svg>
                  Me chama e bora pra quadra
                </a>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
