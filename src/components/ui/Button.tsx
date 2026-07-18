"use client";

import { clsx } from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "default" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-paper hover:bg-accent-hover",
  secondary:
    "bg-paper-raised border border-line text-ink hover:bg-accent-soft",
  ghost: "text-ink-soft hover:bg-accent-soft hover:text-ink",
  danger: "bg-crit text-paper hover:opacity-90",
};

const sizes: Record<Size, string> = {
  default: "h-11 px-5 text-sm",
  sm: "h-9 px-3.5 text-[13px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "default",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "default",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(base, variants[variant], sizes[size], className)}
    >
      {pending ? (pendingLabel ?? "Guardando…") : children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "default",
  className,
  href,
  children,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(base, variants[variant], sizes[size], className)}
    >
      {children}
    </Link>
  );
}
