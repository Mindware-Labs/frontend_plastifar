import { Outlet } from "react-router-dom";
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
      {/* El lienzo ya no empieza en el area de contenido: lo lleva el shell
          entero, y el carril lateral y la barra superior flotan encima como
          dos superficies blancas mas. Con el shell en blanco, esas dos piezas
          no eran superficies —eran el fondo— y por eso la pagina se partia en
          dos mundos: cromo plano arriba y a la izquierda, tarjetas flotando en
          el resto. */}
      <div className="flex h-screen bg-canvas">
        <Sidebar />

        {/* `overflow-hidden` sigue siendo a proposito: cada pagina decide su
            propia zona de scroll en vez de que el layout adivine un alto fijo. */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <BreadcrumbLabelContext.Provider value={setDynamicLabel}>
            {/* El lienzo tintado. Las superficies de trabajo —tablas, paneles,
                tarjetas— flotan encima en blanco. Esa diferencia minima de
                valor es lo que las despega sin necesitar una sombra pesada. */}
            <div className="flex min-h-0 flex-1 flex-col px-3 pt-3 lg:px-4 lg:pt-4">
              <Outlet />
            </div>
          </BreadcrumbLabelContext.Provider>

          <ReceiptStack />
        </main>
      </div>
    </>
  );
}
