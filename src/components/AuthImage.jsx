import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { useData } from '../store/dataContext.js'
import './AuthImage.css'

// Shows an uploaded image. Stored images ("upl:<id>") are private: they are
// fetched with the user's sign-in token, never through a public link.
// Older records may hold a data URL, which is shown as is.
const cache = new Map() // id -> Promise<objectURL>

function loadImage(id, token) {
  if (!cache.has(id)) {
    const p = fetch(`/api/images/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then((res) => {
      if (!res.ok) throw new Error(res.status === 403 ? 'You cannot see this image.' : 'The image could not be loaded.')
      return res.blob().then((b) => URL.createObjectURL(b))
    })
    p.catch(() => cache.delete(id)) // allow a retry later
    cache.set(id, p)
  }
  return cache.get(id)
}

export default function AuthImage({ src, alt, className = '', onClick, compactError = false }) {
  const { token } = useData()
  const id = typeof src === 'string' && src.startsWith('upl:') ? src.slice(4) : null
  const [state, setState] = useState({ for: null, url: null, error: null })

  useEffect(() => {
    if (!id || !token) return undefined
    let alive = true
    loadImage(id, token).then(
      (url) => alive && setState({ for: id, url, error: null }),
      (err) => alive && setState({ for: id, url: null, error: err.message }),
    )
    return () => {
      alive = false
    }
  }, [id, token])

  if (!src) return null
  const url = id ? (state.for === id ? state.url : null) : src
  const error = id && state.for === id ? state.error : null

  if (error) {
    return (
      <span className={`ct-img-state is-error ${className}`} role="img" aria-label={`${alt}: ${error}`} title={error}>
        <ImageOff size={compactError ? 14 : 18} />
        {!compactError && <small>{error}</small>}
      </span>
    )
  }
  if (!url) return <span className={`ct-img-state is-loading ${className}`} role="img" aria-label={`${alt} (loading)`} />
  const img = <img src={url} alt={alt} className={className} />
  return onClick ? (
    <button type="button" className="ct-img-btn" onClick={onClick} aria-label={`Open larger: ${alt}`}>
      {img}
    </button>
  ) : (
    img
  )
}
