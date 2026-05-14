import React from 'react';
import { Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  slug: string;
  onSlug: (s: string) => void;
  published: boolean;
  onPublished: (p: boolean) => void;
  hidden?: boolean;
};

/** Top-right compact publish controls (slug + switch); avoids a permanent right rail. */
export function StudioPublishPill({ slug, onSlug, published, onPublished, hidden }: Props) {
  if (hidden) return null;
  const privateClasses =
    'border-amber-500/45 bg-amber-50/95 text-amber-950 shadow-md ring-1 ring-amber-500/25 hover:bg-amber-100/95 dark:border-amber-500/35 dark:bg-amber-950/55 dark:text-amber-50 dark:ring-amber-400/20 dark:hover:bg-amber-950/75';
  const liveClasses =
    'border-emerald-500/35 bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100/90 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-50 dark:hover:bg-emerald-950/60';
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          title={
            published
              ? 'Portfolio is public — open to change slug or unpublish'
              : 'Portfolio is private — open to set your link and publish'
          }
          className={cn(
            'fixed right-4 top-14 z-40 gap-2 rounded-full border-2 px-3 py-2 text-foreground shadow-lg backdrop-blur-md',
            published ? liveClasses : privateClasses
          )}
        >
          {published ? (
            <Globe className="h-3.5 w-3.5" />
          ) : (
            <Lock className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="text-xs font-semibold tracking-tight">{published ? 'Live' : 'Private'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Public slug</Label>
            <Input
              className="h-9 text-xs"
              value={slug}
              onChange={(e) => onSlug(e.target.value.toLowerCase())}
              placeholder="your-name"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={published} onCheckedChange={onPublished} id="pill-pub" />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="pill-pub" className="text-xs font-medium">
                Published
              </Label>
              {!published ? (
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Turn on when you want anyone with your link to see this portfolio.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
