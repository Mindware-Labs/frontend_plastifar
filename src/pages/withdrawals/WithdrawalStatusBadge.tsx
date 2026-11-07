import { Ban, Check, CheckCircle2, PackageCheck, X } from "lucide-react";
import { chipToneOf, StatusBadge, type StatusStyles } from "../../components/ui/StatusBadge";
import type { WithdrawalStatus } from "../../types/withdrawals";

/** Normaliza la presentación del estado inicial: "Solicitado" se muestra como "Registrado" ya que el formulario está completo/registrado. */
export function normalizeWithdrawalStatus(status: WithdrawalStatus | string): string {
  if (status === "Solicitado") return "Registrado";
  return status;
}

const styles: StatusStyles<string> = {
  Registrado: { tone: "neutral", icon: CheckCircle2 },
  Registrada: { tone: "neutral", icon: CheckCircle2 },
  Solicitado: { tone: "neutral", icon: CheckCircle2 },
  Aprobado: { tone: "warn", icon: Check },
  Rechazado: { tone: "red", icon: X },
  Retirado: { tone: "green", icon: PackageCheck },
  Cancelado: { tone: "neutral", icon: Ban },
};

/** Tono del filtro de cabecera de un estado, del mismo mapa que la pastilla. */
export function withdrawalStatusChipTone(status: WithdrawalStatus | string) {
  return chipToneOf(styles, normalizeWithdrawalStatus(status));
}

export function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus | string }) {
  const displayStatus = normalizeWithdrawalStatus(status);
  return <StatusBadge status={displayStatus} styles={styles} />;
}
