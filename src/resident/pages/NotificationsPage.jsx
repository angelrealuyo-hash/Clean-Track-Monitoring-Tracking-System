import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bell, CheckCheck, ClipboardCheck, Clock, Megaphone, MessageSquareText, Truck } from 'lucide-react'
import { usePickupCheck } from '../components/usePickupCheck.js'
import { notTodayMessages, pickMessage } from '../../data/residentMessages.js'
import { useToast } from '../../components/toast/toastContext.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useResident } from '../../auth/useAccount.js'
import { useTracking } from '../../tracking/trackingContext.js'
import { notificationsForResident } from '../../store/selectors.js'
import { STATUS_LABELS, STATUS_TONES } from '../../services/trackingSimulation.js'
import { formatDateTime } from '../../utils/format.js'
import './ResidentPages.css'

const kindOf = (n) => (n.residentId ? 'report' : 'advisory')
const icons = { report: ClipboardCheck, advisory: Megaphone }
const isCheck = (n) => n.kind === 'pickup-check'

// YES / NO for today's Pick Up Check, right inside the message.
function PickupCheckAnswer({ n, resident }) {
  const { saved, send, saving, today } = usePickupCheck(resident)
  const navigate = useNavigate()
  const toast = useToast()
  const forToday = n.key === `pickup-check-${today}`
  if (!forToday) return <p className="m-muted res-check-answer">This check has closed.</p>
  const complete = Boolean(saved && (!saved.willDispose || saved.disposed !== null))
  if (saved && !complete) {
    return (
      <p className="res-check-answer">
        <Link to="/resident#pickup-check" className="ct-btn ct-btn--primary res-notif-btn">
          Finish answering <ArrowRight size={14} />
        </Link>
      </p>
    )
  }
  if (saved) {
    return (
      <p className="res-check-answer">
        <strong>Answered ✓</strong>{' '}
        <Link to="/resident#pickup-check" className="res-inline-link">
          See or change my answers
        </Link>
      </p>
    )
  }
  return (
    <div className="res-yesno res-check-answer" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="ct-btn ct-btn--primary"
        disabled={saving}
        onClick={() => send({ willDispose: true }).then((res) => res.ok && navigate('/resident#pickup-check'))}
      >
        YES
      </button>
      <button
        type="button"
        className="ct-btn ct-btn--secondary"
        disabled={saving}
        onClick={() => send({ willDispose: false }).then((res) => res.ok && toast(pickMessage(notTodayMessages, 'not-today')))}
      >
        NO
      </button>
    </div>
  )
}

// PDF page 43
export default function NotificationsPage() {
  const { data, dispatch } = useData()
  const resident = useResident()
  const { state } = useTracking()
  const [filter, setFilter] = useState('all')

  const mine = notificationsForResident(data.notifications, resident)
  const unread = mine.filter((n) => !n.read)
  const shown = mine.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read : kindOf(n) === filter))

  const markRead = (n) => !n.read && dispatch({ type: 'notification/markRead', payload: { id: n.id } })

  return (
    <div className="m-page">
      <div className="m-row m-row--between">
        <div>
          <h1 className="m-h1">Messages</h1>
          <p className="m-muted">News from {data.settings.barangayName || 'the barangay'}</p>
        </div>
        <button
          type="button"
          className="ct-btn ct-btn--soft"
          disabled={unread.length === 0}
          onClick={() => dispatch({ type: 'notification/markAllRead', payload: { ids: unread.map((n) => n.id) } })}
        >
          <CheckCheck size={15} /> Mark All Read
        </button>
      </div>

      <section className="m-card m-row">
        <span className="m-icon">
          <Truck size={16} />
        </span>
        <div className="m-grow">
          <p className="m-eyebrow">Truck right now (demo)</p>
          <strong>
            {data.truck.id} · {data.route.shortName}
          </strong>
        </div>
        <StatusBadge tone={STATUS_TONES[state.status]}>{STATUS_LABELS[state.status]}</StatusBadge>
      </section>

      <div className="m-chips" role="group" aria-label="Filter notifications">
        {[
          ['all', `All (${mine.length})`],
          ['unread', `Unread (${unread.length})`],
          ['report', 'My reports'],
          ['advisory', 'Announcements'],
        ].map(([key, text]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {text}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="m-card ct-empty">
          <Bell size={22} />
          <p>{filter === 'unread' ? 'No new messages.' : 'No messages yet.'}</p>
        </div>
      ) : (
        shown.map((n) => {
          const Icon = isCheck(n) ? MessageSquareText : icons[kindOf(n)]
          return (
            <article
              key={n.id}
              className={`m-card m-notif ${n.read ? '' : 'is-unread'} is-${n.priority}`}
              onClick={() => markRead(n)}
            >
              <div className="m-row m-row--top">
                <span className={`m-icon ${kindOf(n) === 'report' ? 'm-icon--blue' : ''}`}>
                  <Icon size={16} />
                </span>
                <div className="m-grow">
                  <div className="m-row m-row--between">
                    <span className="ct-tag">
                      {n.read ? 'Read' : 'New'} · {kindOf(n) === 'report' ? 'About your report' : n.zone === 'All Puroks' ? 'For everyone' : n.zone ?? 'Announcement'}
                    </span>
                    <span className="m-muted">
                      <Clock size={11} /> {formatDateTime(n.time)}
                    </span>
                  </div>
                  <strong className="res-gap" style={{ display: 'block' }}>
                    {n.title}
                  </strong>
                  <p>{n.body}</p>
                  {isCheck(n) && <PickupCheckAnswer n={n} resident={resident} />}
                  <div className="m-row m-row--between">
                    {!n.read ? (
                      <button type="button" className="ct-link-btn" onClick={() => markRead(n)}>
                        Mark as read
                      </button>
                    ) : (
                      <span />
                    )}
                    {n.link && !isCheck(n) && (
                      <Link to={n.link.to} className="ct-btn ct-btn--primary res-notif-btn" onClick={() => markRead(n)}>
                        {n.link.label} <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </article>
          )
        })
      )}
    </div>
  )
}
