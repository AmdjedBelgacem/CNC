import { Button } from '@/components/ui/button';
import { Youtube, Facebook, Smartphone } from 'lucide-react';
export function SocialCtas() {
  return (
    <section className="border-t py-24 bg-secondary/20">
      {' '}
      <div className="container mx-auto px-4">
        {' '}
        <div className="grid gap-8 md:grid-cols-3">
          {' '}
          <div className="rounded-xl border bg-card p-8 text-center hover:border-primary/50 transition-colors">
            {' '}
            <Smartphone className="h-10 w-10 mx-auto mb-4 text-primary" />{' '}
            <h3 className="font-bold text-lg mb-2">MFG Connect App</h3>{' '}
            <p className="text-sm text-muted-foreground mb-4">
              Take the community with you. Available on iOS and Android.
            </p>{' '}
            <div className="flex justify-center gap-3">
              {' '}
              <Button variant="outline" size="sm" asChild>
                <a href="#">App Store</a>
              </Button>{' '}
              <Button variant="outline" size="sm" asChild>
                <a href="#">Google Play</a>
              </Button>{' '}
            </div>{' '}
          </div>{' '}
          <div className="rounded-xl border bg-card p-8 text-center hover:border-red-500/50 transition-colors">
            {' '}
            <Youtube className="h-10 w-10 mx-auto mb-4 text-red-500" />{' '}
            <h3 className="font-bold text-lg mb-2">Subscribe on YouTube</h3>{' '}
            <p className="text-sm text-muted-foreground mb-4">
              2.2B+ video views and counting. Join millions learning CNC.
            </p>{' '}
            <Button variant="outline" size="sm" asChild>
              {' '}
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer">
                <Youtube className="h-4 w-4 mr-1" /> Subscribe
              </a>{' '}
            </Button>{' '}
          </div>{' '}
          <div className="rounded-xl border bg-card p-8 text-center hover:border-violet-500/50 transition-colors">
            {' '}
            <Facebook className="h-10 w-10 mx-auto mb-4 text-violet-500" />{' '}
            <h3 className="font-bold text-lg mb-2">Join the Facebook Group</h3>{' '}
            <p className="text-sm text-muted-foreground mb-4">
              Connect with 94,000+ machinists worldwide.
            </p>{' '}
            <Button variant="outline" size="sm" asChild>
              {' '}
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
                <Facebook className="h-4 w-4 mr-1" /> Join Free
              </a>{' '}
            </Button>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
    </section>
  );
}
