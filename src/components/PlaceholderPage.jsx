import './PlaceholderPage.css'

// Temporary stand-in for screens that are not built yet.
// `pdfPages` points to the matching screen in UI-FIGMA-Clean-track.pdf.
export default function PlaceholderPage({ app, title, pdfPages, description }) {
  return (
    <section className="placeholder-page">
      <span className="placeholder-page__app">{app}</span>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {pdfPages && <p className="placeholder-page__ref">Design reference: PDF page {pdfPages}</p>}
    </section>
  )
}
