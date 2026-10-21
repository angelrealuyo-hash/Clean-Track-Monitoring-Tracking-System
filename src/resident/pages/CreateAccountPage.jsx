import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import MobileFrame from '../../components/MobileFrame.jsx'
import Logo from '../../components/Logo.jsx'
import PlaceholderPage from '../../components/PlaceholderPage.jsx'
import '../../styles/mobile-auth.css'

export default function CreateAccountPage() {
  return (
    <MobileFrame>
      <div className="m-auth">
        <div className="m-auth__top">
          <Link to="/resident/login" className="ct-icon-btn" aria-label="Back to sign in">
            <ArrowLeft size={18} />
          </Link>
          <Logo variant="resident" size={28} />
          <strong>CleanTrack</strong>
        </div>
        <PlaceholderPage
          app="Resident App"
          title="Create Account"
          pdfPages="35"
          description="Household registration form."
        />
        <p className="m-auth__switch">
          Already registered? <Link to="/resident/login">Sign In</Link>
        </p>
      </div>
    </MobileFrame>
  )
}
