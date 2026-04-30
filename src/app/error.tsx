'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ui/ErrorState';
import { getFriendlyError, logError } from '@/lib/errors';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError('root-error', error);
  }, [error]);

  const friendly = getFriendlyError(error);

  return (
    <div className="min-h-screen bg-gray-50">
      <ErrorState
        error={{ ...friendly, rawCode: friendly.rawCode ?? error.digest }}
        onRetry={reset}
        fullPage
      />
    </div>
  );
}
