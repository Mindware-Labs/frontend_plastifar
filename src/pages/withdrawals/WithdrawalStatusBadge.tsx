import { Ban, Check, CircleDashed, PackageCheck, X } from "lucide-react";
import { StatusBadge, type StatusStyles } from "../../components/ui/StatusBadge";
import type { WithdrawalStatus } from "../../types/withdrawals";

const styles: StatusStyles<WithdrawalStatus> = {
  Solicitado: { tone: "neutral", icon: CircleDashed },
  Aprobado: { tone: "warn", icon: Check },
  Rechazado: { tone: "red", icon: X },
  Retirado: { tone: "green", icon: PackageCheck },
  Cancelado: { tone: "neutral", icon: Ban },
};

export function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }) {
  return <StatusBadge status={status} styles={styles} />;
}
