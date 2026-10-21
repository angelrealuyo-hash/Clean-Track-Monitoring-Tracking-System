import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/authContext.js'

// Red "Sign Out" button used on the Resident and Driver profile pages.
export default function SignOutButton({ role, label = 'Sign Out' }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="ct-btn ct-btn--danger ct-btn--block"
      onClick={() => {
        logout(role)
        navigate(`/${role}/login`, { replace: true })
      }}
    >
      <LogOut size={16} />
      {label}
    </button>
  )
}
