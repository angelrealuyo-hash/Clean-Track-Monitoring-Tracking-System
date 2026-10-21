// TEMPORARY preview for Phase 4: shows that every page and the simulated GPS
// service load. Phase 5 replaces this with React Router and the real layouts.
import { useEffect, useState } from 'react'
import * as adminPages from './admin/pages/index.js'
import * as residentPages from './resident/pages/index.js'
import * as driverPages from './driver/pages/index.js'
import { startGpsSimulation, SIMULATION_LABEL } from './services/simulatedGps.js'
import StatusBadge from './components/StatusBadge.jsx'
import { barangay } from './data/barangay.js'
import { truck } from './data/truck.js'

const apps = [
  ['Admin Website', adminPages],
  ['Resident App', residentPages],
  ['Driver App', driverPages],
]

export default function App() {
  const [selected, setSelected] = useState(['Admin Website', 'DashboardPage'])
  const [gps, setGps] = useState(null)

  useEffect(() => startGpsSimulation(setGps), [])

  const SelectedPage = apps.find(([name]) => name === selected[0])[1][selected[1]]

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ color: 'var(--ct-green-900)' }}>CleanTrack: structure preview</h1>
      <p>
        {barangay.name} · {truck.id} ({truck.type}){' '}
        <StatusBadge tone="green">{truck.status}</StatusBadge>
      </p>
      {gps && (
        <p>
          <StatusBadge tone="amber">{SIMULATION_LABEL}</StatusBadge>{' '}
          {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} · {gps.speedKmh} km/h · next stop: {gps.nextStop.name}
        </p>
      )}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {apps.map(([appName, pages]) => (
          <div key={appName}>
            <h3>{appName}</h3>
            {Object.keys(pages).map((page) => (
              <div key={page}>
                <button type="button" onClick={() => setSelected([appName, page])}>
                  {page}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <SelectedPage />
    </div>
  )
}
