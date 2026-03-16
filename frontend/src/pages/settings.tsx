import { useState } from "react";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ConfigResponse } from "@/types";

interface SettingField {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
}

const FIELDS: SettingField[] = [
  { key: "AI_MODEL", label: "Modele IA", type: "text" },
  { key: "TWEETS_LOOKBACK_DAYS", label: "Jours a analyser", type: "number" },
  { key: "MAX_TWEETS", label: "Max tweets", type: "number" },
  { key: "DRY_RUN", label: "Mode test (dry run)", type: "select", options: ["false", "true"] },
  { key: "CRON_SCHEDULE", label: "Planification cron", type: "text" },
  { key: "X_GQL_USER_BY_SCREEN_NAME_ID", label: "GraphQL ID — UserByScreenName", type: "text" },
  { key: "X_GQL_USER_TWEETS_ID", label: "GraphQL ID — UserTweets", type: "text" },
];

export function SettingsPage() {
  const { data: config, loading } = useApi<ConfigResponse>("/api/config");
  const [flash, setFlash] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const handleSettingsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFlash(null);
    const formData = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      body[key] = value as string;
    }
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setFlash({ type: data.success ? "success" : "error", message: data.message });
    } catch {
      setFlash({ type: "error", message: "Erreur lors de la sauvegarde." });
    } finally {
      setSaving(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingCreds(true);
    setFlash(null);
    const formData = new FormData(e.currentTarget);
    const body = {
      X_SESSION_AUTH_TOKEN: formData.get("X_SESSION_AUTH_TOKEN") as string,
      X_SESSION_CSRF_TOKEN: formData.get("X_SESSION_CSRF_TOKEN") as string,
    };
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setFlash({ type: data.success ? "success" : "error", message: data.message });
      if (data.success) e.currentTarget.reset();
    } catch {
      setFlash({ type: "error", message: "Erreur lors de la validation des cookies." });
    } finally {
      setSavingCreds(false);
    }
  };

  if (loading || !config) return <div className="text-muted-foreground">Chargement...</div>;

  const { envDefaults, credentialInfo } = config;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Parametres</h1>
        <p className="text-muted-foreground">Configuration du bot — les valeurs personnalisees prennent le pas sur les variables d'environnement</p>
      </div>

      {flash && (
        <Alert variant={flash.type === "success" ? "success" : "destructive"}>
          <AlertDescription>{flash.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="font-semibold">Parametres de configuration</div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSettingsSubmit} className="space-y-4">
            {FIELDS.map((field) => {
              const envVal = envDefaults[field.key] || "";
              return (
                <div key={field.key} className="grid gap-2 sm:grid-cols-[200px_1fr_auto] items-center">
                  <div>
                    <label className="font-medium text-sm" htmlFor={field.key}>
                      {field.label}
                    </label>
                    <p className="text-xs text-muted-foreground font-mono">{field.key}</p>
                  </div>
                  {field.type === "select" && field.options ? (
                    <select
                      name={field.key}
                      id={field.key}
                      defaultValue={envVal}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input name={field.key} id={field.key} type={field.type} defaultValue={envVal} placeholder={envVal} />
                  )}
                  <div className="text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">env: {envVal}</Badge>
                  </div>
                </div>
              );
            })}
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Detection automatique des IDs GraphQL</div>
          <p className="text-sm text-muted-foreground">
            Les IDs GraphQL changent quand X deploie une nouvelle version. Cliquez pour detecter les IDs actuels depuis x.com.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            disabled={detecting}
            onClick={async () => {
              setDetecting(true);
              setFlash(null);
              try {
                const res = await fetch("/api/detect-gql-ids", { method: "POST" });
                const data = await res.json();
                setFlash({ type: data.success ? "success" : "error", message: data.message });
              } catch {
                setFlash({ type: "error", message: "Erreur lors de la detection." });
              } finally {
                setDetecting(false);
              }
            }}
          >
            {detecting ? "Detection en cours..." : "Detecter les IDs GraphQL"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Session Cookies X</div>
          <p className="text-sm text-muted-foreground">
            Cookies de session pour le scraping — extraits depuis votre navigateur (DevTools &gt; Application &gt; Cookies &gt; x.com)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!credentialInfo.hasAuth && (
            <Alert variant="destructive">
              <AlertDescription>
                Il est fortement recommande de configurer <code className="font-mono text-xs">ADMIN_PASSWORD</code> pour proteger l'acces aux cookies de session.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="auth_token">
                auth_token
              </label>
              <Input id="auth_token" name="X_SESSION_AUTH_TOKEN" type="password" placeholder="Collez votre auth_token ici" autoComplete="off" />
              <p className="text-xs text-muted-foreground">
                {credentialInfo.authTokenMasked ? (
                  <>Valeur actuelle : <code className="font-mono">{credentialInfo.authTokenMasked}</code></>
                ) : (
                  "Non configure"
                )}
              </p>
            </div>
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="csrf_token">
                ct0 (CSRF token)
              </label>
              <Input id="csrf_token" name="X_SESSION_CSRF_TOKEN" type="password" placeholder="Collez votre ct0 ici" autoComplete="off" />
              <p className="text-xs text-muted-foreground">
                {credentialInfo.csrfTokenMasked ? (
                  <>Valeur actuelle : <code className="font-mono">{credentialInfo.csrfTokenMasked}</code></>
                ) : (
                  "Non configure"
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button type="submit" disabled={savingCreds}>
                {savingCreds ? "Validation..." : "Valider et sauvegarder"}
              </Button>
              <p className="text-xs text-muted-foreground">Les cookies seront testes contre l'API X avant d'etre sauvegardes.</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
