import { useData } from '../../store/dataContext.js'
import { useTracking } from '../../tracking/trackingContext.js'
import { useResident } from '../../auth/useAccount.js'
import { truckDistanceToPurok } from '../../store/selectors.js'
import { todayISO, todayName } from '../../utils/format.js'
import { exceptionOn, isPickupDate } from '../../data/schedule.js'

// Where the (simulated) truck is relative to the signed-in resident's purok,
// as words and a badge colour. Shared by Home and Track Truck.
export function useTruckForResident() {
  const { data } = useData()
  const tracking = useTracking()
  const resident = useResident()
  const today = todayName()
  const todaysRun = data.weeklySchedule.find((d) => d.day === today)
  // Official pickup days only (Mon/Wed/Fri).
  const collectionToday = Boolean(todaysRun) && isPickupDate(todayISO(), data.scheduleExceptions)
  const todayException = exceptionOn(todayISO(), data.scheduleExceptions)
  const distance = resident ? truckDistanceToPurok(tracking.route, tracking.state, resident.purok) : { state: 'none' }
  const paused = tracking.state.status === 'paused'

  let label
  let tone
  if (!collectionToday) {
    label = 'No pickup today'
    tone = 'gray'
  } else if (data.truck.status === 'maintenance' && tracking.state.status === 'idle') {
    label = 'Truck is being repaired'
    tone = 'red'
  } else if (distance.state === 'none') {
    label = 'Your area is not on the route'
    tone = 'gray'
  } else if (distance.state === 'not-started') {
    label = 'Truck has not left yet'
    tone = 'gray'
  } else if (distance.state === 'passed') {
    label = 'Truck already passed'
    tone = 'blue'
  } else if (distance.state === 'here') {
    label = paused ? 'Truck stopped nearby' : 'Truck is almost here'
    tone = 'green'
  } else {
    const n = distance.stopsAway + 1
    label = `Truck is ${n} stop${n === 1 ? '' : 's'} away`
    tone = n <= 2 ? 'green' : 'amber'
  }

  return { ...tracking, data, resident, distance, label, tone, todaysRun, collectionToday, todayException, today }
}
