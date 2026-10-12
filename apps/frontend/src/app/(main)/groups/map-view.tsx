'use client';
import Link from 'next/link';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet's default icon URLs are resolved relative to the stylesheet, which breaks under the
// hashed asset paths Next emits — markers render as blank squares without this.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface MapLocation {
  id: string;
  lat: number;
  lng: number;
  name: string;
  city: string | null;
  state: string | null;
}

/**
 * Marker map for `/groups`.
 *
 * Each popup carries a real `<Link>` rather than a click handler on the marker itself: a marker is
 * not keyboard focusable and announces nothing to a screen reader, so the link is what makes the
 * map usable without a mouse. The label names the destination because "View group" repeated
 * twelve times out of context is indistinguishable when tabbing through them.
 */
export default function MapView({ locations }: { locations: MapLocation[] }) {
  const center: [number, number] =
    locations.length > 0
      ? [
          locations.reduce((s, l) => s + l.lat, 0) / locations.length,
          locations.reduce((s, l) => s + l.lng, 0) / locations.length,
        ]
      : // Geometric centre of the contiguous US when there is nothing to show.
        ([39.8283, -98.5795] as [number, number]);

  return (
    <MapContainer
      center={center}
      zoom={4}
      className="h-80 w-full rounded-xl z-0"
      scrollWheelZoom={false}
      aria-label="Study groups map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc) => (
        <Marker key={loc.id} position={[loc.lat, loc.lng]}>
          <Popup>
            <strong>{loc.name}</strong>
            <br />
            {[loc.city, loc.state].filter(Boolean).join(', ')}
            <br />
            <Link href={`/groups/${loc.id}`} aria-label={`View group: ${loc.name}`}>
              View group
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
