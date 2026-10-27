import { TriangleAlert } from 'lucide-react'
import Modal from './Modal.jsx'

// "Are you sure?" dialog for actions that remove or reset data.
export default function ConfirmModal({ title, children, confirmLabel = 'Confirm', onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      icon={TriangleAlert}
      tone="danger"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ct-btn ct-btn--danger-solid"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
