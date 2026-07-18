import { clsx } from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-line bg-paper-raised",
        className
      )}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  href?: string;
}) {
  const contenido = (
    <Card className={clsx("p-5", href && "transition-colors hover:border-accent")}>
      <p className="text-[13px] font-medium text-ink-faint">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-2 text-xs text-ink-soft">{sub}</p>}
    </Card>
  );

  if (href) {
    return <Link href={href}>{contenido}</Link>;
  }
  return contenido;
}
