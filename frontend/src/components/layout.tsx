import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function Layout() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 h-14">
          <span className="font-bold text-lg">X AI Weekly Bot</span>
          <div className="flex items-center gap-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn("text-sm transition-colors hover:text-foreground", isActive ? "text-foreground font-medium" : "text-muted-foreground")
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/runs"
              className={({ isActive }) =>
                cn("text-sm transition-colors hover:text-foreground", isActive ? "text-foreground font-medium" : "text-muted-foreground")
              }
            >
              Historique
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn("text-sm transition-colors hover:text-foreground", isActive ? "text-foreground font-medium" : "text-muted-foreground")
              }
            >
              Parametres
            </NavLink>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              aria-label="Theme"
            >
              <option value="system">Systeme</option>
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </div>
        </div>
      </nav>
      <main className="container mx-auto flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t py-4">
        <div className="container mx-auto px-4">
          <p className="text-xs text-muted-foreground">X AI Weekly Bot v{window.__APP_VERSION__ || "dev"}</p>
        </div>
      </footer>
    </div>
  );
}
