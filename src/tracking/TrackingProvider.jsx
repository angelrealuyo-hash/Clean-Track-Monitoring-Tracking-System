// Owns the ONE simulated truck for the whole app, so the Dashboard map and the
// Live Tracking map show the same truck, and switching pages never starts a
// second timer. The engine itself lives in services/trackingSimulation.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TrackingContext } from './trackingContext.js'
import { route as defaultRoute } from '../data/routes.js'
import {
  createTrackingSimulation,
  getInitialState,
  getRouteProgress,
  validateRoute,
} from '../services/trackingSimulation.js'

export default function TrackingProvider({ children, route = defaultRoute, tickMs = 1000 }) {
  const engineRef = useRef(null)
  const [state, setState] = useState(() => getInitialState(route))
  const error = validateRoute(route)

  // A new route or speed means a fresh simulation from the first stop
  // (the effect below builds a new engine; this resets what screens show).
  const [inputs, setInputs] = useState({ route, tickMs })
  if (inputs.route !== route || inputs.tickMs !== tickMs) {
    setInputs({ route, tickMs })
    setState(getInitialState(route))
  }

  useEffect(() => {
    if (error) return undefined
    const engine = createTrackingSimulation({ route, tickMs, onChange: setState })
    engineRef.current = engine
    // Cleanup stops the timer when the app unmounts (and in React's dev
    // double-mount check), so timers never pile up.
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [route, tickMs, error])

  const start = useCallback(() => engineRef.current?.start(), [])
  const pause = useCallback(() => engineRef.current?.pause(), [])
  const resume = useCallback(() => engineRef.current?.resume(), [])
  const stop = useCallback(() => engineRef.current?.stop(), [])

  const value = useMemo(
    () => ({
      route,
      state,
      progress: error ? null : getRouteProgress(route, state),
      error,
      tickMs,
      start,
      pause,
      resume,
      stop,
    }),
    [route, state, error, tickMs, start, pause, resume, stop],
  )

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
}
