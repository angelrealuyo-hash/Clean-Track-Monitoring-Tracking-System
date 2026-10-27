// Leaflet + OpenStreetMap map that DRAWS the tracking state it is given:
// route line, stop markers and the truck. It has no timer of its own.
import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { stopStatusLabels, stopStyles, truckIcon } from './mapIcons.js'
import { TILE_REFERRER_POLICY, tileProviders } from '../../config/mapTiles.js'
import './TrackingMap.css'

const ROUTE_PADDING = [36, 36]

// Keeps the map sized correctly when its box changes size (sidebar opening,
// phone rotation, window resize), and pauses the truck's glide animation while
// the map itself is zooming or flying so the marker does not lag behind.
function MapBehaviors() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(el)
    const startMove = () => el.classList.add('is-moving')
    const endMove = () => el.classList.remove('is-moving')
    map.on('zoomstart', startMove)
    map.on('zoomend', endMove)
    return () => {
      observer.disconnect()
      map.off('zoomstart', startMove)
      map.off('zoomend', endMove)
    }
  }, [map])
  return null
}

// Moves the view when the page asks: { type: 'truck' | 'route', id }
function MapFocus({ request, bounds, position }) {
  const map = useMap()
  const positionRef = useRef(position)

  useEffect(() => {
    positionRef.current = position
  })

  useEffect(() => {
    if (!request) return
    const pos = positionRef.current
    if (request.type === 'truck' && pos) {
      map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 17), { duration: 0.8 })
    } else {
      map.flyToBounds(bounds, { padding: ROUTE_PADDING, duration: 0.8 })
    }
  }, [request, map, bounds])

  return null
}

export default function TrackingMap({ route, state, progress, focusRequest, truckLabel, className = '' }) {
  // 'loading' until the first map tile arrives; 'error' if no provider works.
  const [tiles, setTiles] = useState('loading')
  // Which entry of tileProviders is in use. Moves to the next one if the
  // current one fails before showing any tile.
  const [providerIndex, setProviderIndex] = useState(0)
  const provider = tileProviders[providerIndex]

  const bounds = useMemo(() => L.latLngBounds(route.stops.map((s) => s.coords)), [route])
  const fullPath = useMemo(() => route.stops.map((s) => s.coords), [route])

  const truckPos = state.position ? [state.position.lat, state.position.lng] : null
  const travelledPath =
    state.status === 'idle' || !truckPos
      ? []
      : [...route.stops.slice(0, state.legIndex + 1).map((s) => s.coords), truckPos]

  // True once any tile has shown; after that, a single bad tile is ignored.
  const anyTileLoaded = useRef(false)

  const tileEvents = useMemo(
    () => ({
      tileload: () => {
        anyTileLoaded.current = true
        setTiles('ready')
      },
      tileerror: () => {
        if (anyTileLoaded.current) return
        if (providerIndex < tileProviders.length - 1) {
          // Only switch once per failing provider, even if many tiles fail.
          setProviderIndex((i) => (i === providerIndex ? i + 1 : i))
        } else {
          setTiles('error')
        }
      },
    }),
    [providerIndex],
  )

  return (
    <div className={`ct-map ${className}`}>
      <MapContainer bounds={bounds} boundsOptions={{ padding: ROUTE_PADDING }} className="ct-map__leaflet">
        <TileLayer
          key={provider.id}
          url={provider.url}
          subdomains={provider.subdomains}
          attribution={provider.attribution}
          maxZoom={provider.maxZoom}
          // Required by OpenStreetMap; see config/mapTiles.js
          referrerPolicy={TILE_REFERRER_POLICY}
          eventHandlers={tileEvents}
        />

        {/* Planned route (dashed) and the part already driven (solid). */}
        <Polyline positions={fullPath} pathOptions={{ color: '#17704a', weight: 4, opacity: 0.45, dashArray: '6 8' }} />
        {travelledPath.length > 1 && (
          <Polyline positions={travelledPath} pathOptions={{ color: '#064e32', weight: 5, opacity: 0.9 }} />
        )}

        {route.stops.map((stop, i) => {
          const status = progress.statusOf(stop)
          // The end depot sits on the start depot; skip drawing it twice.
          if (i === route.stops.length - 1 && status === 'depot') return null
          return (
            <CircleMarker key={stop.id} center={stop.coords} pathOptions={stopStyles[status]} radius={stopStyles[status].radius}>
              <Tooltip>
                <strong>{stop.name}</strong>
                <br />
                {stop.purok} · {stopStatusLabels[status]}
                {stop.households > 0 && ` · ${stop.households} households`}
              </Tooltip>
            </CircleMarker>
          )
        })}

        {truckPos && (
          <Marker position={truckPos} icon={truckIcon(state.status)} zIndexOffset={1000}>
            <Tooltip direction="top" offset={[0, -18]}>
              {truckLabel} · simulated position
            </Tooltip>
          </Marker>
        )}

        <MapBehaviors />
        <MapFocus request={focusRequest} bounds={bounds} position={state.position} />
      </MapContainer>

      {tiles === 'loading' && (
        <div className="ct-map__loading" role="status">
          Loading map…
        </div>
      )}
      {tiles === 'error' && (
        <div className="ct-map__banner" role="alert">
          The map background could not load. Check the internet connection. The route and truck are
          still shown.
        </div>
      )}
    </div>
  )
}
