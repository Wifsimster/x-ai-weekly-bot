import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { CardFlash, type Flash } from './shared';
import { humanizeCron } from '@/lib/utils';

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

const CRON_PRESETS = [
  { label: 'Tous les jours a 07h30', value: '30 7 * * *' },
  { label: 'Tous les jours a 08h00', value: '0 8 * * *' },
  { label: 'Tous les jours a 09h00', value: '0 9 * * *' },
  { label: 'Tous les jours a 12h00', value: '0 12 * * *' },
  { label: 'Tous les jours a 18h00', value: '0 18 * * *' },
  { label: 'Du lundi au vendredi a 08h00', value: '0 8 * * 1-5' },
  { label: 'Chaque lundi a 09h00', value: '0 9 * * 1' },
  { label: 'Toutes les 6 heures', value: '0 */6 * * *' },
  { label: 'Toutes les 12 heures', value: '0 */12 * * *' },
];

interface BotBehaviorCardProps {
  envDefaults: Record<string, string>;
  onSaved: () => void;
}

export function BotBehaviorCard({ envDefaults, onSaved }: BotBehaviorCardProps) {
  const [flash, setFlash] = useState<Flash>(null);
  const [flashCron, setFlashCron] = useState<Flash>(null);
  const [saving, setSaving] = useState(false);
  const [savingCron, setSavingCron] = useState(false);
  const [showCustomCron, setShowCustomCron] = useState(false);
  const [customCron, setCustomCron] = useState('');
  const selectValuesRef = useRef<Record<string, string>>({});

  const cronSchedule = envDefaults['CRON_SCHEDULE'] || '30 7 * * *';
  const isPreset = CRON_PRESETS.some((p) => p.value === cronSchedule);

  const handleSettingsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFlash(null);
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
      setFlash({ type: data.success ? 'success' : 'error', message: data.message });
      if (data.success) onSaved();
    } catch {
      setFlash({ type: 'error', message: 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCronChange = async (schedule: string) => {
    setSavingCron(true);
    setFlashCron(null);
    try {
      const res = await fetch('/api/cron-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule }),
      });
      const data = await res.json();
      setFlashCron({ type: data.success ? 'success' : 'error', message: data.message });
      if (data.success) {
        setShowCustomCron(false);
        onSaved();
      }
    } catch {
      setFlashCron({ type: 'error', message: 'Erreur lors de la mise a jour.' });
    } finally {
      setSavingCron(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="font-semibold">Comportement du bot</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardFlash flash={flash} />

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

          <Button type="submit" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </form>

        {/* Cron schedule with presets + hot-reload */}
        <div className="border-t pt-4 space-y-3">
          <CardFlash flash={flashCron} />

          <div className="grid gap-2 sm:grid-cols-[200px_1fr] items-start">
            <div>
              <Label>Planification</Label>
              <p className="text-xs text-muted-foreground font-mono">CRON_SCHEDULE</p>
            </div>
            <div className="space-y-2">
              <Select
                value={isPreset ? cronSchedule : '__custom__'}
                onValueChange={(v) => {
                  if (v === '__custom__') {
                    setShowCustomCron(true);
                    setCustomCron(cronSchedule);
                  } else {
                    setShowCustomCron(false);
                    handleCronChange(v);
                  }
                }}
                disabled={savingCron}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">Personnalise...</SelectItem>
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                Actuel : <code className="font-mono">{humanizeCron(cronSchedule)}</code>{' '}
                <span className="text-muted-foreground/60">({cronSchedule})</span>
              </p>

              {showCustomCron && (
                <div className="flex items-center gap-2">
                  <Input
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="ex: 30 7 * * *"
                    className="font-mono"
                  />
                  <Button
                    size="sm"
                    disabled={savingCron || !customCron.trim()}
                    onClick={() => handleCronChange(customCron.trim())}
                  >
                    {savingCron ? '...' : 'Appliquer'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
