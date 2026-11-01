'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import type { Product } from '@/components/store/product-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getImageSrc } from '@/lib/images';
import { coerceCurrency, formatMinorUnits } from '@/lib/money';
import { cardPrice } from '@/lib/product-pricing';
import { Stagger, StaggerItem } from '@/components/ui/motion';

export function CourseProductsSidebar({
  tags,
  courseId,
  academyId,
}: {
  tags?: string[];
  courseId?: string;
  academyId?: string;
}) {
  const t = useTranslations('ui.courseProductsSidebar');
  const tp = useTranslations('products');
  const locale = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    let url: string;
    if (courseId) {
      url = `/api/proxy/products?courseId=${courseId}&limit=3`;
    } else if (academyId) {
      url = `/api/proxy/products?academyId=${academyId}&limit=3`;
    } else if (tags?.length) {
      url = `/api/proxy/products/by-tags?tags=${tags.join(',')}&limit=3`;
    } else {
      url = `/api/proxy/products/featured?limit=3`;
    }
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setProducts(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, [tags, courseId, academyId]);
  if (products.length === 0) return null;
  return (
    <Card className="rounded-2xl border-border/70 shadow-xs">
      <CardHeader className="pb-3">
        <p className="eyebrow text-xs">{t('storeEyebrow')}</p>
        <CardTitle className="font-display text-lg font-medium tracking-[-0.015em]">
          {t('recommendedTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Stagger className="-mx-2 space-y-1">
          {products.map((p, i) => {
            const unit = cardPrice(p);
            return (
              <StaggerItem key={p.id} index={i}>
              <Link
                href={`/products/${p.slug}`}
                className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/60"
              >
                <div className="aspect-square w-14 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageSrc(p.thumbnailUrl, 'product')}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {p.title}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {unit == null
                      ? tp('priceOnRequest')
                      : formatMinorUnits(unit, coerceCurrency(p.currency, 'USD'), locale)}
                  </p>
                </div>
              </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
        <Link
          href="/products"
          className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('viewAllTools')}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
