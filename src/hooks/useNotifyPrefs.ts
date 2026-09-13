import { useSyncExternalStore } from "react";
import { readPrefs, subscribePrefs } from "../lib/notifications";

/** Preferencias de aviso, siempre al dia aunque las cambie otro punto del panel. */
export function useNotifyPrefs() {
  return useSyncExternalStore(subscribePrefs, readPrefs, readPrefs);
}
