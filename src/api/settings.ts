import { apiRequest, toQuery } from "./client";
import type {
  EmailTemplate,
  Holiday,
  Mailbox,
  Plant,
  PlantCountry,
  Product,
  ProductImportResult,
  ProductLine,
  ProductLookupItem,
  SavePlantRequest,
  SaveProductRequest,
  SaveTeamRequest,
  SlaPolicy,
  Team,
  TeamMember,
} from "../types/settings";

interface Counts {
  all: number;
  active: number;
  inactive: number;
}

interface ListResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: Counts;
}

export interface CatalogQuery {
  page: number;
  pageSize: number;
  search?: string;
  /** todos | activos | inactivos, salvo topics: usa 1er/2do valor propio abajo */
  status?: string;
  sort?: string;
  dir?: "asc" | "desc";
}

export interface SlaQuery extends CatalogQuery {
  priority?: string;
}

/** El calendario filtra por año completo, no por texto de fecha. */
export interface HolidayQuery extends CatalogQuery {
  year?: number;
}

export interface PlantQuery extends CatalogQuery {
  country?: PlantCountry;
  /** «sin-activo»: solo las plantas sin administrador o con uno desactivado. */
  manager?: "sin-activo";
}

/** Los contadores de estado más el del filtro propio, que no depende de ellos. */
type PlantListResponse = Omit<ListResponse<Plant>, "counts"> & {
  counts: Counts & { withoutActiveManager: number };
};

export interface TeamQuery extends CatalogQuery {
  /** «sin-activos»: solo los equipos sin ningún integrante activo. */
  members?: "sin-activos";
}

type TeamListResponse = Omit<ListResponse<Team>, "counts"> & {
  counts: Counts & { withoutActiveMembers: number };
};

export interface ProductQuery extends CatalogQuery {
  productLineId?: number;
  plantId?: number;
}

