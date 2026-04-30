'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Court, CourtReservationRules, DurationMode } from '@/lib/types';
import { isDeveloper } from '@/lib/permissions';
import { ArrowLeft, UserMinus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import ErrorState from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { getFriendlyError, logError, type FriendlyError } from '@/lib/errors';

interface UserBasic {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const DEFAULT_RULES: CourtReservationRules = {
  durationMode: 'fixed',
  fixedMinutes: 90,
  maxMinutes: 300,
};

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

export default function GerenciarQuadraPage() {
  const params = useParams();
  const router = useRouter();
  const courtId = params?.courtId as string;
  const { showError, showSuccess } = useToast();
  const [pageError, setPageError] = useState<FriendlyError | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [court, setCourt] = useState<Court | null>(null);
  const [managers, setManagers] = useState<UserBasic[]>([]);
  const [allUsers, setAllUsers] = useState<UserBasic[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  // Reservation rules state
  const [durationMode, setDurationMode] = useState<DurationMode>('fixed');
  const [fixedHours, setFixedHours] = useState(1);
  const [fixedMins, setFixedMins] = useState(30);
  const [maxHours, setMaxHours] = useState(5);
  const [maxMinsExtra, setMaxMinsExtra] = useState(0);
  const [maxReservationsPerDay, setMaxReservationsPerDay] = useState<number | null>(null);
  const [maxReservationsPerWeek, setMaxReservationsPerWeek] = useState<number | null>(null);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);

  const loadCourt = async () => {
    const snap = await getDoc(doc(db, 'courts', courtId));
    if (!snap.exists()) {
      router.push('/reserve');
      return;
    }
    const data = snap.data() as Omit<Court, 'id'>;
    const courtData: Court = { id: snap.id, ...data };
    setCourt(courtData);

    // Load rules into state
    const rules = courtData.reservationRules ?? DEFAULT_RULES;
    setDurationMode(rules.durationMode);
    const fh = Math.floor(rules.fixedMinutes / 60);
    const fm = rules.fixedMinutes % 60;
    setFixedHours(fh);
    setFixedMins(fm);
    const mh = Math.floor(rules.maxMinutes / 60);
    const mm = rules.maxMinutes % 60;
    setMaxHours(mh);
    setMaxMinsExtra(mm);
    setMaxReservationsPerDay(rules.maxReservationsPerDay ?? null);
    setMaxReservationsPerWeek(rules.maxReservationsPerWeek ?? null);

    const managerUsers: UserBasic[] = [];
    for (const uid of courtData.managerIds ?? []) {
      const uSnap = await getDoc(doc(db, 'users', uid));
      if (uSnap.exists()) {
        const u = uSnap.data();
        managerUsers.push({
          id: uSnap.id,
          firstName: u.firstName ?? '',
          lastName: u.lastName ?? '',
          email: u.email ?? '',
        });
      }
    }
    setManagers(managerUsers);
  };

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) setCurrentUserEmail(currentUser.email ?? '');

    const fetchAll = async () => {
      setPageError(null);
      try {
        await loadCourt();

        const snap = await getDocs(collection(db, 'users'));
        const users: UserBasic[] = snap.docs
          .filter((d) => d.data().isAnonymous !== true)
          .map((d) => ({
            id: d.id,
            firstName: d.data().firstName ?? '',
            lastName: d.data().lastName ?? '',
            email: d.data().email ?? '',
          }));
        setAllUsers(users);
      } catch (err) {
        logError('manage:loadAll', err);
        setPageError(getFriendlyError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [courtId, retryKey]);

  const handleAddManager = async (user: UserBasic) => {
    if (!court) return;
    try {
      await updateDoc(doc(db, 'courts', courtId), {
        managerIds: arrayUnion(user.id),
      });
      setSearchTerm('');
      await loadCourt();
      showSuccess('Chefe de quadra adicionado');
    } catch (err) {
      logError('manage:addManager', err);
      showError(err, 'Não foi possível adicionar');
    }
  };

  const handleRemoveManager = async (userId: string) => {
    if (!court) return;
    try {
      await updateDoc(doc(db, 'courts', courtId), {
        managerIds: arrayRemove(userId),
      });
      await loadCourt();
      showSuccess('Chefe de quadra removido');
    } catch (err) {
      logError('manage:removeManager', err);
      showError(err, 'Não foi possível remover');
    }
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    setRulesSaved(false);
    try {
      const rules: CourtReservationRules = {
        durationMode,
        fixedMinutes: fixedHours * 60 + fixedMins,
        maxMinutes: maxHours * 60 + maxMinsExtra,
        maxReservationsPerDay: maxReservationsPerDay ?? null,
        maxReservationsPerWeek: maxReservationsPerWeek ?? null,
      };
      await updateDoc(doc(db, 'courts', courtId), { reservationRules: rules });
      setRulesSaved(true);
      setTimeout(() => setRulesSaved(false), 2500);
    } catch (err) {
      logError('manage:saveRules', err);
      showError(err, 'Não foi possível salvar as regras');
    } finally {
      setSavingRules(false);
    }
  };

  const suggestions = searchTerm.trim()
    ? allUsers
        .filter((u) => {
          const term = searchTerm.toLowerCase();
          return (
            u.email.toLowerCase().includes(term) ||
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(term)
          );
        })
        .filter((u) => !managers.some((m) => m.id === u.id))
        .slice(0, 5)
    : [];

  if (pageError) {
    return (
      <ErrorState
        error={pageError}
        onRetry={() => {
          setPageError(null);
          setLoading(true);
          setRetryKey((k) => k + 1);
        }}
        fullPage
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const backHref = isDeveloper(currentUserEmail) ? '/admin' : '/reserve';

  const currentFixedTotal = fixedHours * 60 + fixedMins;
  const currentMaxTotal = maxHours * 60 + maxMinsExtra;

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{court?.name}</h1>
          <p className="text-sm text-gray-500">Gerenciar quadra</p>
        </div>
      </div>

      {/* Reservation rules */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Regras de reserva
        </h2>

        <div>
          <p className="text-xs text-gray-500 mb-2">Tipo de duração</p>
          <div className="flex gap-2">
            {([
              { value: 'fixed', label: 'Fixa' },
              { value: 'free', label: 'Livre' },
              { value: 'max', label: 'Máximo' },
            ] as { value: DurationMode; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDurationMode(opt.value)}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  durationMode === opt.value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {durationMode === 'fixed' && 'Todas as reservas terão exatamente a duração configurada.'}
            {durationMode === 'free' && 'Jogadores escolhem livremente o horário de início e fim.'}
            {durationMode === 'max' && 'Jogadores escolhem a duração, respeitando o limite máximo.'}
          </p>
        </div>

        {durationMode === 'fixed' && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Duração fixa</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={fixedHours}
                  onChange={(e) => setFixedHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                  className="w-16 px-2 py-2 text-sm rounded-lg border border-gray-300 focus:border-emerald-500 focus:outline-none text-center"
                />
                <span className="text-sm text-gray-500">h</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={fixedMins}
                  onChange={(e) => setFixedMins(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-16 px-2 py-2 text-sm rounded-lg border border-gray-300 focus:border-emerald-500 focus:outline-none text-center"
                />
                <span className="text-sm text-gray-500">min</span>
              </div>
              {currentFixedTotal > 0 && (
                <span className="text-sm text-emerald-600 font-medium ml-1">
                  = {formatMins(currentFixedTotal)}
                </span>
              )}
            </div>
          </div>
        )}

        {durationMode === 'max' && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Duração máxima</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={maxHours}
                  onChange={(e) => setMaxHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                  className="w-16 px-2 py-2 text-sm rounded-lg border border-gray-300 focus:border-emerald-500 focus:outline-none text-center"
                />
                <span className="text-sm text-gray-500">h</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={maxMinsExtra}
                  onChange={(e) => setMaxMinsExtra(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-16 px-2 py-2 text-sm rounded-lg border border-gray-300 focus:border-emerald-500 focus:outline-none text-center"
                />
                <span className="text-sm text-gray-500">min</span>
              </div>
              {currentMaxTotal > 0 && (
                <span className="text-sm text-emerald-600 font-medium ml-1">
                  = {formatMins(currentMaxTotal)}
                </span>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500 mb-2">Reservas por dia (por pessoa)</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMaxReservationsPerDay(null)}
              className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                maxReservationsPerDay === null
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Livre
            </button>
            <button
              type="button"
              onClick={() => setMaxReservationsPerDay((prev) => prev ?? 1)}
              className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                maxReservationsPerDay !== null
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Limitado
            </button>
          </div>
          {maxReservationsPerDay !== null && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={1}
                max={20}
                value={maxReservationsPerDay}
                onChange={(e) =>
                  setMaxReservationsPerDay(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))
                }
                className="w-20 px-2 py-2 text-sm rounded-lg border border-gray-300 focus:border-emerald-500 focus:outline-none text-center"
              />
              <span className="text-sm text-gray-500">reserva(s) por dia</span>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {maxReservationsPerDay === null
              ? 'Sem limite de reservas por dia nesta quadra.'
              : `Cada pessoa pode fazer no máximo ${maxReservationsPerDay} reserva(s) por dia nesta quadra.`}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Reservas por semana (por pessoa)</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMaxReservationsPerWeek(null)}
              className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                maxReservationsPerWeek === null
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Livre
            </button>
            <button
              type="button"
              onClick={() => setMaxReservationsPerWeek((prev) => prev ?? 1)}
              className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                maxReservationsPerWeek !== null
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Limitado
            </button>
          </div>
          {maxReservationsPerWeek !== null && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={1}
                max={50}
                value={maxReservationsPerWeek}
                onChange={(e) =>
                  setMaxReservationsPerWeek(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))
                }
                className="w-20 px-2 py-2 text-sm rounded-lg border border-gray-300 focus:border-emerald-500 focus:outline-none text-center"
              />
              <span className="text-sm text-gray-500">reserva(s) por semana</span>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {maxReservationsPerWeek === null
              ? 'Sem limite de reservas por semana nesta quadra.'
              : `Cada pessoa pode fazer no máximo ${maxReservationsPerWeek} reserva(s) por semana nesta quadra.`}
          </p>
        </div>

        <button
          onClick={handleSaveRules}
          disabled={savingRules || (durationMode === 'fixed' && currentFixedTotal === 0) || (durationMode === 'max' && currentMaxTotal === 0)}
          className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {savingRules ? 'Salvando...' : rulesSaved ? 'Salvo!' : 'Salvar regras'}
        </button>
      </div>

      {/* Managers list */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Chefes atuais
        </h2>

        {managers.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum chefe cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {managers.map((manager) => (
              <li
                key={manager.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {manager.firstName} {manager.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{manager.email}</p>
                </div>
                <button
                  onClick={() => handleRemoveManager(manager.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remover chefe"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add manager */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Adicionar chefe
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-emerald-500 focus:outline-none"
          />
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
            <UserPlus className="w-4 h-4" />
          </div>
        </div>

        {suggestions.length > 0 && (
          <ul className="border border-gray-200 rounded-lg overflow-hidden">
            {suggestions.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => handleAddManager(u)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="text-gray-500 ml-2 text-xs">{u.email}</span>
                  </div>
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {searchTerm.trim() && suggestions.length === 0 && (
          <p className="text-sm text-gray-400">Nenhum usuário encontrado.</p>
        )}
      </div>
    </div>
  );
}
