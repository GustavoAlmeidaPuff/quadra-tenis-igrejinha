'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Search, Swords, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getRandomColor } from '@/lib/utils';

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

export default function SocialPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [newPost, setNewPost] = useState('');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; initials: string; pictureUrl?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

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
          createdAt,
          createdAtLabel: formatTimeAgo(createdAt),
        });
      }
      setPosts(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePublish = async () => {
    if (!newPost.trim() || !auth.currentUser) return;
    setPublishing(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: auth.currentUser.uid,
        content: newPost.trim(),
        createdAt: serverTimestamp(),
      });
      setNewPost('');
    } catch (e) {
      console.error(e);
    } finally {
      setPublishing(false);
    }
  };

  const handleChallenge = (authorId: string) => {
    if (authorId === auth.currentUser?.uid) return;
    window.location.href = `/perfil/${authorId}?desafiar=1`;
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

  const filteredPosts = searchTerm
    ? posts.filter(
        (post) =>
          post.author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          post.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : posts;

  if (loading && posts.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar posts ou jogadores..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none bg-white"
        />
      </div>

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
          <div className="flex-1">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="O que está acontecendo na quadra?"
              className="w-full resize-none border-none focus:outline-none text-gray-900 placeholder-gray-400"
              rows={2}
            />
            <div className="flex justify-end mt-2">
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
        {filteredPosts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            Nenhum post ainda. Seja o primeiro a publicar!
          </p>
        ) : (
          filteredPosts.map((post) => {
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
                      <p className="text-gray-700 text-sm leading-relaxed mb-3">
                        {post.content}
                      </p>
                    )}
                    {!isEditing && (
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleChallenge(post.authorId)}
                          disabled={post.authorId === auth.currentUser?.uid}
                          className="flex items-center gap-1.5 text-gray-600 hover:text-emerald-600 transition-colors disabled:opacity-50"
                        >
                          <Swords className="w-4 h-4" />
                          <span className="text-sm">Desafiar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
