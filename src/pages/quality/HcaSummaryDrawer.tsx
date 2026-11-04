import { ArrowUpRight, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { qualityApi, type SheetDetailResponse } from "../../api/quality";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { EnterpriseFormExecutiveSummarySkeleton } from "../../components/ui/Skeleton";
import { HcaExecutiveSummary } from "./HcaExecutiveSummary";

interface HcaSummaryDrawerProps {
  sheetId: number;
  onClose: () => void;
}

export function HcaSummaryDrawer({ sheetId, onClose }: HcaSummaryDrawerProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SheetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    qualityApi.sheets
      .get(sheetId)
      .then((data) => {
        if (!active) return;
        setDetail(data);
      })
      .catch(() => {
        if (!active) return;
        setError("No se pudo cargar el resumen de la HCA.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sheetId]);

  return (
    <Drawer
      title={detail ? `HCA · ${detail.sheet.number}` : "Resumen de HCA"}
      eyebrow="PF-FOR-109 · Hecho, Causa y Acción"
      description={
        detail
          ? `${detail.sheet.clientName} · ${detail.sheet.status === "Abierta" ? "Registrada" : detail.sheet.status}`
          : "Cargando datos de la acción correctiva..."
      }
      maxWidth="max-w-[760px]"
      onClose={onClose}
      footer={({ requestClose }) => (
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.open(`/calidad/hca/${sheetId}/imprimir`, "_blank")}
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
                const ticketId = detail.sheet.ticketId;
                if (ticketId != null) {
                  navigate(
                    `/tickets/${ticketId}?tab=formularios&form=sheet-${detail.sheet.id}&openForm=1`,
                  );
                } else {
                  navigate(`/calidad/hca/${sheetId}`);
                }
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
        <ErrorRetry
          onRetry={() => {
            setLoading(true);
            setError(null);
            qualityApi.sheets
              .get(sheetId)
              .then(setDetail)
              .catch(() => setError("Error al cargar."))
              .finally(() => setLoading(false));
          }}
        >
          {error}
        </ErrorRetry>
      ) : detail ? (
        <div className="pb-2">
          <HcaExecutiveSummary
            sheet={detail.sheet}
            planItems={detail.planItems}
          />
        </div>
      ) : null}
    </Drawer>
  );
}
