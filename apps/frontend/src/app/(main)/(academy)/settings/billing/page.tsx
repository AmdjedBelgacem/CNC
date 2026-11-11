'use client';
import { CreditCard, Check, Zap, Crown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { HoverLift, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { SettingsHeader, SettingsSection } from '../_components/settings-ui';
export default function BillingPage() {
  const t = useTranslations('account');
  return (
    <div className="space-y-6">
      <SettingsHeader
        icon={CreditCard}
        title={t('billing.pageTitle')}
        subtitle={t('billing.pageSubtitle')}
      />
      <Reveal
        as="section"
        className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
      >
        <div className="relative overflow-hidden border-b border-border/60 bg-muted/40 px-6 py-8 sm:px-8">
          <div
            className="ambient-wash pointer-events-none absolute inset-0 opacity-70"
            aria-hidden
          />
          <div className="relative">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Crown className="size-5" />
            </div>
            <h2 className="mt-4 text-balance font-display text-2xl font-medium tracking-[-0.02em] text-foreground">
              {t('billing.upgradeToPro')}
            </h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t('billing.proSubtitle')}
            </p>
          </div>
        </div>
        <Stagger className="grid gap-4 p-6 sm:grid-cols-2">
          {[
            {
              name: t('billing.planStarter'),
              price: t('billing.planFree'),
              features: [
                t('billing.featureThreeCourses'),
                t('billing.featureCommunityAccess'),
                t('billing.featureBasicCertificates'),
              ],
              cta: t('billing.currentPlan'),
              active: true,
            },
            {
              name: t('billing.planPro'),
              price: '$29',
              suffix: t('billing.perMonth'),
              features: [
                t('billing.featureUnlimitedCourses'),
                t('billing.featureVerifiedCertificates'),
                t('billing.featureMentorship'),
                t('billing.featurePrioritySupport'),
              ],
              cta: t('billing.upgradeToPro'),
              highlight: true,
            },
          ].map((plan, index) => (
            <StaggerItem key={plan.name} index={index}>
              <HoverLift
                lift={plan.highlight ? 3 : 0}
                className={`relative h-full overflow-hidden rounded-xl border p-6 transition-shadow ${plan.highlight ? 'border-primary/40 bg-card shadow-md hover:shadow-lg' : 'border-border/70 bg-card'}`}
              >
                {plan.highlight && (
                  <div className="absolute end-4 top-4 rounded-full bg-primary/10 px-2.5 py-0.5 text-2xs font-medium text-primary">
                    {t('billing.popular')}
                  </div>
                )}
                <h3 className="text-sm font-medium text-muted-foreground">{plan.name}</h3>
                <p className="mt-1.5 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-medium tracking-[-0.02em] text-foreground">
                    {plan.price}
                  </span>
                  {plan.suffix && (
                    <span className="text-sm text-muted-foreground">{plan.suffix}</span>
                  )}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-foreground/90">
                      <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                        <Check className="size-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full rounded-full"
                  variant={plan.highlight ? 'default' : 'outline'}
                  disabled={plan.active || plan.highlight}
                >
                  {plan.highlight ? t('billing.comingSoon') : plan.cta}
                </Button>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
        <div className="border-t border-border/60 px-6 py-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="size-3.5 text-primary" /> {t('billing.stripeNote')}
          </p>
        </div>
      </Reveal>
      <SettingsSection icon={CreditCard} title={t('billing.invoices')} delay={0.05}>
        <div className="py-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <CreditCard className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-3 font-display text-base font-medium text-foreground">
            {t('billing.noInvoices')}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('billing.noInvoicesHint')}</p>
        </div>
      </SettingsSection>
    </div>
  );
}
