'use client';

import { useState } from 'react';
import { Plus, Trash2, Trophy } from 'lucide-react';
import {
  MAX_TOURNAMENT_NAME_LENGTH,
  MAX_TOURNAMENT_PERIODS,
  PERIOD_PRESETS,
  describePeriod,
  validatePeriods,
} from '@/lib/tournaments';

export interface PeriodDraft {
  key: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:MM' */
  startTime: string;
  /** 'HH:MM'. Menor ou igual ao início significa que termina no dia seguinte. */
  endTime: string;
}

export interface TournamentDraft {
  name: string;
  periods: PeriodDraft[];
}

interface Props {
  initial: TournamentDraft;
  saving: boolean;
  error: string | null;
  conflicts: string[];
  onCancel: () => void;
  onSave: (draft: TournamentDraft) => void;
  submitLabel: string;
}

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Converte um período do formulário em datas reais. Fim menor ou igual ao início
 * rola para o dia seguinte — é o que o organizador espera ao digitar 22:00 → 01:00.
 */
export function draftToRange(period: PeriodDraft): { startAt: Date; endAt: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period.date)) return null;
  const [y, m, d] = period.date.split('-').map(Number);
  const [sh, sm] = period.startTime.split(':').map(Number);
  const [eh, em] = period.endTime.split(':').map(Number);
  if ([y, m, d, sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;

  const startAt = new Date(y, m - 1, d, sh, sm, 0, 0);
  const endAt = new Date(y, m - 1, d, eh, em, 0, 0);
  if (endAt <= startAt) endAt.setDate(endAt.getDate() + 1);
  return { startAt, endAt };
}

export function newPeriodDraft(date?: string): PeriodDraft {
  const today = new Date();
  return {
    key: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: date ?? toYMD(today),
    startTime: '18:00',
    endTime: '23:00',
  };
}

export default function TournamentEditor({
  initial,
  saving,
  error,
  conflicts,
  onCancel,
  onSave,
  submitLabel,
}: Props) {
  const [name, setName] = useState(initial.name);
  const [periods, setPeriods] = useState<PeriodDraft[]>(
    initial.periods.length > 0 ? initial.periods : [newPeriodDraft()]
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = toYMD(today);
  const maxDateObj = new Date(today);
  maxDateObj.setFullYear(maxDateObj.getFullYear() + 1);
  const maxDate = toYMD(maxDateObj);

  const updatePeriod = (key: string, patch: Partial<PeriodDraft>) => {
    setPeriods((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };

  const applyPreset = (key: string, startHour: number, endHour: number) => {
    updatePeriod(key, {
      startTime: `${String(startHour).padStart(2, '0')}:00`,
      endTime: `${String(endHour).padStart(2, '0')}:00`,
    });
  };

  const addPeriod = () => {
    setPeriods((prev) => {
      if (prev.length >= MAX_TOURNAMENT_PERIODS) return prev;
      // O período novo começa no dia seguinte ao último: campeonato costuma ser
      // em dias seguidos e isso poupa digitação.
      const last = prev[prev.length - 1];
      let nextDate: string | undefined;
      if (last) {
        const [y, m, d] = last.date.split('-').map(Number);
        const next = new Date(y, m - 1, d + 1);
        nextDate = toYMD(next);
      }
      return [...prev, newPeriodDraft(nextDate)];
    });
  };

  const removePeriod = (key: string) => {
    setPeriods((prev) => (prev.length === 1 ? prev : prev.filter((p) => p.key !== key)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setLocalError('Dê um nome ao campeonato.');
      return;
    }

    const ranges = periods.map(draftToRange);
    if (ranges.some((r) => r === null)) {
      setLocalError('Período com data ou horário inválido.');
      return;
    }

    // Mesmas regras da API: erra aqui, sem ida ao servidor.
    const invalid = validatePeriods(ranges as { startAt: Date; endAt: Date }[]);
    if (invalid) {
      setLocalError(invalid);
      return;
    }

    onSave({ name: trimmed, periods });
  };

  const shownError = localError ?? error;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border-2 border-purple-200 p-5 space-y-5"
    >
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-purple-600" />
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {submitLabel === 'Criar campeonato' ? 'Novo campeonato' : 'Editar campeonato'}
        </h2>
      </div>

      {shownError && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm space-y-2">
          <p>{shownError}</p>
          {conflicts.length > 0 && (
            <ul className="list-disc list-inside space-y-1 text-xs">
              {conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <label htmlFor="tournament-name" className="block text-xs text-gray-500 mb-2">
          Nome do campeonato
        </label>
        <input
          id="tournament-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_TOURNAMENT_NAME_LENGTH}
          placeholder="Ex.: Torneio de Verão"
          className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 focus:border-purple-500 focus:outline-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          É esse nome que aparece na agenda de todo mundo.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-gray-500">Períodos</p>

        {periods.map((period, index) => {
          const range = draftToRange(period);
          const label = range ? describePeriod(range.startAt, range.endAt) : null;
          const crossesMidnight =
            range !== null && range.endAt.getDate() !== range.startAt.getDate();

          return (
            <div key={period.key} className="rounded-xl border border-gray-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Período {index + 1}
                </span>
                {periods.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePeriod(period.key)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remover período"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <input
                type="date"
                value={period.date}
                min={minDate}
                max={maxDate}
                onChange={(e) => updatePeriod(period.key, { date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-purple-500 focus:outline-none"
              />

              <div className="flex flex-wrap gap-1.5">
                {PERIOD_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(period.key, preset.startHour, preset.endHour)}
                    className="px-2.5 py-1 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={period.startTime}
                  onChange={(e) => updatePeriod(period.key, { startTime: e.target.value })}
                  className="flex-1 px-2 py-2 text-sm rounded-lg border border-gray-300 focus:border-purple-500 focus:outline-none"
                  aria-label="Início do período"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="text-gray-400 text-sm">até</span>
                <select
                  value={period.endTime}
                  onChange={(e) => updatePeriod(period.key, { endTime: e.target.value })}
                  className="flex-1 px-2 py-2 text-sm rounded-lg border border-gray-300 focus:border-purple-500 focus:outline-none"
                  aria-label="Término do período"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {label && (
                <p className="text-xs text-purple-700 font-medium">
                  {label}
                  {crossesMidnight && (
                    <span className="text-gray-400 font-normal"> · termina no dia seguinte</span>
                  )}
                </p>
              )}
            </div>
          );
        })}

        {periods.length < MAX_TOURNAMENT_PERIODS && (
          <button
            type="button"
            onClick={addPeriod}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar período
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-purple-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Salvando...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
