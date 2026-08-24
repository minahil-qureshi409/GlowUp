/**
 * The three soft colour washes that sit behind the whole app.
 *
 * Fixed, non-interactive, and very slow — a 26-second cycle moving a few
 * percent. It is meant to register as light in a room rather than as motion,
 * and the reduced-motion rule in `globals.css` stops it dead for anyone who has
 * asked the platform for that.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        className="animate-drift-slow absolute -left-[8vw] -top-[14vh] h-[52vw] w-[52vw] rounded-full opacity-80 blur-[18px]"
        style={{
          background:
            'radial-gradient(circle at 40% 40%, hsl(var(--primary-soft)), transparent 62%)',
        }}
      />
      <div
        className="animate-drift-slower absolute -bottom-[18vh] -right-[10vw] h-[48vw] w-[48vw] rounded-full opacity-75 blur-[22px]"
        style={{
          background: 'radial-gradient(circle at 50% 50%, hsl(var(--lav-soft)), transparent 64%)',
        }}
      />
      <div
        className="animate-drift-slowest absolute right-[22vw] top-[38vh] h-[26vw] w-[26vw] rounded-full opacity-60 blur-[26px]"
        style={{
          background: 'radial-gradient(circle at 50% 50%, hsl(var(--sage-soft)), transparent 66%)',
        }}
      />
    </div>
  );
}
