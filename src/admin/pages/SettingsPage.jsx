import { useState } from 'react'
import { Bell, Building2, Phone, Database, History, KeyRound, RotateCcw, Save, SlidersHorizontal, Truck, UserCog } from 'lucide-react'
import ChangePasswordModal from '../../components/ChangePasswordModal.jsx'
import AvatarPicker from '../../components/AvatarPicker.jsx'
import { useAuth } from '../../auth/authContext.js'
import PageHeader from '../components/PageHeader.jsx'
import Field from '../../components/Field.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { formatDateTime } from '../../utils/format.js'
import { defaultSettings } from '../../store/initialData.js'
import '../components/AdminPage.css'
import './SettingsPage.css'

const notificationToggles = [
  {
    key: 'autoProximityAlerts',
    label: 'Truck Coming Alerts (in-app)',
    hint: 'When the demo truck heads to a purok, residents there get a message in the Resident app.',
  },
  {
    key: 'autoPickupCheck',
    label: 'Today’s Pick Up Check (in-app)',
    hint: 'About an hour before pickup, residents are asked “Are you planning to dispose of your garbage today?”. Their answers feed Reports & Analytics.',
  },
  {
    key: 'autoScheduleReminders',
    label: 'Pickup Day Reminders (in-app)',
    hint: 'On pickup days, residents get a “put your garbage bags out” message in the Resident app.',
  },
]

function Section({ icon: Icon, title, subtitle, tag, children }) {
  return (
    <section className="ct-card settings-section">
      <header className="settings-section__head">
        <span className="stat-card__icon stat-card__icon--green">
          <Icon size={18} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {tag && <span className="ct-tag">{tag}</span>}
      </header>
      <div className="settings-section__body">{children}</div>
    </section>
  )
}

