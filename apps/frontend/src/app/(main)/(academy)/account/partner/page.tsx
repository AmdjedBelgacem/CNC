'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Stagger, StaggerItem } from '@/components/ui/motion';

export default function AccountPartnerPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api
      .get<any[]>('/partners/me')
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-12 md:py-16">
      <h1 className="font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
        Partner applications
      </h1>
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-muted-foreground">
          No applications yet.
        </p>
      )}
      <Stagger className="space-y-3">
        {items.map((a, index) => (
          <StaggerItem
            key={a.id}
            index={index}
            className="rounded-xl border border-border/70 bg-card p-5 shadow-xs"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-lg font-medium text-foreground">
                {a.companyName}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                {a.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {a.type} · {new Date(a.createdAt).toLocaleString()}
            </p>
            {a.rejectionReason && (
              <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {a.rejectionReason}
              </p>
            )}
            {a.infoRequestMessage && (
              <p className="mt-3 rounded-lg bg-info/10 px-3 py-2 text-sm text-foreground">
                {a.infoRequestMessage}
              </p>
            )}
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
