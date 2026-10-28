// What the Resident calendar shows for one date, from saved records only.
//   'holiday'   – admin set a holiday / suspension (shown instead of the truck)
//   'done'      – the resident confirmed they disposed of their garbage
//   'skipped'   – the resident answered "not today" (explicit skip)
//   'missed'    – they said they could NOT dispose, or a pickup check went out,
//                 the day has passed, and it was never completed
//   'scheduled' – a regular pickup day (truck), no result (yet)
//   null        – not a pickup day
import { exceptionOn, isCollectionDate } from './schedule.js'

/**
 * @param {string} iso       'YYYY-MM-DD'
 * @param {object} ctx       { today, exceptions, feedback (this resident's), checkDates (Set of dates a
 *                             Pick Up Check was sent), since ('YYYY-MM-DD' the resident joined) }
 */
export function dayStatus(iso, { today, exceptions = [], feedback = [], checkDates = new Set(), since = '' }) {
  if (!isCollectionDate(iso)) return null
  const ex = exceptionOn(iso, exceptions)
  if (ex) return { status: 'holiday', exception: ex }
  const answer = feedback.find((f) => f.date === iso) ?? null
  if (answer?.disposed === true) return { status: 'done', answer }
  if (answer && answer.willDispose === false) return { status: 'skipped', answer }
  if (answer?.disposed === false) return { status: 'missed', answer }
  // No completed answer: only a PAST day that had a check counts as not completed.
  const passed = iso < today
  if (passed && checkDates.has(iso) && (!since || iso >= since)) return { status: 'missed', answer, unanswered: true }
  return { status: 'scheduled', answer }
}

export const calendarLegend = {
  scheduled: 'Pickup day (truck scheduled)',
  done: 'You disposed of your garbage',
  skipped: 'You skipped (not putting out garbage)',
  missed: 'Not completed',
  holiday: 'Holiday / no pickup',
}
