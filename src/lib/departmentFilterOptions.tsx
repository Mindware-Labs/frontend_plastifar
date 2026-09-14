import {
  Boxes,
  Briefcase,
  Building2,
  Cog,
  Factory,
  Laptop,
  LayoutGrid,
  Receipt,
  Scale,
  ShieldCheck,
  TrendingUp,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import type { FilterOption } from "../components/ui/FilterDropdown";
import type { DepartmentResponse } from "../types/api";

// Resuelve el icono temático para cada departamento según su nombre.
export function getDepartmentIcon(departmentName: string) {
  const name = departmentName.toLowerCase();
  if (name.includes("almac")) return <Boxes className="h-4 w-4 text-amber-600" />;
  if (name.includes("admin")) return <Briefcase className="h-4 w-4 text-blue-600" />;
  if (name.includes("calidad")) return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
  if (name.includes("producc")) return <Factory className="h-4 w-4 text-purple-600" />;
  if (name.includes("manten")) return <Wrench className="h-4 w-4 text-orange-600" />;
  if (name.includes("ventas") || name.includes("comercial")) return <TrendingUp className="h-4 w-4 text-cyan-600" />;
  if (name.includes("rrhh") || name.includes("human") || name.includes("talento")) return <Users className="h-4 w-4 text-rose-600" />;
  if (name.includes("tecnolog") || name.includes("sistema") || name.includes("it")) return <Laptop className="h-4 w-4 text-indigo-600" />;
  if (name.includes("logíst") || name.includes("transporte") || name.includes("despacho")) return <Truck className="h-4 w-4 text-amber-600" />;
  if (name.includes("contab") || name.includes("finanz")) return <Receipt className="h-4 w-4 text-emerald-600" />;
  if (name.includes("legal")) return <Scale className="h-4 w-4 text-slate-600" />;
  if (name.includes("operac")) return <Cog className="h-4 w-4 text-blue-600" />;
  return <Building2 className="h-4 w-4 text-zinc-500" />;
}

// Opciones del filtro de departamentos con iconos identificadores.
export function buildDepartmentFilterOptions(
  departments: DepartmentResponse[],
  allLabel = "Todos los departamentos",
): FilterOption[] {
  return [
    {
      value: "todos",
      label: allLabel,
      icon: <LayoutGrid className="h-4 w-4 text-zinc-500" />,
    },
    ...departments.map((d) => ({
      value: String(d.id),
      label: d.name,
      icon: getDepartmentIcon(d.name),
    })),
  ];
}
