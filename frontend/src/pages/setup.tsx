import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SetupResponse } from "@/types";

export function SetupPage() {
  const { data: setup, loading } = useApi<SetupResponse>("/api/setup");

  if (loading || !setup) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <Skeleton className="h-10 w-10 mx-auto rounded-full" />
          <Skeleton className="mt-2 h-8 w-64 mx-auto" />
          <Skeleton className="mt-2 h-4 w-96 mx-auto" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const { credentials, configured } = setup;
  const configuredCount = credentials.filter((c) => c.configured).length;
  const totalCount = credentials.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-2">&#9881;</div>
        <h1 className="text-2xl font-bold tracking-tight">Configuration requise</h1>
        <p className="text-muted-foreground">
          Le bot a besoin de quelques variables d'environnement pour fonctionner. {configuredCount} sur {totalCount} sont configurées.
        </p>
      </div>

      <div className="flex gap-1" role="progressbar" aria-valuenow={configuredCount} aria-valuemax={totalCount} aria-label="Progression de la configuration">
        {credentials.map((cred) => (
          <div
            key={cred.key}
            className={`h-1.5 flex-1 rounded-full ${cred.configured ? "bg-success" : "bg-destructive"}`}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold">Variables d'environnement</div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {credentials.map((cred) => (
              <li key={cred.key} className="flex items-start gap-3 py-3">
                <Badge variant={cred.configured ? "success" : "error"} className="mt-0.5 shrink-0">
                  {cred.configured ? "\u2713" : "\u2717"}
                </Badge>
                <div className="space-y-1 flex-1">
                  <p className="font-medium text-sm">{cred.label}</p>
                  <code className="text-xs text-muted-foreground">{cred.key}</code>
                  <p
                    className="text-xs text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: cred.howToFind }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {!configured && (
        <Card>
          <CardHeader>
            <div className="font-semibold">Template .env</div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Ajoutez les variables manquantes dans votre fichier <code className="font-mono text-xs">.env</code> ou dans votre{" "}
              <code className="font-mono text-xs">compose.yml</code> :
            </p>
            <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
              {credentials
                .filter((c) => !c.configured)
                .map((c) => `${c.key}=your-${c.key.toLowerCase().replace(/_/g, "-")}-here`)
                .join("\n")}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="font-semibold">Comment configurer ?</div>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              Copiez le fichier <code className="font-mono text-xs">.env.example</code> en{" "}
              <code className="font-mono text-xs">.env</code> et remplissez les valeurs manquantes
            </li>
            <li>
              Ou ajoutez les variables dans la section <code className="font-mono text-xs">environment:</code> de votre{" "}
              <code className="font-mono text-xs">compose.yml</code>
            </li>
            <li>
              Redémarrez le conteneur : <code className="font-mono text-xs">docker compose down && docker compose up -d</code>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            Les variables d'environnement sont lues au démarrage du conteneur. Un redémarrage est nécessaire après modification.
          </p>
        </CardContent>
      </Card>

      {configured ? (
        <a href="/" className="block">
          <Button className="w-full">Accéder au dashboard</Button>
        </a>
      ) : (
        <Button disabled className="w-full">
          En attente de configuration...
        </Button>
      )}
    </div>
  );
}
