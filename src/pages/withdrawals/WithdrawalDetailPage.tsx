import { Ban, PackageCheck, Pencil, Printer, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { withdrawalsApi } from "../../api/withdrawals";
import { DetailLoadError } from "../../components/app/DetailLoadError";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { ProductNameCode } from "../../components/app/ProductNameCode";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { DetailGroup, DetailRow, DetailTable } from "../../components/ui/DetailTable";
import { PageSpinner } from "../../components/ui/PageSpinner";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useDetail } from "../../hooks/useDetail";
import { formatDay, formatInstant } from "../../lib/dates";
import { formatAmount, formatPrice, formatQuantity } from "../../lib/numbers";
import { describeStatus } from "../../lib/withdrawals";
import type { WithdrawalDetail, WithdrawalLine } from "../../types/withdrawals";
import { WithdrawalCancelModal } from "./WithdrawalCancelModal";
import { WithdrawalCompleteModal } from "./WithdrawalCompleteModal";
import { WithdrawalDecisionModal } from "./WithdrawalDecisionModal";
import { WithdrawalFormModal } from "./WithdrawalFormModal";
import { WithdrawalStatusBadge } from "./WithdrawalStatusBadge";

/**
 * Ficha de la solicitud: datos, líneas con lo recogido y la diferencia, y las
 * tres firmas (vendedor, aprobación y almacén). Qué botón se ofrece lo decide
 * el servidor (`canEdit`, `canDecide`, `canComplete`, `canCancel`).
 *
 * Integración diferida (docs/plan/02, módulo de tickets y tareas): RF-W7 pide
 * esta misma información como pestaña «Retiro de mercancía» del detalle del
 * ticket, con GET /api/tickets/{id}/withdrawals. Esa pestaña vive en
 * TicketDetailPage, que es del módulo de tickets; por ahora la ficha enlaza
 * al ticket y no al revés.
 */
