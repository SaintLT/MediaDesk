# MediaDesk

MediaDesk is a ticket management web app for a church media department. Staff and ministry leaders from other departments submit media requests and technical issues, and the media team triages, assigns, works and closes them, with a full activity history on every ticket.

**Status:** V1 complete and deployed. Built to be extended with more departments and features later.

## Features

- **Role-based access** with four roles: Administrator, Media Manager, Media Team Member and Requester. Access is enforced in the database with Supabase Row Level Security, not just in the interface.
- **Submit Ticket** form modelled on the Media Services Request Form: department and ministry, category, deliverable types (multi-select: poster, banner, flyer, roll-up banner, calendar, ID card), optional "requested on behalf of" name, optional event date, required date, suggested priority and file attachments.
- **Ticket numbers** in the format `MD-2026-0001`, generated safely by the database.
- **Ticket queue** sorted by priority, then earliest required date, then oldest submission.
- **Ticket detail page** with comments, activity history, attachments and manager controls (assign, change priority, change status).
- **Dashboard** that adapts to the signed-in role.
- **My Tickets** and **My Assignments** views.
- **Team** page where administrators change a member's role, department and active status (managers have a read-only view).
- **Reports** with a date range, summary cards, breakdowns, team workload and CSV export.
- **Settings** page.
- **Dark, responsive, accessible** interface.

## Roles

| Role | What they can do |
| --- | --- |
| Administrator | Full control: all tickets, team management, reports, settings |
| Media Manager | Review, assign, prioritise and manage all tickets; view team and reports |
| Media Team Member | See assigned tickets; update status (In Progress, On Hold, Completed) and add the resolution note |
| Requester | Submit tickets, follow their own tickets, comment, and cancel while the ticket is still Submitted or Under Review |

## Ticket model

- **Categories:** Equipment and technical issues; Photography and videography; Video and audio editing; Graphic design; Live streaming and event support; General media requests.
- **Priorities:** Critical, High, Normal, Low. The requester suggests a priority and a manager adjusts it.
- **Statuses:** Submitted, Under Review, Assigned, In Progress, On Hold, Completed, Cancelled. Completing a ticket requires a resolution note.

Ticket activity and assignment history are written by database triggers, so the app only updates the ticket row and inserts comments.

## Tech stack

- React + TypeScript (Vite)
- Tailwind CSS
- Supabase: Auth, PostgreSQL, Row Level Security and Storage
- Vercel for hosting, GitHub for version control

## Repository layout

The application lives in the `mediadesk/` folder. Run every `npm` command from inside it.

```
MediaDesk Software/        <- repository root (this README)
└── mediadesk/             <- the app
    ├── src/
    │   ├── components/    UI components (for example tickets/Badges.tsx)
    │   ├── contexts/      AuthContext (useAuth, useProfile)
    │   ├── lib/           data access (for example tickets.ts)
    │   ├── pages/         Dashboard, SubmitTicket, TicketList, TicketDetail, Team, Reports, Settings
    │   └── types/         db.ts (enums and label maps), ticket.ts
    ├── .env.example       template for environment variables
    ├── vercel.json        SPA rewrite and security headers
    └── package.json
```

The `@/` import alias points to `src/`.

## Getting started

### Prerequisites

- Node.js 18 or newer
- A Supabase project
- A GitHub account (and a Vercel account to deploy)

### 1. Clone and install

```bash
git clone https://github.com/SaintLT/MediaDesk.git
cd MediaDesk/mediadesk
npm install
```

### 2. Set up the database

In the Supabase **SQL Editor**, run the numbered migration files from the repository in order, `0001` through `0005`. They create the tables, enums, triggers, Row Level Security policies, the ticket attachments table and the ministry and deliverable fields.

Make sure the Supabase Storage bucket used for ticket attachments exists and is private, as set up by the migrations.

### 3. Configure environment variables

Copy the template and fill in your values:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon (public) key |

Never put the `service_role` key in this app or commit any `.env` file. `.env.local` is git-ignored.

### 4. Create the first administrator

Self sign-up is not part of V1, so the first account is created by hand:

1. In Supabase go to **Authentication → Users → Add user**, enter an email and password, and copy the new user's ID.
2. In the SQL Editor, create the matching profile row:

```sql
insert into profiles (id, full_name, email, department_id, role, is_active)
values (
  '<auth-user-id>',
  'Full Name',
  'admin@example.com',
  '<department-id>',
  'administrator',
  true
);
```

Use an existing department's ID from the `departments` table. After this the administrator can manage everyone else from the Team page.

### 5. Run locally

```bash
npm run dev
```

Open the address it prints (usually `http://localhost:5173`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check (`tsc --noEmit`) and create the production build in `dist/` |

Run `npm run build` before every push. It is the same check Vercel runs.

## Deployment (Vercel)

1. Push the repository to GitHub.
2. In Vercel choose **Add New → Project** and import the repository.
3. Set **Root Directory** to `mediadesk`. The framework preset is Vite, the build command is `npm run build` and the output directory is `dist`.
4. Under **Settings → Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (mark them as plain config, not secret).
5. Deploy. Vite builds the variables into the app, so **redeploy** after changing them.
6. In Supabase go to **Authentication → URL Configuration**. Set the **Site URL** to your Vercel address and add it to the **Redirect URLs**.

Every push to `main` deploys to production automatically. `vercel.json` rewrites all routes to `index.html` so that refreshing a page like `/tickets/<id>` works, and adds basic security headers.

## Security notes

- All data access is controlled by Row Level Security policies in Supabase.
- Only the anon key is used in the browser. It is safe to expose because RLS protects the data.
- No service-role key is used anywhere in the frontend.
- Accounts are never auto-created, and role changes are limited to administrators.

## Roadmap

- Self sign-up with administrator approval (role, department and deactivation controls)
- Additional departments and ministry lists
- Further reporting options

## Troubleshooting

- **"MediaDesk is not configured" on the live site:** the two `VITE_` variables are missing in Vercel, or the site was not redeployed after adding them.
- **Sign-in works locally but not on the live site:** check the Site URL and Redirect URLs in Supabase.
- **404 when refreshing a page:** confirm `vercel.json` is inside `mediadesk/` and Root Directory is set to `mediadesk`.
- **`npm run build` fails with TypeScript errors:** fix them locally first. Vercel runs the same command.# MediaDesk
