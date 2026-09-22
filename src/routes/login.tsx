import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const loginSearchSchema = z.object({
  error: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  component: Login,
  validateSearch: (search) => loginSearchSchema.parse(search),
});

function Login() {
  const { error } = Route.useSearch();

  const handleLogin = () => {
    // Redirects to backend auth connect through Vite proxy
    window.location.href = '/api/auth/connect';
  };

  const getErrorMessage = (errCode: string) => {
    if (errCode === 'denied') return 'You denied the sign-in request. Please try again.';
    if (errCode === 'csrf') return 'Your session expired or was invalid. Please try signing in again.';
    if (errCode === 'expired') return 'Your session has expired. Please sign in again.';
    return 'An unexpected authentication error occurred. Please try again.';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <h1 className="text-2xl font-bold mb-6">Welcome to Career Companion</h1>
      {error && (
        <div className="mb-6 p-4 bg-status-error-subtle text-status-error border border-border-default border-l-4 border-l-status-error rounded text-sm max-w-md text-center">
          {getErrorMessage(error)}
        </div>
      )}
      <p className="mb-8 text-muted-foreground">Sign in to start tracking your job applications.</p>
      <button
        onClick={handleLogin}
        className="px-4 py-2 bg-action-primary text-text-inverse rounded-none font-medium hover:bg-action-primary-hover transition"
      >
        Sign in with Google
      </button>
    </div>
  );
}
