import PlaceholderPage from '../../components/PlaceholderPage.jsx'
import SignOutButton from '../../components/SignOutButton.jsx'

export default function ProfilePage() {
  return (
    <>
      <PlaceholderPage
        app="Resident App"
        title="Profile"
        pdfPages="41"
        description="Household information, alert preferences, and hotlines."
      />
      <div style={{ padding: '0 16px 16px' }}>
        <SignOutButton role="resident" label="Sign Out of Resident Account" />
      </div>
    </>
  )
}
