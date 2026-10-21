import {
  Bell,
  ChevronDown,
  KeyRound,
  LogOut,
  PenLine,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useHasOpenedNotifications } from "../../hooks/useNotifyPrefs";
import { usePermissions } from "../../hooks/usePermissions";
import { formatDisplayName, formatInitials } from "../../lib/format";
import { SIDEBAR_NAV, type NavGroup } from "../../lib/navigation";
import { Logo } from "../Logo";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { NotificationsModal } from "./NotificationsModal";
import { SignatureModal } from "./SignatureModal";

/** Marca roja al borde de la barra junto a lo activo: crece con el resorte y se apaga al cambiar de ruta. */
function ActiveMark({ active, className = "" }: { active: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-red transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${
        active ? "scale-y-100" : "scale-y-0"
      } ${className}`}
    />
  );
}

/** Panel de hijos anclado al icono: se posiciona fijo para que el riel no lo recorte. */
interface Flyout {
  group: NavGroup;
  top: number;
  left: number;
}

/** Contador numérico para correos no leídos. */
function FolderBadge({
  count,
  isActive,
}: {
  count: { total: number; unread: number };
  isActive?: boolean;
}) {
  if (count.unread <= 0) return null;

  return (
    <span
      className={`ml-auto inline-flex h-[18px] min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 font-heading text-[10.5px] font-bold leading-none tabular-nums transition-all duration-200 ${
        isActive
          ? "bg-brand-red text-white shadow-[0_1px_4px_rgba(228,0,43,0.28)]"
          : "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200/80 group-hover:bg-zinc-200/75 group-hover:text-zinc-900"
      }`}
    >
      {count.unread > 99 ? "99+" : count.unread}
    </span>
  );
}

/** Icono interactivo de colapso y expansión de la barra lateral. */
function SidebarToggleIcon({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Marco perimetral */}
      <rect
        x="1.75"
        y="2.25"
        width="14.5"
        height="13.5"
        rx="2.75"
        className="stroke-current"
        strokeWidth="1.25"
      />
      {/* Carril del panel lateral con realce interactivo */}
      <rect
        x="2.5"
        y="3"
        width="3.75"
        height="12"
        rx="1.75"
        className={`transition-colors duration-200 ${
          collapsed
            ? "fill-zinc-200/80"
            : "fill-zinc-200/60 group-hover:fill-brand-red/20"
        }`}
      />
      {/* Línea divisoria del carril */}
      <line
        x1="6.75"
        y1="2.25"
        x2="6.75"
        y2="15.75"
        className="stroke-current"
        strokeWidth="1.2"
      />
      {/* Chevron de acción dinámico con animación táctil al hover */}
      {collapsed ? (
        <path
          d="M9.75 6.5L12.25 9L9.75 11.5"
          className="stroke-current transition-transform duration-200 ease-out group-hover:translate-x-0.5"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M12.25 6.5L9.75 9L12.25 11.5"
          className="stroke-current transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

const collapsedKey = "plf.sidebar-collapsed";

/** En navegacion privada leer localStorage lanza: la barra abre expandida. */
function readCollapsed() {
  try {
    return localStorage.getItem(collapsedKey) === "1";
  } catch {
    return false;
  }
}

/** Barra lateral: logotipo, arbol de modulos y, al pie, la persona conectada. */
export function Sidebar() {
  const { user, logout } = useAuth();

  // Lo marcado como solo administradores no aparece para el resto.
  function visibleChildren(group: NavGroup) {
    return (group.children ?? []).filter((child) => !child.adminOnly || user?.isAdmin);
  }
  const { counts } = useEmailCounts();
  const { can } = usePermissions();

  /**
   * Menu recortado a lo que la persona puede abrir (RF-P6).
   *
   * Un grupo sobrevive si el suyo pasa y le queda al menos un hijo visible: sin
   * esa segunda condicion, alguien con roles.read pero sin staff.read veia el
   * grupo Personal con la lista vacia, que es peor que no verlo.
   */
  const visibleGroups = useMemo(
    () =>
      SIDEBAR_NAV
        .filter((group) => !group.permission || can(group.permission))
        .map((group) => ({
          ...group,
          children: group.children?.filter(
            (child) => (!child.permission || can(child.permission)) && (!child.adminOnly || user?.isAdmin),
          ),
        }))
        .filter((group) => !group.children || group.children.length > 0),
    [can, user?.isAdmin],
  );

  /**
   * Los grupos repartidos en sus secciones, en el orden en que aparecen.
   */
  const sections = useMemo(() => {
    const out: { section: NavGroup["section"]; groups: typeof visibleGroups }[] = [];
    for (const group of visibleGroups) {
      const last = out[out.length - 1];
      if (last && last.section === group.section) last.groups.push(group);
      else out.push({ section: group.section, groups: [group] });
    }
    return out;
  }, [visibleGroups]);

  const { pathname } = useLocation();
  const [preferCollapsed, setPreferCollapsed] = useState(readCollapsed);

  /** Bajo `lg` la barra se pliega al riel, se prefiera o no. */
  const isNarrow = useIsMobile(1023);
  const collapsed = preferCollapsed || isNarrow;
  const setCollapsed = setPreferCollapsed;

  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editingSignature, setEditingSignature] = useState(false);
  const [editingAlerts, setEditingAlerts] = useState(false);
  const hasOpenedAlerts = useHasOpenedNotifications();

  // El contenido del desplegable sobrevive al cierre para que la salida tenga qué animar.
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  /** Solo los grupos que la persona abrio o cerro a mano; el resto sale de la ruta. */
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const menuMotion = useDisclosureMotion<HTMLDivElement>(menuOpen, { direction: "up" });
  const flyoutMotion = useDisclosureMotion<HTMLDivElement>(collapsed && flyoutOpen);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!flyout) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFlyoutOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [flyout]);

  useEffect(() => () => cancelClose(), []);

  function cancelClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function openFlyout(group: NavGroup, anchor: HTMLElement) {
    if (!group.children) return;
    cancelClose();
    const rect = anchor.getBoundingClientRect();
    setFlyout({ group, top: rect.top - 6, left: rect.right + 8 });
    setFlyoutOpen(true);
  }

  /** Retardo corto: da tiempo a cruzar el hueco entre el icono y el panel. */
  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setFlyoutOpen(false), 140);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    setMenuOpen(false);
    setFlyoutOpen(false);
    flyoutMotion.snap();
    try {
      localStorage.setItem(collapsedKey, next ? "1" : "0");
    } catch {
      // Sin almacenamiento la barra funciona igual, solo no recuerda el estado.
    }
  }

  /** Contraida no se ven los hijos: el icono se enciende con cualquier ruta del grupo. */
  function isGroupActive(group: NavGroup) {
    const targets = group.children?.map((child) => child.to) ?? [group.to!];
    return targets.some((to) => pathname === to || pathname.startsWith(`${to}/`));
  }

  function isGroupOpen(group: NavGroup) {
    return manualOpen[group.label] ?? isGroupActive(group);
  }

  function toggleGroup(group: NavGroup) {
    setManualOpen((current) => ({ ...current, [group.label]: !isGroupOpen(group) }));
  }

  function renderExpandedGroup(group: NavGroup) {
    if (group.children) {
      const open = isGroupOpen(group);
      const panelId = `nav-${group.label.toLowerCase().replace(/\s+/g, "-")}`;
      const active = isGroupActive(group);
      const children = visibleChildren(group);

      return (
        <div key={group.label} className="flex flex-col">
          <button
            type="button"
            onClick={() => toggleGroup(group)}
            aria-expanded={open}
            aria-controls={panelId}
            className={`group relative flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-all duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
              active && !open
                ? "bg-zinc-100/90 text-zinc-950 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(24,24,27,0.04)] ring-1 ring-zinc-900/[0.05]"
                : active && open
                ? "text-zinc-950 font-semibold hover:bg-zinc-100/60"
                : open
                ? "text-zinc-800 font-medium hover:bg-zinc-100/60"
                : "text-zinc-600 font-medium hover:bg-zinc-100/70 hover:text-zinc-900"
            }`}
          >
            <ActiveMark active={active && !open} className="-left-2" />
            <group.icon
              strokeWidth={active || open ? 2.2 : 1.9}
              className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
                active && !open
                  ? "text-brand-red"
                  : active || open
                  ? "text-zinc-900"
                  : "text-zinc-400 group-hover:text-zinc-700"
              }`}
            />
            <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
            {!open && group.label === "Correo" && pendingMail > 0 && (
              <span className="flex h-[18px] min-w-[20px] items-center justify-center rounded-full bg-brand-red px-1.5 font-heading text-[10px] font-bold text-white shadow-[0_1px_4px_rgba(228,0,43,0.28)]">
                {pendingMail > 99 ? "99+" : pendingMail}
              </span>
            )}
            <ChevronDown
              aria-hidden
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${
                open
                  ? "rotate-180 text-zinc-600"
                  : "rotate-0 text-zinc-400 group-hover:text-zinc-600"
              }`}
            />
          </button>

          {/* Sub-opciones conectadas a la familia mediante árbol curvo */}
          <div
            id={panelId}
            className={`grid transition-[grid-template-rows,opacity] duration-280 ease-plf-spring motion-reduce:transition-none ${
              open
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0 pointer-events-none"
            }`}
          >
            <div className="overflow-hidden">
              <div className="relative mb-1.5 mt-0.5 flex flex-col gap-0.5 pl-[26px]">
                {/* Tronco vertical continuo de la familia: nace bajo el icono padre y entrega en el codo del último hijo */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-0.5 bottom-[22px] left-[17.5px] w-px bg-zinc-200/90"
                />

                {children.map((child, index) => {
                  const hasUnread = Boolean(child.folder && counts && counts[child.folder]?.unread > 0);
                  const prevChild = index > 0 ? children[index - 1] : null;
                  const showSubgroup = Boolean(child.subgroup && child.subgroup !== prevChild?.subgroup);

                  return (
                    <Fragment key={child.to}>
                      {showSubgroup && (
                        <div className="relative pt-3 pb-1 pl-1.5 select-none">
                          <p className="font-heading text-[9.5px] font-bold uppercase tracking-[0.09em] text-zinc-400">
                            {child.subgroup}
                          </p>
                        </div>
                      )}
                      <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.end}
                      className={({ isActive }) =>
                        `group relative flex h-[32px] items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] transition-all duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                          isActive
                            ? "bg-zinc-100/95 text-zinc-950 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(24,24,27,0.04)] ring-1 ring-zinc-900/[0.06]"
                            : hasUnread
                            ? "text-zinc-900 font-semibold hover:bg-zinc-100/65"
                            : "text-zinc-600 font-medium hover:bg-zinc-100/65 hover:text-zinc-900"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Codo curvo que une cada opción con el tronco de su familia */}
                          <span
                            aria-hidden
                            className={`pointer-events-none absolute -left-[8.5px] top-0 z-10 h-1/2 w-[8.5px] rounded-bl-[7px] border-b border-l transition-colors duration-150 ${
                              isActive
                                ? "border-brand-red/55"
                                : "border-zinc-200/90 group-hover:border-zinc-300"
                            }`}
                          />

                          {/* Cápsula activa sobre la unión de la opción */}
                          <span
                            aria-hidden
                            className={`pointer-events-none absolute -left-[1.5px] top-1/2 z-20 h-3.5 w-[2.5px] -translate-y-1/2 rounded-full bg-brand-red shadow-[0_0_6px_rgba(228,0,43,0.35)] transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${
                              isActive ? "scale-y-100" : "scale-y-0"
                            }`}
                          />

                          {child.icon && (
                            <child.icon
                              aria-hidden
                              strokeWidth={isActive ? 2.2 : 1.9}
                              className={`h-3.5 w-3.5 shrink-0 transition-colors duration-150 ${
                                isActive
                                  ? "text-brand-red"
                                  : hasUnread
                                  ? "text-zinc-800"
                                  : "text-zinc-400 group-hover:text-zinc-600"
                              }`}
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate">{child.label}</span>
                          {child.folder && counts && (
                            <FolderBadge count={counts[child.folder]} isActive={isActive} />
                          )}
                        </>
                      )}
                    </NavLink>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <NavLink
        key={group.to}
        to={group.to!}
        className={({ isActive }) =>
          `group relative flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-all duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
            isActive
              ? "bg-zinc-100/95 text-zinc-950 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(24,24,27,0.04)] ring-1 ring-zinc-900/[0.06]"
              : "text-zinc-600 font-medium hover:bg-zinc-100/70 hover:text-zinc-900"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <ActiveMark active={isActive} className="-left-2" />
            <group.icon
              strokeWidth={isActive ? 2.2 : 1.9}
              className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
                isActive ? "text-brand-red" : "text-zinc-400 group-hover:text-zinc-700"
              }`}
            />
            <span className="min-w-0 flex-1 truncate">{group.label}</span>
          </>
        )}
      </NavLink>
    );
  }

  const displayName = formatDisplayName(user?.firstName, user?.lastName, user?.email);
  const initials = formatInitials(user?.firstName, user?.lastName, user?.email);
  const pendingMail = counts
    ? counts.inbox.unread + counts.archived.unread + counts.starred.unread + counts.trash.unread
    : 0;

  return (
    <aside
      className={`relative flex h-screen shrink-0 flex-col border-r border-zinc-200/80 bg-white select-none will-change-[width]
        transition-[width] duration-[230ms] ease-plf-glide motion-reduce:transition-none ${collapsed ? "w-[68px]" : "w-60"}`}
    >
      {/* 1. Cabecera superior: altura fija elegante (h-14) con cross-fade ágil */}
      <div className="relative flex h-14 shrink-0 items-center border-b border-zinc-200/80 px-3 overflow-hidden">
        {/* Versión expandida */}
        <div
          className={`flex w-full items-center justify-between transition-all duration-[180ms] ease-plf-glide motion-reduce:transition-none ${
            collapsed ? "opacity-0 pointer-events-none -translate-x-3" : "opacity-100 translate-x-0"
          }`}
        >
          <Link
            to="/bandeja"
            className="group flex items-center pl-1 transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20 rounded-lg py-1"
            title="Plastifar · Ir a Bandeja"
          >
            <Logo
              variant="color"
              height={24}
              className="transition-transform duration-150 group-hover:scale-[1.01]"
            />
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Contraer la barra lateral"
            title="Contraer barra lateral"
            className="group flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-800 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 cursor-pointer motion-reduce:active:scale-100"
          >
            <SidebarToggleIcon collapsed={false} />
          </button>
        </div>

        {/* Versión contraída */}
        <div
          className={`absolute inset-0 flex items-center justify-center gap-1.5 px-2 transition-all duration-[180ms] ease-plf-glide motion-reduce:transition-none ${
            collapsed ? "opacity-100 pointer-events-auto scale-100" : "opacity-0 pointer-events-none scale-95"
          }`}
        >
          <Link
            to="/bandeja"
            className="flex size-7 items-center justify-center rounded-lg transition-opacity hover:opacity-90 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20"
            title="Plastifar · Ir a Bandeja"
          >
            <Logo variant="isotipo" height={22} />
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expandir la barra lateral"
            title="Expandir barra lateral"
            className="group flex size-7 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-800 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 cursor-pointer motion-reduce:active:scale-100"
          >
            <SidebarToggleIcon collapsed={true} />
          </button>
        </div>
      </div>

      {/* 2. Árbol de Navegación Principal con transición suave y ágil */}
      <nav className="no-scrollbar relative flex-1 overflow-y-auto overflow-x-hidden">
        {/* Modo Riel (Contraído) */}
        <div
          className={`flex flex-col items-center gap-2 p-2 transition-all duration-[180ms] ease-plf-glide motion-reduce:transition-none ${
            collapsed
              ? "opacity-100 pointer-events-auto scale-100"
              : "opacity-0 pointer-events-none scale-95 absolute inset-x-0 top-0"
          }`}
        >
          {visibleGroups.map((group) => (
            <div key={group.label} className="relative">
              <Link
                to={group.to ?? group.children![0].to}
                aria-label={group.label}
                onMouseEnter={(event) => openFlyout(group, event.currentTarget)}
                onMouseLeave={scheduleClose}
                onFocus={(event) => openFlyout(group, event.currentTarget)}
                onBlur={scheduleClose}
                className={`group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                  isGroupActive(group)
                    ? "bg-zinc-100/95 text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(24,24,27,0.04)] ring-1 ring-zinc-900/[0.06]"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 motion-reduce:active:scale-100"
                }`}
              >
                <ActiveMark active={isGroupActive(group)} className="-left-4" />
                <group.icon
                  className={`h-4.5 w-4.5 transition-colors ${
                    isGroupActive(group) ? "text-brand-red" : ""
                  }`}
                  strokeWidth={isGroupActive(group) ? 2.2 : 1.95}
                />

                {/* Badge con aviso de pendientes en modo contraído */}
                {group.label === "Correo" && pendingMail > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-red px-1 font-heading text-[9.5px] font-bold text-white shadow-[0_2px_6px_rgba(228,0,43,0.5)]">
                    {pendingMail > 99 ? "99+" : pendingMail}
                  </span>
                )}
              </Link>
            </div>
          ))}
        </div>

        {/* Modo Extendido (Expandido) */}
        <div
          className={`w-full space-y-4 p-2 transition-all duration-[180ms] ease-plf-glide motion-reduce:transition-none ${
            collapsed
              ? "opacity-0 pointer-events-none -translate-x-3 absolute inset-x-0 top-0"
              : "opacity-100 pointer-events-auto translate-x-0"
          }`}
        >
          {sections.map(({ section, groups }) => (
            <div key={section} className="flex flex-col">
              <p className="px-2.5 pb-1 font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
                {section}
              </p>
              <div className="flex flex-col gap-0.5">
                {groups.map(renderExpandedGroup)}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* 3. Flyout en Modo Contraído */}
      {collapsed && flyoutMotion.mounted && flyout && (
        <div
          ref={flyoutMotion.ref}
          aria-hidden={flyoutMotion.exiting}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ top: flyout.top, left: flyout.left, transformOrigin: "0 24px" }}
          className={`fixed z-40 w-[210px] rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-[0_8px_24px_-4px_rgba(27,27,29,0.12),0_2px_6px_rgba(27,27,29,0.04)] ${
            flyoutMotion.exiting ? "pointer-events-none" : ""
          }`}
        >
          <div
            data-motion-item
            className="flex items-center justify-between border-b border-zinc-100 px-2.5 pb-2 pt-1"
          >
            <span className="flex items-center gap-2 font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              <flyout.group.icon className="h-3.5 w-3.5 text-zinc-400" />
              {flyout.group.label}
            </span>
            {flyout.group.label === "Correo" && pendingMail > 0 && (
              <span className="rounded-full bg-brand-red/10 px-1.5 py-0.5 font-heading text-[10px] font-bold leading-none text-brand-red">
                {pendingMail}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {visibleChildren(flyout.group).map((child, index, all) => {
              const hasUnread = Boolean(child.folder && counts && counts[child.folder]?.unread > 0);
              const prevChild = index > 0 ? all[index - 1] : null;
              const showSubgroup = Boolean(child.subgroup && child.subgroup !== prevChild?.subgroup);

              return (
                <Fragment key={child.to}>
                  {showSubgroup && (
                    <div className="pt-2 pb-1 px-2.5 select-none border-t border-zinc-100/80 mt-1">
                      <p className="font-heading text-[9px] font-bold uppercase tracking-[0.09em] text-zinc-400">
                        {child.subgroup}
                      </p>
                    </div>
                  )}
                  <NavLink
                  key={child.to}
                  to={child.to}
                  end={child.end}
                  data-motion-item
                  onClick={() => setFlyoutOpen(false)}
                  className={({ isActive }) =>
                    `group relative flex h-[32px] items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand-red/25 outline-none ${
                      isActive
                        ? "bg-zinc-100/95 text-zinc-950 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(24,24,27,0.04)] ring-1 ring-zinc-900/[0.06]"
                        : hasUnread
                        ? "text-zinc-900 font-semibold hover:bg-zinc-100/70"
                        : "text-zinc-600 font-medium hover:bg-zinc-100/70 hover:text-zinc-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {child.icon && (
                        <child.icon
                          strokeWidth={isActive ? 2.2 : 1.9}
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive
                              ? "text-brand-red"
                              : hasUnread
                              ? "text-zinc-800"
                              : "text-zinc-400 group-hover:text-zinc-700"
                          }`}
                        />
                      )}
                      <span className="truncate flex-1">{child.label}</span>
                      {child.folder && counts && (
                        <FolderBadge count={counts[child.folder]} isActive={isActive} />
                      )}
                    </>
                  )}
                </NavLink>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Pie de Tarjeta de Usuario y Menú Desplegable */}
      <div className="shrink-0 border-t border-zinc-200/80 p-2" ref={menuRef}>
        <div className="relative">
          {/* Menú flotante de perfil */}
          {menuMotion.mounted && (
            <div
              ref={menuMotion.ref}
              role="menu"
              aria-hidden={menuMotion.exiting}
              style={{ transformOrigin: collapsed ? "0 24px" : "24px bottom" }}
              className={`absolute z-30 rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-[0_12px_32px_-6px_rgba(27,27,29,0.14),0_2px_8px_rgba(27,27,29,0.04)] ${
                collapsed
                  ? "left-[calc(100%+8px)] bottom-0 w-56"
                  : "left-0 right-0 bottom-[calc(100%+8px)] w-full"
              } ${menuMotion.exiting ? "pointer-events-none" : ""}`}
            >
              {/* Encabezado del usuario */}
              <div data-motion-item className="mb-1 flex items-center gap-2.5 border-b border-zinc-100 p-2">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 font-heading text-[11.5px] font-bold text-white shadow-xs">
                  {initials}
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-[12.5px] font-semibold text-zinc-900 leading-tight">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-zinc-400 leading-tight mt-0.5">{user?.email}</p>
                  <span className="mt-1 inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 font-heading text-[9.5px] font-semibold text-zinc-600 tracking-wide">
                    {user?.isAdmin ? "ADMINISTRADOR" : "COLABORADOR"}
                  </span>
                </div>
              </div>

              {/* Botones de opciones */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditingSignature(true);
                  }}
                  data-motion-item
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-zinc-700 transition-colors outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:bg-zinc-100 focus-visible:text-zinc-900"
                >
                  <PenLine className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                  <span>Tu firma de correo</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditingAlerts(true);
                  }}
                  data-motion-item
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-zinc-700 transition-colors outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:bg-zinc-100 focus-visible:text-zinc-900"
                >
                  <Bell className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                  <span>Avisos</span>
                  {!hasOpenedAlerts && (
                    <span className="ml-auto rounded-full bg-brand-red/10 px-1.5 py-0.5 font-heading text-[9.5px] font-bold text-brand-red">
                      Nuevo
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setChangingPassword(true);
                  }}
                  data-motion-item
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-zinc-700 transition-colors outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:bg-zinc-100 focus-visible:text-zinc-900"
                >
                  <KeyRound className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                  <span>Cambiar contraseña</span>
                </button>

                <div className="my-1 border-t border-zinc-100" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => logout()}
                  data-motion-item
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-brand-red-dark transition-colors outline-none hover:bg-brand-red/[0.06] focus-visible:bg-brand-red/[0.06]"
                >
                  <LogOut className="h-3.5 w-3.5 text-brand-red transition-colors" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          )}

          {/* Gatillo del perfil con transición ultra fluida */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={collapsed ? `${displayName} · ${user?.email}` : undefined}
            className={`group flex w-full items-center rounded-lg transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 cursor-pointer ${
              menuOpen
                ? "bg-zinc-100 text-zinc-900"
                : "hover:bg-zinc-100/80 text-zinc-700"
            } ${collapsed ? "justify-center p-1.5" : "p-1.5"}`}
          >
            {/* Avatar circular con aro y presencia en línea */}
            <div className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-zinc-900 font-heading text-[11px] font-bold text-white shadow-xs">
              {initials}
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
              />
            </div>

            {/* Contenedor del nombre y chevron con transición continua y rápida */}
            <div
              className={`flex min-w-0 flex-1 items-center justify-between transition-all duration-[200ms] ease-plf-glide motion-reduce:transition-none overflow-hidden ${
                collapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-[160px] opacity-100 pl-2.5"
              }`}
            >
              <div className="min-w-0 flex-1 text-left">
                <span className="block truncate font-heading text-[12.5px] font-semibold leading-tight text-zinc-800">
                  {displayName}
                </span>
                <span className="block truncate text-[11px] leading-tight text-zinc-400 mt-0.5 font-normal">
                  {user?.isAdmin ? "Administrador" : "Staff"}
                </span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${
                  menuOpen ? "rotate-180 text-zinc-800" : "group-hover:text-zinc-600"
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* 5. Crédito institucional: visible solo con la barra expandida */}
      {!collapsed && (
        <div className="shrink-0 border-t border-zinc-100 px-3 py-2">
          <a
            href="https://www.cquest.do/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-[10.5px] text-zinc-400 transition-colors hover:text-zinc-600"
          >
            <span>Desarrollado por</span>
            <img
              src="/brand/centerquest-icon.png"
              alt="Center Quest"
              width={13}
              height={13}
              draggable={false}
              className="select-none"
            />
            <span className="font-semibold text-zinc-600 hover:text-brand-red hover:underline underline-offset-2">
              Center Quest
            </span>
          </a>
        </div>
      )}

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
      {editingSignature && <SignatureModal onClose={() => setEditingSignature(false)} />}
      {editingAlerts && <NotificationsModal onClose={() => setEditingAlerts(false)} />}
    </aside>
  );
}

