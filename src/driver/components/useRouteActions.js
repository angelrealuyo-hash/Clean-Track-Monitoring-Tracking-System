import { useToast } from '../../components/toast/toastContext.js'

// Start Route / End Route for the driver. A route = one saved collection run
// (store) + the demo truck moving on the map (simulation).
export function useRouteActions(r) {
  const toast = useToast()
  const { data, dispatch, driver, truck, assigned, state } = r
  const runActive = Boolean(data.activeRunId)
  const moving = state.status === 'running' || state.status === 'paused'

  // Why the route cannot start, in plain words (null = it can).
  let blocked = null
  if (!assigned) blocked = `You are not driving ${truck.id} today.`
  else if (truck.status === 'maintenance') blocked = `Truck ${truck.id} is being repaired. Please call the office.`

  function startRoute() {
    if (blocked) return
    dispatch({ type: 'run/start', payload: { by: 'driver', driverId: driver.id } }).then((res) => {
      if (!res.ok) return
      if (driver.status !== 'on-shift') dispatch({ type: 'driver/update', payload: { id: driver.id, patch: { status: 'on-shift' } } })
      if (state.status === 'paused') r.resume()
      else if (!moving) r.start()
      toast(runActive ? 'Route continued' : 'Route started')
    })
  }

  function endRoute() {
    dispatch({ type: 'run/end' }).then((res) => {
      if (!res.ok) return
      if (moving) r.stop()
      toast('Route ended and saved')
    })
  }

  return { runActive, moving, blocked, startRoute, endRoute }
}
