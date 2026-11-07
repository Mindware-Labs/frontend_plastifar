import {
  ArrowRightLeft,
  Bell,
  CheckCheck,
  Circle,
  Check,
  Hourglass,
  Mail,
  MailPlus,
  MessageSquareReply,
  Send,
  Settings2,
  StickyNote,
  TriangleAlert,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useNotifications, type NotificationFilter } from "../../context/useNotifications";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { openOverlay } from "../../hooks/overlayStack";
import type { AppNotification, NotificationKind } from "../../types/api";
import { Skeleton } from "../ui/Skeleton";

type Tone = "brand" | "emerald" | "amber" | "rose" | "sky" | "zinc";

/** Icono, tono y módulo de cada tipo: el panel nunca interpreta el texto. */
const KIND: Record<NotificationKind, { icon: LucideIcon; tone: Tone; module: string }> = {
  TicketAssigned: { icon: UserRoundCheck, tone: "brand", module: "Ticket" },
  TicketStatusChanged: { icon: ArrowRightLeft, tone: "sky", module: "Ticket" },
  TicketClientReply: { icon: MessageSquareReply, tone: "emerald", module: "Ticket" },
  TicketInternalNote: { icon: StickyNote, tone: "amber", module: "Ticket" },
  TicketReply: { icon: Send, tone: "zinc", module: "Ticket" },
  TicketSlaWarning: { icon: Hourglass, tone: "amber", module: "SLA" },
  TicketSlaBreach: { icon: TriangleAlert, tone: "rose", module: "SLA" },
  EmailAssigned: { icon: MailPlus, tone: "brand", module: "Correo" },
  EmailReceived: { icon: Mail, tone: "sky", module: "Correo" },
};

const TONE: Record<Tone, string> = {
  brand: "border-brand-red/20 bg-brand-red/[0.07] text-brand-red",
  emerald: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200/80 bg-amber-50 text-amber-700",
  rose: "border-rose-200/80 bg-rose-50 text-rose-700",
  sky: "border-sky-200/80 bg-sky-50 text-sky-700",
  zinc: "border-zinc-200/80 bg-zinc-50 text-zinc-600",
};

const FALLBACK = { icon: Bell, tone: "zinc" as Tone, module: "Aviso" };

const PANEL_WIDTH = 340;
const PANEL_MAX_HEIGHT = 480;
const GAP = 8;

