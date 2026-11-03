// Label + input + optional hint/error, matching the PDF's form style.
// `aside` (e.g. a "0/250" counter) sits at the right end of the label line.
export default function Field({ label, htmlFor, required, hint, error, aside, className = '', children }) {
  const labelEl = (
    <label className="ct-label" htmlFor={htmlFor}>
      {label}
      {required && <span aria-hidden="true"> *</span>}
    </label>
  )
  return (
    <div className={`ct-field ${className}`}>
      {aside ? (
        <div className="ct-field__row">
          {labelEl}
          <span className="ct-field__aside">{aside}</span>
        </div>
      ) : (
        labelEl
      )}
      {children}
      {error ? (
        <span className="ct-field__error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="ct-field__hint">{hint}</span>
      )}
    </div>
  )
}
