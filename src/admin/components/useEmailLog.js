import { useCallback, useEffect, useState } from 'react'
import { useData } from '../../store/dataContext.js'
import { api } from '../../api/client.js'

// Email attempts from the server's email_log (admin only). Reloads when data changes.
export function useEmailLog() {
  const { token, data } = useData()
  const [log, setLog] = useState({ loading: true, error: null, config: null, entries: [] })
  const load = useCallback(async () => {
    try {
      const res = await api('/admin/email-log', { token })
      setLog({ loading: false, error: null, config: res.config, entries: res.entries })
    } catch (err) {
      setLog((l) => ({ ...l, loading: false, error: err.message }))
    }
  }, [token])
  const changed = data?.broadcasts?.length + ':' + data?.reports?.length + ':' + data?.notifications?.length
  useEffect(() => {
    // Fetching from the server is the purpose of this effect.
    // eslint-disable-next-line react/set-state-in-effect
    load()
  }, [load, changed])
  return { ...log, reload: load }
}

export const emailStatusMeta = {
  sent: { tone: 'green', label: 'Sent' },
  queued: { tone: 'blue', label: 'Queued' },
  failed: { tone: 'red', label: 'Failed' },
  not_configured: { tone: 'gray', label: 'Not sent: email not configured' },
}
