import { ArrowLeft, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  clearEnterpriseListReturn,
  readEnterpriseListReturn,
  type PlfListLocationState,
} from "../../lib/enterpriseListReturn";
import { Button } from "../ui/Button";

interface ReturnToOriginBannerProps {
  ticketId: number;
}

function notifyReturnBannerChanged() {
  window.dispatchEvent(new Event("plf-enterprise-list-return-changed"));
}

export function ReturnToOriginBanner({ ticketId }: ReturnToOriginBannerProps) {
  const navigate = useNavigate();
  const [, tick] = useState(0);
  const [mainEl, setMainEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMainEl(document.querySelector("main"));
  }, []);

  useEffect(() => {
    const onChange = () => tick((n) => n + 1);
    window.addEventListener("plf-enterprise-list-return-changed", onChange);
    return () => window.removeEventListener("plf-enterprise-list-return-changed", onChange);
  }, []);

  const record = readEnterpriseListReturn();
  const visible = record != null && record.ticketId === ticketId;

  if (!visible || !record || !mainEl) return null;

  function dismiss() {
    clearEnterpriseListReturn();
    notifyReturnBannerChanged();
  }

  function goBack() {
    const payload = readEnterpriseListReturn();
    if (!payload) return;
    clearEnterpriseListReturn();
    notifyReturnBannerChanged();
    navigate(payload.listPath, {
      state: {
        plfListRestore: { scrollY: payload.scrollY, state: payload.listState },
        plfListMotion: "back",
      } satisfies PlfListLocationState,
    });
  }

  return createPortal(
    <div
      className="pointer-events-none absolute inset-x-0 bottom-6 z-[70] flex justify-center px-4 no-print"
      role="region"
      aria-label="Volver al listado anterior"
    >
      <div className="animate-plf-toast-in pointer-events-auto grid w-full max-w-[440px] grid-cols-[2.25rem_minmax(0,1fr)_auto_2.25rem] items-center gap-x-3 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/95 px-3.5 py-3 shadow-[0_4px_16px_-2px_rgba(15,23,42,0.1),0_20px_44px_-14px_rgba(15,23,42,0.22)] backdrop-blur-md">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center justify-self-center rounded-xl bg-zinc-100 text-zinc-600">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-[13px] font-semibold tracking-[-0.01em] text-zinc-900">
            Volver a {record.bannerTitle}
          </p>
          {record.bannerDetail ? (
            <p className="truncate text-[11.5px] leading-snug text-zinc-500">{record.bannerDetail}</p>
          ) : (
            <p className="text-[11.5px] leading-snug text-zinc-500">Recupera el listado y el resumen que tenías abierto.</p>
          )}
        </div>
        <Button type="button" size="sm" variant="primary" onClick={goBack} className="shrink-0 justify-self-center">
          Volver
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso"
          className="flex h-9 w-9 shrink-0 items-center justify-center justify-self-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>,
    mainEl,
  );
}
