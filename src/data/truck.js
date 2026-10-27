// The barangay's one garbage truck.
export const truck = {
  id: 'TRK-01',
  plateNumber: 'ABC-1024',
  type: 'Mini Compactor',
  model: '2022 Isuzu Elf N-Series',
  capacityTons: 5.0,
  fuel: 'Diesel Euro-4',
  odometerKm: 24380,
  driverId: 'DRV-01',
  routeId: 'RT-01',
  // 'active' | 'delayed' | 'standby' | 'maintenance'
  status: 'active',
  maintenance: [
    {
      date: '2024-05-18',
      type: 'Routine Inspection & Oil Change',
      notes: 'Cleared municipal safety inspection.',
    },
  ],
  nextServiceDate: '2024-06-25',
}

export const maintenanceTypes = [
  'Routine Inspection & Oil Change',
  'Hydraulic System Repair',
  'Brake Pad Replacement',
  'Tire Replacement / Alignment',
  'Emergency Breakdown Service',
]

export const vehicleTypes = ['Mini Compactor', 'Dump Truck', 'Utility Flatbed']
export const fuelTypes = ['Diesel Euro-4', 'Diesel Euro-2', 'Gasoline', 'Electric']
