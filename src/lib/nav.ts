import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Boxes,
  ClipboardCheck,
  DollarSign,
  FileBarChart,
  History,
  LayoutDashboard,
  MapPin,
  Package,
  ScanLine,
  Shuffle,
  UserCog,
  Users,
} from "lucide-react";
import type { RolUsuario } from "@/lib/types/database";
import { PUEDE_GESTIONAR_USUARIOS, PUEDE_VER_TARIFAS } from "@/lib/auth/permisos";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: RolUsuario[];
}

export const NAV_PRINCIPAL: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export const NAV_CATALOGO: NavItem[] = [
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/ubicaciones", label: "Ubicaciones", icon: MapPin },
];

export const NAV_OPERACION: NavItem[] = [
  { href: "/entradas", label: "Entradas", icon: ArrowDownToLine },
  { href: "/salidas", label: "Salidas", icon: ArrowUpFromLine },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/movimientos", label: "Movimientos internos", icon: Shuffle },
  { href: "/reservas", label: "Reservas", icon: ClipboardCheck },
  { href: "/escanear", label: "Escanear", icon: ScanLine },
  { href: "/historial", label: "Historial", icon: History },
];

export const NAV_CONTROL: NavItem[] = [
  { href: "/auditorias", label: "Auditorías", icon: ClipboardCheck },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/reportes", label: "Reportes", icon: FileBarChart },
  { href: "/tarifas", label: "Tarifas y cobro", icon: DollarSign, roles: PUEDE_VER_TARIFAS },
];

export const NAV_ADMIN: NavItem[] = [
  {
    href: "/usuarios",
    label: "Usuarios",
    icon: UserCog,
    roles: PUEDE_GESTIONAR_USUARIOS,
  },
];

// Módulos de fases siguientes.
export const NAV_PROXIMAMENTE: { label: string; icon: LucideIcon }[] = [];

export function puedeVer(item: NavItem, rol: RolUsuario) {
  return !item.roles || item.roles.includes(rol);
}
