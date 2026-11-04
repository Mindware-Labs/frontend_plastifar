import { ArrowUpRight, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { Spinner } from "../../components/ui/Spinner";
import { ClaimExecutiveSummary } from "./ClaimExecutiveSummary";

interface ClaimSummaryDrawerProps {
  claimId: number;
  onClose: () => void;
}

export function ClaimSummaryDrawer({ claimId, onClose }: ClaimSummaryDrawerProps) {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["claims", claimId], queryFn: () => claimsApi.get(claimId) });
  // El reintento mostraba su propio texto de error; se conserva.
  const [retriedId, setRetriedId] = useState<number | null>(null);
  const detail = query.data ?? null;
  const loading = query.isPending || (query.isError && query.isFetching);
  const error = query.isError
    ? retriedId === claimId
      ? "Error al cargar."
      : "No se pudo cargar el resumen de la reclamación."
    : null;

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
              onClick={() => {
                onClose();
                navigate(`/reclamaciones/${claimId}`);
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
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Spinner size="md" />
          <p className="text-xs text-zinc-500 font-medium">Cargando resumen de la reclamación...</p>
        </div>
      ) : error ? (
        <ErrorRetry onRetry={() => {
          setRetriedId(claimId);
          void query.refetch();
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
