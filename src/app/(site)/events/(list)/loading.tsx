export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
      <div className="mt-4 h-10 w-72 max-w-full animate-pulse rounded-md bg-secondary" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border">
            <div className="aspect-[4/3] animate-pulse bg-secondary" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
