export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -start-40 size-96 rounded-full bg-primary/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -end-40 size-96 rounded-full bg-primary/5 blur-3xl"
      />

      <div
        dir="rtl"
        className="relative mx-auto w-full max-w-[392px] sm:max-w-[520px]"
      >
        {children}
      </div>
    </div>
  );
}
