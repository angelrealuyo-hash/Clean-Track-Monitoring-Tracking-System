// Everyday wording for the Resident and Driver apps, so ordinary people can
// understand them. The Admin website keeps the official terms.

const waste = {
  // Residents put out tied garbage BAGS; no bins are required.
  'Biodegradable (Kitchen & Yard Waste)': { name: 'Food & garden waste', bin: '' },
  'Recyclables (Plastics, Cartons, Metals)': { name: 'Recyclables', bin: '' },
  'Residual Non-Recyclable Waste': { name: 'Other trash', bin: '' },
  'Hazardous & Electronic Waste (Drop-off)': { name: 'Batteries & electronics', bin: 'drop-off only' },
  'No collection': { name: 'No pickup', bin: '' },
}

// e.g. "Food & garden waste" or "Batteries & electronics (drop-off only)"
export function plainWaste(wasteType) {
  const w = waste[wasteType]
  if (!w) return wasteType ?? '—'
  return w.bin ? `${w.name} (${w.bin})` : w.name
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
