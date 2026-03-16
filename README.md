# X AI Weekly Bot

Bot qui scrape automatiquement votre timeline X chaque semaine, extrait les actualités liées à l'IA, génère un résumé via Claude et le publie sous forme de thread X.

## Prérequis

- Node.js >= 24
- Compte développeur X avec accès OAuth 1.0a (lecture + écriture)
- Clé API Anthropic

## Configuration

### 1. X Developer Portal

1. Créer une app sur [developer.x.com](https://developer.x.com/)
2. Activer les permissions **Read and Write**
3. Générer les tokens OAuth 1.0a (API Key, API Secret, Access Token, Access Token Secret)

### 2. Anthropic

1. Obtenir une clé API sur [console.anthropic.com](https://console.anthropic.com/)

### 3. GitHub Secrets

Ajouter les secrets suivants dans **Settings > Secrets and variables > Actions** :

| Secret | Description |
|--------|-------------|
| `X_API_KEY` | API Key X |
| `X_API_SECRET` | API Secret X |
| `X_ACCESS_TOKEN` | Access Token X |
| `X_ACCESS_TOKEN_SECRET` | Access Token Secret X |
| `X_USERNAME` | Nom d'utilisateur X (ex: `wifsimster`) |
| `ANTHROPIC_API_KEY` | Clé API Anthropic |

## Développement local

```bash
# Copier et remplir le fichier d'environnement
cp .env.example .env

# Installer les dépendances
npm install

# Build
npm run build

# Lancer en mode dry-run (ne poste pas sur X)
DRY_RUN=true npm run dev

# Lancer en production
npm run dev
```

## Fonctionnement

1. Récupère les tweets des 7 derniers jours (configurable via `TWEETS_LOOKBACK_DAYS`)
2. Envoie les tweets à Claude pour filtrer et résumer les actualités IA
3. Découpe le résumé en chunks de 280 caractères max
4. Publie le thread sur X (ou log en mode `DRY_RUN`)

## Exécution automatique

Le workflow GitHub Actions s'exécute chaque **dimanche à 18h00 UTC**. Vous pouvez aussi le déclencher manuellement via l'onglet **Actions > Weekly AI Summary > Run workflow**.

## Variables optionnelles

| Variable | Défaut | Description |
|----------|--------|-------------|
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Modèle Claude à utiliser |
| `TWEETS_LOOKBACK_DAYS` | `7` | Nombre de jours à scanner |
| `MAX_TWEETS` | `200` | Nombre max de tweets à analyser |
| `DRY_RUN` | `false` | Mode test (ne poste pas sur X) |
