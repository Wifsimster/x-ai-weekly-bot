import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TweetListPanel } from "@/components/tweet-list-panel";
import { MarkdownContent } from "@/components/markdown-content";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Calendar, TrendingUp, Loader2, Send, Check, X, Search, RotateCcw, Trash2, RefreshCw, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { RunRecord, MonthlySummaryRecord, AvailableMonth, ConfigResponse } from "@/types";

const MONTH_NAMES = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export function SummariesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Syntheses</h1>
        <p className="text-muted-foreground">Historique des resumes IA quotidiens et mensuels</p>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Quotidien</TabsTrigger>
          <TabsTrigger value="monthly">Mensuel</TabsTrigger>
        </TabsList>
        <TabsContent value="daily">
          <DailyView />
        </TabsContent>
        <TabsContent value="monthly">
          <MonthlyView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DailyView() {
  const [page, setPage] = useState(0);
  const [filterMonth, setFilterMonth] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const limit = 10;

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build API URL with filters
  const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
  if (filterMonth) params.set("month", filterMonth);
  if (debouncedSearch) params.set("search", debouncedSearch);

  const { data, loading, refetch } = useApi<{ summaries: RunRecord[]; total: number }>(
    `/api/summaries?${params.toString()}`
  );
  const { data: available } = useApi<AvailableMonth[]>("/api/monthly-summaries/available");
  const { data: configData } = useApi<ConfigResponse>("/api/config");
  const discordConfigured = !!configData?.credentialInfo.discordWebhookMasked;

  const hasFilters = !!filterMonth || !!debouncedSearch;

  const handleResetFilters = () => {
    setFilterMonth("");
    setSearchInput("");
    setDebouncedSearch("");
    setPage(0);
  };

  // Build month options from available data
  const monthOptions = (available || []).map((m) => ({
    value: `${m.year}-${String(m.month).padStart(2, "0")}`,
    label: `${MONTH_NAMES[m.month - 1]} ${m.year} (${m.run_count})`,
  }));

  if (loading && !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les resumes..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterMonth} onValueChange={(v) => { setFilterMonth(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tous les mois" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reinitialiser
          </Button>
        )}
      </div>

      {!data || data.summaries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {hasFilters
              ? "Aucun resume ne correspond aux filtres."
              : "Aucun resume quotidien disponible."}
            {hasFilters && (
              <Button variant="ghost" size="sm" className="ml-2" onClick={handleResetFilters}>
                Reinitialiser les filtres
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {data.summaries.map((run) => (
              <SummaryCard key={run.id} run={run} discordConfigured={discordConfigured} onMutate={refetch} />
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
        </>
      )}
    </div>
  );
}

function SummaryCard({ run, discordConfigured, onMutate }: { run: RunRecord; discordConfigured: boolean; onMutate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [notifStatus, setNotifStatus] = useState(run.notification_status);
  const [deleting, setDeleting] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [rerunResult, setRerunResult] = useState<"success" | "error" | null>(null);

  const busy = sending || deleting || rerunning;

  const handleSendDiscord = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/runs/${run.id}/send-discord`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Resume envoye sur Discord");
        setNotifStatus("sent");
      } else {
        toast.error("Echec de l'envoi sur Discord");
      }
    } catch {
      toast.error("Erreur reseau lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/summaries/${run.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        onMutate();
      }
    } catch {
      // silently fail — card stays visible
    } finally {
      setDeleting(false);
    }
  };

  const handleRerun = async () => {
    setRerunning(true);
    setRerunResult(null);
    try {
      const res = await fetch(`/api/summaries/${run.id}/rerun`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRerunResult("success");
        onMutate();
      } else {
        setRerunResult("error");
      }
    } catch {
      setRerunResult("error");
    } finally {
      setRerunning(false);
      setTimeout(() => setRerunResult(null), 3000);
    }
  };

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm sm:text-base">{formatDate(run.started_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            {notifStatus === "sent" && (
              <Badge variant="success">Discord</Badge>
            )}
            {run.tweets_fetched > 0 ? (
              <Sheet>
                <SheetTrigger asChild>
                  <button className="cursor-pointer" aria-label="Voir les tweets">
                    <Badge variant="secondary" className="hover:bg-secondary/80 transition-colors">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {run.tweets_fetched} tweets
                    </Badge>
                  </button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>{run.tweets_fetched} tweets - Run #{run.id}</SheetTitle>
                    <SheetDescription>{formatDate(run.started_at)}</SheetDescription>
                  </SheetHeader>
                  <TweetListPanel runId={run.id} tweetCount={run.tweets_fetched} />
                </SheetContent>
              </Sheet>
            ) : (
              <Badge variant="secondary">{run.tweets_fetched} tweets</Badge>
            )}
            <Badge variant="outline">Run #{run.id}</Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={handleRerun}
              className="h-7 w-7 p-0"
              title="Regenerer le resume"
            >
              {rerunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : rerunResult === "success" ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : rerunResult === "error" ? (
                <X className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
            {discordConfigured && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={handleSendDiscord}
                    className="h-7 px-2 text-xs"
                    aria-label="Envoyer sur Discord"
                  >
                    {sending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Discord
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Envoyer ce resume sur Discord</TooltipContent>
              </Tooltip>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  title="Supprimer le resume"
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce resume ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irreversible. Le resume sera definitivement supprime
                    et les tweets associes seront liberes pour une eventuelle regeneration.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className={buttonVariants({ variant: "destructive" })}
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
    try {
      const res = await fetch("/api/monthly-summaries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: Number(selectedYear), month: Number(selectedMonth) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Resume mensuel genere avec succes");
        refetch();
      } else {
        toast.error(data.message || "Erreur lors de la generation");
      }
    } catch {
      toast.error("Erreur reseau");
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