export const settingsApi = {
  slaPolicies: {
    list: (query: SlaQuery) =>
      apiRequest<ListResponse<SlaPolicy>>(`/api/settings/sla-policies${toQuery({ ...query })}`),
    get: (id: number) => apiRequest<SlaPolicy>(`/api/settings/sla-policies/${id}`),
    create: (data: Omit<SlaPolicy, "id">) =>
      apiRequest<SlaPolicy>("/api/settings/sla-policies", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<SlaPolicy, "id">) =>
      apiRequest<SlaPolicy>(`/api/settings/sla-policies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/sla-policies/${id}`, { method: "DELETE" }),
  },

  holidays: {
    list: (query: HolidayQuery) =>
      apiRequest<ListResponse<Holiday>>(`/api/settings/holidays${toQuery({ ...query })}`),
    get: (id: number) => apiRequest<Holiday>(`/api/settings/holidays/${id}`),
    create: (data: Omit<Holiday, "id">) =>
      apiRequest<Holiday>("/api/settings/holidays", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<Holiday, "id">) =>
      apiRequest<Holiday>(`/api/settings/holidays/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/holidays/${id}`, { method: "DELETE" }),
  },

  productLines: {
    list: (query: CatalogQuery) =>
      apiRequest<ListResponse<ProductLine>>(`/api/settings/product-lines${toQuery({ ...query })}`),
    get: (id: number) => apiRequest<ProductLine>(`/api/settings/product-lines/${id}`),
    create: (data: Omit<ProductLine, "id">) =>
      apiRequest<ProductLine>("/api/settings/product-lines", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<ProductLine, "id">) =>
      apiRequest<ProductLine>(`/api/settings/product-lines/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/product-lines/${id}`, { method: "DELETE" }),
  },

  // Se desactiva guardándolo; `remove` es el borrado real y el servidor lo
  // rechaza con 409 si algún formulario ya lo nombra.
  products: {
    list: (query: ProductQuery) =>
      apiRequest<ListResponse<Product>>(`/api/settings/products${toQuery({ ...query })}`),
    /** Búsqueda acotada del selector: solo activos, como mucho veinte. */
    lookup: (search?: string) =>
      apiRequest<ProductLookupItem[]>(`/api/settings/products/lookup${toQuery({ search })}`),
    get: (id: number) => apiRequest<Product>(`/api/settings/products/${id}`),
    create: (data: SaveProductRequest) =>
      apiRequest<Product>("/api/settings/products", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: SaveProductRequest) =>
      apiRequest<Product>(`/api/settings/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/products/${id}`, { method: "DELETE" }),
    /** Carga por archivo CSV: crea códigos nuevos y corrige descripciones; nunca borra. */
    import: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiRequest<ProductImportResult>("/api/settings/products/import", {
        method: "POST",
        body: form,
      });
    },
  },

  // Se desactiva guardándola; `remove` es el borrado real y el servidor lo
  // rechaza con 409 si algún equipo o producto la usa.
  plants: {
    list: (query: PlantQuery) =>
      apiRequest<PlantListResponse>(`/api/settings/plants${toQuery({ ...query })}`),
    get: (id: number) => apiRequest<Plant>(`/api/settings/plants/${id}`),
    create: (data: SavePlantRequest) =>
      apiRequest<Plant>("/api/settings/plants", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: SavePlantRequest) =>
      apiRequest<Plant>(`/api/settings/plants/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/plants/${id}`, { method: "DELETE" }),
  },

  // Se desactiva guardándolo; `remove` es el borrado real y el servidor lo
  // rechaza con 409 mientras tenga integrantes.
  teams: {
    list: (query: TeamQuery) =>
      apiRequest<TeamListResponse>(`/api/settings/teams${toQuery({ ...query })}`),
    get: (id: number) => apiRequest<Team>(`/api/settings/teams/${id}`),
    create: (data: SaveTeamRequest) =>
      apiRequest<Team>("/api/settings/teams", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: SaveTeamRequest) =>
      apiRequest<Team>(`/api/settings/teams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/teams/${id}`, { method: "DELETE" }),
    members: {
      list: (teamId: number) => apiRequest<TeamMember[]>(`/api/settings/teams/${teamId}/members`),
      add: (teamId: number, staffId: number) =>
        apiRequest<TeamMember>(`/api/settings/teams/${teamId}/members`, {
          method: "POST",
          body: JSON.stringify({ staffId }),
        }),
      remove: (teamId: number, staffId: number) =>
        apiRequest<void>(`/api/settings/teams/${teamId}/members/${staffId}`, { method: "DELETE" }),
    },
  },

  templates: {
    list: (query: CatalogQuery) =>
      apiRequest<ListResponse<EmailTemplate>>(`/api/settings/templates${toQuery({ ...query })}`),
    get: (id: number) => apiRequest<EmailTemplate>(`/api/settings/templates/${id}`),
    create: (data: Omit<EmailTemplate, "id">) =>
      apiRequest<EmailTemplate>("/api/settings/templates", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<EmailTemplate, "id">) =>
      apiRequest<EmailTemplate>(`/api/settings/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/templates/${id}`, { method: "DELETE" }),
  },

  mailboxes: {
    list: (query: CatalogQuery) =>
      apiRequest<ListResponse<Mailbox>>(`/api/settings/mailboxes${toQuery({ ...query })}`),
    get: (id: number) => apiRequest<Mailbox>(`/api/settings/mailboxes/${id}`),
    create: (data: Omit<Mailbox, "id" | "lastSyncedAt">) =>
      apiRequest<Mailbox>("/api/settings/mailboxes", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<Mailbox, "id" | "lastSyncedAt">) =>
      apiRequest<Mailbox>(`/api/settings/mailboxes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => apiRequest<void>(`/api/settings/mailboxes/${id}`, { method: "DELETE" }),
    test: (id: number) =>
      apiRequest<{ ok: boolean; message: string }>(`/api/settings/mailboxes/${id}/test`, { method: "POST" }),
  },
};
