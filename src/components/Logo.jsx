import logo from '../assets/cleantrack-logo.png'
import './Logo.css'

// CleanTrack logo (truck with location pin). Used by all three apps.
// `variant` is kept so older calls still work; every app uses the same logo.
// eslint-disable-next-line no-unused-vars
export default function Logo({ variant, size = 36 }) {
  return <img className="ct-brand-logo" src={logo} alt="CleanTrack logo" width={size} height={size} />
}
