import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bell,
  BellRing,
  CheckCheck,
  CircleCheck,
  Clock,
  ExternalLink,
  Inbox,
  Mail,
  Megaphone,
  Search,
  Send,
  TriangleAlert,
} from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DetailPanel, { DetailSection } from '../components/DetailPanel.jsx'
import NotifyResidentsModal from '../components/NotifyResidentsModal.jsx'
import EmailLogCard from '../components/EmailLogCard.jsx'
import { useEmailLog } from '../components/useEmailLog.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { priorityMeta } from '../../store/selectors.js'
import { formatDateTime } from '../../utils/format.js'
import '../components/AdminPage.css'
import './NotificationsPage.css'

// PDF pages 27-29
export default function NotificationsPage() {
  const { data, dispatch } = useData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = ['outbox', 'email'].includes(params.get('tab')) ? params.get('tab') : 'feed'
  const setTab = (t) => setParams(t === 'feed' ? {} : { tab: t }, { replace: true })
  const emailLog = useEmailLog()
  // Email result per broadcast, from the server's email log.
  const emailFor = (broadcastId) => {
    const rows = emailLog.entries.filter((e) => e.related_type === 'broadcast' && e.related_id === broadcastId)
    if (!rows.length) return { tone: 'gray', label: 'Email: no recipients with email' }
    const count = (st) => rows.filter((e) => e.status === st).length
    if (count('not_configured')) return { tone: 'gray', label: `Email: not sent (not configured) · ${rows.length}` }
    if (count('failed')) return { tone: 'red', label: `Email: ${count('sent')} sent, ${count('failed')} failed` }
    if (count('queued')) return { tone: 'blue', label: `Email: ${count('queued')} queued` }
    return { tone: 'green', label: `Email: ${count('sent')} sent` }
  }

  const feed = data.notifications.filter((n) => n.audience === 'admin')
  const unread = feed.filter((n) => !n.read).length
  const high = feed.filter((n) => n.priority === 'high').length

  const [onlyUnread, setOnlyUnread] = useState(false)
  const [selectedId, setSelectedId] = useState(feed[0]?.id ?? null)
  const [outboxQuery, setOutboxQuery] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)

  const visibleFeed = onlyUnread ? feed.filter((n) => !n.read) : feed
  const selected = feed.find((n) => n.id === selectedId) ?? null
  const oq = outboxQuery.trim().toLowerCase()
  const broadcasts = data.broadcasts.filter(
    (b) => !oq || [b.zone, b.subject, b.message].some((v) => v?.toLowerCase().includes(oq)),
  )

  function open(n) {
    setSelectedId(n.id)
    if (!n.read) dispatch({ type: 'notification/markRead', payload: { id: n.id } })
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Notifications & Alerts"
        badge="Outbox & Feeds"
        subtitle="Operational alerts for the office, and advisories sent to residents"
        actions={
          <>
            <div className="ct-tabs" role="tablist" aria-label="Notification views">
              <button type="button" role="tab" aria-selected={tab === 'feed'} onClick={() => setTab('feed')}>
                <BellRing size={14} /> Dispatch Feed
              </button>
              <button type="button" role="tab" aria-selected={tab === 'outbox'} onClick={() => setTab('outbox')}>
                <Megaphone size={14} /> Resident Outbox <span className="ct-count">{data.broadcasts.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={tab === 'email'} onClick={() => setTab('email')}>
                <Mail size={14} /> Email Log
              </button>
            </div>
            <button type="button" className="ct-btn ct-btn--primary" onClick={() => setComposeOpen(true)}>
              <Send size={16} /> Notify Residents
            </button>
          </>
        }
      />

      <section className="ct-stats" aria-label="Notification summary">
        <StatCard label="Total Notifications" icon={Inbox} value={feed.length}>
          <span>In the dispatch feed</span>
        </StatCard>
        <StatCard label="Unread Alerts" icon={Bell} value={unread} highlight>
          <span>Requiring review</span>
        </StatCard>
        <StatCard label="High Priority" icon={TriangleAlert} value={high} tone="amber">
          <span>Urgent action</span>
        </StatCard>
        <StatCard label="Resident Broadcasts" icon={Megaphone} value={data.broadcasts.length}>
          <span>Sent from this office</span>
        </StatCard>
      </section>

      {tab === 'feed' ? (
        <div className="ct-split">
          <article className="ct-card">
            <div className="ct-card__header">
              <div>
                <h2>Dispatch Feed</h2>
                <p>Showing {visibleFeed.length} of {feed.length} notifications</p>
              </div>
              <div className="notif-feed-actions">
                <div className="ct-tabs" role="tablist" aria-label="Filter">
                  <button type="button" role="tab" aria-selected={!onlyUnread} onClick={() => setOnlyUnread(false)}>
                    All
                  </button>
                  <button type="button" role="tab" aria-selected={onlyUnread} onClick={() => setOnlyUnread(true)}>
                    Unread <span className="ct-count">{unread}</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="ct-btn ct-btn--secondary"
                  disabled={unread === 0}
                  onClick={() => {
                    dispatch({ type: 'notification/markAllRead', payload: { audience: 'admin' } }).then((res) => {
                      if (!res.ok) return
                      toast('All notifications marked as read')
                    })
                  }}
                >
                  <CheckCheck size={15} /> Mark All Read
                </button>
              </div>
            </div>
            <div className="ct-card__body">
              {visibleFeed.length === 0 ? (
                <p className="ct-empty">
                  <CircleCheck size={18} /> {onlyUnread ? 'No unread notifications.' : 'No notifications yet.'}
                </p>
              ) : (
                <ul className="notif-list">
                  {visibleFeed.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`notif-item ${n.read ? '' : 'is-unread'} ${n.id === selectedId ? 'is-selected' : ''} is-${n.priority}`}
                        onClick={() => open(n)}
                      >
                        <span className="notif-item__dot" aria-label={n.read ? 'Read' : 'Unread'} />
                        <span className="notif-item__body">
                          <strong>{n.title}</strong>
                          <StatusBadge tone={priorityMeta[n.priority].tone}>{priorityMeta[n.priority].label}</StatusBadge>
                          <span className="notif-item__text">{n.body}</span>
                          <small>
                            <Clock size={11} /> {formatDateTime(n.time)}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>

          {selected ? (
            <DetailPanel
              icon={Bell}
              title="Notification Detail"
              subtitle={`Logged ${formatDateTime(selected.time)}`}
              badge={<StatusBadge tone={priorityMeta[selected.priority].tone}>{priorityMeta[selected.priority].label}</StatusBadge>}
              onClose={() => setSelectedId(null)}
              footer={
                selected.link || !selected.read ? (
                  <>
                    {selected.link && (
                      <Link to={selected.link.to} className="ct-btn ct-btn--primary is-wide">
                        <ExternalLink size={15} /> {selected.link.label}
                      </Link>
                    )}
                    {!selected.read && (
                      <button
                        type="button"
                        className="ct-btn ct-btn--secondary is-wide"
                        onClick={() => dispatch({ type: 'notification/markRead', payload: { id: selected.id } })}
                      >
                        <CheckCheck size={15} /> Mark as Read
                      </button>
                    )}
                  </>
                ) : null
              }
            >
              <DetailSection title="Summary">
                <p>
                  <strong>{selected.title}</strong>
                </p>
                <p>{selected.body}</p>
                {selected.photo && <img className="notif-photo" src={selected.photo} alt="Photo sent with this alert" />}
              </DetailSection>
              <DetailSection title="Status">
                <p>{selected.read ? 'Read' : 'Unread'}</p>
              </DetailSection>
            </DetailPanel>
          ) : (
            <div className="ct-card ct-empty">Select a notification to see details.</div>
          )}
        </div>
      ) : tab === 'outbox' ? (
        <article className="ct-card">
          <div className="ct-card__header">
            <div>
              <h2>Resident Notification Broadcasts &amp; Outbox</h2>
              <p>Advisories, schedule changes and delay notices sent to residents</p>
            </div>
            <div className="ct-input-group notif-outbox-search">
              <Search size={16} />
              <input type="search" placeholder="Filter by zone or message…" aria-label="Filter broadcasts" value={outboxQuery} onChange={(e) => setOutboxQuery(e.target.value)} />
            </div>
          </div>
          <div className="ct-card__body">
            {broadcasts.length === 0 ? (
              <p className="ct-empty">{data.broadcasts.length === 0 ? 'No broadcasts sent yet.' : 'No broadcasts match your filter.'}</p>
            ) : (
              <div className="ct-table-wrap">
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th>Recipient Zone</th>
                      <th>Message / Subject</th>
                      <th>Channels</th>
                      <th>Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcasts.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.zone}</strong>
                        </td>
                        <td>
                          <strong>{b.subject}</strong>
                          {b.message && <small className="notif-msg">{b.message}</small>}
                        </td>
                        <td>
                          <span className="notif-channels">
                            {b.channels.map((c) =>
                              c === 'App' ? (
                                <StatusBadge key={c} tone="green">In-app: delivered</StatusBadge>
                              ) : (
                                <StatusBadge key={c} tone={emailFor(b.id).tone}>
                                  {emailFor(b.id).label}
                                </StatusBadge>
                              ),
                            )}
                          </span>
                        </td>
                        <td>{formatDateTime(b.sentAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="ct-table__foot">
            <span>Showing {broadcasts.length} broadcast(s)</span>
            <span>In-app messages are delivered in the Resident app. Email status comes from the email log. SMS is not available.</span>
          </div>
        </article>
      ) : (
        <EmailLogCard log={emailLog} />
      )}

      {composeOpen && (
        <NotifyResidentsModal
          onClose={() => setComposeOpen(false)}
          onSend={(broadcast) => {
            dispatch({ type: 'broadcast/add', payload: broadcast }).then((res) => {
              if (!res.ok) return
              toast(`Broadcast sent to ${broadcast.zone}`)
              setComposeOpen(false)
              setTab('outbox')
            })
          }}
        />
      )}
    </div>
  )
}
