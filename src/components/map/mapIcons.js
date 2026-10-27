import L from 'leaflet'

// Truck marker built from HTML (avoids Leaflet's default image icons, which
// break under Vite). Colour follows the simulation status.
const truckSvg =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>'

const cache = {}

export function truckIcon(status) {
  if (!cache[status]) {
    cache[status] = L.divIcon({
      className: `ct-truck-marker ct-truck-marker--${status}`,
      html: `<span class="ct-truck-marker__pin">${truckSvg}</span>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })
  }
  return cache[status]
}

// Circle styles for stops, by status from getRouteProgress().statusOf
export const stopStyles = {
  collected: { color: '#ffffff', weight: 2, fillColor: '#064e32', fillOpacity: 1, radius: 7 },
  next: { color: '#ffffff', weight: 2, fillColor: '#e8920c', fillOpacity: 1, radius: 9 },
  missed: { color: '#ffffff', weight: 2, fillColor: '#c4231f', fillOpacity: 1, radius: 7 },
  pending: { color: '#17704a', weight: 2.5, fillColor: '#ffffff', fillOpacity: 1, radius: 7 },
  depot: { color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1, radius: 8 },
}

export const stopStatusLabels = {
  collected: 'Collected',
  next: 'Next stop',
  missed: 'Missed',
  pending: 'Pending',
  depot: 'Depot',
}
