import { useData } from '../../store/dataContext.js'
import { useTracking } from '../../tracking/trackingContext.js'
import { useDriver } from '../../auth/useAccount.js'
import { currentRun, getCollectionSummary, getStopStatus } from '../../store/selectors.js'
import { isCollectionStop } from '../../services/trackingSimulation.js'
import { todayISO, todayName } from '../../utils/format.js'
import { exceptionOn, isPickupDate } from '../../data/schedule.js'

// Everything the Driver screens need about today's route:
// the driver, the truck, each collection stop's status, and the next target.
export function useDriverRoute() {
  const { data, dispatch } = useData()
  const tracking = useTracking()
  const driver = useDriver()
  const { truck, route } = data
  const run = currentRun(data)
  const results = run?.results ?? {}
  const assigned = truck.driverId === driver?.id

  const stops = route.stops.filter(isCollectionStop).map((stop) => ({
    stop,
    number: route.stops.indexOf(stop),
    status: getStopStatus(stop, tracking.progress),
    log: results[stop.id] ?? null,
  }))
  const summary = getCollectionSummary(route, tracking.progress)
  // Next target: where the truck is heading, else the first stop still pending.
  const target = stops.find((s) => s.status === 'next') ?? stops.find((s) => s.status === 'pending') ?? null
  const todaysRun = data.weeklySchedule.find((d) => d.day === todayName())
  // Regular routes run only on the official days (Mon/Wed/Fri).
  const collectionToday = isPickupDate(todayISO(), data.scheduleExceptions)
  const todayException = exceptionOn(todayISO(), data.scheduleExceptions)

  // Queue for My Route: the stop to do now first, then the rest still to do
  // (in route order), then stops to go back to ("could not pick up"), then the
  // collected ones at the bottom. The shift ends only when every stop is collected.
  const isOpen = (s) => s.status === 'pending' || s.status === 'next'
  const pendingStops = stops.filter(isOpen)
  const queue = {
    active: target,
    upcoming: pendingStops.filter((s) => s !== target),
    retry: stops.filter((s) => s.status === 'missed'),
    done: stops.filter((s) => s.status === 'collected').sort((a, b) => (b.log?.at ?? '').localeCompare(a.log?.at ?? '')),
  }
  const allCollected = stops.length > 0 && stops.every((s) => s.status === 'collected')

  return { ...tracking, data, dispatch, driver, truck, assigned, stops, summary, target, queue, allCollected, todaysRun, collectionToday, todayException, crew: data.crew ?? [], run }
}
