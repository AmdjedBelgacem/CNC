/**
 * A live sponsor's name, set as a wordmark.
 *
 * The public homepage (`HomeBuilder`) and the builder canvas (`PartnerLogosBlock`)
 * each drew this span by hand, and the two drifted: production kept the old mono
 * bold while the canvas had the redesigned serif. One component, used by both.
 */
export function SponsorWordmark({ name }: { name: string }) {
  return (
    <span className="font-display text-base font-medium tracking-[-0.01em] text-foreground opacity-60 transition-opacity duration-300 hover:opacity-100 sm:text-lg">
      {name}
    </span>
  );
}
