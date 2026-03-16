import { useState } from "react";
import { useApi } from "@/hooks/use-api";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { MarkdownContent } from "@/components/markdown-content";
import { BookOpen, Calendar, TrendingUp, Loader2 } from "lucide-react";
import type { RunRecord, MonthlySummaryRecord, AvailableMonth } from "@/types";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export function SummariesPage() {
  const [view, setView] = useState<"daily" | "monthly">("daily");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Syntheses</h1>
          <p className="text-muted-foreground">Historique des resumes IA quotidiens et mensuels</p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1 self-start">
          <Button
            variant={view === "daily" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("daily")}
          >
            Quotidien
          </Button>
          <Button
            variant={view === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("monthly")}
          >
            Mensuel
          </Button>
        </div>
      </div>

      {view === "daily" ? <DailyView /> : <MonthlyView />}
    </div>
  );
}

function DailyView() {
  const [page, setPage] = useState(0);
  const limit = 10;
  const { data, loading } = useApi<{ summaries: RunRecord[]; total: number }>(
    `/api/summaries?limit=${limit}&offset=${page * limit}`
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data || data.summaries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucun resume quotidien disponible.
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total resumes" icon={BookOpen}>{data.total}</StatCard>
      </div>

      <div className="space-y-4">
        {data.summaries.map((run) => (
          <SummaryCard key={run.id} run={run} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Precedent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ run }: { run: RunRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm sm:text-base">{formatDate(run.started_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{run.tweets_fetched} tweets</Badge>
            <Badge variant="outline">Run #{run.id}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={!expanded ? "max-h-[4.5rem] overflow-hidden relative" : ""}>
          <MarkdownContent content={run.summary ?? ""} className="text-sm" />
          {!expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent" />
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-primary"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Reduire" : "Lire la suite"}
        </Button>
      </CardContent>
    </Card>
  );
}

function MonthlyView() {
  const { data: available, loading: loadingAvailable } = useApi<AvailableMonth[]>("/api/monthly-summaries/available");
  const { data: existingSummaries, loading: loadingSummaries, refetch } = useApi<MonthlySummaryRecord[]>("/api/monthly-summaries");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (loadingAvailable || loadingSummaries) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  const years = [...new Set((available || []).map((m) => m.year))];
  const monthsForYear = (available || []).filter((m) => String(m.year) === selectedYear);

  const handleGenerate = async () => {
    if (!selectedYear || !selectedMonth) return;
    setGenerating(true);
    setGenMessage(null);
    try {
      const res = await fetch("/api/monthly-summaries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: Number(selectedYear), month: Number(selectedMonth) }),
      });
      const data = await res.json();
      if (data.success) {
        setGenMessage({ type: "success", text: "Resume mensuel genere avec succes." });
        refetch();
      } else {
        setGenMessage({ type: "error", text: data.message || "Erreur lors de la generation." });
      }
    } catch {
      setGenMessage({ type: "error", text: "Erreur reseau." });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Generer un resume mensuel
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Annee</label>
              <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setSelectedMonth(""); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Annee" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Mois</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={!selectedYear}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Mois" />
                </SelectTrigger>
                <SelectContent>
                  {monthsForYear.map((m) => (
                    <SelectItem key={m.month} value={String(m.month)}>
                      {MONTH_NAMES[m.month - 1]} ({m.run_count} runs)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!selectedYear || !selectedMonth || generating}
            >
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {generating ? "Generation..." : "Generer"}
            </Button>
          </div>
          {genMessage && (
            <p className={`text-sm ${genMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
              {genMessage.text}
            </p>
          )}
        </CardContent>
      </Card>

      {existingSummaries && existingSummaries.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Resumes mensuels generes</h2>
          {existingSummaries.map((ms) => (
            <MonthlySummaryCard key={ms.id} summary={ms} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun resume mensuel genere. Selectionnez un mois ci-dessus pour en creer un.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MonthlySummaryCard({ summary }: { summary: MonthlySummaryRecord }) {
  const [expanded, setExpanded] = useState(false);
  const runIds: number[] = JSON.parse(summary.source_run_ids);

  return (
    <Card className="border-l-4 border-l-primary/40">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-semibold text-base sm:text-lg">
              {MONTH_NAMES[summary.month - 1]} {summary.year}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{runIds.length} jours</Badge>
            <Badge variant="outline">{formatDate(summary.generated_at)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={!expanded ? "max-h-[6rem] overflow-hidden relative" : ""}>
          <MarkdownContent content={summary.summary ?? ""} className="text-sm" />
          {!expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent" />
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-primary"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Reduire" : "Lire la suite"}
        </Button>
      </CardContent>
    </Card>
  );
}
