import type { Config } from 'tailwindcss';

/**
 * GlowUp design system.
 *
 * Colours are declared as HSL channel triplets in `globals.css` so that a single
 * `.dark` class swaps the whole palette. Chart colours are the one exception:
 * they are stored as literal hex, because they come from a palette that was
 * validated per-mode (lightness band / chroma floor / CVD separation / contrast)
 * and must not be derived or tinted at runtime.
 *
 * Every pillar accent exists twice. `sage` fills shapes; `sage-ink` colours
 * text. Reach for the `-ink` variant the moment an accent touches a word.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        border: {
          DEFAULT: 'hsl(var(--border))',
          soft: 'hsl(var(--border-soft))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: {
          DEFAULT: 'hsl(var(--background))',
          alt: 'hsl(var(--background-alt))',
        },
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          soft: 'hsl(var(--primary-soft))',
          // The lighter rose, for ring strokes and bar fills only.
          fill: 'hsl(var(--primary-fill))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        // The third ink: eyebrows, units, inactive nav labels.
        subtle: 'hsl(var(--subtle-foreground))',
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Pillar accents. `DEFAULT` fills, `ink` writes, `soft` tints.
        sage: {
          DEFAULT: 'hsl(var(--sage))',
          ink: 'hsl(var(--sage-ink))',
          soft: 'hsl(var(--sage-soft))',
        },
        lav: {
          DEFAULT: 'hsl(var(--lav))',
          ink: 'hsl(var(--lav-ink))',
          soft: 'hsl(var(--lav-soft))',
        },
        mauve: {
          DEFAULT: 'hsl(var(--mauve))',
          ink: 'hsl(var(--mauve-ink))',
          soft: 'hsl(var(--mauve-soft))',
        },
        amber: {
          DEFAULT: 'hsl(var(--amber))',
          ink: 'hsl(var(--amber-ink))',
          soft: 'hsl(var(--amber-soft))',
        },
        coral: {
          DEFAULT: 'hsl(var(--coral))',
          ink: 'hsl(var(--coral-ink))',
        },
        gold: 'hsl(var(--gold))',
        // Domain accents — section identity, never data encoding (data uses the
        // validated `chart` scale). Aliased onto the pillar accents so a screen
        // and its pillar bar always agree.
        domain: {
          nutrition: 'hsl(var(--primary-fill))',
          workout: 'hsl(var(--sage))',
          skincare: 'hsl(var(--mauve))',
          weight: 'hsl(var(--primary-fill))',
          sleep: 'hsl(var(--lav))',
          hydration: 'hsl(var(--amber))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 10px)',
        '3xl': 'calc(var(--radius) + 18px)',
        '4xl': 'calc(var(--radius) + 26px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
      },
      fontSize: {
        // The editorial serif sizes. Tight leading and negative tracking are
        // part of the face, not a per-use decision.
        'display-xl': ['2.75rem', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
        'display-lg': ['2.25rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-md': ['1.875rem', { lineHeight: '1.12', letterSpacing: '-0.02em' }],
        'display-sm': ['1.5rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
      },
      boxShadow: {
        soft: '0 1px 2px hsl(var(--shadow-color) / var(--shadow-a1)), 0 14px 34px -16px hsl(var(--shadow-color) / var(--shadow-a2))',
        lifted:
          '0 2px 6px hsl(var(--shadow-color) / var(--shadow-a3)), 0 40px 80px -30px hsl(var(--shadow-color) / var(--shadow-a4))',
        glow: '0 0 0 1px hsl(var(--primary) / 0.10), 0 8px 30px -12px hsl(var(--primary) / 0.35)',
        // The raised pill in a segmented control.
        pill: '0 1px 3px hsl(var(--shadow-color) / 0.12)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, hsl(var(--grad-from)) 0%, hsl(var(--grad-to)) 100%)',
        'gradient-veil':
          'radial-gradient(120% 80% at 50% -10%, hsl(var(--grad-veil) / 0.55) 0%, transparent 60%)',
        // The soft diagonal wash behind hero cards.
        'gradient-card': 'linear-gradient(155deg, hsl(var(--card)) 0%, hsl(var(--accent)) 100%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        // The completion overlay: overshoots, then settles.
        pop: {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '60%': { transform: 'scale(1.06)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'check-pop': {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        // Ambient background blobs. Very slow, very small — it should read as
        // light moving, never as something asking to be looked at.
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(3%, -4%, 0) scale(1.06)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        confetti: {
          '0%': { transform: 'translate3d(0, 0, 0) rotate(0)', opacity: '1' },
          '100%': {
            transform: 'translate3d(var(--cx, 0), var(--cy, -160px), 0) rotate(var(--cr, 180deg))',
            opacity: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.4s ease both',
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        pop: 'pop 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'check-pop': 'check-pop 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        'sheet-up': 'sheet-up 0.38s cubic-bezier(0.2, 0.9, 0.2, 1) both',
        'drift-slow': 'drift 26s ease-in-out infinite',
        'drift-slower': 'drift 34s ease-in-out infinite reverse',
        'drift-slowest': 'drift 44s ease-in-out infinite',
        shimmer: 'shimmer 1.5s linear infinite',
        breathe: 'breathe 3.4s ease-in-out infinite',
        confetti: 'confetti 1.5s cubic-bezier(0.2, 0.7, 0.3, 1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
