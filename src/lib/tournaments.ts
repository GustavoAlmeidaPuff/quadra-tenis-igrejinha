/**
 * Regras de campeonato compartilhadas entre a tela do chefe de quadra e as rotas
 * de API.
 *
 * Sem dependência de Firebase de propósito: o mesmo arquivo roda no navegador e
 * no servidor. Como a Vercel roda em UTC, todo horário aqui é resolvido
 * explicitamente no fuso da quadra — `getHours()` daria rótulos errados lá.
 */

export const APP_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Valor de `reservations.type` que marca um bloco de campeonato. Reserva normal
 * não tem `type` (docs antigos) ou tem 'play'.
 */
export const TOURNAMENT_RESERVATION_TYPE = 'tournament';

export const MAX_TOURNAMENT_PERIODS = 20;
export const MAX_TOURNAMENT_NAME_LENGTH = 60;
export const MAX_PERIOD_HOURS = 24;
/** A agenda mostra 7 dias, mas o bloco já pode ser criado antes disso. */
export const MAX_TOURNAMENT_DAYS_AHEAD = 365;

export interface PeriodPreset {
  id: string;
  label: string;
  startHour: number;
  endHour: number;
}

/** Atalhos do editor de períodos — cobrem os casos que o chefe de quadra usa. */
export const PERIOD_PRESETS: PeriodPreset[] = [
  { id: 'morning', label: 'Manhã', startHour: 8, endHour: 12 },
  { id: 'afternoon', label: 'Tarde', startHour: 13, endHour: 18 },
  { id: 'night', label: 'Noite', startHour: 18, endHour: 23 },
  { id: 'fullDay', label: 'Dia inteiro', startHour: 8, endHour: 22 },
];

interface ZonedParts {
  weekday: string;
  hour: number;
  minute: number;
  /** 'YYYY-MM-DD' no fuso da quadra — serve para comparar dias sem UTC no meio. */
  dateKey: string;
  dayMonth: string;
}

const ZONED_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  weekday: 'long',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function zonedParts(date: Date): ZonedParts {
  const parts: Record<string, string> = {};
  for (const p of ZONED_FORMATTER.formatToParts(date)) parts[p.type] = p.value;
  return {
    weekday: parts.weekday ?? '',
    hour: Number(parts.hour ?? 0),
    minute: Number(parts.minute ?? 0),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    dayMonth: `${parts.day}/${parts.month}`,
  };
}

/** '19:00' no fuso da quadra. */
export function formatZonedTime(date: Date): string {
  const { hour, minute } = zonedParts(date);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** 'sexta, 22/08 às 19:00' — usado nas mensagens de conflito. */
export function formatZonedDateTime(date: Date): string {
  const { weekday, dayMonth } = zonedParts(date);
  return `${shortWeekday(weekday).toLowerCase()}, ${dayMonth} às ${formatZonedTime(date)}`;
}

/** 'sexta-feira' → 'Sexta'; 'sábado' → 'Sábado'. */
function shortWeekday(weekday: string): string {
  const base = weekday.replace('-feira', '').trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Rótulo automático do período, do jeito que o organizador fala: "Sexta à
 * noite", "Sábado o dia inteiro". É gravado junto da reserva para a agenda não
 * precisar recalcular nada.
 */
export function describePeriod(startAt: Date, endAt: Date): string {
  const start = zonedParts(startAt);
  const end = zonedParts(endAt);
  const hours = (endAt.getTime() - startAt.getTime()) / 3_600_000;
  const crossesMidnight = end.dateKey !== start.dateKey;
  const endHourDecimal = end.hour + end.minute / 60;

  let part: string;
  if (hours >= 8 && !crossesMidnight) part = 'o dia inteiro';
  else if (crossesMidnight || start.hour >= 17) part = 'à noite';
  else if (start.hour >= 12) part = 'à tarde';
  else if (endHourDecimal <= 13) part = 'de manhã';
  else part = 'durante o dia';

  return `${shortWeekday(start.weekday)} ${part}`;
}

export interface PeriodRange {
  startAt: Date;
  endAt: Date;
}

/**
 * Regras que valem tanto no formulário quanto na API: períodos coerentes, dentro
 * do limite de duração e sem se atropelarem. Devolve a mensagem de erro pronta
 * para exibir, ou null quando está tudo certo.
 */
export function validatePeriods(periods: PeriodRange[]): string | null {
  if (periods.length === 0) {
    return 'Adicione pelo menos um período para o campeonato.';
  }
  if (periods.length > MAX_TOURNAMENT_PERIODS) {
    return `Um campeonato pode ter no máximo ${MAX_TOURNAMENT_PERIODS} períodos.`;
  }

  const now = Date.now();
  const limit = now + MAX_TOURNAMENT_DAYS_AHEAD * 24 * 60 * 60 * 1000;

  for (const period of periods) {
    if (Number.isNaN(period.startAt.getTime()) || Number.isNaN(period.endAt.getTime())) {
      return 'Período com data ou horário inválido.';
    }
    if (period.endAt <= period.startAt) {
      return 'O término de cada período precisa ser depois do início.';
    }
    const hours = (period.endAt.getTime() - period.startAt.getTime()) / 3_600_000;
    if (hours > MAX_PERIOD_HOURS) {
      return `Cada período pode ter no máximo ${MAX_PERIOD_HOURS} horas. Divida em mais de um período.`;
    }
    if (period.endAt.getTime() <= now) {
      return 'Não dá para criar um período que já terminou.';
    }
    if (period.startAt.getTime() > limit) {
      return 'Períodos só podem ser agendados para o próximo ano.';
    }
  }

  const sorted = [...periods].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startAt.getTime() < sorted[i - 1].endAt.getTime()) {
      return 'Dois períodos do campeonato se sobrepõem. Ajuste os horários.';
    }
  }

  return null;
}

/** Nome limpo do campeonato, ou null quando o que veio não serve. */
export function sanitizeTournamentName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > MAX_TOURNAMENT_NAME_LENGTH) return null;
  return name;
}

/** True quando a reserva é um bloco de campeonato (e não um jogo de verdade). */
export function isTournamentReservation(
  data: { type?: string | null } | null | undefined
): boolean {
  return data?.type === TOURNAMENT_RESERVATION_TYPE;
}

/**
 * Reservas com `type` diferente de 'play' são bloqueios (campeonato, "Quem
 * anima?") e nunca contam como jogo — nem no ranking, nem nas estatísticas.
 */
export function isPlayedReservation(
  data: { type?: string | null } | null | undefined
): boolean {
  const type = data?.type;
  return !type || type === 'play';
}
