import { Pencil, Plus, Power } from "lucide-react";
import { useState } from "react";
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
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { usedVariables } from "../../lib/templates";
import type { EmailTemplate } from "../../types/settings";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass } from "./catalogState";
import { SettingsLayout } from "./SettingsLayout";
import { TemplateModal } from "./TemplateModal";

type ChipKey = "todas" | "activas" | "inactivas";

export function TemplatesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nueva" | EmailTemplate | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Seccion 4.1: la pagina, el filtro, la busqueda y los contadores los resuelve
  // SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.templates.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todas" ? undefined : chip,
    },
    fallbackError: "No se pudieron cargar las plantillas",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFirstLoad = data === null && error === null;
  // Sin criterio activo, una pagina vacia significa catalogo vacio; con
  // criterio, que nada coincide. Los contadores no distinguen ese caso: se
  // calculan sobre el filtro base, no sobre la tabla entera.
  const isFiltering = debouncedSearch !== "" || chip !== "todas";

  function askToggle(template: EmailTemplate) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: template.isActive ? "Desactivar plantilla" : "Reactivar plantilla",
      description: template.isActive ? (
        <>
          <strong className="font-semibold text-ink">{template.name}</strong> dejará de ofrecerse al
          redactar una respuesta. Los correos ya enviados con ella no cambian.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{template.name}</strong> vuelve a estar
          disponible al redactar una respuesta.
        </>
      ),
      confirmLabel: template.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(template.id);
        try {
          const current = await freshCopy(settingsApi.templates.get, template);
          await settingsApi.templates.update(current.id, {
            key: current.key,
            name: current.name,
            subject: current.subject,
            body: current.body,
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
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nueva")} disabled={busyId !== null}>
            <Plus className="h-[15px] w-[15px]" />
            Nueva plantilla
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, clave o asunto…"
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
            ? "Ninguna plantilla coincide con este filtro o búsqueda."
            : "Todavía no hay ninguna plantilla configurada."}
        </p>
      ) : (
        <div className={staleClass(isStale)}>
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Plantilla</Th>
                <Th>Asunto</Th>
                <Th>Variables</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-24 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((template) => {
                const variables = usedVariables(`${template.subject} ${template.body}`);

                return (
                  <Row key={template.id} busy={busyId === template.id}>
                    <Td>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[12.5px] font-medium leading-tight text-ink">
                          {template.name}
                        </span>
                        <span className="font-mono text-[10.5px] leading-tight text-faint">
                          {template.key}
                        </span>
                      </span>
                    </Td>
                    <Td className="max-w-[320px] text-[12.5px] text-brand-gray">
                      <span className="block truncate">{template.subject}</span>
                    </Td>
                    <Td>
                      {variables.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {variables.map((variable) => (
                            <Badge key={variable}>{variable}</Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-faint">Ninguna</span>
                      )}
                    </Td>
                    <Td>
                      <StatusDot active={template.isActive} />
                    </Td>
                    {canWrite && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar ${template.name}`}
                            icon={Pencil}
                            onClick={() => setModal(template)}
                            disabled={busyId === template.id}
                          />
                          <RowAction
                            label={
                              template.isActive
                                ? `Desactivar ${template.name}`
                                : `Reactivar ${template.name}`
                            }
                            icon={Power}
                            onClick={() => askToggle(template)}
                            disabled={busyId === template.id}
                          />
                        </div>
                      </Td>
                    )}
                  </Row>
                );
              })}
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
          noun="plantillas"
        />
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        Las variables se escriben entre llaves dobles y se sustituyen al enviar. Una variable
        desconocida se rechaza al guardar, no al enviar: un error de plantilla no puede descubrirse
        con el correo ya en camino.
      </p>

      {modal !== null && (
        <TemplateModal
          template={modal === "nueva" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
