'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Search, UserPlus } from 'lucide-react';

/** Hosts externos de avatar; em prod o next/image pode falhar se não estiverem no config. */
const EXTERNAL_AVATAR_HOSTS = ['i.ibb.co', 'i.imgur.com', 'lh3.googleusercontent.com', 'firebasestorage.googleapis.com'];

function isExternalAvatarUrl(url: string): boolean {
  try {
    return EXTERNAL_AVATAR_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
import { collection, getDocs, getDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import ErrorWithSupportLink from '@/components/ui/ErrorWithSupportLink';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  pictureUrl?: string;
}

interface ModalNovaReservaProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedDate?: Date;
  initialParticipantIds?: string[];
  /** Quando preenchido (aceite de desafio), ao criar a reserva o desafio é marcado como aceito. */
  challengeId?: string;
  /** Quando preenchido, abre em modo edição: só altera participantes da reserva existente. */
  reservationId?: string;
}

export default function ModalNovaReserva({ isOpen, onClose, onSuccess, selectedDate, initialParticipantIds = [], challengeId, reservationId }: ModalNovaReservaProps) {
  const isEditMode = Boolean(reservationId?.trim());
  const [date, setDate] = useState('');
  const [hour, setHour] = useState('19');
  const [minute, setMinute] = useState('00');
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Janela de 7 dias: hoje até hoje+6 (igual ao reservationValidator)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const minDate = toYMD(today);
  const maxDateObj = new Date(today);
  maxDateObj.setDate(today.getDate() + 6);
  const maxDate = toYMD(maxDateObj);

  useEffect(() => {
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      // Manter dentro da janela de 7 dias
      if (dateStr < minDate) setDate(minDate);
      else if (dateStr > maxDate) setDate(maxDate);
      else setDate(dateStr);
    }
  }, [selectedDate, minDate, maxDate]);

  // Ao abrir o modal, garantir que a data esteja na janela de 7 dias (ex.: estado antigo)
  useEffect(() => {
    if (!isOpen || !date) return;
    if (date < minDate || date > maxDate) setDate(minDate);
  }, [isOpen, date, minDate, maxDate]);

  useEffect(() => {
    const fetchUsers = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Buscar usuário atual
      const currentUserDoc = await getDocs(
        query(collection(db, 'users'), where('__name__', '==', user.uid))
      );
      
      if (!currentUserDoc.empty) {
        const userData = currentUserDoc.docs[0].data();
        setCurrentUser({
          id: user.uid,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          pictureUrl: userData.pictureUrl,
        });
      }

      // Buscar todos os usuários (exceto anônimos e o próprio usuário).
      // Não filtramos por isAnonymous no Firestore para incluir contas email/senha
      // cujo documento pode não ter o campo isAnonymous; filtramos anônimos em memória.
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users: User[] = usersSnapshot.docs
        .filter((d) => d.id !== user.uid && d.data().isAnonymous !== true)
        .map((d) => ({
          id: d.id,
          firstName: d.data().firstName,
          lastName: d.data().lastName,
          email: d.data().email,
          pictureUrl: d.data().pictureUrl,
        }));
      
      setAllUsers(users);
      setFilteredUsers(users);
    };

    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || initialParticipantIds.length === 0) {
      if (!isOpen) setSelectedParticipants([]);
      return;
    }
    const loadInitialParticipants = async () => {
      const users: User[] = [];
      for (const userId of initialParticipantIds) {
        try {
          const snap = await getDoc(doc(db, 'users', userId));
          if (snap.exists()) {
            const d = snap.data();
            users.push({
              id: snap.id,
              firstName: d.firstName ?? '',
              lastName: d.lastName ?? '',
              email: d.email ?? '',
              pictureUrl: d.pictureUrl,
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
      setSelectedParticipants((prev) => {
        const ids = new Set(prev.map((u) => u.id));
        const newUsers = users.filter((u) => !ids.has(u.id));
        return [...prev, ...newUsers];
      });
    };
    loadInitialParticipants();
  }, [isOpen, initialParticipantIds.join(',')]);

  useEffect(() => {
    if (!isOpen || !reservationId?.trim()) return;
    const toYMD = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const loadReservationForEdit = async () => {
      try {
        const resSnap = await getDoc(doc(db, 'reservations', reservationId.trim()));
        if (!resSnap.exists()) return;
        const resData = resSnap.data();
        const startAt = resData?.startAt?.toDate?.();
        if (!startAt) return;
        const y = startAt.getFullYear();
        const m = String(startAt.getMonth() + 1).padStart(2, '0');
        const d = String(startAt.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const minD = toYMD(today);
        const maxDateObj = new Date(today);
        maxDateObj.setDate(today.getDate() + 6);
        const maxD = toYMD(maxDateObj);
        const clamped = dateStr < minD ? minD : dateStr > maxD ? maxD : dateStr;
        setDate(clamped);
        setHour(String(startAt.getHours()).padStart(2, '0'));
        setMinute(String(startAt.getMinutes()).padStart(2, '0'));

        const participantsSnap = await getDocs(
          query(
            collection(db, 'reservationParticipants'),
            where('reservationId', '==', reservationId.trim())
          )
        );
        const participantIds: string[] = [];
        participantsSnap.docs.forEach((docSnap) => {
          const uid = docSnap.data().userId;
          if (uid && uid !== auth.currentUser?.uid) participantIds.push(uid);
        });

        const users: User[] = [];
        for (const userId of participantIds) {
          const snap = await getDoc(doc(db, 'users', userId));
          if (snap.exists()) {
            const data = snap.data();
            users.push({
              id: snap.id,
              firstName: data?.firstName ?? '',
              lastName: data?.lastName ?? '',
              email: data?.email ?? '',
              pictureUrl: data?.pictureUrl,
            });
          }
        }
        setSelectedParticipants(users);
      } catch (e) {
        console.error('Erro ao carregar reserva para edição:', e);
      }
    };
    loadReservationForEdit();
  }, [isOpen, reservationId]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(allUsers);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = allUsers.filter(
        (user) =>
          (user.firstName ?? '').toLowerCase().includes(term) ||
          (user.lastName ?? '').toLowerCase().includes(term) ||
          (user.email ?? '').toLowerCase().includes(term)
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, allUsers]);

  const addParticipant = (user: User) => {
    if (!selectedParticipants.find((p) => p.id === user.id)) {
      setSelectedParticipants([...selectedParticipants, user]);
    }
    setSearchTerm('');
  };

  const removeParticipant = (userId: string) => {
    setSelectedParticipants(selectedParticipants.filter((p) => p.id !== userId));
  };

  const calculateEndTime = () => {
    const startMinutes = parseInt(hour) * 60 + parseInt(minute);
    const endMinutes = startMinutes + 90;
    const endHour = Math.floor(endMinutes / 60);
    const endMinute = endMinutes % 60;
    if (endHour >= 24) {
      const h = endHour % 24;
      return `${h.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')} (dia seguinte)`;
    }
    return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError('Faça login para reservar.');
      return;
    }
    setLoading(true);
    setError('');

    if (isEditMode && reservationId?.trim()) {
      const hourNum = parseInt(hour, 10);
      const minuteNum = parseInt(minute, 10);
      if (Number.isNaN(hourNum) || Number.isNaN(minuteNum)) {
        setError('Horário inválido. Selecione hora e minuto.');
        setLoading(false);
        return;
      }
      const dateStr = date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        setError('Data inválida. Selecione uma data.');
        setLoading(false);
        return;
      }
      const [y, mo, d] = dateStr.split('-').map(Number);
      const startAtLocal = new Date(y, mo - 1, d, hourNum, minuteNum, 0, 0);
      if (Number.isNaN(startAtLocal.getTime())) {
        setError('Data/horário inválido.');
        setLoading(false);
        return;
      }
      const startAtISO = startAtLocal.toISOString();
      try {
        const response = await fetch(`/api/reservations/${reservationId.trim()}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: uid,
            participantIds: selectedParticipants.map((p) => p.id),
            startAtISO,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error ?? 'Erro ao atualizar reserva. Tente novamente.');
          setLoading(false);
          return;
        }
        onSuccess?.();
        onClose();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro ao atualizar reserva';
        setError(message);
      } finally {
        setLoading(false);
      }
      return;
    }

    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);
    if (Number.isNaN(hourNum) || Number.isNaN(minuteNum)) {
      setError('Horário inválido. Selecione hora e minuto.');
      return;
    }

    // Horário de início no fuso do usuário (evita erro no servidor em UTC)
    const dateStr = date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      setError('Data inválida. Selecione uma data.');
      return;
    }
    const [y, mo, d] = dateStr.split('-').map(Number);
    const startAtLocal = new Date(y, mo - 1, d, hourNum, minuteNum, 0, 0);
    if (Number.isNaN(startAtLocal.getTime())) {
      setError('Data/horário inválido.');
      return;
    }
    const startAtISO = startAtLocal.toISOString();

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          startAtISO,
          participantIds: selectedParticipants.map((p) => p.id),
          challengeId: challengeId ?? undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? 'Erro ao criar reserva. Tente novamente.');
        setLoading(false);
        return;
      }

      if (challengeId && data.reservationId) {
        try {
          await updateDoc(doc(db, 'challenges', challengeId), {
            status: 'accepted',
            reservationId: data.reservationId,
          });
        } catch (e) {
          console.error('Erro ao marcar desafio como aceito:', e);
        }
      }

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar reserva';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center sm:justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">{isEditMode ? 'Editar reserva' : 'Nova Reserva'}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">
              <ErrorWithSupportLink message={error} roleAlert />
            </div>
          )}

          {/* Data e horário (nova reserva e edição) */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              DATA
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={minDate}
              max={maxDate}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none"
              required
            />
            <p className="text-xs text-gray-600 mt-1">
              {date && new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HORÁRIO DE INÍCIO
            </label>
            <div className="flex items-center gap-2">
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i.toString().padStart(2, '0')}>
                    {i.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="text-gray-500 font-medium">:</span>
              <select
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none"
              >
                {['00', '15', '30', '45'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Término: <strong>{calculateEndTime()}</strong> (1h30)
            </p>
          </div>

          {/* Participantes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PARTICIPANTES (você + um ou mais jogadores)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              A reserva aparecerá no seu perfil e no de cada jogador adicionado.
            </p>
            
            {/* Current User */}
            {currentUser && (
              <div className="flex items-center gap-3 bg-emerald-50 rounded-xl p-3 mb-3">
                {currentUser.pictureUrl ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={currentUser.pictureUrl}
                      alt={`${currentUser.firstName} ${currentUser.lastName}`}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                      unoptimized={isExternalAvatarUrl(currentUser.pictureUrl)}
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {`${currentUser.firstName?.[0] ?? '?'}${currentUser.lastName?.[0] ?? '?'}`.toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-900">
                  {currentUser.firstName} {currentUser.lastName}
                </span>
              </div>
            )}

            {/* Selected Participants */}
            {selectedParticipants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-2"
              >
                <div className="flex items-center gap-3">
                  {participant.pictureUrl ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                      <Image
                        src={participant.pictureUrl}
                        alt={`${participant.firstName} ${participant.lastName}`}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full"
                        unoptimized={isExternalAvatarUrl(participant.pictureUrl)}
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {`${participant.firstName?.[0] ?? '?'}${participant.lastName?.[0] ?? '?'}`.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {participant.firstName} {participant.lastName}
                    </div>
                    <div className="text-xs text-gray-600">{participant.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeParticipant(participant.id)}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Remover
                </button>
              </div>
            ))}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Adicionar um ou mais jogadores..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Users List */}
            {searchTerm && (
              <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => addParticipant(user)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      {user.pictureUrl ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                          <Image
                            src={user.pictureUrl}
                            alt={`${user.firstName} ${user.lastName}`}
                            width={32}
                            height={32}
                            className="object-cover w-full h-full"
                            unoptimized={isExternalAvatarUrl(user.pictureUrl)}
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                          {`${user.firstName?.[0] ?? '?'}${user.lastName?.[0] ?? '?'}`.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-xs text-gray-600">{user.email}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center">
                    <div className="text-sm text-gray-600 mb-2">Nenhum jogador encontrado</div>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium mx-auto"
                    >
                      <UserPlus className="w-4 h-4" />
                      Convidar jogador
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !date}
            className="w-full bg-emerald-600 text-white rounded-xl px-6 py-3 font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? (isEditMode ? 'Salvando...' : 'Confirmando...')
              : isEditMode
                ? 'Salvar participantes'
                : 'Confirmar Reserva'}
          </button>
        </form>
      </div>
    </div>
  );
}
