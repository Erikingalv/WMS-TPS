import { clsx } from "clsx";
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
}: {
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-ink-faint">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-2 text-xs text-ink-soft">{sub}</p>}
    </Card>
  );
}
