// The official garbage collection schedule: MONDAY, WEDNESDAY AND FRIDAY ONLY.
// Every app and the server use this file, so the days can never disagree.
// The admin may change the time window of these days, not the days themselves.

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const COLLECTION_DAYS = ['Monday', 'Wednesday', 'Friday']
export const COLLECTION = 'Garbage collection'
export const NO_COLLECTION = 'No collection'
export const DEFAULT_WINDOW = '06:00 AM - 10:00 AM'

export const isCollectionDay = (day) => COLLECTION_DAYS.includes(day)

// 'YYYY-MM-DD' -> 'Monday'... (local date, never shifted by time zones)
export const dayOfDate = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('en-US', { weekday: 'long' })
export const isCollectionDate = (iso) => isCollectionDay(dayOfDate(iso))

// Applies the official days to a saved weekly schedule (keeps saved time
// windows for Mon/Wed/Fri; every other day is "No collection").
export function normalizeSchedule(weekly = []) {
  return WEEK_DAYS.map((day) => {
    const saved = weekly.find((d) => d.day === day)
    if (!isCollectionDay(day)) return { day, wasteType: NO_COLLECTION, window: '-' }
    const window = saved?.window && saved.window !== '-' ? saved.window : DEFAULT_WINDOW
    return { day, wasteType: COLLECTION, window }
  })
}

export const scheduleLabel = 'Monday, Wednesday and Friday'

// ---------- Holidays and suspensions (set by the admin) ----------
export const exceptionKinds = {
  holiday: 'Holiday',
  suspended: 'Collection suspended',
}

export const exceptionOn = (iso, exceptions = []) => exceptions.find((x) => x.date === iso) ?? null

// Is there a regular pickup on this date? (official day and no holiday/suspension)
export const isPickupDate = (iso, exceptions = []) => isCollectionDate(iso) && !exceptionOn(iso, exceptions)
