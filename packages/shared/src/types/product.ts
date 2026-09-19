export interface Product {
  id: string;
  tenantId: string;
  medusaId: string | null;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  inventory: number;
  isDigital: boolean;
  isPublished: boolean;
  metadata: ProductMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductMetadata {
  category?: string;
  tags?: string[];
  brand?: string;
  sku?: string;
  weight?: number;
  dimensions?: string;
  relatedCourses?: string[];
  files?: { name: string; url: string }[];
}
