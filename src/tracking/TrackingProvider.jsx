// Gives every screen the ONE simulated truck. The position is calculated from
// the saved controls + records + the clock (services/trackingSimulation.js), so
// all tabs agree and a reload keeps the truck in place. One interval per tab
// refreshes the clock while the truck is running; it is cleared when the truck
// stops or the app unmounts, so timers never pile up.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TrackingContext } from './trackingContext.js'
import { computeSimulation, getRouteProgress, IDLE_CONTROL, validateRoute } from '../services/trackingSimulation.js'

const NO_RESULTS = {}

export default function TrackingProvider({ children, route, control = IDLE_CONTROL, results = NO_RESULTS, tickMs = 1000, onControl }) {
  const error = validateRoute(route)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const running = control?.status === 'running'

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setNowMs(Date.now()), tickMs)
    return () => clearInterval(id)
  }, [running, tickMs])

  const state = useMemo(
    () => (error ? computeSimulation({ route: { stops: route?.stops ?? [] } }) : computeSimulation({ route, control, results, nowMs, tickMs })),
    [error, route, control, results, nowMs, tickMs],
  )

  // Controls are saved actions, so every tab sees them.
  const finished = state.status === 'completed'
  const start = useCallback(() => onControl?.('sim/start', { force: finished }), [onControl, finished])
  const pause = useCallback(() => onControl?.('sim/pause'), [onControl])
  const resume = useCallback(() => onControl?.('sim/resume'), [onControl])
  const stop = useCallback(() => onControl?.('sim/stop'), [onControl])
  const reset = useCallback(() => onControl?.('sim/reset'), [onControl])

  const value = useMemo(
    () => ({
      route,
      state,
      progress: error ? null : getRouteProgress(route, state, results),
      error,
      tickMs,
      start,
      pause,
      resume,
      stop,
      reset,
    }),
    [route, state, results, error, tickMs, start, pause, resume, stop, reset],
  )

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
}
