// Resident-submitted problem reports.
// status: 'submitted' | 'in-progress' | 'resolved'
export const reportCategories = [
  { id: 'missed', label: 'Missed Garbage Collection', hint: 'Scheduled pickup bypassed your bin' },
  { id: 'no-truck', label: 'Garbage Truck Did Not Arrive', hint: 'Collection window passed with no truck' },
  { id: 'spillage', label: 'Improper Waste Collection / Spillage', hint: 'Litter scattered or bin damaged' },
  { id: 'overflow', label: 'Overflowing Communal Garbage', hint: 'Communal bin needs an extra pickup' },
  { id: 'other', label: 'Other Community Waste Concern', hint: 'General sanitation questions' },
]

export const reports = [
  {
    id: 'REP-2024-094',
    residentId: 'RES-402',
    category: 'missed',
    location: 'Block 4 Lot 12, Narra Street, Purok 2',
    description: 'Curbside green bin was left uncollected after the morning run.',
    submittedAt: '2024-10-24T09:12:00',
    status: 'in-progress',
    adminResponse: 'Truck bypassed Narra St. corner due to a parked delivery van. Driver will return by 11:30 AM.',
  },
  {
    id: 'REP-2024-088',
    residentId: 'RES-402',
    category: 'overflow',
    location: 'Corner Narra & Bonifacio St.',
    description: 'Communal waste bin is full before the evening.',
    submittedAt: '2024-10-23T15:15:00',
    status: 'submitted',
    adminResponse: null,
  },
  {
    id: 'REP-2024-071',
    residentId: 'RES-402',
    category: 'spillage',
    location: 'Purok 2 Alleyway',
    description: 'Garbage spilled near the alley entrance during pickup.',
    submittedAt: '2024-10-18T08:40:00',
    status: 'resolved',
    adminResponse: 'Area cleaned by collection crew on Oct 18.',
  },
]
