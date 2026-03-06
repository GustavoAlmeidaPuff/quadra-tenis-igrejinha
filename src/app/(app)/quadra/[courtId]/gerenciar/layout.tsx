'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { canManageCourt } from '@/lib/permissions';

export default function GerenciarLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const courtId = params?.courtId as string;
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login');
        return;
      }

      const courtSnap = await getDoc(doc(db, 'courts', courtId));
      const managerIds: string[] = courtSnap.exists()
        ? (courtSnap.data().managerIds ?? [])
        : [];

      if (!canManageCourt(firebaseUser.uid, firebaseUser.email, managerIds)) {
        router.push('/reservar');
        return;
      }

      setAllowed(true);
      setLoading(false);
    });
    return () => unsub();
  }, [router, courtId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
