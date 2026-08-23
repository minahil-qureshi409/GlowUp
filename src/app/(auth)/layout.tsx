export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-veil"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}
