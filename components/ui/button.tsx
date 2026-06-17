import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

const variants: Record<Variant, string> = {
  primary:
    "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
  secondary:
    "bg-white text-emerald-700 border border-emerald-600 hover:bg-emerald-50 disabled:opacity-50",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-sm",
  sm: "h-9 px-3 text-xs",
};

const base =
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", className = "", ...rest }, ref) => (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  )
);

Button.displayName = "Button";