'use client';
import { useEffect, useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
// Static promo slots (brand copy only — no metrics, no guessed academy slugs).
const promos = [
  {
    text: 'New academies are live — browse courses and start learning',
    link: '/academy',
  },
  {
    text: 'Explore industry-grade CNC tools and workholding',
    link: '/products?category=Workholding',
  },
  { text: 'Join the manufacturing community', link: '/feed' },
];
export function AnnouncementBar() {
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % promos.length), 5000);
    return () => clearInterval(timer);
  }, []);
  if (dismissed) return null;
  return (
    <div className="relative border-b border-violet-800 bg-[#5b21b6] text-xs text-white">
      {' '}
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center px-12">
        {' '}
        <a
          href={promos[idx]!.link}
          className="flex items-center gap-1.5 font-semibold text-violet-50 transition-colors hover:text-white"
        >
          {' '}
          {promos[idx]!.text} <ChevronRight className="h-3 w-3" />{' '}
        </a>{' '}
        <div className="absolute right-4 flex items-center gap-2">
          {' '}
          <div className="flex gap-1.5">
            {' '}
            {promos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white'}`}
              />
            ))}{' '}
          </div>{' '}
          <button
            onClick={() => setDismissed(true)}
            className="ml-2 text-white/60 hover:text-white"
            aria-label="Dismiss announcement"
          >
            {' '}
            <X className="h-3.5 w-3.5" />{' '}
          </button>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
