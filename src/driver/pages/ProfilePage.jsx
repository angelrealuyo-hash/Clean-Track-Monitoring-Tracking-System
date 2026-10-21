import PlaceholderPage from '../../components/PlaceholderPage.jsx'
import SignOutButton from '../../components/SignOutButton.jsx'

export default function ProfilePage() {
  return (
    <>
      <PlaceholderPage
        app="Driver App"
        title="Profile"
        pdfPages="49"
        description="Driver info, assigned truck, and emergency contacts."
      />
      <div style={{ padding: '0 16px 16px' }}>
        <SignOutButton role="driver" label="Sign Out of Shift" />
      </div>
    </>
  )
}
