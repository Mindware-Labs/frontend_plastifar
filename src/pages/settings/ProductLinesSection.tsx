import { Pencil, Plus, Power } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { settingsApi } from "../../api/settings";
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
import type { ProductLine } from "../../types/settings";
import { ChipGroup, LoadErrorAlert, NoticeDialog } from "./catalogSection";
import { freshCopy, staleClass, useSectionLoad } from "./catalogState";
import { ProductLineModal } from "./ProductLineModal";
import { SettingsLayout } from "./SettingsLayout";

type ChipKey = "todas" | "activas" | "inactivas";

const listLines = () => settingsApi.productLines.list({ page: 1, pageSize: 100 });

export function ProductLinesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [lines, setLines] = useState<ProductLine[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");

  const [modal, setModal] = useState<"nueva" | ProductLine | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: ReactNode } | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  const load = useCallback(async () => {
    const { items } = await listLines();
    setLines(items);
  }, []);

  const { status, isRefetching, error, reload, retry } = useSectionLoad(
    load,
    "No se pudieron cargar las líneas de producto",
  );

  const all = lines;
  const activeCount = all.filter((line) => line.isActive).length;
  const inUseCount = all.filter((line) => line.isActive && line.usedByTopics > 0).length;

  const rows = all.filter((line) => {
    const byChip =
      chip === "todas" ||
      (chip === "activas" && line.isActive) ||
      (chip === "inactivas" && !line.isActive);

    const bySearch =
      debouncedSearch === "" ||
      line.name.toLowerCase().includes(debouncedSearch) ||
      line.code.toLowerCase().includes(debouncedSearch);

    return byChip && bySearch;
  });

  // RF-K2: los listados de catalogo paginan como cualquier otro. El corte
  // lo hace la vista solo mientras no exista /api/settings/...; el endpoint
  // devuelve la pagina ya cortada en SQL (anexo 12.1).
  const { page, pageSize, total, totalPages, pageRows, setPage, changePageSize } = useLocalPage(
    rows,
    JSON.stringify([debouncedSearch, chip]),
  );

  /**
   * RF-K5: no se desactiva la ultima linea en uso. Los motivos marcados con
   * «exige linea de producto» dejarian de poder abrirse.
   */
  function askToggle(line: ProductLine) {
    const isLastInUse = line.isActive && line.usedByTopics > 0 && inUseCount === 1;

    if (isLastInUse) {
      setNotice({
        title: "No se puede desactivar",
        body: (
          <>
            <strong className="font-semibold text-ink">{line.name}</strong> es la única línea activa
            que usan los motivos que la exigen. Sin ella, esos motivos no podrían abrirse: activa
            otra línea antes de desactivar esta.
          </>
        ),
      });
      return;
    }

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
          const current = await freshCopy(listLines, line);
          await settingsApi.productLines.update(current.id, {
            code: current.code,
            name: current.name,
            isActive: !current.isActive,
          });
          await reload();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <SettingsLayout
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

        <ChipGroup label="Filtrar por estado" ready={status === "ready"}>
          <FilterChip
            label="Todas"
            count={all.length}
            active={chip === "todas"}
            onClick={() => setChip("todas")}
          />
          <FilterChip
            label="Activas"
            count={activeCount}
            active={chip === "activas"}
            onClick={() => setChip("activas")}
          />
          <FilterChip
            label="Inactivas"
            count={all.length - activeCount}
            active={chip === "inactivas"}
            onClick={() => setChip("inactivas")}
          />
        </ChipGroup>
      </div>

      {error && <LoadErrorAlert message={error} onRetry={retry} />}

      {status === "loading" ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : status === "error" ? null : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {all.length === 0
            ? "Todavía no hay ninguna línea de producto configurada."
            : "Ninguna línea coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <div className={staleClass(isRefetching)}>
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Código</Th>
                <Th>Línea</Th>
                <Th>Motivos que la exigen</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-24 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {pageRows.map((line) => (
                <Row key={line.id} busy={busyId === line.id}>
                  <Td>
                    <span className="font-mono text-[12px] text-brand-gray">{line.code}</span>
                  </Td>
                  <Td className="text-[12.5px] font-medium text-ink">{line.name}</Td>
                  <Td>
                    {line.usedByTopics > 0 ? (
                      <Badge>
                        <span className="tabular-nums">{line.usedByTopics}</span>
                      </Badge>
                    ) : (
                      <span className="text-[12.5px] text-faint">Ninguno</span>
                    )}
                  </Td>
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

      {status === "ready" && rows.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          noun="líneas"
        />
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        La línea de producto es obligatoria en los motivos marcados para ello, y es el eje por el que
        Calidad sigue las reclamaciones. Una línea con historial no se elimina: se desactiva.
      </p>

      {modal !== null && (
        <ProductLineModal
          line={modal === "nueva" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            void reload();
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}

      {notice && (
        <NoticeDialog title={notice.title} icon={Power} onClose={() => setNotice(null)}>
          {notice.body}
        </NoticeDialog>
      )}
    </SettingsLayout>
  );
}
