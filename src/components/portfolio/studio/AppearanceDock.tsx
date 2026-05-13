import React from 'react';
import { Palette, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PortfolioContent, PortfolioTheme, PortfolioSectionId } from '@/types/portfolio';
import {
  SIGNATURE_PORTFOLIO_THEME_OPTIONS,
  SIGNATURE_THEME_CATEGORY_LABEL,
  STANDARD_PORTFOLIO_THEME_OPTIONS,
  getStudioThemeOption,
  isSignaturePortfolioTheme,
} from '@/lib/portfolioThemes/registry';
import { PortfolioThemePickerPreview } from '@/components/portfolio/studio/PortfolioThemePickerPreview';

const SECTION_RESTORE_LABELS: Record<PortfolioSectionId, string> = {
  hero: 'Identity',
  proof: 'Proof strip',
  featured: 'Featured work',
  howIBuild: 'How I build',
  skills: 'Skills',
  experience: 'Experience & education',
};

type Props = {
  theme: PortfolioTheme;
  onTheme: (t: PortfolioTheme) => void;
  content: PortfolioContent;
  onContentChange: (c: PortfolioContent) => void;
  hidden?: boolean;
  /** Opens the destructive “reset portfolio” confirmation (same flow as the welcome screen). */
  onRequestPortfolioReset?: () => void;
  /** Current slug — required for replaying Pit wall cinematic in studio. */
  portfolioSlug?: string;
  /** When set, increments from parent so `PortfolioView` replays signature intro overlay. */
  onReplaySignatureIntro?: () => void;
};

/** Bottom-left floating glass dock — theme + density; debounced save stays in parent. */
export function AppearanceDock({
  theme,
  onTheme,
  content,
  onContentChange,
  hidden,
  onRequestPortfolioReset,
  portfolioSlug,
  onReplaySignatureIntro,
}: Props) {
  const [open, setOpen] = React.useState(false);
  if (hidden) return null;

  const density = content.displayDensity ?? 'compact';

  return (
    <div className="flex flex-col items-start gap-2">
      {open ? (
        <div
          className={cn(
            'w-[min(18rem,85vw)] rounded-2xl border-2 border-border bg-background/95 p-4 text-foreground shadow-2xl backdrop-blur-md',
            'motion-reduce:transition-none animate-in fade-in slide-in-from-bottom-2 duration-200'
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide">Look & density</span>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setOpen(false)}>
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Theme</Label>
              <Select value={theme} onValueChange={(v) => onTheme(v as PortfolioTheme)}>
                <SelectTrigger
                  className={cn(
                    'h-auto min-h-9 gap-2 py-1.5 text-xs',
                    '[&>span]:line-clamp-none [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1'
                  )}
                >
                  <SelectValue placeholder="Theme">
                    <PortfolioThemePickerPreview opt={getStudioThemeOption(theme)} layout="trigger" />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="max-h-[min(22rem,calc(100vh-10rem))]">
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {SIGNATURE_THEME_CATEGORY_LABEL}
                    </SelectLabel>
                    {SIGNATURE_PORTFOLIO_THEME_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.id}
                        value={opt.id}
                        textValue={opt.label}
                        className={cn(
                          'mb-1 cursor-pointer rounded-md border-0 bg-transparent p-0 pl-8 pr-1.5',
                          'data-[highlighted]:bg-transparent data-[highlighted]:text-inherit',
                          'focus:bg-transparent focus:text-inherit',
                          'data-[highlighted]:ring-2 data-[highlighted]:ring-ring data-[highlighted]:ring-offset-2 data-[highlighted]:ring-offset-background',
                          '[&>span:last-child]:flex [&>span:last-child]:w-full [&>span:last-child]:min-w-0 [&_svg]:text-slate-600 dark:[&_svg]:text-slate-300'
                        )}
                      >
                        <PortfolioThemePickerPreview opt={opt} layout="menu" />
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Standard
                    </SelectLabel>
                    {STANDARD_PORTFOLIO_THEME_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.id}
                        value={opt.id}
                        textValue={opt.label}
                        className={cn(
                          'mb-1 cursor-pointer rounded-md border-0 bg-transparent p-0 pl-8 pr-1.5 last:mb-0',
                          'data-[highlighted]:bg-transparent data-[highlighted]:text-inherit',
                          'focus:bg-transparent focus:text-inherit',
                          'data-[highlighted]:ring-2 data-[highlighted]:ring-ring data-[highlighted]:ring-offset-2 data-[highlighted]:ring-offset-background',
                          '[&>span:last-child]:flex [&>span:last-child]:w-full [&>span:last-child]:min-w-0 [&_svg]:text-slate-600 dark:[&_svg]:text-slate-300'
                        )}
                      >
                        <PortfolioThemePickerPreview opt={opt} layout="menu" />
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {isSignaturePortfolioTheme(theme) && portfolioSlug?.trim() && onReplaySignatureIntro ? (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 py-0 text-[10px] font-normal text-muted-foreground"
                  onClick={() => onReplaySignatureIntro()}
                >
                  Replay signature intro
                </Button>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Density</Label>
              <Select
                value={density}
                onValueChange={(v) =>
                  onContentChange({
                    ...content,
                    displayDensity: v as 'default' | 'compact',
                  })
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Featured layout</Label>
              <Select
                value={content.featuredLayout ?? 'editorial'}
                onValueChange={(v) =>
                  onContentChange({
                    ...content,
                    featuredLayout: v as 'editorial' | 'grid',
                  })
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editorial">Editorial (story rail)</SelectItem>
                  <SelectItem value="grid">Grid (compact cards)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {content.sections.hidden.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="text-xs">Hidden sections</Label>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Tap to show again. You can also open the command menu (⌘K / Ctrl+K) and search &quot;show&quot;.
                </p>
                <div className="flex flex-col gap-1.5">
                  {content.sections.hidden.map((sid) => (
                    <Button
                      key={sid}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full justify-start text-xs"
                      onClick={() =>
                        onContentChange({
                          ...content,
                          sections: {
                            ...content.sections,
                            hidden: content.sections.hidden.filter((id) => id !== sid),
                          },
                        })
                      }
                    >
                      Show {SECTION_RESTORE_LABELS[sid]}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {onRequestPortfolioReset ? (
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="text-xs text-destructive">Start over</Label>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Clears all portfolio content and runs the setup wizard again. Your slug stays the same; the site
                  unpublishes until you publish again.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
                  onClick={onRequestPortfolioReset}
                >
                  Reset portfolio…
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="h-12 w-12 rounded-full border-2 border-border bg-background text-foreground shadow-xl backdrop-blur-sm hover:bg-muted/90"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close appearance' : 'Appearance'}
      >
        <Palette className="h-5 w-5" />
      </Button>
    </div>
  );
}
