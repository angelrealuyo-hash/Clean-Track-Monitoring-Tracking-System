import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, todayISO } from '../utils/format.js'
import './DatePicker.css'

// A date field with its own calendar popover. The browser's built-in picker
// can't be positioned or styled, so it could cover the content below it.
// This calendar is drawn in a portal on <body> so no card can clip it. It
// always opens below the field; if the screen is too short, the page scrolls
// so the whole calendar is visible. It always shows 6 weeks (42 cells), so
// its size never changes between months.
//
// value / min: 'YYYY-MM-DD' (or ''). isDisabled(iso) greys out extra days.

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const GAP = 6
const EDGE = 8

const pad = (n) => String(n).padStart(2, '0')
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const parse = (iso) => {
  const [y, m] = (iso || '').split('-').map(Number)
  return y && m ? { y, m: m - 1 } : null
}
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00`)
  d.setDate(d.getDate() + n)
  return toISO(d.getFullYear(), d.getMonth(), d.getDate())
}

export default function DatePicker({ id, value, min, onChange, isDisabled, invalid, placeholder = 'Select a date' }) {
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [focusISO, setFocusISO] = useState('')
  const todayIso = todayISO()
  const [view, setView] = useState(() => parse(value) ?? parse(min) ?? parse(todayIso))

  const blocked = useCallback((iso) => (min && iso < min) || Boolean(isDisabled?.(iso)), [min, isDisabled])

  function openPicker() {
    const start = value || (min && min > todayIso ? min : todayIso)
    setView(parse(start))
    setFocusISO(start)
    setPos(null)
    setOpen(true)
  }

  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  // Always under the field (page coordinates, so the page can grow and scroll
  // to it), and never past the left/right edge of the screen.
  const place = useCallback(() => {
    const t = triggerRef.current
    const p = panelRef.current
    if (!t || !p) return
    const r = t.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const left = Math.max(EDGE, Math.min(r.left, vw - p.offsetWidth - EDGE))
    setPos({
      top: r.bottom + GAP + window.scrollY,
      left: left + window.scrollX,
    })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  // Once placed, scroll just enough to show the whole calendar (only on open).
  const shown = Boolean(pos)
  useEffect(() => {
    if (!open || !shown) return
    // Near the end of the page, make room inside the page's <main> (not past
    // it), so the layout grows with the calendar and the sidebar stays put.
    const main = triggerRef.current?.closest('main')
    const panelBox = panelRef.current?.getBoundingClientRect()
    let restore = null
    if (main && panelBox) {
      const short = panelBox.bottom - main.getBoundingClientRect().bottom
      if (short > 0) {
        const before = main.style.paddingBottom
        main.style.paddingBottom = `${parseFloat(getComputedStyle(main).paddingBottom) + short}px`
        restore = () => (main.style.paddingBottom = before)
      }
    }
    // The layer's bottom padding keeps a small gap under the calendar, even at the end of the page.
    const extra = (panelBox?.bottom ?? 0) - window.innerHeight
    if (extra > 0) window.scrollBy({ top: extra, behavior: 'smooth' })
    return () => restore?.()
  }, [open, shown])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      close(false)
    }
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    // Page scrolling moves the panel with the page; inner scroll areas need a re-place.
    window.addEventListener('resize', place)
    document.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      document.removeEventListener('scroll', place, true)
    }
  }, [open, close, place])

  // Keep keyboard focus on the highlighted day.
  useEffect(() => {
    if (open && pos) panelRef.current?.querySelector(`[data-iso="${focusISO}"]`)?.focus({ preventScroll: true })
  }, [open, pos, focusISO])

  function pick(iso) {
    if (blocked(iso)) return
    onChange(iso)
    close()
  }

  function moveMonth(step) {
    const d = new Date(view.y, view.m + step, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }

  function onGridKey(e) {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (!(e.key in steps)) return
    e.preventDefault()
    const next = addDays(focusISO, steps[e.key])
    setFocusISO(next)
    setView(parse(next))
  }

  const first = new Date(view.y, view.m, 1)
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  // Always 42 cells (6 weeks) so every month has the same height.
  const days = Array.from({ length: daysInMonth }, (_, i) => toISO(view.y, view.m, i + 1))
  const lead = Array(first.getDay()).fill(null)
  const cells = [...lead, ...days, ...Array(42 - lead.length - days.length).fill(null)]
  const monthLabel = first.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const prevDisabled = Boolean(min) && toISO(view.y, view.m, 1) <= min
  const panelId = `${id}-calendar`

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`ct-input ct-datepicker__trigger ${value ? '' : 'is-empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-invalid={invalid || undefined}
        data-value={value}
        onClick={() => (open ? close() : openPicker())}
      >
        <span>{value ? formatDate(value) : placeholder}</span>
        <CalendarDays size={16} aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div ref={panelRef} className="ct-datepicker-layer" style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}>
            <div id={panelId} role="dialog" aria-label="Choose a date" className="ct-datepicker">
              <div className="ct-datepicker__head">
                <button type="button" className="ct-datepicker__nav" aria-label="Previous month" disabled={prevDisabled} onClick={() => moveMonth(-1)}>
                  <ChevronLeft size={16} />
                </button>
                <strong aria-live="polite">{monthLabel}</strong>
                <button type="button" className="ct-datepicker__nav" aria-label="Next month" onClick={() => moveMonth(1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="ct-datepicker__dows" aria-hidden="true">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="ct-datepicker__dow">
                    {d}
                  </span>
                ))}
              </div>
              <div className="ct-datepicker__grid" role="grid" onKeyDown={onGridKey}>
                {cells.map((iso, i) =>
                  iso ? (
                    <button
                      key={iso}
                      type="button"
                      data-iso={iso}
                      tabIndex={iso === focusISO ? 0 : -1}
                      className={`ct-datepicker__day${iso === value ? ' is-selected' : ''}${iso === todayIso ? ' is-today' : ''}`}
                      disabled={blocked(iso)}
                      aria-pressed={iso === value}
                      aria-label={formatDate(iso)}
                      onClick={() => pick(iso)}
                    >
                      {Number(iso.slice(8))}
                    </button>
                  ) : (
                    <span key={`pad-${i}`} />
                  ),
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
