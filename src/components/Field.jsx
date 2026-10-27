// Label + input + optional hint/error, matching the PDF's form style.
export default function Field({ label, htmlFor, required, hint, error, className = '', children }) {
  return (
    <div className={`ct-field ${className}`}>
      <label className="ct-label" htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
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
