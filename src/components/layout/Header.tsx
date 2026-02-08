'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import CourtStatus from './CourtStatus';
import Avatar from './Avatar';
import { User } from '@/lib/types';

interface HeaderProps {
  user: User;
}

export default function Header({ user }: HeaderProps) {
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const q = query(
      collection(db, 'challenges'),
      where('toUserId', '==', user.id),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hasUnread = snapshot.docs.some((d) => d.data().viewed !== true);
      setHasUnreadNotifications(hasUnread);
    });

    return () => unsubscribe();
  }, [user?.id]);

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40 safe-area-top">
      <div className="flex items-center justify-between h-16 px-4 max-w-md mx-auto">
        <Link href="/perfil">
          <Avatar user={user} size="sm" />
        </Link>

        <CourtStatus showLabel={true} />

        <Link
          href="/notificacoes"
          className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Bell className="w-5 h-5 text-gray-700" />
          {hasUnreadNotifications && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" aria-label="Notificações não lidas" />
          )}
        </Link>
      </div>
    </header>
  );
}
