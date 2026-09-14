import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from "@microsoft/signalr";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { refreshSession } from "../api/client";
import { emailsApi } from "../api/emails";
import { tokenStore } from "../api/tokenStore";
import { API_URL } from "../lib/env";
import { decodeAccessToken } from "../lib/jwt";
import type {
  ComposingPresence,
  EmailAssignment,
  EmailFolderCounts,
  InboxArrival,
  TicketAssignmentNotice,
  TicketNewMessageNotice,
  TicketSlaNotice,
  TicketStatusChangeNotice,
} from "../types/api";
import {
  EmailCountsContext,
  type ArrivalListener,
  type AssignmentListener,
  type ComposingListener,
  type Listener,
  type TicketAssignmentListener,
  type TicketNewMessageListener,
  type TicketSlaListener,
  type TicketStatusChangeListener,
} from "./useEmailCounts";

const BASE_TITLE = "Plastifar · Panel interno";

/** Un token a punto de vencer no sirve para negociar: se rota antes de entregarlo al hub. */
const TOKEN_MARGIN_MS = 30_000;

/** Reintentos del arranque cuando el hub no responde: 2 s que se duplican hasta 30 s. */
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 30_000;

async function freshAccessToken(): Promise<string> {
  const current = tokenStore.getAccessToken();
  const exp = current ? decodeAccessToken(current)?.exp : undefined;
  const expiresSoon = exp === undefined || exp * 1000 - Date.now() < TOKEN_MARGIN_MS;

  if (expiresSoon) await refreshSession();
  return tokenStore.getAccessToken() ?? "";
}

