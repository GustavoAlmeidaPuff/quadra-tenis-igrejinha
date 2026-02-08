'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function PerfilRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/login');
        return;
      }
      router.replace(`/perfil/${user.uid}`);
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <div className="max-w-md mx-auto px-4 py-12 flex justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
    </div>
  );
}
