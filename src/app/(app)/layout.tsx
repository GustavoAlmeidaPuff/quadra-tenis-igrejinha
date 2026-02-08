'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { User } from '@/lib/types';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (!userDoc.exists() || !userDoc.data().firstName) {
        router.push('/onboarding');
        return;
      }

      setUser({
        id: firebaseUser.uid,
        email: userDoc.data().email,
        firstName: userDoc.data().firstName,
        lastName: userDoc.data().lastName,
        pictureUrl: userDoc.data().pictureUrl,
        isAnonymous: userDoc.data().isAnonymous || false,
        isPrivate: userDoc.data().isPrivate || false,
        createdAt: userDoc.data().createdAt,
      });
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header user={user} />
      <main className="pt-16">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