export function WithdrawalDetailPage() {
  const { id } = useParams();
  const withdrawalId = Number(id);

  const { data: detail, setData: setDetail, error, reload } = useDetail(withdrawalId, withdrawalsApi.get, {
    notFound: "La solicitud de retiro no existe o no tienes acceso.",
    failed: "No se pudo cargar la solicitud de retiro. Vuelve a intentarlo.",
  });

  const [editing, setEditing] = useState(false);
  const [deciding, setDeciding] = useState<"aprobar" | "rechazar" | null>(null);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  /** Mensaje del servidor tras un 409: la ficha ya se recargó con lo vigente. */
  const [notice, setNotice] = useState<string | null>(null);

  const [lastId, setLastId] = useState(withdrawalId);
  if (withdrawalId !== lastId) {
    setLastId(withdrawalId);
    setNotice(null);
  }

  function reloadAfterConflict(message: string) {
    setNotice(message);
    reload();
  }

  function saved(next: WithdrawalDetail) {
    setNotice(null);
    setDetail(next);
  }

  useDynamicBreadcrumb(detail?.withdrawal.number ?? null);

  if (error) {
    return (
      <DetailLoadError className="max-w-[960px]" title="Solicitud de retiro" onRetry={reload}>
        {error}
      </DetailLoadError>
    );
  }

  if (detail === null) return <PageSpinner />;

  const { withdrawal, canEdit, canDecide, canComplete, canCancel } = detail;
  const withdrawn = withdrawal.status === "Retirado";
  const blockedByApproval = withdrawal.status === "Solicitado" && withdrawal.requiresApproval;
  // Rechazada o cancelada: lo que no se firmó ya no se firmará; nada queda «pendiente».
  const closedWithoutWithdrawal = withdrawal.status === "Rechazado" || withdrawal.status === "Cancelado";
  const missing = <span className="text-faint">—</span>;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => window.open(`/retiros/${withdrawal.id}/imprimir`, "_blank")}>
        <Printer className="h-[15px] w-[15px]" />
        Imprimir
      </Button>
      {canEdit && (
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil className="h-[15px] w-[15px]" />
          Editar
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="secondary" onClick={() => setCancelling(true)}>
          <Ban className="h-[15px] w-[15px]" />
          Cancelar
        </Button>
      )}
      {canDecide && (
        <>
          <Button size="sm" variant="secondary" onClick={() => setDeciding("rechazar")}>
            <ThumbsDown className="h-[15px] w-[15px]" />
            Rechazar
          </Button>
          <Button size="sm" onClick={() => setDeciding("aprobar")}>
            <ThumbsUp className="h-[15px] w-[15px]" />
            Aprobar
          </Button>
        </>
      )}
      {canComplete && (
        <Button size="sm" onClick={() => setCompleting(true)}>
          <PackageCheck className="h-[15px] w-[15px]" />
          Registrar retiro
        </Button>
      )}
    </div>
  );

  return (
    <div className="max-w-[960px]">
      <ModuleHeader
        title={`${withdrawal.number} · ${withdrawal.ticketNumber}`}
        summary={`${withdrawal.clientName} · ${describeStatus(withdrawal.status, withdrawal.requiresApproval)}`}
        action={actions}
      />

      {notice && (
        <div className="mb-3">
          <Alert variant="info">{notice}</Alert>
        </div>
      )}

      {blockedByApproval && (
        <div className="mb-3">
          <Alert variant="info">
            Indica un error de {withdrawal.errorOrigin?.toLowerCase()}: hay que aprobarla antes de registrar el retiro.
          </Alert>
        </div>
      )}

      <DetailTable>
        <DetailGroup title="La solicitud" hint="PF-FOR-068 · Revisión 00">
          <DetailRow label="Estado">
            <WithdrawalStatusBadge status={withdrawal.status} />
          </DetailRow>
          <DetailRow label="Ticket">
            <Link to={`/tickets/${withdrawal.ticketId}`} className="font-mono text-[12.5px] text-ink hover:text-brand-red">
              {withdrawal.ticketNumber}
            </Link>
            <span className="ml-2 text-[12.5px] text-faint">{withdrawal.ticketSubject}</span>
          </DetailRow>
          <DetailRow label="Empresa">
            {withdrawal.clientName}
            {withdrawal.clientCode && <span className="ml-1.5 font-mono text-[11.5px] text-faint">{withdrawal.clientCode}</span>}
          </DetailRow>
          <DetailRow label="Fecha">{formatDay(withdrawal.requestDate)}</DetailRow>
          <DetailRow label="Motivo">{withdrawal.reason}</DetailRow>
          <DetailRow label="Origen del error">
            {withdrawal.errorOrigin ?? <span className="text-faint">Ninguno: no requiere aprobación</span>}
          </DetailRow>
          <DetailRow label="Departamento">{withdrawal.departmentName ?? <span className="text-faint">—</span>}</DetailRow>
        </DetailGroup>

        <DetailGroup title="Productos a retirar">
          <DetailRow label="Líneas" wide>
            <LinesTable lines={withdrawal.lines} currency={withdrawal.currency} withdrawn={withdrawn} />
            <p className="mt-2 text-right text-[13px] text-brand-gray">
              Valor total{" "}
              <span className="font-semibold tabular-nums text-ink">
                {withdrawal.currency ? formatAmount(withdrawal.totalValue, withdrawal.currency) : "—"}
              </span>
            </p>
          </DetailRow>
        </DetailGroup>

        <DetailGroup title="Firmas y decisión">
          <DetailRow label="Vendedor">
            {withdrawal.requestedByName}
            <span className="ml-1.5 text-faint">· {formatInstant(withdrawal.createdAt)}</span>
          </DetailRow>
          <DetailRow label={withdrawal.status === "Rechazado" ? "Rechazado por" : "Aprobado por"}>
            {withdrawal.decidedByName ? (
              <>
                {withdrawal.decidedByName}
                <span className="ml-1.5 text-faint">· {formatInstant(withdrawal.decidedAt)}</span>
              </>
            ) : !withdrawal.requiresApproval ? (
              <span className="text-faint">No requiere aprobación</span>
            ) : closedWithoutWithdrawal ? (
              missing
            ) : (
              <span className="text-faint">Pendiente</span>
            )}
          </DetailRow>
          {withdrawal.decisionNote && (
            <DetailRow label="Nota de la decisión" wide>
              <p className="whitespace-pre-line">{withdrawal.decisionNote}</p>
            </DetailRow>
          )}
          <DetailRow label="Almacén">
            {withdrawal.warehouseStaffName ? (
              <>
                {withdrawal.warehouseStaffName}
                <span className="ml-1.5 text-faint">· retiró el {formatInstant(withdrawal.withdrawnAt)}</span>
              </>
            ) : closedWithoutWithdrawal ? (
              missing
            ) : (
              <span className="text-faint">Pendiente del retiro</span>
            )}
          </DetailRow>
          <DetailRow label="Cliente">
            {withdrawal.customerSignerName ?? (closedWithoutWithdrawal ? missing : <span className="text-faint">Se registra al retirar</span>)}
          </DetailRow>
          {withdrawal.cancelReason && (
            <DetailRow label="Cancelación" wide>
              <p className="whitespace-pre-line">{withdrawal.cancelReason}</p>
              <p className="mt-1 text-[12.5px] text-faint">
                {withdrawal.cancelledByName} · {formatInstant(withdrawal.cancelledAt)}
              </p>
            </DetailRow>
          )}
        </DetailGroup>
      </DetailTable>

      {editing && (
        <WithdrawalFormModal withdrawal={withdrawal} onClose={() => setEditing(false)} onSaved={saved} onConflict={reloadAfterConflict} />
      )}
      {deciding && (
        <WithdrawalDecisionModal
          withdrawal={withdrawal}
          decision={deciding}
          onClose={() => setDeciding(null)}
          onSaved={saved}
          onConflict={reloadAfterConflict}
        />
      )}
      {completing && (
        <WithdrawalCompleteModal withdrawal={withdrawal} onClose={() => setCompleting(false)} onSaved={saved} onConflict={reloadAfterConflict} />
      )}
      {cancelling && (
        <WithdrawalCancelModal withdrawal={withdrawal} onClose={() => setCancelling(false)} onSaved={saved} onConflict={reloadAfterConflict} />
      )}
    </div>
  );
}

