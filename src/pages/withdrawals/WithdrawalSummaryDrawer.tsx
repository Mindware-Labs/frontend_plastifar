import { ArrowUpRight, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { withdrawalsApi } from "../../api/withdrawals";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { Spinner } from "../../components/ui/Spinner";
import type { WithdrawalDetail } from "../../types/withdrawals";
import { WithdrawalExecutiveSummary } from "./WithdrawalExecutiveSummary";

interface WithdrawalSummaryDrawerProps {
  withdrawalId: number;
  onClose: () => void;
}

export function WithdrawalSummaryDrawer({ withdrawalId, onClose }: WithdrawalSummaryDrawerProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<WithdrawalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    withdrawalsApi
      .get(withdrawalId)
      .then((data) => {
        if (!active) return;
        setDetail(data);
      })
      .catch(() => {
        if (!active) return;
        setError("No se pudo cargar el resumen de la solicitud.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [withdrawalId]);

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
            setLoading(true);
            setError(null);
            withdrawalsApi
              .get(withdrawalId)
              .then(setDetail)
              .catch(() => setError("Error al cargar."))
              .finally(() => setLoading(false));
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
