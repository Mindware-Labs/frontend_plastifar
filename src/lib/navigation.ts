// Unica fuente de verdad de la navegacion estatica del panel. El Sidebar la
// pinta; el breadcrumb del TopBar (src/lib/breadcrumbs.ts) la reutiliza tal
// cual — un solo lugar donde agregar una ruta la registra para el menu y para
// el breadcrumb a la vez. Vive fuera de Sidebar.tsx a proposito: ese archivo
// solo debe exportar el componente, para que Fast Refresh no se rompa.
//
// Hasta hace poco habia DOS arboles: este y una copia local dentro de
// Sidebar.tsx. Derivaron, y el sintoma fue que Tickets y todas las carpetas de
// Correo —que solo existian en la copia— salian sin breadcrumb: la barra
// superior quedaba vacia y esas pantallas eran las unicas del panel sin decir
// donde estaba parada la persona. Con un solo arbol eso no puede volver a
// pasar: lo que se pinta y lo que se nombra salen del mismo sitio.
import {
  Archive,
  BarChart3,
  Building,
  Building2,
  Factory,
  // FileWarning, // Reclamaciones deshabilitado temporalmente.
  Gavel,
  Inbox,
  Layers,
  LayoutDashboard,
  ListTodo,
  Mail,
  MessageSquareText,
  Package,
  PackageMinus,
  PackageSearch,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Tag,
  Ticket as TicketIcon,
  TicketCheck,
  Timer,
  Trash2,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "./permissions";
import type { EmailFolderCounts, FolderCount } from "../types/api";

/** Solo las claves de EmailFolderCounts que son una carpeta con contador. */
export type MailFolderKey = {
  [K in keyof EmailFolderCounts]: EmailFolderCounts[K] extends FolderCount ? K : never;
}[keyof EmailFolderCounts];

export interface NavItem {
  label: string;
  to: string;
  /**
   * Opcional a proposito. Correo y Personal identifican cada carpeta con su
   * icono; Configuracion son siete renglones de catalogo donde siete iconos
   * mas serian ruido, no señal.
   */
  icon?: LucideIcon;
  /** Coincidencia exacta: evita que "/bandeja" quede activa también en sus subcarpetas. */
  end?: boolean;
  /**
   * Carpeta de correo cuyo contador se pinta al final del renglon. Es la lista
   * explicita y no `keyof EmailFolderCounts` porque ese tipo incluye
   * `assignedUnseen`, que es un numero suelto y no una carpeta navegable.
   */
  folder?: MailFolderKey;
  /** Permiso que exige la ruta. Ausente = abierta a todo el personal. */
  permission?: PermissionKey;
  /** Solo lo ve un administrador. */
  adminOnly?: boolean;
  /** Sub-sección explícita dentro de la familia (ej. "Incidencias y Casos", "Parámetros"). */
  subgroup?: string;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  /**
   * Encabezado bajo el que se agrupa el modulo. Siete modulos seguidos se leen
   * como una lista de la compra; en tres bloques con nombre, el ojo salta al
   * bloque y despues busca dentro.
   */
  section: "Principal" | "Gestión" | "Otros";
  /** Un item propio (Clientes) o una familia de sub-secciones (Personal). */
  to?: string;
  children?: NavItem[];
  permission?: PermissionKey;
}

/**
 * Arbol de navegacion del panel: los modulos nuevos entran aqui sin tocar el
 * layout.
 *
 * Cada entrada declara el mismo permiso que su ruta en App.tsx. RF-P6 pide que
 * la interfaz oculte lo que la persona no puede hacer, y un enlace de modulo es
 * exactamente eso: sin el filtro, alguien sin clients.read veia Clientes en el
 * menu y descubria el bloqueo al entrar.
 *
 * Dashboard y Configuracion no llevan permiso a proposito, igual que sus rutas:
 * la seccion 8.4 abre la lectura de catalogos a todo el personal autenticado.
 */
export const SIDEBAR_NAV: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard", section: "Principal" },
  /*
   * Tickets agrupa el flujo completo de atención al cliente e incidencias
   * derivadas (reclamaciones, discrepancias y retiros), además de los catálogos
   * operativos (motivos y veredictos).
   */
  {
    label: "Tickets y Tareas",
    icon: TicketCheck,
    section: "Principal",
    children: [
      { label: "Tickets", to: "/tickets", icon: TicketIcon, permission: "tickets.read" },
      { label: "Tareas", to: "/tareas", icon: ListTodo, permission: "tasks.read" },
      // Reclamaciones deshabilitado temporalmente.
      // { label: "Reclamaciones", to: "/reclamaciones", icon: FileWarning, permission: "claims.read", subgroup: "Incidencias y Casos" },
      { label: "Discrepancias", to: "/discrepancias", icon: PackageSearch, permission: "discrepancies.read", subgroup: "Incidencias y Casos" },
      { label: "Retiros", to: "/retiros", icon: PackageMinus, permission: "withdrawals.read", subgroup: "Incidencias y Casos" },
      { label: "HCA", to: "/calidad/hca", icon: ShieldCheck, permission: "quality.read", subgroup: "Incidencias y Casos" },
      { label: "Motivos", to: "/tickets/motivos", icon: Tag, permission: "tickets.read", subgroup: "Parámetros" },
      { label: "Veredictos", to: "/tickets/veredictos", icon: Gavel, permission: "tickets.read", subgroup: "Parámetros" },
    ],
  },
  {
    label: "Correo",
    icon: Inbox,
    section: "Principal",
    permission: "mail.read",
    children: [
      { label: "Bandeja", to: "/bandeja", end: true, folder: "inbox", icon: Inbox },
      { label: "Destacados", to: "/bandeja/destacados", folder: "starred", icon: Star },
      { label: "Enviados", to: "/bandeja/enviados", folder: "sent", icon: Send },
      { label: "Archivados", to: "/bandeja/archivados", folder: "archived", icon: Archive },
      { label: "Papelera", to: "/bandeja/papelera", folder: "trash", icon: Trash2 },
      { label: "Plantillas", to: "/bandeja/respuestas", icon: MessageSquareText },
    ],
  },
  {
    label: "Clientes",
    icon: Building2,
    section: "Gestión",
    permission: "clients.read",
    to: "/clientes",
  },
  {
    label: "Personal",
    icon: Users,
    section: "Gestión",
    children: [
      { label: "Colaboradores", to: "/staff", icon: Users, permission: "staff.read", subgroup: "Equipo y Accesos" },
      { label: "Roles", to: "/roles", icon: ShieldCheck, permission: "roles.read", subgroup: "Equipo y Accesos" },
      { label: "Sedes", to: "/sedes", icon: Building, permission: "sedes.read", subgroup: "Estructura Organizacional" },
      { label: "Departamentos", to: "/departamentos", icon: Building2, permission: "departments.read", subgroup: "Estructura Organizacional" },
    ],
  },
  {
    label: "Reportes",
    icon: BarChart3,
    section: "Otros",
    permission: "reports.read",
    to: "/reportes",
  },
  {
    label: "Configuración",
    icon: Settings,
    section: "Otros",
    children: [
      { label: "SLA", to: "/configuracion/sla", icon: Timer },
      { label: "Buzones", to: "/configuracion/buzones", icon: Mail },
      { label: "Líneas de productos", to: "/configuracion/lineas", icon: Layers },
      { label: "Productos", to: "/configuracion/productos", icon: Package },
      { label: "Plantas", to: "/configuracion/plantas", icon: Factory },
      { label: "Equipos", to: "/configuracion/equipos", icon: UsersRound },
    ],
  },
];
