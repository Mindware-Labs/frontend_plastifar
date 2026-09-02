import { useState } from "react";
import { Outlet } from "react-router-dom";
import { ModuleTabs } from "../components/app/ModuleTabs";
import { TopBar } from "../components/app/TopBar";
import type { AppOutletContext } from "../components/app/useAppSearch";

export function AppLayout() {
  const [search, setSearch] = useState("");

  return (
    <div className="min-h-screen bg-white">
      <TopBar search={search} onSearchChange={setSearch} />
      <ModuleTabs />

      <main className="px-8 pb-12 pt-4">
        <Outlet context={{ search } satisfies AppOutletContext} />
      </main>
    </div>
  );
}
