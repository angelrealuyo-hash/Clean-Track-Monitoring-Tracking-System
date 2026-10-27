// Loads the signed-in user's data from the CleanTrack server and keeps it up to
// date. All three apps share the same server records; each user only receives
// what their role may see (server/policy + src/store/view.js).
//
// dispatch(action): shows the change immediately, sends it to the server, then
// replaces the local copy with the server's answer. If the server refuses
// (validation, permissions, conflicts), the change is undone and the server's
// reason is shown. Returns a promise: { ok: true } or { ok: false, error }.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DataContext } from './dataContext.js'
import { dataReducer } from './dataReducer.js'
import { userKeyOf } from './view.js'
import { useAuth } from '../auth/authContext.js'
import { useToast } from '../components/toast/toastContext.js'
import { api } from '../api/client.js'

const ROLES = ['admin', 'resident', 'driver']

export default function DataProvider({ children }) {
  const { pathname } = useLocation()
  const role = ROLES.find((r) => pathname === `/${r}` || pathname.startsWith(`/${r}/`)) ?? null
  const { sessions, logout } = useAuth()
  const session = role ? sessions[role] : null
  const token = session?.token ?? null
  const key = token ? `${role}:${token}` : null
  const toast = useToast()

  const [store, setStore] = useState({ key: null, status: 'idle', data: null, version: 0, email: null, error: null })
  const keyRef = useRef(key)
  useEffect(() => {
    keyRef.current = key
  })

  const handleError = useCallback(
    (err) => {
      if (err.status === 401 && role) {
        toast('Your session ended. Please sign in again.', 'error')
        logout(role, 'expired')
      }
      return err
    },
    [role, logout, toast],
  )

  const load = useCallback(async () => {
    if (!key) return
    const forKey = key
    try {
      const snap = await api('/state', { token })
      if (keyRef.current !== forKey) return
      setStore({ key: forKey, status: 'ready', data: snap.data, version: snap.version, email: snap.email, error: null })
    } catch (err) {
      handleError(err)
      if (keyRef.current !== forKey) return
      setStore((s) => (s.key === forKey && s.data ? { ...s, error: err.message } : { key: forKey, status: 'error', data: null, version: 0, email: null, error: err.message }))
    }
  }, [key, token, handleError])

  // First load (and reload when the user/app changes).
  useEffect(() => {
    // Fetching from the server is the purpose of this effect; state is set
    // when the response arrives.
    // eslint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  // Live updates: the server says "data changed" -> reload this user's snapshot.
  const versionRef = useRef(0)
  useEffect(() => {
    versionRef.current = store.version
  })
  useEffect(() => {
    if (!key || typeof EventSource === 'undefined') return undefined
    const source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`)
    source.onmessage = (e) => {
      if (Number(e.data) > versionRef.current) load()
    }
    return () => source.close()
  }, [key, token, load])

  const ready = store.key === key && store.status === 'ready'
  const data = ready ? store.data : null
  const user = useMemo(() => (role && session ? { role, refId: role === 'admin' ? 'ADMIN' : session.id } : null), [role, session])

  const dispatch = useCallback(
    async (action) => {
      if (!key || !store.data || store.key !== key) return { ok: false, error: 'Not signed in.' }
      const forKey = key
      // Read state is per person: tag it with this user (the server does the same).
      const local = action.type.startsWith('notification/mark') ? { ...action, payload: { ...action.payload, userKey: userKeyOf(user) } } : action
      const before = store.data
      try {
        setStore((s) => (s.key === forKey && s.data ? { ...s, data: dataReducer(s.data, local) } : s))
      } catch {
        // The local preview failed; the server answer below decides.
      }
      try {
        const snap = await api('/actions', { token, body: action })
        if (keyRef.current === forKey) setStore((s) => ({ ...s, data: snap.data, version: snap.version, email: snap.email, error: null }))
        return { ok: true, data: snap.data }
      } catch (err) {
        handleError(err)
        if (keyRef.current === forKey) setStore((s) => (s.key === forKey ? { ...s, data: before } : s))
        if (err.status !== 401) toast(err.message, 'error')
        load()
        return { ok: false, error: err.message }
      }
    },
    [key, token, store, user, handleError, toast, load],
  )

  const reset = useCallback(async () => {
    try {
      const snap = await api('/admin/reset', { token, body: {} })
      setStore((s) => ({ ...s, data: snap.data, version: snap.version }))
      return { ok: true }
    } catch (err) {
      toast(err.message, 'error')
      return { ok: false, error: err.message }
    }
  }, [token, toast])

  const value = useMemo(
    () => ({
      data,
      status: !key ? 'signed-out' : store.key !== key ? 'loading' : store.status,
      error: store.key === key ? store.error : null,
      email: store.email,
      token,
      dispatch,
      reset,
      reload: load,
    }),
    [data, key, store, token, dispatch, reset, load],
  )
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
