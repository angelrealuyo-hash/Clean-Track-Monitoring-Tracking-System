// One collection route covering Purok 1-6, in stop order.
//
// DEMO ROUTE: the coordinates below are illustrative. They are NOT verified
// locations in Barangay San Antonio, and the lines between stops are straight
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
export const route = {
  id: 'RT-01',
  name: 'Barangay San Antonio Collection Route',
  shortName: 'Purok 1-6 Loop',
  coordinatesVerified: false,
  truckId: 'TRK-01',
  driverId: 'DRV-01',
  startTime: '06:00 AM',
  stops: [
    { id: 'STP-01', name: 'MRF Depot (Start)', purok: 'Depot', coords: [14.6000, 120.9862], bins: 0 },
    { id: 'STP-02', name: 'Rizal St. Corner Lopez', purok: 'Purok 1', coords: [14.6012, 120.9871], bins: 6 },
    { id: 'STP-03', name: 'Purok 1 Health Center', purok: 'Purok 1', coords: [14.6026, 120.9874], bins: 4 },
    { id: 'STP-04', name: 'Narra St. Block 4', purok: 'Purok 2', coords: [14.6034, 120.9886], bins: 8 },
    { id: 'STP-05', name: 'Bonifacio St. Junction', purok: 'Purok 2', coords: [14.6029, 120.9899], bins: 4 },
    { id: 'STP-06', name: 'Public Market (Mabini St.)', purok: 'Purok 3', coords: [14.6018, 120.9907], bins: 10 },
    { id: 'STP-07', name: 'Market St. Residential', purok: 'Purok 4', coords: [14.6006, 120.9915], bins: 7 },
    { id: 'STP-08', name: 'Riverside Alleyway', purok: 'Purok 5', coords: [14.5995, 120.9903], bins: 6 },
    { id: 'STP-09', name: 'South Highway Border', purok: 'Purok 6', coords: [14.5989, 120.9884], bins: 5 },
    { id: 'STP-10', name: 'MRF Depot (End)', purok: 'Depot', coords: [14.6000, 120.9862], bins: 0 },
  ],
}

// Weekly schedule shown to residents (RA 9003 segregation by day).
export const weeklySchedule = [
  { day: 'Monday', wasteType: 'Biodegradable (Kitchen & Yard Waste)', window: '06:00 AM - 10:00 AM' },
  { day: 'Tuesday', wasteType: 'Residual Non-Recyclable Waste', window: '06:00 AM - 10:00 AM' },
  { day: 'Wednesday', wasteType: 'Biodegradable (Kitchen & Yard Waste)', window: '06:00 AM - 10:00 AM' },
  { day: 'Thursday', wasteType: 'Recyclables (Plastics, Cartons, Metals)', window: '06:00 AM - 10:00 AM' },
  { day: 'Friday', wasteType: 'Biodegradable (Kitchen & Yard Waste)', window: '06:00 AM - 10:00 AM' },
  { day: 'Saturday', wasteType: 'Hazardous & Electronic Waste (Drop-off)', window: '09:00 AM - 12:00 PM' },
  { day: 'Sunday', wasteType: 'No collection', window: '-' },
]

export const wasteTypes = [
  'Biodegradable (Kitchen & Yard Waste)',
  'Recyclables (Plastics, Cartons, Metals)',
  'Residual Non-Recyclable Waste',
  'Hazardous & Electronic Waste (Drop-off)',
  'No collection',
]

// Reasons an admin can record when a stop is missed (Collection Monitoring).
export const missedReasons = [
  'Road blocked / alley not accessible',
  'Bins not placed outside',
  'Truck problem / breakdown',
  'Ran out of time in collection window',
  'Other',
]
