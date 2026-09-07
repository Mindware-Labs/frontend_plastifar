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
import type { ComposingPresence, EmailAssignment, EmailFolderCounts, InboxArrival } from "../types/api";

type Listener = () => void;
type ArrivalListener = (arrival: InboxArrival) => void;
type AssignmentListener = (assignment: EmailAssignment) => void;
type ComposingListener = (presence: ComposingPresence) => void;

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
});

/** Contadores del menu y canal en vivo: viven arriba porque los comparten la barra y la bandeja. */
export function EmailCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<EmailFolderCounts | null>(null);
  const listeners = useRef(new Set<Listener>());
  const arrivalListeners = useRef(new Set<ArrivalListener>());
  const assignmentListeners = useRef(new Set<AssignmentListener>());
  const composingListeners = useRef(new Set<ComposingListener>());
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
    // Mientras estuvo caido pudo entrar correo: al volver se recarga sin esperar el proximo aviso.
    connection.onreconnected(announce);
    connectionRef.current = connection;
    connection.start().catch(() => undefined);

    return () => {
      connection.off("inbox:changed", announce);
      connection.off("inbox:received", received);
      connection.off("inbox:assigned", assigned);
      connection.off("inbox:composing", composing);
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
      }}
    >
      {children}
    </EmailCountsContext.Provider>
  );
}
