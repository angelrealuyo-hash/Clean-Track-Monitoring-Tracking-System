import { LogOut } from 'lucide-react'
import Modal from './Modal.jsx'

// "Are you sure you want to sign out?" dialog shared by Admin, Resident and Driver.
export default function SignOutConfirm({ onConfirm, onClose }) {
  return (
    <Modal
      title="Sign Out"
      icon={LogOut}
      tone="danger"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose} autoFocus>
            Cancel
          </button>
          <button type="button" className="ct-btn ct-btn--danger-solid" onClick={onConfirm}>
            <LogOut size={15} /> Yes, Sign Out
          </button>
        </>
      }
    >
      <p className="ct-signout-text">Are you sure you want to sign out?</p>
    </Modal>
  )
}
