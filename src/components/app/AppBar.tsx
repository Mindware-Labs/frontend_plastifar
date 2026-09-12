import { Bell, ChevronRight, Menu as MenuIcon, Plus } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { resolveBreadcrumb } from "../../lib/breadcrumbs";
import type { ContextPart } from "../../layouts/pageChromeStore";
import { usePageChromeStore } from "../../layouts/usePageChrome";
import "./appbar.css";

/**
 * Barra de aplicación.
 *
 * Franja fija de 52 px con las migas de la ruta, las notificaciones y —cuando
 * la pantalla ya scrolleó— el título y la acción primaria que la cabecera de
 * página dejó de mostrar.
 *
 * Lo que NO lleva, a propósito:
 *
 *   · Buscador global — el Sidebar tenía el suyo, y dos campos que buscan cosas
 *     distintas en la misma pantalla es peor que no tener ninguno. Los dos se
 *     fueron.
 *   · Ayuda — un signo de interrogación que no abría nada.
 *   · Menú de perfil — vive en el Sidebar, que es de donde nunca se fue.
 *
 * Va ARRIBA de la zona de scroll, no dentro: por estar encima del elemento que
 * scrollea se queda quieta por construcción, sin `position: sticky` y sin que
 * ninguna pantalla ceda la propiedad de su scroll.
 */

/** Alto de la franja. Fijo: nunca scrollea. */
export const APP_BAR_HEIGHT = 52;

/** Bajo esto aparece el botón de menú y las migas se recortan al último tramo. */
const NARROW_BP = 900;

/**
 * Cuántos píxeles de scroll bastan para dar por ida la cabecera de página.
 *
 * No es un `IntersectionObserver` sobre un centinela porque la cabecera no vive
 * en esta barra: la monta cada pantalla dentro de SU zona de scroll, y esta
 * barra está por encima de esa zona. Sin centinela que observar, lo que queda es
 * mirar cuánto se desplazó el contenedor, que es el mismo hecho.
 */
const CONDENSE_AT = 40;