const timeFormat = new Intl.DateTimeFormat("es-DO", { hour: "2-digit", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short" });

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Hace cuánto, en el tono de una bandeja: corto y sin segundos. */
function relativeTime(iso: string, now: number) {
  const date = new Date(iso);
  const minutes = Math.floor((now - date.getTime()) / 60_000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (startOfDay(date) === startOfDay(new Date(now))) return `Hace ${Math.floor(minutes / 60)} h`;
  return `${dateFormat.format(date)}, ${timeFormat.format(date)}`;
}

function groupLabel(iso: string, now: number) {
  const day = startOfDay(new Date(iso));
  const today = startOfDay(new Date(now));
  const diff = Math.round((today - day) / 86_400_000);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff < 7) return "Esta semana";
  return "Anteriores";
}

/** Campana fija al pie de la barra lateral: contador visible siempre y se mece cuando llega algo. */
export function NotificationsBell({
  open,
  collapsed,
  onToggle,
}: {
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { unreadCount } = useNotifications();
  const { onNotification } = useEmailCounts();
  const [ring, setRing] = useState(0);
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);
  const label = unreadCount > 0 ? `Notificaciones · ${unreadCount} sin leer` : "Notificaciones";

  useEffect(() => onNotification(() => setRing((n) => n + 1)), [onNotification]);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={label}
      title={label}
      className={`group relative flex size-8 shrink-0 items-center justify-center rounded-lg outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand-red/25 active:scale-95 motion-reduce:active:scale-100 cursor-pointer select-none ${
        open
          ? "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-900/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
          : unreadCount > 0
            ? "text-zinc-800 hover:bg-zinc-100/80"
            : "text-faint hover:bg-zinc-100/80 hover:text-zinc-800"
      } ${collapsed ? "mx-auto" : ""}`}
    >
      <Bell
        key={ring}
        strokeWidth={open || unreadCount > 0 ? 2.1 : 1.9}
        className={`h-4 w-4 ${ring > 0 ? "animate-plf-bell-ring" : ""}`}
      />
      {unreadCount > 0 && (
        <span
          key={`badge-${ring}`}
          aria-hidden
          className={`absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand-red px-[3px] font-heading text-[9px] font-bold leading-none text-white tabular-nums ring-2 ring-white shadow-[0_2px_6px_rgba(228,0,43,0.35)] ${
            ring > 0 ? "animate-plf-seal-pop" : ""
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/** Panel que se abre junto a la barra lateral desde la campana. */
export function NotificationsPanel({
  open,
  anchorRef,
  onClose,
  onOpenSettings,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const { ensureLoaded } = useNotifications();
  const motion = useDisclosureMotion<HTMLDivElement>(open, { itemStagger: false });
  const panelRef = motion.ref;

  // La lista se pide la primera vez que se abre; el contador ya llega solo.
  useEffect(() => {
    if (open) ensureLoaded();
  }, [open, ensureLoaded]);
  const [place, setPlace] = useState({ left: 0, bottom: GAP });
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Junto a la barra lateral y a la altura de la campana, como cualquier menú del pie.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const anchor = anchorRef.current;
      const aside = anchor?.closest("aside");
      const bottom = anchor ? window.innerHeight - anchor.getBoundingClientRect().bottom + GAP : GAP;
      setPlace({ left: (aside?.getBoundingClientRect().right ?? 0) + GAP, bottom: Math.max(GAP, bottom) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const overlay = openOverlay();

    function pointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    }
    function keyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && overlay.isTop()) onCloseRef.current();
    }

    document.addEventListener("pointerdown", pointerDown);
    document.addEventListener("keydown", keyDown);
    return () => {
      overlay.close();
      document.removeEventListener("pointerdown", pointerDown);
      document.removeEventListener("keydown", keyDown);
    };
  }, [open, anchorRef, panelRef]);

  if (!motion.mounted) return null;

  const style: CSSProperties = {
    left: place.left,
    bottom: place.bottom,
    width: `min(${PANEL_WIDTH}px, calc(100vw - ${place.left + GAP}px))`,
    maxHeight: `min(${PANEL_MAX_HEIGHT}px, calc(100vh - ${place.bottom + GAP}px))`,
    transformOrigin: "0 100%",
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notificaciones"
      aria-hidden={motion.exiting}
      style={style}
      className={`no-print fixed z-40 flex flex-col overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-[0_12px_32px_-6px_rgba(27,27,29,0.16),0_2px_8px_rgba(27,27,29,0.05)] ${
        motion.exiting ? "pointer-events-none" : ""
      }`}
    >
      <PanelBody onClose={onClose} onOpenSettings={onOpenSettings} />
    </div>,
    document.body,
  );
}

/** Se monta con cada apertura: la hora de referencia nace fresca y no hace falta reiniciarla. */
function PanelBody({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  const { items, unreadCount, filter, setFilter, status, hasMore, loadingMore, reload, loadMore, markRead, markUnread, markAllRead } =
    useNotifications();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  // Los "hace 5 min" envejecen mientras el panel está abierto.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo(() => {
    const out: { label: string; items: AppNotification[] }[] = [];
    for (const item of items) {
      const label = groupLabel(item.createdAt, now);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [items, now]);

  function openItem(notification: AppNotification) {
    markRead(notification.id);
    onClose();
    navigate(notification.link);
  }

  return (
    <>
      <header className="flex shrink-0 items-center gap-1 border-b border-zinc-100 py-1.5 pr-1.5 pl-3">
        <h2 className="mr-1.5 font-heading text-[13px] font-semibold text-ink">Notificaciones</h2>
        <FilterTabs value={filter} unread={unreadCount} onChange={setFilter} />
        <div className="ml-auto flex items-center">
          <IconButton label="Marcar todo como leído" disabled={unreadCount === 0} onClick={markAllRead}>
            <CheckCheck className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Preferencias de avisos" onClick={onOpenSettings}>
            <Settings2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {status === "loading" && items.length === 0 && <ListSkeleton />}

        {status === "error" && (
          <div className="flex flex-col items-center gap-2.5 px-5 py-8 text-center">
            <p className="text-[12px] text-zinc-500">No se pudieron cargar tus notificaciones.</p>
            <button
              type="button"
              onClick={reload}
              className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11.5px] font-medium text-zinc-700 shadow-2xs transition-colors hover:bg-zinc-50 cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {status === "ready" && items.length === 0 && <EmptyState filter={filter} />}

        {items.length > 0 && (
          <div className={`flex flex-col pb-1.5 transition-opacity duration-150 ${status === "loading" ? "opacity-60" : ""}`}>
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <p className="sticky top-0 z-[1] bg-white/95 px-3 pt-2 pb-1 font-heading text-[9.5px] font-bold uppercase tracking-[0.1em] text-faint backdrop-blur-sm">
                  {group.label}
                </p>
                <ul className="flex flex-col px-1.5">
                  {group.items.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      now={now}
                      onOpen={() => openItem(notification)}
                      onToggleRead={() =>
                        notification.readAt ? markUnread(notification.id) : markRead(notification.id)
                      }
                    />
                  ))}
                </ul>
              </section>
            ))}

            {hasMore && (
              <div className="px-1.5 pt-1">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full rounded-md py-1.5 text-[11.5px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                >
                  {loadingMore ? "Cargando…" : "Ver anteriores"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function NotificationRow({
  notification,
  now,
  onOpen,
  onToggleRead,
}: {
  notification: AppNotification;
  now: number;
  onOpen: () => void;
  onToggleRead: () => void;
}) {
  const meta = KIND[notification.kind] ?? FALLBACK;
  const Icon = meta.icon;
  const unread = notification.readAt === null;

  return (
    <li
      className="group/row relative"
      // Una fila nueva se monta una sola vez por clave: la entrada no se repite en cada render.
      style={{ animation: "plf-list-row-in 0.32s var(--ease-plf-spring) both" }}
    >
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 pr-8 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-red/25 cursor-pointer ${
          unread ? "bg-brand-red/[0.025] hover:bg-zinc-100/80" : "hover:bg-zinc-100/70"
        }`}
      >
        <span
          aria-hidden
          className={`mt-px flex size-7 shrink-0 items-center justify-center rounded-md border ${TONE[meta.tone]} ${
            unread ? "" : "opacity-70"
          }`}
        >
          <Icon className="size-3.5" strokeWidth={2} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`text-[12px] leading-snug ${unread ? "font-semibold text-ink" : "font-medium text-zinc-600"}`}>
            {notification.title}
          </span>
          {notification.body && (
            <span className="truncate text-[11.5px] leading-snug text-zinc-500">{notification.body}</span>
          )}
          <span className="mt-0.5 flex items-center gap-1 text-[10.5px] text-faint">
            <span className="font-medium text-zinc-500">{meta.module}</span>
            <span aria-hidden>·</span>
            <time dateTime={notification.createdAt} title={new Date(notification.createdAt).toLocaleString("es-DO")}>
              {relativeTime(notification.createdAt, now)}
            </time>
          </span>
        </span>
      </button>

      {unread && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-3 right-3 size-1.5 rounded-full bg-brand-red transition-opacity duration-150 group-hover/row:opacity-0 group-focus-within/row:opacity-0"
        />
      )}

      <button
        type="button"
        onClick={onToggleRead}
        aria-label={unread ? "Marcar como leída" : "Marcar como no leída"}
        title={unread ? "Marcar como leída" : "Marcar como no leída"}
        className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md text-faint opacity-0 outline-none transition-all duration-150 hover:bg-white hover:text-zinc-800 hover:shadow-2xs focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-red/25 group-hover/row:opacity-100 cursor-pointer"
      >
        {unread ? <Check className="size-3" strokeWidth={2.4} /> : <Circle className="size-2.5" strokeWidth={2.6} />}
      </button>
    </li>
  );
}

function FilterTabs({
  value,
  unread,
  onChange,
}: {
  value: NotificationFilter;
  unread: number;
  onChange: (value: NotificationFilter) => void;
}) {
  const options: { key: NotificationFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "unread", label: unread > 0 ? `Sin leer · ${unread > 99 ? "99+" : unread}` : "Sin leer" },
  ];

  return (
    <div role="tablist" aria-label="Filtrar notificaciones" className="inline-flex rounded-md bg-zinc-100/80 p-0.5">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => !active && onChange(option.key)}
            className={`rounded-[5px] px-2 py-0.5 text-[11px] font-medium whitespace-nowrap tabular-nums outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand-red/25 cursor-pointer ${
              active ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.08)] ring-1 ring-zinc-900/[0.05]" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-zinc-500 outline-none transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand-red/25 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-zinc-500 cursor-pointer"
    >
      {children}
    </button>
  );
}

function EmptyState({ filter }: { filter: NotificationFilter }) {
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      <span className="mb-2 flex size-8 items-center justify-center rounded-lg border border-zinc-200/80 bg-zinc-50 text-faint shadow-2xs">
        {filter === "unread" ? <CheckCheck className="size-4" /> : <Bell className="size-4" />}
      </span>
      <p className="font-heading text-[12.5px] font-semibold text-ink">
        {filter === "unread" ? "Estás al día" : "Aún no tienes notificaciones"}
      </p>
      <p className="mt-0.5 max-w-[240px] text-[11.5px] leading-relaxed text-zinc-500">
        {filter === "unread"
          ? "No hay nada pendiente de leer."
          : "Aquí verás lo que pase con tus tickets y correos: asignaciones, respuestas, cambios de estado y alertas de SLA."}
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col px-3.5 py-2" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-start gap-2.5 py-2">
          <Skeleton className="size-7 shrink-0 rounded-md" delay={index * 60} />
          <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
            <Skeleton className="h-3 w-4/5" delay={index * 60} />
            <Skeleton className="h-2.5 w-3/5" delay={index * 60} />
            <Skeleton className="h-2 w-1/4" delay={index * 60} />
          </div>
        </div>
      ))}
    </div>
  );
}
