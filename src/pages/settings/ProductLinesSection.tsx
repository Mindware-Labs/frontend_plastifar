import { Pencil, Plus, Power } from "lucide-react";
import { useState } from "react";
import { settingsApi } from "../../api/settings";
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
import type { ProductLine } from "../../types/settings";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass } from "./catalogState";
import { ProductLineModal } from "./ProductLineModal";
import { SettingsLayout } from "./SettingsLayout";

type ChipKey = "todas" | "activas" | "inactivas";

export function ProductLinesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nueva" | ProductLine | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Seccion 4.1: la pagina, el filtro, la busqueda y los contadores los resuelve
  // SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.productLines.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todas" ? undefined : chip,
    },
    fallbackError: "No se pudieron cargar las líneas de producto",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFirstLoad = data === null && error === null;
  // Sin criterio activo, una pagina vacia significa catalogo vacio; con
  // criterio, que nada coincide. Los contadores no distinguen ese caso: se
  // calculan sobre el filtro base, no sobre la tabla entera.
  const isFiltering = debouncedSearch !== "" || chip !== "todas";

  /**
   * RF-K5: no se desactiva la ultima linea en uso. La regla la aplica el
   * servidor, que es el unico que sabe cuantos motivos la exigen: su 409 sube al
   * dialogo. Adelantarla aqui exigia contar sobre lo cargado, y lo cargado es
   * una pagina.
   */
  function askToggle(line: ProductLine) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: line.isActive ? "Desactivar línea" : "Reactivar línea",
      description: line.isActive ? (
        <>
          <strong className="font-semibold text-ink">{line.name}</strong> dejará de ofrecerse al
          abrir un ticket o una hoja de corrección. El historial que ya la referencia se conserva.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{line.name}</strong> vuelve a estar disponible
          en tickets y hojas de corrección.
        </>
      ),
      confirmLabel: line.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(line.id);
        try {
          const current = await freshCopy(settingsApi.productLines.get, line);
          await settingsApi.productLines.update(current.id, {
            code: current.code,
            name: current.name,
            isActive: !current.isActive,
          });
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <SettingsLayout
      title="Líneas de producto"
      note="La línea de producto es obligatoria en los motivos marcados para ello, y es el eje por el que Calidad sigue las reclamaciones. Una línea con historial no se elimina: se desactiva."
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nueva")} disabled={busyId !== null}>
            <Plus className="h-[15px] w-[15px]" />
            Nueva línea
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre o código…"
          className="w-[240px]"
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <ChipGroup label="Filtrar por estado" ready={counts !== undefined}>
          <FilterChip
            label="Todas"
            count={counts?.all ?? 0}
            active={chip === "todas"}
            onClick={() => setChip("todas")}
          />
          <FilterChip
            label="Activas"
            count={counts?.active ?? 0}
            active={chip === "activas"}
            onClick={() => setChip("activas")}
          />
          <FilterChip
            label="Inactivas"
            count={counts?.inactive ?? 0}
            active={chip === "inactivas"}
            onClick={() => setChip("inactivas")}
          />
        </ChipGroup>
      </div>

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      {isFirstLoad ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : data === null ? null : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {isFiltering
            ? "Ninguna línea coincide con este filtro o búsqueda."
            : "Todavía no hay ninguna línea de producto configurada."}
        </p>
      ) : (
        <div className={staleClass(isStale)}>
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Código</Th>
                <Th>Línea</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-24 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((line) => (
                <Row key={line.id} busy={busyId === line.id}>
                  <Td>
                    <span className="font-mono text-[12px] text-brand-gray">{line.code}</span>
                  </Td>
                  <Td className="text-[12.5px] font-medium text-ink">{line.name}</Td>
                  <Td>
                    <StatusDot active={line.isActive} />
                  </Td>
                  {canWrite && (
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <RowAction
                          label={`Editar ${line.name}`}
                          icon={Pencil}
                          onClick={() => setModal(line)}
                          disabled={busyId === line.id}
                        />
                        <RowAction
                          label={line.isActive ? `Desactivar ${line.name}` : `Reactivar ${line.name}`}
                          icon={Power}
                          onClick={() => askToggle(line)}
                          disabled={busyId === line.id}
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
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          noun="líneas"
        />
      )}


      {modal !== null && (
        <ProductLineModal
          line={modal === "nueva" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
