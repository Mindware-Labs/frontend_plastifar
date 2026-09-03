import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/app/Sidebar";
import { TopBar } from "../components/app/TopBar";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh bg-white">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto px-8 pb-12 pt-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
