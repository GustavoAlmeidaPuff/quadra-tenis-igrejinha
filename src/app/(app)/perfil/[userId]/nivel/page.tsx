'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { ArrowLeft, Target, Star, Zap, Flame, Gem } from 'lucide-react';
import Image from 'next/image';
import { getTotalHoursForUser } from '@/lib/queries/stats';
import {
  getTodasPatentesComStatus,
  getProgressoAteProxima,
  PATENTES,
  type PatenteInfo,
} from '@/lib/patentes';
import { User } from '@/lib/types';

type PageProps = {
  params: Promise<{ userId: string }>;
};

const ICON_MAP = {
  target: Target,
  star: Star,
  zap: Zap,
  flame: Flame,
  gem: Gem,
};

function PatenteIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComp = ICON_MAP[icon as keyof typeof ICON_MAP] ?? Target;
  return <IconComp className={className ?? 'w-5 h-5'} />;
}

export default function NivelPage({ params }: PageProps) {
  const { userId } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [totalHours, setTotalHours] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [userSnap, hours] = await Promise.all([
          getDoc(doc(db, 'users', userId)),
          getTotalHoursForUser(userId),
        ]);

        if (cancelled) return;

        if (userSnap.exists()) {
          const d = userSnap.data();
          setUser({
            id: userSnap.id,
            email: d.email,
            firstName: d.firstName ?? '',
            lastName: d.lastName ?? '',
            pictureUrl: d.pictureUrl,
            isAnonymous: d.isAnonymous ?? false,
            isPrivate: d.isPrivate ?? false,
            createdAt: d.createdAt,
          });
        }
        setTotalHours(hours);
      } catch {
        if (!cancelled) setError('Não foi possível carregar os dados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
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
          <h1 className="text-xl font-bold text-gray-900">Ranking de Patentes</h1>
        </div>
        <div className="px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse mb-4" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
          <h1 className="text-xl font-bold text-gray-900">Ranking de Patentes</h1>
        </div>
        <div className="px-4 py-12 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const hours = totalHours ?? 0;
  const patentes = getTodasPatentesComStatus(hours);
  const patenteAtual = patentes.find((p) => p.isAtual) ?? patentes[0];
  const currentIndex = PATENTES.findIndex((p) => p.id === patenteAtual.id);
  const progressoAteProxima = getProgressoAteProxima(hours);
  const userName = user
    ? `${user.firstName} ${user.lastName}`.trim() || 'Jogador'
    : 'Jogador';

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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            <Image
              src="/images/logo.png"
              alt=""
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Ranking de Patentes</h1>
        </div>
      </div>

      <div className="px-4 py-8 flex flex-col items-center">
        {/* Resumo do usuário */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-md ${
              patenteAtual.isAtual
                ? 'bg-primary-400 text-white shadow-primary-400/30'
                : 'bg-gray-300 text-white'
            }`}
          >
            <PatenteIcon
              icon={patenteAtual.icon}
              className="w-8 h-8"
            />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-4">{userName}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Patente: <span className="font-semibold text-gray-900">{patenteAtual.nome}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{hours}h jogadas</p>
        </div>

        {/* Timeline zigzag estilo Duolingo - linha contínua */}
        <PatenteTimeline
          patentes={patentes}
          currentIndex={currentIndex}
          progressoAteProxima={progressoAteProxima}
        />
      </div>
    </div>
  );
}

const LINE_WIDTH = 6;

function PatenteTimeline({
  patentes,
  currentIndex,
  progressoAteProxima,
}: {
  patentes: PatenteInfo[];
  currentIndex: number;
  progressoAteProxima: number;
}) {
  const totalSegments = Math.max(1, patentes.length - 1);
  const filledSegments = currentIndex + progressoAteProxima;
  const fillPercent = (filledSegments / totalSegments) * 100;

  return (
    <div className="relative w-full max-w-[320px]">
      {/* Linha contínua: só entre centro do primeiro e último nó */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
        style={{
          width: LINE_WIDTH,
          top: '40px',
          bottom: '40px',
        }}
      >
        <div
          className="absolute inset-x-0 top-0 bottom-0 bg-gray-300 rounded-full"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 top-0 w-full bg-primary-400 rounded-full transition-all duration-500"
          style={{ height: `${fillPercent}%` }}
          aria-hidden
        />
      </div>

      {/* Nós alternados (zigzag) - círculos centrados na linha, texto à esquerda/direita */}
      <div className="relative">
        {patentes.map((patente, index) => (
          <PatenteNode
            key={patente.id}
            patente={patente}
            index={index}
            progressoAteProxima={patente.isAtual ? progressoAteProxima : 0}
          />
        ))}
      </div>
    </div>
  );
}

function PatenteNode({
  patente,
  index,
  progressoAteProxima,
}: {
  patente: PatenteInfo;
  index: number;
  progressoAteProxima: number;
}) {
  const isLeft = index % 2 === 0;
  const circleActive = patente.isAlcancada || patente.isAtual;

  return (
    <div className="flex items-center gap-0 py-4 min-h-[80px]">
      {/* Lado esquerdo: texto quando zigzag à esquerda */}
      <div
        className={`flex-1 flex items-center min-w-0 ${
          isLeft ? 'justify-end pr-3' : 'justify-end'
        }`}
      >
        {isLeft && (
          <div className="flex flex-col text-right">
            <p className="font-semibold text-gray-900">{patente.nome}</p>
            <p className="text-sm text-gray-500">{patente.horasRequeridas}h</p>
          </div>
        )}
      </div>

      {/* Centro: círculo sobre a linha */}
      <div className="flex-shrink-0 relative w-14 h-14 flex items-center justify-center">
        {patente.isAtual ? (
          <>
            {/* Anel SVG de progresso ao redor do nó atual */}
            <svg
              className="absolute inset-0 w-14 h-14 -rotate-90"
              viewBox="0 0 56 56"
              aria-hidden
            >
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="rgb(209 250 229)"
                strokeWidth="3"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="rgb(52 211 153)"
                strokeWidth="3"
                strokeDasharray={2 * Math.PI * 24}
                strokeDashoffset={2 * Math.PI * 24 * (1 - progressoAteProxima)}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset] duration-500"
              />
            </svg>
            <div className="w-11 h-11 rounded-full bg-primary-400 text-white flex items-center justify-center shadow-lg shadow-primary-400/40 relative z-10">
              <PatenteIcon icon={patente.icon} className="w-5 h-5" />
            </div>
          </>
        ) : (
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center ${
              circleActive
                ? 'bg-primary-400 text-white shadow-md'
                : 'bg-gray-300 text-white'
            }`}
          >
            <PatenteIcon icon={patente.icon} className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Lado direito: texto quando zigzag à direita */}
      <div
        className={`flex-1 flex items-center min-w-0 ${
          !isLeft ? 'justify-start pl-3' : 'justify-start'
        }`}
      >
        {!isLeft && (
          <div className="flex flex-col text-left">
            <p className="font-semibold text-gray-900">{patente.nome}</p>
            <p className="text-sm text-gray-500">{patente.horasRequeridas}h</p>
          </div>
        )}
      </div>
    </div>
  );
}
