'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateGroupInput, StudyGroup } from '@/lib/groups-api';

interface FormState {
  name: string;
  description: string;
  academy: string;
  address: string;
  city: string;
  state: string;
  lat: string;
  lng: string;
  meetingSchedule: string;
  maxMembers: string;
  coverUrl: string;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  academy: '',
  address: '',
  city: '',
  state: '',
  lat: '',
  lng: '',
  meetingSchedule: '',
  maxMembers: '20',
  coverUrl: '',
};

/**
 * Create/edit form for a study group, shared by `/groups/new` and `/groups/[id]/edit`.
 *
 * Coordinates are plain text inputs rather than a map picker: they are optional, most groups only
 * need a city, and a text field that accepts `41.88, -87.63`-style values is honest about how few
 * people will fill it in. `min`/`max` on the number input do the same job as the DTO bounds.
 */
export function GroupForm({
  initial,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: StudyGroup;
  submitting?: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (input: CreateGroupInput) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const t = useTranslations('pages.groups');
  const tc = useTranslations('common');
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          name: initial.name ?? '',
          description: initial.description ?? '',
          academy: initial.academy ?? '',
          address: initial.address ?? '',
          city: initial.city ?? '',
          state: initial.state ?? '',
          lat: initial.lat != null ? String(initial.lat) : '',
          lng: initial.lng != null ? String(initial.lng) : '',
          meetingSchedule: initial.meetingSchedule ?? '',
          maxMembers: String(initial.maxMembers ?? 20),
          coverUrl: initial.coverUrl ?? '',
        }
      : EMPTY,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  // Re-seed when the group being edited changes identity (or the route is reused).
  useEffect(() => {
    if (!initial) return;
    setForm({
      name: initial.name ?? '',
      description: initial.description ?? '',
      academy: initial.academy ?? '',
      address: initial.address ?? '',
      city: initial.city ?? '',
      state: initial.state ?? '',
      lat: initial.lat != null ? String(initial.lat) : '',
      lng: initial.lng != null ? String(initial.lng) : '',
      meetingSchedule: initial.meetingSchedule ?? '',
      maxMembers: String(initial.maxMembers ?? 20),
      coverUrl: initial.coverUrl ?? '',
    });
  }, [initial?.id]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const name = form.name.trim();
    if (!name) {
      setLocalError(t('nameRequired'));
      return;
    }

    const maxMembers = Number(form.maxMembers);
    if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 500) {
      setLocalError(t('maxMembersRange'));
      return;
    }

    const lat = form.lat.trim() === '' ? undefined : Number(form.lat);
    const lng = form.lng.trim() === '' ? undefined : Number(form.lng);
    // The API rejects a half-specified point too; saying it here avoids a round trip.
    if ((lat == null) !== (lng == null)) {
      setLocalError(t('coordsPair'));
      return;
    }
    if (lat != null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
      setLocalError(t('latRange'));
      return;
    }
    if (lng != null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
      setLocalError(t('lngRange'));
      return;
    }

    const opt = (v: string) => (v.trim() ? v.trim() : undefined);

    await onSubmit({
      name,
      description: opt(form.description),
      academy: opt(form.academy),
      address: opt(form.address),
      city: opt(form.city),
      state: opt(form.state),
      meetingSchedule: opt(form.meetingSchedule),
      coverUrl: opt(form.coverUrl),
      maxMembers,
      ...(lat != null && lng != null ? { lat, lng } : {}),
    });
  }

  const shownError = localError ?? error;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="group-name">{t('nameLabel')}</Label>
          <Input
            id="group-name"
            name="name"
            value={form.name}
            onChange={set('name')}
            required
            maxLength={255}
            autoComplete="off"
            aria-describedby={shownError ? 'group-form-error' : 'group-name-hint'}
          />
          <p id="group-name-hint" className="text-xs text-muted-foreground">
            {t('nameHint')}
          </p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="group-description">{t('descriptionLabel')}</Label>
          <Textarea
            id="group-description"
            name="description"
            value={form.description}
            onChange={set('description')}
            rows={4}
            maxLength={5000}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="group-city">{t('cityLabel')}</Label>
          <Input id="group-city" name="city" value={form.city} onChange={set('city')} maxLength={100} autoComplete="address-level2" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="group-state">{t('stateLabel')}</Label>
          <Input id="group-state" name="state" value={form.state} onChange={set('state')} maxLength={100} autoComplete="address-level1" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="group-address">{t('addressLabel')}</Label>
          <Input id="group-address" name="address" value={form.address} onChange={set('address')} maxLength={500} autoComplete="street-address" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="group-schedule">{t('scheduleLabel')}</Label>
          <Input id="group-schedule" name="meetingSchedule" value={form.meetingSchedule} onChange={set('meetingSchedule')} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="group-max">{t('maxMembersLabel')}</Label>
          <Input
            id="group-max"
            name="maxMembers"
            type="number"
            inputMode="numeric"
            min={2}
            max={500}
            value={form.maxMembers}
            onChange={set('maxMembers')}
          />
          <p className="text-xs text-muted-foreground">{t('maxMembersHint')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="group-academy">{t('academyLabel')}</Label>
          <Input id="group-academy" name="academy" value={form.academy} onChange={set('academy')} maxLength={100} list="group-academy-options" />
          <datalist id="group-academy-options">
            {['cnc', 'grinding', 'swiss', 'aerospace', 'automotive', 'toolmaking', 'welding', 'composites'].map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">{t('academyHint')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="group-cover">{t('coverLabel')}</Label>
          <Input id="group-cover" name="coverUrl" value={form.coverUrl} onChange={set('coverUrl')} maxLength={500} inputMode="url" />
        </div>

        <fieldset className="space-y-2 rounded-lg border p-4 md:col-span-2">
          <legend className="px-1 text-sm font-medium">{t('coordsLegend')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="group-lat">{t('latLabel')}</Label>
              <Input id="group-lat" name="lat" value={form.lat} onChange={set('lat')} inputMode="decimal" placeholder="41.8781" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-lng">{t('lngLabel')}</Label>
              <Input id="group-lng" name="lng" value={form.lng} onChange={set('lng')} inputMode="decimal" placeholder="-87.6298" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('coordsHint')}</p>
        </fieldset>
      </div>

      {shownError && (
        <p id="group-form-error" role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {shownError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {tc('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Presentational wrapper so the create and edit pages share heading/spacing. */
export function GroupFormShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{title}</h1>
      <div className="rounded-xl border bg-card p-6">{children}</div>
    </div>
  );
}
