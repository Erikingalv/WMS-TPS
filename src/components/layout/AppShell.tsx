"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { clsx } from "clsx";
import { LogOut, Menu } from "lucide-react";
import {
  NAV_ADMIN,
  NAV_CATALOGO,
  NAV_OPERACION,
  NAV_PRINCIPAL,
  NAV_PROXIMAMENTE,
  puedeVer,
  type NavItem,
} from "@/lib/nav";
import { ETIQUETA_ROL } from "@/lib/auth/permisos";
import { signOut } from "@/lib/auth/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/Badge";
import type { Usuario } from "@/lib/types/database";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent-soft text-accent"
          : "text-ink-soft hover:bg-accent-soft hover:text-ink"
      )}
    >
      <Icon size={18} strokeWidth={2} />
      {item.label}
    </Link>
  );
}

function SidebarContent({
  usuario,
  onNavigate,
}: {
  usuario: Usuario;
  onNavigate: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={32}
          height={32}
          className="rounded-lg"
        />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">WMS</p>
          <p className="text-xs text-ink-faint">Resguardo &amp; Control</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4">
        <div className="flex flex-col gap-1">
          {NAV_PRINCIPAL.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Catálogo
          </p>
          {NAV_CATALOGO.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Operación
          </p>
          {NAV_OPERACION.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        {NAV_ADMIN.some((item) => puedeVer(item, usuario.rol)) && (
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Administración
            </p>
            {NAV_ADMIN.filter((item) => puedeVer(item, usuario.rol)).map(
              (item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              )
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Próximamente
          </p>
          {NAV_PROXIMAMENTE.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-faint"
            >
              <Icon size={18} strokeWidth={2} />
              {label}
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
            {usuario.nombre.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-ink">
              {usuario.nombre}
            </p>
            <Badge tone="info">{ETIQUETA_ROL[usuario.rol]}</Badge>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="flex size-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-crit-soft hover:text-crit"
            >
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  usuario,
  children,
}: {
  usuario: Usuario;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-paper-raised md:block">
        <SidebarContent usuario={usuario} onNavigate={() => {}} />
      </aside>

      {/* Sidebar — mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-paper-raised shadow-xl">
            <SidebarContent usuario={usuario} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-line bg-paper-raised px-4 md:justify-end md:px-6">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setOpen(true)}
            className="flex size-10 items-center justify-center rounded-lg text-ink-soft hover:bg-accent-soft md:hidden"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-medium text-ink md:hidden">WMS</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