// PDF pages 32-33
export default function SettingsPage() {
  const { data, dispatch, reset } = useData()
  const toast = useToast()
  const [draft, setDraft] = useState(data.settings)
  const [errors, setErrors] = useState({})
  const [confirmReset, setConfirmReset] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)

  // The profile picture saves right away (separate from Save Changes below).
  function setPhoto(photo) {
    setPhotoSaving(true)
    dispatch({ type: 'admin/setPhoto', payload: { photo } }).then((res) => {
      setPhotoSaving(false)
      if (res.ok) toast(photo ? 'Profile picture saved' : 'Profile picture removed')
    })
  }
  const { sessions } = useAuth()

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings)
  const set = (key, cast = (v) => v) => (e) =>
    setDraft((d) => ({ ...d, [key]: cast(e.target.type === 'checkbox' ? e.target.checked : e.target.value) }))

  function save() {
    const errs = {}
    const name = draft.barangayName.trim()
    if (name && name.length < 3) errs.barangayName = 'Use at least 3 characters, or leave it empty.'
    const phone = (draft.officePhone ?? '').trim()
    if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) errs.officePhone = 'Use digits, spaces, ( ) - and + only, e.g. (02) 8123 4567.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast('Please fix the highlighted fields', 'error')
      return
    }
    const clean = { ...draft, barangayName: draft.barangayName.trim(), officePhone: phone }
    dispatch({ type: 'settings/update', payload: clean }).then((res) => {
      if (!res.ok) return
      setDraft(clean)
      toast('Settings saved')
    })
  }

  function cancel() {
    setDraft(data.settings)
    setErrors({})
  }

  const actions = (
    <>
      <button type="button" className="ct-btn ct-btn--secondary" onClick={cancel} disabled={!dirty}>
        Cancel
      </button>
      <button type="button" className="ct-btn ct-btn--primary" onClick={save} disabled={!dirty}>
        <Save size={16} /> Save Changes
      </button>
    </>
  )

  return (
    <div className="admin-page settings-page">
      <PageHeader
        eyebrow={<>Administration / <b>System Settings</b></>}
        title="System Settings"
        subtitle="Barangay details, collection rules, and notification preferences"
        actions={actions}
      />

      {dirty && (
        <div className="ct-alert ct-alert--warning" role="status">
          You have unsaved changes.
        </div>
      )}

      <section className="ct-card settings-section">
        <header className="settings-section__head">
          <span className="stat-card__icon stat-card__icon--green">
            <UserCog size={18} />
          </span>
          <div>
            <h2>My Account</h2>
            <p>Your personal sign-in (separate from the system settings below)</p>
          </div>
        </header>
        <div className="settings-section__body settings-account">
          <div className="settings-account__photo">
            <span className="ct-label">Profile Picture</span>
            <AvatarPicker value={data.adminPhoto ?? null} onChange={setPhoto} initials={sessions.admin?.initials ?? 'A'} name={sessions.admin?.name} busy={photoSaving} size={56} />
          </div>
          <dl className="settings-account__info">
            <div>
              <dt>Name</dt>
              <dd>{sessions.admin?.name}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>{sessions.admin?.title}</dd>
            </div>
            <div>
              <dt>Sign-in email</dt>
              <dd>admin@cleantrack.gov</dd>
            </div>
          </dl>
          <button type="button" className="ct-btn ct-btn--secondary settings-account__btn" onClick={() => setPwOpen(true)}>
            <KeyRound size={15} /> Change Password
          </button>
        </div>
      </section>

      <h2 className="settings-group-title">System Settings</h2>

      <Section icon={Building2} title="1. General" subtitle="The barangay this system serves" tag="Primary">
        <Field label="Barangay Name (optional)" htmlFor="st-name" error={errors.barangayName} hint="Leave empty to show no barangay name in the apps.">
          <div className="ct-input-group">
            <Building2 size={16} />
            <input id="st-name" value={draft.barangayName} onChange={set('barangayName')} aria-invalid={!!errors.barangayName} />
          </div>
        </Field>
        <Field
          label="Office Phone for Drivers (optional)"
          htmlFor="st-phone"
          error={errors.officePhone}
          hint="Used by the “Call the Office” button in the Driver app. Leave empty until you have the official number."
        >
          <div className="ct-input-group">
            <Phone size={16} />
            <input
              id="st-phone"
              type="tel"
              inputMode="tel"
              placeholder="Not set"
              value={draft.officePhone ?? ''}
              onChange={set('officePhone')}
              aria-invalid={!!errors.officePhone}
            />
          </div>
        </Field>
      </Section>

      <Section icon={Truck} title="2. Collection Target" subtitle="Used on the Dashboard and in Reports & Analytics" tag="Rules">
        <div className="ct-form-grid">
          <div className="settings-box">
            <div className="settings-box__row">
              <label className="ct-label" htmlFor="st-target">
                Daily Completion Target
              </label>
              <strong className="settings-value">{draft.completionTarget}%</strong>
            </div>
            <p className="ct-field__hint">Share of stops that should be collected each day. Used on the Dashboard and Reports.</p>
            <input
              id="st-target"
              className="settings-range"
              type="range"
              min="70"
              max="100"
              step="1"
              value={draft.completionTarget}
              onChange={set('completionTarget', Number)}
            />
            <div className="settings-range__labels">
              <span>70% (relaxed)</span>
              <span>100% (strict)</span>
            </div>
          </div>
        </div>
      </Section>

      <Section icon={SlidersHorizontal} title="3. Tracking Simulation" subtitle="Controls the demo truck on the Live Tracking map" tag="Demo">
        <div className="settings-toggle">
          <div>
            <strong>Simulated GPS update interval</strong>
            <p>How often the demo truck moves. Saving a new value restarts the simulation.</p>
          </div>
          <select className="ct-input settings-select" aria-label="Simulated GPS update interval" value={draft.simulationIntervalMs} onChange={set('simulationIntervalMs', Number)}>
            <option value={1000}>Every 1 second</option>
            <option value={2000}>Every 2 seconds</option>
            <option value={5000}>Every 5 seconds</option>
          </select>
        </div>
        <p className="ct-field__hint">
          <StatusBadge tone="amber">Simulated</StatusBadge> CleanTrack has no GPS hardware; truck positions are always simulated.
        </p>
      </Section>

      <Section icon={Bell} title="4. Automatic Resident Messages" subtitle="In-app messages only. No email or SMS provider is set up, so nothing is sent outside CleanTrack." tag="In-app">
        <ul className="settings-toggles">
          {notificationToggles.map((t) => (
            <li key={t.key} className="settings-toggle">
              <div>
                <strong id={`lbl-${t.key}`}>{t.label}</strong>
                <p>{t.hint}</p>
              </div>
              <label className="ct-switch">
                <input type="checkbox" role="switch" aria-labelledby={`lbl-${t.key}`} checked={Boolean(draft[t.key] ?? defaultSettings[t.key])} onChange={set(t.key)} />
                <span />
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Database} title="5. Demo Data" subtitle="Restore the starting demo data on the server (for demonstrations)">
        <div className="settings-toggle">
          <div>
            <strong>Reset all demo data</strong>
            <p>Restores the original truck, drivers, route, reports, notifications and settings.</p>
          </div>
          <button type="button" className="ct-btn ct-btn--danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={15} /> Reset Demo Data
          </button>
        </div>
      </Section>

      <footer className="settings-footer">
        <span>
          <History size={14} /> {data.savedAt ? `Last saved: ${formatDateTime(data.savedAt)}` : 'Using default settings'}
        </span>
        <div className="admin-page__actions">{actions}</div>
      </footer>

      {confirmReset && (
        <ConfirmModal
          title="Reset Demo Data"
          confirmLabel="Reset Everything"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            reset()
            setDraft({ ...defaultSettings })
            setErrors({})
            toast('Demo data reset')
          }}
        >
          <p>This replaces ALL data in the CleanTrack database with the starting demo data: truck, drivers, route, schedule, reports, notifications, collection runs, settings and resident accounts. Only use it for demonstrations.</p>
        </ConfirmModal>
      )}
      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
    </div>
  )
}
