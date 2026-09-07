import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/app/Sidebar";
import { EmailCountsProvider } from "../context/EmailCountsContext";

export function AppLayout() {
  return (
    <EmailCountsProvider>
      <div className="flex h-screen bg-white">
        <Sidebar />
        {/* flex-col + overflow-hidden: cada pagina decide su propia zona de scroll,
            en vez de que el layout adivine un alto fijo. */}
        {/* 32 px de margen a cada lado se comen 64 de los 322 que deja el riel
            en un telefono. El aire lateral es de pantalla ancha; en angosto el
            contenido lo necesita mas que el margen. */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-4 pt-5 lg:px-8 lg:pt-6">
          <Outlet />
        </main>
      </div>
    </EmailCountsProvider>
  );
}
