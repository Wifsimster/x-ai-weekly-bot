import { useState } from "react";
import { useApi } from "@/hooks/use-api";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import type { StatusResponse } from "@/types";

export function DashboardPage() {
  const { data: status, loading, refetch } = useApi<StatusResponse>("/api/status");
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleTrigger = async () => {
    if (!confirm("Lancer un run maintenant ?")) return;
    setTriggering(true);
    setTriggerMessage(null);
    try {
      const res = await fetch("/api/trigger", { method: "POST" });
      const data = await res.json();
      setTriggerMessage({ type: data.success ? "success" : "error", text: data.message });
      setTimeout(() => refetch(), 1000);
    } catch {
      setTriggerMessage({ type: "error", text: "Erreur lors du declenchement du run." });
    } finally {
      setTriggering(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Chargement...</div>;
  if (!status) return null;

  const { lastRun, cronSchedule, running, totalRuns } = status;
  const cookiesExpired =
    lastRun?.error_message?.includes("401") ||
    lastRun?.error_message?.includes("403") ||
    lastRun?.error_message?.includes("Session cookies") ||
    false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Supervision du bot X AI Weekly</p>
      </div>

      {cookiesExpired && (
        <Alert variant="destructive">
          <AlertTitle>Session cookies expires</AlertTitle>
          <AlertDescription>
            Vos cookies de session X semblent avoir expire.{" "}
            <a href="/settings" className="underline font-medium">
              Mettez-les a jour dans Parametres
            </a>
            .
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total runs">{totalRuns}</StatCard>
        <StatCard title="Planification">
          <span className="text-base font-mono">{cronSchedule}</span>
        </StatCard>
        <StatCard title="Statut actuel">
          {running ? <StatusBadge status="running" /> : <span className="text-muted-foreground text-base">Inactif</span>}
        </StatCard>
      </div>

      {lastRun && (
        <Card>
          <CardHeader>
            <div className="font-semibold">Dernier run</div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Statut</p>
                <StatusBadge status={lastRun.status} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{lastRun.started_at}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tweets analyses</p>
                <p className="font-medium">{lastRun.tweets_fetched}</p>
              </div>
            </div>

            {lastRun.summary && (
              <div className="rounded-lg border p-4">
                <p className="font-semibold mb-2">Resume IA</p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{lastRun.summary}</div>
              </div>
            )}

            {lastRun.error_message && (
              <details open>
                <summary className="cursor-pointer font-medium text-destructive">Erreur</summary>
                <pre className="mt-2 rounded-lg bg-muted p-4 text-xs overflow-x-auto max-h-96">{lastRun.error_message}</pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {!lastRun && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Aucun run enregistre.</CardContent>
        </Card>
      )}

      {triggerMessage && (
        <Alert variant={triggerMessage.type === "success" ? "success" : "destructive"}>
          <AlertDescription>{triggerMessage.text}</AlertDescription>
        </Alert>
      )}

      <Button onClick={handleTrigger} disabled={running || triggering} className="w-full sm:w-auto">
        {running || triggering ? "Run en cours..." : "Lancer un run maintenant"}
      </Button>
    </div>
  );
}
