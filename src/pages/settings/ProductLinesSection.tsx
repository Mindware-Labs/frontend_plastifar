import { Ban, CheckCircle2, Pencil, Plus } from "lucide-react";
import { settingsApi } from "../../api/settings";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
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
import { useReceipts } from "../../context/useReceipts";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import type { ProductLine } from "../../types/settings";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy } from "./catalogState";
import { ProductLineModal } from "./ProductLineModal";
import { PAGE_SIZES } from "../../lib/pageSizes";

const CHIPS = ["todas", "activas", "inactivas"] as const;
type ChipKey = (typeof CHIPS)[number];

export function ProductLinesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");
  const receipts = useReceipts();

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<ProductLine, "nueva">();

  const [search, setSearch] = useUrlState<string>("q", "");
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todas", CHIPS);
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

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
    pageKey: "pagina",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  // Sin criterio activo, una pagina vacia significa catalogo vacio; con
  // criterio, que nada coincide. Los contadores no distinguen ese caso: se
  // calculan sobre el filtro base, no sobre la tabla entera.
  const isFiltering = debouncedSearch !== "" || chip !== "todas";

  function clearFilters() {
    setSearch("");
    setChip("todas");
  }

  /**
   * RF-K5: no se desactiva la ultima linea en uso. La regla la aplica el
   * servidor, que es el unico que sabe cuantos motivos la exigen: su 409 sube al
   * dialogo. Adelantarla aqui exigia contar sobre lo cargado, y lo cargado es
   * una pagina.
   */
  function askToggle(line: ProductLine) {
    const willDeactivate = line.isActive;
    confirm(line.id, {
      tone: "warn",
      icon: willDeactivate ? Ban : CheckCircle2,
      title: willDeactivate ? "Desactivar línea" : "Reactivar línea",
      description: willDeactivate ? (
        <>
          <strong className="font-semibold text-ink">{line.name}</strong> dejará de ofrecerse al
          abrir un ticket o una HCA. El historial que ya la referencia se conserva.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{line.name}</strong> vuelve a estar disponible
          en tickets y hojas de corrección.
        </>
      ),
      confirmLabel: willDeactivate ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        try {
          const current = await freshCopy(settingsApi.productLines.get, line);
          const nextActive = !current.isActive;
          await settingsApi.productLines.update(current.id, {
            code: current.code,
            name: current.name,
            isActive: nextActive,
          });
          receipts.done({
            action: nextActive ? "reactivar-linea" : "desactivar-linea",
            title: nextActive ? "Línea reactivada" : "Línea desactivada",
            detail: `${current.name} (${current.code})`,
          });
          refresh();
        } catch (err) {
          receipts.failed({
            action: "toggle-linea",
            title: willDeactivate ? "No se pudo desactivar la línea" : "No se pudo reactivar la línea",
            detail: err instanceof Error ? err.message : undefined,
          });
        }
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Líneas de producto"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando las líneas de producto…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "línea" : "líneas"}
                  count={counts.all}
                  active={chip === "todas"}
                  onClick={() => {
                    setChip("todas");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todas las líneas de producto"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activa" : "activas"}
                  count={counts.active}
                  active={chip === "activas"}
                  onClick={() => {
                    setChip("activas");
                    setPage(1);
                  }}
                  tone="emerald"
                  dot
                  title="Filtrar por líneas activas"
                />
                <HeaderTag
                  label={counts.inactive === 1 ? "inactiva" : "inactivas"}
                  count={counts.inactive}
                  active={chip === "inactivas"}
                  onClick={() => {
                    setChip("inactivas");
                    setPage(1);
                  }}
                  tone="red"
                  dot
                  title="Filtrar por líneas inactivas"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nueva")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva línea
            </Button>
          )
        }
      />

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      <ListPanel
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre o código…"
              className="w-[260px]"
            />
            {search && <ClearFiltersButton onClick={() => setSearch("")} title="Limpiar búsqueda" />}
          </>
        }
        footer={
          <ListPagination
            data={data}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="líneas"
          />
        }
      >
        <ListBody
          data={data}
          error={error}
          isStale={isStale}
          skeletonRows={pageSize}
          skeletonColumns={4}
          empty={
            isFiltering
              ? "Ninguna línea coincide con este filtro o búsqueda."
              : "Todavía no hay ninguna línea de producto configurada."
          }
          onClear={isFiltering ? clearFilters : undefined}
        >
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
                          icon={line.isActive ? Ban : CheckCircle2}
                          onClick={() => askToggle(line)}
                          disabled={busyId === line.id}
                          danger={line.isActive}
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
        <ProductLineModal
          line={modal === "nueva" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            const isEdit = modal !== "nueva";
            receipts.done({
              action: isEdit ? "editar-linea" : "crear-linea",
              title: isEdit ? "Línea actualizada" : "Línea creada exitosamente",
              detail: `${saved.name} (${saved.code})`,
            });
            refresh();
          }}
        />
      )}

      {dialog}
    </>
  );
}
