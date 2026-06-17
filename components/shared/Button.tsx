import * as React from "react"
import { clsx } from "clsx"
import Link from "next/link";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  href?: string;
}

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", href, ...props }, ref) => {
    const classes = clsx(
      "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none",
      {
        "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm": variant === "primary",
        "bg-stone-200 text-stone-900 hover:bg-stone-300": variant === "secondary",
        "border-2 border-stone-200 text-stone-900 hover:bg-stone-100": variant === "outline",
        "hover:bg-stone-100 text-stone-700": variant === "ghost",
        "h-9 px-4 text-sm": size === "sm",
        "h-12 px-6 text-base": size === "md",
        "h-14 px-8 text-lg": size === "lg",
      },
      className
    );

    if (href) {
      return (
        <Link href={href} className={classes} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {props.children}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
