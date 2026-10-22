// 'on-shift' | 'standby' | 'off-duty'
export const drivers = [
  {
    id: 'DRV-01',
    name: 'Carlos Ortiz',
    initials: 'CO',
    phone: '+63 917 555 0142',
    license: 'Professional Driver (Class 2)',
    shift: 'Morning Shift (06:00 AM - 02:00 PM)',
    status: 'on-shift',
  },
  {
    id: 'DRV-02',
    name: 'Mateo Reyes',
    initials: 'MR',
    phone: '+63 917 555 0199',
    license: 'Professional Driver (Class 2)',
    shift: 'Relief Driver',
    status: 'standby',
  },
]

export const shiftOptions = [
  'Morning Shift (06:00 AM - 02:00 PM)',
  'Afternoon Shift (02:00 PM - 10:00 PM)',
  'Relief Driver',
]
