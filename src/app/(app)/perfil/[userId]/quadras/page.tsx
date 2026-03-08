'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { ArrowLeft, Check } from 'lucide-react';

interface CourtOption {
  id: string;
  name: string;
}

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default function MinhasQuadrasPage({ params }: PageProps) {
  const router = useRouter();
  const { userId } = use(params);

  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isMe = userId === auth.currentUser?.uid || userId === 'me';

  useEffect(() => {
    const load = async () => {
      const uid = userId === 'me' ? auth.currentUser?.uid : userId;
      if (!uid) return;

      const [courtsSnap, userSnap] = await Promise.all([
        getDocs(collection(db, 'courts')),
        getDoc(doc(db, 'users', uid)),
      ]);

      const list: CourtOption[] = courtsSnap.docs
        .map((d) => ({ id: d.id, name: d.data().name as string }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setCourts(list);

      const courtIds: string[] = userSnap.data()?.courtIds ?? [];
      setSelected(new Set(courtIds));
      setLoading(false);
    };

    if (userId === 'me' && !auth.currentUser) {
      const unsub = auth.onAuthStateChanged((u) => {
        if (u) load();
      });
      return () => unsub();
    }
    load();
  }, [userId]);

  const toggle = (id: string) => {
    if (!isMe) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!isMe || selected.size === 0) return;
    const user = auth.currentUser;
    if (!user) { router.push('/login'); return; }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { courtIds: Array.from(selected) },
        { merge: true }
      );
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-200">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Minhas quadras</h1>
      </div>

      <div className="px-4 py-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : courts.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Nenhuma quadra disponível.</p>
        ) : (
          courts.map((court) => {
            const isSelected = selected.has(court.id);
            return (
              <button
                key={court.id}
                type="button"
                onClick={() => toggle(court.id)}
                disabled={!isMe}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border-2 transition-colors text-left ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${!isMe ? 'cursor-default' : ''}`}
              >
                <span className={`font-medium ${isSelected ? 'text-emerald-700' : 'text-gray-800'}`}>
                  {court.name}
                </span>
                {isSelected && (
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })
        )}

        {isMe && !loading && (
          <button
            onClick={handleSave}
            disabled={selected.size === 0 || saving}
            className="w-full bg-emerald-600 text-white rounded-xl px-6 py-3 font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        )}
      </div>
    </div>
  );
}
