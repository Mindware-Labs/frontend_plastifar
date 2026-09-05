import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/app/Sidebar";
import { TopBar } from "../components/app/TopBar";
import { BreadcrumbLabelContext } from "../context/useBreadcrumb";
import { resolveBreadcrumb } from "../lib/breadcrumbs";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  // El nombre publicado por una ficha se guarda junto a la ruta a la que
  // pertenece. Descartarlo aqui, en el render, y no en un efecto es lo que
  // evita el fotograma con el nombre de la ficha anterior: un efecto corre
  // despues de pintar, asi que el navegador alcanzaria a dibujar el nombre
  // viejo una vez antes del reinicio.
  const [published, setPublished] = useState<{ path: string; label: string } | null>(null);
  const dynamicLabel = published?.path === pathname ? published.label : null;

  const publishLabel = useCallback(
    (label: string | null) => setPublished(label === null ? null : { path: pathname, label }),
    [pathname],
  );

  const crumbs = resolveBreadcrumb(pathname, dynamicLabel);

  return (
    <BreadcrumbLabelContext.Provider value={publishLabel}>
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
