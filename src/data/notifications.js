// audience: 'admin' | 'resident' | 'driver'
// priority: 'high' | 'medium' | 'low'
export const notifications = [
  { id: 'N-001', audience: 'admin', priority: 'high', title: 'Missed collection reported in Purok 2', body: 'Resident report REP-2024-094 lodged for Purok 2.', time: '2024-10-24T08:35:00', read: false, link: { label: 'Open report REP-2024-094', to: '/admin/resident-reports?id=REP-2024-094' } },
  { id: 'N-002', audience: 'admin', priority: 'medium', title: 'TRK-01 schedule delayed > 15 min', body: 'Heavy traffic on the route (demo).', time: '2024-10-24T08:04:00', read: false, link: { label: 'Open Live Tracking', to: '/admin/live-tracking' } },
  { id: 'N-003', audience: 'admin', priority: 'low', title: 'Carlos Ortiz started shift', body: 'Pre-trip checklist completed.', time: '2024-10-24T06:15:00', read: true },
  { id: 'N-101', audience: 'resident', priority: 'high', title: 'Garbage truck TRK-01 nearby!', body: 'The truck is entering Purok 2 (simulated demo alert).', time: '2024-10-24T08:50:00', read: false, zone: 'Purok 2', link: { label: 'View Live Tracking', to: '/resident/track' } },
  { id: 'N-102', audience: 'resident', priority: 'medium', title: 'Update on report REP-2024-094', body: 'Your missed bin will be collected by 11:30 AM.', time: '2024-10-24T09:27:00', read: false, residentId: 'RES-402', link: { label: 'View Report', to: '/resident/reports/REP-2024-094' } },
  { id: 'N-103', audience: 'resident', priority: 'low', title: 'Holiday collection schedule', body: 'Monday collection moves to Tuesday morning.', time: '2024-10-23T16:20:00', read: true, zone: 'All Puroks' },
  { id: 'N-201', audience: 'driver', priority: 'high', title: 'Return to Demo Stop 3', body: 'Missed bin reported. Please collect before 11:30 AM.', time: '2024-10-24T09:25:00', read: false, link: { label: 'Open Stop', to: '/driver/route?stop=STP-04' } },
  { id: 'N-202', audience: 'driver', priority: 'low', title: 'Shift schedule confirmed', body: 'Morning shift 06:00 - 14:00 for TRK-01.', time: '2024-10-24T05:30:00', read: true },
]

// Broadcasts the admin has sent to residents ("Resident Outbox").
export const residentBroadcasts = [
  { id: 'B-01', zone: 'Purok 1-2', subject: 'Morning organic waste collection approaching', channels: ['App', 'Email'], sentAt: '2024-10-24T08:10:00' },
  { id: 'B-02', zone: 'All Puroks', subject: 'Holiday special collection schedule notice', channels: ['App', 'Email'], sentAt: '2024-10-23T17:00:00' },
]
