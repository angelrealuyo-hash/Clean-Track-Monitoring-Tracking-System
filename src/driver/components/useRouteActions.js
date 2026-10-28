import { useToast } from '../../components/toast/toastContext.js'
import { scheduleLabel } from '../../data/schedule.js'

// Start Route / End My Shift for the driver. A route = one saved collection run
// (store) + the demo truck moving on the map (simulation).
export function useRouteActions(r) {
  const toast = useToast()
  const { data, dispatch, driver, truck, assigned, state } = r
  const runActive = Boolean(data.activeRunId)
  const moving = state.status === 'running' || state.status === 'paused'

  // Why the route cannot start, in plain words (null = it can).
  let blocked = null
  if (!assigned) blocked = `You are not driving ${truck.id} today.`
  else if (r.todayException) blocked = `No collection today: ${r.todayException.reason}.`
  else if (!r.collectionToday) blocked = `No collection today. Routes run on ${scheduleLabel} only.`
  else if (truck.status === 'maintenance') blocked = `Truck ${truck.id} is being repaired. Please call the office.`

  function startRoute() {
    if (blocked) return Promise.resolve({ ok: false })
    return dispatch({ type: 'run/start', payload: { by: 'driver', driverId: driver.id } }).then((res) => {
      if (!res.ok) return res
      if (driver.status !== 'on-shift') dispatch({ type: 'driver/update', payload: { id: driver.id, patch: { status: 'on-shift' } } })
      if (state.status === 'paused') r.resume()
      else if (!moving) r.start()
      toast(runActive ? 'Route continued' : 'Route started')
      return res
    })
  }

  // Closes today's run (saves the end time) and takes the driver off shift.
  function endShift() {
    return dispatch({ type: 'run/end' }).then((res) => {
      if (!res.ok) return res
      if (moving) r.stop()
      if (driver.status === 'on-shift') dispatch({ type: 'driver/update', payload: { id: driver.id, patch: { status: 'off-duty' } } })
      toast('Shift ended. Your route is saved. Salamat!')
      return res
    })
  }

  return { runActive, moving, blocked, startRoute, endShift }
}
