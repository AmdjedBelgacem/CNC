'use client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet'; // Fix default marker icon delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});
interface Location {
  lat: number;
  lng: number;
  name: string;
  city: string | null;
  state: string | null;
}
export default function MapView({ locations }: { locations: Location[] }) {
  const center: [number, number] =
    locations.length > 0
      ? [
          locations.reduce((s, l) => s + l.lat, 0) / locations.length,
          locations.reduce((s, l) => s + l.lng, 0) / locations.length,
        ]
      : [39.8283, -98.5795];
  return (
    <MapContainer
      center={center}
      zoom={4}
      className="h-80 w-full rounded-xl z-0"
      scrollWheelZoom={false}
    >
      {' '}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />{' '}
      {locations.map((loc, i) => (
        <Marker key={i} position={[loc.lat, loc.lng]}>
          {' '}
          <Popup>
            {' '}
            <strong>{loc.name}</strong>
            <br /> {[loc.city, loc.state].filter(Boolean).join(', ')}{' '}
          </Popup>{' '}
        </Marker>
      ))}{' '}
    </MapContainer>
  );
}
