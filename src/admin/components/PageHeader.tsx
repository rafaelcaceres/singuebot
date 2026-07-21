import React from "react";
import { cn } from "@/lib/utils";

/**
 * The one page header for the console.
 *
 * Every back-office page used to open with its own `text-3xl font-bold` title
 * inside a flex row, half of them behind an icon-in-a-tinted-chip — the shadcn
 * demo header. Centralizing it means a new page cannot drift: there is no
 * heading markup to get wrong, only a title and an optional actions slot.
 *
 * Matches the Dashboard's register: `text-2xl font-semibold`, no icon chrome,
 * subtitle in muted foreground.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 flex-wrap", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
