import { z } from 'zod';
import { PAGE_TEMPLATES } from '../types/page';

/**
 * DTOs for page lifecycle and navigation.
 *
 * Slug *shape* is validated here with a cheap pattern; the reserved-word and
 * uniqueness checks need the database, so they live in the service. The pattern
 * exists to reject obvious junk at the edge rather than after a round trip.
 */

const slugField = z
  .string()
  .trim()
  .min(1, 'Slug is required')
  .max(100, 'Slug must be 100 characters or fewer')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');

export const createPageSchema = z.object({
  slug: slugField,
  title: z.string().trim().min(1).max(255).optional(),
  /** Chooses the starting layout. Defaults to a blank page. */
  template: z.enum(PAGE_TEMPLATES).optional(),
  showInNav: z.boolean().optional(),
  seoTitle: z.string().trim().max(255).nullish(),
  seoDescription: z.string().trim().max(500).nullish(),
  /** Copy an existing page's layout into the new one. */
  copyFromSlug: z.string().trim().max(100).optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    slug: slugField.optional(),
    /**
     * `published` requires a published version to exist; the service rejects it
     * otherwise so a page cannot claim to be live with nothing behind it.
     */
    status: z.enum(['draft', 'published', 'disabled']).optional(),
    showInNav: z.boolean().optional(),
    seoTitle: z.string().trim().max(255).nullish(),
    seoDescription: z.string().trim().max(500).nullish(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  });

export type UpdatePageInput = z.infer<typeof updatePageSchema>;

export const duplicatePageSchema = z.object({
  slug: slugField,
  title: z.string().trim().min(1).max(255).optional(),
});

export type DuplicatePageInput = z.infer<typeof duplicatePageSchema>;

/* ------------------------------------------------------------- navigation */

const navType = z.enum(['page', 'url', 'group']);

export const navItemSchema: z.ZodType<{
  id?: string;
  label: string;
  labelAr?: string | null;
  type: 'page' | 'url' | 'group';
  href?: string | null;
  pageSlug?: string | null;
  children?: unknown[];
  visible?: boolean;
  icon?: string | null;
  openInNewTab?: boolean;
}> = z.lazy(() =>
  z
    .object({
      id: z.string().uuid().optional(),
      label: z.string().trim().min(1, 'Label is required').max(120),
      labelAr: z.string().trim().max(120).nullish(),
      type: navType,
      href: z.string().trim().max(500).nullish(),
      pageSlug: z.string().trim().max(100).nullish(),
      // Typed loosely to break the self-reference; the depth cap is enforced in
      // the service, which is also where a child-of-child is flattened.
      children: z.array(z.any()).optional(),
      visible: z.boolean().optional(),
      icon: z.string().trim().max(60).nullish(),
      openInNewTab: z.boolean().optional(),
    })
    .superRefine((item, ctx) => {
      if (item.type === 'group') return;
      if (item.type === 'page' && !item.pageSlug) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pageSlug'], message: 'A page link needs a page' });
      }
      if (item.type === 'url') {
        if (!item.href) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['href'], message: 'A link needs a URL' });
        } else if (!/^(https?:\/\/|\/)/.test(item.href)) {
          // Relative and absolute paths only. `javascript:` here would be a
          // stored XSS vector rendered inside the site navbar.
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['href'],
            message: 'URL must start with / or http(s)://',
          });
        }
      }
    }),
);

export const saveNavigationSchema = z.object({
  items: z.array(navItemSchema).max(60, 'A navigation cannot have more than 60 top-level items'),
});

export type SaveNavigationInput = z.infer<typeof saveNavigationSchema>;
