import { useId, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { resizeImage } from '../utils/image.js'

// "Tap to take photo or attach picture" (PDF p.38, p.47). On phones the
// camera opens; on computers a file picker. `value` is a data URL or null.
export default function PhotoPicker({ value, onChange, label = 'Tap to Take Photo or Attach Picture' }) {
  const id = useId()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onChange(await resizeImage(file))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {value ? (
        <div className="m-photo">
          <img src={value} alt="Attached evidence" />
          <span className="m-grow">
            <strong>Photo attached</strong>
            <br />
            <span className="m-muted">Saved with your report</span>
          </span>
          <button type="button" className="ct-icon-btn" onClick={() => onChange(null)} aria-label="Remove photo">
            <X size={16} />
          </button>
        </div>
      ) : (
        <label className="m-photo-drop" htmlFor={id}>
          <Camera size={16} /> {busy ? 'Preparing photo…' : label}
          <input id={id} type="file" accept="image/*" capture="environment" onChange={pick} />
        </label>
      )}
      {error && (
        <span className="ct-field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
