import { ArrowUpRight, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { discrepanciesApi } from "../../api/discrepancies";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { Spinner } from "../../components/ui/Spinner";
import { DiscrepancyExecutiveSummary } from "./DiscrepancyExecutiveSummary";

interface DiscrepancySummaryDrawerProps {
  discrepancyId: number;
  onClose: () => void;
}

export function DiscrepancySummaryDrawer({ discrepancyId, onClose }: DiscrepancySummaryDrawerProps) {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["discrepancies", discrepancyId], queryFn: () => discrepanciesApi.get(discrepancyId) });
  // El reintento mostraba su propio texto de error; se conserva.
  const [retriedId, setRetriedId] = useState<number | null>(null);
  const detail = query.data ?? null;
  const loading = query.isPending || (query.isError && query.isFetching);
  const error = query.isError
    ? retriedId === discrepancyId
      ? "Error al cargar."
      : "No se pudo cargar el resumen de la investigación."
    : null;

  return (
    <Drawer
      title={detail ? `Investigación · ${detail.discrepancy.number}` : "Resumen de investigación"}
      eyebrow="PF-FOR-291 · Discrepancia de carga"
      description={
        detail
          ? `${detail.discrepancy.clientName ?? "Sin cliente"} · ${detail.discrepancy.status}`
          : "Cargando datos del formulario…"
      }
      maxWidth="max-w-[760px]"
      onClose={onClose}
      footer={({ requestClose }) => (
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.open(`/discrepancias/${discrepancyId}/imprimir`, "_blank")}
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
                onClose();
                navigate(
                  `/tickets/${detail.discrepancy.ticketId}?tab=formularios&form=discrepancy-${detail.discrepancy.id}`,
                );
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
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Spinner size="md" />
          <p className="text-xs font-medium text-zinc-500">Cargando resumen…</p>
        </div>
      ) : error ? (
        <ErrorRetry
          onRetry={() => {
            setRetriedId(discrepancyId);
            void query.refetch();
          }}
        >
          {error}
        </ErrorRetry>
      ) : detail ? (
        <div className="pb-2">
          <DiscrepancyExecutiveSummary
            discrepancy={detail.discrepancy}
            completionConditions={detail.completionConditions}
          />
        </div>
      ) : null}
    </Drawer>
  );
}
