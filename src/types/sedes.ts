export interface Sede {
  id: number;
  name: string;
  address?: string | null;
  isActive: boolean;
  departmentCount: number;
  createdAt: string;
  updatedAt?: string | null;
}

export type SedeResponse = Sede;

export interface SaveSedeRequest {
  name: string;
  address?: string | null;
  isActive: boolean;
}

export interface SedeCounts {
  all: number;
  active: number;
  inactive: number;
}

export interface SedeListResponse {
  items: Sede[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: SedeCounts;
}

export interface SedeQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  /** todos | activos | inactivos */
  status?: string;
  includeInactive?: boolean;
}
