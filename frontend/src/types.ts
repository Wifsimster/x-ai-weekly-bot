export interface RunRecord {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'no_news' | 'no_tweets' | 'error' | 'deleted';
  trigger_type: 'cron' | 'manual';
  tweets_fetched: number;
  tweets_posted: number;
  thread_ids: string | null;
  summary: string | null;
  error_message: string | null;
  notification_status: 'pending' | 'sent' | 'failed' | 'skipped' | null;
}

export interface SettingRecord {
  key: string;
  value: string;
  updated_at: string;
}

export interface StatusResponse {
  running: boolean;
  configured: boolean;
  lastRun?: RunRecord;
  cronSchedule: string;
  totalRuns: number;
}

export interface ConfigResponse {
  envDefaults: Record<string, string>;
  credentialInfo: {
    authTokenMasked: string;
    csrfTokenMasked: string;
    discordWebhookMasked: string;
    hasAuth: boolean;
  };
}

export interface SetupResponse {
  configured: boolean;
  credentials: CredentialStatus[];
}

export interface CredentialStatus {
  key: string;
  label: string;
  docUrl: string;
  howToFind: string;
  configured: boolean;
}

export interface MonthlySummaryRecord {
  id: number;
  year: number;
  month: number;
  summary: string;
  source_run_ids: string;
  generated_at: string;
}

export interface AvailableMonth {
  year: number;
  month: number;
  run_count: number;
}

export interface ApiMessage {
  success: boolean;
  message: string;
}
