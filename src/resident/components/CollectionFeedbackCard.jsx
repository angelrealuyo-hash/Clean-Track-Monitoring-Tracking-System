import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, CircleCheck, MessageSquareText, Pencil, Send } from 'lucide-react'
import { useToast } from '../../components/toast/toastContext.js'
import Field from '../../components/Field.jsx'
import Celebration from '../../components/Celebration.jsx'
import { usePickupCheck } from './usePickupCheck.js'
import { feedbackReasonLabel, reasonsFor } from '../../data/collectionFeedback.js'
import { celebrateOnce, disposedMessages, notTodayMessages, pickMessage, reasonReplies } from '../../data/residentMessages.js'
import { formatTime } from '../../utils/format.js'

// Today's Pick Up Check (Resident Home):
//   1. Are you planning to dispose of your garbage today?  YES / NO
//   2. (YES) Did the garbage truck pass your location?    YES / NO
//   3a. (truck passed) Were you able to dispose of it?     YES / NO
//   3b. (could not dispose) Why? -> reason + optional note
// Each answer is saved as given; one record per resident per day (latest kept).
// Replies and confetti appear only right after the resident answers, never when
// an old answer is loaded.
export default function CollectionFeedbackCard({ resident }) {
  const { saved, send, saving, today } = usePickupCheck(resident)
  const { hash } = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const [showAnswers, setShowAnswers] = useState(false) // closed check: "View or change" opened
  const [editing, setEditing] = useState(false)
  const [askReason, setAskReason] = useState(false) // answered "No" to step 3a, reason not sent yet
  const [reason, setReason] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [error, setError] = useState('')
  const [reply, setReply] = useState(null) // { text, tone } shown after this session's answer
  const [celebration, setCelebration] = useState(null)

  // "Answer now" in the notification opens /resident#pickup-check.
  useEffect(() => {
    if (hash === '#pickup-check') document.getElementById('pickup-check')?.scrollIntoView({ block: 'start' })
  }, [hash])

  // Finished = every required answer is saved. Then the check closes (also
  // after a refresh or a new sign-in, because this comes from the saved record).
  const complete = Boolean(saved && (!saved.willDispose || saved.disposed !== null))
  const answers = editing ? null : saved
  let step = 'will'
  if (answers) {
    if (!answers.willDispose) step = 'done'
    else if (answers.truckPassed === null) step = 'passed'
    else if (answers.disposed === null) step = answers.truckPassed && !askReason ? 'disposed' : 'reason'
    else step = 'done'
  }

  function submit(fields, onSaved) {
    setError('')
    send(fields).then((res) => {
      if (res.busy) return
      // Failed: stay open on the same question so nothing is lost.
      if (!res.ok) {
        setError(res.error ?? 'Could not save. Please try again.')
        return
      }
      setEditing(false)
      setAskReason(false)
      onSaved?.()
    })
  }

  // The last answer was saved: close the check and go back to Home.
  function finish(message) {
    setShowAnswers(false)
    toast(message)
    if (hash === '#pickup-check') navigate('/resident', { replace: true })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  function answerNotToday() {
    submit({ willDispose: false }, () => {
      const text = pickMessage(notTodayMessages, 'not-today')
      setReply({ tone: 'fun', text })
      finish(`Saved! ${text}`)
    })
  }

  function answerDisposed() {
    submit({ willDispose: true, truckPassed: true, disposed: true }, () => {
      const text = pickMessage(disposedMessages, 'disposed')
      setReply({ tone: 'win', text })
      // Confetti once per resident per pickup day.
      if (celebrateOnce(`dispose-${resident.id}-${today}`)) setCelebration(text)
      finish('Saved! Your answers were recorded.')
    })
  }

  function sendReason(e) {
    e.preventDefault()
    if (!reason) return setError('Choose a reason.')
    if (reason === 'other' && reasonText.trim().length < 3) return setError('Please tell us the reason in a few words.')
    submit({ willDispose: true, truckPassed: saved.truckPassed, disposed: false, reason, reasonText: reasonText.trim() }, () => {
      setReply({ tone: 'care', text: reasonReplies[reason] })
      finish(`Saved! ${reasonReplies[reason]}`)
    })
  }

  function restart() {
    setEditing(true)
    setAskReason(false)
    setReason('')
    setReasonText('')
    setError('')
    setReply(null)
    setShowAnswers(false)
  }

  const yesNo = (onYes, onNo) => (
    <div className="res-yesno">
      <button type="button" className="ct-btn ct-btn--primary" disabled={saving} onClick={onYes}>
        YES
      </button>
      <button type="button" className="ct-btn ct-btn--secondary" disabled={saving} onClick={onNo}>
        NO
      </button>
    </div>
  )

  // Closed: a one-line note instead of the questions (no new prompt today).
  if (complete && !editing && !showAnswers) {
    return (
      <section id="pickup-check" className="m-card res-feedback is-closed" aria-label="Today's Pick Up Check">
        <div className="m-row">
          <CircleCheck size={18} color="var(--ct-green-700)" />
          <div className="m-grow">
            <strong>Today&apos;s Pick Up Check is done</strong>
            {reply && <p className={`res-reply is-${reply.tone}`}>{reply.text}</p>}
          </div>
          <button type="button" className="res-inline-link" onClick={() => setShowAnswers(true)} aria-expanded="false">
            View <ChevronDown size={13} />
          </button>
        </div>
        {celebration && <Celebration title="You did it!" message={celebration} onDone={() => setCelebration(null)} />}
      </section>
    )
  }

  return (
    <section id="pickup-check" className="m-card res-feedback" aria-labelledby="res-fb-title" aria-busy={saving}>
      <p className="m-eyebrow">
        <MessageSquareText size={12} /> Today&apos;s Pick Up Check!
      </p>

      {step === 'will' && (
        <>
          <h2 id="res-fb-title" className="m-h2">
            Are you planning to dispose of your garbage today?
          </h2>
          {yesNo(() => submit({ willDispose: true }), answerNotToday)}
          {editing && saved && (
            <button type="button" className="res-inline-link res-gap" onClick={() => setEditing(false)}>
              Keep my earlier answers
            </button>
          )}
        </>
      )}

      {step === 'passed' && (
        <>
          <h2 id="res-fb-title" className="m-h2">
            Did the garbage truck pass your location?
          </h2>
          {yesNo(
            () => submit({ willDispose: true, truckPassed: true }),
            () => submit({ willDispose: true, truckPassed: false }),
          )}
          <p className="m-muted res-gap">Not sure yet? Come back after the pickup time.</p>
        </>
      )}

      {step === 'disposed' && (
        <>
          <h2 id="res-fb-title" className="m-h2">
            Were you able to dispose of your garbage?
          </h2>
          {yesNo(answerDisposed, () => {
            setError('')
            setAskReason(true)
          })}
        </>
      )}

      {step === 'reason' && (
        <form onSubmit={sendReason} noValidate>
          <h2 id="res-fb-title" className="m-h2">
            Why were you unable to dispose of your garbage?
          </h2>
          {saved.truckPassed === false && (
            <p className="res-reply is-care">Sorry the truck didn’t make it to you. 💚 Tell us what happened so the barangay can follow up.</p>
          )}
          <div className="res-reasons" role="radiogroup" aria-label="Reason">
            {reasonsFor(saved.truckPassed).map((r) => (
              <label key={r.id} className={`res-reason ${reason === r.id ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name="fb-reason"
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => {
                    setReason(r.id)
                    setError('')
                  }}
                />
                {r.label}
              </label>
            ))}
          </div>
          <Field
            label={reason === 'other' ? 'Tell us what happened' : 'More details (optional)'}
            htmlFor="fb-text"
            required={reason === 'other'}
            hint={`${reasonText.length}/250`}
          >
            <textarea
              id="fb-text"
              className="ct-input"
              maxLength={250}
              rows={3}
              placeholder="Example: The truck passed at 7 AM but did not stop at our corner."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
          </Field>
          <button type="submit" className="ct-btn ct-btn--primary ct-btn--block" disabled={saving}>
            <Send size={15} /> {saving ? 'Sending…' : 'Send to the Barangay'}
          </button>
          {saved.truckPassed && (
            <button type="button" className="res-inline-link res-gap" onClick={() => setAskReason(false)}>
              Back
            </button>
          )}
        </form>
      )}

      {step === 'done' && (
        <div className="m-row m-row--top">
          <CircleCheck size={20} color="var(--ct-green-700)" />
          <div className="m-grow">
            <strong id="res-fb-title">Thanks for answering!</strong>
            {reply && <p className={`res-reply is-${reply.tone}`}>{reply.text}</p>}
            <ul className="res-fb-summary">
              <li>Planning to dispose today: {saved.willDispose ? 'Yes' : 'No'}</li>
              {saved.truckPassed !== null && <li>Truck passed your location: {saved.truckPassed ? 'Yes' : 'No'}</li>}
              {saved.disposed !== null && <li>Able to dispose: {saved.disposed ? 'Yes' : 'No'}</li>}
              {saved.reason && (
                <li>
                  Reason: {feedbackReasonLabel(saved.reason)}
                  {saved.reasonText ? ` — “${saved.reasonText}”` : ''}
                </li>
              )}
            </ul>
            {saved.reportId && (
              <p className="m-muted">
                Sent to the barangay as report <Link to={`/resident/reports/${saved.reportId}`}>#{saved.reportId}</Link>.
              </p>
            )}
            <p className="m-muted">Saved at {formatTime(saved.updatedAt)}</p>
            <div className="res-fb-actions">
              <button type="button" className="res-inline-link res-gap" onClick={restart}>
                <Pencil size={12} /> Change my answers
              </button>
              {complete && (
                <button type="button" className="res-inline-link res-gap" onClick={() => setShowAnswers(false)}>
                  Hide
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="ct-field__error res-gap" role="alert">
          {error}
        </p>
      )}

      {celebration && <Celebration title="You did it!" message={celebration} onDone={() => setCelebration(null)} />}
    </section>
  )
}
