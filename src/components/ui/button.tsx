import { Slot } from "@radix-ui/react-slot";
import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  asChild?: boolean;
};

export function Button({
  className,
  variant = "primary",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={clsx(
        "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold tracking-wide transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
        variant === "primary" &&
          "bg-black text-white hover:bg-neutral-800",
        variant === "outline" &&
          "border border-neutral-300 text-neutral-900 hover:border-neutral-500",
        variant === "ghost" &&
          "text-neutral-700 hover:text-black",
        className,
      )}
      {...props}
    />
  );
}
