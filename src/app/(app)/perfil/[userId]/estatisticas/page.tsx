'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, BarChart2, Users, Clock, TrendingUp } from 'lucide-react';
import { getUserStats } from '@/lib/queries/stats';
import type { UserStats, PartnerStat } from '@/lib/queries/stats';
import { getRandomColor } from '@/lib/utils';

type PageProps = {
  params: Promise<{ userId: string }>;
};

const CHART_MAX_HEIGHT_PX = 140;

export default function EstatisticasPage({ params }: PageProps) {
  const { userId } = use(params);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getUserStats(userId)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar as estatísticas.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
          <h1 className="text-xl font-bold text-gray-900">Estatísticas de jogo</h1>
        </div>
        <div className="px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse mb-4" />
          <p className="text-sm text-gray-500">Carregando estatísticas...</p>
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
          <h1 className="text-xl font-bold text-gray-900">Estatísticas de jogo</h1>
        </div>
        <div className="px-4 py-12 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const monthlyHours = stats?.monthlyHours ?? [];
  const maxMonthlyHours = Math.max(
    1,
    ...monthlyHours.map((m) => m.hours)
  );
  const weeklyHours = stats?.weeklyHours ?? [];
  const maxWeeklyHours = Math.max(
    1,
    ...weeklyHours.map((w) => w.hours)
  );
  const dayStats = stats?.dayStats ?? [];
  const maxDayCount = Math.max(
    1,
    ...dayStats.map((d) => d.count)
  );

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
        <h1 className="text-xl font-bold text-gray-900">Estatísticas de jogo</h1>
      </div>

      <div className="px-4 py-6 flex flex-col gap-8">
        {/* Total de horas jogadas */}
        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mb-3">
              <Clock className="w-7 h-7 text-primary-600" />
            </div>
            <p className="text-sm text-gray-500 mb-1">Total de horas jogadas</p>
            <p className="text-4xl font-bold text-gray-900 tabular-nums">
              {stats?.totalHours ?? 0}
              <span className="text-2xl font-semibold text-gray-600 ml-0.5">h</span>
            </p>
          </div>
        </section>

        {/* Frequência por dia */}
        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Frequência por dia</h2>
          </div>
          <div className="flex items-end justify-between gap-2 h-32">
            {dayStats.map((stat) => (
              <div
                key={stat.day}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div className="w-full flex items-end justify-center flex-1">
                  {stat.count > 0 && (
                    <div
                      className="w-full bg-primary-500 rounded-t-lg transition-all"
                      style={{
                        height: `${(stat.count / maxDayCount) * 100}%`,
                      }}
                    />
                  )}
                </div>
                <span className="text-xs font-medium text-gray-600">{stat.day}</span>
                <span className="text-xs text-gray-500">{stat.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Gráfico de colunas - horas por mês */}
        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">Horas por mês</h2>
          </div>
          <div className="flex items-end justify-between gap-2 min-h-[180px]">
            {monthlyHours.map((m) => (
              <div
                key={m.monthKey}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div className="w-full flex flex-col items-center justify-end h-[140px]">
                  <span className="text-xs font-medium text-gray-600 mb-1">
                    {m.hours}h
                  </span>
                  <div
                    className="w-full max-w-[52px] rounded-t-md bg-primary-500 transition-all"
                    style={{
                      height: `${Math.round((m.hours / maxMonthlyHours) * CHART_MAX_HEIGHT_PX)}px`,
                      minHeight: m.hours > 0 ? 8 : 0,
                    }}
                    aria-label={`${m.monthLabel}: ${m.hours} horas`}
                  />
                </div>
                <span className="text-xs font-medium text-gray-500">
                  {m.monthLabel}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Gráfico de colunas - horas por semana */}
        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">Horas por semana</h2>
          </div>
          <div className="flex items-end justify-between gap-2 min-h-[180px]">
            {weeklyHours.map((w) => (
              <div
                key={w.weekKey}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div className="w-full flex flex-col items-center justify-end h-[140px]">
                  <span className="text-xs font-medium text-gray-600 mb-1">
                    {w.hours}h
                  </span>
                  <div
                    className="w-full max-w-[52px] rounded-t-md bg-primary-400 transition-all"
                    style={{
                      height: `${Math.round((w.hours / maxWeeklyHours) * CHART_MAX_HEIGHT_PX)}px`,
                      minHeight: w.hours > 0 ? 8 : 0,
                    }}
                    aria-label={`Semana ${w.weekLabel}: ${w.hours} horas`}
                  />
                </div>
                <span className="text-xs font-medium text-gray-500">
                  {w.weekLabel}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Com quem mais você jogou */}
        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">Com quem mais você jogou</h2>
          </div>
          {(stats?.topPartners?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Ainda não há parceiros para exibir. Jogue mais partidas para ver o ranking.
            </p>
          ) : (
            <ul className="space-y-3">
              {(stats?.topPartners ?? []).map((partner: PartnerStat, index: number) => (
                <li key={partner.userId}>
                  <Link
                    href={`/perfil/${partner.userId}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-primary-500">
                      {index + 1}
                    </span>
                    {partner.pictureUrl ? (
                      <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                        <Image
                          src={partner.pictureUrl}
                          alt={partner.name}
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    ) : (
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getRandomColor(partner.userId)}`}
                      >
                        {partner.initials}
                      </div>
                    )}
                    <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
                      {partner.name}
                    </span>
                    <span className="flex-shrink-0 text-xs text-gray-600">
                      {partner.count} {partner.count === 1 ? 'jogo' : 'jogos'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
