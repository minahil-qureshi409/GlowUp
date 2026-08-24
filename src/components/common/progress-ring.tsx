import { cn } from '@/lib/utils';

type ProgressRingProps = {
  /** 0–100. Values outside are clamped rather than rejected. */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  children?: React.ReactNode;
  /** Screen-reader description; the ring itself is decorative without it. */
  label?: string;
  /**
   * A CSS colour for the indicator, replacing the brand gradient. Pass a
   * pillar token (`hsl(var(--sage))`) when the ring belongs to one pillar
   * rather than to the app as a whole.
   */
  stroke?: string;
};

/**
 * Circular progress.
 *
 * Drawn as SVG rather than a conic gradient so the stroke stays crisp at any
 * size and the round caps land where they should. The gradient is defined per
 * instance with a unique id, so several rings on a page don't collide.
 */
export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  className,
  trackClassName,
  indicatorClassName,
  children,
  label,
  stroke,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const gradientId = `ring-${Math.round(size)}-${Math.round(clamped)}`;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--grad-from))" />
            <stop offset="100%" stopColor="hsl(var(--grad-to))" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn('stroke-muted', trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke={stroke ?? `url(#${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-700 ease-out', indicatorClassName)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
