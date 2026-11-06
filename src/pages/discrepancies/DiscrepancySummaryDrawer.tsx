import { ArrowUpRight, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  navigateToTicketFullView,
  type EnterpriseListReturnRecord,
} from "../../lib/enterpriseListReturn";
import { discrepanciesApi } from "../../api/discrepancies";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { EnterpriseFormExecutiveSummarySkeleton } from "../../components/ui/Skeleton";
import type { DiscrepancyDetail } from "../../types/discrepancies";
import { DiscrepancyExecutiveSummary } from "./DiscrepancyExecutiveSummary";
import { normalizeDiscrepancyStatus } from "./DiscrepancyStatusBadge";

interface DiscrepancySummaryDrawerProps {
  discrepancyId: number;
  onClose: () => void;
  getReturnSnapshot?: () => Omit<EnterpriseListReturnRecord, "ticketId"> | null;
}

export function DiscrepancySummaryDrawer({
  discrepancyId,
  onClose,
  getReturnSnapshot,
}: DiscrepancySummaryDrawerProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<DiscrepancyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    discrepanciesApi
      .get(discrepancyId)
      .then((data) => {
        if (!active) return;
        setDetail(data);
      })
      .catch(() => {
        if (!active) return;
        setError("No se pudo cargar el resumen de la investigación.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [discrepancyId]);

  return (
    <Drawer
      title={detail ? `Investigación · ${detail.discrepancy.number}` : "Resumen de investigación"}
      eyebrow="PF-FOR-291 · Discrepancia de carga"
      description={
        detail
          ? `${detail.discrepancy.clientName ?? "Sin cliente"} · ${normalizeDiscrepancyStatus(detail.discrepancy.status)}`
          : "Cargando datos del formulario…"
      }
      maxWidth="max-w-[760px]"
      onClose={onClose}
      footer={({ requestClose }) => (
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onClose();
              navigate(`/discrepancias/${discrepancyId}?documento=1`);
            }}
          >
            <Printer className="mr-1 h-3.5 w-3.5" />
            Imprimir
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={requestClose}>
              Cerrar
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!detail}
              onClick={() => {
                if (!detail) return;
                const url = `/tickets/${detail.discrepancy.ticketId}?tab=formularios&form=discrepancy-${detail.discrepancy.id}&openForm=1`;
                const snapshot = getReturnSnapshot?.() ?? null;
                onClose();
                if (snapshot) {
                  navigateToTicketFullView(navigate, url, detail.discrepancy.ticketId, snapshot);
                } else {
                  navigate(url);
                }
              }}
            >
              <span>Ver ficha completa</span>
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    >
      {loading ? (
        <EnterpriseFormExecutiveSummarySkeleton />
      ) : error ? (
        <ErrorRetry
          onRetry={() => {
            setLoading(true);
            setError(null);
            discrepanciesApi
              .get(discrepancyId)
              .then(setDetail)
              .catch(() => setError("Error al cargar."))
              .finally(() => setLoading(false));
          }}
        >
          {error}
        </ErrorRetry>
      ) : detail ? (
        <div className="pb-2">
          <DiscrepancyExecutiveSummary discrepancy={detail.discrepancy} />
        </div>
      ) : null}
    </Drawer>
  );
}
