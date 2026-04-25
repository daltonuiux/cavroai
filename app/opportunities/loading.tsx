export default function Loading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-[22px] w-36 rounded bg-foreground/8 animate-pulse" />
        <div className="mt-1.5 h-3 w-56 rounded bg-foreground/5 animate-pulse" />
      </div>
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card-cavro rounded-md px-4 py-3 animate-pulse">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-3.5 w-28 rounded bg-foreground/8" />
              <div className="h-3 w-8 rounded bg-foreground/5" />
              <div className="h-3 w-16 rounded bg-foreground/5" />
            </div>
            <div className="h-3 w-3/4 rounded bg-foreground/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
