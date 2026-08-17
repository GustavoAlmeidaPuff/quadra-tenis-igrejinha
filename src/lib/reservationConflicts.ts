import { formatZonedTime, isTournamentReservation } from '@/lib/tournaments';

export interface ConflictInfo {
  startAt: Date;
  endAt: Date;
  type?: string | null;
  tournamentName?: string | null;
}

/**
 * Mensagem única para "esse horário já está ocupado", usada na criação, na
 * edição e no check-slot. Bloco de campeonato não tem participante, então a
 * frase dos jogadores não serve para ele.
 */
export function formatConflictMessage(
  conflict: ConflictInfo,
  participantNames: string[]
): string {
  const startStr = formatZonedTime(conflict.startAt);
  const endStr = formatZonedTime(conflict.endAt);

  if (isTournamentReservation(conflict)) {
    const name = conflict.tournamentName?.trim() || 'Um campeonato';
    return `${name} ocupa a quadra das ${startStr} às ${endStr}, tente outro horário.`;
  }

  if (participantNames.length === 0) {
    return `A quadra já está reservada das ${startStr} às ${endStr}, tente outro horário.`;
  }

  const namesText = participantNames.join(' e ');
  const verb = participantNames.length === 1 ? 'vai jogar' : 'vão jogar';
  return `${namesText} ${verb} das ${startStr} às ${endStr}, tente outro horário.`;
}
