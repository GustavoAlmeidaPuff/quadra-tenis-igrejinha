'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Clock, Calendar, TrendingUp } from 'lucide-react';
import {
  getUserStats,
  type UserStats,
  type PartnerStat,
} from '@/lib/queries/stats';
import { getRandomColor } from '@/lib/utils';

export default function HomePage() {
  const [userName, setUserName] = useState('');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserName(data.firstName ?? '');
        }

        const userStats = await getUserStats(user.uid);
        setStats(userStats);
      } catch (e) {
        console.error('Erro ao carregar estatísticas:', e);
        setStats({
          totalHours: 0,
          totalReservations: 0,
          weekStreak: 0,
          dayStats: [
            { day: 'Dom', count: 0 },
            { day: 'Seg', count: 0 },
            { day: 'Ter', count: 0 },
            { day: 'Qua', count: 0 },
            { day: 'Qui', count: 0 },
            { day: 'Sex', count: 0 },
            { day: 'Sáb', count: 0 },
          ],
          topPartners: [],
          nextReservation: null,
          upcomingReservations: [],
          pastReservations: [],
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const maxCount = Math.max(
    ...(stats?.dayStats?.map((d) => d.count) ?? [0]),
    1
  );

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Olá, {userName}! 👋</h1>
        <p className="text-sm text-gray-600">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>

      {stats?.nextReservation && (
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-5 border border-emerald-200">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
              Próxima Reserva
            </span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="font-bold text-lg text-gray-900 mb-1">
            {stats.nextReservation.dateLabel}
          </h3>
          <p className="text-sm text-gray-700 mb-2">{stats.nextReservation.time}</p>
          <p className="text-xs text-gray-600">
            {stats.nextReservation.participants.join(', ')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
          <Clock className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">
            {stats?.totalHours ?? 0}h
          </div>
          <div className="text-xs text-gray-600">Total jogadas</div>
        </div>
        <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
          <Calendar className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">
            {stats?.totalReservations ?? 0}
          </div>
          <div className="text-xs text-gray-600">Reservas</div>
        </div>
        <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
          <TrendingUp className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">
            {stats?.weekStreak ?? 0}
          </div>
          <div className="text-xs text-gray-600">Semanas streak</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h2 className="font-semibold text-gray-900">Frequência por dia</h2>
        </div>
        <div className="flex items-end justify-between gap-2 h-32">
          {(stats?.dayStats ?? []).map((stat) => (
            <div
              key={stat.day}
              className="flex-1 flex flex-col items-center gap-2"
            >
              <div className="w-full flex items-end justify-center flex-1">
                {stat.count > 0 && (
                  <div
                    className="w-full bg-emerald-500 rounded-t-lg transition-all"
                    style={{
                      height: `${(stat.count / maxCount) * 100}%`,
                    }}
                  />
                )}
              </div>
              <span className="text-xs font-medium text-gray-600">{stat.day}</span>
              <span className="text-xs text-gray-500">{stat.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-200">
        <h2 className="font-semibold text-gray-900 mb-4">
          Parceiros mais frequentes
        </h2>
        {(stats?.topPartners?.length ?? 0) > 0 ? (
          <div className="space-y-3">
            {(stats?.topPartners ?? []).map((partner: PartnerStat) => (
              <a
                key={partner.userId}
                href={`/perfil/${partner.userId}`}
                className="flex items-center justify-between hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getRandomColor(partner.userId)}`}
                  >
                    {partner.initials}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {partner.name}
                  </span>
                </div>
                <span className="text-xs text-gray-600">
                  {partner.count} {partner.count === 1 ? 'jogo' : 'jogos'}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4">
            Nenhum parceiro ainda. Faça reservas para aparecer aqui.
          </p>
        )}
      </div>
    </div>
  );
}
