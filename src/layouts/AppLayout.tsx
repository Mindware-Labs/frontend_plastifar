import { Outlet } from "react-router-dom";
import { InboxAlerts } from "../components/app/InboxAlerts";
import { Sidebar } from "../components/app/Sidebar";
import { ReceiptStack } from "../components/app/ReceiptStack";
import { EmailCountsProvider } from "../context/EmailCountsContext";
import { ReceiptProvider } from "../context/ReceiptContext";
// .
export function AppLayout() {
  return (
    <EmailCountsProvider>
      <ReceiptProvider>
        <InboxAlerts />
        <div className="flex h-screen bg-white">
          <Sidebar />
          {/* flex-col + overflow-hidden: cada pagina decide su propia zona de scroll,
              en vez de que el layout adivine un alto fijo.

              relative: los recibos se anclan al area de contenido, no a la ventana.

              32 px de margen a cada lado se comen 64 de los 322 que deja el riel
              en un telefono. El aire lateral es de pantalla ancha; en angosto el
              contenido lo necesita mas que el margen. */}
          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden px-4 pt-5 lg:px-8 lg:pt-6">
            <Outlet />
            <ReceiptStack />
          </main>
        </div>
      </ReceiptProvider>
    </EmailCountsProvider>
  );
}
