import { Outlet } from "react-router-dom";
import { AppBar } from "../components/app/AppBar";
import { InboxAlerts } from "../components/app/InboxAlerts";
import { Sidebar } from "../components/app/Sidebar";
import { ReceiptStack } from "../components/app/ReceiptStack";
import { EmailCountsProvider } from "../context/EmailCountsContext";
import { ReceiptProvider } from "../context/ReceiptContext";
import { BreadcrumbLabelContext } from "../context/useBreadcrumb";
import { PageChromeProvider } from "./PageChromeContext";
import { usePageChromeStore } from "./usePageChrome";

export function AppLayout() {
  return (
    <EmailCountsProvider>
      <ReceiptProvider>
        <PageChromeProvider>
          <Shell />
        </PageChromeProvider>
      </ReceiptProvider>
    </EmailCountsProvider>
  );
}

/**
 * El armazón.
 *
 * Vive dentro de `PageChromeProvider` porque la barra lee lo que cada pantalla
 * declaró, y el proveedor de la etiqueta dinámica del breadcrumb se monta acá
 * por la misma razón: `useDynamicBreadcrumb` llevaba tres pantallas publicando
 * un nombre en un contexto que no tenía proveedor, así que no se renderizaba en
 * ninguna parte.
 */
function Shell() {
  const { setDynamicLabel } = usePageChromeStore();

  return (
    <>
      <InboxAlerts />
      <div className="flex h-screen bg-white">
        <Sidebar />

        {/* `overflow-hidden` sigue siendo a proposito: cada pagina decide su
            propia zona de scroll en vez de que el layout adivine un alto fijo.

            La barra va ARRIBA de esa zona, no dentro: por estar encima del
            elemento que scrollea se queda quieta por construccion, sin
            `position: sticky` y sin que ninguna pantalla ceda el scroll.

            El padding que antes vivia aca bajo al div de contenido: la barra va
            a sangre, borde a borde. */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <BreadcrumbLabelContext.Provider value={setDynamicLabel}>
            <AppBar />

            <div className="flex min-h-0 flex-1 flex-col px-4 pt-5 lg:px-8 lg:pt-6">
              <Outlet />
            </div>
          </BreadcrumbLabelContext.Provider>

          <ReceiptStack />
        </main>
      </div>
    </>
  );
}
