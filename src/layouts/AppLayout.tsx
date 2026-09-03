import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/app/Sidebar";

export function AppLayout() {
  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      {/* flex-col + overflow-hidden: cada pagina decide su propia zona de scroll,
          en vez de que el layout adivine un alto fijo. */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-8 pt-6">
        <Outlet />
      </main>
    </div>
  );
}
