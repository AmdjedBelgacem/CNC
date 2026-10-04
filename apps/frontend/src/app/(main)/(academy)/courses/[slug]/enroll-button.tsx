'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, CreditCard, LogIn } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useEnroll, useMyEnrollments } from '@/hooks/use-learning';
import { useBuyAndCheckout, usePaymentConfig } from '@/hooks/use-payments';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { trackEnroll } from '@/lib/analytics';
import { cn } from '@/lib/utils';

export function EnrollButton({
  courseId,
  courseSlug,
  className,
  isFree = false,
  priceCents = 0,
  currency = 'SAR',
}: {
  courseId: string;
  courseSlug?: string;
  className?: string;
  /** A priced course goes through the gateway; a free one enrols directly. */
  isFree?: boolean;
  priceCents?: number;
  currency?: string;
}) {
  const t = useTranslations('courses');
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { enrollments, isLoading } = useMyEnrollments(isAuthenticated);
  const enroll = useEnroll();
  const { buy, pending } = useBuyAndCheckout();
  const { data: payments } = usePaymentConfig(isAuthenticated);
  // Paid only when the course costs money AND the workspace can actually take a
  // payment. If the gateway is unconfigured we say so rather than pretending.
  const payable = !isFree && priceCents > 0 && Boolean(payments?.data?.enabled);
  const pricedButUnavailable = !isFree && priceCents > 0 && !payments?.data?.enabled;

  const enrolled = enrollments.some((e) => (e.courseId ?? e.course?.id) === courseId);

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      router.push(courseSlug ? `/login?returnUrl=${encodeURIComponent(`/courses/${courseSlug}`)}` : '/login');
      return;
    }
    if (payable) {
      try {
        // Same gateway path as the store: one order, one fulfillment, one audit trail.
        await buy([{ itemType: 'course', refId: courseId, quantity: 1 }]);
      } catch (error) {
        toast({ type: 'err', title: (error as Error)?.message ?? t('loadFailed') });
      }
      return;
    }
    if (pricedButUnavailable) {
      toast({ type: 'err', title: t('purchaseUnavailable') });
      return;
    }
    try {
      await enroll.mutateAsync(courseId);
      trackEnroll(courseId);
      toast({ type: 'ok', title: t('enrolled') });
    } catch {
      toast({ type: 'err', title: t('loadFailed') });
    }
  };

  if (enrolled) {
    return (
      <Button className={cn('w-full', className)} variant="secondary" disabled>
        <CheckCircle2 />
        {t('enrolled')}
      </Button>
    );
  }

  return (
    <Button
      className={cn('w-full', className)}
      onClick={() => void handleEnroll()}
      loading={enroll.isPending || isLoading || pending !== null}
    >
      {!isAuthenticated ? <LogIn /> : payable ? <CreditCard /> : null}
      {!isAuthenticated
        ? t('enrollToStart')
        : payable
          ? t('buyCourse', { price: `${(priceCents / 100).toFixed(2)} ${currency}` })
          : t('enroll')}
    </Button>
  );
}
