import { ArrowUpRight, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { EnterpriseFormExecutiveSummarySkeleton } from "../../components/ui/Skeleton";
import type { ClaimDetail } from "../../types/claims";
import { ClaimExecutiveSummary } from "./ClaimExecutiveSummary";

interface ClaimSummaryDrawerProps {
  claimId: number;
  onClose: () => void;
}

export function ClaimSummaryDrawer({ claimId, onClose }: ClaimSummaryDrawerProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    claimsApi
      .get(claimId)
      .then((data) => {
        if (!active) return;
        setDetail(data);
      })
      .catch(() => {
        if (!active) return;
        setError("No se pudo cargar el resumen de la reclamación.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [claimId]);

  return (
    <Drawer
      title={detail ? `Reclamación · ${detail.claim.ticketNumber}` : "Resumen de Reclamación"}
      eyebrow="PF-FOR-034 · Reclamación de clientes"
      description={
        detail
          ? `${detail.claim.clientName} · ${detail.claim.status}`
          : "Cargando datos del formulario..."
      }
      maxWidth="max-w-[760px]"
      onClose={onClose}
      footer={({ requestClose }) => (
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.open(`/reclamaciones/${claimId}/imprimir`, "_blank")}
          >
            <Printer className="h-3.5 w-3.5 mr-1" />
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
                onClose();
                navigate(
                  `/tickets/${detail.claim.ticketId}?tab=formularios&form=claim-${detail.claim.id}&openForm=1`,
                );
              }}
            >
              <span>Ver ficha completa</span>
              <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    >
      {loading ? (
        <EnterpriseFormExecutiveSummarySkeleton />
      ) : error ? (
        <ErrorRetry onRetry={() => {
          setLoading(true);
          setError(null);
          claimsApi.get(claimId).then(setDetail).catch(() => setError("Error al cargar.")).finally(() => setLoading(false));
        }}>
          {error}
        </ErrorRetry>
      ) : detail ? (
        <div className="pb-2">
          <ClaimExecutiveSummary
            claim={detail.claim}
            closureConditions={detail.closureConditions}
          />
        </div>
      ) : null}
    </Drawer>
  );
}
