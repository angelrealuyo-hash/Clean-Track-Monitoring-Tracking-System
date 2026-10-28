// One collection route covering Purok 1-6, in stop order.
// DEMO: stop names, puroks, households and the weekly schedule below are
// placeholders, not an official barangay schedule or streets.
// Residents put their garbage BAGS out at each pickup point; `households` is
// roughly how many households bring bags to that point (0 = depot).
//
// DEMO ROUTE: the coordinates below are illustrative. They are NOT verified
// locations in the barangay, and the lines between stops are straight
// lines, not real streets. The map shows a "Demo route" warning while
// coordinatesVerified is false.
//
// To use your real barangay:
//   1. For each stop, find the spot on https://www.openstreetmap.org, right-click,
//      choose "Show address", and copy the latitude, longitude shown.
//      (Or record it on site with a phone GPS app.)
//   2. Put the values in `coords: [latitude, longitude]` below, in driving order.
//   3. Update `center` in barangay.js to the middle of the barangay.
//   4. Set coordinatesVerified to true once the barangay office confirms them.
import { normalizeSchedule } from './schedule.js'

export const route = {
  id: 'RT-01',
  name: 'Barangay Collection Route (demo)',
  shortName: 'Purok 1-6 Loop',
  coordinatesVerified: false,
  truckId: 'TRK-01',
  driverId: 'DRV-01',
  startTime: '06:00 AM',
  stops: [
    { id: 'STP-01', name: 'Truck Depot (Start)', purok: 'Depot', coords: [14.6000, 120.9862], households: 0 },
    { id: 'STP-02', name: 'Demo Stop 1', purok: 'Purok 1', coords: [14.6012, 120.9871], households: 30 },
    { id: 'STP-03', name: 'Demo Stop 2', purok: 'Purok 1', coords: [14.6026, 120.9874], households: 20 },
    { id: 'STP-04', name: 'Demo Stop 3', purok: 'Purok 2', coords: [14.6034, 120.9886], households: 40 },
    { id: 'STP-05', name: 'Demo Stop 4', purok: 'Purok 2', coords: [14.6029, 120.9899], households: 20 },
    { id: 'STP-06', name: 'Demo Stop 5', purok: 'Purok 3', coords: [14.6018, 120.9907], households: 50 },
    { id: 'STP-07', name: 'Demo Stop 6', purok: 'Purok 4', coords: [14.6006, 120.9915], households: 35 },
    { id: 'STP-08', name: 'Demo Stop 7', purok: 'Purok 5', coords: [14.5995, 120.9903], households: 30 },
    { id: 'STP-09', name: 'Demo Stop 8', purok: 'Purok 6', coords: [14.5989, 120.9884], households: 25 },
    { id: 'STP-10', name: 'Truck Depot (End)', purok: 'Depot', coords: [14.6000, 120.9862], households: 0 },
  ],
}

// Weekly schedule: official collection days are Monday, Wednesday and Friday
// (see schedule.js). Residents do not sort waste by type in this app.
export const weeklySchedule = normalizeSchedule()

// Reasons an admin can record when a stop is missed (Collection Monitoring).
export const missedReasons = [
  'Road blocked / alley not accessible',
  'Garbage bags were not put out',
  'Truck problem / breakdown',
  'Ran out of time in collection window',
  'Other',
]
