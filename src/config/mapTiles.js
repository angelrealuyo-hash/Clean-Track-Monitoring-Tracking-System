// Where the map background images ("tiles") come from. Both servers show
// OpenStreetMap data. The first one that works is used; the second is a backup
// if the first cannot be reached.
//
// IMPORTANT: OpenStreetMap's volunteer tile servers return an "Access blocked"
// image when a tile request has no Referer header (who is asking). Some hosts,
// such as GitHub Codespaces' forwarded URLs, tell the browser not to send it.
// TrackingMap therefore sets referrerPolicy on every tile, and index.html sets a
// matching <meta name="referrer">. Do not remove either.
// Policy: https://operations.osmfoundation.org/policies/tiles/
//
// These free servers are fine for a student project with light use. For a real
// deployment, switch to a tile provider with an account/API key.
export const TILE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

export const tileProviders = [
  {
    id: 'osm-standard',
    name: 'OpenStreetMap Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    id: 'osm-germany',
    name: 'OpenStreetMap Germany (community server)',
    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
]
