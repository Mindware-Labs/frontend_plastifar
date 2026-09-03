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
import type { ProductLine } from "../../types/settings";
import { ProductLineModal } from "./ProductLineModal";
import { SettingsLayout } from "./SettingsLayout";

type ChipKey = "todas" | "activas" | "inactivas";

export function ProductLinesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [lines, setLines] = useState<ProductLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");

  const [modal, setModal] = useState<"nueva" | ProductLine | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  useEffect(() => {
    settingsMock
      .productLines()
      .then(setLines)
      .catch(() => setError("No se pudieron cargar las líneas de producto"));
  }, []);

  const all = useMemo(() => lines ?? [], [lines]);
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

  function upsert(item: ProductLine) {
    setLines((previous) => upsertById(previous ?? [], item));
  }

  /**
   * RF-K5: no se desactiva la ultima linea en uso. Los motivos marcados con
   * «exige linea de producto» dejarian de poder abrirse.
   */
  function askToggle(line: ProductLine) {
    const isLastInUse = line.isActive && line.usedByTopics > 0 && inUseCount === 1;

    if (isLastInUse) {
      setConfirmation({
        tone: "warn",
        icon: Power,
        title: "No se puede desactivar",
        description: (
          <>
            <strong className="font-semibold text-ink">{line.name}</strong> es la única línea activa
            que usan los motivos que la exigen. Sin ella, esos motivos no podrían abrirse: activa
            otra línea antes de desactivar esta.
          </>
        ),
        confirmLabel: "Entendido",
        cancelLabel: "Cerrar",
        onConfirm: () => {},
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
      onConfirm: () => upsert({ ...line, isActive: !line.isActive }),
    });
  }

  return (
    <SettingsLayout
      summary={
        lines === null
          ? "Cargando las líneas…"
          : `${all.length} líneas · ${activeCount} activas · ${inUseCount} en uso por algún motivo`
      }
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nueva")}>
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

      {lines === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          Ninguna línea coincide con este filtro o búsqueda.
        </p>
      ) : (
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
            {rows.map((line) => (
              <Row key={line.id}>
                <Td>
                  <span className="font-mono text-[12px] text-brand-gray">{line.code}</span>
                </Td>
                <Td className="text-[13px] font-medium text-ink">{line.name}</Td>
                <Td>
                  {line.usedByTopics > 0 ? (
                    <Badge>{line.usedByTopics}</Badge>
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
                      />
                      <RowAction
                        label={line.isActive ? `Desactivar ${line.name}` : `Reactivar ${line.name}`}
                        icon={Power}
                        onClick={() => askToggle(line)}
                      />
                    </div>
                  </Td>
                )}
              </Row>
            ))}
          </tbody>
        </DataTable>
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        La línea de producto es obligatoria en los motivos marcados para ello, y es el eje por el que
        Calidad sigue las reclamaciones. Una línea con historial no se elimina: se desactiva.
      </p>

      {modal !== null && (
        <ProductLineModal
          line={modal === "nueva" ? undefined : modal}
          existing={all}
          onClose={() => setModal(null)}
          onSave={upsert}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
