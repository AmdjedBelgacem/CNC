'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCarousel } from '@/components/store/product-carousel';
import { useCartStore } from '@/stores/cart-store';
import { ShoppingCart, AlertTriangle, Check, Package } from 'lucide-react';
import type { Product, ProductVariant } from '@/components/store/product-card';
export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  useEffect(() => {
    fetch(`/api/proxy/products/${slug}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setProduct)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        {' '}
        <div className="grid gap-12 lg:grid-cols-2">
          {' '}
          <Skeleton className="aspect-square rounded-xl" />{' '}
          <div className="space-y-4">
            {' '}
            <Skeleton className="h-8 w-2/3" /> <Skeleton className="h-4 w-1/3" />{' '}
            <Skeleton className="h-24 w-full" />{' '}
          </div>{' '}
        </div>{' '}
      </div>
    );
  }
  if (!product) {
    return (
      <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">
        {' '}
        Product not found.{' '}
      </div>
    );
  }
  const displayPrice = selectedVariant?.price ?? product.price;
  const outOfStock =
    (selectedVariant?.inventory ?? product.inventory ?? 0) <= 0 &&
    !(selectedVariant?.allowBackorder ?? product.allowBackorder);
  const backorder =
    (selectedVariant?.inventory ?? product.inventory ?? 0) <= 0 &&
    (selectedVariant?.allowBackorder ?? product.allowBackorder);
  return (
    <div className="container mx-auto px-4 py-12">
      {' '}
      <div className="grid gap-12 lg:grid-cols-2">
        {' '}
        <div className="aspect-square rounded-xl bg-muted overflow-hidden relative">
          {' '}
          {product.thumbnailUrl ? (
            <img
              src={product.thumbnailUrl}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {' '}
              <Package className="h-24 w-24 opacity-20" />{' '}
            </div>
          )}{' '}
        </div>{' '}
        <div className="space-y-6">
          {' '}
          <div>
            {' '}
            <div className="flex items-center gap-2 mb-2">
              {' '}
              {product.category && <Badge variant="secondary">{product.category}</Badge>}{' '}
              {product.isDigital && <Badge variant="secondary">Digital</Badge>}{' '}
              {backorder && (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Backorder — ships in {product.backorderLeadDays ?? 7} days
                </Badge>
              )}{' '}
            </div>{' '}
            <h1 className="text-3xl font-bold">{product.title}</h1>{' '}
            {product.tagline && (
              <p className="text-lg text-muted-foreground mt-1">{product.tagline}</p>
            )}{' '}
          </div>{' '}
          <div className="flex items-baseline gap-3">
            {' '}
            <span className="text-3xl font-bold">
              {' '}
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: product.currency || 'USD',
              }).format(displayPrice / 100)}{' '}
            </span>{' '}
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-lg text-muted-foreground line-through">
                {' '}
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: product.currency || 'USD',
                }).format(product.compareAtPrice / 100)}{' '}
              </span>
            )}{' '}
          </div>{' '}
          {product.variants && product.variants.length > 0 && (
            <div>
              {' '}
              <h3 className="font-semibold mb-2">Options</h3>{' '}
              <div className="flex flex-wrap gap-2">
                {' '}
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${selectedVariant?.id === v.id ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/50'}`}
                  >
                    {' '}
                    {v.title}{' '}
                    {v.price && v.price !== product.price && (
                      <span className="ml-2 text-muted-foreground">
                        {' '}
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: product.currency || 'USD',
                        }).format(v.price / 100)}{' '}
                      </span>
                    )}{' '}
                  </button>
                ))}{' '}
              </div>{' '}
            </div>
          )}{' '}
          {product.description && (
            <div>
              {' '}
              <h3 className="font-semibold mb-2">Description</h3>{' '}
              <p className="text-muted-foreground whitespace-pre-line">
                {product.description}
              </p>{' '}
            </div>
          )}{' '}
          {product.features && product.features.length > 0 && (
            <div>
              {' '}
              <h3 className="font-semibold mb-2">Features</h3>{' '}
              <ul className="space-y-2">
                {' '}
                {product.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    {' '}
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {f}{' '}
                  </li>
                ))}{' '}
              </ul>{' '}
            </div>
          )}{' '}
          <div className="flex gap-3">
            {' '}
            <Button
              size="lg"
              className="flex-1"
              disabled={outOfStock}
              onClick={() =>
                addItem({
                  productId: product.slug,
                  title: product.title,
                  price: displayPrice,
                  thumbnailUrl: product.thumbnailUrl,
                })
              }
            >
              {' '}
              <ShoppingCart className="mr-2 h-5 w-5" />{' '}
              {outOfStock ? 'Out of Stock' : backorder ? 'Pre-order Now' : 'Add to Cart'}{' '}
            </Button>{' '}
          </div>{' '}
          {backorder && (
            <p className="text-sm text-amber-600 flex items-center gap-2">
              {' '}
              <AlertTriangle className="h-4 w-4" /> This item is on backorder and will ship within{' '}
              {product.backorderLeadDays ?? 7} business days.{' '}
            </p>
          )}{' '}
        </div>{' '}
      </div>{' '}
      <ProductCarousel endpoint={`related/${product.id}`} title="Related Products" />{' '}
    </div>
  );
}
