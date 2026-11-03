// Official Philippine holidays for the Resident app's pickup schedule.
//
// Dates come ONLY from the year's presidential proclamations (no guessing):
// movable holidays (Holy Week, Chinese New Year, National Heroes Day, Eid'l Fitr,
// Eid'l Adha) change every year, so each year is listed in full. A year that is
// not listed here has no holidays shown until its proclamation is added.
//
// Included: nationwide regular holidays and special (non-working) days.
// Not included: special WORKING days (e.g. EDSA anniversary, Feb 25), local or
// regional days (e.g. Proc. No. 1447, s. 2026: 16-18 Nov 2026, NCR only), and
// ordinary observances that are not non-working days.
//
// To add a year: copy its proclamation (and any later Eid'l Fitr / Eid'l Adha
// or additional special day proclamations) into a new entry below.

import { exceptionOn, isPickupDate } from '../../data/schedule.js'

const R = 'regular'
const S = 'special'

export const holidayTypes = {
  regular: 'Regular holiday',
  special: 'Special non-working day',
}

/** year -> list of [date, name, type, proclamation] */
const BY_YEAR = {
  2025: [
    ['2025-01-01', "New Year's Day", R, 'Proc. No. 727, s. 2024'],
    ['2025-01-29', 'Chinese New Year', S, 'Proc. No. 727, s. 2024'],
    ['2025-04-01', "Eid'l Fitr (Feast of Ramadhan)", R, 'Proc. No. 839, s. 2025'],
    ['2025-04-09', 'Araw ng Kagitingan', R, 'Proc. No. 727, s. 2024'],
    ['2025-04-17', 'Maundy Thursday', R, 'Proc. No. 727, s. 2024'],
    ['2025-04-18', 'Good Friday', R, 'Proc. No. 727, s. 2024'],
    ['2025-04-19', 'Black Saturday', S, 'Proc. No. 727, s. 2024'],
    ['2025-05-01', 'Labor Day', R, 'Proc. No. 727, s. 2024'],
    ['2025-05-12', '2025 National and Local Elections', S, 'Proc. No. 878, s. 2025'],
    ['2025-06-06', "Eid'l Adha (Feast of Sacrifice)", R, 'Proc. No. 911, s. 2025'],
    ['2025-06-12', 'Independence Day', R, 'Proc. No. 727, s. 2024'],
    ['2025-07-27', 'Iglesia ni Cristo Founding Anniversary', S, 'Proc. No. 729, s. 2024'],
    ['2025-08-21', 'Ninoy Aquino Day', S, 'Proc. No. 727, s. 2024'],
    ['2025-08-25', 'National Heroes Day', R, 'Proc. No. 727, s. 2024'],
    ['2025-10-31', "All Saints' Day Eve", S, 'Proc. No. 727, s. 2024'],
    ['2025-11-01', "All Saints' Day", S, 'Proc. No. 727, s. 2024'],
    ['2025-11-30', 'Bonifacio Day', R, 'Proc. No. 727, s. 2024'],
    ['2025-12-08', 'Feast of the Immaculate Conception of Mary', S, 'Proc. No. 727, s. 2024'],
    ['2025-12-24', 'Christmas Eve', S, 'Proc. No. 727, s. 2024'],
    ['2025-12-25', 'Christmas Day', R, 'Proc. No. 727, s. 2024'],
    ['2025-12-30', 'Rizal Day', R, 'Proc. No. 727, s. 2024'],
    ['2025-12-31', 'Last Day of the Year', S, 'Proc. No. 727, s. 2024'],
  ],
  2026: [
    ['2026-01-01', "New Year's Day", R, 'Proc. No. 1006, s. 2025'],
    ['2026-02-17', 'Chinese New Year', S, 'Proc. No. 1006, s. 2025'],
    ['2026-03-20', "Eid'l Fitr (Feast of Ramadhan)", R, 'Proc. No. 1189, s. 2026'],
    ['2026-04-02', 'Maundy Thursday', R, 'Proc. No. 1006, s. 2025'],
    ['2026-04-03', 'Good Friday', R, 'Proc. No. 1006, s. 2025'],
    ['2026-04-04', 'Black Saturday', S, 'Proc. No. 1006, s. 2025'],
    ['2026-04-09', 'Araw ng Kagitingan', R, 'Proc. No. 1006, s. 2025'],
    ['2026-05-01', 'Labor Day', R, 'Proc. No. 1006, s. 2025'],
    ['2026-05-27', "Eid'l Adha (Feast of Sacrifice)", R, 'Proc. No. 1264, s. 2026'],
    ['2026-06-12', 'Independence Day', R, 'Proc. No. 1006, s. 2025'],
    ['2026-08-21', 'Ninoy Aquino Day', S, 'Proc. No. 1006, s. 2025'],
    ['2026-08-31', 'National Heroes Day', R, 'Proc. No. 1006, s. 2025'],
    ['2026-11-01', "All Saints' Day", S, 'Proc. No. 1006, s. 2025'],
    ['2026-11-02', "All Souls' Day", S, 'Proc. No. 1006, s. 2025'],
    ['2026-11-30', 'Bonifacio Day', R, 'Proc. No. 1006, s. 2025'],
    ['2026-12-08', 'Feast of the Immaculate Conception of Mary', S, 'Proc. No. 1006, s. 2025'],
    ['2026-12-24', 'Christmas Eve', S, 'Proc. No. 1006, s. 2025'],
    ['2026-12-25', 'Christmas Day', R, 'Proc. No. 1006, s. 2025'],
    ['2026-12-30', 'Rizal Day', R, 'Proc. No. 1006, s. 2025'],
    ['2026-12-31', 'Last Day of the Year', S, 'Proc. No. 1006, s. 2025'],
  ],
  // Eid'l Fitr and Eid'l Adha 2027: not yet proclaimed (add them when they are).
  2027: [
    ['2027-01-01', "New Year's Day", R, 'Proc. No. 1427, s. 2026'],
    ['2027-02-06', 'Chinese New Year', S, 'Proc. No. 1427, s. 2026'],
    ['2027-03-25', 'Maundy Thursday', R, 'Proc. No. 1427, s. 2026'],
    ['2027-03-26', 'Good Friday', R, 'Proc. No. 1427, s. 2026'],
    ['2027-03-27', 'Black Saturday', S, 'Proc. No. 1427, s. 2026'],
    ['2027-04-09', 'Araw ng Kagitingan', R, 'Proc. No. 1427, s. 2026'],
    ['2027-05-01', 'Labor Day', R, 'Proc. No. 1427, s. 2026'],
    ['2027-06-12', 'Independence Day', R, 'Proc. No. 1427, s. 2026'],
    ['2027-08-21', 'Ninoy Aquino Day', S, 'Proc. No. 1427, s. 2026'],
    ['2027-08-30', 'National Heroes Day', R, 'Proc. No. 1427, s. 2026'],
    ['2027-11-01', "All Saints' Day", S, 'Proc. No. 1427, s. 2026'],
    ['2027-11-02', "All Souls' Day", S, 'Proc. No. 1427, s. 2026'],
    ['2027-11-30', 'Bonifacio Day', R, 'Proc. No. 1427, s. 2026'],
    ['2027-12-08', 'Feast of the Immaculate Conception of Mary', S, 'Proc. No. 1427, s. 2026'],
    ['2027-12-24', 'Christmas Eve', S, 'Proc. No. 1427, s. 2026'],
    ['2027-12-25', 'Christmas Day', R, 'Proc. No. 1427, s. 2026'],
    ['2027-12-30', 'Rizal Day', R, 'Proc. No. 1427, s. 2026'],
    ['2027-12-31', 'Last Day of the Year', S, 'Proc. No. 1427, s. 2026'],
  ],
}

