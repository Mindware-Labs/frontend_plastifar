import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import { ControlInput } from "../../components/ui/ControlInput";
import { CriteriaField, CriteriaSelect } from "../../components/ui/CriteriaField";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePermissions } from "../../hooks/usePermissions";
import { upsertById } from "../../lib/catalog";
import { describeDue, formatDay, isPlanItemSettled, isSheetOverdue } from "../../lib/quality";
import { clientsMock } from "../../mocks/clients";
import { qualityMock } from "../../mocks/quality";
import { settingsMock } from "../../mocks/settings";
import type { Client } from "../../types/clients";
import type { ProductLine } from "../../types/settings";
import type { CorrectiveActionSheet } from "../../types/quality";
import { HcaModal } from "./HcaModal";
import { HcaStatusBadge } from "./StatusBadges";
import { TicketLink } from "./TicketLink";

type ChipKey = "todas" | "abiertas" | "vencidas" | "cerradas";

/** RF-Q1: listado paginado de HCA con pastillas por estado y filtros por linea
 *  de producto, responsable, cliente y rango de fechas. */
export function HcaPage() {
  const { can } = usePermissions();
  const canWrite = can("quality.write");

  const [sheets, setSheets] = useState<CorrectiveActionSheet[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [productLineId, setProductLineId] = useState("todas");
  const [responsibleId, setResponsibleId] = useState("todos");
  const [clientId, setClientId] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");

  // La primera pregunta del supervisor es cual vence antes; por eso la columna
  // del compromiso ordena, con desempate estable por id (anexo 12.1).
  const [sortDir, setSortDir] = useState<SortDir | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);

  const staff = qualityMock.staff();
  const itemsBySheet = useMemo(() => qualityMock.planItemsBySheet(), []);
  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  useEffect(() => {
    Promise.all([qualityMock.sheets(), clientsMock.clients(), settingsMock.productLines()])
      .then(([loadedSheets, loadedClients, loadedLines]) => {
        setSheets(loadedSheets);
        setClients(loadedClients);
        setProductLines(loadedLines);
      })
      .catch(() => setError("No se pudieron cargar las hojas de corrección"));
  }, []);

  const all = useMemo(() => sheets ?? [], [sheets]);

  function clientName(id: number) {
    return clients.find((client) => client.id === id)?.name ?? "—";
  }

  function lineName(id: number) {
    return productLines.find((line) => line.id === id)?.name ?? "—";
  }

  function staffName(id: number | null) {
    if (id === null) return "—";
    return staff.find((person) => person.id === id)?.name ?? "—";
  }

  // Los contadores corresponden al filtro base —busqueda, selectores y rango—
  // sin aplicar la pastilla activa, para que los numeros no cambien segun la
  // pastilla seleccionada (anexo 12.1).
  const base = all.filter((sheet) => {
    const byLine = productLineId === "todas" || sheet.productLineId === Number(productLineId);
    const byResponsible =
      responsibleId === "todos" || sheet.responsibleStaffId === Number(responsibleId);
    const byClient = clientId === "todos" || sheet.clientId === Number(clientId);

    const detectedDay = sheet.detectedAt.slice(0, 10);
    const byFrom = from === "" || detectedDay >= from;
    const byTo = to === "" || detectedDay <= to;

    const bySearch =
      debouncedSearch === "" ||
      sheet.number.toLowerCase().includes(debouncedSearch) ||
      sheet.description.toLowerCase().includes(debouncedSearch) ||
      clientName(sheet.clientId).toLowerCase().includes(debouncedSearch);

    return byLine && byResponsible && byClient && byFrom && byTo && bySearch;
  });

  const counts = {
    todas: base.length,
    abiertas: base.filter((sheet) => sheet.status !== "Cerrada").length,
    vencidas: base.filter((sheet) => isSheetOverdue(sheet)).length,
    cerradas: base.filter((sheet) => sheet.status === "Cerrada").length,
  };

  const filtered = base.filter((sheet) => {
    if (chip === "abiertas") return sheet.status !== "Cerrada";
    if (chip === "vencidas") return isSheetOverdue(sheet);
    if (chip === "cerradas") return sheet.status === "Cerrada";
    return true;
  });

  const rows =
    sortDir === null
      ? filtered
      : [...filtered].sort((a, b) => {
          const byDate = a.dueDate.localeCompare(b.dueDate);
          const ordered = byDate !== 0 ? byDate : a.id - b.id;
          return sortDir === "asc" ? ordered : -ordered;
        });

  // Paginacion de prueba: el corte lo hace la vista solo mientras no existe
  // /api/quality/sheets. El endpoint tiene que devolver la pagina ya cortada en
  // SQL, con total, totalPages y counts (anexo 12.1); esta pantalla ya consume
  // esa forma y no cambia cuando llegue.
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div>
      <ModuleHeader
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva HCA
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        {/* Sin htmlFor: SearchInput ya trae su propio aria-label. */}
        <CriteriaField label="Buscar">
          <SearchInput
            value={search}
            onChange={resetToFirstPage(setSearch)}
            placeholder="Número, cliente o descripción…"
            className="w-[230px]"
          />
        </CriteriaField>

        <CriteriaSelect
          label="Línea"
          ariaLabel="Filtrar por línea de producto"
          value={productLineId}
          onChange={resetToFirstPage(setProductLineId)}
          width="w-[160px]"
          options={[
            { value: "todas", label: "Todas las líneas" },
            ...productLines.map((line) => ({ value: String(line.id), label: line.name })),
          ]}
        />

        <CriteriaSelect
          label="Responsable"
          ariaLabel="Filtrar por responsable"
          value={responsibleId}
          onChange={resetToFirstPage(setResponsibleId)}
          width="w-[170px]"
          options={[
            { value: "todos", label: "Todos los responsables" },
            ...staff.map((person) => ({ value: String(person.id), label: person.name })),
          ]}
        />

        <CriteriaSelect
          label="Cliente"
          ariaLabel="Filtrar por cliente"
          value={clientId}
          onChange={resetToFirstPage(setClientId)}
          options={[
            { value: "todos", label: "Todos los clientes" },
            ...clients.map((client) => ({ value: String(client.id), label: client.name })),
          ]}
          width="w-[200px]"
        />

        {/* El par de fechas viaja junto: partirlo entre dos lineas deja un
            «Hasta» huerfano que no se entiende solo. */}
        <div className="flex items-end gap-2">
          <CriteriaField label="Detectada desde" htmlFor="hca-desde">
            <ControlInput
              id="hca-desde"
              type="date"
              className="w-[140px]"
              value={from}
              max={to === "" ? undefined : to}
              onChange={(event) => resetToFirstPage(setFrom)(event.target.value)}
            />
          </CriteriaField>

          <CriteriaField label="Hasta" htmlFor="hca-hasta">
            <ControlInput
              id="hca-hasta"
              type="date"
              className="w-[140px]"
              value={to}
              min={from === "" ? undefined : from}
              onChange={(event) => resetToFirstPage(setTo)(event.target.value)}
            />
          </CriteriaField>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="Todas"
            count={counts.todas}
            active={chip === "todas"}
            onClick={() => resetToFirstPage(setChip)("todas")}
          />
          <FilterChip
            label="Abiertas"
            count={counts.abiertas}
            active={chip === "abiertas"}
            onClick={() => resetToFirstPage(setChip)("abiertas")}
          />
          <FilterChip
            label="Vencidas"
            count={counts.vencidas}
            active={chip === "vencidas"}
            onClick={() => resetToFirstPage(setChip)("vencidas")}
          />
          <FilterChip
            label="Cerradas"
            count={counts.cerradas}
            active={chip === "cerradas"}
            onClick={() => resetToFirstPage(setChip)("cerradas")}
          />
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {sheets === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : pageRows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {all.length === 0
            ? "Todavía no hay hojas de corrección registradas."
            : "Ninguna hoja coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <>
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Número</Th>
                <Th>Cliente</Th>
                <Th>Línea</Th>
                <Th>Responsable</Th>
                <Th>Plan</Th>
                <Th
                  sort={{
                    dir: sortDir,
                    onToggle: () => {
                      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
                      setPage(1);
                    },
                  }}
                >
                  Compromiso
                </Th>
                <Th>Estado</Th>
                <Th>Ticket</Th>
              </HeadRow>
            </thead>

            <tbody>
              {pageRows.map((sheet) => {
                const items = itemsBySheet[sheet.id] ?? [];
                const settled = items.filter(isPlanItemSettled).length;
                const overdue = isSheetOverdue(sheet);

                return (
                  <Row key={sheet.id}>
                    <Td>
                      <Link
                        to={`/calidad/hca/${sheet.id}`}
                        className="rounded-edge whitespace-nowrap font-mono text-[12px] font-medium text-ink underline-offset-4
                          outline-none hover:underline focus-visible:ring-3 focus-visible:ring-brand-red/20"
                      >
                        {sheet.number}
                      </Link>
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">{clientName(sheet.clientId)}</Td>
                    <Td className="text-[12.5px] text-brand-gray">{lineName(sheet.productLineId)}</Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {staffName(sheet.responsibleStaffId)}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {items.length === 0 ? (
                        <span className="text-faint">Sin acciones</span>
                      ) : (
                        `${settled}/${items.length} resueltas`
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="block text-[12.5px] text-brand-gray">
                        {formatDay(sheet.dueDate)}
                      </span>
                      {sheet.status !== "Cerrada" && (
                        <span
                          className={`block text-[11.5px] ${
                            overdue ? "font-medium text-brand-red-dark" : "text-faint"
                          }`}
                        >
                          {describeDue(sheet.dueDate)}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <HcaStatusBadge status={sheet.status} overdue={overdue} />
                    </Td>
                    <Td>
                      <TicketLink number={sheet.ticketNumber} />
                    </Td>
                  </Row>
                );
              })}
            </tbody>
          </DataTable>

          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            noun="hojas"
          />
        </>
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        Datos de prueba: el módulo de Calidad todavía no tiene backend. Las hojas, los planes de
        acción y los clientes que se ven aquí son de ejemplo, y los vínculos con tickets quedan
        apagados hasta que exista la Bandeja.
      </p>

      {modalOpen && (
        <HcaModal
          clients={clients}
          productLines={productLines}
          staff={staff}
          existing={all}
          onClose={() => setModalOpen(false)}
          onSave={(sheet) => setSheets((previous) => upsertById(previous ?? [], sheet))}
        />
      )}
    </div>
  );
}
