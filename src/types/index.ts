import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  pictureUrl?: string;
  isAnonymous: boolean;
  isPrivate: boolean;
  createdAt: Timestamp;
}

export interface Reservation {
  id: string;
  startAt: Timestamp;
  endAt: Timestamp;
  createdById: string;
  createdAt: Timestamp;
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
  createdAt: Timestamp;
}

export interface Challenge {
  id: string;
  fromUserId: string;
  toUserId: string;
  message?: string;
  status: 'pending' | 'pending_schedule' | 'accepted' | 'declined' | 'cancelled';
  createdAt: Timestamp;
  reservationId?: string;
}

export interface CourtStatus {
  isOccupied: boolean;
  participants?: string[];
  reservation?: Reservation;
}
