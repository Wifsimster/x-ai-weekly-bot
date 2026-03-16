import type { RunRecord } from '../db.js';
import type { SettingRecord } from '../db.js';

export function layout(title: string, content: string, currentPath: string): string {
  return `<!DOCTYPE html>
<html lang="fr" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — X AI Weekly Bot</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <style>
    :root { --pico-font-size: 15px; }
    nav { margin-bottom: 1rem; }
    .status-badge { display: inline-block; padding: 0.15em 0.5em; border-radius: 4px; font-size: 0.85em; font-weight: 600; }
    .status-success { background: #d4edda; color: #155724; }
    .status-error { background: #f8d7da; color: #721c24; }
    .status-running { background: #fff3cd; color: #856404; }
    .status-no_news, .status-no_tweets { background: #e2e3e5; color: #383d41; }
    .flash { padding: 0.75rem 1rem; border-radius: 4px; margin-bottom: 1rem; }
    .flash-success { background: #d4edda; color: #155724; }
    .flash-error { background: #f8d7da; color: #721c24; }
    pre.log { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 6px; overflow-x: auto; max-height: 400px; font-size: 0.8rem; }
    .grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stat-card { padding: 1rem; border-radius: 6px; background: var(--pico-card-background-color); border: 1px solid var(--pico-muted-border-color); }
    .stat-card h3 { margin: 0; font-size: 0.85rem; color: var(--pico-muted-color); }
    .stat-card .value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
  </style>
</head>
<body>
  <nav class="container">
    <ul>
      <li><strong>X AI Weekly Bot</strong></li>
    </ul>
    <ul>
      <li><a href="/"${currentPath === '/' ? ' aria-current="page"' : ''}>Dashboard</a></li>
      <li><a href="/runs"${currentPath === '/runs' ? ' aria-current="page"' : ''}>Historique</a></li>
      <li><a href="/settings"${currentPath === '/settings' ? ' aria-current="page"' : ''}>Paramètres</a></li>
    </ul>
  </nav>
  <main class="container">
    ${content}
  </main>
  <footer class="container">
    <small>X AI Weekly Bot — Back-office</small>
  </footer>
</body>
</html>`;
}

export function statusBadge(status: string): string {
  const labels: Record<string, string> = {
    running: 'En cours',
    success: 'Succès',
    error: 'Erreur',
    no_news: 'Pas d\'actu IA',
    no_tweets: 'Aucun tweet',
  };
  return `<span class="status-badge status-${status}">${labels[status] || status}</span>`;
}

export function dashboardPage(lastRun: RunRecord | undefined, cronSchedule: string, isRunning: boolean, totalRuns: number): string {
  const lastRunHtml = lastRun
    ? `<article>
        <header>Dernier run</header>
        <div class="grid-stats">
          <div class="stat-card">
            <h3>Statut</h3>
            <div class="value">${statusBadge(lastRun.status)}</div>
          </div>
          <div class="stat-card">
            <h3>Date</h3>
            <div class="value">${lastRun.started_at}</div>
          </div>
          <div class="stat-card">
            <h3>Tweets analysés</h3>
            <div class="value">${lastRun.tweets_fetched}</div>
          </div>
          <div class="stat-card">
            <h3>Tweets postés</h3>
            <div class="value">${lastRun.tweets_posted}</div>
          </div>
        </div>
        ${lastRun.summary ? `<details><summary>Résumé généré</summary><pre class="log">${escapeHtml(lastRun.summary)}</pre></details>` : ''}
        ${lastRun.error_message ? `<details open><summary>Erreur</summary><pre class="log">${escapeHtml(lastRun.error_message)}</pre></details>` : ''}
      </article>`
    : '<article><p>Aucun run enregistré.</p></article>';

  return `
    <hgroup>
      <h1>Dashboard</h1>
      <p>Supervision du bot X AI Weekly</p>
    </hgroup>

    <div class="grid-stats">
      <div class="stat-card">
        <h3>Total runs</h3>
        <div class="value">${totalRuns}</div>
      </div>
      <div class="stat-card">
        <h3>Planification</h3>
        <div class="value" style="font-size:1rem">${cronSchedule}</div>
      </div>
      <div class="stat-card">
        <h3>Statut actuel</h3>
        <div class="value">${isRunning ? statusBadge('running') : 'Inactif'}</div>
      </div>
    </div>

    ${lastRunHtml}

    <form hx-post="/api/trigger" hx-swap="innerHTML" hx-target="#trigger-result" hx-confirm="Lancer un run maintenant ?">
      <button type="submit" ${isRunning ? 'disabled aria-busy="true"' : ''}>
        ${isRunning ? 'Run en cours...' : 'Lancer un run maintenant'}
      </button>
    </form>
    <div id="trigger-result"></div>
  `;
}

