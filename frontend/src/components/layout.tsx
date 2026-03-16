import { NavLink, Link, Outlet } from 'react-router-dom';
import { useTheme } from '@/components/theme-provider';
import { useApi } from '@/hooks/use-api';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'text-sm transition-colors hover:text-foreground py-1 border-b-2',
    isActive
      ? 'text-foreground font-medium border-primary'
      : 'text-muted-foreground border-transparent',
  );
}

export function Layout() {
  const { theme, setTheme } = useTheme();
  const { data: versionInfo } = useApi<{ version: string; buildDate: string | null }>(
    '/api/version',
  );

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
          <div className="flex items-center gap-4">
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
        </div>
      </nav>
      <main className="container mx-auto flex-1 px-4 py-6">
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
