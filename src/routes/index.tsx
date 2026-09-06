import { createFileRoute } from '@tanstack/react-router'


export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="p-2">
      <h3>Welcome to Career Companion</h3>
      <p className="text-sm">Frontend foundation established.</p>
    </div>
  )
}