export function runsPage(runs: RunRecord[]): string {
  const rows = runs
    .map(
      (r) => `<tr>
      <td>${r.id}</td>
      <td>${r.started_at}</td>
      <td>${r.finished_at || '—'}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${r.trigger_type}</td>
      <td>${r.tweets_fetched}</td>
      <td>${r.tweets_posted}</td>
      <td>${r.error_message ? `<small>${escapeHtml(r.error_message.slice(0, 80))}</small>` : '—'}</td>
    </tr>`
    )
    .join('');

  return `
    <hgroup>
      <h1>Historique des runs</h1>
      <p>Les 50 derniers runs du bot</p>
    </hgroup>
    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Statut</th>
            <th>Déclencheur</th>
            <th>Tweets analysés</th>
            <th>Tweets postés</th>
            <th>Erreur</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="8">Aucun run enregistré.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export function settingsPage(
  settings: SettingRecord[],
  envDefaults: Record<string, string>,
  flash?: { type: 'success' | 'error'; message: string }
): string {
  const settingsMap = new Map(settings.map((s) => [s.key, s]));

  const fields = [
    { key: 'CLAUDE_MODEL', label: 'Modèle Claude', type: 'text' },
    { key: 'TWEETS_LOOKBACK_DAYS', label: 'Jours à analyser', type: 'number' },
    { key: 'MAX_TWEETS', label: 'Max tweets', type: 'number' },
    { key: 'DRY_RUN', label: 'Mode test (dry run)', type: 'select', options: ['false', 'true'] },
    { key: 'CRON_SCHEDULE', label: 'Planification cron', type: 'text' },
  ];

  const rows = fields
    .map((f) => {
      const override = settingsMap.get(f.key);
      const envVal = envDefaults[f.key] || '';
      const currentVal = override?.value ?? envVal;
      const isOverridden = !!override;

      let input: string;
      if (f.type === 'select' && f.options) {
        const opts = f.options.map((o) => `<option value="${o}"${o === currentVal ? ' selected' : ''}>${o}</option>`).join('');
        input = `<select name="${f.key}">${opts}</select>`;
      } else {
        input = `<input type="${f.type}" name="${f.key}" value="${escapeHtml(currentVal)}" placeholder="${escapeHtml(envVal)}">`;
      }

      return `<tr>
        <td><strong>${f.label}</strong><br><small><code>${f.key}</code></small></td>
        <td>${input}</td>
        <td>${isOverridden ? `<mark>Personnalisé</mark><br><small>env: ${escapeHtml(envVal)}</small>` : '<small>Valeur env</small>'}</td>
      </tr>`;
    })
    .join('');

  const flashHtml = flash ? `<div class="flash flash-${flash.type}">${escapeHtml(flash.message)}</div>` : '';

  return `
    <hgroup>
      <h1>Paramètres</h1>
      <p>Configuration du bot — les valeurs personnalisées prennent le pas sur les variables d'environnement</p>
    </hgroup>

    ${flashHtml}

    <form method="POST" action="/settings">
      <table>
        <thead>
          <tr>
            <th>Paramètre</th>
            <th>Valeur</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <button type="submit">Enregistrer</button>
    </form>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
