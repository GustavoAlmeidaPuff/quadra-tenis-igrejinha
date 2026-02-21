'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
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
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Search, MoreVertical, Pencil, Trash2, LayoutList, Trophy, Clock, ImagePlus, X, Heart, MessageCircle, Hand } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getRandomColor } from '@/lib/utils';
import { getTotalHoursForUser, getRecommendedPartners } from '@/lib/queries/stats';
import { MENTION_REGEX } from '@/components/social/MentionTextarea';
import { MentionTextarea } from '@/components/social/MentionTextarea';
import { PostContent } from '@/components/social/PostContent';

/** Retorna IDs únicos de usuários mencionados no texto (formato @[Nome](userId)) */
function getMentionedUserIds(content: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(MENTION_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[2]) ids.add(m[2]);
  }
  return [...ids];
}

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
  likeCount: number;
  likedByMe: boolean;
  likedByUserIds: string[];
  commentCount: number;
}

interface CommentItem {
  id: string;
  authorId: string;
  author: PostAuthor;
  content: string;
  createdAt: Date;
  createdAtLabel: string;
}

interface LikedByProfile {
  pictureUrl?: string | null;
  name: string;
  initials: string;
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

type Tab = 'feed' | 'ranking' | 'quem-anima';

export default function SocialPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [newPost, setNewPost] = useState('');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; initials: string; pictureUrl?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<{ postId: string; content: string } | null>(null);
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
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [likedByProfilesCache, setLikedByProfilesCache] = useState<Record<string, LikedByProfile>>({});
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentItem[]>>({});
  const [newCommentByPost, setNewCommentByPost] = useState<Record<string, string>>({});
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState<string | null>(null);
  const [openMenuCommentKey, setOpenMenuCommentKey] = useState<string | null>(null);
  const [commentMenuPosition, setCommentMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [editingComment, setEditingComment] = useState<{ key: string; content: string } | null>(null);
  const [deletingCommentKey, setDeletingCommentKey] = useState<string | null>(null);
  const [likesModalPostId, setLikesModalPostId] = useState<string | null>(null);
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

  // Abrir o post quando vier da notificação de menção (?postId=xxx)
  useEffect(() => {
    const postId = searchParams.get('postId');
    if (postId) {
      setActiveTab('feed');
      setExpandedCommentsPostId(postId);
    }
  }, [searchParams]);

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
      const currentUid = auth.currentUser?.uid ?? '';
      const list: PostItem[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const authorId = data.authorId ?? '';
        const authorSnap = await getDoc(doc(db, 'users', authorId));
        const authorData = authorSnap.exists() ? authorSnap.data() : {};
        const firstName = authorData?.firstName ?? '';
        const lastName = authorData?.lastName ?? '';
        const createdAt = data.createdAt?.toDate?.() ?? new Date();
        const likedBy: string[] = Array.isArray(data.likedBy) ? data.likedBy : [];
        const likeCount = likedBy.length;
        const likedByMe = currentUid ? likedBy.includes(currentUid) : false;
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
          likeCount,
          likedByMe,
          likedByUserIds: likedBy,
          commentCount: typeof data.commentCount === 'number' ? data.commentCount : 0,
        });
      }
      setPosts(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Carrega perfis (foto, nome) de quem curtiu para exibir avatares
  useEffect(() => {
    const ids = new Set<string>();
    posts.forEach((p) => p.likedByUserIds.slice(0, 5).forEach((id) => ids.add(id)));
    const toFetch = [...ids].filter((id) => !likedByProfilesCache[id]).slice(0, 30);
    if (toFetch.length === 0) return;

    let cancelled = false;
    Promise.all(
      toFetch.map(async (userId) => {
        const snap = await getDoc(doc(db, 'users', userId));
        if (!snap.exists()) return null;
        const d = snap.data();
        const firstName = d.firstName ?? '';
        const lastName = d.lastName ?? '';
        const name = `${firstName} ${lastName}`.trim() || 'Jogador';
        const initials = `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase();
        return { userId, profile: { pictureUrl: d.pictureUrl ?? null, name, initials } as LikedByProfile };
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, LikedByProfile> = {};
      results.forEach((r) => {
        if (r) next[r.userId] = r.profile;
      });
      setLikedByProfilesCache((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [posts, likedByProfilesCache]);

  // Carrega todos os perfis quando o modal de curtidas é aberto
  useEffect(() => {
    if (!likesModalPostId) return;
    const post = posts.find((p) => p.id === likesModalPostId);
    if (!post) return;

    const toFetch = post.likedByUserIds.filter((id) => !likedByProfilesCache[id]);
    if (toFetch.length === 0) return;

    let cancelled = false;
    Promise.all(
      toFetch.map(async (userId) => {
        const snap = await getDoc(doc(db, 'users', userId));
        if (!snap.exists()) return null;
        const d = snap.data();
        const firstName = d.firstName ?? '';
        const lastName = d.lastName ?? '';
        const name = `${firstName} ${lastName}`.trim() || 'Jogador';
        const initials = `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase();
        return { userId, profile: { pictureUrl: d.pictureUrl ?? null, name, initials } as LikedByProfile };
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, LikedByProfile> = {};
      results.forEach((r) => {
        if (r) next[r.userId] = r.profile;
      });
      setLikedByProfilesCache((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [likesModalPostId, posts, likedByProfilesCache]);

  // Carrega comentários do post quando o usuário expande a seção
  useEffect(() => {
    const postId = expandedCommentsPostId;
    if (!postId) return;

    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'), limit(100));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: CommentItem[] = [];
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
      setCommentsByPost((prev) => ({ ...prev, [postId]: list }));
    });

    return () => unsubscribe();
  }, [expandedCommentsPostId]);

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

        const hoursResults = await Promise.all(
          users.map((u) => getTotalHoursForUser(u.id))
        );
        const entries: RankingEntry[] = users.map((u, i) => ({
          ...u,
          hours: hoursResults[i],
        }));

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
      const contentTrimmed = newPost.trim();
      const postData: Record<string, unknown> = {
        authorId: auth.currentUser.uid,
        content: contentTrimmed,
        createdAt: serverTimestamp(),
      };
      if (imageUrl) postData.imageUrl = imageUrl;
      const postRef = await addDoc(collection(db, 'posts'), postData);
      const postId = postRef.id;
      const mentionedIds = getMentionedUserIds(contentTrimmed).filter((id) => id !== auth.currentUser!.uid);
      if (mentionedIds.length > 0) {
        const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const fromUserName = `${userData.firstName ?? ''} ${userData.lastName ?? ''}`.trim() || 'Jogador';
        for (const toUserId of mentionedIds) {
          try {
            await addDoc(collection(db, 'notifications'), {
              type: 'mention',
              fromUserId: auth.currentUser.uid,
              fromUserName,
              toUserId,
              postId,
              read: false,
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            console.error('Erro ao criar notificação de menção:', err);
          }
        }
      }
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
    const content = typeof post.content === 'string' ? post.content : '';
    setEditingPost({ postId: post.id, content });
    setOpenMenuPostId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingPost || !auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'posts', editingPost.postId), { content: editingPost.content.trim() });
      setEditingPost(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
  };

  const handleLike = async (post: PostItem) => {
    if (!auth.currentUser || likingPostId !== null) return;
    setLikingPostId(post.id);
    try {
      const ref = doc(db, 'posts', post.id);
      if (post.likedByMe) {
        await updateDoc(ref, { likedBy: arrayRemove(auth.currentUser.uid) });
      } else {
        await updateDoc(ref, { likedBy: arrayUnion(auth.currentUser.uid) });
        if (post.authorId !== auth.currentUser.uid) {
          try {
            const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userData = userSnap.exists() ? userSnap.data() : {};
            const fromUserName = `${userData.firstName ?? ''} ${userData.lastName ?? ''}`.trim() || 'Jogador';
            await addDoc(collection(db, 'notifications'), {
              type: 'like',
              fromUserId: auth.currentUser.uid,
              fromUserName,
              toUserId: post.authorId,
              postId: post.id,
              read: false,
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            console.error('Erro ao criar notificação de curtida:', err);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLikingPostId(null);
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedCommentsPostId((prev) => (prev === postId ? null : postId));
  };

  const handleAddComment = async (postId: string) => {
    const content = (newCommentByPost[postId] ?? '').trim();
    if (!content || !auth.currentUser || submittingCommentPostId !== null) return;
    setSubmittingCommentPostId(postId);
    try {
      const commentRef = await addDoc(collection(db, 'posts', postId, 'comments'), {
        authorId: auth.currentUser.uid,
        content,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
      const mentionedIds = getMentionedUserIds(content).filter((id) => id !== auth.currentUser!.uid);
      if (mentionedIds.length > 0) {
        const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const fromUserName = `${userData.firstName ?? ''} ${userData.lastName ?? ''}`.trim() || 'Jogador';
        for (const toUserId of mentionedIds) {
          try {
            await addDoc(collection(db, 'notifications'), {
              type: 'mention',
              fromUserId: auth.currentUser.uid,
              fromUserName,
              toUserId,
              postId,
              commentId: commentRef.id,
              read: false,
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            console.error('Erro ao criar notificação de menção:', err);
          }
        }
      }
      setNewCommentByPost((prev) => ({ ...prev, [postId]: '' }));
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingCommentPostId(null);
    }
  };

  const commentKey = (postId: string, commentId: string) => `${postId}_${commentId}`;

  const handleStartEditComment = (comment: CommentItem, postId: string) => {
    const key = commentKey(postId, comment.id);
    const content = typeof comment.content === 'string' ? comment.content : '';
    setEditingComment({ key, content });
    setOpenMenuCommentKey(null);
    setCommentMenuPosition(null);
  };

  const handleSaveEditComment = async () => {
    if (!editingComment || !auth.currentUser) return;
    const idx = editingComment.key.indexOf('_');
    const postId = editingComment.key.slice(0, idx);
    const commentId = editingComment.key.slice(idx + 1);
    if (!postId || !commentId) return;
    try {
      await updateDoc(doc(db, 'posts', postId, 'comments', commentId), {
        content: editingComment.content.trim(),
      });
      setEditingComment(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelEditComment = () => {
    setEditingComment(null);
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!auth.currentUser) return;
    const key = commentKey(postId, commentId);
    setDeletingCommentKey(key);
    setOpenMenuCommentKey(null);
    setCommentMenuPosition(null);
    try {
      await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
      await updateDoc(doc(db, 'posts', postId), { commentCount: increment(-1) });
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingCommentKey(null);
    }
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
    { id: 'quem-anima' as const, label: 'Quem anima?', icon: Hand },
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
          <div className="relative flex-shrink-0 border-b-2 border-transparent py-3 pl-2 pr-6">
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
            <MentionTextarea
              value={newPost}
              onChange={setNewPost}
              placeholder="O que está acontecendo na quadra?"
              users={searchableUsers}
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
            const isEditing = editingPost?.postId === post.id;
            const postEditContent = isEditing ? (editingPost?.content ?? '') : '';
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
                        <MentionTextarea
                          value={postEditContent}
                          onChange={(value) =>
                            setEditingPost((prev) => (prev ? { ...prev, content: value } : null))
                          }
                          users={searchableUsers}
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
                            disabled={!postEditContent.trim()}
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
                        <PostContent
                          content={post.content}
                          className="block text-gray-700 text-sm leading-relaxed mb-3"
                        />
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
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleLike(post)}
                              disabled={likingPostId === post.id}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                post.likedByMe
                                  ? 'text-red-500 hover:bg-red-50'
                                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                              }`}
                              aria-label={post.likedByMe ? 'Descurtir' : 'Curtir'}
                            >
                              <Heart
                                className={`w-5 h-5 flex-shrink-0 ${
                                  post.likedByMe ? 'fill-red-500' : 'fill-none'
                                }`}
                              />
                              {post.likeCount > 0 && (
                                <span className="tabular-nums">{post.likeCount}</span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleComments(post.id)}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                              aria-label={post.commentCount === 0 ? 'Comentar' : `${post.commentCount} comentários`}
                            >
                              <MessageCircle className="w-5 h-5 flex-shrink-0" />
                              <span>Comentar</span>
                              {post.commentCount > 0 && (
                                <span className="tabular-nums text-gray-500">({post.commentCount})</span>
                              )}
                            </button>
                          </div>
                          {post.likeCount > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setLikesModalPostId(post.id)}
                                className="flex items-center -space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
                                aria-label="Ver quem curtiu"
                              >
                                {post.likedByUserIds.slice(0, 3).map((userId, i) => {
                                  const profile = likedByProfilesCache[userId];
                                  const z = i === 0 ? 'z-0' : i === 1 ? 'z-10' : 'z-20';
                                  return (
                                    <div
                                      key={userId}
                                      className={`relative flex-shrink-0 w-6 h-6 rounded-full border-2 border-white bg-gray-200 overflow-hidden ring-1 ring-gray-200 ${z}`}
                                      title={profile?.name}
                                    >
                                      {profile?.pictureUrl ? (
                                        <Image
                                          src={profile.pictureUrl}
                                          alt={profile.name}
                                          width={24}
                                          height={24}
                                          className="object-cover w-full h-full"
                                        />
                                      ) : (
                                        <span
                                          className={`w-full h-full flex items-center justify-center text-[10px] font-semibold text-white ${getRandomColor(userId)}`}
                                        >
                                          {profile?.initials ?? '?'}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </button>
                              <button
                                type="button"
                                onClick={() => setLikesModalPostId(post.id)}
                                className="text-xs text-gray-500 min-w-0 hover:underline cursor-pointer text-left"
                              >
                                {(() => {
                                  const first = post.likedByUserIds.slice(0, 2).map((id) => likedByProfilesCache[id]?.name || 'Alguém');
                                  const rest = post.likeCount - first.length;
                                  if (first.length === 0) return `${post.likeCount} ${post.likeCount === 1 ? 'curtida' : 'curtidas'}`;
                                  if (rest <= 0) return `Curtido por ${first.join(' e ')}`;
                                  if (rest === 1) return `Curtido por ${first.join(', ')} e outra pessoa`;
                                  return `Curtido por ${first.join(', ')} e outras ${rest} pessoas`;
                                })()}
                              </button>
                            </div>
                          )}
                        </div>
                        {expandedCommentsPostId === post.id && (
                          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                            <ul className="space-y-3 max-h-64 overflow-y-auto">
                              {(commentsByPost[post.id] ?? []).length === 0 ? (
                                <p className="text-sm text-gray-500 py-2">Nenhum comentário ainda. Seja o primeiro!</p>
                              ) : (
                                (commentsByPost[post.id] ?? []).map((comment) => {
                                  const isMyComment = comment.authorId === auth.currentUser?.uid;
                                  const menuKey = commentKey(post.id, comment.id);
                                  const isEditing = editingComment?.key === menuKey;
                                  const editContent = isEditing ? (editingComment?.content ?? '') : '';
                                  const isDeleting = deletingCommentKey === menuKey;
                                  return (
                                    <li key={comment.id} className="flex gap-2">
                                      <Link href={`/perfil/${comment.authorId}`} className="flex-shrink-0">
                                        {comment.author.pictureUrl ? (
                                          <div className="w-8 h-8 rounded-full overflow-hidden">
                                            <Image
                                              src={comment.author.pictureUrl}
                                              alt={comment.author.name}
                                              width={32}
                                              height={32}
                                              className="object-cover w-full h-full"
                                            />
                                          </div>
                                        ) : (
                                          <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getRandomColor(comment.authorId)}`}
                                          >
                                            {comment.author.initials}
                                          </div>
                                        )}
                                      </Link>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 flex-wrap">
                                          <Link
                                            href={`/perfil/${comment.authorId}`}
                                            className="font-medium text-gray-900 text-sm hover:underline"
                                          >
                                            {comment.author.name}
                                          </Link>
                                          <span className="text-xs text-gray-500">{comment.createdAtLabel}</span>
                                          {isMyComment && (
                                            <div className="ml-auto">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  if (openMenuCommentKey === menuKey) {
                                                    setOpenMenuCommentKey(null);
                                                    setCommentMenuPosition(null);
                                                  } else {
                                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                    setCommentMenuPosition({
                                                      top: rect.bottom + 4,
                                                      left: Math.min(rect.right - 140, window.innerWidth - 156),
                                                    });
                                                    setOpenMenuCommentKey(menuKey);
                                                  }
                                                }}
                                                className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                                aria-label="Abrir menu do comentário"
                                              >
                                                <MoreVertical className="w-4 h-4" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                        {isEditing ? (
                                          <div className="mt-1 space-y-2">
                                            <MentionTextarea
                                              value={editContent}
                                              onChange={(value) =>
                                                setEditingComment((prev) => (prev ? { ...prev, content: value } : null))
                                              }
                                              users={searchableUsers}
                                              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                              rows={2}
                                              autoFocus
                                            />
                                            <div className="flex gap-2">
                                              <button
                                                type="button"
                                                onClick={handleSaveEditComment}
                                                disabled={!editContent.trim()}
                                                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                                              >
                                                Salvar
                                              </button>
                                              <button
                                                type="button"
                                                onClick={handleCancelEditComment}
                                                className="text-sm font-medium text-gray-600 hover:text-gray-700"
                                              >
                                                Cancelar
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <PostContent
                                            content={comment.content}
                                            className="text-sm text-gray-700 mt-0.5 break-words"
                                          />
                                        )}
                                      </div>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                            <div className="flex gap-2">
                              {currentUser?.pictureUrl ? (
                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                                  <Image
                                    src={currentUser.pictureUrl}
                                    alt=""
                                    width={32}
                                    height={32}
                                    className="object-cover w-full h-full"
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                  {currentUser?.initials ?? '?'}
                                </div>
                              )}
                              <div className="flex-1 flex gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                                <div className="flex-1 min-w-0 w-full sm:w-auto">
                                  <MentionTextarea
                                    value={newCommentByPost[post.id] ?? ''}
                                    onChange={(v) => setNewCommentByPost((prev) => ({ ...prev, [post.id]: v }))}
                                    users={searchableUsers}
                                    placeholder="Escreva um comentário..."
                                    className="min-h-[36px] w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                    rows={2}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddComment(post.id)}
                                  disabled={
                                    !(newCommentByPost[post.id] ?? '').trim() || submittingCommentPostId === post.id
                                  }
                                  className="self-end px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                >
                                  {submittingCommentPostId === post.id ? 'Enviando...' : 'Comentar'}
                                </button>
                              </div>
                            </div>
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

        {activeTab === 'quem-anima' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <Hand className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Quem anima? — Em breve.</p>
          </div>
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
                        {entry.pictureUrl?.trim() ? (
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
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 bg-primary-600">
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
      {openMenuCommentKey &&
        commentMenuPosition &&
        (() => {
          const idx = openMenuCommentKey.indexOf('_');
          const postId = openMenuCommentKey.slice(0, idx);
          const commentId = openMenuCommentKey.slice(idx + 1);
          const comment = commentsByPost[postId]?.find((c) => c.id === commentId);
          if (!comment) return null;
          const isDeleting = deletingCommentKey === openMenuCommentKey;
          return createPortal(
            <>
              <div
                className="fixed inset-0 z-[100]"
                aria-hidden
                onClick={() => {
                  setOpenMenuCommentKey(null);
                  setCommentMenuPosition(null);
                }}
              />
              <nav
                className="fixed z-[101] bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[120px]"
                style={{
                  top: commentMenuPosition.top,
                  left: commentMenuPosition.left,
                }}
                role="menu"
              >
                <button
                  type="button"
                  onClick={() => handleStartEditComment(comment, postId)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  role="menuitem"
                >
                  <Pencil className="w-4 h-4 text-emerald-600" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteComment(postId, comment.id)}
                  disabled={isDeleting}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left disabled:opacity-50"
                  role="menuitem"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </nav>
            </>,
            document.body
          );
        })()}
      {likesModalPostId &&
        (() => {
          const post = posts.find((p) => p.id === likesModalPostId);
          if (!post) return null;
          return createPortal(
            <>
              <div
                className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
                onClick={() => setLikesModalPostId(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Curtidas ({post.likeCount})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setLikesModalPostId(null)}
                      className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      aria-label="Fechar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    <ul className="divide-y divide-gray-100">
                      {post.likedByUserIds.map((userId) => {
                        const profile = likedByProfilesCache[userId];
                        return (
                          <li key={userId}>
                            <Link
                              href={`/perfil/${userId}`}
                              onClick={() => setLikesModalPostId(null)}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                            >
                              {profile?.pictureUrl ? (
                                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                                  <Image
                                    src={profile.pictureUrl}
                                    alt={profile.name}
                                    width={48}
                                    height={48}
                                    className="object-cover w-full h-full"
                                  />
                                </div>
                              ) : (
                                <div
                                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${getRandomColor(userId)}`}
                                >
                                  {profile?.initials ?? '?'}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">
                                  {profile?.name ?? 'Carregando...'}
                                </p>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </>,
            document.body
          );
        })()}
    </div>
  );
}
