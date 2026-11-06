import { apiRequest, toQuery } from "./client";
import type { NotificationPage } from "../types/api";

export const notificationsApi = {
  list: (query: { unread?: boolean; before?: number; take?: number } = {}) =>
    apiRequest<NotificationPage>(`/api/notifications${toQuery({ ...query })}`),

  unreadCount: () => apiRequest<{ unreadCount: number }>("/api/notifications/unread-count"),

  markRead: (id: number) =>
    apiRequest<{ unreadCount: number }>(`/api/notifications/${id}/read`, { method: "POST" }),

  markUnread: (id: number) =>
    apiRequest<{ unreadCount: number }>(`/api/notifications/${id}/unread`, { method: "POST" }),

  markAllRead: () => apiRequest<{ unreadCount: number }>("/api/notifications/read-all", { method: "POST" }),
};
