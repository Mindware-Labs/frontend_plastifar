import { createContext, useContext } from "react";
import type { AppNotification } from "../types/api";

export type NotificationFilter = "all" | "unread";

export interface NotificationsValue {
  items: AppNotification[];
  unreadCount: number;
  filter: NotificationFilter;
  setFilter: (filter: NotificationFilter) => void;
  /** Primera carga de la lista: se pide al abrir el panel, no al entrar al panel interno. */
  status: "idle" | "loading" | "ready" | "error";
  hasMore: boolean;
  loadingMore: boolean;
  ensureLoaded: () => void;
  reload: () => void;
  loadMore: () => void;
  markRead: (id: number) => void;
  markUnread: (id: number) => void;
  markAllRead: () => void;
}

export const NotificationsContext = createContext<NotificationsValue>({
  items: [],
  unreadCount: 0,
  filter: "all",
  setFilter: () => undefined,
  status: "idle",
  hasMore: false,
  loadingMore: false,
  ensureLoaded: () => undefined,
  reload: () => undefined,
  loadMore: () => undefined,
  markRead: () => undefined,
  markUnread: () => undefined,
  markAllRead: () => undefined,
});

export function useNotifications() {
  return useContext(NotificationsContext);
}
