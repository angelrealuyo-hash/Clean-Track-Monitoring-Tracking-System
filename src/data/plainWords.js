// Everyday wording for the Resident and Driver apps, so ordinary people can
// understand them. The Admin website keeps the official terms.

// Residents put out tied garbage BAGS; they are not asked to sort by waste type.
// Older saved schedules may still name a waste type: any of those reads as a pickup.
export function plainWaste(wasteType) {
  if (!wasteType) return '—'
  return wasteType === 'No collection' ? 'No pickup' : 'Garbage pickup'
}

// Report problem types, in the resident's words.
export const plainProblem = {
  missed: { label: 'Missed collection', hint: 'My garbage bags were not picked up' },
  'no-truck': { label: 'Truck did not come', hint: 'Pickup time is over and no truck came' },
  spillage: { label: 'Garbage was scattered', hint: 'Bags torn or trash left on the street' },
  overflow: { label: 'Garbage piled up', hint: 'Too many bags left at the pickup point' },
  other: { label: 'Other problem', hint: 'Anything else about garbage' },
}

export const plainProblemLabel = (id) => plainProblem[id]?.label ?? 'Problem'

// Report status, in plain words.
export const plainReportStatus = {
  submitted: ['amber', 'Submitted'],
  'in-progress': ['blue', 'Reviewing'],
  resolved: ['green', 'Resolved'],
}

// Stop status for the driver, in plain words (tone matches the badge colour).
export const plainStopStatus = {
  collected: { tone: 'green', label: 'Done' },
  missed: { tone: 'red', label: 'Could not pick up' },
  next: { tone: 'amber', label: 'Go here next' },
  pending: { tone: 'gray', label: 'Not yet' },
  depot: { tone: 'blue', label: 'Truck parking' },
}

// The truck's (simulated) state, in plain words.
export const plainTruckState = {
  idle: 'Not started',
  running: 'Driving',
  paused: 'On a break',
  stopped: 'Stopped',
  completed: 'Finished',
}
