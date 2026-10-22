// Holds the app's demo data (truck, drivers, route, reports, ...) and saves
// every change to this browser's localStorage, so edits survive a refresh.
// There is no backend: other browsers/devices do not see these changes.
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { DataContext } from './dataContext.js'
import { dataReducer } from './dataReducer.js'
import { DATA_VERSION, createInitialData } from './initialData.js'

const STORAGE_KEY = 'cleantrack.data'

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    // Older saved shapes are discarded instead of breaking the app.
    if (saved?.version === DATA_VERSION) return saved
  } catch {
    // Unreadable or blocked storage: fall back to the demo data.
  }
  return createInitialData()
}

export default function DataProvider({ children }) {
  const [data, dispatch] = useReducer(dataReducer, undefined, load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Storage full or blocked: changes last until the page is refreshed.
    }
  }, [data])

  // Keep several open tabs in step (e.g. Admin in one tab, Resident in another).
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const incoming = JSON.parse(e.newValue)
        if (incoming?.version === DATA_VERSION) dispatch({ type: 'sync', payload: incoming })
      } catch {
        // Ignore unreadable data from another tab.
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const reset = useCallback(() => dispatch({ type: 'reset', payload: createInitialData() }), [])

  const value = useMemo(() => ({ data, dispatch, reset }), [data, reset])
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
