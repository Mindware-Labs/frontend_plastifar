import { Outlet } from "react-router-dom";
import { InboxAlerts } from "../components/app/InboxAlerts";
import { Sidebar } from "../components/app/Sidebar";
import { ReceiptStack } from "../components/app/ReceiptStack";
import { EmailCountsProvider } from "../context/EmailCountsContext";
import { ReceiptProvider } from "../context/ReceiptContext";

export function AppLayout() {
  return (
    <EmailCountsProvider>
      <ReceiptProvider>
        <InboxAlerts />
        <div className="flex h-screen bg-white">
          <Sidebar />
        {/* flex-col + overflow-hidden: cada pagina decide su propia zona de scroll,
            en vez de que el layout adivine un alto fijo. */}
          {/* relative: los recibos se anclan al area de contenido, no a la ventana. */}
          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden px-8 pt-6">
            <Outlet />
            <ReceiptStack />
          </main>
        </div>
      </ReceiptProvider>
    </EmailCountsProvider>
  );
}
