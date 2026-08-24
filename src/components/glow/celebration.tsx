'use client';

import * as React from 'react';

const COLORS = [
  'hsl(var(--primary-fill))',
  'hsl(var(--sage))',
  'hsl(var(--lav))',
  'hsl(var(--gold))',
  'hsl(var(--mauve))',
];

const PIECES = 26;

/**
 * A one-shot confetti burst.
 *
 * Rendered only when `fireKey` changes, and it removes itself after the
 * animation. Purely decorative and `aria-hidden`: nothing here carries meaning
 * that is not also stated in the toast or the card behind it, and the
 * reduced-motion rule in `globals.css` collapses it to nothing for anyone who
 * has asked the platform to hold still.
 */
export function Celebration({ fireKey }: { fireKey: number }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (fireKey === 0) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1900);
    return () => clearTimeout(timer);
  }, [fireKey]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex h-0 justify-center"
    >
      {Array.from({ length: PIECES }).map((_, i) => (
        <span
          key={`${fireKey}-${i}`}
          className="animate-confetti absolute"
          style={
            {
              width: i % 3 ? 7 : 5,
              height: i % 3 ? 7 : 10,
              borderRadius: i % 2 ? '50%' : '2px',
              background: COLORS[i % COLORS.length],
              animationDelay: `${(i % 6) * 0.04}s`,
              '--cx': `${(i - PIECES / 2) * 13}px`,
              '--cy': `${-110 - (i % 7) * 34}px`,
              '--cr': `${(i % 2 ? 1 : -1) * (180 + i * 12)}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
