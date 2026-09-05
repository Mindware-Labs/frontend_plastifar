// Unica fuente de verdad de la navegacion estatica del panel. El Sidebar la
// pinta; el breadcrumb del TopBar (src/lib/breadcrumbs.ts) la reutiliza tal
// cual — un solo lugar donde agregar una ruta la registra para el menu y para
// el breadcrumb a la vez. Vive fuera de Sidebar.tsx a proposito: ese archivo
// solo debe exportar el componente, para que Fast Refresh no se rompa.
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "./permissions";
import { REPORT_FAMILIES } from "../types/reports";

export interface ModuleLink {
  label: string;
  to: string;
  /** Mismo permiso que el guard de esa ruta en App.tsx. Sin el, no se pinta. */
  permission?: PermissionKey;
}

export interface ModuleEntry {
  label: string;
  icon: LucideIcon;
  to: string;
  match: string[];
  /**
   * Permiso que exige la ruta propia del modulo, espejo del `PermissionRoute`
   * de App.tsx. RF-P6: un enlace del menu es una accion como cualquier otra, y
   * ofrecer el que termina en 403 hace descubrir el bloqueo al llegar.
   * Ausente = la ruta esta abierta a todo el personal autenticado.
   */
  permission?: PermissionKey;
  /** Rutas estaticas del modulo. Todas viven aqui, no como pestanas dentro
   *  de la vista — lo unico que se queda en la vista es la navegacion que
   *  depende de un id (la ficha de un registro concreto). */
  children?: ModuleLink[];
}

export const SIDEBAR_NAV: ModuleEntry[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard", match: ["/dashboard"] },
  {
    label: "Personal",
    icon: Users,
    to: "/staff",
    match: ["/staff", "/roles", "/permisos"],
    permission: "staff.read",
    children: [
      { label: "Colaboradores", to: "/staff", permission: "staff.read" },
      { label: "Roles", to: "/roles", permission: "roles.read" },
      { label: "Permisos", to: "/permisos", permission: "roles.read" },
    ],
  },
  {
    label: "Clientes",
    icon: Building2,
    to: "/clientes",
    match: ["/clientes"],
    permission: "clients.read",
  },
  {
    label: "Calidad",
    icon: ClipboardCheck,
    to: "/calidad/hca",
    match: ["/calidad"],
    permission: "quality.read",
    children: [
      { label: "HCA", to: "/calidad/hca", permission: "quality.read" },
      { label: "Solicitudes de crédito", to: "/calidad/creditos", permission: "quality.read" },
    ],
  },
  {
    label: "Reportes",
    icon: BarChart3,
    to: REPORT_FAMILIES[0].to,
    match: ["/reportes"],
    permission: "reports.read",
    children: REPORT_FAMILIES.map(({ label, to }) => ({ label, to, permission: "reports.read" })),
  },
  {
    label: "Configuración",
    icon: Settings,
    to: "/configuracion/motivos",
    match: ["/configuracion"],
    // Sin permiso a proposito: la seccion 8.4 del plan abre la lectura de los
    // catalogos a todo el personal autenticado y solo exige settings.write para
    // escribir, que es lo que gatea cada seccion por dentro.
    children: [
      { label: "Motivos", to: "/configuracion/motivos" },
      { label: "SLA", to: "/configuracion/sla" },
      { label: "Días no laborables", to: "/configuracion/feriados" },
      { label: "Líneas de producto", to: "/configuracion/lineas" },
      { label: "Plantillas", to: "/configuracion/plantillas" },
      { label: "Buzones", to: "/configuracion/buzones" },
      { label: "Territorios", to: "/configuracion/territorios" },
    ],
  },
];
