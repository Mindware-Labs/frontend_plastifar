import { CheckCircle2, Inbox, Pencil, Plug, Plus, Power, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { departmentsApi } from "../../api/departments";
import { settingsApi } from "../../api/settings";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListEmptyState } from "../../components/ui/ListEmptyState";
import { ListPanel } from "../../components/ui/ListPanel";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Pagination } from "../../components/ui/Pagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLoadErrorReceipt } from "../../hooks/useNoticeReceipts";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import type { DepartmentResponse } from "../../types/api";
import { providerLabel, type Mailbox } from "../../types/settings";
import { freshCopy, useReferenceData } from "./catalogState";
import { MailboxModal } from "./MailboxModal";
import { departmentPath } from "../../lib/departments";

type ChipKey = "todos" | "activos" | "inactivos";
type TestResult = { ok: boolean; message: string };

/** El resultado de la prueba de conexión caduca a los 15 segundos. */
const TEST_RESULT_TTL = 15_000;

const syncFormat = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Anillo de espera sin role="status" propio para no duplicar anuncios en el botón. */
function TestingRing({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function MailboxesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");
  // Las funciones, no el contexto: el contexto cambia con cada aviso y
  // volvia a disparar el efecto de abajo con el mismo resultado.
  const { done, failed } = useReceipts();

  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nuevo" | Mailbox | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; result: TestResult } | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    queryKey: ["mailboxes"],
    fetch: settingsApi.mailboxes.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todos" ? undefined : chip,
    },
    fallbackError: "No se pudieron cargar los buzones",
  });

  const departmentsRef = useReferenceData<DepartmentResponse[]>(["departments", "all"], departmentsApi.list, []);
  const departments = departmentsRef.data;

  // El aviso en línea cubre la carga inicial; el toast solo avisa cuando
  // la tabla sigue mostrando datos previos y el aviso no se ve.
  useLoadErrorReceipt(data === null || isStale ? null : error, "settings-mailboxes-list", refresh);
  useLoadErrorReceipt(
    departmentsRef.failed ? "No se pudieron cargar los departamentos: la columna queda sin nombre." : null,
    "settings-mailboxes-departments",
    departmentsRef.reload,
  );

  const listLoading = data === null || isStale;
  const rows = isStale ? [] : (data?.items ?? []);
  const counts = data?.counts;
  const isFiltering = debouncedSearch !== "" || chip !== "todos";

  // Muestra la ruta jerárquica para distinguir departamentos homónimos entre sedes.
  function departmentName(id: number) {
    return departmentPath(departments, id) ?? "—";
  }

  // Limpia el resultado de prueba al cambiar filtros o paginación.
  function changeCriteria(apply: () => void) {
    setTestResult(null);
    apply();
  }

  useEffect(() => {
    if (!testResult) return;
    if (testResult.result.ok) {
      done({ action: "mailbox-test", title: testResult.result.message });
    } else {
      failed({ action: "mailbox-test", title: testResult.result.message });
    }
    const timer = window.setTimeout(() => setTestResult(null), TEST_RESULT_TTL);
    return () => window.clearTimeout(timer);
  }, [testResult, done, failed]);

  function askToggle(mailbox: Mailbox) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: mailbox.isActive ? "Desactivar buzón" : "Reactivar buzón",
      description: mailbox.isActive ? (
        <>
          <strong className="font-semibold text-ink">{mailbox.displayName}</strong> deja de
          sincronizarse. Nada de lo ya recibido se pierde.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{mailbox.displayName}</strong> vuelve a
          sincronizarse con {providerLabel(mailbox.provider)}.
        </>
      ),
      confirmLabel: mailbox.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(mailbox.id);
        setTestResult(null);
        try {
          const current = await freshCopy(settingsApi.mailboxes.get, mailbox);
          // Sin secretRef el PUT borraría la referencia: se detiene si no está disponible.
          if (current.secretRef === null) {
            throw new Error("No se pudo leer la referencia al secreto de este buzón.");
          }
          await settingsApi.mailboxes.update(current.id, {
            address: current.address,
            displayName: current.displayName,
            provider: current.provider,
            departmentId: current.departmentId,
            secretRef: current.secretRef,
            isActive: !current.isActive,
          });
          done({
            action: current.isActive ? "reactivar-buzon" : "desactivar-buzon",
            title: current.isActive ? "Buzón desactivado" : "Buzón reactivado",
            detail: current.displayName,
          });
          refresh();
        } catch (err) {
          failed({
            action: "toggle-buzon",
            title: mailbox.isActive ? "No se pudo desactivar el buzón" : "No se pudo reactivar el buzón",
            detail: err instanceof Error ? err.message : undefined,
          });
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  async function handleTest(mailbox: Mailbox) {
    setTestingId(mailbox.id);
    setTestResult(null);
    try {
      const result = await settingsApi.mailboxes.test(mailbox.id);
      setTestResult({ id: mailbox.id, result });
    } catch {
      setTestResult({
        id: mailbox.id,
        result: { ok: false, message: "No se pudo probar la conexión: inténtalo de nuevo" },
      });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <>
      <ModuleHeader
        title="Buzones"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <HeaderTag
                label={counts.all === 1 ? "buzón" : "buzones"}
                count={counts.all}
                active={chip === "todos"}
                onClick={() => changeCriteria(() => { setChip("todos"); setPage(1); })}
                tone="neutral"
                title="Mostrar todos los buzones"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.active === 1 ? "activo" : "activos"}
                count={counts.active}
                active={chip === "activos"}
                onClick={() => changeCriteria(() => { setChip("activos"); setPage(1); })}
                tone="emerald"
                dot
                title="Filtrar por buzones activos"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.inactive === 1 ? "inactivo" : "inactivos"}
                count={counts.inactive}
                active={chip === "inactivos"}
                onClick={() => changeCriteria(() => { setChip("inactivos"); setPage(1); })}
                tone="red"
                dot
                title="Filtrar por buzones inactivos"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-faint">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando los buzones configurados…
            </span>
          )
        }
        action={
          canWrite && (
            <Button
              size="sm"
              onClick={() => setModal("nuevo")}
              disabled={busyId !== null || testingId !== null}
            >
              <Plus className="h-[15px] w-[15px]" />
              Nuevo buzón
            </Button>
          )
        }
      />

      <ListPanel
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={(value) => changeCriteria(() => setSearch(value))}
              placeholder="Buscar por correo o nombre…"
              className="w-full sm:w-[260px]"
            />
          </>
        }
        footer={
          data !== null &&
          data.total > 0 && (
            <Pagination
              loading={listLoading}
              page={page}
              pageSize={pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={(next) => changeCriteria(() => setPage(next))}
              onPageSizeChange={(size) => changeCriteria(() => setPageSize(size))}
              noun="buzones"
            />
          )
        }
      >
        {listLoading ? (
          error !== null ? (
            <ErrorRetry className="p-4" onRetry={refresh}>{error}</ErrorRetry>
          ) : (
            <TableSkeleton rows={pageSize} columns={6} />
          )
        ) : rows.length === 0 ? (
          <ListEmptyState
            icon={Inbox}
            isFiltered={isFiltering}
            filteredTitle="Ningún buzón coincide con este filtro o búsqueda."
            onClearFilters={() => changeCriteria(() => {
              setSearch("");
              setChip("todos");
              setPage(1);
            })}
            emptyTitle="Todavía no hay ningún buzón configurado."
            emptyDescription={
              canWrite
                ? "Conecta un buzón con «Nuevo buzón» (IMAP, Gmail u Office 365) para que la bandeja reciba correo."
                : "Cuando un administrador configure buzones, el correo entrante aparecerá en la bandeja."
            }
          />
        ) : (
          <div className="plf-results-in">
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Buzón</Th>
                  <Th>Proveedor</Th>
                  <Th>Departamento</Th>
                  <Th>Última sincronización</Th>
                  <Th>Estado</Th>
                  {canWrite && <Th className="w-24 text-right">Acciones</Th>}
                </HeadRow>
              </thead>

              <tbody>
                {rows.map((mailbox) => (
                  <Row key={mailbox.id} busy={busyId === mailbox.id}>
                    <Td>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[12.5px] font-medium leading-tight text-ink">
                          {mailbox.displayName}
                        </span>
                        <span className="text-[11px] leading-tight text-faint">{mailbox.address}</span>
                      </span>
                    </Td>
                    <Td>
                      <Badge>{providerLabel(mailbox.provider)}</Badge>
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      {departmentName(mailbox.departmentId)}
                    </Td>
                    <Td className="text-[12.5px] tabular-nums text-brand-gray">
                      {mailbox.lastSyncedAt ? (
                        syncFormat.format(new Date(mailbox.lastSyncedAt))
                      ) : (
                        <span className="text-faint">Nunca</span>
                      )}
                    </Td>
                    <Td>
                      <StatusDot active={mailbox.isActive} />
                    </Td>
                    {canWrite && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Probar conexión de ${mailbox.displayName}`}
                            icon={
                              testingId === mailbox.id
                                ? TestingRing
                                : testResult?.id === mailbox.id
                                  ? testResult.result.ok
                                    ? CheckCircle2
                                    : XCircle
                                  : Plug
                            }
                            onClick={() => handleTest(mailbox)}
                            disabled={testingId === mailbox.id || busyId === mailbox.id}
                          />
                          <RowAction
                            label={`Editar ${mailbox.displayName}`}
                            icon={Pencil}
                            onClick={() => {
                              setTestResult(null);
                              setModal(mailbox);
                            }}
                            disabled={busyId === mailbox.id}
                          />
                          <RowAction
                            label={
                              mailbox.isActive
                                ? `Desactivar ${mailbox.displayName}`
                                : `Reactivar ${mailbox.displayName}`
                            }
                            icon={Power}
                            onClick={() => askToggle(mailbox)}
                            disabled={busyId === mailbox.id}
                          />
                        </div>
                      </Td>
                    )}
                  </Row>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}
      </ListPanel>

      {modal !== null && (
        <MailboxModal
          mailbox={modal === "nuevo" ? undefined : modal}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            const isEdit = modal !== "nuevo";
            done({
              action: isEdit ? "editar-buzon" : "crear-buzon",
              title: isEdit ? "Buzón actualizado" : "Buzón creado exitosamente",
              detail: saved.displayName,
            });
            refresh();
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </>
  );
}
