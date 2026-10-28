// Resident pickup feedback: reasons a resident could not put out their garbage.
// `report`: the resident report category created for the barangay office to
// follow up (null = no follow-up needed, e.g. the resident missed the time).
export const feedbackReasons = [
  { id: 'truck-did-not-pass', label: 'The truck did not pass by', report: 'no-truck', whenTruckPassed: false },
  { id: 'truck-did-not-stop', label: 'The truck passed but did not stop', report: 'missed', whenTruckPassed: true },
  { id: 'missed-schedule', label: 'I missed the pickup time', report: null },
  { id: 'other', label: 'Other reason', report: 'other' },
]

export const feedbackReasonLabel = (id) => feedbackReasons.find((r) => r.id === id)?.label ?? id ?? '—'

// Reasons that make sense after the resident's answer to "Did the truck pass?".
export const reasonsFor = (truckPassed) => feedbackReasons.filter((r) => r.whenTruckPassed === undefined || r.whenTruckPassed === truckPassed)

export const feedbackId = (residentId, date) => `FB-${date}-${residentId}`
