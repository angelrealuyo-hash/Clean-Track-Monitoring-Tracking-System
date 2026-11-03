import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/authContext.js'
import SignOutConfirm from './SignOutConfirm.jsx'

// Red "Sign Out" button used on the Resident and Driver profile pages.
// Asks for confirmation first.
export default function SignOutButton({ role, label = 'Sign Out' }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <button type="button" className="ct-btn ct-btn--danger ct-btn--block" onClick={() => setConfirming(true)}>
        <LogOut size={16} />
        {label}
      </button>
      {confirming && (
        <SignOutConfirm
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            // Leave the page first, so the sign-in page does not remember this
            // page as "where to go back to" after the next sign-in.
            navigate(`/${role}/login`, { replace: true })
            logout(role)
          }}
        />
      )}
    </>
  )
}
