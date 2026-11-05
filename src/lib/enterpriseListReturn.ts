import type { NavigateFunction } from "react-router-dom";

const STORAGE_KEY = "plf-enterprise-list-return";

export interface EnterpriseListReturnRecord {
  listPath: string;
  listState: Record<string, unknown>;
  scrollY: number;
  ticketId: number;
  bannerTitle: string;
  bannerDetail?: string;
}

export interface PlfListRestorePayload {
  scrollY: number;
  state: Record<string, unknown>;
}

export type PlfListLocationState = {
  plfListRestore?: PlfListRestorePayload;
  plfListMotion?: "back";
  plfTicketEnter?: "enterprise-list";
};

export function captureListScrollY(): number {
  const main = document.querySelector("main");
  if (main instanceof HTMLElement && main.scrollHeight > main.clientHeight) {
    return main.scrollTop;
  }
  return window.scrollY || document.documentElement.scrollTop || 0;
}

export function restoreListScrollY(scrollY: number) {
  const main = document.querySelector("main");
  if (main instanceof HTMLElement && main.scrollHeight > main.clientHeight) {
    main.scrollTop = scrollY;
    return;
  }
  window.scrollTo({ top: scrollY, behavior: "auto" });
}

export function saveEnterpriseListReturn(record: EnterpriseListReturnRecord) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* quota / private mode */
  }
}

export function readEnterpriseListReturn(): EnterpriseListReturnRecord | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EnterpriseListReturnRecord;
  } catch {
    return null;
  }
}

export function clearEnterpriseListReturn() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function navigateToTicketFullView(
  navigate: NavigateFunction,
  ticketUrl: string,
  ticketId: number,
  snapshot: Omit<EnterpriseListReturnRecord, "ticketId">,
) {
  saveEnterpriseListReturn({ ...snapshot, ticketId });
  navigate(ticketUrl, { state: { plfTicketEnter: "enterprise-list" satisfies PlfListLocationState["plfTicketEnter"] } });
}
