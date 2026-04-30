'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ui/ErrorState';
import { getFriendlyError, logError } from '@/lib/errors';

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError('app-segment-error', error);
  }, [error]);

  const friendly = getFriendlyError(error);

  return (
    <ErrorState
      error={{ ...friendly, rawCode: friendly.rawCode ?? error.digest }}
      onRetry={reset}
      fullPage
    />
  );
}
