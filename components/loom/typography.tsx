import { cn } from "cn";
import type { ElementType, ComponentPropsWithoutRef } from "react";

/**
 * LOOM typography primitives. Components must reach for these instead of
 * ad hoc text-* / font-* utility soup so type scale stays consistent across
 * every future tracker.
 */

export function PageTitle({ className, ...props }: ComponentPropsWithoutRef<"h1">) {
  return (
    <h1
      className={cn(
        "text-2xl font-semibold tracking-tight text-foreground sm:text-3xl",
        className
      )}
      {...props}
    />
  );
}

export function SectionTitle({ className, ...props }: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      className={cn("text-lg font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3 className={cn("text-base font-medium text-foreground", className)} {...props} />
  );
}

export function Body({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-sm leading-relaxed text-foreground", className)} {...props} />;
}

export function SecondaryText({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: ComponentPropsWithoutRef<"label">) {
  return (
    <label
      className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", className)}
      {...props}
    />
  );
}

export function Caption({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

interface NumericValueProps extends ComponentPropsWithoutRef<"span"> {
  as?: ElementType;
  tone?: "default" | "success" | "warning" | "destructive";
}

const NUMERIC_TONE_CLASS: Record<NonNullable<NumericValueProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function NumericValue({
  as: Component = "span",
  tone = "default",
  className,
  ...props
}: NumericValueProps) {
  return (
    <Component
      className={cn(
        "font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl",
        NUMERIC_TONE_CLASS[tone],
        className
      )}
      {...props}
    />
  );
}
