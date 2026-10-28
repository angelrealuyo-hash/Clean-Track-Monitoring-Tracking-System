import { useRef, useState } from 'react'
import { useData } from '../../store/dataContext.js'
import { todayISO } from '../../utils/format.js'

// Today's Pick Up Check for one resident: the saved answer for today (if any)
// and send(), which saves answers one step at a time. Only one save runs at a
// time, so repeated taps never send twice; the server keeps one record per
// resident per day.
export function usePickupCheck(resident) {
  const { data, dispatch } = useData()
  const today = todayISO()
  const saved = (data.collectionFeedback ?? []).find((f) => f.residentId === resident.id && f.date === today) ?? null
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)

  function send(fields) {
    if (busy.current) return Promise.resolve({ ok: false, busy: true })
    busy.current = true
    setSaving(true)
    const payload = {
      residentId: resident.id,
      residentName: resident.name,
      purok: resident.purok,
      date: today,
      willDispose: saved?.willDispose ?? true,
      truckPassed: null,
      disposed: null,
      reason: null,
      reasonText: '',
      ...fields,
    }
    return dispatch({ type: 'feedback/submit', payload }).finally(() => {
      busy.current = false
      setSaving(false)
    })
  }

  return { saved, send, saving, today }
}
