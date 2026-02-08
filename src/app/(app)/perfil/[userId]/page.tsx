'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signOut,
  linkWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import {
  ArrowLeft,
  Swords,
  Calendar,
  Clock,
  Pencil,
  LogOut,
  KeyRound,
  ChevronRight,
  MessageCircle,
  X,
  Trash2,
  Coffee,
} from 'lucide-react';
import Avatar from '@/components/layout/Avatar';
import ErrorWithSupportLink from '@/components/ui/ErrorWithSupportLink';
import { User } from '@/lib/types';
import {
  getUserStats,
  type UserStats,
  type ReservationListItem,
} from '@/lib/queries/stats';

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default function PerfilUserIdPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const userIdParam = resolvedParams.userId;
  const currentUid = auth.currentUser?.uid ?? null;
  const isMe = userIdParam === currentUid || userIdParam === 'me';

  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [challenging, setChallenging] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordEmail, setPasswordEmail] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [linkingPassword, setLinkingPassword] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ReservationListItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const uid =
      userIdParam === 'me'
        ? auth.currentUser?.uid
        : userIdParam;
    if (!uid) {
      if (userIdParam === 'me') return;
      router.replace('/login');
      return;
    }

    const load = async () => {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (!userSnap.exists()) {
        router.replace('/home');
        return;
      }

      const data = userSnap.data();
      const createdAt = data.createdAt;
      setUser({
        id: userSnap.id,
        email: data.email,
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        pictureUrl: data.pictureUrl,
        isAnonymous: data.isAnonymous ?? false,
        isPrivate: data.isPrivate ?? false,
        createdAt,
      });
      setEditFirstName(data.firstName ?? '');
      setEditLastName(data.lastName ?? '');

      if (data.isPrivate && !isMe && uid !== auth.currentUser?.uid) {
        setStats(null);
        setLoading(false);
        return;
      }

      try {
        const userStats = await getUserStats(uid);
        setStats(userStats);
      } catch (e) {
        console.error(e);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    if (userIdParam === 'me' && !auth.currentUser) {
      const unsub = auth.onAuthStateChanged((u) => {
        if (u) load();
      });
      return () => unsub();
    }
    load();
  }, [userIdParam, router, isMe]);

  const handleSaveProfile = async () => {
    if (!auth.currentUser || !user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
      });
      setUser((prev) =>
        prev
          ? {
              ...prev,
              firstName: editFirstName.trim(),
              lastName: editLastName.trim(),
            }
          : null
      );
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDesafiar = async () => {
    if (!auth.currentUser || !user || user.id === auth.currentUser.uid) return;
    setChallenging(true);
    try {
      await addDoc(collection(db, 'challenges'), {
        fromUserId: auth.currentUser.uid,
        toUserId: user.id,
        message: '',
        status: 'pending',
        viewed: false,
        createdAt: serverTimestamp(),
      });
      fetch('/api/notify-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: auth.currentUser.uid,
          toUserId: user.id,
        }),
      }).catch((err) => console.error('Erro ao enviar email de desafio:', err));
      router.push('/notificacoes');
    } catch (e) {
      console.error(e);
    } finally {
      setChallenging(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const refreshStats = async () => {
    const uid = userIdParam === 'me' ? auth.currentUser?.uid : userIdParam;
    if (!uid) return;
    try {
      const userStats = await getUserStats(uid);
      setStats(userStats);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!auth.currentUser) return;
    setCancelling(true);
    try {
      const res = await fetch(
        `/api/reservations?id=${encodeURIComponent(reservationId)}&userId=${encodeURIComponent(auth.currentUser.uid)}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (typeof data?.error === 'string' ? data.error : null) ?? 'Erro ao cancelar reserva';
        alert(msg);
        return;
      }
      setSelectedReservation(null);
      await refreshStats();
    } catch (e) {
      console.error(e);
      alert('Erro ao cancelar reserva. Verifique sua conexão.');
    } finally {
      setCancelling(false);
    }
  };

  const hasPasswordProvider =
    auth.currentUser?.providerData?.some((p) => p.providerId === 'password') ?? false;
  const canAddPassword =
    isMe &&
    auth.currentUser?.email &&
    !hasPasswordProvider;

  const handleOpenPasswordForm = () => {
    setPasswordEmail(auth.currentUser?.email ?? '');
    setPasswordValue('');
    setPasswordConfirm('');
    setPasswordError('');
    setShowPasswordForm(true);
  };

  const handleLinkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!passwordValue || passwordValue.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (passwordValue !== passwordConfirm) {
      setPasswordError('As senhas não coincidem.');
      return;
    }
    const email = passwordEmail.trim();
    if (!email) {
      setPasswordError('Email é obrigatório.');
      return;
    }
    if (!auth.currentUser) return;
    setLinkingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(email, passwordValue);
      await linkWithCredential(auth.currentUser, credential);
      setShowPasswordForm(false);
      setPasswordValue('');
      setPasswordConfirm('');
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      setPasswordError(
        code === 'auth/credential-already-in-use'
          ? 'Esta senha já está em uso em outra conta.'
          : 'Não foi possível definir a senha. Tente novamente.'
      );
    } finally {
      setLinkingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const memberSinceLabel = (() => {
    function toDate(raw: unknown): Date | null {
      if (raw == null) return null;
      if (typeof raw === 'object' && typeof (raw as { toDate?: () => Date }).toDate === 'function') {
        return (raw as { toDate: () => Date }).toDate();
      }
      if (typeof raw === 'object' && 'seconds' in raw && typeof (raw as { seconds: number }).seconds === 'number') {
        return new Date((raw as { seconds: number }).seconds * 1000);
      }
      if (typeof raw === 'string' || typeof raw === 'number') {
        const d = new Date(raw as string | number);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      return null;
    }
    let date = toDate(user.createdAt);
    if (!date && isMe && auth.currentUser?.metadata?.creationTime) {
      date = new Date(auth.currentUser.metadata.creationTime);
    }
    if (date && !Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    }
    return null;
  })();

  const showDesafiar =
    !isMe &&
    auth.currentUser &&
    user.id !== auth.currentUser.uid &&
    !user.isPrivate;

  const upcoming = stats?.upcomingReservations ?? [];
  const past = stats?.pastReservations ?? [];

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-6">
      {!isMe && (
        <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-200">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Perfil</h1>
        </div>
      )}

      {/* Cabeçalho do perfil: avatar, nome, email */}
      <div className="bg-white px-4 pt-8 pb-6 text-center border-b border-gray-200">
        <Avatar user={user} size="lg" className="mx-auto mb-4" />
        {editing ? (
          <div className="space-y-2 max-w-xs mx-auto">
            <input
              type="text"
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
              placeholder="Primeiro nome"
              className="w-full px-3 py-2 rounded-xl border border-gray-300"
            />
            <input
              type="text"
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
              placeholder="Último nome"
              className="w-full px-3 py-2 rounded-xl border border-gray-300"
            />
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {user.firstName} {user.lastName}
            </h2>
            <div className="text-sm text-gray-500 mb-4 space-y-0.5">
              {user.email && <p>{user.email}</p>}
              <p>
                {memberSinceLabel ? `Membro desde ${memberSinceLabel}` : 'Membro recente'}
              </p>
            </div>
            {isMe && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 mx-auto"
              >
                <Pencil className="w-4 h-4" />
                Editar perfil
              </button>
            )}
            {showDesafiar && (
              <button
                onClick={handleDesafiar}
                disabled={challenging}
                className="flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl px-6 py-2 font-medium hover:bg-emerald-700 transition-colors mx-auto mt-2 disabled:opacity-50"
              >
                <Swords className="w-4 h-4" />
                {challenging ? 'Enviando...' : 'Desafiar'}
              </button>
            )}
          </>
        )}
      </div>

      {user.isPrivate && !isMe && (
        <div className="p-8 text-center text-gray-500 text-sm">
          Este perfil é privado.
        </div>
      )}

      {(!user.isPrivate || isMe) && (
        <>
          {/* Cards de estatísticas: Horas jogadas, Total reservas, Semanas streak */}
          <div className="grid grid-cols-3 gap-3 px-4 py-6">
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
              <div className="text-2xl font-bold text-gray-900">
                {stats?.totalHours ?? 0}h
              </div>
              <div className="text-xs text-gray-500 mt-1">Horas jogadas</div>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
              <div className="text-2xl font-bold text-gray-900">
                {stats?.totalReservations ?? 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">Total reservas</div>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
              <div className="text-2xl font-bold text-gray-900">
                {stats?.weekStreak ?? 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">Semanas streak</div>
            </div>
          </div>

          {isMe && !editing && (
            <div className="px-4 space-y-4">
              {canAddPassword && (
                <>
                  {!showPasswordForm ? (
                    <button
                      onClick={handleOpenPasswordForm}
                      className="w-full flex items-center justify-center gap-2 py-3 text-gray-700 hover:bg-gray-50 rounded-2xl transition-colors text-sm"
                    >
                      <KeyRound className="w-4 h-4" />
                      Definir senha para entrar também com email e senha
                    </button>
                  ) : (
                    <form
                      onSubmit={handleLinkPassword}
                      className="space-y-3 p-4 bg-white rounded-2xl border border-gray-200"
                    >
                      <p className="text-xs text-gray-600">
                        Assim você poderá entrar na mesma conta com Google ou com
                        este email e senha.
                      </p>
                      <input
                        type="email"
                        value={passwordEmail}
                        onChange={(e) => setPasswordEmail(e.target.value)}
                        placeholder="Email"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                        readOnly
                      />
                      <input
                        type="password"
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        placeholder="Nova senha (mín. 6 caracteres)"
                        minLength={6}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      />
                      <input
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="Confirmar senha"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      />
                      {passwordError && (
                        <div className="text-sm text-red-600">
                          <ErrorWithSupportLink message={passwordError} roleAlert />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={linkingPassword}
                          className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                        >
                          {linkingPassword ? 'Salvando...' : 'Definir senha'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordForm(false);
                            setPasswordError('');
                          }}
                          disabled={linkingPassword}
                          className="py-2 px-3 rounded-lg border border-gray-300 text-gray-700 text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}

              {/* Suporte + Sair da conta */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <a
                  href="https://wa.me/5551997188572?text=Ol%C3%A1%21%20preciso%20de%20ajuda%20no%20app%20de%20reservar%20horarios%20na%20quadra%2C%20por%20favor%21"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-4 text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar com suporte
                </a>
                <a
                  href="/cafe"
                  className="w-full flex items-center justify-center gap-2 py-4 text-black hover:bg-gray-100 transition-colors border-t border-gray-100"
                >
                  <Coffee className="w-4 h-4" />
                  Pague-me um café
                </a>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-4 text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </div>
            </div>
          )}

          {/* Próximas reservas */}
          <div className="px-4 pt-6 pb-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Próximas reservas
            </h2>
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
              </div>
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">Nenhuma reserva próxima.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((res) => (
                  <ReservationCard
                    key={res.id}
                    item={res}
                    isUpcoming
                    onClick={() => setSelectedReservation(res)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Histórico */}
          <div className="px-4 pt-4 pb-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              <Clock className="w-4 h-4 text-emerald-600" />
              Histórico
            </h2>
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
              </div>
            ) : past.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">Nenhuma reserva no histórico.</p>
            ) : (
              <div className="space-y-2">
                {past.map((res) => (
                  <ReservationCard key={res.id} item={res} />
                ))}
              </div>
            )}
          </div>

          {/* Modal de detalhes e cancelamento da reserva */}
          {selectedReservation && (
            <ReservationDetailModal
              item={selectedReservation}
              onClose={() => setSelectedReservation(null)}
              onCancel={handleCancelReservation}
              cancelling={cancelling}
            />
          )}
        </>
      )}
    </div>
  );
}

function ReservationCard({
  item,
  isUpcoming,
  onClick,
}: {
  item: ReservationListItem;
  isUpcoming?: boolean;
  onClick?: () => void;
}) {
  const participantsLabel = item.participants.length > 0
    ? item.participants.join(', ')
    : '—';
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-gray-900 capitalize">{item.dateLabel}</div>
        <div className="text-sm text-gray-500 truncate">
          {item.time} - {participantsLabel}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
    </>
  );
  if (isUpcoming && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
      >
        {content}
      </button>
    );
  }
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center justify-between gap-3">
      {content}
    </div>
  );
}

function ReservationDetailModal({
  item,
  onClose,
  onCancel,
  cancelling,
}: {
  item: ReservationListItem;
  onClose: () => void;
  onCancel: (reservationId: string) => void;
  cancelling: boolean;
}) {
  const participantsLabel = item.participants.length > 0
    ? item.participants.join(', ')
    : '—';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Detalhes da reserva</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2 mb-6">
          <p className="font-medium text-gray-900 capitalize">{item.dateLabel}</p>
          <p className="text-sm text-gray-500">{item.time}</p>
          <p className="text-sm text-gray-600">{participantsLabel}</p>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Ao cancelar, a reserva será removida para todos os participantes.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onCancel(item.id)}
            disabled={cancelling}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {cancelling ? 'Cancelando...' : 'Cancelar reserva'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={cancelling}
            className="py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
