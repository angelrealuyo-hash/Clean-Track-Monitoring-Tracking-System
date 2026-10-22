import TrackingProvider from './TrackingProvider.jsx'
import { useData } from '../store/dataContext.js'

// Runs the simulation on the route and update speed saved in the data store,
// so editing the route (Routes & Schedules) or the speed (Settings) applies.
export default function ConnectedTrackingProvider({ children }) {
  const { data } = useData()
  return (
    <TrackingProvider route={data.route} tickMs={data.settings.simulationIntervalMs}>
      {children}
    </TrackingProvider>
  )
}
