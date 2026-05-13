import React from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import type { PortfolioEditTarget } from '@/components/portfolio/PortfolioView';
import { moveInOrder } from '@/lib/portfolioSectionOrder';
import type { FeaturedSignal, PortfolioContent, PortfolioSectionId, PortfolioTheme } from '@/types/portfolio';
import {
  SIGNATURE_PORTFOLIO_THEME_OPTIONS,
  SIGNATURE_THEME_CATEGORY_LABEL,
  STANDARD_PORTFOLIO_THEME_OPTIONS,
} from '@/lib/portfolioThemes/registry';
import { PortfolioThemePickerPreview } from '@/components/portfolio/studio/PortfolioThemePickerPreview';
import { cn } from '@/lib/utils';

const SECTION_LABELS: Record<PortfolioSectionId, string> = {
  hero: 'Identity',
  proof: 'Proof strip',
  featured: 'Featured work',
  howIBuild: 'How I build',
  skills: 'Skills',
  experience: 'Experience & education',
};

const SIGNALS: FeaturedSignal[] = [
  'PROJECTS',
  'OPEN_SOURCE',
  'DSA',
  'BACKEND',
  'AI',
  'SYSTEMS',
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: PortfolioContent;
  onContentChange: (c: PortfolioContent) => void;
  theme: PortfolioTheme;
  onTheme: (t: PortfolioTheme) => void;
  published: boolean;
  onPublished: (p: boolean) => void;
  onOpenSheet: (target: PortfolioEditTarget) => void;
  publicUrl?: string;
  onRequestPortfolioReset?: () => void;
};

export function StudioCommandPalette({
  open,
  onOpenChange,
  content,
  onContentChange,
  theme,
  onTheme,
  published,
  onPublished,
  onOpenSheet,
  publicUrl,
  onRequestPortfolioReset,
}: Props) {
  const move = (id: PortfolioSectionId, dir: -1 | 1) => {
    onContentChange({
      ...content,
      sections: {
        ...content.sections,
        order: moveInOrder(content.sections.order, id, dir),
      },
    });
  };

  const toggleHidden = (id: PortfolioSectionId) => {
    const h = new Set(content.sections.hidden);
    if (h.has(id)) {
      h.delete(id);
    } else if (id === 'hero') {
      return;
    } else {
      h.add(id);
    }
    onContentChange({
      ...content,
      sections: {
        ...content.sections,
        hidden: Array.from(h) as PortfolioSectionId[],
      },
    });
  };

  const visible = content.sections.order.filter((id) => !content.sections.hidden.includes(id));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Edit section">
          {visible.map((sid) => (
            <CommandItem
              key={`edit-${sid}`}
              value={`edit ${SECTION_LABELS[sid]}`}
              onSelect={() => {
                if (sid === 'proof') onOpenSheet('proof');
                else onOpenSheet(sid);
                onOpenChange(false);
              }}
            >
              Edit {SECTION_LABELS[sid]}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Reorder & visibility">
          {content.sections.order.map((sid) => {
            const i = content.sections.order.indexOf(sid);
            const canUp = i > 0;
            const canDown = i >= 0 && i < content.sections.order.length - 1;
            const hidden = content.sections.hidden.includes(sid);
            if (hidden) return null;
            return (
              <React.Fragment key={`ord-${sid}`}>
                <CommandItem
                  disabled={!canUp}
                  value={`up ${SECTION_LABELS[sid]}`}
                  onSelect={() => move(sid, -1)}
                >
                  Move {SECTION_LABELS[sid]} up
                </CommandItem>
                <CommandItem
                  disabled={!canDown}
                  value={`down ${SECTION_LABELS[sid]}`}
                  onSelect={() => move(sid, 1)}
                >
                  Move {SECTION_LABELS[sid]} down
                </CommandItem>
                {sid !== 'hero' ? (
                  <CommandItem value={`hide ${SECTION_LABELS[sid]}`} onSelect={() => toggleHidden(sid)}>
                    Hide {SECTION_LABELS[sid]}
                  </CommandItem>
                ) : null}
              </React.Fragment>
            );
          })}
        </CommandGroup>
        {content.sections.hidden.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Hidden sections (tap to show)">
              {content.sections.hidden.map((sid) => (
                <CommandItem
                  key={`unhide-${sid}`}
                  value={`show ${SECTION_LABELS[sid]}`}
                  onSelect={() => toggleHidden(sid)}
                >
                  Show {SECTION_LABELS[sid]}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />

        <CommandGroup heading="Recruiter signal">
          {SIGNALS.map((s) => (
            <CommandItem
              key={s}
              value={`signal ${s}`}
              onSelect={() => onContentChange({ ...content, featuredSignal: s })}
            >
              {content.featuredSignal === s ? '✓ ' : ''}
              {s.replace('_', ' ')}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={SIGNATURE_THEME_CATEGORY_LABEL} className="[&_[cmdk-item]]:px-1.5">
          {SIGNATURE_PORTFOLIO_THEME_OPTIONS.map((opt) => (
            <CommandItem
              key={opt.id}
              value={`theme ${opt.label} ${opt.id}`.toLowerCase()}
              onSelect={() => onTheme(opt.id)}
              className={cn(
                'mb-1 flex w-full cursor-pointer items-stretch gap-2 rounded-md border-0 bg-transparent p-0 py-0.5',
                'data-[selected=true]:bg-transparent data-[selected=true]:text-inherit',
                'aria-selected:bg-transparent'
              )}
            >
              <span
                className="flex w-4 shrink-0 items-center justify-center text-xs font-semibold text-muted-foreground"
                aria-hidden
              >
                {theme === opt.id ? '✓' : ''}
              </span>
              <PortfolioThemePickerPreview opt={opt} layout="command" className="min-h-0 flex-1" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Standard" className="[&_[cmdk-item]]:px-1.5">
          {STANDARD_PORTFOLIO_THEME_OPTIONS.map((opt) => (
            <CommandItem
              key={opt.id}
              value={`theme ${opt.label} ${opt.id}`.toLowerCase()}
              onSelect={() => onTheme(opt.id)}
              className={cn(
                'mb-1 flex w-full cursor-pointer items-stretch gap-2 rounded-md border-0 bg-transparent p-0 py-0.5',
                'data-[selected=true]:bg-transparent data-[selected=true]:text-inherit',
                'aria-selected:bg-transparent'
              )}
            >
              <span
                className="flex w-4 shrink-0 items-center justify-center text-xs font-semibold text-muted-foreground"
                aria-hidden
              >
                {theme === opt.id ? '✓' : ''}
              </span>
              <PortfolioThemePickerPreview opt={opt} layout="command" className="min-h-0 flex-1" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Publish">
          <CommandItem
            value={published ? 'unpublish' : 'publish'}
            onSelect={() => onPublished(!published)}
          >
            {published ? 'Unpublish portfolio' : 'Publish portfolio'}
          </CommandItem>
          {publicUrl ? (
            <CommandItem
              value="open public"
              onSelect={() => {
                window.open(publicUrl, '_blank', 'noreferrer');
                onOpenChange(false);
              }}
            >
              Open public page
              <CommandShortcut>↗</CommandShortcut>
            </CommandItem>
          ) : null}
        </CommandGroup>
        {onRequestPortfolioReset ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Danger zone">
              <CommandItem
                value="reset portfolio onboarding wizard start over"
                onSelect={() => {
                  onRequestPortfolioReset();
                  onOpenChange(false);
                }}
                className="text-destructive"
              >
                Reset portfolio — restart onboarding…
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
