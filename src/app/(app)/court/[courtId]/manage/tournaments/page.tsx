'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { ArrowLeft, CalendarDays, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { getCourtName } from '@/lib/courts';
import { formatTime } from '@/lib/utils';
import ErrorState from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { getFriendlyError, logError, type FriendlyError } from '@/lib/errors';
import TournamentEditor, {
  draftToRange,
  newPeriodDraft,
  type PeriodDraft,
  type TournamentDraft,
} from '@/components/tournament/TournamentEditor';

interface PeriodView {
  id: string;
  startAt: Date;
  endAt: Date;
  label: string;
}

interface TournamentView {
  id: string;
  name: string;
  periods: PeriodView[];
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatPeriodDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
}

/** Os períodos viram o rascunho do formulário para edição. */
function toDrafts(periods: PeriodView[]): PeriodDraft[] {
  return periods.map((p, i) => ({
    key: `${p.id}_${i}`,
    date: toYMD(p.startAt),
    startTime: toHM(p.startAt),
    endTime: toHM(p.endAt),
  }));
}

export default function CampeonatosPage() {
  const params = useParams();
  const courtId = params?.courtId as string;
  const { showError, showSuccess } = useToast();

  const [tournaments, setTournaments] = useState<TournamentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<FriendlyError | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tournamentsSnap = await getDocs(
      query(collection(db, 'tournaments'), where('courtId', '==', courtId))
    );

    const loaded: TournamentView[] = [];
    for (const docSnap of tournamentsSnap.docs) {
      // Os períodos são as próprias reservas do campeonato. Ordenar em memória
      // evita exigir um índice composto no Firestore.
      const blocksSnap = await getDocs(
        query(collection(db, 'reservations'), where('tournamentId', '==', docSnap.id))
      );
      const periods: PeriodView[] = blocksSnap.docs
        .map((b) => {
          const data = b.data();
          return {
            id: b.id,
            startAt: data.startAt?.toDate?.() ?? new Date(),
            endAt: data.endAt?.toDate?.() ?? new Date(),
            label: data.periodLabel ?? '',
          };
        })
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

      loaded.push({
        id: docSnap.id,
        name: docSnap.data().name ?? 'Campeonato',
        periods,
      });
    }

    loaded.sort((a, b) => {
      const aStart = a.periods[0]?.startAt.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bStart = b.periods[0]?.startAt.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aStart - bStart;
    });

    setTournaments(loaded);
  }, [courtId]);

  useEffect(() => {
    const run = async () => {
      setPageError(null);
      try {
        await load();
      } catch (err) {
        logError('tournaments:load', err);
        setPageError(getFriendlyError(err));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [load, retryKey]);

  const closeEditor = () => {
    setCreating(false);
    setEditingId(null);
    setSaveError(null);
    setConflicts([]);
  };

  const submitDraft = async (draft: TournamentDraft, tournamentId: string | null) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setSaveError('Faça login novamente.');
      return;
    }

    const periods = draft.periods
      .map(draftToRange)
      .filter((r): r is { startAt: Date; endAt: Date } => r !== null)
      .map((r) => ({
        startAtISO: r.startAt.toISOString(),
        endAtISO: r.endAt.toISOString(),
      }));

    setSaving(true);
    setSaveError(null);
    setConflicts([]);

    try {
      const response = tournamentId
        ? await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, name: draft.name, periods }),
          })
        : await fetch('/api/tournaments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, courtId, name: draft.name, periods }),
          });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveError(
          typeof data?.error === 'string' ? data.error : 'Não foi possível salvar o campeonato.'
        );
        setConflicts(Array.isArray(data?.conflicts) ? data.conflicts : []);
        return;
      }

      closeEditor();
      await load();
      showSuccess(tournamentId ? 'Campeonato atualizado' : 'Campeonato criado');
    } catch (err) {
      logError('tournaments:save', err);
      setSaveError(getFriendlyError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tournament: TournamentView) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const confirmed = window.confirm(
      `Excluir "${tournament.name}"? Os horários bloqueados voltam a ficar livres.`
    );
    if (!confirmed) return;

    setDeletingId(tournament.id);
    try {
      const response = await fetch(
        `/api/tournaments/${encodeURIComponent(tournament.id)}?userId=${encodeURIComponent(uid)}`,
        { method: 'DELETE' }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showError(
          new Error(typeof data?.error === 'string' ? data.error : 'Erro'),
          'Não foi possível excluir'
        );
        return;
      }
      await load();
      showSuccess('Campeonato excluído');
    } catch (err) {
      logError('tournaments:delete', err);
      showError(err, 'Não foi possível excluir');
    } finally {
      setDeletingId(null);
    }
  };

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
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/court/${courtId}/manage`}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Campeonatos</h1>
          <p className="text-sm text-gray-500">{getCourtName(courtId)}</p>
        </div>
      </div>

      {!creating && editingId === null && (
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setSaveError(null);
            setConflicts([]);
          }}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Criar campeonato
        </button>
      )}

      {creating && (
        <TournamentEditor
          initial={{ name: '', periods: [newPeriodDraft()] }}
          saving={saving}
          error={saveError}
          conflicts={conflicts}
          onCancel={closeEditor}
          onSave={(draft) => submitDraft(draft, null)}
          submitLabel="Criar campeonato"
        />
      )}

      {tournaments.length === 0 && !creating && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center space-y-2">
          <Trophy className="w-8 h-8 text-purple-300 mx-auto" />
          <p className="text-sm text-gray-500">
            Nenhum campeonato criado nesta quadra.
          </p>
          <p className="text-xs text-gray-400">
            Ao criar um, os horários ficam bloqueados em roxo na agenda de todos os
            jogadores.
          </p>
        </div>
      )}

      {tournaments.map((tournament) =>
        editingId === tournament.id ? (
          <TournamentEditor
            key={tournament.id}
            initial={{ name: tournament.name, periods: toDrafts(tournament.periods) }}
            saving={saving}
            error={saveError}
            conflicts={conflicts}
            onCancel={closeEditor}
            onSave={(draft) => submitDraft(draft, tournament.id)}
            submitLabel="Salvar alterações"
          />
        ) : (
          <div
            key={tournament.id}
            className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Trophy className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <h2 className="font-semibold text-gray-900 truncate">{tournament.name}</h2>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(tournament.id);
                    setCreating(false);
                    setSaveError(null);
                    setConflicts([]);
                  }}
                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="Editar campeonato"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(tournament)}
                  disabled={deletingId === tournament.id}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Excluir campeonato"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {tournament.periods.length === 0 ? (
              <p className="text-sm text-gray-400">Sem períodos.</p>
            ) : (
              <ul className="space-y-2">
                {tournament.periods.map((period) => (
                  <li
                    key={period.id}
                    className="flex items-start gap-2 bg-purple-50 rounded-lg px-3 py-2"
                  >
                    <CalendarDays className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-purple-900">
                        {period.label || formatPeriodDate(period.startAt)}
                      </p>
                      <p className="text-xs text-gray-600 capitalize">
                        {formatPeriodDate(period.startAt)} · {formatTime(period.startAt)} –{' '}
                        {formatTime(period.endAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      )}
    </div>
  );
}
