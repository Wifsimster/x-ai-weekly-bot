export interface RunRecord {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "no_news" | "no_tweets" | "error";
  trigger_type: "cron" | "manual";
  tweets_fetched: number;
  tweets_posted: number;
  thread_ids: string | null;
  summary: string | null;
  error_message: string | null;
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

export interface ApiMessage {
  success: boolean;
  message: string;
}
