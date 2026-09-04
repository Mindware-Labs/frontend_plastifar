import { HubConnectionBuilder, HttpTransportType, LogLevel } from "@microsoft/signalr";
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { emailsApi } from "../api/emails";
import { tokenStore } from "../api/tokenStore";
import type { EmailFolderCounts } from "../types/api";

type Listener = () => void;

interface EmailCountsValue {
  counts: EmailFolderCounts | null;
  refresh: () => void;
  /** Avisos del servidor cuando la bandeja cambia. Devuelve la baja de la suscripcion. */
  onInboxChanged: (listener: Listener) => () => void;
}

const BASE_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");

export const EmailCountsContext = createContext<EmailCountsValue>({
  counts: null,
  refresh: () => undefined,
  onInboxChanged: () => () => undefined,
});

/** Contadores del menu y canal en vivo: viven arriba porque los comparten la barra y la bandeja. */
export function EmailCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<EmailFolderCounts | null>(null);
  const listeners = useRef(new Set<Listener>());

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

  useEffect(refresh, [refresh]);

  useEffect(() => {
    function announce() {
      refresh();
      listeners.current.forEach((listener) => listener());
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
    // Mientras estuvo caido pudo entrar correo: al volver se recarga sin esperar el proximo aviso.
    connection.onreconnected(announce);
    connection.start().catch(() => undefined);

    return () => {
      connection.off("inbox:changed", announce);
      void connection.stop();
    };
  }, [refresh]);

  return (
    <EmailCountsContext.Provider value={{ counts, refresh, onInboxChanged }}>
      {children}
    </EmailCountsContext.Provider>
  );
}
