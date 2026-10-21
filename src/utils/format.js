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
