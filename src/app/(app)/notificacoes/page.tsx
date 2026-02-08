'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  onSnapshot,
  arrayUnion,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Check, X, Swords, XCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ChallengeWithAuthor {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserInitials: string;
  message: string;
  status: string;
  createdAt: Date;
  createdAtLabel: string;
}

type NotificationItem =
  | {
      type: 'received_challenge';
      id: string;
      createdAt: Date;
      createdAtLabel: string;
      challenge: ChallengeWithAuthor;
    }
  | {
      type: 'sent_challenge';
      id: string;
      createdAt: Date;
      createdAtLabel: string;
      challenge: ChallengeWithAuthor;
    }
  // Futuro: | { type: 'court_reserved'; id: string; fromUserName: string; createdAt: Date; createdAtLabel: string; }

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'agora';
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`;
  if (seconds < 604800) return `há ${Math.floor(seconds / 86400)} dias`;
  return date.toLocaleDateString('pt-BR');
}

export default function NotificacoesPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const buildReceivedFromSnap = async (
    docs: { id: string; data: () => Record<string, unknown> }[],
    currentUserId: string
  ): Promise<ChallengeWithAuthor[]> => {
    const received: ChallengeWithAuthor[] = [];
    for (const d of docs) {
      const data = d.data() as { fromUserId: string; message?: string; status?: string; createdAt?: { toDate: () => Date }; hiddenByUserIds?: string[] };
      if (data.status === 'cancelled') continue;
      if ((data.hiddenByUserIds ?? []).includes(currentUserId)) continue;
      const fromSnap = await getDoc(doc(db, 'users', data.fromUserId));
      const fromUser = fromSnap.exists() ? fromSnap.data() : {};
      const createdAt = data.createdAt?.toDate?.() ?? new Date();
      received.push({
        id: d.id,
        fromUserId: data.fromUserId,
        fromUserName: `${fromUser.firstName ?? ''} ${fromUser.lastName ?? ''}`.trim() || 'Jogador',
        fromUserInitials: `${(fromUser.firstName ?? 'J')[0]}${(fromUser.lastName ?? '?')[0]}`.toUpperCase(),
        message: data.message ?? '',
        status: data.status ?? 'pending',
        createdAt,
        createdAtLabel: formatTimeAgo(createdAt),
      });
    }
    return received;
  };

  const buildSentFromSnap = async (
    docs: { id: string; data: () => Record<string, unknown> }[],
    userId: string
  ): Promise<ChallengeWithAuthor[]> => {
    const sent: ChallengeWithAuthor[] = [];
    for (const d of docs) {
      const data = d.data() as { toUserId: string; message?: string; status?: string; createdAt?: { toDate: () => Date }; hiddenByUserIds?: string[] };
      if (data.status === 'cancelled') continue;
      if ((data.hiddenByUserIds ?? []).includes(userId)) continue;
      const toSnap = await getDoc(doc(db, 'users', data.toUserId));
      const toUser = toSnap.exists() ? toSnap.data() : {};
      const createdAt = data.createdAt?.toDate?.() ?? new Date();
      sent.push({
        id: d.id,
        fromUserId: userId,
        fromUserName: `${toUser.firstName ?? ''} ${toUser.lastName ?? ''}`.trim() || 'Jogador',
        fromUserInitials: `${(toUser.firstName ?? 'J')[0]}${(toUser.lastName ?? '?')[0]}`.toUpperCase(),
        message: data.message ?? '',
        status: data.status ?? 'pending',
        createdAt,
        createdAtLabel: formatTimeAgo(createdAt),
      });
    }
    return sent;
  };

  const mergeAndSort = (
    receivedItems: ChallengeWithAuthor[],
    sentItems: ChallengeWithAuthor[]
  ): NotificationItem[] => {
    const items: NotificationItem[] = [
      ...receivedItems.map((c) => ({
        type: 'received_challenge' as const,
        id: c.id,
        createdAt: c.createdAt,
        createdAtLabel: c.createdAtLabel,
        challenge: c,
      })),
      ...sentItems.map((c) => ({
        type: 'sent_challenge' as const,
        id: c.id,
        createdAt: c.createdAt,
        createdAtLabel: c.createdAtLabel,
        challenge: c,
      })),
    ];
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items;
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const receivedQuery = query(
      collection(db, 'challenges'),
      where('toUserId', '==', user.uid)
    );
    const sentQuery = query(
      collection(db, 'challenges'),
      where('fromUserId', '==', user.uid)
    );

    const initialLoadDone = { received: false, sent: false };
    const maybeDone = () => {
      if (initialLoadDone.received && initialLoadDone.sent) setLoading(false);
    };

    const unsubReceived = onSnapshot(receivedQuery, (snap) => {
      buildReceivedFromSnap(snap.docs, user.uid).then((received) => {
        initialLoadDone.received = true;
        maybeDone();
        setNotifications((prev) => {
          const sentItems = prev
            .filter((n): n is NotificationItem & { type: 'sent_challenge' } => n.type === 'sent_challenge')
            .map((n) => n.challenge);
          return mergeAndSort(received, sentItems);
        });
      });
    });

    const unsubSent = onSnapshot(sentQuery, (snap) => {
      buildSentFromSnap(snap.docs, user.uid).then((sent) => {
        initialLoadDone.sent = true;
        maybeDone();
        setNotifications((prev) => {
          const receivedItems = prev
            .filter((n): n is NotificationItem & { type: 'received_challenge' } => n.type === 'received_challenge')
            .map((n) => n.challenge);
          return mergeAndSort(receivedItems, sent);
        });
      });
    });

    return () => {
      unsubReceived();
      unsubSent();
    };
  }, []);

  // Marcar desafios recebidos pendentes como visualizados ao abrir a página
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const markReceivedPendingAsViewed = async () => {
      const q = query(
        collection(db, 'challenges'),
        where('toUserId', '==', user.uid),
        where('status', 'in', ['pending', 'pending_schedule'])
      );
      const snap = await getDocs(q);
      const batch = snap.docs.filter((d) => d.data().viewed !== true);
      for (const d of batch) {
        try {
          await updateDoc(doc(db, 'challenges', d.id), { viewed: true });
        } catch (e) {
          console.error(e);
        }
      }
    };

    markReceivedPendingAsViewed();
  }, []);

  const handleAccept = async (challengeId: string, fromUserId: string) => {
    try {
      await updateDoc(doc(db, 'challenges', challengeId), {
        status: 'pending_schedule',
      });
      router.push(
        `/reservar?adicionarJogador=${encodeURIComponent(fromUserId)}&challengeId=${encodeURIComponent(challengeId)}`
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDecline = async (challengeId: string) => {
    try {
      await updateDoc(doc(db, 'challenges', challengeId), {
        status: 'declined',
      });
      setNotifications((prev) =>
        prev.filter(
          (n) => !(n.type === 'received_challenge' && n.challenge.id === challengeId)
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelSent = async (challengeId: string) => {
    try {
      await updateDoc(doc(db, 'challenges', challengeId), {
        status: 'cancelled',
      });
      setNotifications((prev) =>
        prev.filter(
          (n) => !(n.type === 'sent_challenge' && n.challenge.id === challengeId)
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNotification = async (challengeId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await updateDoc(doc(db, 'challenges', challengeId), {
        hiddenByUserIds: arrayUnion(user.uid),
      });
      setNotifications((prev) =>
        prev.filter((n) => n.challenge.id !== challengeId)
      );
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>

      {notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm relative"
            >
              <button
                type="button"
                onClick={() => handleDeleteNotification(item.challenge.id)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Apagar notificação"
                aria-label="Apagar notificação"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {item.type === 'received_challenge' && (
                <>
                  <div className="flex items-start gap-3 mb-3">
                    <Link href={`/perfil/${item.challenge.fromUserId}`}>
                      <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {item.challenge.fromUserInitials}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 mb-0.5">
                        <Swords className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <Link
                          href={`/perfil/${item.challenge.fromUserId}`}
                          className="font-semibold text-gray-900 hover:underline"
                        >
                          {item.challenge.fromUserName}
                        </Link>
                        <span className="text-gray-500">te desafiou</span>
                      </div>
                      {item.challenge.message && (
                        <p className="text-sm text-gray-700 mb-1">
                          &quot;{item.challenge.message}&quot;
                        </p>
                      )}
                      <span className="text-xs text-gray-500">
                        {item.createdAtLabel}
                      </span>
                    </div>
                  </div>
                  {item.challenge.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(item.challenge.id, item.challenge.fromUserId)}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2 font-medium hover:bg-emerald-700 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Aceitar
                      </button>
                      <button
                        onClick={() => handleDecline(item.challenge.id)}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 rounded-xl px-4 py-2 font-medium hover:bg-gray-200 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Recusar
                      </button>
                    </div>
                  )}
                  {item.challenge.status === 'pending_schedule' && (
                    <div className="space-y-2">
                      <p className="text-sm text-emerald-700 flex items-center gap-1.5">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        Você aceitou. Marque o horário do duelo.
                      </p>
                      <Link
                        href={`/reservar?adicionarJogador=${encodeURIComponent(item.challenge.fromUserId)}&challengeId=${encodeURIComponent(item.challenge.id)}`}
                        className="block w-full text-center bg-emerald-600 text-white rounded-xl px-4 py-2 font-medium hover:bg-emerald-700 transition-colors"
                      >
                        Marcar horário
                      </Link>
                    </div>
                  )}
                </>
              )}

              {item.type === 'sent_challenge' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-700">
                    Desafio enviado para <strong>{item.challenge.fromUserName}</strong>
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      item.challenge.status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.challenge.status === 'declined'
                          ? 'bg-red-100 text-red-700'
                          : item.challenge.status === 'pending_schedule'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.challenge.status === 'pending'
                      ? 'Pendente'
                      : item.challenge.status === 'pending_schedule'
                        ? 'Aguardando horário'
                        : item.challenge.status === 'accepted'
                          ? 'Aceito'
                          : 'Recusado'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {item.createdAtLabel}
                  </span>
                  {(item.challenge.status === 'pending' || item.challenge.status === 'pending_schedule') && (
                    <button
                      type="button"
                      onClick={() => handleCancelSent(item.challenge.id)}
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors mt-1"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancelar desafio
                    </button>
                  )}
                </div>
              )}

              {/* Futuro: item.type === 'court_reserved' → "[nome] reservou a quadra pra vocês!" */}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-8">
          Nenhuma notificação
        </p>
      )}
    </div>
  );
}
