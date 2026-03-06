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
  /** Quando true, o popup de boas-vindas não é mais exibido. */
  welcomePopupSeen?: boolean;
}

export interface Reservation {
  id: string;
  startAt: Timestamp;
  endAt: Timestamp;
  createdById: string;
  createdAt: Timestamp;
  /** Quadra da reserva. Ausente em reservas antigas = 'quadra_1'. */
  courtId?: string;
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
