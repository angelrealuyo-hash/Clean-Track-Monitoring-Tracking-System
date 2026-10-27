import { useCallback } from 'react'
import TrackingProvider from './TrackingProvider.jsx'
import { useData } from '../store/dataContext.js'
import { currentRun } from '../store/selectors.js'
import { route as defaultRoute } from '../data/routes.js'
import { IDLE_CONTROL } from '../services/trackingSimulation.js'

const NO_RESULTS = {}

// Connects the simulated truck to the data store: the route and update speed
// (Routes & Schedules, Settings), the saved controls, and the current run's
// stop records, which are the only source of "collected"/"missed".
export default function ConnectedTrackingProvider({ children }) {
  const { data, dispatch } = useData()
  // Before sign-in (start page, login screens) there is no data yet.
  const results = (data && currentRun(data)?.results) || NO_RESULTS
  const onControl = useCallback((type, payload) => dispatch({ type, payload }), [dispatch])
  return (
    <TrackingProvider
      route={data?.route ?? defaultRoute}
      control={data?.simulation ?? IDLE_CONTROL}
      results={results}
      tickMs={data?.settings.simulationIntervalMs ?? 1000}
      onControl={onControl}
    >
      {children}
    </TrackingProvider>
  )
}
