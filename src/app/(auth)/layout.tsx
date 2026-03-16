'use client';

import { isFirebaseConfigured } from '@/lib/firebase/client';
import FirebaseSetupPage from '@/components/FirebaseSetupPage';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isFirebaseConfigured) {
    return <FirebaseSetupPage />;
  }
  return <>{children}</>;
}
