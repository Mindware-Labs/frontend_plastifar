import { Pencil, Plus, Power } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { upsertById } from "../../lib/catalog";
import { usePermissions } from "../../hooks/usePermissions";
import { settingsMock } from "../../mocks/settings";
import { usedVariables } from "../../lib/templates";
import type { EmailTemplate } from "../../types/settings";
import { SettingsLayout } from "./SettingsLayout";
import { TemplateModal } from "./TemplateModal";

type ChipKey = "todas" | "activas" | "inactivas";

export function TemplatesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");

  const [modal, setModal] = useState<"nueva" | EmailTemplate | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  useEffect(() => {
    settingsMock
      .templates()
      .then(setTemplates)
      .catch(() => setError("No se pudieron cargar las plantillas"));
  }, []);

  const all = useMemo(() => templates ?? [], [templates]);
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

  function upsert(item: EmailTemplate) {
    setTemplates((previous) => upsertById(previous ?? [], item));
  }

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
      onConfirm: () => upsert({ ...template, isActive: !template.isActive }),
    });
  }

  return (
    <SettingsLayout
      summary={
        templates === null
          ? "Cargando las plantillas…"
          : `${all.length} plantillas · ${activeCount} activas`
      }
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nueva")}>
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
          className="w-[280px]"
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

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
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {templates === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          Ninguna plantilla coincide con este filtro o búsqueda.
        </p>
      ) : (
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
                <Row key={template.id}>
                  <Td>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium leading-tight text-ink">
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
                        />
                        <RowAction
                          label={
                            template.isActive
                              ? `Desactivar ${template.name}`
                              : `Reactivar ${template.name}`
                          }
                          icon={Power}
                          onClick={() => askToggle(template)}
                        />
                      </div>
                    </Td>
                  )}
                </Row>
              );
            })}
          </tbody>
        </DataTable>
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        Las variables se escriben entre llaves dobles y se sustituyen al enviar. Una variable
        desconocida se rechaza al guardar, no al enviar: un error de plantilla no puede descubrirse
        con el correo ya en camino.
      </p>

      {modal !== null && (
        <TemplateModal
          template={modal === "nueva" ? undefined : modal}
          existing={all}
          onClose={() => setModal(null)}
          onSave={upsert}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
