import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Small wide-tracked label above the title. */
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex items-start justify-between gap-4 px-1', className)}>
      <div>
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-pretty font-display text-display-md">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-prose text-[14.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div>
        <h2 className="text-[16.5px] font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
