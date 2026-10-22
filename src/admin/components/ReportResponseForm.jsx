import { useState } from 'react'
import { CircleCheck, Save, Wrench } from 'lucide-react'
import Field from '../../components/Field.jsx'
import { reportStatusMeta } from '../../store/selectors.js'

// Barangay response + status for one report. Rendered with key={report.id}
// so switching reports resets the form.
export default function ReportResponseForm({ report, onSave }) {
  const [response, setResponse] = useState(report.adminResponse ?? '')
  const [error, setError] = useState('')
  const dirty = response.trim() !== (report.adminResponse ?? '')

  function save(status) {
    const text = response.trim()
    if (status === 'resolved' && !text) {
      setError('Write a short response so the resident knows how it was resolved.')
      return
    }
    setError('')
    onSave({ status, adminResponse: text || null, statusLabel: reportStatusMeta[status].label })
  }

  return (
    <div className="report-form">
      <Field label="Barangay Response" htmlFor="rep-response" error={error} hint="The resident sees this in their app.">
        <textarea
          id="rep-response"
          className="ct-input"
          maxLength={400}
          placeholder="e.g. Driver will return to collect the bin by 11:30 AM."
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          aria-invalid={!!error}
        />
      </Field>
      <div className="report-form__actions">
        <button type="button" className="ct-btn ct-btn--secondary" disabled={!dirty} onClick={() => save(report.status)}>
          <Save size={15} /> Save Response
        </button>
        {report.status === 'submitted' && (
          <button type="button" className="ct-btn ct-btn--soft" onClick={() => save('in-progress')}>
            <Wrench size={15} /> Mark In Progress
          </button>
        )}
        {report.status !== 'resolved' ? (
          <button type="button" className="ct-btn ct-btn--primary" onClick={() => save('resolved')}>
            <CircleCheck size={15} /> Mark Resolved
          </button>
        ) : (
          <button type="button" className="ct-btn ct-btn--soft" onClick={() => save('in-progress')}>
            Reopen Report
          </button>
        )}
      </div>
    </div>
  )
}
