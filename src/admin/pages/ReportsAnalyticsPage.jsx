import { CircleCheck, ClipboardList, Download, History, Info, MapPin, Target, TriangleAlert } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import BarList from '../components/charts/BarList.jsx'
import StatusBar from '../components/charts/StatusBar.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useTracking } from '../../tracking/trackingContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { getCollectionSummary, summarizeRun } from '../../store/selectors.js'
import { reportCategories } from '../../data/reports.js'
import { downloadCsv } from '../../utils/csv.js'
import { formatDate, formatTime, todayISO } from '../../utils/format.js'
import '../components/AdminPage.css'
import './ReportsAnalyticsPage.css'

const runStatus = {
  'in-progress': ['amber', 'In progress'],
  completed: ['green', 'Completed'],
  'ended-early': ['red', 'Ended early'],
}

// PDF pages 30-31. Every figure is computed from records saved by the app:
// collection runs (driver/office stop records) and resident reports.
export default function ReportsAnalyticsPage() {
  const { data } = useData()
  const { route, progress } = useTracking()
  const toast = useToast()
  const { runs, reports, settings } = data

  const history = runs.map((run) => ({ run, ...summarizeRun(run) })) // newest first
  const recorded = history.filter((h) => h.collected + h.missed > 0)
  const avgCompletion = recorded.length ? Math.round(recorded.reduce((n, h) => n + h.percent, 0) / recorded.length) : null
  const totalCollected = history.reduce((n, h) => n + h.collected, 0)
  const totalMissed = history.reduce((n, h) => n + h.missed, 0)
  const resolved = reports.filter((r) => r.status === 'resolved').length
  const resolution = reports.length ? Math.round((resolved / reports.length) * 100) : 0
  const today = getCollectionSummary(route, progress)

  const trend = history
    .slice(0, 7)
    .reverse()
    .map((h) => ({ label: `${formatDate(h.run.date)} · ${h.run.id.split('-').pop()}`, value: h.percent, detail: `${h.collected} of ${h.total} collected` }))

  const byCategory = reportCategories
    .map((c) => {
      const inCat = reports.filter((r) => r.category === c.id)
      return { label: c.label, value: inCat.length, detail: `${inCat.filter((r) => r.status !== 'resolved').length} open` }
    })
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)

  // Per purok, across all saved runs.
  const puroks = {}
  for (const { run } of history) {
    for (const stop of run.stops) {
      const p = (puroks[stop.purok] ??= { purok: stop.purok, collected: 0, missed: 0, notDone: 0 })
      const r = run.results[stop.id]?.status
      if (r === 'collected') p.collected += 1
      else if (r === 'missed') p.missed += 1
      else if (run.endedAt) p.notDone += 1
    }
  }
  const purokRows = Object.values(puroks).sort((a, b) => a.purok.localeCompare(b.purok))

  function exportCsv() {
    downloadCsv(
      `cleantrack-collection-runs-${todayISO()}.csv`,
      ['Run', 'Date', 'Driver', 'Started', 'Ended', 'Pickup points', 'Collected', 'Missed', 'Not done', 'Completion %', 'Status'],
      history.map((h) => [
        h.run.id,
        h.run.date,
        h.run.driverName,
        new Date(h.run.startedAt).toLocaleString('en-PH'),
        h.run.endedAt ? new Date(h.run.endedAt).toLocaleString('en-PH') : '',
        h.total,
        h.collected,
        h.missed,
        h.notDone,
        h.percent,
        runStatus[h.run.status][1],
      ]),
    )
    toast('Collection run history exported')
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Reports & Analytics"
        badge="From saved records"
        subtitle="Collection results and resident feedback for the barangay"
        actions={
          <button type="button" className="ct-btn ct-btn--primary" onClick={exportCsv} disabled={history.length === 0}>
            <Download size={16} /> Export CSV Report
          </button>
        }
      />

      <div className="ct-alert">
        <Info size={16} />
        <span>
          Built from <strong>{runs.length}</strong> saved collection run{runs.length === 1 ? '' : 's'} and{' '}
          <strong>{reports.length}</strong> resident reports saved in the CleanTrack database. A run is saved each time the driver taps Start
          Route. Truck positions are simulated; stop results are what the driver or office recorded.
        </span>
      </div>

      <section className="ct-stats" aria-label="Key figures">
        <StatCard label="Average Completion" icon={Target} value={avgCompletion === null ? '—' : `${avgCompletion}%`} highlight>
          <span>
            Target {settings.completionTarget}% ·{' '}
            {avgCompletion === null ? 'no recorded runs yet' : avgCompletion >= settings.completionTarget ? <b>target met</b> : 'below target'}
          </span>
        </StatCard>
        <StatCard label="Pickups Recorded" icon={CircleCheck} value={totalCollected} unit="collected">
          <span>Across {runs.length} run(s)</span>
        </StatCard>
        <StatCard label="Missed Pickups" icon={TriangleAlert} value={totalMissed} unit="missed" tone="amber">
          <span>Reported by driver or office</span>
        </StatCard>
        <StatCard label="Resident Reports" icon={ClipboardList} value={reports.length} unit="reports">
          <span>
            <b>{resolution}%</b> resolved ({resolved}/{reports.length})
          </span>
        </StatCard>
      </section>

      <div className="analytics-row">
        <article className="ct-card">
          <div className="ct-card__header">
            <div>
              <h2>Completion per Run</h2>
              <p>Last {trend.length || 0} collection run(s), % of pickup points collected</p>
            </div>
          </div>
          <div className="ct-card__body">
            {trend.length ? (
              <BarList items={trend} unit="%" max={100} label="Completion per run" />
            ) : (
              <p className="ct-empty">No collection runs yet. Start a route in the Driver app to record one.</p>
            )}
          </div>
        </article>

        <article className="ct-card">
          <div className="ct-card__header">
            <div>
              <h2>Resident Reports by Category</h2>
              <p>
                {reports.length} reports · {reports.length - resolved} open
              </p>
            </div>
          </div>
          <div className="ct-card__body">
            <BarList items={byCategory} unit="reports" label="Reports per category" />
          </div>
        </article>
      </div>

      <article className="ct-card analytics-gap">
        <div className="ct-card__header">
          <div>
            <h2>Current Run: Pickup Point Status</h2>
            <p>{today.total} pickup points on {route.shortName}</p>
          </div>
        </div>
        <div className="ct-card__body">
          <StatusBar
            label="Pickup points by status"
            total={today.total}
            segments={[
              { key: 'collected', label: 'Collected', value: today.collected },
              { key: 'next', label: 'Truck heading there', value: today.next },
              { key: 'pending', label: 'Not yet', value: today.pending },
              { key: 'missed', label: 'Missed', value: today.missed },
            ]}
          />
        </div>
      </article>

      <article className="ct-card analytics-gap">
        <div className="ct-card__header">
          <div>
            <h2>
              <History size={16} /> Collection Run History
            </h2>
            <p>Every saved run, newest first</p>
          </div>
        </div>
        <div className="ct-card__body">
          {history.length === 0 ? (
            <p className="ct-empty">No runs saved yet.</p>
          ) : (
            <div className="ct-table-wrap">
              <table className="ct-table analytics-table">
                <thead>
                  <tr>
                    <th>Date / Run</th>
                    <th>Driver</th>
                    <th>Time</th>
                    <th className="is-right">Collected</th>
                    <th className="is-right">Missed</th>
                    <th className="is-right">Not done</th>
                    <th className="is-right">Completion</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.run.id}>
                      <td>
                        <strong>{formatDate(h.run.date)}</strong>
                        <small className="ct-mono">{h.run.id}</small>
                      </td>
                      <td>{h.run.driverName}</td>
                      <td>
                        {formatTime(h.run.startedAt)} – {h.run.endedAt ? formatTime(h.run.endedAt) : 'now'}
                      </td>
                      <td className="is-right is-green">{h.collected}</td>
                      <td className={`is-right ${h.missed ? 'is-red' : ''}`}>{h.missed}</td>
                      <td className="is-right">{h.notDone}</td>
                      <td className="is-right">
                        <strong>{h.percent}%</strong>
                      </td>
                      <td>
                        <StatusBadge tone={runStatus[h.run.status][0]}>{runStatus[h.run.status][1]}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </article>

      <article className="ct-card">
        <div className="ct-card__header">
          <div>
            <h2>Results by Purok</h2>
            <p>All saved runs combined</p>
          </div>
        </div>
        <div className="ct-card__body">
          {purokRows.length === 0 ? (
            <p className="ct-empty">No results yet.</p>
          ) : (
            <div className="ct-table-wrap">
              <table className="ct-table analytics-table">
                <thead>
                  <tr>
                    <th>Purok</th>
                    <th className="is-right">Collected</th>
                    <th className="is-right">Missed</th>
                    <th className="is-right">Not done (run ended)</th>
                    <th className="is-right">Resident reports</th>
                  </tr>
                </thead>
                <tbody>
                  {purokRows.map((p) => (
                    <tr key={p.purok}>
                      <td>
                        <MapPin size={13} /> <strong>{p.purok}</strong>
                      </td>
                      <td className="is-right is-green">{p.collected}</td>
                      <td className={`is-right ${p.missed ? 'is-red' : ''}`}>{p.missed}</td>
                      <td className="is-right">{p.notDone}</td>
                      <td className="is-right">{reports.filter((r) => r.location.includes(p.purok)).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="ct-table__foot">
          <span>Reports are matched to a purok by the location the resident entered.</span>
        </div>
      </article>
    </div>
  )
}
