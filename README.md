# X AI Weekly Bot

Bot qui scrape automatiquement votre timeline X chaque semaine, extrait les actualités liées à l'IA, génère un résumé via GitHub Models et le publie sous forme de thread X.

## Prérequis

- Node.js >= 24
- Docker & Docker Compose
- Compte développeur X avec accès OAuth 1.0a (lecture + écriture)
- GitHub Personal Access Token (scope `models:read`)

## Configuration

### 1. X Developer Portal

1. Créer une app sur [developer.x.com](https://developer.x.com/)
2. Activer les permissions **Read and Write**
3. Générer les tokens OAuth 1.0a (API Key, API Secret, Access Token, Access Token Secret)

### 2. GitHub Models

1. Créer un Personal Access Token sur [github.com/settings/tokens](https://github.com/settings/tokens) avec le scope `models:read`
2. Catalogue des modèles disponibles : [github.com/marketplace/models](https://github.com/marketplace/models)

### 3. GitHub Secrets

Ajouter les secrets suivants dans **Settings > Secrets and variables > Actions** :

| Secret | Description |
|--------|-------------|
| `X_API_KEY` | API Key X |
| `X_API_SECRET` | API Secret X |
| `X_ACCESS_TOKEN` | Access Token X |
| `X_ACCESS_TOKEN_SECRET` | Access Token Secret X |
| `X_USERNAME` | Nom d'utilisateur X (ex: `wifsimster`) |
| `GITHUB_TOKEN` | GitHub PAT avec scope `models:read` (aussi utilisé par GitHub Actions pour GHCR) |

## Développement local

```bash
# Copier et remplir le fichier d'environnement
cp .env.example .env

# Installer les dépendances
npm install

# Build
npm run build

# Lancer une seule fois en dry-run
DRY_RUN=true npm run dev:once

# Lancer le scheduler (cron chaque dimanche 18h UTC)
npm run dev
```

## Déploiement

### Architecture

```
GitHub push → CI (lint, build, Docker) → GHCR → Self-hosted runner → docker compose up
```

Le container tourne en continu avec `node-cron` qui déclenche le résumé hebdomadaire chaque **dimanche à 18h00 UTC**.

### Production (serveur)

```bash
# Sur le serveur, dans /opt/x-ai-weekly-bot/
cp .env.example .env  # Remplir les variables
docker compose pull
docker compose up -d
```

### CI/CD

Le workflow `release.yml` se déclenche sur chaque push sur `main` :
1. Détection du type de release (conventional commits)
2. Lint & type check
3. Build & push image Docker sur GitHub Container Registry (ghcr.io)
4. Déploiement automatique via self-hosted runner

Déclenchement manuel possible via **Actions > Release > Run workflow**.

## Fonctionnement

1. Récupère les tweets des 7 derniers jours (configurable via `TWEETS_LOOKBACK_DAYS`)
2. Envoie les tweets à GitHub Models pour filtrer et résumer les actualités IA
3. Découpe le résumé en chunks de 280 caractères max
4. Publie le thread sur X (ou log en mode `DRY_RUN`)

## Variables optionnelles

| Variable | Défaut | Description |
|----------|--------|-------------|
| `AI_MODEL` | `openai/gpt-4.1` | Modèle IA à utiliser ([catalogue](https://github.com/marketplace/models)) |
| `TWEETS_LOOKBACK_DAYS` | `7` | Nombre de jours à scanner |
| `MAX_TWEETS` | `200` | Nombre max de tweets à analyser |
| `DRY_RUN` | `false` | Mode test (ne poste pas sur X) |
