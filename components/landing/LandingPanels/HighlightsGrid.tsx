import { ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export type Highlight = {
  title: string;
  description: string;
  icon: keyof typeof highlightIcons;
};

const highlightIcons = {
  sparkles: Sparkles,
  shield: ShieldCheck
} as const satisfies Record<string, LucideIcon>;

type HighlightsGridProps = {
  items: readonly Highlight[];
};

export function HighlightsGrid({ items }: HighlightsGridProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {items.map((item) => {
        const Icon = highlightIcons[item.icon];

        return (
          <Card key={item.title} className="border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="flex flex-col gap-1.5 p-4">
              <Icon className="h-4 w-4 text-slate-500" />
              <p className="text-xs font-medium text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-600">{item.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
