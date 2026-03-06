import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { normalizeCourtId } from '@/lib/courts';

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
  endAt: Date,
  courtId: string = 'quadra_1',
  excludeReservationId?: string
): Promise<{ valid: boolean; error?: ValidationError }> {
  const normalizedCourtId = normalizeCourtId(courtId);

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

  // 2. Validar duração conforme regras da quadra
  const duration = (endAt.getTime() - startAt.getTime()) / (1000 * 60);
  if (duration <= 0) {
    return { valid: false, error: { message: 'Duração inválida.' } };
  }

  const courtDoc = await adminDb.collection('courts').doc(normalizedCourtId).get();
  const rules = courtDoc.exists ? (courtDoc.data()?.reservationRules ?? null) : null;
  const durationMode = rules?.durationMode ?? 'fixed';
  const fixedMinutes = rules?.fixedMinutes ?? 90;
  const maxMinutes = rules?.maxMinutes ?? 300;

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}`;
  };

  if (durationMode === 'fixed') {
    if (duration !== fixedMinutes) {
      return {
        valid: false,
        error: { message: `A duração da reserva deve ser de ${formatMins(fixedMinutes)}` },
      };
    }
  } else if (durationMode === 'max') {
    if (duration > maxMinutes) {
      return {
        valid: false,
        error: { message: `A duração máxima da reserva é de ${formatMins(maxMinutes)}` },
      };
    }
  }

  // 3. Verificar conflitos na mesma quadra
  // Buscamos todas as reservas no intervalo de tempo e filtramos por court em memória
  // (backward compat: reservas sem courtId pertencem à quadra_1)
  const startTimestamp = Timestamp.fromDate(startAt);
  const endTimestamp = Timestamp.fromDate(endAt);

  const conflictingSnap = await adminDb
    .collection('reservations')
    .where('startAt', '<', endTimestamp)
    .where('endAt', '>', startTimestamp)
    .get();

  const conflictDoc = conflictingSnap.docs.find((doc) => {
    if (excludeReservationId && doc.id === excludeReservationId) return false;
    const docCourtId = normalizeCourtId(doc.data().courtId);
    return docCourtId === normalizedCourtId;
  });

  if (conflictDoc) {
    const conflict = conflictDoc.data();

    const participants = await adminDb
      .collection('reservationParticipants')
      .where('reservationId', '==', conflictDoc.id)
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

    const namesText = participantNames.join(' e ');
    const verb = participantNames.length === 1 ? 'vai jogar' : 'vão jogar';
    return {
      valid: false,
      error: {
        message: `${namesText} ${verb} das ${conflict.startAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às ${conflict.endAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}, tente outro horário.`,
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

  // 4. Verificar limite de 1 reserva por dia (por usuário, em qualquer quadra)
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

  const dayConflict = dayReservations.docs.find(
    (doc) => !excludeReservationId || doc.id !== excludeReservationId
  );

  if (dayConflict) {
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

  const weekCount = weekReservations.docs.filter(
    (doc) => !excludeReservationId || doc.id !== excludeReservationId
  ).length;

  if (weekCount >= 4) {
    return {
      valid: false,
      error: {
        message: 'Você atingiu o limite de 4 reservas por semana.',
      },
    };
  }

  return { valid: true };
}
