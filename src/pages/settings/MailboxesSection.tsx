import { CheckCircle2, Pencil, Plug, Plus, Power, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { useLocalPage } from "../../hooks/useLocalPage";
import { usePermissions } from "../../hooks/usePermissions";
import type { DepartmentResponse } from "../../types/api";
import type { Mailbox } from "../../types/settings";
import { MailboxModal } from "./MailboxModal";
import { SettingsLayout } from "./SettingsLayout";

type ChipKey = "todos" | "activos" | "inactivos";
type TestResult = { ok: boolean; message: string };

const syncFormat = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function MailboxesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [mailboxes, setMailboxes] = useState<Mailbox[] | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");

  const [modal, setModal] = useState<"nuevo" | Mailbox | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; result: TestResult } | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  function reload() {
    return settingsApi.mailboxes.list({ page: 1, pageSize: 100 }).then((res) => setMailboxes(res.items));
  }

  useEffect(() => {
    Promise.all([reload(), departmentsApi.list().then(setDepartments)]).catch(() =>
      setError("No se pudieron cargar los buzones"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = useMemo(() => mailboxes ?? [], [mailboxes]);
  const activeCount = all.filter((mailbox) => mailbox.isActive).length;

  function departmentName(id: number) {
    return departments.find((department) => department.id === id)?.name ?? "—";
  }

  const rows = all.filter((mailbox) => {
    const byChip =
      chip === "todos" ||
      (chip === "activos" && mailbox.isActive) ||
      (chip === "inactivos" && !mailbox.isActive);

    const bySearch =
      debouncedSearch === "" ||
      mailbox.address.toLowerCase().includes(debouncedSearch) ||
      mailbox.displayName.toLowerCase().includes(debouncedSearch);

    return byChip && bySearch;
  });

  const { page, pageSize, total, totalPages, pageRows, setPage, changePageSize } =
    useLocalPage(rows, JSON.stringify([debouncedSearch, chip]));

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
          sincronizarse con {mailbox.provider}.
        </>
      ),
      confirmLabel: mailbox.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        await settingsApi.mailboxes.update(mailbox.id, {
          address: mailbox.address,
          displayName: mailbox.displayName,
          provider: mailbox.provider,
          departmentId: mailbox.departmentId,
          secretRef: mailbox.secretRef,
          isActive: !mailbox.isActive,
        });
        await reload();
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
      setTestResult({ id: mailbox.id, result: { ok: false, message: "No se pudo probar la conexión." } });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <SettingsLayout
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nuevo")}>
            <Plus className="h-[15px] w-[15px]" />
            Nuevo buzón
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por correo o nombre…"
          className="w-[260px]"
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <FilterChip
          label="Todos"
          count={all.length}
          active={chip === "todos"}
          onClick={() => setChip("todos")}
        />
        <FilterChip
          label="Activos"
          count={activeCount}
          active={chip === "activos"}
          onClick={() => setChip("activos")}
        />
        <FilterChip
          label="Inactivos"
          count={all.length - activeCount}
          active={chip === "inactivos"}
          onClick={() => setChip("inactivos")}
        />
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {testResult && (
        <div className="mb-3">
          <Alert variant={testResult.result.ok ? "success" : "error"}>
            {testResult.result.message}
          </Alert>
        </div>
      )}

      {mailboxes === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          Ningún buzón coincide con este filtro o búsqueda.
        </p>
      ) : (
        <DataTable>
          <thead>
            <HeadRow>
              <Th>Buzón</Th>
              <Th>Proveedor</Th>
              <Th>Departamento</Th>
              <Th>Última sincronización</Th>
              <Th>Estado</Th>
              {canWrite && <Th className="w-32 text-right">Acciones</Th>}
            </HeadRow>
          </thead>

          <tbody>
            {pageRows.map((mailbox) => (
              <Row key={mailbox.id}>
                <Td>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium leading-tight text-ink">
                      {mailbox.displayName}
                    </span>
                    <span className="text-[11px] leading-tight text-faint">{mailbox.address}</span>
                  </span>
                </Td>
                <Td>
                  <Badge>{mailbox.provider}</Badge>
                </Td>
                <Td className="text-[12.5px] text-brand-gray">{departmentName(mailbox.departmentId)}</Td>
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
                            ? Spinner
                            : testResult?.id === mailbox.id
                              ? testResult.result.ok
                                ? CheckCircle2
                                : XCircle
                              : Plug
                        }
                        onClick={() => handleTest(mailbox)}
                        disabled={testingId === mailbox.id}
                      />
                      <RowAction
                        label={`Editar ${mailbox.displayName}`}
                        icon={Pencil}
                        onClick={() => setModal(mailbox)}
                      />
                      <RowAction
                        label={
                          mailbox.isActive
                            ? `Desactivar ${mailbox.displayName}`
                            : `Reactivar ${mailbox.displayName}`
                        }
                        icon={Power}
                        onClick={() => askToggle(mailbox)}
                      />
                    </div>
                  </Td>
                )}
              </Row>
            ))}
          </tbody>
        </DataTable>
      )}

      {mailboxes !== null && rows.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
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
          onSaved={() => reload()}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
