'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';

export default function AdminPartnersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('all');
  const load = () => {
    const q = status !== 'all' ? `?status=${status}` : '';
    api.get<any>(`/admin/partners/applications${q}`).then((d) => setItems(Array.isArray(d?.items) ? d.items : [])).catch((e)=>toast({type:'err',title:e?.message}));
  };
  useEffect(load, [status]);
  const act = async (id: string, action: 'approve'|'reject'|'request-info', payload?: any) => {
    try {
      await api.post(`/admin/partners/applications/${id}/${action}`, payload ?? {});
      toast({ type: 'ok', title: 'Done' });
      load();
    } catch (e: any) {
      toast({ type: 'err', title: e?.message });
    }
  };
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-4">
      <h1 className="text-2xl font-bold">Partner applications</h1>
      <select className="rounded-lg border border-border bg-background px-3 py-2" value={status} onChange={(e)=>setStatus(e.target.value)}>
        <option value="all">All</option>
        <option value="pending">Pending</option>
        <option value="under_review">Under review</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="needs_info">Needs info</option>
      </select>
      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{a.companyName}</span>
              <span className="text-xs uppercase">{a.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">{a.contactName} · {a.email} · {a.type}</p>
            <p className="text-sm">{a.message}</p>
            <div className="flex gap-2">
              <button className="rounded-lg border border-border px-3 py-1.5 text-xs" onClick={()=>act(a.id,'approve',{})}>Approve</button>
              <button className="rounded-lg border border-border px-3 py-1.5 text-xs" onClick={()=>{const r=prompt('Reason'); if(r) act(a.id,'reject',{reason:r});}}>Reject</button>
              <button className="rounded-lg border border-border px-3 py-1.5 text-xs" onClick={()=>{const m=prompt('Message'); if(m) act(a.id,'request-info',{message:m});}}>Request info</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}