import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './Celebration.css'

// CleanTrack greens + a few warm accents.
const COLORS = ['#065f46', '#047857', '#10b981', '#6ee7b7', '#f59e0b', '#fbbf24', '#38bdf8', '#ffffff']
const DURATION_MS = 3200

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// A short confetti burst with a message. Never blocks clicks (pointer-events:
// none), so buttons such as "END MY SHIFT" keep working underneath.
// With "reduce motion" turned on, only the message is shown.
export default function Celebration({ title, message, onDone }) {
  const canvasRef = useRef(null)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    const timer = setTimeout(() => doneRef.current?.(), DURATION_MS + 600)
    const canvas = canvasRef.current
    if (!canvas || reducedMotion()) return () => clearTimeout(timer)

    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    // Two bursts from the lower corners, plus a light fall from the top.
    const pieces = []
    const add = (x, y, angle, speed) =>
      pieces.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        spin: Math.random() * Math.PI,
        vspin: (Math.random() - 0.5) * 0.3,
        round: Math.random() < 0.3,
      })
    const count = w < 500 ? 70 : 110
    for (let i = 0; i < count; i++) {
      add(0, h * 0.85, -Math.PI / 3 + (Math.random() - 0.5) * 0.7, 9 + Math.random() * 8)
      add(w, h * 0.85, (-2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.7, 9 + Math.random() * 8)
    }
    for (let i = 0; i < count / 2; i++) add(Math.random() * w, -20 - Math.random() * 120, Math.PI / 2, 1 + Math.random() * 2)

    const start = performance.now()
    let frame
    const draw = (t) => {
      const elapsed = t - start
      ctx.clearRect(0, 0, w, h)
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - DURATION_MS + 800) / 800)
      for (const p of pieces) {
        p.vy += 0.25 // gravity
        p.vx *= 0.985
        p.vy *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.spin += p.vspin
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.spin)
        ctx.fillStyle = p.color
        if (p.round) {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        }
        ctx.restore()
      }
      if (elapsed < DURATION_MS) frame = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, w, h)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [])

  return createPortal(
    <div className="ct-celebrate" aria-hidden="false">
      <canvas ref={canvasRef} className="ct-celebrate__canvas" aria-hidden="true" />
      <div className="ct-celebrate__card" role="status" aria-live="polite">
        {title && <strong>{title}</strong>}
        <span>{message}</span>
      </div>
    </div>,
    document.body,
  )
}
