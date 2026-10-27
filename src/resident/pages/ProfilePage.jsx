import { useState } from 'react'
import { Bell, CalendarDays, Mail, MapPin, Pencil, Phone, Siren, Smartphone, Truck, KeyRound } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import ToggleRow from '../../components/ToggleRow.jsx'
import SignOutButton from '../../components/SignOutButton.jsx'
import ChangePasswordModal from '../../components/ChangePasswordModal.jsx'
import EditProfileModal from '../components/EditProfileModal.jsx'
import { useData } from '../../store/dataContext.js'
import { useResident } from '../../auth/useAccount.js'
import { useToast } from '../../components/toast/toastContext.js'
import { barangay } from '../../data/barangay.js'
import './ResidentPages.css'

const prefRows = [
  { key: 'email', icon: Mail, label: 'Email me', hint: 'Report updates, reminders and announcements by email (needs an email address).' },
  { key: 'push', icon: Bell, label: 'Show messages in this app', hint: 'Truck and report messages.' },
  { key: 'scheduleReminders', icon: CalendarDays, label: 'Remind me on pickup days', hint: 'A reminder on the day of pickup.' },
  { key: 'truckNearby', icon: Truck, label: 'Tell me when the truck is near', hint: 'A message when the truck is coming to your area.' },
]

const tel = (n) => `tel:${n.replace(/[^\d+]/g, '')}`

// PDF page 41
export default function ProfilePage() {
  const [pwOpen, setPwOpen] = useState(false)
  const { dispatch } = useData()
  const resident = useResident()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const update = (patch) => dispatch({ type: 'resident/update', payload: { id: resident.id, patch } })
  const activePrefs = Object.values(resident.prefs).filter(Boolean).length

  return (
    <div className="m-page">
      <section className="m-card m-card--accent m-row">
        <span className="ct-avatar res-profile-avatar">{resident.initials}</span>
        <div className="m-grow">
          <strong>{resident.name}</strong>
          <div>
            <StatusBadge tone="green">Resident</StatusBadge>
          </div>
          <p className="m-muted">{resident.email || resident.phone}</p>
        </div>
      </section>

      <section className="m-card">
        <div className="m-row m-row--between">
          <h2 className="m-h2">My Details</h2>
          <span className="ct-tag">Saved</span>
        </div>
        <dl className="m-kv res-gap">
          <dt>
            <MapPin size={13} /> Address
          </dt>
          <dd>{resident.address}</dd>
          <dt>
            <MapPin size={13} /> Area
          </dt>
          <dd>
            {resident.purok}
          </dd>
          <dt>
            <Smartphone size={13} /> Mobile
          </dt>
          <dd>{resident.phone}</dd>
          <dt>
            <Mail size={13} /> Email
          </dt>
          <dd>{resident.email || '—'}</dd>
        </dl>
        <button type="button" className="ct-btn ct-btn--soft ct-btn--block res-gap" onClick={() => setEditing(true)}>
          <Pencil size={15} /> Edit My Details
        </button>
      </section>

      <section className="m-card">
        <div className="m-row m-row--between">
          <h2 className="m-h2">Alerts</h2>
          <span className="ct-tag">{activePrefs} active</span>
        </div>
        {prefRows.map((r) => (
          <ToggleRow
            key={r.key}
            icon={r.icon}
            label={r.label}
            hint={r.hint}
            checked={resident.prefs[r.key]}
            onChange={(v) => update({ prefs: { ...resident.prefs, [r.key]: v } })}
          />
        ))}
        <p className="m-muted">Demo app: messages show in this app only. No email or text message is sent.</p>
      </section>

      <section className="m-card" id="hotlines">
        <div className="m-row m-row--between">
          <h2 className="m-h2">Need Help?</h2>
          <span className="ct-tag">Tap to call</span>
        </div>
        <a className="m-box m-row res-gap" href={tel(barangay.hotline)}>
          <Phone size={16} />
          <span className="m-grow">
            <small>Barangay garbage office</small>
            <strong>{barangay.hotline}</strong>
          </span>
        </a>
        <a className="m-box m-row res-gap" href="tel:911">
          <Siren size={16} color="var(--ct-red-600)" />
          <span className="m-grow">
            <small>Emergency</small>
            <strong>911 / Barangay Tanod: {barangay.tanodHotline}</strong>
          </span>
        </a>
      </section>

      <button type="button" className="ct-btn ct-btn--secondary ct-btn--block" onClick={() => setPwOpen(true)}>
        <KeyRound size={15} /> Change Password
      </button>
      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
      <SignOutButton role="resident" label="Sign Out" />
      <p className="m-muted" style={{ textAlign: 'center' }}>
        CleanTrack Resident · demo app
      </p>

      {editing && (
        <EditProfileModal
          resident={resident}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            // Keep the dialog open if the server refuses (e.g. number already used).
            const res = await update(patch)
            if (!res.ok) return
            toast('Saved')
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}
