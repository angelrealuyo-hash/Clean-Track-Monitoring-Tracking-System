import { useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPinPlus } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import { TILE_REFERRER_POLICY, tileProviders } from '../../../config/mapTiles.js'
import { isCollectionStop } from '../../../services/trackingSimulation.js'
import '../../../components/map/TrackingMap.css'
import './AddStopModal.css'

const pin = L.divIcon({ className: 'add-stop-pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] })

function ClickToPlace({ onPick }) {
  useMapEvents({ click: (e) => onPick([Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]) })
  return null
}

// Add a pickup point: name, purok, households, and its place on the map
// (click the map). Coordinates are as accurate as the click; verify on site.
export default function AddStopModal({ route, puroks, onSave, onClose }) {
  const pickups = route.stops.filter(isCollectionStop)
  const [form, setForm] = useState({ name: '', purok: puroks[0], households: '20', afterId: pickups.at(-1)?.id ?? route.stops[0].id })
  const [coords, setCoords] = useState(null)
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const bounds = useMemo(() => L.latLngBounds(route.stops.map((s) => s.coords)).pad(0.3), [route])
  const provider = tileProviders[0]

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.name.trim().length < 3) errs.name = 'Enter a name people will recognise (e.g. a street corner).'
    const households = Number(form.households)
    if (!Number.isInteger(households) || households < 1 || households > 500) errs.households = 'Enter 1 to 500 households.'
    if (!coords) errs.coords = 'Click the map where the truck should stop.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({ name: form.name.trim(), purok: form.purok, households, coords, afterId: form.afterId })
  }

  return (
    <Modal
      title="Add Pickup Point"
      subtitle="Where residents bring their garbage bags"
      icon={MapPinPlus}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="add-stop-form" className="ct-btn ct-btn--primary">
            Add to Route
          </button>
        </>
      }
    >
      <form id="add-stop-form" onSubmit={submit} noValidate>
        <Field label="Pickup point name" htmlFor="as-name" required error={errors.name}>
          <input id="as-name" className="ct-input" placeholder="e.g. Sampaguita St. corner" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
        </Field>
        <div className="ct-form-grid">
          <Field label="Purok" htmlFor="as-purok">
            <select id="as-purok" className="ct-input" value={form.purok} onChange={set('purok')}>
              {puroks.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Households (approx.)" htmlFor="as-hh" required error={errors.households}>
            <input id="as-hh" className="ct-input" type="number" min="1" max="500" value={form.households} onChange={set('households')} aria-invalid={!!errors.households} />
          </Field>
        </div>
        <Field label="Comes after" htmlFor="as-after" hint="Position in the driving order.">
          <select id="as-after" className="ct-input" value={form.afterId} onChange={set('afterId')}>
            {route.stops.slice(0, -1).map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="ct-field">
          <span className="ct-label">Location *</span>
          <div className="ct-map add-stop-map">
            <MapContainer bounds={bounds} className="ct-map__leaflet" scrollWheelZoom>
              <TileLayer url={provider.url} attribution={provider.attribution} maxZoom={provider.maxZoom} referrerPolicy={TILE_REFERRER_POLICY} />
              <Polyline positions={route.stops.map((s) => s.coords)} pathOptions={{ color: '#17704a', weight: 3, opacity: 0.5, dashArray: '6 8' }} />
              {route.stops.map((s) => (
                <CircleMarker key={s.id} center={s.coords} radius={5} pathOptions={{ color: '#17704a', fillColor: '#fff', fillOpacity: 1, weight: 2 }} />
              ))}
              {coords && <Marker position={coords} icon={pin} />}
              <ClickToPlace onPick={(c) => { setCoords(c); setErrors((er) => ({ ...er, coords: undefined })) }} />
            </MapContainer>
          </div>
          {errors.coords ? (
            <span className="ct-field__error" role="alert">{errors.coords}</span>
          ) : (
            <span className="ct-field__hint">
              {coords ? `Selected: ${coords[0]}, ${coords[1]}` : 'Click the map to place the pickup point.'} Demo map: confirm locations on site.
            </span>
          )}
        </div>
      </form>
    </Modal>
  )
}
