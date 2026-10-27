import '../components/AdminPage.css'

// Title block at the top of every Admin screen.
export default function PageHeader({ eyebrow, title, badge, subtitle, actions }) {
  return (
    <header className="admin-page__header">
      <div>
        {eyebrow && <p className="admin-page__eyebrow">{eyebrow}</p>}
        <h1>
          {title} {badge && <span className="admin-page__badge">{badge}</span>}
        </h1>
        {subtitle && <p className="admin-page__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="admin-page__actions">{actions}</div>}
    </header>
  )
}
