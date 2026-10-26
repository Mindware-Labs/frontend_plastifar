import { CheckCircle2, Pencil, Plug, Plus, Power, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { departmentsApi } from "../../api/departments";
import { settingsApi } from "../../api/settings";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListBody } from "../../components/ui/ListBody";
import { ListPanel } from "../../components/ui/ListPanel";
import { ListPagination } from "../../components/ui/ListPagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { StatusDot } from "../../components/ui/StatusDot";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import type { DepartmentResponse } from "../../types/api";
import { providerLabel, type Mailbox } from "../../types/settings";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy, useReferenceData } from "./catalogState";
import { MailboxModal } from "./MailboxModal";
import { departmentPath } from "../../lib/departments";
import { PAGE_SIZES } from "../../lib/pageSizes";

const CHIPS = ["todos", "activos", "inactivos"] as const;
type ChipKey = (typeof CHIPS)[number];
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

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<Mailbox>();

  const [search, setSearch] = useUrlState<string>("q", "");
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todos", CHIPS);
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

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
    pageKey: "pagina",
  });

  // Los departamentos nombran una columna y llenan el desplegable del dialogo:
  // es catalogo de apoyo, no el listado que se pagina.
  const departmentsRef = useReferenceData<DepartmentResponse[]>(departmentsApi.list, []);
  const departments = departmentsRef.data;

  const rows = data?.items ?? [];
  const counts = data?.counts;
  // Sin criterio activo, una pagina vacia significa catalogo vacio; con
  // criterio, que nada coincide. Los contadores no distinguen ese caso: se
  // calculan sobre el filtro base, no sobre la tabla entera.
  const isFiltering = debouncedSearch !== "" || chip !== "todos";

  /* El camino completo, no el nombre suelto: hay tres departamentos llamados
     «Calidad» —el propio, el de Centroamérica y el de otra planta— y en una
     tabla, «Calidad» a secas no dice a cuál pertenece la fila. */
  function departmentName(id: number) {
    return departmentPath(departments, id) ?? "—";
  }

  // El resultado pertenece a una fila concreta y a un instante concreto: si
  // cambia lo que se esta mirando, deja de describir nada. Se limpia desde el
  // gesto que lo invalida, no desde un efecto que persiga a los criterios.
  function changeCriteria(apply: () => void) {
    setTestResult(null);
    apply();
  }

  function clearFilters() {
    changeCriteria(() => {
      setSearch("");
      setChip("todos");
    });
  }

  useEffect(() => {
    if (!testResult) return;
    const timer = window.setTimeout(() => setTestResult(null), TEST_RESULT_TTL);
    return () => window.clearTimeout(timer);
  }, [testResult]);

  function askToggle(mailbox: Mailbox) {
    confirm(mailbox.id, {
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
        setTestResult(null);
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
          <HeaderCounts counts={counts} loadingLabel="Cargando los buzones configurados…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "buzón" : "buzones"}
                  count={counts.all}
                  active={chip === "todos"}
                  onClick={() => changeCriteria(() => { setChip("todos"); setPage(1); })}
                  tone="neutral"
                  title="Mostrar todos los buzones"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activo" : "activos"}
                  count={counts.active}
                  active={chip === "activos"}
                  onClick={() => changeCriteria(() => { setChip("activos"); setPage(1); })}
                  tone="emerald"
                  dot
                  title="Filtrar por buzones activos"
                />
                <HeaderTag
                  label={counts.inactive === 1 ? "inactivo" : "inactivos"}
                  count={counts.inactive}
                  active={chip === "inactivos"}
                  onClick={() => changeCriteria(() => { setChip("inactivos"); setPage(1); })}
                  tone="red"
                  dot
                  title="Filtrar por buzones inactivos"
                />
              </>
            )}
          </HeaderCounts>
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

      <ListPanel
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={(value) => changeCriteria(() => setSearch(value))}
              placeholder="Buscar por correo o nombre…"
              className="w-[260px]"
            />
            {search && (
              <ClearFiltersButton
                onClick={() => changeCriteria(() => setSearch(""))}
                title="Limpiar búsqueda"
              />
            )}
          </>
        }
        footer={
          <ListPagination
            data={data}
            page={page}
            pageSize={pageSize}
            onPageChange={(next) => changeCriteria(() => setPage(next))}
            onPageSizeChange={(size) => changeCriteria(() => setPageSize(size))}
            noun="buzones"
          />
        }
      >
        <ListBody
          data={data}
          error={error}
          isStale={isStale}
          skeletonRows={pageSize}
          skeletonColumns={6}
          empty={
            isFiltering
              ? "Ningún buzón coincide con este filtro o búsqueda."
              : "Todavía no hay ningún buzón configurado."
          }
          onClear={isFiltering ? clearFilters : undefined}
        >
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
        </ListBody>
      </ListPanel>

      {modal !== null && (
        <MailboxModal
          mailbox={modal === "nuevo" ? undefined : modal}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {dialog}
    </>
  );
}
