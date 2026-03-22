import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Handshake } from 'lucide-react';

const sponsors = [
  {
    name: 'Sanvitron',
    logo: '/images/sanvitron.png',
    description:
      'A Sanvitron oferece soluções modernas em automação de estacionamentos, trazendo tecnologia, praticidade e controle para empresas e espaços urbanos.',
  },
  {
    name: 'Auto Sandense',
    logo: '/images/auto sandense.png',
    description:
      'A Auto Sandense é especializada em mecânica automotiva, com atendimento de confiança, qualidade e cuidado para manter seu carro sempre em dia.',
  },
  {
    name: 'Climacar',
    logo: '/images/climacar.png',
    description:
      'A Climacar é referência em climatização automotiva, oferecendo manutenção e instalação de ar-condicionado com eficiência e conforto para o seu dia a dia.',
  },
  {
    name: 'Rafitos Alcaraz',
    logo: '/images/logo rafitos.png',
    description:
      'Aulas de tênis com treinos dinâmicos, metodologia prática e uma pegada leve. O foco é claro: evolução dentro de quadra.',
  },
];

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
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-2xl bg-emerald-100 p-3">
              <Handshake className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Parceiros do Tênis</h1>
              <p className="text-sm text-gray-600">
                Empresas e marcas que apoiam o ecossistema do tênis em Igrejinha.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {sponsors.map((sponsor) => (
              <article
                key={sponsor.name}
                className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5"
              >
                <div className="flex h-20 items-center justify-center rounded-xl bg-white border border-gray-100 px-4">
                  <Image
                    src={sponsor.logo}
                    alt={`Logo ${sponsor.name}`}
                    width={160}
                    height={72}
                    className="max-h-16 w-auto object-contain"
                  />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">{sponsor.name}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{sponsor.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
