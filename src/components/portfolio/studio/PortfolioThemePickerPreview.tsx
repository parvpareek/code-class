import { cn } from '@/lib/utils';
import type { PortfolioThemeOption } from '@/lib/portfolioThemes/registry';

type Layout = 'trigger' | 'menu' | 'command';

type Props = {
  opt: PortfolioThemeOption;
  layout: Layout;
  className?: string;
};

/**
 * Theme preview block: surface + text colors match the public portfolio identity,
 * with a vertical accent stripe (same idea as theme tokens).
 */
export function PortfolioThemePickerPreview({ opt, layout, className }: Props) {
  const { picker: c } = opt;
  const showDescription = layout !== 'trigger' && Boolean(opt.description);

  return (
    <div
      className={cn(
        'flex w-full min-w-0 overflow-hidden rounded-md border shadow-sm',
        layout === 'trigger' && 'min-h-7 items-stretch',
        layout === 'menu' && 'min-h-[3.25rem]',
        layout === 'command' && 'min-h-11',
        className
      )}
      style={{
        backgroundColor: c.surface,
        borderColor: c.border,
        color: c.text,
      }}
    >
      <div className="w-1 shrink-0 self-stretch" style={{ backgroundColor: c.accent }} aria-hidden />
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col justify-center',
          layout === 'trigger' ? 'px-2 py-1' : 'px-2.5 py-2'
        )}
      >
        <span
          className={cn(
            'truncate font-semibold leading-tight',
            layout === 'trigger' ? 'text-xs' : 'text-sm'
          )}
        >
          {opt.label}
        </span>
        {showDescription ? (
          <span className="mt-0.5 truncate text-[11px] leading-snug" style={{ color: c.muted }}>
            {opt.description}
          </span>
        ) : null}
      </div>
    </div>
  );
}
