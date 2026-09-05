import { RotateCw } from "lucide-react";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";

interface ReportStateProps {
  error: string | null;
  /** Hay ya un resultado en pantalla: el fallo es de una recarga, no del primer intento. */
  hasData: boolean;
  onRetry: () => void;
}

/**
 * Estado de carga y de error de un reporte. Antes, un fallo dejaba el aviso
 * rojo encima de un spinner eterno y sin salida que no fuera recargar la
 * pagina: si hay error no hay spinner, y siempre hay como reintentar.
 */
export function ReportState({ error, hasData, onRetry }: ReportStateProps) {
  if (error) {
    return (
      <div className="mb-3 flex flex-col items-start gap-2">
        <Alert variant="error">{error}</Alert>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw className="h-[15px] w-[15px]" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (hasData) return null;

  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}
