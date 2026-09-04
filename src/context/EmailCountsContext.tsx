import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { emailsApi } from "../api/emails";
import type { EmailFolderCounts } from "../types/api";

interface EmailCountsValue {
  counts: EmailFolderCounts | null;
  refresh: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const EmailCountsContext = createContext<EmailCountsValue>({
  counts: null,
  refresh: () => undefined,
});

/** Contadores del menu: viven arriba porque los pinta la barra y los mueve la bandeja. */
export function EmailCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<EmailFolderCounts | null>(null);

  const refresh = useCallback(() => {
    emailsApi
      .counts()
      .then(setCounts)
      .catch(() => undefined);
  }, []);

  useEffect(refresh, [refresh]);

  return (
    <EmailCountsContext.Provider value={{ counts, refresh }}>{children}</EmailCountsContext.Provider>
  );
}
