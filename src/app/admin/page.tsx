'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Court } from '@/lib/types';
import { COURTS, DEVELOPER_EMAIL } from '@/lib/courts';
import { Plus, Trash2, UserMinus, UserPlus, RefreshCw, Pencil, Check, X } from 'lucide-react';

interface UserBasic {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

async function fetchUserBasic(userId: string): Promise<UserBasic | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    firstName: d.firstName ?? '',
    lastName: d.lastName ?? '',
    email: d.email ?? '',
  };
}

export default function AdminPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [managersMap, setManagersMap] = useState<Record<string, UserBasic[]>>({});
  const [allUsers, setAllUsers] = useState<UserBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCourtName, setNewCourtName] = useState('');
  const [newCourtId, setNewCourtId] = useState('');
  const [creating, setCreating] = useState(false);
  const [addManagerSearch, setAddManagerSearch] = useState<Record<string, string>>({});
  const [seeding, setSeeding] = useState(false);
  const [editingName, setEditingName] = useState<Record<string, string>>({});

  const loadCourts = async () => {
    const snap = await getDocs(collection(db, 'courts'));
    const loaded: Court[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Court, 'id'>),
    }));
    loaded.sort((a, b) => a.name.localeCompare(b.name));
    setCourts(loaded);

    const map: Record<string, UserBasic[]> = {};
    for (const court of loaded) {
      const managers: UserBasic[] = [];
      for (const uid of court.managerIds ?? []) {
        const u = await fetchUserBasic(uid);
        if (u) managers.push(u);
      }
      map[court.id] = managers;
    }
    setManagersMap(map);
  };

  const loadUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    const users: UserBasic[] = snap.docs
      .filter((d) => d.data().isAnonymous !== true && d.data().email !== DEVELOPER_EMAIL)
      .map((d) => ({
        id: d.id,
        firstName: d.data().firstName ?? '',
        lastName: d.data().lastName ?? '',
        email: d.data().email ?? '',
      }));
    setAllUsers(users);
  };

  useEffect(() => {
    Promise.all([loadCourts(), loadUsers()]).finally(() => setLoading(false));
  }, []);

  const handleSeedDefaultCourts = async () => {
    setSeeding(true);
    try {
      const uid = auth.currentUser?.uid ?? '';
      for (const court of COURTS) {
        const ref = doc(db, 'courts', court.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            name: court.name,
            managerIds: [],
            createdAt: Timestamp.now(),
            createdBy: uid,
          });
        }
      }
      await loadCourts();
    } finally {
      setSeeding(false);
    }
  };

  const handleRenameCourt = async (courtId: string) => {
    const newName = (editingName[courtId] ?? '').trim();
    if (!newName) return;
    await updateDoc(doc(db, 'courts', courtId), { name: newName });
    setEditingName((prev) => {
      const next = { ...prev };
      delete next[courtId];
      return next;
    });
    await loadCourts();
  };

  const handleCreateCourt = async () => {
    const id = newCourtId.trim().replace(/\s+/g, '_').toLowerCase();
    const name = newCourtName.trim();
    if (!id || !name) return;
    setCreating(true);
    try {
      const uid = auth.currentUser?.uid ?? '';
      await setDoc(doc(db, 'courts', id), {
        name,
        managerIds: [],
        createdAt: Timestamp.now(),
        createdBy: uid,
      });
      setNewCourtId('');
      setNewCourtName('');
      await loadCourts();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCourt = async (courtId: string) => {
    if (!confirm(`Excluir a quadra "${courtId}"? As reservas existentes não serão apagadas.`)) return;
    await deleteDoc(doc(db, 'courts', courtId));
    await loadCourts();
  };

  const handleAddManager = async (courtId: string, user: UserBasic) => {
    await updateDoc(doc(db, 'courts', courtId), {
      managerIds: arrayUnion(user.id),
    });
    setAddManagerSearch((prev) => ({ ...prev, [courtId]: '' }));
    await loadCourts();
  };

  const handleRemoveManager = async (courtId: string, userId: string) => {
    await updateDoc(doc(db, 'courts', courtId), {
      managerIds: arrayRemove(userId),
    });
    await loadCourts();
  };

  const getSuggestions = (courtId: string) => {
    const search = (addManagerSearch[courtId] ?? '').toLowerCase().trim();
    if (!search) return [];
    return allUsers
      .filter((u) => {
        return (
          u.email.toLowerCase().includes(search) ||
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(search)
        );
      })
      .filter((u) => !(managersMap[courtId] ?? []).some((m) => m.id === u.id))
      .slice(0, 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const defaultCourtsExist = COURTS.every((c) => courts.some((fc) => fc.id === c.id));

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Painel do Desenvolvedor</h1>
        <p className="text-sm text-gray-500 mt-1">{DEVELOPER_EMAIL}</p>
      </div>

      {!defaultCourtsExist && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 mb-3">
            As quadras padrão ainda não existem no banco.
          </p>
          <button
            onClick={handleSeedDefaultCourts}
            disabled={seeding}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            {seeding ? 'Criando...' : 'Criar Igrejinha e Três Coroas'}
          </button>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Quadras ({courts.length})</h2>

        {courts.length === 0 && (
          <p className="text-sm text-gray-500">Nenhuma quadra cadastrada ainda.</p>
        )}

        {courts.map((court) => {
          const editing = court.id in editingName;

          return (
            <div key={court.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName[court.id]}
                        onChange={(e) =>
                          setEditingName((prev) => ({ ...prev, [court.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameCourt(court.id);
                          if (e.key === 'Escape')
                            setEditingName((prev) => {
                              const next = { ...prev };
                              delete next[court.id];
                              return next;
                            });
                        }}
                        className="flex-1 px-2 py-1 text-base font-bold border-b-2 border-emerald-500 focus:outline-none bg-transparent"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameCourt(court.id)}
                        className="p-1 text-emerald-600 hover:text-emerald-700"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setEditingName((prev) => {
                            const next = { ...prev };
                            delete next[court.id];
                            return next;
                          })
                        }
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 truncate">{court.name}</h3>
                      <button
                        onClick={() =>
                          setEditingName((prev) => ({ ...prev, [court.id]: court.name }))
                        }
                        className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                        title="Renomear"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{court.id}</p>
                </div>
                <button
                  onClick={() => handleDeleteCourt(court.id)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Chefes de quadra
                </p>
                {(managersMap[court.id] ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhum chefe cadastrado.</p>
                ) : (
                  <ul className="space-y-2">
                    {(managersMap[court.id] ?? []).map((manager) => (
                      <li key={manager.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {manager.firstName} {manager.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{manager.email}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveManager(court.id, manager.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Adicionar chefe
                </p>
                <input
                  type="text"
                  value={addManagerSearch[court.id] ?? ''}
                  onChange={(e) =>
                    setAddManagerSearch((prev) => ({ ...prev, [court.id]: e.target.value }))
                  }
                  placeholder="Buscar por nome ou e-mail"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-emerald-500 focus:outline-none"
                />
                {getSuggestions(court.id).length > 0 && (
                  <ul className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                    {getSuggestions(court.id).map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => handleAddManager(court.id, u)}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 transition-colors flex items-center justify-between"
                        >
                          <div>
                            <span className="font-medium text-gray-900">
                              {u.firstName} {u.lastName}
                            </span>
                            <span className="text-gray-500 ml-2 text-xs">{u.email}</span>
                          </div>
                          <UserPlus className="w-4 h-4 text-emerald-600" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {(addManagerSearch[court.id] ?? '').trim() && getSuggestions(court.id).length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Nenhum usuário encontrado.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-600" />
          Nova quadra
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">NOME</label>
            <input
              type="text"
              value={newCourtName}
              onChange={(e) => setNewCourtName(e.target.value)}
              placeholder="Ex: Três Coroas"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ID (único, sem espaços)</label>
            <input
              type="text"
              value={newCourtId}
              onChange={(e) => setNewCourtId(e.target.value.replace(/\s+/g, '_').toLowerCase())}
              placeholder="Ex: quadra_3"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-emerald-500 focus:outline-none font-mono"
            />
          </div>
          <button
            onClick={handleCreateCourt}
            disabled={creating || !newCourtName.trim() || !newCourtId.trim()}
            className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Criando...' : 'Criar quadra'}
          </button>
        </div>
      </div>
    </div>
  );
}
