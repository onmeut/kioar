export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-muted/40 p-6">
      {/* subtle decorative blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -start-32 size-96 rounded-full bg-primary/8 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -end-32 size-96 rounded-full bg-primary/6 blur-3xl"
      />

      <div
        dir="rtl"
        className="relative mx-auto w-full rounded-2xl border bg-card shadow-md sm:w-90"
      >
        {children}
      </div>
    </div>
  );
}
