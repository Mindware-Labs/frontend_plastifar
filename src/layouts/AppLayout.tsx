import { Outlet } from "react-router-dom";
import { ModuleTabs } from "../components/app/ModuleTabs";
import { TopBar } from "../components/app/TopBar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-white">
      <TopBar />
      <ModuleTabs />

      <main className="px-8 pb-12 pt-4">
        <Outlet />
      </main>
    </div>
  );
}
