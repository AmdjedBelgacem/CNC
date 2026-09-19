'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
export function MessageButton({ peerId, peerName }: { peerId: string; peerName?: string | null }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  if (!user || user.id === peerId) return null;
  const handleMessage = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/dm/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed (${res.status})`);
      }
      const conv = await res.json();
      router.push(`/messages?focus=${conv.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleMessage}
      disabled={loading}
      title={peerName ? `Message ${peerName}` : 'Message'}
    >
      {' '}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}{' '}
      <span className="ml-1">Message</span>{' '}
    </Button>
  );
}
