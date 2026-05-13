import React from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="fixed right-4 top-14 z-40 gap-2 rounded-full border-2 border-border bg-background px-3 py-2 text-foreground shadow-lg backdrop-blur-md hover:bg-muted/80"
        >
          <Globe className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{published ? 'Live' : 'Draft'}</span>
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
            <Label htmlFor="pill-pub" className="text-xs">
              Published
            </Label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
