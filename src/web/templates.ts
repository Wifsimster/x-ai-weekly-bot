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
        </div>
        ${lastRun.summary ? `<article><header><strong>Résumé IA</strong></header><div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(lastRun.summary)}</div></article>` : ''}
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
      <td>${r.summary ? `<details><summary>Voir le résumé</summary><div style="white-space:pre-wrap;max-width:500px;font-size:0.8rem;line-height:1.4;padding:0.5rem">${escapeHtml(r.summary)}</div></details>` : '—'}</td>
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
            <th>Résumé</th>
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

export interface CredentialStatus {
  key: string;
  label: string;
  docUrl: string;
  configured: boolean;
}

export function setupLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="fr" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — X AI Weekly Bot</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <style>
    :root { --pico-font-size: 15px; }
    .setup-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .cred-list { list-style: none; padding: 0; }
    .cred-list li { padding: 0.6rem 0; border-bottom: 1px solid var(--pico-muted-border-color); display: flex; align-items: center; gap: 0.75rem; }
    .cred-list li:last-child { border-bottom: none; }
    .cred-status { width: 1.5rem; height: 1.5rem; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; flex-shrink: 0; }
    .cred-ok { background: #d4edda; color: #155724; }
    .cred-missing { background: #f8d7da; color: #721c24; }
    .cred-details { flex: 1; }
    .cred-details strong { display: block; }
    .cred-details code { font-size: 0.8rem; }
    pre.env-template { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.8rem; line-height: 1.5; }
    .progress-bar { display: flex; gap: 4px; margin-bottom: 1.5rem; }
    .progress-segment { height: 6px; flex: 1; border-radius: 3px; }
    .progress-ok { background: #28a745; }
    .progress-missing { background: #dc3545; }
  </style>
</head>
<body>
  <main class="container" style="max-width: 700px; margin-top: 3rem;">
    ${content}
  </main>
  <footer class="container" style="max-width: 700px;">
    <small>X AI Weekly Bot — Configuration initiale</small>
  </footer>
</body>
</html>`;
}

export function setupPage(credentials: CredentialStatus[]): string {
  const configuredCount = credentials.filter((c) => c.configured).length;
  const totalCount = credentials.length;

  const progressSegments = credentials
    .map((c) => `<div class="progress-segment ${c.configured ? 'progress-ok' : 'progress-missing'}"></div>`)
    .join('');

  const credRows = credentials
    .map(
      (c) => `<li>
        <span class="cred-status ${c.configured ? 'cred-ok' : 'cred-missing'}">${c.configured ? '&#10003;' : '&#10007;'}</span>
        <div class="cred-details">
          <strong>${escapeHtml(c.label)}</strong>
          <code>${escapeHtml(c.key)}</code>
        </div>
        <a href="${escapeHtml(c.docUrl)}" target="_blank" rel="noopener noreferrer">
          <small>Documentation</small>
        </a>
      </li>`
    )
    .join('');

  const envTemplate = credentials
    .filter((c) => !c.configured)
    .map((c) => `${c.key}=your-${c.key.toLowerCase().replace(/_/g, '-')}-here`)
    .join('\n');

  return `
    <div class="setup-icon">&#9881;</div>
    <hgroup>
      <h1>Configuration requise</h1>
      <p>Le bot a besoin de quelques variables d'environnement pour fonctionner. ${configuredCount} sur ${totalCount} sont configurées.</p>
    </hgroup>

    <div class="progress-bar">
      ${progressSegments}
    </div>

    <article>
      <header><strong>Variables d'environnement</strong></header>
      <ul class="cred-list">
        ${credRows}
      </ul>
    </article>

    ${
      envTemplate
        ? `<article>
      <header><strong>Template .env</strong></header>
      <p>Ajoutez les variables manquantes dans votre fichier <code>.env</code> ou dans votre <code>compose.yml</code> :</p>
      <pre class="env-template">${escapeHtml(envTemplate)}</pre>
    </article>`
        : ''
    }

    <article>
      <header><strong>Comment configurer ?</strong></header>
      <ol>
        <li>Copiez le fichier <code>.env.example</code> en <code>.env</code> et remplissez les valeurs manquantes</li>
        <li>Ou ajoutez les variables dans la section <code>environment:</code> de votre <code>compose.yml</code></li>
        <li>Redemarrez le conteneur : <code>docker compose down && docker compose up -d</code></li>
      </ol>
      <p><small>Les variables d'environnement sont lues au demarrage du conteneur. Un redemarrage est necessaire apres modification.</small></p>
    </article>

    ${
      configuredCount === totalCount
        ? '<a href="/" role="button">Acceder au dashboard</a>'
        : '<button disabled>En attente de configuration...</button>'
    }
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
