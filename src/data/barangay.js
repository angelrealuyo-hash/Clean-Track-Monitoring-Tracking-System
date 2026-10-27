// The single barangay this system serves. No barangay name is shown in the
// apps; an admin can add one in Settings (General → Barangay Name).
// Everything marked DEMO below is placeholder data: replace it with information
// confirmed by barangay personnel before real use.
export const barangay = {
  name: '',
  city: '',
  lgu: 'Barangay Solid Waste Office',
  // DEMO placeholders, not real phone numbers. Replace with the official hotlines.
  hotline: '(02) 0000-0000 (demo)',
  tanodHotline: '(02) 0000-0001 (demo)',
  hotlineIsDemo: true,
  // Map centre used by Leaflet. DEMO VALUE; not a verified barangay location.
  // See the note at the top of routes.js.
  center: [14.6021, 120.989],
  // DEMO purok list; confirm the actual puroks with the barangay.
  puroks: ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6'],
}
