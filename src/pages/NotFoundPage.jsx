import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={{ padding: '64px 16px', textAlign: 'center' }}>
      <h1 style={{ color: 'var(--ct-green-900)' }}>Page not found</h1>
      <p>The page you were looking for does not exist.</p>
      <Link to="/" className="ct-btn ct-btn--primary">
        Back to CleanTrack
      </Link>
    </div>
  )
}
