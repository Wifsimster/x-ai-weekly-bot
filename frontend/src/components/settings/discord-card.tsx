import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { StatusDot, CardFlash, type Flash } from './shared';
import type { ConfigResponse } from '@/types';

interface DiscordCardProps {
  credentialInfo: ConfigResponse['credentialInfo'];
  onSaved: () => void;
}

export function DiscordCard({ credentialInfo, onSaved }: DiscordCardProps) {
  const [flash, setFlash] = useState<Flash>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFlash(null);
    const formData = new FormData(e.currentTarget);
    const url = (formData.get('DISCORD_WEBHOOK_URL') as string)?.trim();
    try {
      const res = await fetch('/api/discord-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ DISCORD_WEBHOOK_URL: url }),
      });
      const data = await res.json();
      setFlash({ type: data.success ? 'success' : 'error', message: data.message });
      if (data.success) {
        e.currentTarget.reset();
        onSaved();
      }
    } catch {
      setFlash({ type: 'error', message: 'Erreur lors de la sauvegarde du webhook.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setFlash(null);
    try {
      const res = await fetch('/api/test-discord', { method: 'POST' });
      const data = await res.json();
      setFlash({ type: data.success ? 'success' : 'error', message: data.message });
    } catch {
      setFlash({ type: 'error', message: 'Erreur lors du test.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Notifications Discord</div>
            <p className="text-sm text-muted-foreground">
              Recevez automatiquement les résumés quotidiens sur un salon Discord via webhook.
            </p>
          </div>
          <StatusDot configured={!!credentialInfo.discordWebhookMasked} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardFlash flash={flash} />

        <form onSubmit={handleSubmit} className="space-y-4">
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
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{credentialInfo.discordWebhookMasked}</code>
                </>
              ) : (
                'Non configuré'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Sauvegarder'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testing || !credentialInfo.discordWebhookMasked}
              onClick={handleTest}
            >
              {testing ? 'Envoi en cours...' : 'Tester le webhook'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
