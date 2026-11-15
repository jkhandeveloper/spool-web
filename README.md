# Spool Web

Web dashboard for **Spool**, *a place for your loose threads*. People sign in with their Spool account and see their own data in the browser: session summaries, journal, goals and check-ins, appointments, and meditations.

It's a client of the existing [spool-api](https://github.com/jkhandeveloper/spool-api) (`/api/v1`) and needs no API changes. The mobile app is [spool-mob](https://github.com/jkhandeveloper/spool-mob).

Built with Vite, React 19, TypeScript, TanStack Query and React Router.

## Quick start

```bash
npm install
cp .env.example .env.local     # optional: set VITE_API_URL
npm run dev                    # http://localhost:5173
```

The API must allow the dashboard's origin. Add it to `CORS_ORIGINS` in spool-api's `.env`, for example:

```
CORS_ORIGINS=http://localhost:8081,http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck (`tsc -b`) and production build to `dist/` |
| `npm run typecheck` | Typecheck only |
| `npm run lint` | oxlint |
| `npm run preview` | Serve the production build locally |

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://<page host>:3000/api/v1` | spool-api base URL including `/api/v1`. It's baked in at build time. |

For production, build with `VITE_API_URL=https://api.spool.zasstech.com/api/v1 npm run build`. Add the dashboard's origin to the API's `CORS_ORIGINS` secret too.

`dist/` is a static single-page app. The host must serve `index.html` for unknown paths (SPA fallback) so deep links like `/sessions/<id>` work. In nginx that's `try_files $uri /index.html;`.

## Deployment

Production is **https://web.spool.zasstech.com**, on the same droplet as the API (`68.183.89.22`). See spool-api's DEPLOY.md for SSH access (`spool` = root, `spool-deploy` = deploy user).

| What | Where |
|---|---|
| Files | `/opt/spool-web/releases/<timestamp>/`, with `/opt/spool-web/current` symlinked to the live one (owned by `deploy`) |
| nginx site | `/etc/nginx/sites-available/web.spool.zasstech.com` (source: [deploy/nginx/](deploy/nginx/web.spool.zasstech.com.conf)), static files with SPA fallback |
| DNS | Cloudflare `A web.spool → 68.183.89.22`, **DNS only (grey cloud)** like `api.spool` |
| TLS | Let's Encrypt via `certbot --nginx -d web.spool.zasstech.com --redirect` (auto-renews) |
| API CORS | `CORS_ORIGINS=https://web.spool.zasstech.com` in `/opt/spool-api/.env` |

### CI/CD

[.github/workflows/ci.yml](.github/workflows/ci.yml):

1. **On every push and pull request:** it runs lint, typecheck and the production build (against `https://api.spool.zasstech.com/api/v1`).
2. **On push to `main`** (or Actions → CI/CD → **Run workflow**):
   - It uploads `dist/` over SSH as `deploy` to `/opt/spool-web/releases/<run>-<sha>/`.
   - It switches `current` to the new release atomically and keeps the 5 newest releases.
   - It checks that https://web.spool.zasstech.com serves the new build.

It uses these repository secrets, the same values as spool-api's:

| Name | Value |
|---|---|
| `DEPLOY_HOST` | `68.183.89.22` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | Contents of `~/.ssh/spool_deploy` (the private key) |

Deploy by hand, without CI: run `./deploy/deploy.sh` from the repo root. It does the same steps from your machine.

To roll back: `ssh spool-deploy 'cd /opt/spool-web && ls -1t releases'`, then `ln -sfn releases/<older> current`.

## Pages

| Route | Shows | API |
|---|---|---|
| `/` | Overview: reminder, stats, active goals, next appointment, weekly journal chart, latest session | `GET today`, `sessions`, `journal?limit=100` |
| `/sessions`, `/sessions/:id` | Saved sessions (search and topic filter), pending sessions, full summary | `GET sessions`, `sessions/pending`, `sessions/:id` |
| `/journal`, `/journal/:id` | Paginated journal and full entries | `GET journal?limit&offset`, `journal/:id` |
| `/goals`, `/goals/:id` | Active and past goals, check-in history and completion rate | `GET goals`, `goals?all=true`, `goals/:id` |
| `/appointments`, `/appointments/:id` | Upcoming and past appointments (180 days each way) | `GET appointments?from&to`, `appointments/:id` |
| `/meditations`, `/meditations/:id` | Meditation library and timed script | `GET meditations` |
| `/insights` | The user's own analytics: streaks, active days, activity trend, when they journal, top session topics, goal follow-through | `GET me/insights?days&tz` |
| `/account` | Profile and settings, JSON data export, sign out | `GET me`, `me/export`, `POST auth/logout` |
| `/admin` | **Admin analytics** with a separate login (`ADMIN_USERNAME` / `ADMIN_PASSWORD` in spool-api's `.env`): KPIs with change vs the previous period, DAU/WAU/MAU, active users, activity and sign-up trends, activation funnel, weekly retention, weekday × hour heatmap, session/goal/appointment breakdowns | `POST admin/login`, `GET admin/analytics` |
| `/admin/users`, `/admin/users/:id` | Searchable, sortable user list with usage counts and last activity, plus each user's activity (counts and dates only, no content) | `GET admin/users`, `admin/users/:id` |

The dashboard is read-only for now. Creating and editing still happen in the mobile app, which also owns recording and consent.

## Auth and privacy

- The access token is kept **in memory only**. The refresh token is in `sessionStorage`, so it's cleared when the tab closes. With **Keep me signed in** it goes to `localStorage` instead.
- On a 401, the client refreshes once (concurrent requests share one refresh) and retries. If the refresh fails, it returns to sign-in and clears the query cache.
- **Sign out** clears only this browser. **Sign out everywhere** calls `POST auth/logout`, which revokes every refresh token, including the phone's.
- The API rate-limits `auth/*` to 10 requests per minute per IP. Every full page load uses one `auth/refresh`.
- The admin token is kept in `sessionStorage`, separate from user tokens, and expires after `ADMIN_TOKEN_TTL` (8h by default).
- Transcripts and audio never reach the dashboard. The API never returns them.

## Code layout

```
src/
  lib/          api.ts (typed client and token refresh), auth.tsx, token-store.ts, types.ts (shared with spool-mob), format.ts
  components/   AppShell (sidebar nav), ui.tsx (Card, Stat, Badge, Loading/Error/Empty states…), ActivityChart
  pages/        one file per area: Overview, Sessions, Journal, Goals, Appointments, Meditations, Account, Login
```

Imports use the `@/` alias for `src/`.
