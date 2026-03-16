import { useApi } from "@/hooks/use-api";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { RunRecord } from "@/types";

export function RunsPage() {
  const { data: runs, loading } = useApi<RunRecord[]>("/api/runs?limit=50");

  if (loading) return <div className="text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historique des runs</h1>
        <p className="text-muted-foreground">Les 50 derniers runs du bot</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Debut</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Declencheur</TableHead>
            <TableHead>Tweets</TableHead>
            <TableHead>Resume</TableHead>
            <TableHead>Erreur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(!runs || runs.length === 0) && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                Aucun run enregistre.
              </TableCell>
            </TableRow>
          )}
          {runs?.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="font-medium">{run.id}</TableCell>
              <TableCell className="text-sm">{run.started_at}</TableCell>
              <TableCell className="text-sm">{run.finished_at || "\u2014"}</TableCell>
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell className="text-sm">{run.trigger_type}</TableCell>
              <TableCell>{run.tweets_fetched}</TableCell>
              <TableCell>
                {run.summary ? (
                  <details>
                    <summary className="cursor-pointer text-sm text-primary hover:underline">Voir le resume</summary>
                    <div className="mt-2 max-w-md whitespace-pre-wrap text-xs leading-relaxed p-2 rounded bg-muted">
                      {run.summary}
                    </div>
                  </details>
                ) : (
                  "\u2014"
                )}
              </TableCell>
              <TableCell>
                {run.error_message ? (
                  <span className="text-xs text-destructive">{run.error_message.slice(0, 80)}</span>
                ) : (
                  "\u2014"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
