import { createContext, useContext } from 'react'

export const ToastContext = createContext(() => {})

// const toast = useToast(); toast('Saved')  or  toast('Failed', 'error')
export function useToast() {
  return useContext(ToastContext)
}