/** Contadores del menu y canal en vivo: viven arriba porque los comparten la barra y la bandeja. */
export function EmailCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<EmailFolderCounts | null>(null);
  const listeners = useRef(new Set<Listener>());
  const arrivalListeners = useRef(new Set<ArrivalListener>());
  const assignmentListeners = useRef(new Set<AssignmentListener>());
  const composingListeners = useRef(new Set<ComposingListener>());
  const ticketChangeListeners = useRef(new Set<Listener>());
  const ticketAssignListeners = useRef(new Set<TicketAssignmentListener>());
  const ticketStatusListeners = useRef(new Set<TicketStatusChangeListener>());
  const ticketMessageListeners = useRef(new Set<TicketNewMessageListener>());
  const ticketSlaListeners = useRef(new Set<TicketSlaListener>());
  const connectionRef = useRef<HubConnection | null>(null);

  const refresh = useCallback(() => {
    emailsApi
      .counts()
      .then(setCounts)
      .catch(() => undefined);
  }, []);

  const onInboxChanged = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener) as unknown as void;
  }, []);

  const onInboxReceived = useCallback((listener: ArrivalListener) => {
    arrivalListeners.current.add(listener);
    return () => arrivalListeners.current.delete(listener) as unknown as void;
  }, []);

  const onInboxAssigned = useCallback((listener: AssignmentListener) => {
    assignmentListeners.current.add(listener);
    return () => assignmentListeners.current.delete(listener) as unknown as void;
  }, []);

  const onComposing = useCallback((listener: ComposingListener) => {
    composingListeners.current.add(listener);
    return () => composingListeners.current.delete(listener) as unknown as void;
  }, []);

  const onTicketsChanged = useCallback((listener: Listener) => {
    ticketChangeListeners.current.add(listener);
    return () => ticketChangeListeners.current.delete(listener) as unknown as void;
  }, []);

  const onTicketAssigned = useCallback((listener: TicketAssignmentListener) => {
    ticketAssignListeners.current.add(listener);
    return () => ticketAssignListeners.current.delete(listener) as unknown as void;
  }, []);

  const onTicketStatusChanged = useCallback((listener: TicketStatusChangeListener) => {
    ticketStatusListeners.current.add(listener);
    return () => ticketStatusListeners.current.delete(listener) as unknown as void;
  }, []);

  const onTicketNewMessage = useCallback((listener: TicketNewMessageListener) => {
    ticketMessageListeners.current.add(listener);
    return () => ticketMessageListeners.current.delete(listener) as unknown as void;
  }, []);

  const onTicketSlaAlert = useCallback((listener: TicketSlaListener) => {
    ticketSlaListeners.current.add(listener);
    return () => ticketSlaListeners.current.delete(listener) as unknown as void;
  }, []);

  // Si el canal esta caido el aviso se pierde: es una cortesia, no un dato.
  const setComposing = useCallback((emailId: number, active: boolean) => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return;
    connection.invoke("SetComposing", emailId, active).catch(() => undefined);
  }, []);

  const whoIsComposing = useCallback(async (emailId: number) => {
    const connection = connectionRef.current;
    if (connection?.state !== HubConnectionState.Connected) return [];
    try {
      return (await connection.invoke<ComposingPresence[]>("WhoIsComposing", emailId)) ?? [];
    } catch {
      return [];
    }
  }, []);

  useEffect(refresh, [refresh]);

  // El titulo de la pestana cuenta lo que hay sin leer: se ve desde cualquier otra ventana.
  useEffect(() => {
    const unread = counts?.inbox.unread ?? 0;
    document.title = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${BASE_TITLE}` : BASE_TITLE;

    return () => {
      document.title = BASE_TITLE;
    };
  }, [counts]);

  useEffect(() => {
    function announce() {
      refresh();
      listeners.current.forEach((listener) => listener());
    }

    function received(arrival: InboxArrival) {
      arrivalListeners.current.forEach((listener) => listener(arrival));
    }

    function assigned(assignment: EmailAssignment) {
      assignmentListeners.current.forEach((listener) => listener(assignment));
    }

    function composing(presence: ComposingPresence) {
      composingListeners.current.forEach((listener) => listener(presence));
    }

    function ticketChanged() {
      ticketChangeListeners.current.forEach((listener) => listener());
    }

    function ticketAssigned(notice: TicketAssignmentNotice) {
      ticketAssignListeners.current.forEach((listener) => listener(notice));
    }

    function ticketStatusChanged(notice: TicketStatusChangeNotice) {
      ticketStatusListeners.current.forEach((listener) => listener(notice));
    }

    function ticketNewMessage(notice: TicketNewMessageNotice) {
      ticketMessageListeners.current.forEach((listener) => listener(notice));
    }

    function ticketSlaAlert(notice: TicketSlaNotice) {
      ticketSlaListeners.current.forEach((listener) => listener(notice));
    }

    // Sin fijar transporte: si el WebSocket no pasa por el proxy, SignalR baja a SSE o long polling solo.
    const connection = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/inbox`, { accessTokenFactory: freshAccessToken })
      .withAutomaticReconnect([0, 2000, 10000, 30000, 60000])
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on("inbox:changed", announce);
    connection.on("inbox:received", received);
    connection.on("inbox:assigned", assigned);
    connection.on("inbox:composing", composing);
    connection.on("tickets:changed", ticketChanged);
    connection.on("tickets:assigned", ticketAssigned);
    connection.on("tickets:status_changed", ticketStatusChanged);
    connection.on("tickets:new_message", ticketNewMessage);
    connection.on("tickets:sla_alert", ticketSlaAlert);

    // Mientras estuvo caido pudo entrar correo o haber cambios en tickets: al volver se recarga sin esperar el proximo aviso.
    connection.onreconnected(() => {
      announce();
      ticketChanged();
    });

    let mounted = true;
    let retryDelay = RETRY_MIN_MS;
    let retryTimer: number | null = null;

    // El arranque y cada caida definitiva (agotados los reintentos automaticos) vuelven a intentar con espera creciente.
    function scheduleStart() {
      if (!mounted || retryTimer !== null) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void start();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    }

    async function start() {
      if (!mounted || connection.state !== HubConnectionState.Disconnected) return;
      try {
        await connection.start();
        retryDelay = RETRY_MIN_MS;
        announce();
        ticketChanged();
      } catch {
        scheduleStart();
      }
    }

    connection.onclose(() => {
      if (mounted) scheduleStart();
    });

    connectionRef.current = connection;
    void start();

    return () => {
      mounted = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      connection.off("inbox:changed", announce);
      connection.off("inbox:received", received);
      connection.off("inbox:assigned", assigned);
      connection.off("inbox:composing", composing);
      connection.off("tickets:changed", ticketChanged);
      connection.off("tickets:assigned", ticketAssigned);
      connection.off("tickets:status_changed", ticketStatusChanged);
      connection.off("tickets:new_message", ticketNewMessage);
      connection.off("tickets:sla_alert", ticketSlaAlert);
      connectionRef.current = null;
      void connection.stop();
    };
  }, [refresh]);

  return (
    <EmailCountsContext.Provider
      value={{
        counts,
        refresh,
        onInboxChanged,
        onInboxReceived,
        onInboxAssigned,
        onComposing,
        setComposing,
        whoIsComposing,
        onTicketsChanged,
        onTicketAssigned,
        onTicketStatusChanged,
        onTicketNewMessage,
        onTicketSlaAlert,
      }}
    >
      {children}
    </EmailCountsContext.Provider>
  );
}
