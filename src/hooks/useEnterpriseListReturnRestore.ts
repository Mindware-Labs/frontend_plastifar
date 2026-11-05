import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  type PlfListLocationState,
  type PlfListRestorePayload,
  restoreListScrollY,
} from "../lib/enterpriseListReturn";

interface Options {
  /** Aplica filtros, orden y demás estado del listado (sin página ni drawer). */
  applyListState: (state: Record<string, unknown>) => void;
  setPage: (page: number) => void;
  /** Abre de nuevo el drawer JIT del resumen ejecutivo. */
  openSummary: (summaryId: number) => void;
  /** Espera a que el listado termine de cargar antes de paginar / drawer / scroll. */
  listReady: boolean;
}

/**
 * Restaura listado + drawer al volver desde la ficha de ticket (ver ficha completa).
 */
export function useEnterpriseListReturnRestore({
  applyListState,
  setPage,
  openSummary,
  listReady,
}: Options) {
  const location = useLocation();
  const navigate = useNavigate();
  const [listEnterMotion, setListEnterMotion] = useState<"forward" | "back">("forward");
  const pendingRef = useRef<(PlfListRestorePayload & { phase: "filters" | "done" }) | null>(null);
  const applyRef = useRef(applyListState) as MutableRefObject<typeof applyListState>;
  const consumedPathRef = useRef<string | null>(null);

  applyRef.current = applyListState;

  useLayoutEffect(() => {
    const state = location.state as PlfListLocationState | null;
    if (!state?.plfListRestore) return;
    if (consumedPathRef.current === location.key) return;

    consumedPathRef.current = location.key;
    pendingRef.current = { ...state.plfListRestore, phase: "filters" };
    if (state.plfListMotion === "back") {
      setListEnterMotion("back");
    }
    applyRef.current(state.plfListRestore.state);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || pending.phase !== "filters" || !listReady) return;

    const page = typeof pending.state.page === "number" ? pending.state.page : 1;
    const summaryId = pending.state.summaryId;
    setPage(page);

    if (typeof summaryId === "number") {
      openSummary(summaryId);
    }

    requestAnimationFrame(() => {
      restoreListScrollY(pending.scrollY);
    });

    pendingRef.current = { ...pending, phase: "done" };
  }, [listReady, openSummary, setPage]);

  return { listEnterMotion };
}
