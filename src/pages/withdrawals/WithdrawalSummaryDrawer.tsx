import { ArrowUpRight, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { withdrawalsApi } from "../../api/withdrawals";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { Spinner } from "../../components/ui/Spinner";
import { WithdrawalExecutiveSummary } from "./WithdrawalExecutiveSummary";

interface WithdrawalSummaryDrawerProps {
  withdrawalId: number;
  onClose: () => void;
}

export function WithdrawalSummaryDrawer({ withdrawalId, onClose }: WithdrawalSummaryDrawerProps) {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["withdrawals", withdrawalId], queryFn: () => withdrawalsApi.get(withdrawalId) });
  // El reintento mostraba su propio texto de error; se conserva.
  const [retriedId, setRetriedId] = useState<number | null>(null);
  const detail = query.data ?? null;
  const loading = query.isPending || (query.isError && query.isFetching);
  const error = query.isError
    ? retriedId === withdrawalId
      ? "Error al cargar."
      : "No se pudo cargar el resumen de la solicitud."
    : null;

  return (
    <Drawer
      title={detail ? `Retiro · ${detail.withdrawal.number}` : "Resumen de solicitud"}
      eyebrow="PF-FOR-068 · Retiro de mercancía"
      description={
        detail
          ? `${detail.withdrawal.clientName} · ${detail.withdrawal.status}`
          : "Cargando datos del formulario…"
      }
      maxWidth="max-w-[760px]"
      onClose={onClose}
      footer={({ requestClose }) => (
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.open(`/retiros/${withdrawalId}/imprimir?mode=pdf`, "_blank")}
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
                  `/tickets/${detail.withdrawal.ticketId}?tab=formularios&form=withdrawal-${detail.withdrawal.id}`,
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
            setRetriedId(withdrawalId);
            void query.refetch();
          }}
        >
          {error}
        </ErrorRetry>
      ) : detail ? (
        <div className="pb-2">
          <WithdrawalExecutiveSummary withdrawal={detail.withdrawal} />
        </div>
      ) : null}
    </Drawer>
  );
}
