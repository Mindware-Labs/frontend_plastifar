import { Pencil, Plus, Power } from "lucide-react";
import { useCallback, useState } from "react";
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
import { usedVariables } from "../../lib/templates";
import type { EmailTemplate } from "../../types/settings";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass, useSectionLoad } from "./catalogState";
import { SettingsLayout } from "./SettingsLayout";
import { TemplateModal } from "./TemplateModal";

type ChipKey = "todas" | "activas" | "inactivas";

const listTemplates = () => settingsApi.templates.list({ page: 1, pageSize: 100 });

export function TemplatesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");

  const [modal, setModal] = useState<"nueva" | EmailTemplate | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  const load = useCallback(async () => {
    const { items } = await listTemplates();
    setTemplates(items);
  }, []);

  const { status, isRefetching, error, reload, retry } = useSectionLoad(
    load,
    "No se pudieron cargar las plantillas",
  );

  const all = templates;
  const activeCount = all.filter((template) => template.isActive).length;

  const rows = all.filter((template) => {
    const byChip =
      chip === "todas" ||
      (chip === "activas" && template.isActive) ||
      (chip === "inactivas" && !template.isActive);

    const bySearch =
      debouncedSearch === "" ||
      template.name.toLowerCase().includes(debouncedSearch) ||
      template.key.toLowerCase().includes(debouncedSearch) ||
      template.subject.toLowerCase().includes(debouncedSearch);

    return byChip && bySearch;
  });

  // RF-K2: los listados de catalogo paginan como cualquier otro. El corte
  // lo hace la vista solo mientras no exista /api/settings/...; el endpoint
  // devuelve la pagina ya cortada en SQL (anexo 12.1).
  const { page, pageSize, total, totalPages, pageRows, setPage, changePageSize } = useLocalPage(
    rows,
    JSON.stringify([debouncedSearch, chip]),
  );

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
          const current = await freshCopy(listTemplates, template);
          await settingsApi.templates.update(current.id, {
            key: current.key,
            name: current.name,
            subject: current.subject,
            body: current.body,
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
            ? "Todavía no hay ninguna plantilla configurada."
            : "Ninguna plantilla coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <div className={staleClass(isRefetching)}>
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
              {pageRows.map((template) => {
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

      {status === "ready" && rows.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
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
          onSaved={() => {
            void reload();
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