const BY_DATE = new Map(Object.values(BY_YEAR).flat().map(([date, name, type, proclamation]) => [date, { date, name, type, proclamation }]))

/** The official holiday on 'YYYY-MM-DD', or null. */
export const phHolidayOn = (iso) => BY_DATE.get(iso) ?? null

/** Are the official holidays of this year listed? */
export const holidaysListedFor = (year) => Boolean(BY_YEAR[year])

/** All listed holidays of a year (for tests and lists). */
export const phHolidaysOf = (year) => (BY_YEAR[year] ?? []).map(([date]) => BY_DATE.get(date))

// ---------- The Resident pickup schedule ----------
// A regular pickup needs an official collection day (Mon/Wed/Fri), no official
// holiday and no barangay holiday/suspension. Holidays only cancel the pickup;
// it is never moved to another day.

/** Is there a regular pickup for residents on 'YYYY-MM-DD'? */
export const isResidentPickupDate = (iso, exceptions = []) => isPickupDate(iso, exceptions) && !phHolidayOn(iso)

/** Why there is no pickup on a collection day: { kind, reason } or null. */
export function pickupCancelledBy(iso, exceptions = []) {
  const ex = exceptionOn(iso, exceptions)
  if (ex) return ex
  const h = phHolidayOn(iso)
  return h ? { kind: 'holiday', reason: h.name, official: h } : null
}
