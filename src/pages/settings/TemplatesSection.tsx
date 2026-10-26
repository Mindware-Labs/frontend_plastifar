import { Plus, Power } from "lucide-react";
import { settingsApi } from "../../api/settings";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListBody } from "../../components/ui/ListBody";
import { ListPanel } from "../../components/ui/ListPanel";
import { ListPagination } from "../../components/ui/ListPagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { StatusDot } from "../../components/ui/StatusDot";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import { usedVariables } from "../../lib/templates";
import type { EmailTemplate } from "../../types/settings";
import { CatalogRowActions } from "./CatalogRowActions";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy } from "./catalogState";
import { TemplateModal } from "./TemplateModal";
import { PAGE_SIZES } from "../../lib/pageSizes";

const CHIPS = ["todas", "activas", "inactivas"] as const;
type ChipKey = (typeof CHIPS)[number];

export function TemplatesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<EmailTemplate, "nueva">();

  const [search, setSearch] = useUrlState<string>("q", "");
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todas", CHIPS);
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

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

  function askToggle(template: EmailTemplate) {
    confirm(template.id, {
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
        const current = await freshCopy(settingsApi.templates.get, template);
        await settingsApi.templates.update(current.id, {
          key: current.key,
          name: current.name,
          subject: current.subject,
          body: current.body,
          isActive: !current.isActive,
        });
        refresh();
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Plantillas"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando las plantillas de correo…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "plantilla" : "plantillas"}
                  count={counts.all}
                  active={chip === "todas"}
                  onClick={() => {
                    setChip("todas");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todas las plantillas"
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
                  title="Filtrar por plantillas activas"
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
                  title="Filtrar por plantillas inactivas"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nueva")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva plantilla
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
              placeholder="Buscar por nombre, clave o asunto…"
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
            noun="plantillas"
          />
        }
      >
        <ListBody
          data={data}
          error={error}
          isStale={isStale}
          skeletonRows={pageSize}
          skeletonColumns={5}
          empty={
            isFiltering
              ? "Ninguna plantilla coincide con este filtro o búsqueda."
              : "Todavía no hay ninguna plantilla configurada."
          }
          onClear={isFiltering ? clearFilters : undefined}
        >
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
                        <CatalogRowActions
                          name={template.name}
                          isActive={template.isActive}
                          busy={busyId === template.id}
                          onEdit={() => setModal(template)}
                          onToggle={() => askToggle(template)}
                        />
                      </Td>
                    )}
                  </Row>
                );
              })}
            </tbody>
          </DataTable>
        </ListBody>
      </ListPanel>

      {modal !== null && (
        <TemplateModal
          template={modal === "nueva" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {dialog}
    </>
  );
}
