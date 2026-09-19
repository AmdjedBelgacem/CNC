'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Phone, Globe, Star, Wrench } from 'lucide-react';
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });
import 'leaflet/dist/leaflet.css';
interface RepairShop {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  address: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  specialties: string[] | null;
  rating: number | null;
  isVerified: boolean;
  logoUrl: string | null;
}
const categories = [
  'All',
  'CNC Repair',
  'Electrical',
  'Mechanical',
  'Hydraulics',
  'Service & Calibration',
];
export default function RepairPage() {
  const [shops, setShops] = useState<RepairShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedShop, setSelectedShop] = useState<RepairShop | null>(null);
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    if (search) params.set('search', search);
    fetch(`/api/proxy/repair?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => setShops(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, search]);
  const hasMapData = shops.some((s) => s.lat && s.lng);
  return (
    <div className="container mx-auto px-4 py-8">
      {' '}
      <div className="mb-6">
        {' '}
        <h1 className="text-3xl font-bold">Machine Repair Directory</h1>{' '}
        <p className="text-muted-foreground mt-1">Find CNC repair services near you.</p>{' '}
      </div>{' '}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {' '}
        <div className="flex gap-2 flex-wrap">
          {' '}
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${category === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`}
            >
              {' '}
              {cat}{' '}
            </button>
          ))}{' '}
        </div>{' '}
        <input
          type="search"
          placeholder="Search by name or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto px-4 py-2 rounded-lg border bg-background text-sm w-full sm:w-64"
        />{' '}
      </div>{' '}
      <div className="grid gap-6 lg:grid-cols-5">
        {' '}
        <div className="lg:col-span-2 space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          {' '}
          {loading ? (
            [1, 2, 3].map((i) => (
              <Card key={i}>
                {' '}
                <CardContent className="p-4 space-y-2">
                  {' '}
                  <Skeleton className="h-5 w-2/3" /> <Skeleton className="h-4 w-1/2" />{' '}
                  <Skeleton className="h-4 w-3/4" />{' '}
                </CardContent>{' '}
              </Card>
            ))
          ) : shops.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {' '}
              <Wrench className="mx-auto h-10 w-10 mb-2 opacity-50" />{' '}
              <p>No repair shops found.</p>{' '}
            </div>
          ) : (
            shops.map((shop) => (
              <Card
                key={shop.id}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedShop?.id === shop.id ? 'border-primary' : ''}`}
                onClick={() => setSelectedShop(shop)}
              >
                {' '}
                <CardContent className="p-4">
                  {' '}
                  <div className="flex items-start justify-between">
                    {' '}
                    <div>
                      {' '}
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        {' '}
                        {shop.name}{' '}
                        {shop.isVerified && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 text-green-600 border-green-400"
                          >
                            Verified
                          </Badge>
                        )}{' '}
                      </h3>{' '}
                      {shop.category && (
                        <Badge variant="secondary" className="text-[10px] mt-1">
                          {shop.category}
                        </Badge>
                      )}{' '}
                    </div>{' '}
                    {shop.rating && (
                      <span className="flex items-center gap-1 text-sm font-medium">
                        {' '}
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{' '}
                        {shop.rating}{' '}
                      </span>
                    )}{' '}
                  </div>{' '}
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    {' '}
                    <MapPin className="h-3 w-3 shrink-0" />{' '}
                    {shop.city
                      ? `${shop.city}${shop.state ? `, ${shop.state}` : ''}`
                      : shop.address}{' '}
                  </p>{' '}
                  {shop.specialties && shop.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {' '}
                      {shop.specialties.slice(0, 3).map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px] px-1.5">
                          {s}
                        </Badge>
                      ))}{' '}
                      {shop.specialties.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{shop.specialties.length - 3}
                        </span>
                      )}{' '}
                    </div>
                  )}{' '}
                  {shop.phone && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      {' '}
                      <Phone className="h-3 w-3" /> {shop.phone}{' '}
                    </p>
                  )}{' '}
                </CardContent>{' '}
              </Card>
            ))
          )}{' '}
        </div>{' '}
        <div className="lg:col-span-3">
          {' '}
          <div className="rounded-xl border overflow-hidden bg-muted h-[400px] lg:h-[70vh]">
            {' '}
            {hasMapData ? (
              <MapContainer
                center={[39.8283, -98.5795]}
                zoom={4}
                className="h-full w-full"
                scrollWheelZoom={false}
              >
                {' '}
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{' '}
                {shops
                  .filter((s) => s.lat && s.lng)
                  .map((shop) => (
                    <Marker key={shop.id} position={[shop.lat!, shop.lng!]}>
                      {' '}
                      <Popup>
                        {' '}
                        <strong>{shop.name}</strong> {shop.phone && <br />}{' '}
                        {shop.phone && <span>{shop.phone}</span>}{' '}
                      </Popup>{' '}
                    </Marker>
                  ))}{' '}
              </MapContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {' '}
                <MapPin className="h-8 w-8 mr-2 opacity-50" /> No map data available{' '}
              </div>
            )}{' '}
          </div>{' '}
          {selectedShop && (
            <Card className="mt-4">
              {' '}
              <CardHeader>
                {' '}
                <CardTitle className="text-lg">{selectedShop.name}</CardTitle>{' '}
              </CardHeader>{' '}
              <CardContent className="space-y-2 text-sm">
                {' '}
                <p className="text-muted-foreground">{selectedShop.description}</p>{' '}
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" /> {selectedShop.address}
                </div>{' '}
                {selectedShop.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4 text-muted-foreground" /> {selectedShop.phone}
                  </div>
                )}{' '}
                {selectedShop.website && (
                  <div className="flex items-center gap-1">
                    {' '}
                    <Globe className="h-4 w-4 text-muted-foreground" />{' '}
                    <a
                      href={selectedShop.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {selectedShop.website}
                    </a>{' '}
                  </div>
                )}{' '}
                {selectedShop.specialties && selectedShop.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {' '}
                    {selectedShop.specialties.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}{' '}
                  </div>
                )}{' '}
              </CardContent>{' '}
            </Card>
          )}{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
