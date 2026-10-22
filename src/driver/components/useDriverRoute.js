import { useData } from '../../store/dataContext.js'
import { useTracking } from '../../tracking/trackingContext.js'
import { useDriver } from '../../auth/useAccount.js'
import { getCollectionSummary, getStopStatus } from '../../store/selectors.js'
import { isCollectionStop } from '../../services/trackingSimulation.js'
import { todayName } from '../../utils/format.js'

// Everything the Driver screens need about today's route:
// the driver, the truck, each collection stop's status, and the next target.
export function useDriverRoute() {
  const { data, dispatch } = useData()
  const tracking = useTracking()
  const driver = useDriver()
  const { truck, route, collectionLog } = data
  const assigned = truck.driverId === driver?.id

  const stops = route.stops.filter(isCollectionStop).map((stop) => ({
    stop,
    number: route.stops.indexOf(stop),
    status: getStopStatus(stop, tracking.progress, collectionLog),
    log: collectionLog[stop.id] ?? null,
  }))
  const summary = getCollectionSummary(route, tracking.progress, collectionLog)
  // Next target: where the truck is heading, else the first stop still pending.
  const target = stops.find((s) => s.status === 'next') ?? stops.find((s) => s.status === 'pending') ?? null
  const collectedBins = stops.filter((s) => s.status === 'collected').reduce((n, s) => n + s.stop.bins, 0)
  const totalBins = stops.reduce((n, s) => n + s.stop.bins, 0)
  const todaysRun = data.weeklySchedule.find((d) => d.day === todayName())

  return { ...tracking, data, dispatch, driver, truck, assigned, stops, summary, target, collectedBins, totalBins, todaysRun }
}
