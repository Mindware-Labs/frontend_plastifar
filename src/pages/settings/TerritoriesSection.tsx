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
import { clientsMock } from "../../mocks/clients";
import type { Territory } from "../../types/clients";
import { SettingsLayout } from "./SettingsLayout";
import { TerritoryModal } from "./TerritoryModal";

type ChipKey = "todos" | "activos" | "inactivos";

export function TerritoriesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [territories, setTerritories] = useState<Territory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");

  const [modal, setModal] = useState<"nuevo" | Territory | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  useEffect(() => {
    clientsMock
      .territories()
      .then(setTerritories)
      .catch(() => setError("No se pudieron cargar los territorios"));
  }, []);

  const all = useMemo(() => territories ?? [], [territories]);
  const activeCount = all.filter((territory) => territory.isActive).length;

  const rows = all.filter((territory) => {
    const byChip =
      chip === "todos" ||
      (chip === "activos" && territory.isActive) ||
      (chip === "inactivos" && !territory.isActive);

    const bySearch =
      debouncedSearch === "" ||
      territory.name.toLowerCase().includes(debouncedSearch) ||
      territory.code.toLowerCase().includes(debouncedSearch);

    return byChip && bySearch;
  });

  function upsert(item: Territory) {
    setTerritories((previous) => upsertById(previous ?? [], item));
  }

  function askToggle(territory: Territory) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: territory.isActive ? "Desactivar territorio" : "Reactivar territorio",
      description: territory.isActive ? (
        <>
          <strong className="font-semibold text-ink">{territory.name}</strong> dejará de ofrecerse
          al registrar un cliente. Los {territory.clientCount} que ya lo usan conservan su zona.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{territory.name}</strong> vuelve a estar
          disponible al registrar un cliente.
        </>
      ),
      confirmLabel: territory.isActive ? "Desactivar" : "Reactivar",
      onConfirm: () => upsert({ ...territory, isActive: !territory.isActive }),
    });
  }

  return (
    <SettingsLayout
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nuevo")}>
            <Plus className="h-[15px] w-[15px]" />
            Nuevo territorio
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

      {territories === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          Ningún territorio coincide con este filtro o búsqueda.
        </p>
      ) : (
        <DataTable>
          <thead>
            <HeadRow>
              <Th>Código</Th>
              <Th>Territorio</Th>
              <Th>Clientes</Th>
              <Th>Estado</Th>
              {canWrite && <Th className="w-24 text-right">Acciones</Th>}
            </HeadRow>
          </thead>

          <tbody>
            {rows.map((territory) => (
              <Row key={territory.id}>
                <Td>
                  <span className="font-mono text-[12px] text-brand-gray">{territory.code}</span>
                </Td>
                <Td className="text-[13px] font-medium text-ink">{territory.name}</Td>
                <Td>
                  {territory.clientCount > 0 ? (
                    <Badge>{territory.clientCount}</Badge>
                  ) : (
                    <span className="text-[12.5px] text-faint">Ninguno</span>
                  )}
                </Td>
                <Td>
                  <StatusDot active={territory.isActive} />
                </Td>
                {canWrite && (
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <RowAction
                        label={`Editar ${territory.name}`}
                        icon={Pencil}
                        onClick={() => setModal(territory)}
                      />
                      <RowAction
                        label={
                          territory.isActive
                            ? `Desactivar ${territory.name}`
                            : `Reactivar ${territory.name}`
                        }
                        icon={Power}
                        onClick={() => askToggle(territory)}
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
        El territorio es obligatorio al registrar un cliente: alimenta el ranking comercial por zona
        y vendedor. Uno con historial no se elimina: se desactiva.
      </p>

      {modal !== null && (
        <TerritoryModal
          territory={modal === "nuevo" ? undefined : modal}
          existing={all}
          onClose={() => setModal(null)}
          onSave={upsert}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
