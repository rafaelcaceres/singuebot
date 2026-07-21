import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The single status vocabulary for the console. Every delivery state, approval
 * state, interview stage and health signal renders through this — previously
 * each page invented its own `bg-green-100 text-green-800` pill.
 *
 * Tone is never the only signal: the label always carries the meaning in text,
 * and `dot` is decorative reinforcement.
 */
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-transparent bg-info-muted text-info-muted-foreground",
        success: "border-transparent bg-success-muted text-success-muted-foreground",
        warning: "border-transparent bg-warning-muted text-warning-muted-foreground",
        danger:
          "border-transparent bg-destructive-muted text-destructive-muted-foreground",
        /** Solid — reserve for the one state that must win the row. */
        solid: "border-transparent bg-primary text-primary-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

const DOT_TONE: Record<string, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  solid: "bg-primary-foreground",
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  /** Show a leading tone dot. Decoration only — the label carries the meaning. */
  dot?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

function StatusBadge({
  className,
  tone,
  dot = false,
  icon: Icon,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {dot && (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_TONE[tone ?? "neutral"])}
        />
      )}
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}

export type StatusTone = NonNullable<StatusBadgeProps["tone"]>;

export { StatusBadge, statusBadgeVariants };
