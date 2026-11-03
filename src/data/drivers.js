// status = availability today: 'on-shift' | 'standby' | 'off-duty'
// truckId + shift ('morning' | 'afternoon') = place on the truck roster (see data/personnel.js)
// active = false frees the roster slot
export const drivers = [
  {
    id: 'DRV-01',
    name: 'Carlos Ortiz',
    initials: 'CO',
    phone: '+63 917 555 0142',
    license: 'Professional Driver (Class 2)',
    truckId: 'TRK-01',
    shift: 'morning',
    active: true,
    status: 'on-shift',
  },
  {
    id: 'DRV-02',
    name: 'Mateo Reyes',
    initials: 'MR',
    phone: '+63 917 555 0199',
    license: 'Professional Driver (Class 2)',
    truckId: 'TRK-01',
    shift: 'afternoon',
    active: true,
    status: 'standby',
  },
]

