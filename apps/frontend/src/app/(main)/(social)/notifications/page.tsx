'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, MessageCircle, UserPlus, Bell, CheckCheck } from 'lucide-react';
interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}
const typeIcons: Record<string, typeof Heart> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
};
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/proxy/notifications', { credentials: 'include' })
      .then((r) => r.json())
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const markAllRead = async () => {
    await fetch('/api/proxy/notifications/read-all', { credentials: 'include', method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };
  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        {' '}
        <Skeleton className="h-8 w-48 mb-6" />{' '}
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg mb-2" />
        ))}{' '}
      </div>
    );
  }
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {' '}
      <div className="flex items-center justify-between mb-6">
        {' '}
        <div>
          {' '}
          <h1 className="text-3xl font-bold">Notifications</h1>{' '}
          <p className="text-muted-foreground mt-1">Stay up to date with activity.</p>{' '}
        </div>{' '}
        {notifications.some((n) => !n.isRead) && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            {' '}
            <CheckCheck className="h-4 w-4 mr-1" /> Mark all read{' '}
          </Button>
        )}{' '}
      </div>{' '}
      {notifications.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          {' '}
          <Bell className="mx-auto h-12 w-12 mb-3 opacity-50" /> <p>No notifications yet.</p>{' '}
        </div>
      ) : (
        <div className="space-y-1">
          {' '}
          {notifications.map((n) => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <Card
                key={n.id}
                className={`transition-colors ${!n.isRead ? 'border-l-2 border-l-primary bg-primary/5' : ''}`}
              >
                {' '}
                <CardContent className="p-4 flex items-center gap-3">
                  {' '}
                  <div
                    className={`rounded-full p-2 ${!n.isRead ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                  >
                    {' '}
                    <Icon className="h-4 w-4" />{' '}
                  </div>{' '}
                  <div className="flex-1 min-w-0">
                    {' '}
                    <p className="text-sm">{n.title}</p>{' '}
                    <p className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>{' '}
                  </div>{' '}
                </CardContent>{' '}
              </Card>
            );
          })}{' '}
        </div>
      )}{' '}
    </div>
  );
}
function timeAgo(date: string) {
  const sec = (Date.now() - new Date(date).getTime()) / 1000;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
