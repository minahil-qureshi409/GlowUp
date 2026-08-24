import { AmbientBackground } from '@/components/layout/ambient-background';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-12">
      <AmbientBackground />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
