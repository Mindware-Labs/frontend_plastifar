import { Factory, FileUp, Layers, Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton, FilterDropdown } from "../../components/ui/FilterDropdown";
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
import {
  PLANT_COUNTRIES,
  type Plant,
  type PlantCountry,
  type Product,
  type ProductLine,
} from "../../types/settings";
import { CatalogRowActions } from "./CatalogRowActions";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy, useReferenceData } from "./catalogState";
import { ProductImportModal } from "./ProductImportModal";
import { ProductModal } from "./ProductModal";
import { idParam } from "../../lib/idParam";
import { PAGE_SIZES } from "../../lib/pageSizes";

const CHIPS = ["todos", "activos", "inactivos"] as const;
type ChipKey = (typeof CHIPS)[number];

/** Valor de los filtros de planta y de línea sin nada elegido. */
const TODOS = "todos";

const COUNTRY_LABEL: Record<PlantCountry, string> = Object.fromEntries(
  PLANT_COUNTRIES.map(({ value, label }) => [value, label]),
) as Record<PlantCountry, string>;

// El pais acompaña al nombre porque las plantas lo repiten entre paises.
function plantLabel(name: string, country: PlantCountry | null) {
  return country ? `${name} · ${COUNTRY_LABEL[country] ?? country}` : name;
}

