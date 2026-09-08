import {
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { emailsApi } from "../api/emails";
import { tokenStore } from "../api/tokenStore";
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

type Listener = () => void;
type ArrivalListener = (arrival: InboxArrival) => void;
type AssignmentListener = (assignment: EmailAssignment) => void;
type ComposingListener = (presence: ComposingPresence) => void;
type TicketAssignmentListener = (notice: TicketAssignmentNotice) => void;
type TicketStatusChangeListener = (notice: TicketStatusChangeNotice) => void;
type TicketNewMessageListener = (notice: TicketNewMessageNotice) => void;
type TicketSlaListener = (notice: TicketSlaNotice) => void;

interface EmailCountsValue {
  counts: EmailFolderCounts | null;
  refresh: () => void;
  /** Avisos del servidor cuando la bandeja cambia. Devuelve la baja de la suscripcion. */
  onInboxChanged: (listener: Listener) => () => void;
  /** Correo recibido, con remitente y asunto: para sonar o avisar en el escritorio. */
  onInboxReceived: (listener: ArrivalListener) => () => void;
  /** Le asignaron una conversacion a esta persona: para sonar o avisar en el escritorio. */
  onInboxAssigned: (listener: AssignmentListener) => () => void;
  /** Otra persona empezo o dejo de escribir en una conversacion. */
  onComposing: (listener: ComposingListener) => () => void;
  /** Avisa al resto que se esta escribiendo (o ya no) en esta conversacion. */
  setComposing: (emailId: number, active: boolean) => void;
  /** Quienes estan escribiendo ahora mismo en la conversacion. */
  whoIsComposing: (emailId: number) => Promise<ComposingPresence[]>;
  /** Avisos del servidor cuando la bandeja de tickets cambia. */
  onTicketsChanged: (listener: Listener) => () => void;
  /** Aviso de ticket asignado en tiempo real. */
  onTicketAssigned: (listener: TicketAssignmentListener) => () => void;
  /** Aviso de cambio de estado de un ticket. */
  onTicketStatusChanged: (listener: TicketStatusChangeListener) => () => void;
  /** Aviso de nuevo mensaje en un ticket. */
  onTicketNewMessage: (listener: TicketNewMessageListener) => () => void;
  /** Alerta de SLA (vencido o por vencer). */
  onTicketSlaAlert: (listener: TicketSlaListener) => () => void;
}

const BASE_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
const BASE_TITLE = "Plastifar · Panel interno";

export const EmailCountsContext = createContext<EmailCountsValue>({
  counts: null,
  refresh: () => undefined,
  onInboxChanged: () => () => undefined,
  onInboxReceived: () => () => undefined,
  onInboxAssigned: () => () => undefined,
  onComposing: () => () => undefined,
  setComposing: () => undefined,
  whoIsComposing: () => Promise.resolve([]),
  onTicketsChanged: () => () => undefined,
  onTicketAssigned: () => () => undefined,
  onTicketStatusChanged: () => () => undefined,
  onTicketNewMessage: () => () => undefined,
  onTicketSlaAlert: () => () => undefined,
});

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

    const connection = new HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/inbox`, {
        accessTokenFactory: () => tokenStore.getAccessToken() ?? "",
        transport: HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
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
    connectionRef.current = connection;
    connection.start().catch(() => undefined);

    return () => {
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
