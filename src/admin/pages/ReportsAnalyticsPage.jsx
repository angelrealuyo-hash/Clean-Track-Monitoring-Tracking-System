import { CircleCheck, ClipboardList, Download, Info, MapPin, Target, TriangleAlert } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import BarList from '../components/charts/BarList.jsx'
import StatusBar from '../components/charts/StatusBar.jsx'
import { useData } from '../../store/dataContext.js'
import { useTracking } from '../../tracking/trackingContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { getCollectionSummary, getStopStatus } from '../../store/selectors.js'
import { isCollectionStop } from '../../services/trackingSimulation.js'
import { reportCategories } from '../../data/reports.js'
import { downloadCsv } from '../../utils/csv.js'
import { todayISO } from '../../utils/format.js'
import '../components/AdminPage.css'
import './ReportsAnalyticsPage.css'

// PDF pages 30-31. Only figures that can be computed from data CleanTrack
// actually has (today's route + reports). No invented weekly history.
export default function ReportsAnalyticsPage() {
  const { data } = useData()
  const { progress } = useTracking()
  const toast = useToast()
  const { route, reports, collectionLog, settings } = data

  const summary = getCollectionSummary(route, progress, collectionLog)
  const metTarget = summary.percent >= settings.completionTarget
  const resolved = reports.filter((r) => r.status === 'resolved').length
  const resolution = reports.length ? Math.round((resolved / reports.length) * 100) : 0

  const byCategory = reportCategories
    .map((c) => {
      const inCat = reports.filter((r) => r.category === c.id)
      const open = inCat.filter((r) => r.status !== 'resolved').length
      return { label: c.label, value: inCat.length, detail: `${open} open` }
    })
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)

  // Per-purok breakdown of today's stops.
  const stops = route.stops.filter(isCollectionStop)
  const puroks = [...new Set(stops.map((s) => s.purok))].map((purok) => {
    const inPurok = stops.filter((s) => s.purok === purok)
    const st = inPurok.map((s) => getStopStatus(s, progress, collectionLog))
    const collected = st.filter((x) => x === 'collected').length
    const missed = st.filter((x) => x === 'missed').length
    return {
      purok,
      stops: inPurok.length,
      bins: inPurok.reduce((n, s) => n + s.bins, 0),
      collected,
      missed,
      pending: inPurok.length - collected - missed,
      percent: Math.round((collected / inPurok.length) * 100),
      reports: reports.filter((r) => r.location.includes(purok)).length,
    }
  })
  const totals = puroks.reduce(
    (t, p) => ({ stops: t.stops + p.stops, bins: t.bins + p.bins, collected: t.collected + p.collected, missed: t.missed + p.missed, pending: t.pending + p.pending }),
    { stops: 0, bins: 0, collected: 0, missed: 0, pending: 0 },
  )

  function exportCsv() {
    downloadCsv(
      `cleantrack-summary-${todayISO()}.csv`,
      ['Purok', 'Stops', 'Bins', 'Collected', 'Missed', 'Pending', 'Completion %', 'Resident reports'],
      [
        ...puroks.map((p) => [p.purok, p.stops, p.bins, p.collected, p.missed, p.pending, p.percent, p.reports]),
        ['Barangay total', totals.stops, totals.bins, totals.collected, totals.missed, totals.pending, summary.percent, reports.length],
      ],
    )
    toast('Summary report exported')
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Reports & Analytics"
        badge="Today's Summary"
        subtitle="Collection completion and resident feedback for the barangay"
        actions={
          <button type="button" className="ct-btn ct-btn--primary" onClick={exportCsv}>
            <Download size={16} /> Export CSV Report
          </button>
        }
      />

      <div className="ct-alert">
        <Info size={16} />
        <span>
          CleanTrack does not keep collection history yet, so these figures cover <strong>today only</strong>,
          from the simulated route and the results recorded in Collection Monitoring. Weekly and monthly trends need a
          database (future work).
        </span>
      </div>

      <section className="ct-stats" aria-label="Key figures">
        <StatCard label="Collection Completion" icon={Target} value={`${summary.percent}%`} highlight>
          <div className="ct-progress">
            <span style={{ width: `${summary.percent}%` }} />
          </div>
          <span>
            Target {settings.completionTarget}% · {metTarget ? <b>target met</b> : 'not yet met'}
          </span>
        </StatCard>
        <StatCard label="Completed Stops" icon={CircleCheck} value={summary.collected} unit={`of ${summary.total}`}>
          <span>{totals.bins} bins on the route</span>
        </StatCard>
        <StatCard label="Missed Stops" icon={TriangleAlert} value={summary.missed} unit="stops" tone="amber">
          <span>{summary.missed ? 'Flagged for a return trip' : 'None recorded today'}</span>
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
              <h2>Today&apos;s Stop Status</h2>
              <p>{summary.total} collection stops on {route.shortName}</p>
            </div>
          </div>
          <div className="ct-card__body">
            <StatusBar
              label="Stops by status"
              total={summary.total}
              segments={[
                { key: 'collected', label: 'Collected', value: summary.collected },
                { key: 'next', label: 'Next stop', value: summary.next },
                { key: 'pending', label: 'Pending', value: summary.pending },
                { key: 'missed', label: 'Missed', value: summary.missed },
              ]}
            />
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

      <article className="ct-card">
        <div className="ct-card__header">
          <div>
            <h2>Collection by Purok</h2>
            <p>Printable summary for barangay reporting</p>
          </div>
        </div>
        <div className="ct-card__body">
          <div className="ct-table-wrap">
            <table className="ct-table analytics-table">
              <thead>
                <tr>
                  <th>Purok</th>
                  <th className="is-right">Stops</th>
                  <th className="is-right">Bins</th>
                  <th className="is-right">Collected</th>
                  <th className="is-right">Missed</th>
                  <th className="is-right">Pending</th>
                  <th className="is-right">Completion</th>
                  <th className="is-right">Reports</th>
                </tr>
              </thead>
              <tbody>
                {puroks.map((p) => (
                  <tr key={p.purok}>
                    <td>
                      <MapPin size={13} /> <strong>{p.purok}</strong>
                    </td>
                    <td className="is-right">{p.stops}</td>
                    <td className="is-right">{p.bins}</td>
                    <td className="is-right is-green">{p.collected}</td>
                    <td className={`is-right ${p.missed ? 'is-red' : ''}`}>{p.missed}</td>
                    <td className="is-right">{p.pending}</td>
                    <td className="is-right">
                      <strong>{p.percent}%</strong>
                    </td>
                    <td className="is-right">{p.reports}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    <strong>Barangay Total</strong>
                  </td>
                  <td className="is-right">{totals.stops}</td>
                  <td className="is-right">{totals.bins}</td>
                  <td className="is-right is-green">{totals.collected}</td>
                  <td className="is-right">{totals.missed}</td>
                  <td className="is-right">{totals.pending}</td>
                  <td className="is-right">
                    <strong>{summary.percent}%</strong>
                  </td>
                  <td className="is-right">{reports.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="ct-table__foot">
          <span>Reports are matched to a purok by the location the resident entered.</span>
          <span>Truck positions are simulated (demo).</span>
        </div>
      </article>
    </div>
  )
}