export interface AppBarNotification {
  id: string | number;
  title: string;
  meta: string;
  tone?: "danger" | "warning" | "success" | "neutral";
  unread?: boolean;
  onClick?: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Hooks                                                                      */
/* -------------------------------------------------------------------------- */

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);
  return ref;
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < NARROW_BP,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_BP - 1}px)`);
    const on = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/** `true` cuando la pantalla scrolleó lo suficiente para tapar su cabecera. */
function useCondensed(scrollRoot?: RefObject<HTMLElement | null>) {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const el = scrollRoot?.current;
    let frame = 0;

    // La primera lectura se agenda en el próximo cuadro en vez de correr dentro
    // del efecto: leer `scrollTop` y publicar estado en la misma pasada encadena
    // un segundo render antes de pintar.
    const apply = (value: boolean) => {
      frame = 0;
      setCondensed(value);
    };

    if (!el) {
      frame = requestAnimationFrame(() => apply(false));
      return () => {
        if (frame) cancelAnimationFrame(frame);
      };
    }

    const read = () => apply(el.scrollTop > CONDENSE_AT);
    const onScroll = () => {
      // Un cuadro por evento: el scroll dispara decenas por segundo y leer
      // `scrollTop` en cada uno fuerza al motor a recalcular el layout.
      if (frame === 0) frame = requestAnimationFrame(read);
    };

    frame = requestAnimationFrame(read);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollRoot]);

  return condensed;
}

/* -------------------------------------------------------------------------- */
/*  Primitivos                                                                 */
/* -------------------------------------------------------------------------- */

function Popover({ children, width = 190 }: { children: ReactNode; width?: number }) {
  return (
    <div
      className="pf-menu"
      role="menu"
      style={{
        position: "absolute",
        top: 38,
        right: 0,
        width,
        background: "#ffffff",
        border: "1px solid var(--color-line)",
        borderRadius: 10,
        boxShadow: "0 4px 8px rgba(27,27,29,0.04), 0 24px 48px -20px rgba(27,27,29,0.28)",
        padding: 5,
        zIndex: 100,
      }}
    >
      {children}
    </div>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
  dot,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  onClick?: () => void;
  active?: boolean;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      className="pf-ico"
      aria-label={label}
      onClick={onClick}
      style={{
        position: "relative",
        width: 32,
        height: 32,
        display: "grid",
        placeItems: "center",
        border: "none",
        borderRadius: 8,
        background: active ? "var(--color-fill)" : "transparent",
        color: active ? "var(--color-brand-gray)" : "var(--color-subtle)",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <Icon size={16} />
      {dot && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 6,
            right: 7,
            width: 7,
            height: 7,
            borderRadius: 99,
            background: "var(--color-brand-red)",
            border: "1.5px solid #ffffff",
          }}
        />
      )}
    </button>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{ width: 1, height: 22, background: "var(--color-line)", flexShrink: 0 }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Migas                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Se resuelven solas desde la ruta con `resolveBreadcrumb`, que camina el mismo
 * árbol que pinta el Sidebar. La pantalla no declara nada; las fichas publican
 * su nombre real con `useDynamicBreadcrumb` y el último segmento lo toma.
 */
function Breadcrumbs({
  items,
  collapse,
}: {
  items: { label: string; to?: string }[];
  collapse: boolean;
}) {
  const list = collapse && items.length > 1 ? items.slice(-1) : items;

  return (
    <nav aria-label="Ruta" style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      {list.map((crumb, i) => {
        const last = i === list.length - 1;
        if (last) {
          return (
            <span
              key={crumb.label}
              aria-current="page"
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--color-ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {crumb.label}
            </span>
          );
        }
        return (
          <Fragment key={crumb.label}>
            {crumb.to ? (
              <Link
                className="pf-crumb"
                to={crumb.to}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--color-subtle)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {crumb.label}
              </Link>
            ) : (
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-subtle)" }}>
                {crumb.label}
              </span>
            )}
            <ChevronRight size={12} color="var(--color-faint)" aria-hidden />
          </Fragment>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/*  Notificaciones                                                             */
/* -------------------------------------------------------------------------- */

const NOTE_TONE: Record<string, string> = {
  danger: "var(--color-brand-red)",
  warning: "var(--color-warn)",
  success: "var(--color-brand-green)",
  neutral: "var(--color-subtle)",
};

function NotificationsMenu({
  items,
  onMarkAllRead,
}: {
  items: AppBarNotification[];
  onMarkAllRead?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside(close);
  const unread = items.some((i) => i.unread);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <IconButton
        icon={Bell}
        label={`Notificaciones${unread ? ", hay sin leer" : ""}`}
        onClick={() => setOpen((o) => !o)}
        active={open}
        dot={unread}
      />
      {open && (
        <Popover width={288}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 9px 9px",
              borderBottom: "1px solid var(--color-line-soft)",
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-ink)" }}>
              Notificaciones
            </span>
            {onMarkAllRead && items.length > 0 && (
              <button
                type="button"
                className="pf-link"
                onClick={onMarkAllRead}
                style={{
                  border: "none",
                  background: "none",
                  fontFamily: "inherit",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--color-brand-red-dark)",
                  cursor: "pointer",
                }}
              >
                Marcar todas
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div style={{ padding: "20px 10px", textAlign: "center" }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-ink)" }}>
                Todo al día
              </p>
              <p style={{ fontSize: 11.5, color: "var(--color-subtle)", marginTop: 3 }}>
                Las alertas de plazo aparecerán aquí.
              </p>
            </div>
          ) : (
            items.map((n) => (
              <button
                type="button"
                key={n.id}
                className="pf-menu-item"
                role="menuitem"
                onClick={() => {
                  n.onClick?.();
                  close();
                }}
                style={{
                  display: "flex",
                  gap: 9,
                  width: "100%",
                  padding: 9,
                  border: "none",
                  background: "transparent",
                  borderRadius: 7,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: NOTE_TONE[n.tone ?? "neutral"],
                    marginTop: 5,
                    flexShrink: 0,
                  }}
                />
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--color-ink)",
                      lineHeight: 1.4,
                    }}
                  >
                    {n.title}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-subtle)" }}>{n.meta}</span>
                </span>
              </button>
            ))
          )}
        </Popover>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  La barra                                                                   */
/* -------------------------------------------------------------------------- */

export function AppBar({
  notifications = [],
  onMarkAllRead,
  onMenuClick,
}: {
  notifications?: AppBarNotification[];
  onMarkAllRead?: () => void;
  onMenuClick?: () => void;
}) {
  const { chrome, dynamicLabel } = usePageChromeStore();
  const location = useLocation();
  const narrow = useIsNarrow();
  const condensed = useCondensed(chrome.scrollRoot);

  const crumbs = useMemo(
    () => chrome.breadcrumbs ?? resolveBreadcrumb(location.pathname, dynamicLabel),
    [chrome.breadcrumbs, location.pathname, dynamicLabel],
  );

  /** El único ítem de contexto que sobrevive al condensado. */
  const danger = chrome.context?.find((c: ContextPart) => c.tone === "danger");

  return (
    <div
      className="pf-bar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: narrow ? 8 : 12,
        height: APP_BAR_HEIGHT,
        flexShrink: 0,
        padding: narrow ? "0 12px" : "0 18px",
        background: "#ffffff",
        borderBottom: "1px solid var(--color-line)",
        /* La sombra aparece SÓLO cuando hay contenido pasando por debajo. */
        boxShadow: condensed ? "0 1px 8px rgba(27,27,29,.06)" : "none",
        transition: "box-shadow .18s",
      }}
    >
      {narrow && onMenuClick && (
        <IconButton icon={MenuIcon} label="Abrir menú" onClick={onMenuClick} />
      )}

      <Breadcrumbs items={crumbs} collapse={narrow} />

      {condensed && !narrow && chrome.title && (
        <>
          <Divider />
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--color-ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {chrome.title}
          </span>
          {danger && (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--color-brand-red-dark)",
                whiteSpace: "nowrap",
              }}
            >
              {danger.text}
            </span>
          )}
        </>
      )}

      <span style={{ flex: 1, minWidth: 8 }} />

      {condensed && !narrow && chrome.primaryAction && (
        <button
          type="button"
          className="pf-btn"
          onClick={chrome.primaryAction.onClick}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 12px",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 700,
            color: "#ffffff",
            background: "var(--color-brand-red)",
            border: "1px solid var(--color-brand-red)",
            borderRadius: 8,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <Plus size={13} aria-hidden />
          {chrome.primaryAction.label}
        </button>
      )}

      <NotificationsMenu items={notifications} onMarkAllRead={onMarkAllRead} />
    </div>
  );
}
