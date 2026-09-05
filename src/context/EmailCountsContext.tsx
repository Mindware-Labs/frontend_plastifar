import { HubConnectionBuilder, HttpTransportType, LogLevel } from "@microsoft/signalr";
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { emailsApi } from "../api/emails";
import { tokenStore } from "../api/tokenStore";
import type { EmailFolderCounts, InboxArrival } from "../types/api";

type Listener = () => void;
type ArrivalListener = (arrival: InboxArrival) => void;

interface EmailCountsValue {
  counts: EmailFolderCounts | null;
  refresh: () => void;
  /** Avisos del servidor cuando la bandeja cambia. Devuelve la baja de la suscripcion. */
  onInboxChanged: (listener: Listener) => () => void;
  /** Correo recibido, con remitente y asunto: para sonar o avisar en el escritorio. */
  onInboxReceived: (listener: ArrivalListener) => () => void;
}

const BASE_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
const BASE_TITLE = "Plastifar · Panel interno";

export const EmailCountsContext = createContext<EmailCountsValue>({
  counts: null,
  refresh: () => undefined,
  onInboxChanged: () => () => undefined,
  onInboxReceived: () => () => undefined,
});

/** Contadores del menu y canal en vivo: viven arriba porque los comparten la barra y la bandeja. */
export function EmailCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<EmailFolderCounts | null>(null);
  const listeners = useRef(new Set<Listener>());
  const arrivalListeners = useRef(new Set<ArrivalListener>());

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
    // Mientras estuvo caido pudo entrar correo: al volver se recarga sin esperar el proximo aviso.
    connection.onreconnected(announce);
    connection.start().catch(() => undefined);

    return () => {
      connection.off("inbox:changed", announce);
      connection.off("inbox:received", received);
      void connection.stop();
    };
  }, [refresh]);

  return (
    <EmailCountsContext.Provider value={{ counts, refresh, onInboxChanged, onInboxReceived }}>
      {children}
    </EmailCountsContext.Provider>
  );
}
