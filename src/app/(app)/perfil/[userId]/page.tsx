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
  Shield,
  ChevronRight,
} from 'lucide-react';
import Avatar from '@/components/layout/Avatar';
import { User } from '@/lib/types';
import {
  getUserStats,
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

  const handleTogglePrivate = async () => {
    if (!auth.currentUser || !user) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        isPrivate: !user.isPrivate,
      });
      setUser((prev) => (prev ? { ...prev, isPrivate: !prev.isPrivate } : null));
    } catch (e) {
      console.error(e);
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
    const raw = user.createdAt;
    if (raw == null) return null;
    let date: Date | null = null;
    if (typeof raw === 'object' && typeof (raw as { toDate?: () => Date }).toDate === 'function') {
      date = (raw as { toDate: () => Date }).toDate();
    } else if (typeof raw === 'object' && 'seconds' in raw && typeof (raw as { seconds: number }).seconds === 'number') {
      date = new Date((raw as { seconds: number }).seconds * 1000);
    } else if (typeof raw === 'string') {
      date = new Date(raw);
    } else if (typeof raw === 'number') {
      date = new Date(raw);
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
            {user.email ? (
              <p className="text-sm text-gray-500 mb-4">{user.email}</p>
            ) : (
              <p className="text-sm text-gray-500 mb-4">
                {memberSinceLabel ? `Membro desde ${memberSinceLabel}` : 'Membro recente'}
              </p>
            )}
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
                        <p className="text-sm text-red-600" role="alert">
                          {passwordError}
                        </p>
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

              {/* Perfil privado + Sair da conta */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <label className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors">
                  <Shield className="w-5 h-5 text-gray-600 shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">Perfil privado</div>
                    <div className="text-xs text-gray-500">
                      Aparecer como anônimo nas reservas
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={user.isPrivate ?? false}
                    onChange={handleTogglePrivate}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-5 w-5"
                  />
                </label>
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
                  <ReservationCard key={res.id} item={res} />
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
        </>
      )}
    </div>
  );
}

function ReservationCard({ item }: { item: ReservationListItem }) {
  const participantsLabel = item.participants.length > 0
    ? item.participants.join(', ')
    : '—';
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-gray-900 capitalize">{item.dateLabel}</div>
        <div className="text-sm text-gray-500 truncate">
          {item.time} - {participantsLabel}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
    </div>
  );
}
