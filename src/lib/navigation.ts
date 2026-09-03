// Unica fuente de verdad de la navegacion estatica del panel. El Sidebar la
// pinta; el breadcrumb del TopBar (src/lib/breadcrumbs.ts) la reutiliza tal
// cual — un solo lugar donde agregar una ruta la registra para el menu y para
// el breadcrumb a la vez. Vive fuera de Sidebar.tsx a proposito: ese archivo
// solo debe exportar el componente, para que Fast Refresh no se rompa.
import {
  BarChart3,
  Building2,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { REPORT_FAMILIES } from "../types/reports";

export interface ModuleLink {
  label: string;
  to: string;
}

export interface ModuleEntry {
  label: string;
  icon: LucideIcon;
  to: string;
  match: string[];
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
    children: [
      { label: "Colaboradores", to: "/staff" },
      { label: "Roles", to: "/roles" },
      { label: "Permisos", to: "/permisos" },
    ],
  },
  { label: "Clientes", icon: Building2, to: "/clientes", match: ["/clientes"] },
  {
    label: "Reportes",
    icon: BarChart3,
    to: REPORT_FAMILIES[0].to,
    match: ["/reportes"],
    children: REPORT_FAMILIES.map(({ label, to }) => ({ label, to })),
  },
  {
    label: "Configuración",
    icon: Settings,
    to: "/configuracion/motivos",
    match: ["/configuracion"],
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
