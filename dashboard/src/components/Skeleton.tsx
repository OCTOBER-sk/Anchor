/**
 * Skeleton loading block — frontend.md §4.4. Matches the shape of the
 * eventual content: bg-sunken, pulse animation. List data never shows a
 * bare spinner; skeletons are reserved for exactly this.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-control bg-bg-sunken ${className ?? ''}`} />;
}
