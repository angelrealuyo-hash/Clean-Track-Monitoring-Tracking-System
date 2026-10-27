import { createContext, useContext } from 'react'

export const TrackingContext = createContext(null)

// { route, state, progress, error, start, pause, resume, stop } — see TrackingProvider.jsx
export function useTracking() {
  const value = useContext(TrackingContext)
  if (!value) throw new Error('useTracking must be used inside <TrackingProvider>')
  return value
}
