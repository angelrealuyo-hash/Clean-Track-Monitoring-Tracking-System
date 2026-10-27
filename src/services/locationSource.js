// Where the truck's location comes from.
//
// Today CleanTrack only has the SIMULATED source (services/trackingSimulation.js),
// because no GPS device is installed on the barangay truck. If a real GPS
// tracker is added later, its readings should be stored separately (for example
// a `gpsReadings` list with source: 'GPS_DEVICE') and the screens should prefer
// them. Simulated positions must never be saved as real GPS readings.
export const LOCATION_SOURCES = {
  SIMULATED: { label: 'SIMULATED GPS — DEMO MODE', real: false },
  GPS_DEVICE: { label: 'GPS device', real: true }, // not connected yet
}

export const ACTIVE_LOCATION_SOURCE = 'SIMULATED'
