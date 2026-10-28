import { useState } from 'react'
import Avatar from '../../components/Avatar.jsx'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, CheckCheck, Clock } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useDriver } from '../../auth/useAccount.js'
import { priorityMeta } from '../../store/selectors.js'
import { formatDateTime } from '../../utils/format.js'
import './DriverPages.css'

// PDF page 48
export default function NotificationsPage() {
  const { data, dispatch } = useData()
  const driver = useDriver()
  const [filter, setFilter] = useState('all')
  const mine = data.notifications.filter((n) => n.audience === 'driver')
  const unread = mine.filter((n) => !n.read)
  const shown = filter === 'unread' ? unread : mine
  const markRead = (n) => !n.read && dispatch({ type: 'notification/markRead', payload: { id: n.id } })

  return (
    <div className="m-page">
      <section className="m-card m-row">
        <Avatar photo={driver.photo} initials={driver.initials} name={driver.name} />
        <div className="m-grow">
          <strong>{driver.name}</strong>
          <p className="m-muted">
            Truck {data.truck.id} · {data.route.shortName}
          </p>
        </div>
        <button
          type="button"
          className="ct-btn ct-btn--soft"
          disabled={unread.length === 0}
          onClick={() => dispatch({ type: 'notification/markAllRead', payload: { audience: 'driver' } })}
        >
          <CheckCheck size={15} /> Mark all as read
        </button>
      </section>

      <div className="m-row m-row--between">
        <h1 className="m-h1">Messages from the Office</h1>
        {unread.length > 0 && <StatusBadge tone="red">{unread.length} new</StatusBadge>}
      </div>

      <div className="m-chips" role="group" aria-label="Filter notifications">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All ({mine.length})
        </button>
        <button type="button" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>
          New ({unread.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="m-card ct-empty">
          <Bell size={22} />
          <p>{filter === 'unread' ? 'No new messages.' : 'No messages yet.'}</p>
        </div>
      ) : (
        shown.map((n) => (
          <article key={n.id} className={`m-card m-notif ${n.read ? '' : 'is-unread'} is-${n.priority}`} onClick={() => markRead(n)}>
            <div className="m-row m-row--between">
              <StatusBadge tone={n.read ? 'gray' : priorityMeta[n.priority].tone}>{n.read ? 'Read' : n.priority === 'high' ? 'Important' : 'New'}</StatusBadge>
              <span className="m-muted">
                <Clock size={11} /> {formatDateTime(n.time)}
              </span>
            </div>
            <strong className="drv-gap" style={{ display: 'block' }}>
              {n.title}
            </strong>
            <p>{n.body}</p>
            {n.link && (
              <Link to={n.link.to} className="ct-btn ct-btn--primary" onClick={() => markRead(n)}>
                {n.link.label} <ArrowRight size={14} />
              </Link>
            )}
          </article>
        ))
      )}
    </div>
  )
}
