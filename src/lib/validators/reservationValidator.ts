import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';

export interface ValidationError {
  message: string;
  conflictingReservation?: {
    participants: string[];
    startTime: string;
    endTime: string;
  };
}

export async function validateReservation(
  userId: string,
  startAt: Date,
  endAt: Date
): Promise<{ valid: boolean; error?: ValidationError }> {
  // 1. Validar janela de 7 dias
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 6);
  maxDate.setHours(23, 59, 59, 999);

  if (startAt < today || startAt > maxDate) {
    return {
      valid: false,
      error: {
        message: 'Reservas disponíveis apenas para os próximos 7 dias',
      },
    };
  }

  // 2. Validar duração (1h30)
  const duration = (endAt.getTime() - startAt.getTime()) / (1000 * 60);
  if (duration !== 90) {
    return {
      valid: false,
      error: {
        message: 'A duração da reserva deve ser de 1h30',
      },
    };
  }

  // 3. Verificar conflitos
  const startTimestamp = Timestamp.fromDate(startAt);
  const endTimestamp = Timestamp.fromDate(endAt);

  const conflictingReservations = await adminDb
    .collection('reservations')
    .where('startAt', '<', endTimestamp)
    .where('endAt', '>', startTimestamp)
    .get();

  if (!conflictingReservations.empty) {
    const conflict = conflictingReservations.docs[0].data();
    
    // Buscar participantes
    const participants = await adminDb
      .collection('reservationParticipants')
      .where('reservationId', '==', conflictingReservations.docs[0].id)
      .get();

    const participantNames: string[] = [];
    for (const participantDoc of participants.docs) {
      const participantData = participantDoc.data();
      if (participantData.userId) {
        const userDoc = await adminDb.collection('users').doc(participantData.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          participantNames.push(userData?.firstName || 'Jogador');
        }
      } else if (participantData.guestName) {
        participantNames.push(participantData.guestName);
      }
    }

    return {
      valid: false,
      error: {
        message: `${participantNames.join(' e ')} vão jogar das ${conflict.startAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às ${conflict.endAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}, tente outro horário.`,
        conflictingReservation: {
          participants: participantNames,
          startTime: conflict.startAt.toDate().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          endTime: conflict.endAt.toDate().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      },
    };
  }

  // 4. Verificar limite de 1 reserva por dia
  const dayStart = new Date(startAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startAt);
  dayEnd.setHours(23, 59, 59, 999);

  const dayReservations = await adminDb
    .collection('reservations')
    .where('createdById', '==', userId)
    .where('startAt', '>=', Timestamp.fromDate(dayStart))
    .where('startAt', '<=', Timestamp.fromDate(dayEnd))
    .get();

  if (!dayReservations.empty) {
    return {
      valid: false,
      error: {
        message: 'Você já possui uma reserva neste dia. Máximo de 1 reserva por dia.',
      },
    };
  }

  // 5. Verificar limite de 4 reservas por semana
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Domingo
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekReservations = await adminDb
    .collection('reservations')
    .where('createdById', '==', userId)
    .where('startAt', '>=', Timestamp.fromDate(weekStart))
    .where('startAt', '<=', Timestamp.fromDate(weekEnd))
    .get();

  if (weekReservations.size >= 4) {
    return {
      valid: false,
      error: {
        message: 'Você atingiu o limite de 4 reservas por semana.',
      },
    };
  }

  return { valid: true };
}
