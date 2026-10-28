import { Suspense, useLayoutEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import MobileFrame from './MobileFrame.jsx'
import PageLoader from './PageLoader.jsx'
import './MobileAppLayout.css'

// Shared shell for the Resident and Driver apps: header + scrolling content
// + bottom tab bar.
// tabs: [{ to, label, icon, end?, alsoActiveOn?: [paths] }]
export default function MobileAppLayout({ header, tabs }) {
  const { pathname } = useLocation()
  const headerRef = useRef(null)

  // Share the header height, so sticky bars inside pages sit just below it.
  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const frame = el.parentElement
    const update = () => frame.style.setProperty('--mobile-header-h', `${el.offsetHeight}px`)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function isActive(tab) {
    if (tab.alsoActiveOn?.some((p) => pathname.startsWith(p))) return true
    return tab.end ? pathname === tab.to : pathname.startsWith(tab.to)
  }

  return (
    <MobileFrame>
      <header className="mobile-header" ref={headerRef}>
        {header}
      </header>
      <main className="mobile-content">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <nav className="mobile-tabs" aria-label="Main">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`mobile-tabs__item ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </MobileFrame>
  )
}
