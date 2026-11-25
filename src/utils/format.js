// Small date/time and display helpers shared by the apps and the server.
//
// CleanTrack serves Barangay Rizal, Taguig City, so every "today", weekday and
// clock time is PHILIPPINE time (Asia/Manila), wherever the code runs: the
// server may run in UTC and a phone may be set to another zone. Never use the
// machine's own time zone for these (no getDay()/getHours()/setHours() on "now").
export const APP_TIME_ZONE = 'Asia/Manila'
// The Philippines has no daylight saving time, so Manila is always UTC+08:00.
export const APP_UTC_OFFSET = '+08:00'

const manilaFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'long',
  hourCycle: 'h23',
})

/** A moment (Date, ms or ISO timestamp) in Manila: { iso: 'YYYY-MM-DD', weekday, hour, minute }. */
export function manilaParts(value = Date.now()) {
  const p = Object.fromEntries(manilaFormat.formatToParts(new Date(value)).map((x) => [x.type, x.value]))
  return { iso: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday, hour: Number(p.hour), minute: Number(p.minute) }
}

/** The moment (ms) of a Manila clock time on a Manila date: ('2026-11-27', '04:30') -> ms. */
export function manilaMoment(iso, hhmm) {
  return Date.parse(`${iso}T${hhmm}:00${APP_UTC_OFFSET}`)
}

export function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: APP_TIME_ZONE })
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  })
}

/** Full date and time in Manila (CSV exports). */
export function formatStamp(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-PH', { timeZone: APP_TIME_ZONE })
}

export function formatCoords(position) {
  if (!position) return '—'
  return `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
}

/** Weekday name in Manila ('Monday'...), now or for a given moment. */
export function todayName(date = Date.now()) {
  return manilaParts(date).weekday
}

export function formatDate(value) {
  if (!value) return '—'
  // A calendar date ("2024-05-18") is shown exactly as written, in any time
  // zone; a timestamp is shown as its Manila date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: APP_TIME_ZONE })
}

/** Today's date in Manila, "YYYY-MM-DD" (optionally for a given moment). */
export function todayISO(now = Date.now()) {
  return manilaParts(now).iso
}

/** "YYYY-MM-DD" of a timestamp, in Manila (e.g. the day a record was saved). */
export function manilaDateISO(value) {
  return manilaParts(value).iso
}

// "YYYY-MM-DD" of a calendar Date built on this device (new Date(y, m, d)),
// for month grids. Not for timestamps: use manilaDateISO.
export function localDateISO(value) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "YYYY-MM-DD" n days before today's Manila date. */
export function daysAgoISO(n, now = Date.now()) {
  const [y, m, d] = todayISO(now).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10)
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
