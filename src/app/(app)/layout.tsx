'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase/client';
import { User } from '@/lib/types';
import { DEVELOPER_EMAIL } from '@/lib/courts';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import WelcomePopup from '@/components/ui/WelcomePopup';
import ErrorState from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { getFriendlyError, logError, type FriendlyError } from '@/lib/errors';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { showError } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [authError, setAuthError] = useState<FriendlyError | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    setAuthError(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      router.push('/login');
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login');
        return;
      }

      // Conta de desenvolvedor nunca entra no app normal
      if (firebaseUser.email === DEVELOPER_EMAIL) {
        router.push('/admin');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

        if (!userDoc.exists() || !userDoc.data().firstName) {
          router.push('/onboarding');
          return;
        }

        const data = userDoc.data();

        if (!data.courtIds || data.courtIds.length === 0) {
          router.push('/select-court');
          return;
        }

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
          courtIds: data.courtIds,
        });
        setShowWelcomePopup(data.welcomePopupSeen !== true);
        setAuthError(null);
        setLoading(false);
      } catch (err) {
        logError('app-layout:loadUser', err);
        setAuthError(getFriendlyError(err));
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, retryKey]);

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ErrorState error={authError} onRetry={retry} fullPage />
      </div>
    );
  }

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
    } catch (err) {
      logError('app-layout:welcomePopup', err);
      showError(err, 'Não foi possível salvar');
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
