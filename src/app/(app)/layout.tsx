'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { User } from '@/lib/types';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import WelcomePopup from '@/components/ui/WelcomePopup';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

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

      const data = userDoc.data();
      setUser({
        id: firebaseUser.uid,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        pictureUrl: data.pictureUrl,
        isAnonymous: data.isAnonymous || false,
        isPrivate: data.isPrivate || false,
        createdAt: data.createdAt,
        welcomePopupSeen: data.welcomePopupSeen,
      });
      setShowWelcomePopup(data.welcomePopupSeen !== true);
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

  const handleCloseWelcomePopup = async () => {
    setShowWelcomePopup(false);
    try {
      await setDoc(
        doc(db, 'users', user.id),
        { welcomePopupSeen: true },
        { merge: true }
      );
    } catch {
      // Falha silenciosa; o popup já foi fechado localmente
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header user={user} />
      <main className="pt-16">
        {children}
      </main>
      <BottomNav />
      <WelcomePopup
        isOpen={showWelcomePopup}
        firstName={user.firstName}
        onClose={handleCloseWelcomePopup}
      />
    </div>
  );
}
