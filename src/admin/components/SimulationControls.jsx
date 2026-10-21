import { Pause, Play, RotateCcw, Square } from 'lucide-react'
import { useTracking } from '../../tracking/trackingContext.js'
import './SimulationControls.css'

// Start / Pause / Resume / Stop for the simulated truck.
// Only the buttons that make sense for the current status are shown.
export default function SimulationControls() {
  const { state, error, start, pause, resume, stop } = useTracking()
  const { status } = state

  if (error) return null

  return (
    <div className="sim-controls" role="group" aria-label="Simulation controls">
      {(status === 'idle' || status === 'stopped' || status === 'completed') && (
        <button type="button" className="ct-btn ct-btn--primary" onClick={start}>
          {status === 'idle' ? <Play size={16} /> : <RotateCcw size={16} />}
          {status === 'idle' ? 'Start Simulation' : 'Restart'}
        </button>
      )}
      {status === 'running' && (
        <button type="button" className="ct-btn ct-btn--soft" onClick={pause}>
          <Pause size={16} /> Pause
        </button>
      )}
      {status === 'paused' && (
        <button type="button" className="ct-btn ct-btn--primary" onClick={resume}>
          <Play size={16} /> Resume
        </button>
      )}
      {(status === 'running' || status === 'paused') && (
        <button type="button" className="ct-btn ct-btn--danger" onClick={stop}>
          <Square size={14} /> Stop
        </button>
      )}
    </div>
  )
}
