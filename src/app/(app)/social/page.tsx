'use client';

import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDoc,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Search, MoreVertical, Pencil, Trash2, LayoutList, Trophy, Clock, ImagePlus, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getRandomColor } from '@/lib/utils';
import { getTotalHoursForUser, getRecommendedPartners } from '@/lib/queries/stats';

interface PostAuthor {
  id: string;
  name: string;
  initials: string;
  pictureUrl?: string | null;
}

interface PostItem {
  id: string;
  authorId: string;
  author: PostAuthor;
  content: string;
  imageUrl?: string | null;
  createdAt: Date;
  createdAtLabel: string;
}

interface SearchableUser {
  id: string;
  name: string;
  initials: string;
  pictureUrl?: string | null;
  email?: string;
}

interface RankingEntry {
  id: string;
  name: string;
  initials: string;
  pictureUrl?: string | null;
  hours: number;
  createdAt: Date;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'agora';
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`;
  if (seconds < 604800) return `há ${Math.floor(seconds / 86400)} dias`;
  return date.toLocaleDateString('pt-BR');
}

type Tab = 'feed' | 'ranking';

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [newPost, setNewPost] = useState('');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; initials: string; pictureUrl?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [searchableUsers, setSearchableUsers] = useState<SearchableUser[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [peopleSearchTerm, setPeopleSearchTerm] = useState('');
  const [recommendedPartners, setRecommendedPartners] = useState<SearchableUser[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const u = snap.data();
        setCurrentUser({
          id: user.uid,
          initials: `${(u.firstName ?? 'J')[0]}${(u.lastName ?? '?')[0]}`.toUpperCase(),
          pictureUrl: u.pictureUrl ?? null,
        });
      }
    });
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    getDocs(collection(db, 'users')).then((snap) => {
      const list: SearchableUser[] = [];
      snap.docs.forEach((d) => {
        if (d.id === user.uid) return;
        const data = d.data();
        if (data.isAnonymous === true) return;
        const firstName = data.firstName ?? '';
        const lastName = data.lastName ?? '';
        const name = `${firstName} ${lastName}`.trim() || 'Jogador';
        list.push({
          id: d.id,
          name,
          initials: `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase(),
          pictureUrl: data.pictureUrl ?? null,
          email: data.email ?? undefined,
        });
      });
      setSearchableUsers(list.slice(0, 200));
    });
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: PostItem[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const authorId = data.authorId ?? '';
        const authorSnap = await getDoc(doc(db, 'users', authorId));
        const authorData = authorSnap.exists() ? authorSnap.data() : {};
        const firstName = authorData?.firstName ?? '';
        const lastName = authorData?.lastName ?? '';
        const createdAt = data.createdAt?.toDate?.() ?? new Date();
        list.push({
          id: d.id,
          authorId,
          author: {
            id: authorId,
            name: `${firstName} ${lastName}`.trim() || 'Jogador',
            initials: `${(firstName || 'J')[0]}${(lastName || '?')[0]}`.toUpperCase(),
            pictureUrl: authorData?.pictureUrl ?? null,
          },
          content: data.content ?? '',
          imageUrl: data.imageUrl ?? null,
          createdAt,
          createdAtLabel: formatTimeAgo(createdAt),
        });
      }
      setPosts(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!searchOpen || !auth.currentUser) return;

    setRecommendedLoading(true);
    getRecommendedPartners(auth.currentUser.uid, 10)
      .then((partners) => {
        const mapped: SearchableUser[] = partners.map((p) => ({
          id: p.userId,
          name: p.name,
          initials: p.initials,
          pictureUrl: p.pictureUrl ?? null,
          email: undefined,
        }));
        setRecommendedPartners(mapped);
      })
      .catch(() => setRecommendedPartners([]))
      .finally(() => setRecommendedLoading(false));
  }, [searchOpen]);

  useEffect(() => {
    if (activeTab !== 'ranking') return;

    setRankingLoading(true);
    const loadRanking = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const users: Array<{ id: string; name: string; initials: string; pictureUrl?: string | null; createdAt: Date }> = [];

        for (const d of usersSnap.docs) {
          const data = d.data();
          if (data.isAnonymous === true) continue;
          const firstName = data.firstName ?? '';
          const lastName = data.lastName ?? '';
          const name = `${firstName} ${lastName}`.trim() || 'Jogador';
          const createdAt = data.createdAt?.toDate?.() ?? new Date(0);
          users.push({
            id: d.id,
            name,
            initials: `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase(),
            pictureUrl: data.pictureUrl ?? null,
            createdAt,
          });
        }

        const entries: RankingEntry[] = [];
        for (const u of users) {
          const hours = await getTotalHoursForUser(u.id);
          entries.push({ ...u, hours });
        }

        entries.sort((a, b) => {
          if (b.hours !== a.hours) return b.hours - a.hours;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

        setRanking(entries);
      } catch (e) {
        console.error(e);
        setRanking([]);
      } finally {
        setRankingLoading(false);
      }
    };

    loadRanking();
  }, [activeTab]);

  const handlePublish = async () => {
    if (!newPost.trim() || !auth.currentUser) return;
    setPublishing(true);
    try {
      let imageUrl: string | null = null;
      if (selectedImage) {
        const fd = new FormData();
        fd.append('image', selectedImage);
        const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? 'Erro ao enviar imagem.');
        }
        const data = await res.json();
        imageUrl = data?.url ?? null;
      }
      const postData: Record<string, unknown> = {
        authorId: auth.currentUser.uid,
        content: newPost.trim(),
        createdAt: serverTimestamp(),
      };
      if (imageUrl) postData.imageUrl = imageUrl;
      await addDoc(collection(db, 'posts'), postData);
      setNewPost('');
      setSelectedImage(null);
      setImagePreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      console.error(e);
    } finally {
      setPublishing(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB
    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartEdit = (post: PostItem) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setOpenMenuPostId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingPostId || !auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'posts', editingPostId), { content: editContent.trim() });
      setEditingPostId(null);
      setEditContent('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditContent('');
  };

  const handleDelete = async (postId: string) => {
    if (!auth.currentUser) return;
    setDeletingPostId(postId);
    setOpenMenuPostId(null);
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingPostId(null);
    }
  };

  const peopleTerm = peopleSearchTerm.trim().toLowerCase();
  const filteredUsersForSearch = peopleTerm
    ? searchableUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(peopleTerm) ||
          (u.email?.toLowerCase().includes(peopleTerm) ?? false)
      )
    : [];

  if (loading && posts.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const tabs = [
    { id: 'feed' as const, label: 'Feed', icon: LayoutList },
    { id: 'ranking' as const, label: 'Ranking', icon: Trophy },
  ];

  return (
    <div className="max-w-md mx-auto">
      <div className="sticky top-16 z-30 bg-white border-b border-gray-200 -mx-4 px-4">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-emerald-600 border-b-2 border-emerald-600'
                    : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <div className="relative flex-shrink-0 border-b-2 border-transparent py-3">
            <button
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label="Buscar jogadores"
              aria-expanded={searchOpen}
            >
              <Search className="w-5 h-5" />
            </button>
            {searchOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => {
                    setSearchOpen(false);
                    setPeopleSearchTerm('');
                  }}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-[min(420px,calc(100vw-2rem))] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="p-3 border-b border-gray-100">
                    <input
                      type="text"
                      value={peopleSearchTerm}
                      onChange={(e) => setPeopleSearchTerm(e.target.value)}
                      placeholder="Buscar jogadores..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[min(400px,70vh)] overflow-y-auto">
                    {peopleTerm ? (
                      <>
                        <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 bg-white">
                          Resultados
                        </h3>
                        {filteredUsersForSearch.length === 0 ? (
                          <p className="px-4 py-6 text-center text-sm text-gray-500">
                            Nenhum jogador encontrado para &quot;{peopleSearchTerm.trim()}&quot;
                          </p>
                        ) : (
                          <ul>
                            {filteredUsersForSearch.map((u) => (
                              <li key={u.id}>
                                <Link
                                  href={`/perfil/${u.id}`}
                                  onClick={() => {
                                    setSearchOpen(false);
                                    setPeopleSearchTerm('');
                                  }}
                                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                                >
                                  {u.pictureUrl ? (
                                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                                      <Image
                                        src={u.pictureUrl}
                                        alt={u.name}
                                        width={40}
                                        height={40}
                                        className="object-cover w-full h-full"
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${getRandomColor(u.id)}`}
                                    >
                                      {u.initials}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{u.name}</p>
                                    {u.email && (
                                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                    )}
                                  </div>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <>
                        <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 bg-white">
                          Recomendações
                        </h3>
                        <p className="px-4 py-1 text-xs text-gray-400">
                          Pessoas com quem você já jogou
                        </p>
                        {recommendedLoading ? (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                          </div>
                        ) : recommendedPartners.length === 0 ? (
                          <p className="px-4 py-6 text-center text-sm text-gray-500">
                            Jogue partidas para ver recomendações
                          </p>
                        ) : (
                          <ul>
                            {recommendedPartners.map((u) => (
                              <li key={u.id}>
                                <Link
                                  href={`/perfil/${u.id}`}
                                  onClick={() => {
                                    setSearchOpen(false);
                                    setPeopleSearchTerm('');
                                  }}
                                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                                >
                                  {u.pictureUrl ? (
                                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                                      <Image
                                        src={u.pictureUrl}
                                        alt={u.name}
                                        width={40}
                                        height={40}
                                        className="object-cover w-full h-full"
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${getRandomColor(u.id)}`}
                                    >
                                      {u.initials}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{u.name}</p>
                                    {u.email && (
                                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                    )}
                                  </div>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {activeTab === 'feed' && (
          <>
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-start gap-3">
          {currentUser?.pictureUrl ? (
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={currentUser.pictureUrl}
                alt="Seu perfil"
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            </div>
          ) : (
            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {currentUser?.initials ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="O que está acontecendo na quadra?"
              className="w-full resize-none border-none focus:outline-none text-gray-900 placeholder-gray-400"
              rows={2}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageSelect}
              className="hidden"
              aria-hidden
            />
            {imagePreviewUrl && (
              <div className="relative mt-2 rounded-xl overflow-hidden bg-gray-100 w-full max-w-[200px] aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  aria-label="Remover imagem"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex justify-end items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                aria-label="Adicionar imagem"
              >
                <ImagePlus className="w-5 h-5" />
              </button>
              <button
                onClick={handlePublish}
                disabled={!newPost.trim() || publishing}
                className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishing ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            Nenhum post ainda. Seja o primeiro a publicar!
          </p>
        ) : (
          posts.map((post) => {
            const isMyPost = post.authorId === auth.currentUser?.uid;
            const isEditing = editingPostId === post.id;
            const isDeleting = deletingPostId === post.id;

            return (
              <div
                key={post.id}
                className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm relative"
              >
                <div className="flex items-start gap-3">
                  <Link href={`/perfil/${post.authorId}`}>
                    {post.author.pictureUrl ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                        <Image
                          src={post.author.pictureUrl}
                          alt={post.author.name}
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${getRandomColor(post.authorId)}`}
                      >
                        {post.author.initials}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/perfil/${post.authorId}`}
                        className="font-semibold text-gray-900 hover:underline"
                      >
                        {post.author.name}
                      </Link>
                      <span className="text-xs text-gray-500">
                        {post.createdAtLabel}
                      </span>
                      {isMyPost && (
                        <div className="ml-auto relative">
                          <button
                            type="button"
                            onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                            className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Abrir menu"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {openMenuPostId === post.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                aria-hidden
                                onClick={() => setOpenMenuPostId(null)}
                              />
                              <nav
                                className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]"
                                role="menu"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(post)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                                  role="menuitem"
                                >
                                  <Pencil className="w-4 h-4 text-emerald-600" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(post.id)}
                                  disabled={isDeleting}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left disabled:opacity-50"
                                  role="menuitem"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  {isDeleting ? 'Apagando...' : 'Apagar'}
                                </button>
                              </nav>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2 mb-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                          rows={3}
                          autoFocus
                        />
                        {post.imageUrl && (
                          <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 aspect-video max-h-48">
                            <Image
                              src={post.imageUrl}
                              alt=""
                              fill
                              className="object-contain"
                              sizes="(max-width: 448px) 100vw, 448px"
                            />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={!editContent.trim()}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="text-sm font-medium text-gray-600 hover:text-gray-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-700 text-sm leading-relaxed mb-3">
                          {post.content}
                        </p>
                        {post.imageUrl && (
                          <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 aspect-video max-h-80">
                            <Image
                              src={post.imageUrl}
                              alt=""
                              fill
                              className="object-contain"
                              sizes="(max-width: 448px) 100vw, 448px"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
          </>
        )}

        {activeTab === 'ranking' && (
          <>
            {rankingLoading ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
              </div>
            ) : ranking.length === 0 ? (
              <div className="py-12 text-center">
                <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum jogador no ranking.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <ul className="divide-y divide-gray-100">
                  {ranking.map((entry, index) => (
                    <li key={entry.id}>
                      <Link
                        href={`/perfil/${entry.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <span className="w-8 text-center font-bold text-gray-400 text-sm flex-shrink-0">
                          #{index + 1}
                        </span>
                        {entry.pictureUrl ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                            <Image
                              src={entry.pictureUrl}
                              alt={entry.name}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${getRandomColor(entry.id)}`}
                          >
                            {entry.initials}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{entry.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {entry.hours} {entry.hours === 1 ? 'hora' : 'horas'}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
