import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { notificationsApi } from "../api/notifications";
import type { AppNotification } from "../types/api";
import { useEmailCounts } from "./useEmailCounts";
import { NotificationsContext, type NotificationFilter, type NotificationsValue } from "./useNotifications";

const PAGE = 30;

/** Notificaciones de la persona conectada: contador siempre al día y lista cargada a demanda. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { onNotification, onNotificationsChanged } = useEmailCounts();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilterState] = useState<NotificationFilter>("all");
  const [status, setStatus] = useState<NotificationsValue["status"]>("idle");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Cada carga lleva su turno: una respuesta vieja no pisa la de un filtro más reciente.
  const turn = useRef(0);
  const statusRef = useRef(status);
  const filterRef = useRef(filter);

  useEffect(() => {
    statusRef.current = status;
    filterRef.current = filter;
  }, [status, filter]);

  const load = useCallback((nextFilter: NotificationFilter) => {
    const mine = ++turn.current;
    setStatus("loading");
    notificationsApi
      .list({ unread: nextFilter === "unread" || undefined, take: PAGE })
      .then((page) => {
        if (mine !== turn.current) return;
        setItems(page.items);
        setUnreadCount(page.unreadCount);
        setHasMore(page.hasMore);
        setStatus("ready");
      })
      .catch(() => {
        if (mine === turn.current) setStatus("error");
      });
  }, []);

  const refreshCount = useCallback(() => {
    notificationsApi
      .unreadCount()
      .then((result) => setUnreadCount(result.unreadCount))
      .catch(() => undefined);
  }, []);

  useEffect(refreshCount, [refreshCount]);

  useEffect(
    () =>
      onNotification((notification) => {
        setUnreadCount((count) => count + 1);
        // Sin lista cargada no hay nada que anteponer: la primera apertura ya la trae.
        if (statusRef.current !== "idle") {
          setItems((current) => (current.some((n) => n.id === notification.id) ? current : [notification, ...current]));
        }
      }),
    [onNotification],
  );

  useEffect(
    () =>
      onNotificationsChanged(() => {
        if (statusRef.current === "idle") refreshCount();
        else load(filterRef.current);
      }),
    [onNotificationsChanged, refreshCount, load],
  );

  const ensureLoaded = useCallback(() => {
    if (statusRef.current === "idle" || statusRef.current === "error") load(filterRef.current);
  }, [load]);

  const reload = useCallback(() => load(filterRef.current), [load]);

  const setFilter = useCallback(
    (next: NotificationFilter) => {
      setFilterState(next);
      load(next);
    },
    [load],
  );

  const loadMore = useCallback(() => {
    const last = items[items.length - 1];
    if (!last || loadingMore) return;
    const mine = turn.current;
    setLoadingMore(true);
    notificationsApi
      .list({ unread: filter === "unread" || undefined, before: last.id, take: PAGE })
      .then((page) => {
        if (mine !== turn.current) return;
        setItems((current) => [...current, ...page.items.filter((n) => !current.some((c) => c.id === n.id))]);
        setHasMore(page.hasMore);
        setUnreadCount(page.unreadCount);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }, [items, loadingMore, filter]);

  const patch = useCallback((id: number, readAt: string | null) => {
    setItems((current) => current.map((n) => (n.id === id ? { ...n, readAt } : n)));
  }, []);

  const markRead = useCallback(
    (id: number) => {
      const target = items.find((n) => n.id === id);
      if (target?.readAt) return;
      patch(id, new Date().toISOString());
      setUnreadCount((count) => Math.max(0, count - 1));
      notificationsApi
        .markRead(id)
        .then((result) => setUnreadCount(result.unreadCount))
        .catch(() => {
          patch(id, null);
          refreshCount();
        });
    },
    [items, patch, refreshCount],
  );

  const markUnread = useCallback(
    (id: number) => {
      if (!items.find((n) => n.id === id)?.readAt) return;
      patch(id, null);
      setUnreadCount((count) => count + 1);
      notificationsApi
        .markUnread(id)
        .then((result) => setUnreadCount(result.unreadCount))
        .catch(() => reload());
    },
    [items, patch, reload],
  );

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setItems((current) => current.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnreadCount(0);
    notificationsApi.markAllRead().catch(() => reload());
  }, [reload]);

  const value = useMemo<NotificationsValue>(
    () => ({
      items,
      unreadCount,
      filter,
      setFilter,
      status,
      hasMore,
      loadingMore,
      ensureLoaded,
      reload,
      loadMore,
      markRead,
      markUnread,
      markAllRead,
    }),
    [items, unreadCount, filter, setFilter, status, hasMore, loadingMore, ensureLoaded, reload, loadMore, markRead, markUnread, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
