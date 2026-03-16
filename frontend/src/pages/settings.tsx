import { useState, useRef } from 'react';
import { useApi } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { humanizeCron } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { ConfigResponse } from '@/types';

type Flash = { type: 'success' | 'error'; message: string } | null;

interface SettingField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

const BOT_FIELDS: SettingField[] = [
  { key: 'AI_MODEL', label: 'Modele IA', type: 'text' },
  { key: 'TWEETS_LOOKBACK_DAYS', label: 'Jours a analyser', type: 'number' },
  { key: 'DRY_RUN', label: 'Mode test (dry run)', type: 'select', options: ['false', 'true'] },
];

function StatusDot({ configured }: { configured: boolean }) {
  return configured ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Configure" />
  ) : (
    <XCircle className="h-4 w-4 text-destructive" aria-label="Non configure" />
  );
}

function CardFlash({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <Alert
      variant={flash.type === 'success' ? 'success' : 'destructive'}
      aria-live="polite"
    >
      <AlertDescription>{flash.message}</AlertDescription>
    </Alert>
  );
}

export function SettingsPage() {
  const { data: config, loading, refetch } = useApi<ConfigResponse>('/api/config');

  // Per-card flash states
  const [flashCookies, setFlashCookies] = useState<Flash>(null);
  const [flashSettings, setFlashSettings] = useState<Flash>(null);
  const [flashDiscord, setFlashDiscord] = useState<Flash>(null);
  const [flashGql, setFlashGql] = useState<Flash>(null);

  // Per-card loading states
  const [saving, setSaving] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [savingDiscord, setSavingDiscord] = useState(false);
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [showManualGql, setShowManualGql] = useState(false);

  const selectValuesRef = useRef<Record<string, string>>({});

  // --- Handlers ---

  const handleCredentialsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingCreds(true);
    setFlashCookies(null);
    const formData = new FormData(e.currentTarget);
    const body = {
      X_SESSION_AUTH_TOKEN: formData.get('X_SESSION_AUTH_TOKEN') as string,
      X_SESSION_CSRF_TOKEN: formData.get('X_SESSION_CSRF_TOKEN') as string,
    };
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setFlashCookies({ type: data.success ? 'success' : 'error', message: data.message });
      if (data.success) {
        e.currentTarget.reset();
        refetch();
      }
    } catch {
      setFlashCookies({ type: 'error', message: 'Erreur lors de la validation des cookies.' });
    } finally {
      setSavingCreds(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFlashSettings(null);
    const formData = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      body[key] = value as string;
    }
    for (const [key, value] of Object.entries(selectValuesRef.current)) {
      body[key] = value;
    }
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setFlashSettings({ type: data.success ? 'success' : 'error', message: data.message });
      if (data.success) refetch();
    } catch {
      setFlashSettings({ type: 'error', message: 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDetectGql = async () => {
    setDetecting(true);
    setFlashGql(null);
    try {
      const res = await fetch('/api/detect-gql-ids', { method: 'POST' });
      const data = await res.json();
      setFlashGql({ type: data.success ? 'success' : 'error', message: data.message });
      if (data.success) refetch();
    } catch {
      setFlashGql({ type: 'error', message: 'Erreur lors de la detection.' });
    } finally {
      setDetecting(false);
    }
  };

  const handleSaveGql = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFlashGql(null);
    const formData = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      body[key] = value as string;
    }
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setFlashGql({ type: data.success ? 'success' : 'error', message: data.message });
      if (data.success) {
        refetch();
        setShowManualGql(false);
      }
    } catch {
      setFlashGql({ type: 'error', message: 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  // --- Render ---

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
  const cronSchedule = envDefaults['CRON_SCHEDULE'] || '30 7 * * *';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Parametres</h1>
        <p className="text-muted-foreground">
          Configuration du bot — les valeurs personnalisees prennent le pas sur les variables
          d'environnement
        </p>
      </div>

      {/* Page-level auth warning banner */}
      {!credentialInfo.hasAuth && (
        <Alert variant="warning">
          <AlertDescription>
            <strong>Dashboard non protege</strong> — Configurez la variable d'environnement{' '}
            <code className="font-mono text-xs">ADMIN_PASSWORD</code> pour securiser l'acces aux
            cookies de session et aux parametres sensibles.
          </AlertDescription>
        </Alert>
      )}

      {/* Card 1: Session Cookies X */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Session Cookies X</div>
              <p className="text-sm text-muted-foreground">
                Cookies de session pour le scraping — extraits depuis votre navigateur (DevTools &gt;
                Application &gt; Cookies &gt; x.com)
              </p>
            </div>
            <StatusDot configured={!!credentialInfo.authTokenMasked && !!credentialInfo.csrfTokenMasked} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardFlash flash={flashCookies} />

          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth_token">auth_token</Label>
              <Input
                id="auth_token"
                name="X_SESSION_AUTH_TOKEN"
                type="password"
                placeholder="Collez votre auth_token ici"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {credentialInfo.authTokenMasked ? (
                  <>
                    Valeur actuelle :{' '}
                    <code className="font-mono">{credentialInfo.authTokenMasked}</code>
                  </>
                ) : (
                  'Non configure'
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="csrf_token">ct0 (CSRF token)</Label>
              <Input
                id="csrf_token"
                name="X_SESSION_CSRF_TOKEN"
                type="password"
                placeholder="Collez votre ct0 ici"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {credentialInfo.csrfTokenMasked ? (
                  <>
                    Valeur actuelle :{' '}
                    <code className="font-mono">{credentialInfo.csrfTokenMasked}</code>
                  </>
                ) : (
                  'Non configure'
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Button type="submit" disabled={savingCreds}>
                {savingCreds ? 'Validation...' : 'Valider et sauvegarder'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Les cookies seront testes contre l'API X avant d'etre sauvegardes.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Card 2: Bot Behavior */}
      <Card>
        <CardHeader>
          <div className="font-semibold">Comportement du bot</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardFlash flash={flashSettings} />

          <form onSubmit={handleSettingsSubmit} className="space-y-4">
            {BOT_FIELDS.map((field) => {
              const envVal = envDefaults[field.key] || '';
              return (
                <div
                  key={field.key}
                  className="grid gap-2 sm:grid-cols-[200px_1fr_auto] items-center"
                >
                  <div>
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <p className="text-xs text-muted-foreground font-mono">{field.key}</p>
                  </div>
                  {field.type === 'select' && field.options ? (
                    <Select
                      defaultValue={envVal}
                      onValueChange={(v) => {
                        selectValuesRef.current[field.key] = v;
                      }}
                    >
                      <SelectTrigger id={field.key}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      name={field.key}
                      id={field.key}
                      type={field.type}
                      defaultValue={envVal}
                      placeholder={envVal}
                    />
                  )}
                  <div className="text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      env: {envVal}
                    </Badge>
                  </div>
                </div>
              );
            })}

            {/* CRON_SCHEDULE: read-only display */}
            <div className="grid gap-2 sm:grid-cols-[200px_1fr_auto] items-center">
              <div>
                <Label>Planification</Label>
                <p className="text-xs text-muted-foreground font-mono">CRON_SCHEDULE</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                  {humanizeCron(cronSchedule)}
                </code>
                <span className="text-xs text-muted-foreground">({cronSchedule})</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Modifiable via variable d'environnement (redemarrage requis)
              </p>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Card 3: Discord Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Notifications Discord</div>
              <p className="text-sm text-muted-foreground">
                Recevez automatiquement les resumes quotidiens sur un salon Discord via webhook.
              </p>
            </div>
            <StatusDot configured={!!credentialInfo.discordWebhookMasked} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardFlash flash={flashDiscord} />

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingDiscord(true);
              setFlashDiscord(null);
              const formData = new FormData(e.currentTarget);
              const url = (formData.get('DISCORD_WEBHOOK_URL') as string)?.trim();
              try {
                const res = await fetch('/api/discord-webhook', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ DISCORD_WEBHOOK_URL: url }),
                });
                const data = await res.json();
                setFlashDiscord({
                  type: data.success ? 'success' : 'error',
                  message: data.message,
                });
                if (data.success) {
                  e.currentTarget.reset();
                  refetch();
                }
              } catch {
                setFlashDiscord({
                  type: 'error',
                  message: 'Erreur lors de la sauvegarde du webhook.',
                });
              } finally {
                setSavingDiscord(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="discord_webhook">URL du Webhook</Label>
              <Input
                id="discord_webhook"
                name="DISCORD_WEBHOOK_URL"
                type="password"
                placeholder="https://discord.com/api/webhooks/..."
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {credentialInfo.discordWebhookMasked ? (
                  <>
                    Valeur actuelle :{' '}
                    <code className="font-mono">{credentialInfo.discordWebhookMasked}</code>
                  </>
                ) : (
                  'Non configure'
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={savingDiscord}>
                {savingDiscord ? 'Enregistrement...' : 'Sauvegarder'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={testingDiscord || !credentialInfo.discordWebhookMasked}
                onClick={async () => {
                  setTestingDiscord(true);
                  setFlashDiscord(null);
                  try {
                    const res = await fetch('/api/test-discord', { method: 'POST' });
                    const data = await res.json();
                    setFlashDiscord({
                      type: data.success ? 'success' : 'error',
                      message: data.message,
                    });
                  } catch {
                    setFlashDiscord({ type: 'error', message: 'Erreur lors du test.' });
                  } finally {
                    setTestingDiscord(false);
                  }
                }}
              >
                {testingDiscord ? 'Envoi en cours...' : 'Tester le webhook'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Card 4: GraphQL IDs (merged: display + detect + manual edit) */}
      <Card>
        <CardHeader>
          <div className="font-semibold">IDs GraphQL X</div>
          <p className="text-sm text-muted-foreground">
            Les IDs GraphQL changent quand X deploie une nouvelle version. Utilisez la detection
            automatique ou modifiez-les manuellement si necessaire.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardFlash flash={flashGql} />

          {/* Read-only display of current IDs */}
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground font-mono">UserByScreenName</p>
              <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                {envDefaults['X_GQL_USER_BY_SCREEN_NAME_ID'] || 'Non detecte'}
              </code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-mono">HomeLatestTimeline</p>
              <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                {envDefaults['X_GQL_HOME_TIMELINE_ID'] || 'Non detecte'}
              </code>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleDetectGql} disabled={detecting}>
              {detecting ? 'Detection en cours...' : 'Detecter les IDs GraphQL'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowManualGql(!showManualGql)}
            >
              {showManualGql ? 'Masquer' : 'Modifier manuellement'}
            </Button>
          </div>

          {/* Manual edit toggle */}
          {showManualGql && (
            <form onSubmit={handleSaveGql} className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="gql_user">UserByScreenName ID</Label>
                <Input
                  id="gql_user"
                  name="X_GQL_USER_BY_SCREEN_NAME_ID"
                  type="text"
                  defaultValue={envDefaults['X_GQL_USER_BY_SCREEN_NAME_ID'] || ''}
                  placeholder="ex: qW5u-DAuXpMEG0zA1F7UGQ"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gql_timeline">HomeLatestTimeline ID</Label>
                <Input
                  id="gql_timeline"
                  name="X_GQL_HOME_TIMELINE_ID"
                  type="text"
                  defaultValue={envDefaults['X_GQL_HOME_TIMELINE_ID'] || ''}
                  placeholder="ex: ulQKqowrFU94KfUAZqgGvg"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Sauvegarder les IDs'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
