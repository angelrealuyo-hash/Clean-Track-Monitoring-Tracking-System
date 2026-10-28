import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DriverIssueForm from '../components/DriverIssueForm.jsx'
import NotAssignedCard from '../components/NotAssignedCard.jsx'
import { useDriverRoute } from '../components/useDriverRoute.js'
import { useToast } from '../../components/toast/toastContext.js'
import './DriverPages.css'

// Driver "Report a Problem" page (opened from Home, or from a stop with ?stop=ID).
export default function ReportProblemPage() {
  const r = useDriverRoute()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [saving, setSaving] = useState(false)
  const from = params.get('from') === 'route' ? '/driver/route' : '/driver'
  const stopId = r.stops.some((s) => s.stop.id === params.get('stop')) ? params.get('stop') : ''

  if (!r.assigned) {
    return (
      <div className="m-page">
        <NotAssignedCard truckId={r.truck.id} />
      </div>
    )
  }

  return (
    <DriverIssueForm
      stops={r.stops}
      stopId={stopId}
      driverName={r.driver.name}
      saving={saving}
      onCancel={() => navigate(from)}
      onSubmit={(issue) => {
        setSaving(true)
        r.dispatch({ type: 'driver/reportIssue', payload: issue }).then((res) => {
          setSaving(false)
          if (!res.ok) return
          toast(issue.notifyDispatch ? 'Problem sent to the office' : 'Problem saved for the office')
          navigate(from)
        })
      }}
    />
  )
}
