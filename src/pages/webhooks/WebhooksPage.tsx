import { RotateCcw, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { webhookFailuresApi, type WebhookFailureQuery } from "../../api/webhookFailures";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { Spinner } from "../../components/ui/Spinner";
import { useReceipts } from "../../context/useReceipts";
import { usePagedList } from "../../hooks/usePagedList";
import { formatDateTime } from "../../lib/format";
import type { WebhookFailureListResponse, WebhookFailureResponse } from "../../types/api";

/** Avisos del proveedor que no se pudieron procesar: aqui se ve por que falta un correo y se reintenta. */
export function WebhooksPage() {
  const receipts = useReceipts();
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [pageSize, setPageSize] = useState(25);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const { data, isStale, error, setPage, refresh } = usePagedList<WebhookFailureQuery, WebhookFailureListResponse>({
    fetch: webhookFailuresApi.list,
    criteria: { pageSize, status },
    fallbackError: "No se pudieron cargar los avisos fallidos",
  });

  const rows = data?.items ?? [];

  async function retry(item: WebhookFailureResponse) {
    setBusyId(item.id);
    try {
      await webhookFailuresApi.retry(item.id);
      receipts.done({ action: "webhook", title: "Aviso procesado", detail: item.eventType ?? undefined });
      refresh();
    } catch (err) {
      receipts.failed({
        action: "webhook",
        title: "Volvió a fallar",
        detail: err instanceof ApiError ? err.message : undefined,
      });
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  function askDiscard(item: WebhookFailureResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Correo · Webhooks",
      title: "Descartar aviso",
      description: (
        <>
          El aviso <strong className="font-semibold text-ink">{item.eventType ?? "sin tipo"}</strong> no se
          volverá a intentar. Si era un correo recibido, no aparecerá en la bandeja.
        </>
      ),
      confirmLabel: "Descartar",
      onConfirm: async () => {
        setBusyId(item.id);
        try {
          await webhookFailuresApi.remove(item.id);
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Webhooks"
        summary={
          data
            ? data.pending === 0
              ? "Todos los avisos del proveedor se procesaron"
              : `${data.pending} ${data.pending === 1 ? "aviso pendiente" : "avisos pendientes"} · se reintentan solos con espera creciente`
            : "Avisos de Resend que no se pudieron procesar"
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <FilterChip label="Pendientes" count={data?.pending ?? 0} active={status === "pending"} onClick={() => setStatus("pending")} />
          <FilterChip label="Todos" count={status === "all" ? (data?.total ?? 0) : 0} active={status === "all"} onClick={() => setStatus("all")} />
        </div>

        {error && (
          <div className="mb-3">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {data === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Evento</Th>
                  <Th>Error</Th>
                  <Th>Intentos</Th>
                  <Th>Próximo intento</Th>
                  <Th>Llegó</Th>
                  <Th className="w-24 text-right">Acciones</Th>
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <Row key={item.id} busy={busyId === item.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-ink">{item.eventType ?? "—"}</span>
                        {item.resolvedAt ? <Badge tone="green">Resuelto</Badge> : <Badge tone="red">Pendiente</Badge>}
                      </div>
                    </Td>
                    <Td className="max-w-[420px] truncate text-[12.5px] text-subtle" title={item.lastError}>
                      {item.lastError}
                    </Td>
                    <Td className="tabular-nums text-[12.5px] text-subtle">{item.attempts}</Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-subtle">
                      {item.resolvedAt ? "—" : formatDateTime(item.nextAttemptAt)}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-subtle">{formatDateTime(item.createdAt)}</Td>
                    <Td>
                      {!item.resolvedAt && (
                        <div className="flex items-center justify-end gap-1">
                          <RowAction label="Reintentar ahora" icon={RotateCcw} onClick={() => retry(item)} disabled={busyId === item.id} />
                          <RowAction label="Descartar" icon={Trash2} onClick={() => askDiscard(item)} disabled={busyId === item.id} danger />
                        </div>
                      )}
                    </Td>
                  </Row>
                ))}
              </tbody>
            </DataTable>

            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Webhook className="h-6 w-6 text-faint" />
                <p className="text-[13.5px] text-faint">
                  {status === "pending" ? "No hay avisos pendientes." : "Todavía no falló ningún aviso."}
                </p>
              </div>
            )}

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="avisos"
            />
          </div>
        )}
      </div>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}
