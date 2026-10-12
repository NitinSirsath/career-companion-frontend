import { useEffect } from 'react';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { ErrorState } from './ErrorState';

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  useEffect(() => {
    console.error(error);
    queryErrorResetBoundary.reset();
  }, [error, queryErrorResetBoundary]);

  const retry = async () => {
    queryErrorResetBoundary.reset();
    try {
      await router.invalidate({ sync: true });
    } finally {
      reset();
    }
  };

  return (
    <ErrorState
      title="Something went wrong"
      message="Career Companion could not display this page. You can retry or return to Mails."
      error={error}
      showRetry
      showReload
      showHome
      onRetry={() => void retry()}
      onReload={() => window.location.reload()}
      onHome={() => void router.navigate({ to: '/mails' })}
    />
  );
}
