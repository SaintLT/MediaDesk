# MediaDesk

MediaDesk is a web-based IT service management (ITSM) application for All Saints Nairobi. Staff submit support requests, while administrators manage, assign, track and resolve tickets.

## Features

- Secure sign-in and organisation email-based registration
- Administrator and Normal User roles
- Department and ministry-aware ticket requests
- Ticket priorities and status workflow
- Ticket assignment and reassignment
- Ticket comments, attachments and activity history
- Dashboard, ticket queues and reports
- Team and account management
- CSV report export
- Personal settings and persistent dark/light themes
- Responsive desktop and mobile interface

## Technology

- React 18, TypeScript and Vite
- Tailwind CSS
- Supabase Auth, PostgreSQL, Row Level Security and Storage
- Supabase Edge Functions for account administration and public registration
- Vercel for deployment

## Repository structure

The application lives in `mediadesk/`.

```text
MediaDesk/
├── README.md
└── mediadesk/
    ├── src/
    │   ├── components/       Shared UI components
    │   ├── contexts/         Authentication and theme state
    │   ├── lib/              Supabase client and application services
    │   ├── pages/             Application screens
    │   └── types/             TypeScript models
    ├── supabase/
    │   ├── functions/         Supabase Edge Functions
    │   └── migrations/        SQL migration history
    ├── .env.example
    ├── package.json
    └── vercel.json
```

## Run locally

### Requirements

- Node.js 18 or newer
- npm
- A configured Supabase project

### 1. Clone and install

```bash
git clone https://github.com/SaintLT/MediaDesk.git
cd MediaDesk/mediadesk
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local`.

**Windows PowerShell**
```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux**
```bash
cp .env.example .env.local
```

Set the following frontend variables:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key |

Only public client credentials belong in the frontend. Never put a Supabase service-role key or other secret in a `VITE_*` variable, commit it to Git, or expose it in browser code.

### 3. Configure Supabase

MediaDesk relies on its PostgreSQL schema, Row Level Security policies, Storage bucket and Edge Functions. The SQL files in `mediadesk/supabase/migrations/` are the repository's migration history.

**Important:** The live application has evolved beyond parts of the original migration set. Before creating a fresh Supabase project or replaying migrations, verify that the database schema and policies match the current application code. Do not blindly apply the original migrations to an existing production database.

Deploy and configure the required Edge Functions from `mediadesk/supabase/functions/` using the Supabase CLI. Keep the service-role key in Supabase's server-side function secrets only. Public registration is restricted to the configured organisation email domain and creates Normal User accounts; administrator accounts must be provisioned by an existing administrator.

### 4. Start the application

```bash
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Available commands

Run from `mediadesk/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run typecheck` | Run the TypeScript type check |
| `npm run build` | Type-check and create the production build |
| `npm run preview` | Preview the production build locally |

Run `npm run build` before merging or deploying changes.

## Deployment

MediaDesk is configured for Vercel.

1. Import this GitHub repository into Vercel.
2. Set the project root directory to `mediadesk`.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Vercel environment variables.
6. Configure the Supabase Auth site URL and allowed redirect URLs for the production domain.
7. Deploy and verify sign-in, registration, ticket workflows and file access on the deployed site.

The `vercel.json` file provides SPA routing and response security headers.

## Security notes

- PostgreSQL Row Level Security is the enforcement layer for data access; frontend route guards only control navigation and visibility.
- Public registration must not grant administrator privileges.
- Privileged account operations run through server-side Supabase Edge Functions.
- Keep the Storage bucket private and enforce access using Storage policies.
- Never commit `.env.local`, service-role keys, passwords or production credentials.
- Back up the production database before schema changes or maintenance.

## Development guidelines

- Preserve the existing authentication, role and ticket workflow rules.
- Make database changes through reviewed, version-controlled migrations.
- Test affected user and administrator workflows.
- Run `npm run typecheck` and `npm run build` before merging.
