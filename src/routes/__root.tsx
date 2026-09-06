import { createRootRoute, Outlet, Link } from '@tanstack/react-router'


export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <div className="p-4 border-b border-border flex justify-between">
        <h1 className="font-semibold">Career Companion</h1>
        <div className="text-sm opacity-80 flex gap-4">
          <Link to="/" className="[&.active]:font-bold">Home</Link>
          <Link to="/applications" className="[&.active]:font-bold">Applications</Link>
        </div>
      </div>
      <div className="flex-1 p-4">
        <Outlet />
      </div>
    </div>
  ),
})
