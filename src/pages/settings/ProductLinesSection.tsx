import { Ban, CheckCircle2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { settingsApi } from "../../api/settings";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Pagination } from "../../components/ui/Pagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useReceipts } from "../../context/useReceipts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import type { ProductLine } from "../../types/settings";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass } from "./catalogState";
import { ProductLineModal } from "./ProductLineModal";

type ChipKey = "todas" | "activas" | "inactivas";

export function ProductLinesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");
  const receipts = useReceipts();

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
    const willDeactivate = line.isActive;
    setConfirmation({
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
        setBusyId(line.id);
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
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Líneas de producto"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
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
              <span aria-hidden className="text-zinc-300">·</span>
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
              <span aria-hidden className="text-zinc-300">·</span>
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
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las líneas de producto…
            </span>
          )
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
          data !== null &&
          data.total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="líneas"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={4} />
        ) : rows.length === 0 ? (
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
          </div>
        )}
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

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </>
  );
}