function LinesTable({ lines, currency, withdrawn }: { lines: WithdrawalLine[]; currency: string | null; withdrawn: boolean }) {
  return (
    <DataTable className="overflow-x-auto">
      <thead>
        <HeadRow>
          <Th>Producto</Th>
          <Th className="text-right">Cantidad</Th>
          <Th>Empaque</Th>
          <Th className="text-right">Precio unitario</Th>
          <Th className="text-right">Valor</Th>
          {withdrawn && <Th className="text-right">Recogido</Th>}
          {withdrawn && <Th className="text-right">Diferencia</Th>}
        </HeadRow>
      </thead>
      <tbody>
        {lines.map((line) => (
          <Row key={line.id}>
            <Td>
              <ProductNameCode name={line.productName} code={line.productCode} />
            </Td>
            <Td className="whitespace-nowrap text-right tabular-nums">
              {formatQuantity(line.quantity)} <span className="text-faint">{line.quantityUnit}</span>
            </Td>
            <Td className="font-mono text-[12px] text-brand-gray">{line.packDetail ?? "—"}</Td>
            <Td className="text-right tabular-nums">{formatPrice(line.unitPrice)}</Td>
            <Td className="text-right tabular-nums">
              {line.lineValue === null || currency === null ? "—" : formatAmount(line.lineValue, currency)}
            </Td>
            {withdrawn && <Td className="text-right tabular-nums">{formatQuantity(line.withdrawnQuantity)}</Td>}
            {withdrawn && (
              <Td className={`text-right tabular-nums ${line.difference ? "font-semibold text-warn" : "text-faint"}`}>
                {line.difference ? formatQuantity(line.difference) : "0"}
              </Td>
            )}
          </Row>
        ))}
      </tbody>
    </DataTable>
  );
}
