'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RepairShopsLoading } from '@/components/skeletons/public-page-replicas';
import { rememberListCount } from '@/lib/admin-shape-memory';
import { MapPin, Phone, Globe, Search, Star, Wrench } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { ActivePill } from '@/components/feed/feed-motion';
import { spring, transition } from '@/lib/motion';
import { cn } from '@/lib/utils';
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
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
  const t = useTranslations('pages.socialRepair');
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('settings');
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
      .then((res) => {
        const rows: RepairShop[] = res.data || [];
        setShops(rows);
        // The skeleton draws the unfiltered list, so only that one is recorded.
        if (category === 'All' && !search) rememberListCount('public-repair', rows.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, search]);
  const hasMapData = shops.some((s) => s.lat && s.lng);
  // `categories` doubles as the API filter value and as the button label, so the
  // literals stay untouched: they are what `?category=` is compared against. Only
  // the rendered label is localized, keyed by the same value.
  const categoryLabels: Record<string, string> = {
    All: tCommon('all'),
    'CNC Repair': t('catCncRepair'),
    Electrical: t('catElectrical'),
    Mechanical: t('catMechanical'),
    Hydraulics: t('catHydraulics'),
    'Service & Calibration': t('catServiceCalibration'),
  };
  return (
    <div className="container mx-auto px-4 py-10 md:py-14">
      <Reveal className="mb-8 max-w-2xl">
        <h1 className="text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground md:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">{t('subtitle')}</p>
      </Reveal>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
              className={cn(
                'relative rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                category === cat
                  ? 'border-transparent text-primary'
                  : 'border-border/70 bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
              )}
            >
              {category === cat && (
                <ActivePill layoutId="repair-category-pill" className="bg-primary/10 shadow-none ring-primary/25" />
              )}
              <span className="relative">{categoryLabels[cat] ?? cat}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:ms-auto sm:w-64">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pe-2 lg:col-span-2">
          {loading ? (
            <RepairShopsLoading />
          ) : shops.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/60 py-14 text-center text-muted-foreground">
              <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted">
                <Wrench className="size-5" />
              </span>
              <p className="font-display text-lg font-medium text-foreground">{t('noShops')}</p>
            </div>
          ) : (
            <Stagger className="space-y-3">
              {shops.map((shop, i) => (
                <StaggerItem key={shop.id} index={i}>
                  <Card
                    className={cn(
                      'cursor-pointer rounded-xl shadow-xs transition-[border-color,box-shadow] duration-300 hover:shadow-md',
                      selectedShop?.id === shop.id
                        ? 'border-primary/50 ring-1 ring-primary/20'
                        : 'border-border/70 hover:border-border',
                    )}
                    onClick={() => setSelectedShop(shop)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="flex flex-wrap items-center gap-2 font-display text-base font-medium tracking-[-0.01em] text-foreground">
                            {shop.name}
                            {shop.isVerified && (
                              <Badge variant="outline" className="border-success/30 bg-success/10 text-2xs text-success">
                                {tSettings('verified')}
                              </Badge>
                            )}
                          </h3>
                          {shop.category && (
                            <Badge variant="soft-muted" className="mt-1.5 text-2xs">
                              {shop.category}
                            </Badge>
                          )}
                        </div>
                        {shop.rating && (
                          <span className="flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums">
                            <Star className="size-3.5 fill-warning text-warning" />
                            {shop.rating}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" />
                        {shop.city
                          ? `${shop.city}${shop.state ? `, ${shop.state}` : ''}`
                          : shop.address}
                      </p>
                      {shop.specialties && shop.specialties.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {shop.specialties.slice(0, 3).map((s) => (
                            <Badge key={s} variant="outline" className="text-2xs">
                              {s}
                            </Badge>
                          ))}
                          {shop.specialties.length > 3 && (
                            <span className="text-2xs text-muted-foreground">
                              +{shop.specialties.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      {shop.phone && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="size-3.5" /> {shop.phone}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
        <div className="lg:col-span-3">
          <div className="h-[400px] overflow-hidden rounded-2xl border border-border/70 bg-muted shadow-xs lg:h-[70vh]">
            {hasMapData ? (
              <MapContainer
                center={[39.8283, -98.5795]}
                zoom={4}
                className="h-full w-full"
                scrollWheelZoom={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {shops
                  .filter((s) => s.lat && s.lng)
                  .map((shop) => (
                    <Marker key={shop.id} position={[shop.lat!, shop.lng!]}>
                      <Popup>
                        <strong>{shop.name}</strong> {shop.phone && <br />}
                        {shop.phone && <span>{shop.phone}</span>}
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <MapPin className="me-2 size-6 opacity-50" /> {t('noMapData')}
              </div>
            )}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {selectedShop && (
              <m.div
                key={selectedShop.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: spring.gentle }}
                exit={{ opacity: 0, y: -4, transition: transition.leave }}
              >
                <Card className="mt-4 rounded-xl border-border/70 shadow-sm">
                  <CardHeader>
                    <CardTitle className="font-display text-xl font-medium tracking-[-0.015em]">
                      {selectedShop.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-sm">
                    <p className="leading-relaxed text-muted-foreground">{selectedShop.description}</p>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-4 text-muted-foreground" /> {selectedShop.address}
                    </div>
                    {selectedShop.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="size-4 text-muted-foreground" /> {selectedShop.phone}
                      </div>
                    )}
                    {selectedShop.website && (
                      <div className="flex items-center gap-1.5">
                        <Globe className="size-4 text-muted-foreground" />
                        <a
                          href={selectedShop.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {selectedShop.website}
                        </a>
                      </div>
                    )}
                    {selectedShop.specialties && selectedShop.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {selectedShop.specialties.map((s) => (
                          <Badge key={s} variant="soft-muted">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
