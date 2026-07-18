import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Boxes,
  ClipboardCheck,
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
import { PUEDE_GESTIONAR_USUARIOS } from "@/lib/auth/permisos";

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
  { href: "/escanear", label: "Escanear", icon: ScanLine },
  { href: "/historial", label: "Historial", icon: History },
];

export const NAV_ADMIN: NavItem[] = [
  {
    href: "/usuarios",
    label: "Usuarios",
    icon: UserCog,
    roles: PUEDE_GESTIONAR_USUARIOS,
  },
];

// Módulos de fases siguientes — se muestran atenuados para anticipar el
// mapa completo del sistema (ver documento de diseño, sección Navegación).
export const NAV_PROXIMAMENTE: { label: string; icon: LucideIcon }[] = [
  { label: "Reservas", icon: ClipboardCheck },
  { label: "Auditorías", icon: ClipboardCheck },
  { label: "Alertas", icon: Bell },
  { label: "Reportes", icon: FileBarChart },
];

export function puedeVer(item: NavItem, rol: RolUsuario) {
  return !item.roles || item.roles.includes(rol);
}
