import { ArrowUpRight, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { qualityApi } from "../../api/quality";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { Spinner } from "../../components/ui/Spinner";
import { HcaExecutiveSummary } from "./HcaExecutiveSummary";

interface HcaSummaryDrawerProps {
  sheetId: number;
  onClose: () => void;
}

export function HcaSummaryDrawer({ sheetId, onClose }: HcaSummaryDrawerProps) {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["quality-sheets", sheetId], queryFn: () => qualityApi.sheets.get(sheetId) });
  // El reintento mostraba su propio texto de error; se conserva.
  const [retriedId, setRetriedId] = useState<number | null>(null);
  const detail = query.data ?? null;
  const loading = query.isPending || (query.isError && query.isFetching);
  const error = query.isError
    ? retriedId === sheetId
      ? "Error al cargar."
      : "No se pudo cargar el resumen de la HCA."
    : null;

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
              onClick={() => {
                onClose();
                navigate(`/calidad/hca/${sheetId}`);
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
          <p className="text-xs text-zinc-500 font-medium">Cargando resumen de la HCA...</p>
        </div>
      ) : error ? (
        <ErrorRetry
          onRetry={() => {
            setRetriedId(sheetId);
            void query.refetch();
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
