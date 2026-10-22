import { createContext, useContext } from 'react'

export const DataContext = createContext(null)

// { data, dispatch, reset } — see DataProvider.jsx
export function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside <DataProvider>')
  return value
}
