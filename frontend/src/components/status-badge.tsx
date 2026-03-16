import { Badge, type BadgeVariant } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  running: { label: "En cours", variant: "warning" },
  success: { label: "Succes", variant: "success" },
  error: { label: "Erreur", variant: "error" },
  no_news: { label: "Pas d'actu IA", variant: "secondary" },
  no_tweets: { label: "Aucun tweet", variant: "secondary" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, variant: "outline" as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
