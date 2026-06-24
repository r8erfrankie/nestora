# Nestora

**A Modern Property Maintenance & Work Order Platform for Small-Medium Landlords**

Built by a landlord, for landlords. Simple, fast, mobile-first — so you can spend less time chasing contractors and more time growing your portfolio.

**Live Site:** [gonestora.app](https://gonestora.app)

---

## Vision

Nestora solves the real pain small landlords face: bloated, expensive enterprise tools that are overkill for 1–50 unit portfolios.

We focus on **one thing extremely well**: maintenance & work orders.

**Core Principles:**
- Radical Simplicity
- Contractor-First Mobile Experience (PWA — no App Store required)
- Speed to First Value (< 5 minutes to create your first work order)
- Trust & Reliability
- AI as Assistant, Not Magic

---

## Features

### Landlord
- **Properties** — Add, edit, and manage your portfolio with per-property join codes and QR codes for tenant onboarding
- **Work Orders** — Full lifecycle management (Open → In Progress → Completed) with priority, due dates, photos, and notes
- **Photo Uploads** — Before/after photos with lightbox viewer; photos carry over when converting maintenance requests to work orders
- **Contractors & Teams** — Directory, email invitations, work order assignment, and status tracking
- **Tenant Management** — Email-based invite flow (one email, no back-and-forth); pre-approved access with profile completion gate; pending request queue for tenant-initiated joins
- **Maintenance Requests → Work Orders** — Convert tenant-submitted requests to work orders in one click, with photos and metadata carried over
- **Dashboard & Overview** — Open work order counts, recent activity, per-property summaries
- **Reports & Analytics** — Work order trends, completion rates, contractor performance
- **Notes & Activity Log** — Communication history on every work order
- **Settings** — Profile, account management, and preferences

### Tenant
- **Maintenance Requests** — Submit and track requests from a dedicated mobile dashboard; no app download required
- **Simple Onboarding** — One invite email with a one-click magic link and 6-digit sign-in code; account setup in under two minutes

### Contractor
- **Work Order Queue** — View and manage assigned work orders from a mobile-optimized dashboard
- **Status Updates** — Update job status and add notes directly from the field
- **Invitation Flow** — Email invite with one-click accept; no account required before accepting

### Platform
- **Passwordless Auth** — Magic link + 6-digit OTP via email; no passwords to manage
- **PWA (Progressive Web App)** — Installable on iOS (Safari → Add to Home Screen) and Android (Chrome → Add to Home Screen); no App Store listing needed
- **Real-time Notifications** — In-app notification bell powered by Supabase Realtime; landlords get instant alerts on new maintenance requests and contractor status updates
- **Branded Transactional Emails** — All system emails (invites, work order assignments, status changes) use a consistent Nestora brand template via Resend
- **Role-Based Routing** — Server-side role enforcement; landlords, tenants, and contractors each land on their own dashboard after sign-in

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui + Lucide icons |
| Database & Auth | Supabase (PostgreSQL + Row-Level Security + Auth + Storage) |
| Realtime | Supabase Realtime (postgres_changes WebSocket subscriptions) |
| Email | Resend — all transactional email from `noreply@gonestora.app` |
| Deployment | Vercel |
| PWA | Native browser install (Web App Manifest + Service Worker) |

---

## Architecture

### App Router + Server Actions
All data mutations go through Next.js Server Actions — no client-side Supabase writes. This keeps RLS as the single source of truth and avoids leaking service-role credentials to the browser.

### Routing & Auth Guard (`proxy.ts`)
This project uses `proxy.ts` (not `middleware.ts`) for request interception. Every request goes through a role check: the proxy reads the `nestora_role` cookie and redirects unauthenticated or wrong-role requests before the page renders.

### Role System
Three roles: `landlord`, `tenant`, `contractor`. Stored in the `profiles` table. Set during onboarding. Enforced at:
- Server (proxy.ts role cookie + RLS policies)
- Database (RLS policies per-table per-role)

### Database (Supabase / PostgreSQL)
Key tables: `profiles`, `properties`, `work_orders`, `work_order_photos`, `maintenance_requests`, `maintenance_request_photos`, `maintenance_request_notes`, `tenant_property_links`, `contractor_invites`, `contractor_work_order_assignments`, `notifications`

Row-Level Security policies scope all reads and writes to the authenticated user's own data.

### Email Templates
Supabase auth emails (magic link, confirm signup, invite, email change) are customized HTML templates stored in `supabase/email-templates/`. Resend handles all product emails (work order notifications, invitations, approvals).

---

## Getting Started (Local Development)

```bash
git clone https://github.com/r8erfrankie/nestora.git
cd nestora

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in your Supabase project URL, anon key, service role key, and Resend API key

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `NEXT_PUBLIC_APP_URL` | Full URL of the app (e.g. `https://gonestora.app`) |
| `RESEND_API_KEY` | Resend API key for transactional email |

---

## Project Structure

```
app/
  (dashboard)/          # Authenticated routes (landlord, tenant, contractor dashboards)
    overview/           # Landlord home dashboard
    properties/         # Property management
    work-orders/        # Work order CRUD
    tenants/            # Tenant management + maintenance requests
    teams/              # Contractor directory + assignments
    reports/            # Analytics and reporting
    tenant/             # Tenant dashboard (submit/track requests)
    contractor/         # Contractor dashboard (view/update work orders)
    settings/           # Account settings
  auth/callback/        # Supabase PKCE auth callback
  landing/              # Public marketing page
  login/                # Passwordless sign-in (magic link + OTP)
  select-role/          # Role selection for new users
  landlord-onboarding/  # Landlord setup flow
  tenant-onboarding/    # Tenant setup + property join flow
  contractor-onboarding/# Contractor setup flow
  accept-invite/        # Contractor invite acceptance
  join/                 # Property join-code entry (deep link from QR)
components/             # Shared UI components (sidebar, notifications bell, etc.)
lib/
  supabase/             # Supabase client factories (server, browser, admin)
  email.ts              # Resend email functions (invites, access grants)
  notifications.ts      # insertNotification() helper
  phone.ts              # Phone number formatting
  utils.ts              # Shared utilities (timeAgo, etc.)
app/actions/            # Shared Server Actions (email, work orders)
proxy.ts                # Request-level auth guard + role routing
public/
  icons/                # PWA icons (192×192, 512×512)
  sw.js                 # Service worker (PWA install + push notifications)
supabase/
  email-templates/      # Custom HTML for Supabase auth emails
```

---

## Roadmap

- **Push Notifications** — VAPID-based Web Push via service worker; subscription storage in DB; landlords get push alerts for new maintenance requests
- **In-App Notification Center** — Full notification history drawer; `notifications` table and `insertNotification()` already in place
- **AI Work Order Suggestions** — Auto-categorize and prioritize maintenance requests based on description
- **Recurring Work Orders** — Scheduled maintenance (HVAC filter changes, fire alarm tests, etc.)
- **Contractor Mobile App** — Deeper PWA experience with offline support and camera integration for field photos
