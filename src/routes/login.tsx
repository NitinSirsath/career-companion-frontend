import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/login')({
  component: Login,
});

function Login() {
  const handleLogin = () => {
    // Redirects to backend auth connect through Vite proxy
    window.location.href = '/api/auth/connect';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <h1 className="text-2xl font-bold mb-6">Welcome to Career Companion</h1>
      <p className="mb-8 text-muted-foreground">Sign in to start tracking your job applications.</p>
      <button
        onClick={handleLogin}
        className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
      >
        Sign in with Google
      </button>
    </div>
  );
}
