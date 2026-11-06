import { Outlet } from "react-router-dom";
import { InboxAlerts } from "../components/app/InboxAlerts";
import { Sidebar } from "../components/app/Sidebar";
import { ReceiptStack } from "../components/app/ReceiptStack";
import { EmailCountsProvider } from "../context/EmailCountsContext";
import { NotificationsProvider } from "../context/NotificationsContext";
import { ReceiptProvider } from "../context/ReceiptContext";
import { BreadcrumbLabelContext } from "../context/useBreadcrumb";
import { PageChromeProvider } from "./PageChromeContext";
import { usePageChromeStore } from "./usePageChrome";

export function AppLayout() {
  return (
    <EmailCountsProvider>
      <NotificationsProvider>
        <ReceiptProvider>
          <PageChromeProvider>
            <Shell />
          </PageChromeProvider>
        </ReceiptProvider>
      </NotificationsProvider>
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
      <div className="no-print print:hidden">
        <InboxAlerts />
      </div>
      {/* El lienzo ya no empieza en el area de contenido: lo lleva el shell
          entero, y el carril lateral y la barra superior flotan encima como
          dos superficies blancas mas. Con el shell en blanco, esas dos piezas
          no eran superficies —eran el fondo— y por eso la pagina se partia en
          dos mundos: cromo plano arriba y a la izquierda, tarjetas flotando en
          el resto. */}
      <div className="flex h-screen bg-canvas print:block print:h-auto print:min-h-0 print:bg-white print:overflow-visible">
        <Sidebar />

        {/* `overflow-hidden` sigue siendo a proposito: cada pagina decide su
            propia zona de scroll en vez de que el layout adivine un alto fijo. */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden print:block print:h-auto print:min-h-0 print:overflow-visible">
          <BreadcrumbLabelContext.Provider value={setDynamicLabel}>
            {/* El lienzo tintado. Las superficies de trabajo —tablas, paneles,
                tarjetas— flotan encima en blanco. Esa diferencia minima de
                valor es lo que las despega sin necesitar una sombra pesada. */}
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 lg:px-4 lg:pb-3.5 print:block print:h-auto print:min-h-0 print:p-0 print:overflow-visible">
              <Outlet />
            </div>
          </BreadcrumbLabelContext.Provider>

          <div className="no-print print:hidden">
            <ReceiptStack />
          </div>
        </main>
      </div>
    </>
  );
}
