# TaskFlow

TaskFlow is a Next.js project management workspace with Supabase-backed auth/data, guarded login via ALTCHA, and in-app ML features for prioritization, assignment, wellness, and bottleneck analysis.

## Current App Surface

- Public landing page at `/landing` (root `/` serves the login page)
- Guided Supabase credential setup at `/setup`
- ALTCHA-gated auth at `/login`
- Authenticated home at `/dashboard`
- Team management at `/team`
- Workspace settings and local Env Vault at `/settings`
- Per-project workspace at `/projects/[id]`

Inside a project, the current UI includes:

- Kanban board
- Backlog
- Calendar
- Timeline
- Summary and reports
- Team chat and direct messages
- Time tracking
- Forms builder and responses
- Pages/documents
- Shortcuts
- Code/repository links
- Deployments
- Video room
- ML recommendations and bottleneck alerts

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI | React 19, TypeScript, Tailwind CSS |
| State/Contexts | Custom React contexts for auth, theme, and timers |
| Data/Auth | Supabase |
| CAPTCHA | ALTCHA |
| ML | In-app TypeScript engine plus HuggingFace Inference API with deterministic fallback |
| Charts | Recharts |
| Motion | Framer Motion |
| Drag and Drop | `@dnd-kit/*` |
| Icons | Lucide React |

## Main Features

### Authentication and Access

- Email/password sign-up and sign-in
- Google and GitHub OAuth
- ALTCHA verification required before auth actions
- Shared authenticated layout that routes signed-in users into the workspace
- Role-aware user and project management flows

### Project Operations

- Project creation and membership management
- Task CRUD with comments, priorities, assignees, tags, due dates, and status updates
- Kanban, backlog, calendar, and timeline views
- Notifications, activity feed, and per-user history
- Direct messages, project room chat, replies, reactions, and attachments
- Time entry and time-tracking summaries

### AI and ML

- Browser-side draft assistance through [`lib/ml-browser.ts`](./lib/ml-browser.ts)
- Server-side scoring and analytics through [`lib/ml-engine.ts`](./lib/ml-engine.ts)
- Transformer-based assignment analysis through [`lib/ml-transformers.ts`](./lib/ml-transformers.ts)
- Priority prediction
- Assignment recommendations
- Bottleneck detection
- Workload and wellness analysis
- Task clustering and recommendation endpoints

### Settings and Developer Workflow

- Workspace settings for profile, theme, AI preferences, notifications, and security
- Frontend-only local Env Vault in settings, encrypted with Web Crypto and stored in device local storage
- Guided `/setup` page for validating Supabase credentials before login
- API routes for projects, tasks, comments, forms, documents, notifications, meetings, GitHub data, ML, and admin checks

## Project Structure

```text
task-flow/
|- app/                    # App Router pages and route handlers
|  |- api/                 # Backend endpoints used by the app UI
|  |- dashboard/           # Authenticated dashboard
|  |- login/               # ALTCHA-gated authentication
|  |- projects/[id]/       # Per-project workspace
|  |- settings/            # Workspace settings and local Env Vault
|  |- setup/               # Supabase onboarding flow
|  `- team/                # Team management
|- components/             # UI views, layout, modals, forms, charts
|- contexts/               # Auth, theme, and timer providers
|- lib/                    # Supabase client, DB access, ML logic, utilities
|- public/                 # Static assets
|- types/                  # Shared TypeScript declarations
`- ML/                     # Legacy Python experiments and archived model assets
```

## Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ALTCHA_HMAC_SECRET=your_altcha_hmac_secret
ALTCHA_HMAC_KEY_SECRET=optional_altcha_key_secret
```

Optional variables may still be useful depending on the flows you use:

- `NEXT_PUBLIC_SITE_URL` for explicit site URL resolution in auth redirects
- `NEXT_PUBLIC_VERCEL_URL` when running on Vercel
- SMTP-related variables if you wire up email delivery for OTP/member notifications

## Bring Your Own Supabase (per-user)

TaskFlow is multi-tenant by design: every user connects **their own** Supabase
project from the browser. No central app database is required.

1. Open the app — you'll see the **Connect Supabase** screen.
2. Enter your **Project URL** and **anon key** (Settings → API in your Supabase
   dashboard).
3. On the very first connect, TaskFlow detects that the tables are missing and
   asks for a one-time **access token** (Dashboard → Account → Access Tokens →
   Generate new token). It uses the token to create the tables automatically
   (`users`, `projects`, `tasks`, and more via `/api/setup/schema`), then drops it.
4. You're signed in. Keys live only in your browser — they are never stored on
   our servers.

Once the tables exist, returning users only need their URL + anon key. Each
user's API calls are served by their own project (server routes honor the
per-request tenant keys before any global configuration).

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (or use the automatic table creation during connect)

### Install

```bash
pnpm install
```

### Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

First-run flow (per user):

1. Open the app and connect your Supabase URL + anon key.
2. On first connect, confirm the one-time access token step so the tables are created automatically.
3. Continue to `/login` and sign in.

For the deployer, environment variables are optional — they provide a default
project and service-role fallback but are not required for per-user BYOS.

## Database and Supabase Notes

- Runtime Supabase access lives in [`lib/supabase.ts`](./lib/supabase.ts).
- The database schema (tables and RPCs) is defined inline in the `/setup` schema endpoint and can be applied from the setup flow using a Supabase access token.
- Auth redirect URL resolution is handled through [`lib/site-url.ts`](./lib/site-url.ts).

## ML Runtime Notes

- The live app does not require a separate Python ML server.
- Current runtime ML paths are TypeScript-based and live under `lib/`.
- The `ML/` directory is legacy research/training material, not part of the current Next.js runtime.
- `next.config.ts` explicitly allows external server packages needed by the transformer/ONNX path.

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

## Known Repo Notes

- `pnpm lint` reports warnings for unused variables and effect dependencies, but no blocking errors.
- The settings Env Vault is frontend-only and stores encrypted values in local browser storage on the current device.
- Some helper/setup copy in the UI still assumes a local open-source/self-hosted style workflow around Supabase credentials.

## License

MIT
