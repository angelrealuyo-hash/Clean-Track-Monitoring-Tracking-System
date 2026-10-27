import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { ToastContext } from './toastContext.js'
import './Toast.css'

// Short confirmation messages ("Driver saved") in the bottom corner.
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef([])

  const toast = useCallback((text, tone = 'success') => {
    const id = Date.now() + Math.random()
    // Keep at most 3 on screen so they never cover the page's buttons.
    setToasts((t) => [...t, { id, text, tone }].slice(-3))
    timers.current.push(setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500))
  }, [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="ct-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`ct-toast ct-toast--${t.tone}`}>
            {t.tone === 'error' ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
