import { getDb, type SettingRecord } from './db.js';

const EDITABLE_KEYS = ['CLAUDE_MODEL', 'TWEETS_LOOKBACK_DAYS', 'MAX_TWEETS', 'DRY_RUN', 'CRON_SCHEDULE'] as const;
const CREDENTIAL_KEYS = ['X_SESSION_AUTH_TOKEN', 'X_SESSION_CSRF_TOKEN'] as const;

export type EditableKey = (typeof EDITABLE_KEYS)[number];
export type CredentialKey = (typeof CREDENTIAL_KEYS)[number];
type SettableKey = EditableKey | CredentialKey;

export function isEditableKey(key: string): key is EditableKey {
  return (EDITABLE_KEYS as readonly string[]).includes(key);
}

export function isCredentialKey(key: string): key is CredentialKey {
  return (CREDENTIAL_KEYS as readonly string[]).includes(key);
}

export function isSettableKey(key: string): key is SettableKey {
  return isEditableKey(key) || isCredentialKey(key);
}

export function getSettings(): SettingRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM settings ORDER BY key').all() as SettingRecord[];
}

export function getSetting(key: string): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: SettableKey, value: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value);
}

export function deleteSetting(key: string): void {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

export function getSettingsMap(): Record<string, string> {
  const settings = getSettings();
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return map;
}

export function maskCredential(value: string): string {
  if (value.length <= 4) return '••••';
  return '•'.repeat(value.length - 4) + value.slice(-4);
}
