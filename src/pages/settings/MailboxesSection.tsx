import { CheckCircle2, Pencil, Plug, Plus, Power, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { departmentsApi } from "../../api/departments";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Pagination } from "../../components/ui/Pagination";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import type { DepartmentResponse } from "../../types/api";
import { providerLabel, type Mailbox } from "../../types/settings";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass, useReferenceData } from "./catalogState";
import { MailboxModal } from "./MailboxModal";
import { SettingsLayout } from "./SettingsLayout";

type ChipKey = "todos" | "activos" | "inactivos";
type TestResult = { ok: boolean; message: string };

/** Una prueba de conexión caduca: un visto verde de hace tres minutos ya no
 *  describe el buzón, solo tranquiliza sin motivo. */
const TEST_RESULT_TTL = 15_000;

const syncFormat = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Anillo de espera para la accion de fila. No usa `Spinner` porque aquel lleva
 * su propio `role="status"` y anidarlo dentro de un boton que ya tiene etiqueta
 * hace que el lector de pantalla anuncie dos cosas por un solo control.
 */
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

  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nuevo" | Mailbox | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; result: TestResult } | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Seccion 4.1: la pagina, el filtro, la busqueda y los contadores los resuelve
  // SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.mailboxes.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todos" ? undefined : chip,
    },
    fallbackError: "No se pudieron cargar los buzones",
  });

  // Los departamentos nombran una columna y llenan el desplegable del dialogo:
  // es catalogo de apoyo, no el listado que se pagina.
  const departmentsRef = useReferenceData<DepartmentResponse[]>(departmentsApi.list, []);
  const departments = departmentsRef.data;

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFirstLoad = data === null && error === null;
  // Sin criterio activo, una pagina vacia significa catalogo vacio; con
  // criterio, que nada coincide. Los contadores no distinguen ese caso: se
  // calculan sobre el filtro base, no sobre la tabla entera.
  const isFiltering = debouncedSearch !== "" || chip !== "todos";

  function departmentName(id: number) {
    return departments.find((department) => department.id === id)?.name ?? "—";
  }

  // El resultado pertenece a una fila concreta y a un instante concreto: si
  // cambia lo que se esta mirando, deja de describir nada. Se limpia desde el
  // gesto que lo invalida, no desde un efecto que persiga a los criterios.
  function changeCriteria(apply: () => void) {
    setTestResult(null);
    apply();
  }

  useEffect(() => {
    if (!testResult) return;
    const timer = window.setTimeout(() => setTestResult(null), TEST_RESULT_TTL);
    return () => window.clearTimeout(timer);
  }, [testResult]);

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
          // La referencia al secreto solo baja a quien puede escribir. Sin ella
          // el PUT la borraria: mejor detenerse y decirlo.
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
          refresh();
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
    <SettingsLayout
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
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(value) => changeCriteria(() => setSearch(value))}
          placeholder="Buscar por correo o nombre…"
          className="w-[240px]"
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <ChipGroup label="Filtrar por estado" ready={counts !== undefined}>
          <FilterChip
            label="Todos"
            count={counts?.all ?? 0}
            active={chip === "todos"}
            onClick={() => changeCriteria(() => setChip("todos"))}
          />
          <FilterChip
            label="Activos"
            count={counts?.active ?? 0}
            active={chip === "activos"}
            onClick={() => changeCriteria(() => setChip("activos"))}
          />
          <FilterChip
            label="Inactivos"
            count={counts?.inactive ?? 0}
            active={chip === "inactivos"}
            onClick={() => changeCriteria(() => setChip("inactivos"))}
          />
        </ChipGroup>
      </div>

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      {departmentsRef.failed && (
        <LoadErrorAlert
          message="No se pudieron cargar los departamentos: la columna queda sin nombre."
          onRetry={departmentsRef.reload}
        />
      )}

      {testResult && (
        <div className="mb-3">
          <Alert variant={testResult.result.ok ? "success" : "error"}>
            {testResult.result.message}
          </Alert>
        </div>
      )}

      {isFirstLoad ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : data === null ? null : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {isFiltering
            ? "Ningún buzón coincide con este filtro o búsqueda."
            : "Todavía no hay ningún buzón configurado."}
        </p>
      ) : (
        <div className={staleClass(isStale)}>
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

      {data !== null && data.total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={(next) => changeCriteria(() => setPage(next))}
          onPageSizeChange={(size) => changeCriteria(() => setPageSize(size))}
          noun="buzones"
        />
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        Este catálogo administra el buzón, no la lectura del correo: la ingesta que convierte un
        mensaje entrante en ticket es una decisión pendiente con Plastifar (sección 9.7 del plan de
        construcción). Probar conexión confirma que el buzón está activo y tiene su secreto
        configurado, sin exponer la credencial.
      </p>

      {modal !== null && (
        <MailboxModal
          mailbox={modal === "nuevo" ? undefined : modal}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
