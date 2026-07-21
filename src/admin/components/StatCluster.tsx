import React from "react";
import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  /** Tints the number for a semantic reading (counts of failures, owners, …). */
  tone?: "default" | "success" | "warning" | "danger" | "primary" | "muted";
}

const TONE_CLASS: Record<NonNullable<Stat["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success-muted-foreground",
  warning: "text-warning-muted-foreground",
  danger: "text-destructive-muted-foreground",
  primary: "text-primary",
  muted: "text-muted-foreground",
};

/**
 * A row of supporting figures inside one bordered container.
 *
 * This replaces the "KPI wall" — four identical `<Card>`s each with a number —
 * that the Dashboard redesign abolished but that survived on every back-office
 * page. One container, dividers between figures, no per-stat shadow: the
 * numbers read as one group of context, not four competing headlines.
 */
export function StatCluster({
  stats,
  className,
}: {
  stats: Stat[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        "grid grid-cols-2 md:grid-cols-4 divide-y divide-border md:divide-y-0 md:divide-x",
        className
      )}
    >
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="flex items-baseline gap-3 px-5 py-4">
            {Icon && (
              <Icon className="h-4 w-4 text-muted-foreground shrink-0 translate-y-0.5" />
            )}
            <div className="min-w-0">
              <div
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  TONE_CLASS[stat.tone ?? "default"]
                )}
              >
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
