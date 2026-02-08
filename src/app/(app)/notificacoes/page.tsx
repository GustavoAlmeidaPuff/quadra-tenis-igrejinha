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
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Check, X, Swords } from 'lucide-react';
import Link from 'next/link';

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

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'agora';
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`;
  if (seconds < 604800) return `há ${Math.floor(seconds / 86400)} dias`;
  return date.toLocaleDateString('pt-BR');
}

export default function NotificacoesPage() {
  const [receivedChallenges, setReceivedChallenges] = useState<
    ChallengeWithAuthor[]
  >([]);
  const [sentChallenges, setSentChallenges] = useState<ChallengeWithAuthor[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const loadChallenges = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const received: ChallengeWithAuthor[] = [];
    const receivedQuery = query(
      collection(db, 'challenges'),
      where('toUserId', '==', user.uid)
    );
    const receivedSnap = await getDocs(receivedQuery);
    for (const d of receivedSnap.docs) {
      const data = d.data();
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

    const sent: ChallengeWithAuthor[] = [];
    const sentQuery = query(
      collection(db, 'challenges'),
      where('fromUserId', '==', user.uid)
    );
    const sentSnap = await getDocs(sentQuery);
    for (const d of sentSnap.docs) {
      const data = d.data();
      const toSnap = await getDoc(doc(db, 'users', data.toUserId));
      const toUser = toSnap.exists() ? toSnap.data() : {};
      const createdAt = data.createdAt?.toDate?.() ?? new Date();
      sent.push({
        id: d.id,
        fromUserId: user.uid,
        fromUserName: `${toUser.firstName ?? ''} ${toUser.lastName ?? ''}`.trim() || 'Jogador',
        fromUserInitials: `${(toUser.firstName ?? 'J')[0]}${(toUser.lastName ?? '?')[0]}`.toUpperCase(),
        message: data.message ?? '',
        status: data.status ?? 'pending',
        createdAt,
        createdAtLabel: formatTimeAgo(createdAt),
      });
    }

    setReceivedChallenges(
      received.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )
    );
    setSentChallenges(
      sent.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    );
    setLoading(false);
  };

  useEffect(() => {
    loadChallenges();
  }, []);

  // Marcar desafios recebidos pendentes como visualizados ao abrir a página
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const markReceivedPendingAsViewed = async () => {
      const q = query(
        collection(db, 'challenges'),
        where('toUserId', '==', user.uid),
        where('status', '==', 'pending')
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

  const handleAccept = async (challengeId: string) => {
    try {
      await updateDoc(doc(db, 'challenges', challengeId), {
        status: 'accepted',
      });
      setReceivedChallenges((prev) => prev.filter((c) => c.id !== challengeId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDecline = async (challengeId: string) => {
    try {
      await updateDoc(doc(db, 'challenges', challengeId), {
        status: 'declined',
      });
      setReceivedChallenges((prev) => prev.filter((c) => c.id !== challengeId));
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

  const pendingReceived = receivedChallenges.filter((c) => c.status === 'pending');

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>

      <div>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Desafios recebidos
        </h2>
        {pendingReceived.length > 0 ? (
          <div className="space-y-3">
            {pendingReceived.map((challenge) => (
              <div
                key={challenge.id}
                className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm"
              >
                <div className="flex items-start gap-3 mb-3">
                  <Link href={`/perfil/${challenge.fromUserId}`}>
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {challenge.fromUserInitials}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Swords className="w-4 h-4 text-emerald-600" />
                      <Link
                        href={`/perfil/${challenge.fromUserId}`}
                        className="font-semibold text-gray-900 hover:underline"
                      >
                        {challenge.fromUserName}
                      </Link>
                      <span className="text-gray-500">te desafiou!</span>
                    </div>
                    {challenge.message && (
                      <p className="text-sm text-gray-700 mb-1">
                        &quot;{challenge.message}&quot;
                      </p>
                    )}
                    <span className="text-xs text-gray-500">
                      {challenge.createdAtLabel}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
<button
                      onClick={() => handleAccept(challenge.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2 font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Aceitar
                  </button>
                  <button
                    onClick={() => handleDecline(challenge.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 rounded-xl px-4 py-2 font-medium hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">
            Nenhum desafio recebido
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Desafios enviados
        </h2>
        {sentChallenges.length > 0 ? (
          <div className="space-y-3">
            {sentChallenges.map((challenge) => (
              <div
                key={challenge.id}
                className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Desafio para <strong>{challenge.fromUserName}</strong>
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      challenge.status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-700'
                        : challenge.status === 'declined'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {challenge.status === 'pending'
                      ? 'Pendente'
                      : challenge.status === 'accepted'
                      ? 'Aceito'
                      : 'Recusado'}
                  </span>
                </div>
                <span className="text-xs text-gray-500 block mt-1">
                  {challenge.createdAtLabel}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">
            Você ainda não desafiou ninguém
          </p>
        )}
      </div>
    </div>
  );
}
