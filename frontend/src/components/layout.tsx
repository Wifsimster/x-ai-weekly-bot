import { useState, useEffect } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '@/components/theme-provider';
import { useApi } from '@/hooks/use-api';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { BrainCircuit, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'text-sm transition-colors hover:text-foreground py-1 border-b-2',
    isActive
      ? 'text-foreground font-medium border-primary'
      : 'text-muted-foreground border-transparent',
  );
}

function mobileNavLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'block py-3 px-2 text-base transition-colors hover:text-foreground rounded-md',
    isActive
      ? 'text-foreground font-medium bg-primary/10'
      : 'text-muted-foreground',
  );
}

export function Layout() {
  const { theme, setTheme } = useTheme();
  const { data: versionInfo } = useApi<{ version: string; buildDate: string | null }>(
    '/api/version',
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-primary/15 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between px-4 h-14">
          <Link
            to="/"
            className="font-bold text-lg flex items-center gap-2 hover:text-primary transition-colors"
          >
            <BrainCircuit className="h-5 w-5 text-primary" />X AI Weekly Bot
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <NavLink to="/" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/runs" className={navLinkClass}>
              Historique
            </NavLink>
            <NavLink to="/summaries" className={navLinkClass}>
              Synthèses
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              Paramètres
            </NavLink>
            <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
              <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Thème">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Système</SelectItem>
                <SelectItem value="light">Clair</SelectItem>
                <SelectItem value="dark">Sombre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 -mr-2 hover:bg-muted rounded-md transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav panel */}
        {menuOpen && (
          <div className="md:hidden border-t border-primary/15 bg-card/95 backdrop-blur-md px-4 py-3 space-y-1">
            <NavLink to="/" end className={mobileNavLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/runs" className={mobileNavLinkClass}>
              Historique
            </NavLink>
            <NavLink to="/summaries" className={mobileNavLinkClass}>
              Synthèses
            </NavLink>
            <NavLink to="/settings" className={mobileNavLinkClass}>
              Paramètres
            </NavLink>
            <div className="pt-2 border-t border-primary/10">
              <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
                <SelectTrigger className="h-10 w-full text-sm" aria-label="Thème">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Système</SelectItem>
                  <SelectItem value="light">Clair</SelectItem>
                  <SelectItem value="dark">Sombre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </nav>
      <main className="container mx-auto flex-1 px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>
      <footer className="border-t py-4">
        <div className="container mx-auto px-4">
          <p className="text-xs text-muted-foreground">
            X AI Weekly Bot v{versionInfo?.version || 'dev'}
            {versionInfo?.buildDate && <> — Build {versionInfo.buildDate}</>}
          </p>
        </div>
      </footer>
    </div>
  );
}
