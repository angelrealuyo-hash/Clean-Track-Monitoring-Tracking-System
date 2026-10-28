import { Mail, RefreshCw } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import { emailStatusMeta } from './useEmailLog.js'
import { formatDateTime } from '../../utils/format.js'

// Every email the system tried to send, with the provider's answer.
export default function EmailLogCard({ log }) {
  const { loading, error, config, entries, reload } = log
  return (
    <article className="ct-card">
      <div className="ct-card__header">
        <div>
          <h2>
            <Mail size={16} /> Email Delivery Log
          </h2>
          <p>Each email attempt, its status and the email server&apos;s response</p>
        </div>
        <button type="button" className="ct-btn ct-btn--secondary" onClick={reload}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <div className="ct-card__body">
        {config && !config.configured && (
          <div className="ct-alert ct-alert--warning">
            Email is <strong>not configured</strong>. Emails are recorded here but NOT sent. Set SMTP_HOST and MAIL_FROM on the server
            (see .env.example) to send them.
          </div>
        )}
        {config?.configured && <div className="ct-alert">Sending through {config.host} as {config.from}.</div>}
        {loading ? (
          <p className="ct-empty">Loading…</p>
        ) : error ? (
          <p className="ct-empty">{error}</p>
        ) : entries.length === 0 ? (
          <p className="ct-empty">No emails yet. Emails are created for report updates, pickup reminders, truck alerts and broadcasts (if residents allow email).</p>
        ) : (
          <div className="ct-table-wrap">
            <table className="ct-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Server response / error</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDateTime(e.created_at)}</td>
                    <td>{e.recipient}</td>
                    <td>
                      {e.subject}
                      <small>{e.related_type}</small>
                    </td>
                    <td>
                      <StatusBadge tone={emailStatusMeta[e.status].tone}>{emailStatusMeta[e.status].label}</StatusBadge>
                    </td>
                    <td>{e.attempts}</td>
                    <td>
                      <small>{e.last_error || e.provider_response || '—'}</small>
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
