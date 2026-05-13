import React, { useMemo } from 'react';
import { PortfolioView } from '@/components/portfolio/PortfolioView';
import { Button } from '@/components/ui/button';
import { PortfolioThemePickerPreview } from '@/components/portfolio/studio/PortfolioThemePickerPreview';
import { PORTFOLIO_THEME_OPTIONS } from '@/lib/portfolioThemes/registry';
import { mergePortfolioDraft, normalizePortfolioContent } from '@/lib/portfolioMerge';
import { cn } from '@/lib/utils';
import type {
  MyPortfolioDto,
  PortfolioContent,
  PortfolioTheme,
  PortfolioActivityPayload,
  PortfolioPlatformSolved,
} from '@/types/portfolio';

type Props = {
  data: MyPortfolioDto;
  pendingGithubDraft: Partial<PortfolioContent> | null;
  theme: PortfolioTheme;
  onTheme: (t: PortfolioTheme) => void;
  displayName: string;
  platformSolved: PortfolioPlatformSolved;
  activity: PortfolioActivityPayload;
  header: React.ReactNode;
  onBack: () => void;
  onContinue: () => void;
};

/**
 * Onboarding: pick a portfolio theme with a live preview (merged GitHub draft when present).
 */
export function OnboardingThemeStep({
  data,
  pendingGithubDraft,
  theme,
  onTheme,
  displayName,
  platformSolved,
  activity,
  header,
  onBack,
  onContinue,
}: Props) {
  const previewContent = useMemo(() => {
    let c = normalizePortfolioContent(structuredClone(data.content));
    if (pendingGithubDraft) {
      c = mergePortfolioDraft(c, pendingGithubDraft);
    }
    return c;
  }, [data, pendingGithubDraft]);

  return (
    <>
      {header}
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col pt-14 lg:h-[calc(100dvh-3.5rem)] lg:flex-row lg:pt-14">
        <aside className="flex shrink-0 flex-col border-b bg-background lg:w-[min(22rem,92vw)] lg:border-b-0 lg:border-r">
          <div className="flex max-h-[42vh] flex-col gap-3 overflow-y-auto p-4 sm:max-h-none sm:gap-4 lg:max-h-none lg:p-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Appearance</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Choose your theme</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Tap a look — the preview updates instantly. You can switch again anytime under Customize.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {PORTFOLIO_THEME_OPTIONS.map((opt) => {
                const selected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onTheme(opt.id)}
                    className={cn(
                      'rounded-xl text-left transition-shadow outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring',
                      selected ? 'ring-2 ring-primary shadow-md' : 'ring-1 ring-border/60 hover:ring-primary/40'
                    )}
                  >
                    <PortfolioThemePickerPreview opt={opt} layout="menu" className="min-h-[3.5rem] rounded-[11px]" />
                  </button>
                );
              })}
            </div>
            <div className="mt-auto hidden flex-wrap justify-center gap-2 border-t pt-3 lg:flex lg:justify-start lg:border-0 lg:pt-0">
              <Button type="button" variant="outline" onClick={onBack}>
                Back
              </Button>
              <Button type="button" onClick={onContinue}>
                Continue
              </Button>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-[min(360px,48vh)] flex-1 flex-col bg-gradient-to-b from-muted/40 to-muted/20 p-3 sm:p-4 lg:min-h-0 lg:overflow-hidden">
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground lg:text-left">Live preview</p>
          <div className="relative flex min-h-0 flex-1 justify-center overflow-hidden rounded-xl border bg-background shadow-xl">
            <div className="h-full w-full max-w-4xl overflow-y-auto overflow-x-hidden">
              <PortfolioView
                displayName={displayName}
                content={previewContent}
                platformSolved={platformSolved}
                activity={activity}
                theme={theme}
                embedded
                mode="readonly"
                displayDensity={previewContent.displayDensity}
                revealStagger={false}
                portfolioSlug={data.slug.trim() || undefined}
                signatureIntroReplayNonce={0}
              />
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Preview reflects your GitHub selections from the last step.
          </p>
          <div className="mt-3 flex shrink-0 flex-wrap justify-center gap-2 border-t border-border/60 pt-3 lg:hidden">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button type="button" onClick={onContinue}>
              Continue
            </Button>
          </div>
        </main>
      </div>
    </>
  );
}
