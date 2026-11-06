import { Ban, Check, CheckCircle2, PackageCheck, X } from "lucide-react";
import { StatusBadge, type StatusStyles } from "../../components/ui/StatusBadge";
import type { WithdrawalStatus } from "../../types/withdrawals";

/** Normaliza la presentación del estado inicial: "Solicitado" se muestra como "Registrado" ya que el formulario está completo/registrado. */
export function normalizeWithdrawalStatus(status: WithdrawalStatus | string): string {
  if (status === "Solicitado") return "Registrado";
  return status;
}

const styles: StatusStyles<string> = {
  Registrado: { tone: "blue", icon: CheckCircle2 },
  Registrada: { tone: "blue", icon: CheckCircle2 },
  Solicitado: { tone: "blue", icon: CheckCircle2 },
  Aprobado: { tone: "warn", icon: Check },
  Rechazado: { tone: "red", icon: X },
  Retirado: { tone: "green", icon: PackageCheck },
  Cancelado: { tone: "neutral", icon: Ban },
};

export function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus | string }) {
  const displayStatus = normalizeWithdrawalStatus(status);
  return <StatusBadge status={displayStatus} styles={styles} />;
}
