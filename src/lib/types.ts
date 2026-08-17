import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  pictureUrl?: string;
  isAnonymous: boolean;
  isPrivate?: boolean;
  createdAt: Timestamp;
  /** When true, the welcome popup is no longer shown. */
  welcomePopupSeen?: boolean;
  /** Court IDs the user selected when joining the app. */
  courtIds?: string[];
}

/**
 * 'play' (ou ausente, em docs antigos) é jogo de verdade. Os outros são
 * bloqueios de quadra e não contam como partida jogada.
 */
export type ReservationType = 'play' | 'organizing' | 'tournament';

export interface Reservation {
  id: string;
  startAt: Timestamp;
  endAt: Timestamp;
  createdById: string;
  createdAt: Timestamp;
  /** Court for this reservation. Missing on legacy rows = 'quadra_1'. */
  courtId?: string;
  /** Ausente = reserva comum de jogo. Ver ReservationType. */
  type?: ReservationType;
  /** Campeonato dono do bloco (só quando type === 'tournament'). */
  tournamentId?: string;
  /**
   * Nome do campeonato copiado para dentro da reserva: a agenda desenha o bloco
   * sem precisar de uma leitura extra por reserva. Renomear o campeonato
   * reescreve este campo em todos os blocos dele.
   */
  tournamentName?: string;
  /** Rótulo do período, ex.: "Sexta à noite". */
  periodLabel?: string;
}

export interface Tournament {
  id: string;
  name: string;
  courtId: string;
  createdById: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/** Um período do campeonato é, na prática, a reserva que bloqueia a quadra. */
export interface TournamentPeriod {
  /** Id da reserva correspondente. */
  id: string;
  startAt: Timestamp;
  endAt: Timestamp;
  label: string;
}

export interface ReservationParticipant {
  id: string;
  reservationId: string;
  userId?: string;
  guestName?: string;
  order: number;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string | null;
  createdAt: Timestamp;
}

export interface Challenge {
  id: string;
  fromUserId: string;
  toUserId: string;
  message?: string;
  status: 'pending' | 'pending_schedule' | 'accepted' | 'declined' | 'cancelled';
  createdAt: Timestamp;
  /** Preenchido quando o adversário marca horário (status vira accepted). */
  reservationId?: string;
}

export type DurationMode = 'fixed' | 'free' | 'max';

export interface CourtReservationRules {
  durationMode: DurationMode;
  /** Duração exata em minutos (usado quando durationMode === 'fixed'). Padrão: 90. */
  fixedMinutes: number;
  /** Duração máxima em minutos (usado quando durationMode === 'max'). Padrão: 300. */
  maxMinutes: number;
  /** Máximo de reservas por dia por pessoa. null/undefined = sem limite (livre). */
  maxReservationsPerDay?: number | null;
  /** Máximo de reservas por semana por pessoa. null/undefined = sem limite (livre). */
  maxReservationsPerWeek?: number | null;
}

export interface Court {
  id: string;
  name: string;
  managerIds: string[];
  createdAt: Timestamp;
  createdBy: string;
  reservationRules?: CourtReservationRules;
}

export interface CourtStatus {
  isOccupied: boolean;
  participants?: string[];
  reservation?: Reservation;
}
