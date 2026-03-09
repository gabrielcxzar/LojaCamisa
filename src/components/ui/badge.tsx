import clsx from "clsx";
import type { HTMLAttributes } from "react";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "accent" | "muted" | "success";
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest",
        tone === "default" && "bg-neutral-100 text-neutral-700",
        tone === "accent" && "bg-[color:var(--accent)] text-black",
        tone === "muted" && "bg-neutral-200 text-neutral-600",
        tone === "success" && "bg-emerald-100 text-emerald-800",
        className,
      )}
      {...props}
    />
  );
}
