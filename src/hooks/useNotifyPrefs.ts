import { useSyncExternalStore } from "react";
import { hasOpenedNotifications, readPrefs, subscribePrefs } from "../lib/notifications";

/** Preferencias de aviso, siempre al dia aunque las cambie otro punto del panel. */
export function useNotifyPrefs() {
  return useSyncExternalStore(subscribePrefs, readPrefs, readPrefs);
}

/** Indica si el usuario ya abrió o configuró los avisos alguna vez. */
export function useHasOpenedNotifications() {
  return useSyncExternalStore(subscribePrefs, hasOpenedNotifications, () => true);
}
