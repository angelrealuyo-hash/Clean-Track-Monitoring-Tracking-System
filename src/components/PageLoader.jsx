// Shown for a moment while a page's code downloads.
export default function PageLoader() {
  return (
    <div className="ct-empty" role="status" style={{ padding: '48px 16px' }}>
      Loading…
    </div>
  )
}
