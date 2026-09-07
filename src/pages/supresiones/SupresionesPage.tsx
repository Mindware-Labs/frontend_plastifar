import { Ban, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { suppressionsApi, type SuppressionQuery } from "../../api/suppressions";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { formatDateTime } from "../../lib/format";
import type { EmailSuppressionListResponse, EmailSuppressionResponse } from "../../types/api";
import { SuppressionModal } from "./SuppressionModal";

/** Por que se bloqueo: lo que dijo el proveedor o quien lo puso a mano. */
const reasons: Record<string, { label: string; tone: "neutral" | "red" | "green" }> = {
  Bounced: { label: "Rebote definitivo", tone: "red" },
  Complained: { label: "Marcado como spam", tone: "red" },
  Manual: { label: "Bloqueo manual", tone: "neutral" },
};

export function SupresionesPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [adding, setAdding] = useState(false);

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, isStale, error, setPage, refresh } = usePagedList<SuppressionQuery, EmailSuppressionListResponse>({
    fetch: suppressionsApi.list,
    criteria: { pageSize, search: debouncedSearch || undefined },
    fallbackError: "No se pudo cargar la lista de supresión",
  });

  const rows = data?.items ?? [];

  function askRemove(item: EmailSuppressionResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Configuración · Supresión",
      title: "Desbloquear dirección",
      description: (
        <>
          Se volverá a permitir el envío a{" "}
          <strong className="font-semibold text-ink">{item.address}</strong>. Si vuelve a rebotar o a
          marcarnos como spam, entrará otra vez a la lista sola.
        </>
      ),
      confirmLabel: "Desbloquear",
      onConfirm: async () => {
        setBusyId(item.id);
        try {
          await suppressionsApi.remove(item.id);
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
        title="Supresión"
        summary={
          data
            ? `${data.total} ${data.total === 1 ? "dirección bloqueada" : "direcciones bloqueadas"} · a estas no se envía correo`
            : "Cargando la lista de supresión…"
        }
        action={
          isAdmin && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-[15px] w-[15px]" />
              Bloquear dirección
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por dirección…"
            className="w-[260px]"
          />
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
                  <Th>Dirección</Th>
                  <Th>Motivo</Th>
                  <Th>Detalle</Th>
                  <Th>Desde</Th>
                  {isAdmin && <Th className="w-20 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const reason = reasons[item.reason] ?? { label: item.reason, tone: "neutral" as const };
                  return (
                    <Row key={item.id} busy={busyId === item.id}>
                      <Td className="text-[13px] font-medium text-ink">{item.address}</Td>
                      <Td>
                        <Badge tone={reason.tone}>{reason.label}</Badge>
                      </Td>
                      <Td className="max-w-[360px] truncate text-[12.5px] text-subtle" title={item.detail ?? undefined}>
                        {item.detail ?? "—"}
                      </Td>
                      <Td className="whitespace-nowrap text-[12.5px] text-subtle">{formatDateTime(item.createdAt)}</Td>
                      {isAdmin && (
                        <Td>
                          <div className="flex items-center justify-end">
                            <RowAction
                              label={`Desbloquear ${item.address}`}
                              icon={Trash2}
                              onClick={() => askRemove(item)}
                              disabled={busyId === item.id}
                              danger
                            />
                          </div>
                        </Td>
                      )}
                    </Row>
                  );
                })}
              </tbody>
            </DataTable>

            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Ban className="h-6 w-6 text-faint" />
                <p className="text-[13.5px] text-faint">
                  {debouncedSearch
                    ? "Ninguna dirección coincide con la búsqueda."
                    : "No hay direcciones bloqueadas. Los rebotes definitivos y las quejas de spam entran aquí solos."}
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
              noun="direcciones"
            />
          </div>
        )}
      </div>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}

      {adding && <SuppressionModal onClose={() => setAdding(false)} onSaved={refresh} />}
    </div>
  );
}
