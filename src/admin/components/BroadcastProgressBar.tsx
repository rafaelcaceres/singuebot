import React from 'react';
import { cn } from '@/lib/utils';

const SEGMENTS = [
  { key: 'sent', singular: 'enviado', plural: 'enviados', className: 'bg-success' },
  { key: 'failed', singular: 'falha', plural: 'falhas', className: 'bg-destructive' },
  { key: 'skipped', singular: 'pulado', plural: 'pulados', className: 'bg-muted-foreground' },
] as const;

interface BroadcastProgressBarProps {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  className?: string;
  'aria-label': string;
}

// A broadcast that is 100% processed is not 100% delivered. One solid bar hides
// that, so each outcome gets its own segment; whatever is left is the track.
export const BroadcastProgressBar: React.FC<BroadcastProgressBarProps> = ({
  sent,
  failed,
  skipped,
  total,
  className,
  'aria-label': ariaLabel,
}) => {
  const counts = { sent, failed, skipped };
  const done = sent + failed + skipped;
  const remaining = Math.max(total - done, 0);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${sent} enviados, ${failed} falhas, ${skipped} pulados de ${total}`}
      className={cn('flex h-2 w-full gap-0.5 overflow-hidden rounded-full', className)}
    >
      {SEGMENTS.map((segment) => {
        const count = counts[segment.key];
        if (count === 0) return null;
        return (
          // min-w keeps a handful of failures visible in a run of thousands.
          <div
            key={segment.key}
            title={`${count} ${count === 1 ? segment.singular : segment.plural}`}
            className={cn('min-w-1 transition-[flex-grow]', segment.className)}
            style={{ flexGrow: count }}
          />
        );
      })}
      {(remaining > 0 || done === 0) && (
        <div
          className="bg-primary/20 transition-[flex-grow]"
          style={{ flexGrow: Math.max(remaining, 1) }}
        />
      )}
    </div>
  );
};
