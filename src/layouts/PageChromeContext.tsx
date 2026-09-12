import { useMemo, useState, type ReactNode } from "react";
import {
  PageChromeContext,
  type PageChrome,
  type PageChromeStore,
} from "./pageChromeStore";

/** Guarda lo que la pantalla montada declaró para la barra. */
export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<PageChrome>({});
  const [dynamicLabel, setDynamicLabel] = useState<string | null>(null);

  const value = useMemo<PageChromeStore>(
    () => ({
      chrome,
      setChrome: (next) => setChromeState(next ?? {}),
      dynamicLabel,
      setDynamicLabel,
    }),
    [chrome, dynamicLabel],
  );

  return <PageChromeContext.Provider value={value}>{children}</PageChromeContext.Provider>;
}
