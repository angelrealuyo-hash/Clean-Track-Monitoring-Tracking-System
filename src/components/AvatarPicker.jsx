import { useId, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import Avatar from './Avatar.jsx'
import './AuthImage.css'
import { resizeImage } from '../utils/image.js'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

// Upload / change / remove a profile picture. `value` is "upl:<id>", a data
// URL (new, not saved yet) or null. The picture is resized to 320 px.
export default function AvatarPicker({ value, onChange, initials, name, busy = false, size = 64 }) {
  const id = useId()
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!ACCEPT.includes(file.type)) return setError('Use a JPG, PNG or WebP picture.')
    if (file.size > 10 * 1024 * 1024) return setError('That picture is too large (max 10 MB).')
    setWorking(true)
    try {
      onChange(await resizeImage(file, 320, 0.8))
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking(false)
    }
  }

  const disabled = busy || working
  return (
    <div className="ct-avatar-picker">
      <Avatar photo={value} initials={initials} name={name} className="ct-avatar" style={{ width: size, height: size, fontSize: size / 3 }} />
      <div className="ct-avatar-picker__actions">
        <label htmlFor={id} className={`ct-btn ct-btn--secondary ${disabled ? 'is-disabled' : ''}`} aria-disabled={disabled}>
          <Camera size={15} /> {working ? 'Preparing…' : value ? 'Change Picture' : 'Upload Picture'}
          <input id={id} type="file" accept={ACCEPT.join(',')} onChange={pick} disabled={disabled} className="ct-sr-only" />
        </label>
        {value && (
          <button type="button" className="ct-btn ct-btn--secondary" onClick={() => onChange(null)} disabled={disabled}>
            <Trash2 size={15} /> Remove
          </button>
        )}
        <small className="ct-field__hint">JPG, PNG or WebP, up to 10 MB.</small>
        {error && (
          <span className="ct-field__error" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  )
}
