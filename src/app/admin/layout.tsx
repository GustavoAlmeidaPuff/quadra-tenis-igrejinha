'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { DEVELOPER_EMAIL } from '@/lib/courts';
import { LogOut } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== DEVELOPER_EMAIL) {
        router.push('/login');
        return;
      }
      setAllowed(true);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 h-14">
          <span className="font-bold text-gray-900">QuadraLivre</span>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
              dev
            </span>
            <button
              onClick={handleSignOut}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
