import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/app/Sidebar";
import { TopBar } from "../components/app/TopBar";
import { BreadcrumbLabelContext } from "../context/useBreadcrumb";
import { resolveBreadcrumb } from "../lib/breadcrumbs";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dynamicLabel, setDynamicLabel] = useState<string | null>(null);
  const { pathname } = useLocation();

  // Una ficha nueva empieza sin nombre resuelto todavia; sin este reinicio, el
  // breadcrumb mostraria el nombre de la ficha anterior mientras carga la
  // siguiente si React reutiliza el mismo componente de pagina.
  useEffect(() => setDynamicLabel(null), [pathname]);

  const crumbs = resolveBreadcrumb(pathname, dynamicLabel);

  return (
    <BreadcrumbLabelContext.Provider value={setDynamicLabel}>
      <div className="flex h-dvh bg-white">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar crumbs={crumbs} onOpenMenu={() => setMobileOpen(true)} />

          <main className="flex-1 overflow-y-auto px-8 pb-12 pt-4">
            <Outlet />
          </main>
        </div>
      </div>
    </BreadcrumbLabelContext.Provider>
  );
}
