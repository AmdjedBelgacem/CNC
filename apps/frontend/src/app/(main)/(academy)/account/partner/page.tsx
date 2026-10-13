'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

export default function AccountPartnerPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api.get<any[]>('/partners/me').then((d) => setItems(Array.isArray(d) ? d : [])).catch(()=>{});
  }, []);
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-4">
      <h1 className="text-2xl font-bold">Partner applications</h1>
      {items.length === 0 && <p className="text-muted-foreground">No applications yet.</p>}
      {items.map((a) => (
        <div key={a.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{a.companyName}</span>
            <span className="text-xs uppercase tracking-wide">{a.status}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{a.type} · {new Date(a.createdAt).toLocaleString()}</p>
          {a.rejectionReason && <p className="mt-2 text-sm text-destructive">{a.rejectionReason}</p>}
          {a.infoRequestMessage && <p className="mt-2 text-sm">{a.infoRequestMessage}</p>}
        </div>
      ))}
    </div>
  );
}