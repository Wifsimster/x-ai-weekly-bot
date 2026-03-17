import { useApi } from '@/hooks/use-api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CookiesCard } from '@/components/settings/cookies-card';
import { BotBehaviorCard } from '@/components/settings/bot-behavior-card';
import { DiscordCard } from '@/components/settings/discord-card';
import { GraphqlCard } from '@/components/settings/graphql-card';
import type { ConfigResponse } from '@/types';

export function SettingsPage() {
  const { data: config, loading, refetch } = useApi<ConfigResponse>('/api/config');

  if (loading || !config) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  const { envDefaults, credentialInfo } = config;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">
          Configuration du bot — les valeurs personnalisées prennent le pas sur les variables
          d'environnement
        </p>
      </div>

      {/* Page-level auth warning banner */}
      {!credentialInfo.hasAuth && (
        <Alert variant="warning">
          <AlertDescription>
            <strong>Dashboard non protégé</strong> — Configurez la variable d'environnement{' '}
            <code className="font-mono text-xs">ADMIN_PASSWORD</code> pour sécuriser l'accès aux
            cookies de session et aux paramètres sensibles.
          </AlertDescription>
        </Alert>
      )}

      <CookiesCard credentialInfo={credentialInfo} onSaved={refetch} />
      <BotBehaviorCard envDefaults={envDefaults} onSaved={refetch} />
      <DiscordCard credentialInfo={credentialInfo} onSaved={refetch} />
      <GraphqlCard envDefaults={envDefaults} onSaved={refetch} />
    </div>
  );
}
