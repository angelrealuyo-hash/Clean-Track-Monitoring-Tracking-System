import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { api } from '../../api/client.js'
import { formatTime } from '../../utils/format.js'

const eventText = (e) => {
  if (!e) return '—'
  if (e.startsWith('arrived:')) return `Reached ${e.slice(8)}`
  return { 'sim/start': 'Simulation started', 'sim/pause': 'Paused', 'sim/resume': 'Resumed', 'sim/stop': 'Stopped', 'sim/reset': 'Reset', 'run/start': 'Route started', 'run/end': 'Route ended', 'collection/mark': 'Stop recorded' }[e] ?? e
}

// Saved simulated positions (server location_history). Written only at events,
// not every second, to avoid unnecessary database writes.
export default function LocationLogCard({ refreshKey }) {
  const { token } = useData()
  const [rows, setRows] = useState(null)
  const load = useCallback(async () => {
    try {
      setRows((await api('/admin/locations', { token })).entries)
    } catch {
      setRows([])
    }
  }, [token])
  useEffect(() => {
    // Fetching from the server is the purpose of this effect.
    // eslint-disable-next-line react/set-state-in-effect
    load()
  }, [load, refreshKey])

  return (
    <article className="ct-card lt-log">
      <div className="ct-card__header">
        <div>
          <h2>
            <History size={16} /> Simulated Location History
          </h2>
          <p>Saved at key moments (start, stops, pauses). Source: SIMULATED, not GPS.</p>
        </div>
      </div>
      <div className="ct-card__body">
        {rows === null ? (
          <p className="ct-empty">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="ct-empty">No positions saved yet. Start the simulation to record some.</p>
        ) : (
          <div className="ct-table-wrap">
            <table className="ct-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Position</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td>{formatTime(r.recorded_at)}</td>
                    <td>{eventText(r.event)}</td>
                    <td className="ct-mono">
                      {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                    </td>
                    <td>
                      <StatusBadge tone="amber">{r.source}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  )
}
