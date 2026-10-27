import { TriangleAlert } from 'lucide-react'
import { barangay } from '../../data/barangay.js'

// Shown when the signed-in driver is not the truck's assigned driver today.
export default function NotAssignedCard({ truckId }) {
  return (
    <section className="m-card m-row m-row--top">
      <span className="m-icon m-icon--amber">
        <TriangleAlert size={16} />
      </span>
      <div className="m-grow">
        <strong>You are not driving {truckId} today</strong>
        <p className="m-muted">
          Please call the Barangay office ({barangay.hotline}) so they can assign you.
        </p>
      </div>
    </section>
  )
}
