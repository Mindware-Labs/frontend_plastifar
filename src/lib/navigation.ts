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
  Building2,
  ClipboardCheck,
  Inbox,
  KeyRound,
  LayoutDashboard,
  MapPin,
  MessageSquareText,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  Ticket as TicketIcon,
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
   * Tickets deja de ser un grupo. Tenia un unico hijo llamado «Bandeja», y un
   * grupo de uno no agrupa nada: obligaba a desplegar para llegar al mismo
   * sitio, y encima creaba dos «Bandeja» en el mismo menu —la de tickets y la
   * de correo— que solo se distinguian por el padre que habia que abrir.
   */
  {
    label: "Tickets",
    icon: TicketIcon,
    to: "/tickets",
    section: "Principal",
    permission: "tickets.read",
  },
  {
    label: "Correo",
    icon: Inbox,
    section: "Principal",
    permission: "tickets.read",
    children: [
      { label: "Bandeja", to: "/bandeja", end: true, folder: "inbox", icon: Inbox },
      { label: "Destacados", to: "/bandeja/destacados", folder: "starred", icon: Star },
      { label: "Enviados", to: "/bandeja/enviados", folder: "sent", icon: Send },
      { label: "Archivados", to: "/bandeja/archivados", folder: "archived", icon: Archive },
      { label: "Papelera", to: "/bandeja/papelera", folder: "trash", icon: Trash2 },
      { label: "Respuestas", to: "/bandeja/respuestas", icon: MessageSquareText },
    ],
  },
  /*
   * EL CATALOGO VIVE DONDE SE USA.
   *
   * «Configuracion» habia crecido hasta siete hijos y se habia convertido en el
   * cajon donde va lo que no se sabe donde poner. Dos de ellos no eran
   * configuracion del sistema sino datos del negocio, y su sitio estaba en el
   * modulo que los consume:
   *
   *   - Territorios alimenta el ranking comercial por zona y es obligatorio al
   *     registrar un cliente. Lo consulta quien trabaja con clientes.
   *   - Lineas de producto es el eje por el que Calidad sigue las
   *     reclamaciones. Lo consulta quien trabaja con Calidad.
   *
   * Lo que queda en Configuracion es homogeneo: cinco catalogos que definen
   * COMO SE COMPORTA el sistema —a que cola entra un ticket, cuando vence, que
   * dias no cuentan, con que texto escribe y por que buzon—. Ninguno es un dato
   * que alguien consulte mientras hace su trabajo.
   */
  {
    label: "Clientes",
    icon: Building2,
    section: "Gestión",
    permission: "clients.read",
    children: [
      { label: "Directorio", to: "/clientes", end: true, icon: Building2 },
      { label: "Territorios", to: "/clientes/territorios", icon: MapPin },
    ],
  },
  {
    label: "Calidad",
    icon: ClipboardCheck,
    section: "Gestión",
    permission: "quality.read",
    children: [
      { label: "HCA", to: "/calidad/hca" },
      { label: "Solicitudes de crédito", to: "/calidad/creditos" },
      { label: "Líneas de producto", to: "/calidad/lineas" },
    ],
  },
  {
    label: "Personal",
    icon: Users,
    section: "Gestión",
    children: [
      { label: "Colaboradores", to: "/staff", icon: Users, permission: "staff.read" },
      { label: "Roles", to: "/roles", icon: ShieldCheck, permission: "roles.read" },
      { label: "Permisos", to: "/permisos", icon: KeyRound, permission: "roles.read" },
      /*
       * EL ORGANIGRAMA VIVE CON LOS PERMISOS, NO CON LOS CATALOGOS.
       *
       * Configuracion agrupa lo que define COMO SE COMPORTA el sistema: a que
       * cola entra un ticket, cuando vence, con que texto se responde. Un
       * departamento no es eso. Un departamento define QUIEN PUEDE SOBRE QUE:
       * un rol concedido en uno se ejerce tambien sobre todo lo que cuelga de
       * el, asi que mover una unidad de sitio es una operacion de permisos.
       *
       * Su sitio esta junto a Colaboradores, Roles y Permisos, que son las
       * otras tres piezas de la misma respuesta.
       *
       * Lleva settings.write y no roles.read porque a esta pantalla no se entra
       * a consultar —el catalogo ya se ve en cada desplegable del panel— sino a
       * cambiarlo.
       */
      { label: "Departamentos", to: "/departamentos", icon: Building2, permission: "settings.write" },
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
      { label: "Motivos", to: "/configuracion/motivos" },
      { label: "SLA", to: "/configuracion/sla" },
      { label: "Días no laborables", to: "/configuracion/feriados" },
      { label: "Plantillas", to: "/configuracion/plantillas" },
      { label: "Buzones", to: "/configuracion/buzones" },
    ],
  },
];
