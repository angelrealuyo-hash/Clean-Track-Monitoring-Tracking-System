// DEMO ACCOUNTS ONLY. This prototype has no real authentication or backend;
// these let the login screens' "Demo / Auto Fill" buttons work.
export const demoUsers = {
  admin: {
    email: 'admin@cleantrack.gov',
    password: 'SuperAdmin#2025',
    name: 'Officer Marcus Vance',
    title: 'Barangay Solid Waste Lead',
    initials: 'MV',
  },
  resident: {
    id: 'RES-402',
    email: 'maria.santos@email.com',
    password: 'resident123',
    name: 'Maria Clara Santos',
    initials: 'MS',
    phone: '+63 917 555 0192',
    address: 'Block 4 Lot 12, Narra Street, Purok 2',
    purok: 'Purok 2',
    householdId: 'HH-SANANTONIO-402',
  },
  driver: {
    id: 'DRV-01',
    email: 'driver.ortiz@cleantrack.ph',
    password: 'driver123',
  },
}
