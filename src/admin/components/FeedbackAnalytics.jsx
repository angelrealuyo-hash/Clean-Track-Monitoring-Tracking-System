import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, CircleCheck, ClipboardCheck, Download, MessageSquareText, Truck, Users } from 'lucide-react'
import StatCard from './StatCard.jsx'
import BarList from './charts/BarList.jsx'
import StatusBar from './charts/StatusBar.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { summarizeFeedback, summarizeRun, summarizeRunsInRange } from '../../store/selectors.js'
import { feedbackReasonLabel, feedbackReasons } from '../../data/collectionFeedback.js'
import { downloadCsv } from '../../utils/csv.js'
import { daysAgoISO, formatDate, formatDateTime, todayISO } from '../../utils/format.js'
import { useToast } from '../../components/toast/toastContext.js'

const presets = [
  { id: 'today', label: 'Today', from: () => todayISO() },
  { id: '7', label: 'Last 7 days', from: () => daysAgoISO(6) },
  { id: '30', label: 'Last 30 days', from: () => daysAgoISO(29) },
  { id: 'all', label: 'All time', from: () => '' },
]

const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : '—')
const pctText = (p) => (p === null ? '—' : `${p}%`)

// Resident pickup feedback vs. driver-confirmed pickups, for a chosen period.
// Resident answers are what residents SAID; only the driver's (or office's)
// stop records count as confirmed collection.
export default function FeedbackAnalytics({ feedback, runs, residentCount }) {
  const toast = useToast()
  const [preset, setPreset] = useState('7')
  const [range, setRange] = useState(() => ({ from: daysAgoISO(6), to: todayISO() }))

  function choosePreset(id) {
    setPreset(id)
    const p = presets.find((x) => x.id === id)
    if (p) setRange({ from: p.from(), to: id === 'all' ? '' : todayISO() })
  }
  const setDate = (key) => (e) => {
    setPreset('custom')
    setRange((r) => ({ ...r, [key]: e.target.value }))
  }

  const badRange = range.from && range.to && range.from > range.to
  const s = summarizeFeedback(feedback, badRange ? { from: '9999', to: '0000' } : range)
  const driver = summarizeRunsInRange(runs, badRange ? { from: '9999', to: '0000' } : range)
  const periodLabel =
    preset === 'all' ? 'All time' : range.from === range.to ? formatDate(range.from) : `${range.from ? formatDate(range.from) : 'Start'} – ${range.to ? formatDate(range.to) : 'today'}`

  // One row per date: what residents said next to what the driver recorded.
  const inRange = (d) => !badRange && (!range.from || d >= range.from) && (!range.to || d <= range.to)
  const dates = [...new Set([...s.rows.map((f) => f.date), ...runs.filter((r) => inRange(r.date)).map((r) => r.date)])].sort().reverse()
  const byDate = dates.map((date) => {
    const day = summarizeFeedback(s.rows, { from: date, to: date })
    const dayRuns = runs.filter((r) => r.date === date).map(summarizeRun)
    return {
      date,
      ...day,
      stopsCollected: dayRuns.reduce((n, x) => n + x.collected, 0),
      stopsTotal: dayRuns.reduce((n, x) => n + x.total, 0),
    }
  })

  const reasonItems = feedbackReasons
    .map((r) => ({ label: r.label, value: s.reasons[r.id] ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
  const unable = s.rows.filter((f) => f.disposed === false).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  function exportCsv() {
    downloadCsv(
      `cleantrack-resident-feedback-${range.from || 'start'}-to-${range.to || todayISO()}.csv`,
      ['Date', 'Resident ID', 'Resident', 'Purok', 'Will dispose', 'Truck passed', 'Able to dispose', 'Reason', 'Details', 'Report', 'Last answered'],
      s.rows.map((f) => [
        f.date,
        f.residentId,
        f.residentName,
        f.purok,
        yesNo(f.willDispose),
        yesNo(f.truckPassed),
        yesNo(f.disposed),
        f.reason ? feedbackReasonLabel(f.reason) : '',
        f.reasonText,
        f.reportId ?? '',
        new Date(f.updatedAt).toLocaleString('en-PH'),
      ]),
    )
    toast('Resident feedback exported')
  }

  return (
    <section className="feedback-analytics" aria-labelledby="fa-title">
      <div className="fa-head">
        <div>
          <h2 id="fa-title">
            <MessageSquareText size={18} /> Resident Collection Participation
          </h2>
          <p>
            Answers from the Resident app (“Will you dispose of your garbage today?”). One answer per resident per day; the latest answer is
            kept.
          </p>
        </div>
        <div className="fa-filters" role="group" aria-label="Reporting period">
          <CalendarRange size={16} aria-hidden="true" />
          <select className="ct-input" aria-label="Period" value={preset} onChange={(e) => choosePreset(e.target.value)}>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom dates</option>
          </select>
          <input className="ct-input" type="date" aria-label="From date" value={range.from} max={range.to || undefined} onChange={setDate('from')} />
          <span aria-hidden="true">to</span>
          <input className="ct-input" type="date" aria-label="To date" value={range.to} min={range.from || undefined} onChange={setDate('to')} />
          <button type="button" className="ct-btn ct-btn--secondary" onClick={exportCsv} disabled={s.responses === 0}>
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      {badRange && (
        <div className="ct-alert ct-alert--warning" role="alert">
          The “from” date is after the “to” date.
        </div>
      )}

      <div className="ct-alert">
        <ClipboardCheck size={16} />
        <span>
          <StatusBadge tone="blue">Resident-reported</StatusBadge> figures are what residents answered and are not proof of pickup.{' '}
          <StatusBadge tone="green">Driver-confirmed</StatusBadge> figures come from stops the driver (or office) marked as collected.
        </span>
      </div>

      <section className="ct-stats" aria-label={`Participation, ${periodLabel}`}>
        <StatCard label="Residents Who Answered" icon={Users} value={s.residents} unit={`of ${residentCount}`} tone="blue">
          <span>
            {s.responses} answer{s.responses === 1 ? '' : 's'} on {s.days} day{s.days === 1 ? '' : 's'} · {periodLabel}
          </span>
        </StatCard>
        <StatCard label="Planned to Dispose" icon={MessageSquareText} value={pctText(s.percent.willYes)} tone="blue">
          <span>
            <b>{s.willYes}</b> yes · {s.willNo} no <em className="fa-src">resident-reported</em>
          </span>
        </StatCard>
        <StatCard label="Able to Dispose" icon={CircleCheck} value={pctText(s.percent.disposedYes)} tone="blue">
          <span>
            <b>{s.disposedYes}</b> yes · {s.disposedNo} no <em className="fa-src">resident-reported</em>
          </span>
        </StatCard>
        <StatCard label="Stops Collected" icon={Truck} value={pctText(driver.percent)} highlight>
          <span>
            <b>{driver.collected}</b> of {driver.stops} stops · {driver.runs} run{driver.runs === 1 ? '' : 's'} <em className="fa-src">driver-confirmed</em>
          </span>
        </StatCard>
      </section>

      <div className="analytics-row">
        <article className="ct-card">
          <div className="ct-card__header">
            <div>
              <h2>Resident Answers</h2>
              <p>Resident-reported · {periodLabel}</p>
            </div>
          </div>
          <div className="ct-card__body fa-bars">
            <div>
              <h3>Will you dispose of your garbage today?</h3>
              <StatusBar
                label="Planned to dispose"
                total={s.responses}
                segments={[
                  { key: 'collected', label: 'Yes', value: s.willYes },
                  { key: 'missed', label: 'No', value: s.willNo },
                ]}
              />
            </div>
            <div>
              <h3>Did the truck pass your location?</h3>
              <StatusBar
                label="Truck passed"
                total={s.willYes}
                segments={[
                  { key: 'collected', label: 'Yes', value: s.passedYes },
                  { key: 'missed', label: 'No', value: s.passedNo },
                  { key: 'pending', label: 'Not answered', value: s.passedUnanswered },
                ]}
              />
            </div>
            <div>
              <h3>Were you able to dispose of your garbage?</h3>
              <StatusBar
                label="Able to dispose"
                total={s.willYes}
                segments={[
                  { key: 'collected', label: 'Yes', value: s.disposedYes },
                  { key: 'missed', label: 'No', value: s.disposedNo },
                  { key: 'pending', label: 'Not answered', value: s.disposedUnanswered },
                ]}
              />
            </div>
          </div>
        </article>

        <article className="ct-card">
          <div className="ct-card__header">
            <div>
              <h2>Why Residents Could Not Dispose</h2>
              <p>
                {s.disposedNo} resident answer{s.disposedNo === 1 ? '' : 's'} · {periodLabel}
              </p>
            </div>
          </div>
          <div className="ct-card__body">
            {reasonItems.length ? (
              <BarList items={reasonItems} unit="answers" label="Reasons for not disposing" />
            ) : (
              <p className="ct-empty">No resident reported being unable to dispose in this period.</p>
            )}
          </div>
        </article>
      </div>

      <article className="ct-card analytics-gap">
        <div className="ct-card__header">
          <div>
            <h2>By Date: Residents vs. Driver</h2>
            <p>Each day&apos;s resident answers next to the stops the driver confirmed</p>
          </div>
        </div>
        <div className="ct-card__body">
          {byDate.length === 0 ? (
            <p className="ct-empty">No answers or collection runs in this period.</p>
          ) : (
            <div className="ct-table-wrap">
              <table className="ct-table analytics-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="is-right">Answers</th>
                    <th className="is-right">Will dispose (yes / no)</th>
                    <th className="is-right">Truck passed (yes / no)</th>
                    <th className="is-right">Disposed (yes / no)</th>
                    <th className="is-right">Driver-confirmed stops</th>
                  </tr>
                </thead>
                <tbody>
                  {byDate.map((d) => (
                    <tr key={d.date}>
                      <td>
                        <strong>{formatDate(d.date)}</strong>
                      </td>
                      <td className="is-right">{d.responses}</td>
                      <td className="is-right">
                        <span className="is-green">{d.willYes}</span> / <span className={d.willNo ? 'is-red' : ''}>{d.willNo}</span>
                      </td>
                      <td className="is-right">
                        <span className="is-green">{d.passedYes}</span> / <span className={d.passedNo ? 'is-red' : ''}>{d.passedNo}</span>
                      </td>
                      <td className="is-right">
                        <span className="is-green">{d.disposedYes}</span> / <span className={d.disposedNo ? 'is-red' : ''}>{d.disposedNo}</span>
                      </td>
                      <td className="is-right">{d.stopsTotal ? `${d.stopsCollected} of ${d.stopsTotal}` : 'No run'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </article>

      <article className="ct-card analytics-gap">
        <div className="ct-card__header">
          <div>
            <h2>Resident Feedback Needing Attention</h2>
            <p>Residents who said they could not dispose of their garbage, newest first</p>
          </div>
        </div>
        <div className="ct-card__body">
          {unable.length === 0 ? (
            <p className="ct-empty">No feedback in this period.</p>
          ) : (
            <div className="ct-table-wrap">
              <table className="ct-table analytics-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Resident</th>
                    <th>Truck passed?</th>
                    <th>Reason</th>
                    <th>Report</th>
                  </tr>
                </thead>
                <tbody>
                  {unable.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{formatDate(f.date)}</strong>
                        <small>{formatDateTime(f.updatedAt)}</small>
                      </td>
                      <td>
                        {f.residentName}
                        <small>
                          {f.purok} · <span className="ct-mono">{f.residentId}</span>
                        </small>
                      </td>
                      <td>{yesNo(f.truckPassed)}</td>
                      <td>
                        {feedbackReasonLabel(f.reason)}
                        {f.reasonText && <small>“{f.reasonText}”</small>}
                      </td>
                      <td>
                        {f.reportId ? (
                          <Link to={`/admin/resident-reports?id=${f.reportId}`} className="ct-mono">
                            #{f.reportId}
                          </Link>
                        ) : (
                          <small>No follow-up needed</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </article>
    </section>
  )
}