export function ProductsSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<Product>();

  const [search, setSearch] = useUrlState<string>("q", "");
  const [plantId, setPlantId] = useUrlState<string>("planta", TODOS);
  const [productLineId, setProductLineId] = useUrlState<string>("linea", TODOS);
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todos", CHIPS);
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

  const [isImporting, setIsImporting] = useState(false);

  const debouncedSearch = useDebouncedValue(search).trim();

  /* Plantas y lineas son catalogos acotados y se recorren enteros: alimentan los
     dos filtros y las opciones del dialogo. Un fallo no vacia la pantalla; los
     filtros quedan sin opciones y el dialogo conserva lo que el producto tenia. */
  const plantsRef = useReferenceData<Plant[]>(
    () => fetchAllPages((page, size) => settingsApi.plants.list({ page, pageSize: size })),
    [],
  );
  const linesRef = useReferenceData<ProductLine[]>(
    () => fetchAllPages((page, size) => settingsApi.productLines.list({ page, pageSize: size })),
    [],
  );
  const referencesFailed = plantsRef.failed || linesRef.failed;

  // Seccion 4.1: la pagina, los filtros, la busqueda y los contadores los
  // resuelve SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.products.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      plantId: plantId === TODOS ? undefined : idParam(plantId),
      productLineId: productLineId === TODOS ? undefined : idParam(productLineId),
      status: chip === "todos" ? undefined : chip,
    },
    fallbackError: "No se pudieron cargar los productos",
    pageKey: "pagina",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering =
    debouncedSearch !== "" || chip !== "todos" || plantId !== TODOS || productLineId !== TODOS;

  function clearFilters() {
    setSearch("");
    setPlantId(TODOS);
    setProductLineId(TODOS);
    setChip("todos");
  }

  function askToggle(product: Product) {
    confirm(product.id, {
      tone: "warn",
      icon: Power,
      title: product.isActive ? "Desactivar producto" : "Reactivar producto",
      description: product.isActive ? (
        <>
          <strong className="font-semibold text-ink">{product.name}</strong> dejará de ofrecerse en
          formularios nuevos. Los que ya lo nombran conservan su código y su descripción.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{product.name}</strong> vuelve a estar disponible.
        </>
      ),
      confirmLabel: product.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        const current = await freshCopy(settingsApi.products.get, product);
        await settingsApi.products.update(current.id, {
          code: current.code,
          name: current.name,
          productLineId: current.productLineId,
          plantId: current.plantId,
          isActive: !current.isActive,
        });
        refresh();
      },
    });
  }

  /* El servidor es quien sabe si algun formulario ya nombra el producto: su 409
     sube al dialogo con el motivo, y la salida que ofrece es desactivarlo. */
  function askDelete(product: Product) {
    confirm(product.id, {
      tone: "danger",
      icon: Trash2,
      title: "Eliminar producto",
      description: (
        <>
          <strong className="font-semibold text-ink">
            {product.code} · {product.name}
          </strong>{" "}
          se borrará del catálogo. Solo es posible si ningún formulario lo nombra; si alguno lo hace,
          desactívalo en su lugar.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        await settingsApi.products.remove(product.id);
        refresh();
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Productos"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando el catálogo de productos…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "producto" : "productos"}
                  count={counts.all}
                  active={chip === "todos"}
                  onClick={() => {
                    setChip("todos");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todos los productos"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activo" : "activos"}
                  count={counts.active}
                  active={chip === "activos"}
                  onClick={() => {
                    setChip("activos");
                    setPage(1);
                  }}
                  tone="emerald"
                  dot
                  title="Filtrar por productos activos"
                />
                <HeaderTag
                  label={counts.inactive === 1 ? "inactivo" : "inactivos"}
                  count={counts.inactive}
                  active={chip === "inactivos"}
                  onClick={() => {
                    setChip("inactivos");
                    setPage(1);
                  }}
                  tone="red"
                  dot
                  title="Filtrar por productos inactivos"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsImporting(true)}
                disabled={busyId !== null}
              >
                <FileUp className="h-[15px] w-[15px]" />
                Cargar archivo
              </Button>
              <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
                <Plus className="h-[15px] w-[15px]" />
                Nuevo producto
              </Button>
            </div>
          )
        }
      />

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}
      {referencesFailed && (
        <LoadErrorAlert
          message="No se pudieron cargar las plantas o las líneas de producto para los filtros"
          onRetry={() => {
            plantsRef.reload();
            linesRef.reload();
          }}
        />
      )}

      <ListPanel
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por código o descripción…"
              className="w-[260px]"
            />

            <FilterDropdown
              title="Seleccionar planta"
              aria-label="Filtrar por planta"
              value={plantId}
              onChange={setPlantId}
              defaultIcon={<Factory className="h-3.5 w-3.5 text-zinc-500" />}
              options={[
                { value: TODOS, label: "Todas las plantas" },
                ...plantsRef.data.map((plant) => ({
                  value: String(plant.id),
                  label: plantLabel(plant.name, plant.country),
                })),
              ]}
            />

            <FilterDropdown
              title="Seleccionar línea de producto"
              aria-label="Filtrar por línea de producto"
              value={productLineId}
              onChange={setProductLineId}
              defaultIcon={<Layers className="h-3.5 w-3.5 text-zinc-500" />}
              options={[
                { value: TODOS, label: "Todas las líneas" },
                ...linesRef.data.map((line) => ({ value: String(line.id), label: line.name })),
              ]}
            />

            {(search || plantId !== TODOS || productLineId !== TODOS) && (
              <ClearFiltersButton
                onClick={() => {
                  setSearch("");
                  setPlantId(TODOS);
                  setProductLineId(TODOS);
                }}
              />
            )}
          </>
        }
        footer={
          <ListPagination
            data={data}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="productos"
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
              ? "Ningún producto coincide con este filtro o búsqueda."
              : "Todavía no hay ningún producto registrado. Crea uno o carga el catálogo desde un archivo."
          }
          onClear={isFiltering ? clearFilters : undefined}
        >
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Código</Th>
                <Th>Descripción</Th>
                <Th>Línea de producto</Th>
                <Th>Planta</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-32 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((product) => (
                <Row key={product.id} busy={busyId === product.id}>
                  <Td>
                    <span className="font-mono text-[12px] text-brand-gray">{product.code}</span>
                  </Td>
                  <Td className="text-[12.5px] font-medium text-ink">{product.name}</Td>
                  <Td className="text-[12.5px] text-subtle">
                    {product.productLineName ?? <span className="text-faint">Sin línea</span>}
                  </Td>
                  <Td className="text-[12.5px] text-subtle">
                    {product.plantName !== null ? (
                      plantLabel(product.plantName, product.plantCountry)
                    ) : (
                      <span className="text-faint">Sin planta</span>
                    )}
                  </Td>
                  <Td>
                    <StatusDot active={product.isActive} />
                  </Td>
                  {canWrite && (
                    <Td>
                      <CatalogRowActions
                        name={product.name}
                        isActive={product.isActive}
                        busy={busyId === product.id}
                        onEdit={() => setModal(product)}
                        onToggle={() => askToggle(product)}
                        onDelete={() => askDelete(product)}
                      />
                    </Td>
                  )}
                </Row>
              ))}
            </tbody>
          </DataTable>
        </ListBody>
      </ListPanel>

      {modal !== null && (
        <ProductModal
          product={modal === "nuevo" ? undefined : modal}
          productLines={linesRef.data}
          plants={plantsRef.data}
          referencesFailed={referencesFailed}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {isImporting && (
        <ProductImportModal onClose={() => setIsImporting(false)} onImported={refresh} />
      )}

      {dialog}
    </>
  );
}
