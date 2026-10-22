import { useState } from 'react'
import { Bell, Building2, Clock, Database, History, Hash, RotateCcw, Save, SlidersHorizontal, Truck } from 'lucide-react'
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
  { key: 'notifyDelays', label: 'Truck Delay Alerts', hint: 'Alert the office when the truck is late on its route.' },
  { key: 'notifyMissedReports', label: 'Missed Collection Alerts', hint: 'Alert the office when a resident reports a missed pickup.' },
  { key: 'notifyOverflow', label: 'Overflowing Bin Warnings', hint: 'Alert when residents report an overflowing communal bin.' },
  { key: 'dailyDigest', label: 'Daily Summary Email', hint: 'Send a daily collection summary to the supervisor.' },
  { key: 'alertSound', label: 'Alert Sound', hint: 'Play a chime for high-priority alerts.' },
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

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings)
  const set = (key, cast = (v) => v) => (e) =>
    setDraft((d) => ({ ...d, [key]: cast(e.target.type === 'checkbox' ? e.target.checked : e.target.value) }))

  function save() {
    const errs = {}
    if (draft.barangayName.trim().length < 3) errs.barangayName = 'Barangay name is required.'
    if (!draft.lguCode.trim()) errs.lguCode = 'LGU / district code is required.'
    if (!draft.operatingStart || !draft.operatingEnd || draft.operatingEnd <= draft.operatingStart) {
      errs.operatingEnd = 'End time must be after start time.'
    }
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast('Please fix the highlighted fields', 'error')
      return
    }
    const clean = { ...draft, barangayName: draft.barangayName.trim(), lguCode: draft.lguCode.trim() }
    dispatch({ type: 'settings/update', payload: clean })
    setDraft(clean)
    toast('Settings saved')
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

      <Section icon={Building2} title="1. General Settings" subtitle="Barangay identification and operating hours" tag="Primary">
        <div className="ct-form-grid">
          <Field label="Barangay Name" htmlFor="st-name" required error={errors.barangayName} hint="Shown in the Admin header.">
            <div className="ct-input-group">
              <Building2 size={16} />
              <input id="st-name" value={draft.barangayName} onChange={set('barangayName')} aria-invalid={!!errors.barangayName} />
            </div>
          </Field>
          <Field label="Municipal LGU / District Code" htmlFor="st-lgu" required error={errors.lguCode}>
            <div className="ct-input-group">
              <Hash size={16} />
              <input id="st-lgu" value={draft.lguCode} onChange={set('lguCode')} aria-invalid={!!errors.lguCode} />
            </div>
          </Field>
          <Field label="Timezone" htmlFor="st-tz">
            <select id="st-tz" className="ct-input" value={draft.timezone} onChange={set('timezone')}>
              <option value="Asia/Manila">Philippine Standard Time (UTC+8)</option>
            </select>
          </Field>
          <div className="ct-form-grid settings-hours">
            <Field label="Operations Start" htmlFor="st-start">
              <div className="ct-input-group">
                <Clock size={16} />
                <input id="st-start" type="time" value={draft.operatingStart} onChange={set('operatingStart')} />
              </div>
            </Field>
            <Field label="Operations End" htmlFor="st-end" error={errors.operatingEnd}>
              <div className="ct-input-group">
                <Clock size={16} />
                <input id="st-end" type="time" value={draft.operatingEnd} onChange={set('operatingEnd')} aria-invalid={!!errors.operatingEnd} />
              </div>
            </Field>
          </div>
        </div>
      </Section>

      <Section icon={Truck} title="2. Collection Preferences" subtitle="Daily targets and how late is “missed”" tag="Rules">
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
          <div className="settings-box">
            <Field label="Missed Stop Grace Period" htmlFor="st-grace" hint="How long after the planned time a stop counts as late.">
              <select id="st-grace" className="ct-input" value={draft.missedGraceMinutes} onChange={set('missedGraceMinutes', Number)}>
                {[10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes after scheduled window
                  </option>
                ))}
              </select>
            </Field>
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

      <Section icon={Bell} title="4. Notification Preferences" subtitle="Saved for when real alerts are connected. This demo does not send emails, SMS or sounds." tag="Preferences">
        <ul className="settings-toggles">
          {notificationToggles.map((t) => (
            <li key={t.key} className="settings-toggle">
              <div>
                <strong id={`lbl-${t.key}`}>{t.label}</strong>
                <p>{t.hint}</p>
              </div>
              <label className="ct-switch">
                <input type="checkbox" role="switch" aria-labelledby={`lbl-${t.key}`} checked={draft[t.key]} onChange={set(t.key)} />
                <span />
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Database} title="5. Demo Data" subtitle="Changes are saved in this browser only (no server)">
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
          <p>This removes every change made in this browser: edited truck and drivers, report responses, broadcasts, collection results and settings.</p>
        </ConfirmModal>
      )}
    </div>
  )
}
