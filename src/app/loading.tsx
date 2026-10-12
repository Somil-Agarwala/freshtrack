/**
 * Shown the instant a tab or link is tapped, while a page that has to come
 * from the server (a bag's own page) is on its way -- so a tap always
 * visibly does something.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center" role="status" aria-label="Loading">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-ink-dim" />
    </div>
  );
}
