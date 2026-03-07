'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Search, Check } from 'lucide-react';

interface CourtOption {
  id: string;
  name: string;
}

export default function SelecionarQuadraPage() {
  const router = useRouter();
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'courts')).then((snap) => {
      const list: CourtOption[] = snap.docs
        .map((d) => ({ id: d.id, name: d.data().name as string }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setCourts(list);
      setLoading(false);
    });
  }, []);

  const filtered = search.trim()
    ? courts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : courts;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEnter = async () => {
    if (selected.size === 0) return;
    const user = auth.currentUser;
    if (!user) { router.push('/login'); return; }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { courtIds: Array.from(selected) },
        { merge: true }
      );
      router.push('/home');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-emerald-50 to-white">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Escolha sua quadra</h1>
          <p className="text-gray-600">Selecione uma ou mais quadras em que você joga</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar quadra..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Nenhuma quadra encontrada</p>
          ) : (
            filtered.map((court) => {
              const isSelected = selected.has(court.id);
              return (
                <button
                  key={court.id}
                  type="button"
                  onClick={() => toggle(court.id)}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border-2 transition-colors text-left ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
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
        </div>

        <button
          onClick={handleEnter}
          disabled={selected.size === 0 || saving}
          className="w-full bg-emerald-600 text-white rounded-xl px-6 py-3 font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving
            ? 'Entrando...'
            : selected.size === 0
            ? 'Selecione ao menos uma quadra'
            : `Entrar${selected.size > 1 ? ` (${selected.size} quadras)` : ''}`}
        </button>
      </div>
    </div>
  );
}
