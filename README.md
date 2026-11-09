# MediaDesk

MediaDesk is a web-based IT service management (ITSM) application for submitting, assigning, tracking, and resolving support tickets. It provides separate experiences for normal users and administrators, with ticket activity history and role-based access.

## Features

- User authentication and role-based access.
- Submit support tickets and track their status.
- Personal ticket list and administrator ticket management.
- Ticket assignment and reassignment.
- Ticket priorities: Critical, High, Medium, and Low.
- Ticket statuses: Submitted, Under Review, Assigned, In Progress, On Hold, Completed, and Cancelled.
- Ticket comments, attachments, and activity history.
- Dashboard with ticket information and statistics.
- Team management and account status controls.
- Reports and CSV export.
- Personal settings and dark/light appearance options.
- Responsive interface for desktop and mobile screens.

## Technology

- React 18 and TypeScript
- Vite
- Tailwind CSS
- Supabase (Authentication, PostgreSQL, Row Level Security, and Storage)
- Vercel (deployment)
- GitHub (source control)

## Project structure

The application is in the `mediadesk/` directory.

```text
MediaDesk/
├── README.md
└── mediadesk/
    ├── src/
    │   ├── components/   Reusable interface components
    │   ├── contexts/     Authentication and application contexts
    │   ├── lib/          Supabase client and data-access logic
    │   ├── pages/        Application pages
    │   └── types/        TypeScript types and models
    ├── supabase/
    │   └── migrations/   Database migration scripts
    ├── .env.example      Required environment variable template
    ├── package.json
    └── vercel.json       Vercel routing and response headers
```

## Run locally

### Requirements

- Node.js 18 or newer
- npm
- A Supabase project

### 1. Clone the repository

```bash
git clone https://github.com/SaintLT/MediaDesk.git
cd MediaDesk/mediadesk
npm install
```

### 2. Configure environment variables

Create a local environment file from the example:

**macOS / Linux**
```bash
cp .env.example .env.local
```

**Windows PowerShell**
```powershell
Copy-Item .env.example .env.local
```

Add your Supabase project values to `.env.local`:

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key |

Use only the public client key in the frontend. Never expose or commit the Supabase `service_role` key or other private credentials.

### 3. Set up Supabase

Apply the SQL migration files in `supabase/migrations/` to your Supabase project in numerical order:

1. `0001_schema.sql`
2. `0002_functions.sql`
3. `0003_rls.sql`
4. `0004_storage_seed.sql`

These migrations define the database objects, database functions, access policies, attachment storage configuration, and starter data. Review the SQL and back up any existing production database before applying migrations to it.

### 4. Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Available scripts

Run these commands from the `mediadesk/` directory.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run typecheck` | Run the TypeScript type check |
| `npm run build` | Type-check the project and create the production build |
| `npm run preview` | Preview the production build locally |

Run `npm run build` before submitting changes.

## Deployment

MediaDesk is configured for Vercel.

1. Import the GitHub repository into Vercel.
2. Set the project **Root Directory** to `mediadesk`.
3. Use `npm run build` as the build command.
4. Set the output directory to `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under the Vercel project's environment variables.
6. Configure the Supabase Authentication site URL and redirect URLs for the deployed application.
7. Deploy the project.

The `vercel.json` configuration provides SPA route rewriting and basic security response headers. Redeploy after changing Vite environment variables.

## Security

- Access to application data is protected by Supabase Row Level Security (RLS).
- The frontend uses the Supabase public client key; privileged service-role credentials must remain server-side and must never be committed.
- User access and administrative actions should be enforced by backend policies, not only by hiding interface controls.
- Ticket attachments are stored in a private Supabase Storage bucket with access governed by policies.

## Development

When contributing changes:

- Keep reusable UI and data-access logic in their existing shared folders.
- Preserve existing authentication, authorization, and ticket workflows.
- Do not commit `.env.local`, secrets, or production credentials.
- Test affected workflows and run `npm run build` before merging changes.
