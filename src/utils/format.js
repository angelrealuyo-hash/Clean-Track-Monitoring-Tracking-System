// Small display helpers shared by the apps.

export function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatCoords(position) {
  if (!position) return '—'
  return `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
}

export function todayName(date = new Date()) {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

export function formatDate(value) {
  if (!value) return '—'
  // "2024-05-18" is read as local time, not UTC, so the day never shifts.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00`) : new Date(value)
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function todayISO() {
  return localDateISO(new Date())
}

// "YYYY-MM-DD" of a date/timestamp in local time.
export function localDateISO(value) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "YYYY-MM-DD" n days before today (local time).
export function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateISO(d)
}

// "06:00 AM" <-> "06:00" (for <input type="time">)
export function to24h(label) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label?.trim() ?? '')
  if (!m) return ''
  let h = Number(m[1]) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

export function to12h(value) {
  const m = /^(\d{2}):(\d{2})$/.exec(value ?? '')
  if (!m) return ''
  const h = Number(m[1])
  return `${String(h % 12 || 12).padStart(2, '0')}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}
