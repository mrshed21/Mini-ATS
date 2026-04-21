# 📘 Mini-ATS — Complete Technical Documentation (Project Blueprint)

**Version:** 0.1.0  
**Date:** 2026-04-18  
**Status:** MVP / Pre-Production  
**Author:** System Architecture Analysis  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Full Folder Structure](#2-full-folder-structure)
3. [Backend Architecture](#3-backend-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Database Structure](#5-database-structure)
6. [API Documentation](#6-api-documentation)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Business Logic Explanation](#8-business-logic-explanation)
9. [Error Handling System](#9-error-handling-system)
10. [External Dependencies](#10-external-dependencies)
11. [Weak Points / Technical Debt](#11-weak-points--technical-debt)
12. [AI Integration Readiness](#12-ai-integration-readiness)
13. [Improvement Roadmap](#13-improvement-roadmap)

---

## 1. Project Overview

### What This System Does

Mini-ATS is an **Applicant Tracking System (ATS)** — a SaaS platform that enables recruitment teams to manage their hiring pipeline. It allows users to create job postings, track candidates through a multi-stage workflow, and manage the end-to-end recruitment process.

### Main Purpose

- Provide a lightweight, modern ATS for small-to-medium recruitment teams
- Enable admins to manage multiple companies and their users
- Allow customers (recruiters) to manage jobs and candidates via a Kanban-style pipeline
- Offer a visually appealing, dark-mode-first UI inspired by tools like Linear and Vercel

### Key Features

| Feature | Description |
|---|---|
| **Role-Based Access Control** | Two roles: `admin` (platform-wide access) and `customer` (company-scoped access) |
| **Admin Dashboard** | System overview with aggregate metrics across all companies |
| **Company Management** | CRUD operations for companies with associated users, jobs, and candidates |
| **Customer Dashboard** | Job-centric workspace for managing recruitment campaigns |
| **Job Postings** | Create, edit, delete jobs with fields: title, description, location, type, salary, status |
| **Candidate Pipeline** | 5-stage Kanban board with drag-and-drop: Applied → Screening → Interview → Offered → Rejected |
| **Candidate Notes** | Per-candidate notes system for interview feedback and internal comments |
| **Admin Impersonation** | Admins can impersonate a customer user to view their workspace |
| **Authentication** | Supabase Auth with email/password, session-based cookies |

### Architecture Summary

This is a **monolithic Next.js application** using the **App Router** pattern. There is no separate backend server — all data operations go directly from the Next.js client/server components to **Supabase** (PostgreSQL + Auth) via the Supabase JS SDK. The application uses:

- **Server Components** for authenticated layouts and initial data loading
- **Client Components** for interactive pages with state management
- **Next.js Middleware** for route protection and auth-based redirects
- **Supabase Row Level Security (RLS)** for database-level access control

---

## 2. Full Folder Structure

```
mini-ats/
├── .dockerignore                    # Docker build exclusions
├── .gitignore                       # Git exclusions (node_modules, .env, .next)
├── components.json                  # shadcn/ui configuration
├── docker-compose.yml               # Docker Compose for deployment (port 3070→3000)
├── Dockerfile                       # Multi-stage Docker build (Node 20 Alpine)
├── eslint.config.mjs                # ESLint config (Next.js core-web-vitals + TypeScript)
├── next.config.ts                   # Next.js config (standalone output, errors ignored)
├── package.json                     # Dependencies and scripts
├── package-lock.json                # Locked dependency versions
├── postcss.config.mjs               # PostCSS with Tailwind plugin
├── README.md                        # User-facing documentation
├── tsconfig.json                    # TypeScript configuration
│
├── public/                          # Static assets served as-is
│   ├── web-app-manifest-192x192.png # PWA icon (192px)
│   └── web-app-manifest-512x512.png # PWA icon (512px)
│
└── src/                             # Application source code
    ├── middleware.ts                 # Next.js middleware — auth checks, route protection, redirects
    │
    ├── app/                         # Next.js App Router pages and layouts
    │   ├── globals.css              # Global CSS (Tailwind v4 + shadcn theme variables)
    │   ├── layout.tsx               # Root layout — fonts, ImpersonationProvider, AuthGuard
    │   ├── page.tsx                 # Landing page — marketing/hero page (public)
    │   ├── manifest.json            # PWA manifest
    │   ├── apple-icon.png           # Apple touch icon
    │   ├── favicon.ico              # Favicon
    │   ├── icon0.svg                # Icon asset
    │   ├── icon1.png                # Icon asset
    │   │
    │   ├── login/                   # Authentication page
    │   │   └── page.tsx             # Email/password login form (client component)
    │   │
    │   ├── admin/                   # Admin role routes
    │   │   ├── layout.tsx           # Admin layout — auth check + sidebar
    │   │   ├── page.tsx             # Admin dashboard — system-wide stats (server component)
    │   │   ├── customers/           # Company & user management
    │   │   │   └── page.tsx         # CRUD for companies and users (client component)
    │   │   └── companies/
    │   │       └── [id]/
    │   │           └── page.tsx     # Company detail — users, jobs, candidates, impersonation
    │   │
    │   ├── dashboard/               # Customer role routes
    │   │   ├── layout.tsx           # Dashboard layout — auth check + sidebar + impersonation banner
    │   │   ├── page.tsx             # Customer dashboard — stats, recent jobs, quick actions
    │   │   ├── candidates/
    │   │   │   └── page.tsx         # All candidates list — search, filter, CRUD
    │   │   └── jobs/
    │   │       ├── page.tsx         # Job postings list — create, delete, navigate
    │   │       └── [id]/
    │   │           └── page.tsx     # Job detail — edit job, manage candidates list
    │   │
    │   └── jobs/                    # Kanban board routes (shared)
    │       ├── layout.tsx           # Minimal layout — auth check only (no sidebar)
    │       └── [id]/
    │           └── page.tsx         # Kanban board — drag-and-drop pipeline with notes
    │
    ├── components/                  # Reusable React components
    │   ├── auth-guard.tsx           # Client-side route protection based on roles
    │   ├── candidate-modal.tsx      # Dialog for creating/editing candidates
    │   ├── impersonation-banner.tsx # Floating banner shown during admin impersonation
    │   ├── sidebar.tsx              # Navigation sidebar — role-aware links, user info, logout
    │   └── ui/                      # shadcn/ui primitives
    │       ├── button.tsx           # Button with variants (default, outline, ghost, destructive, etc.)
    │       ├── card.tsx             # Card, CardHeader, CardTitle, CardDescription, CardContent, etc.
    │       ├── dialog.tsx           # Dialog/Modal primitives (Radix-based)
    │       ├── input.tsx            # Styled input field
    │       ├── label.tsx            # Form label
    │       └── select.tsx           # Select dropdown (Radix-based)
    │
    └── lib/                         # Utilities, types, and configurations
        ├── types.ts                 # TypeScript interfaces for all entities + Database type map
        ├── utils.ts                 # cn() utility (clsx + tailwind-merge)
        ├── contexts/
        │   └── impersonation-context.tsx  # React Context for admin impersonation state
        └── supabase/
            ├── client.ts           # Browser-side Supabase client (createBrowserClient)
            └── server.ts           # Server-side Supabase client (createServerClient with cookies)
```

### Folder Purpose Summary

| Folder | Purpose |
|---|---|
| `src/app/` | Next.js App Router — all pages, layouts, and loading states |
| `src/app/admin/` | Admin-only pages (dashboard, company/user management) |
| `src/app/dashboard/` | Customer-only pages (jobs, candidates, overview) |
| `src/app/jobs/` | Kanban board pages (accessible by both roles when authorized) |
| `src/app/login/` | Authentication page |
| `src/components/` | Shared React components used across pages |
| `src/components/ui/` | shadcn/ui library components (auto-generated, not manually edited) |
| `src/lib/` | Core utilities, TypeScript types, Supabase clients, React contexts |
| `src/lib/contexts/` | React Context providers (impersonation state) |
| `src/lib/supabase/` | Supabase client factory functions for browser and server |
| `public/` | Static assets (PWA icons, favicon) |

---

## 3. Backend Architecture

### 3.1 Server Setup

Mini-ATS does **NOT** have a traditional backend (Express, NestJS, etc.). Instead, it uses **Next.js as a full-stack framework** with Supabase as the Backend-as-a-Service (BaaS).

**How it works:**

```
┌──────────────────────────────────────────────────────────────┐
│                     Next.js Application                       │
│                                                               │
│  ┌─────────────────┐     ┌──────────────────────────────────┐ │
│  │ Server Components│────▶│ Supabase Server Client           │ │
│  │ (layouts, pages) │     │ (createServerClient with cookies)│ │
│  └─────────────────┘     └──────────────┬───────────────────┘ │
│                                          │                    │
│  ┌─────────────────┐     ┌──────────────▼───────────────────┐ │
│  │ Client Components│────▶│ Supabase Browser Client          │ │
│  │ (interactive)    │     │ (createBrowserClient)            │ │
│  └─────────────────┘     └──────────────┬───────────────────┘ │
│                                          │                    │
│  ┌─────────────────┐                     │                    │
│  │ Middleware       │─────────────────────┤                    │
│  │ (auth checks)    │                     │                    │
│  └─────────────────┘                     │                    │
└──────────────────────────────────────────┼────────────────────┘
                                           │
                    ┌──────────────────────▼──────────────────────┐
                    │            Supabase (Cloud)                  │
                    │  ┌──────────────┐  ┌──────────────────────┐ │
                    │  │ Auth Service │  │ PostgreSQL Database   │ │
                    │  │ (JWT-based)  │  │ (with RLS policies)  │ │
                    │  └──────────────┘  └──────────────────────┘ │
                    └─────────────────────────────────────────────┘
```

### 3.2 Controllers / Services / Routes

There are **no traditional controllers, services, or route handlers**. Business logic is embedded directly within React components. Each page component contains:

- **Data fetching** — Direct Supabase queries (e.g., `supabase.from('jobs').select(...)`)
- **Business logic** — Inline functions within the component (e.g., `handleCreateJob`, `handleDeleteCandidate`)
- **Data mutation** — Direct Supabase inserts/updates/deletes

This is a **fat-client architecture** where the Supabase JS SDK communicates directly with Supabase from both server and client components.

### 3.3 Middleware

**File:** `src/middleware.ts`

The middleware runs on every request (except `_next/static`, `_next/image`, `favicon.ico`) and performs:

1. **Creates a Supabase server client** using request cookies
2. **Checks authentication** via `supabase.auth.getUser()`
3. **Protected route check** — Redirects unauthenticated users to `/login` for `/admin/*`, `/dashboard/*`, `/jobs/*`
4. **Authenticated redirect** — Redirects logged-in users away from `/` or `/login` to their role-based dashboard
5. **Role resolution** — Fetches profile role from `profiles` table, falls back to `user.user_metadata.role`

```typescript
// Middleware flow:
Request → Create Supabase Client → Check Auth → 
  If protected + no user → /login
  If logged in + / or /login → redirect by role (admin→/admin, customer→/dashboard)
  Otherwise → Next
```

### 3.4 Supabase Client Factories

**Browser Client** (`src/lib/supabase/client.ts`):
- Uses `createBrowserClient` from `@supabase/ssr`
- Auto-handles session persistence in browser cookies
- Used by all `'use client'` components

**Server Client** (`src/lib/supabase/server.ts`):
- Uses `createServerClient` from `@supabase/ssr`
- Reads cookies from `next/headers` cookie store
- Silently catches cookie-set errors (middleware handles session refresh)
- Used by Server Components and layouts

### 3.5 Authentication Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐     ┌───────────┐
│  User     │────▶│  Login Page  │────▶│  Supabase Auth   │────▶│  Profile  │
│  (Browser)│     │  /login      │     │  signInWithPass  │     │  Table    │
└──────────┘     └──────────────┘     └──────────────────┘     └───────────┘
                        │                      │                       │
                        │                      ▼                       │
                        │              Check user_metadata.role       │
                        │                      │                       │
                        │            ┌─────────▼────────┐             │
                        │            │ role === 'admin'? │             │
                        │            └───┬──────────┬───┘             │
                        │                │          │                  │
                        │         Yes    │          │  No              │
                        │                ▼          ▼                  │
                        │          /admin     /dashboard              │
                        │                                              │
                        └──────── Also stored in middleware cookies ──┘
```

---

## 4. Frontend Architecture

### 4.1 Pages

| Route | Component Type | Role | Purpose |
|---|---|---|---|
| `/` | Server Component | Public | Landing/marketing page with hero section, features, and CTA |
| `/login` | Client Component | Public | Email/password login form with role-based redirect |
| `/admin` | Server Component | Admin | Dashboard with system-wide stats (customers, admins, jobs, candidates counts) |
| `/admin/customers` | Client Component | Admin | Company & user management with tabbed view (Companies/Members) |
| `/admin/companies/[id]` | Client Component | Admin | Company detail — view/edit company, manage users, view jobs & candidates, impersonate |
| `/dashboard` | Client Component | Customer | Customer workspace — job count, candidate count, recent jobs, quick actions |
| `/dashboard/jobs` | Client Component | Customer | Job postings list — create, view, delete jobs |
| `/dashboard/jobs/[id]` | Client Component | Customer | Job detail — view/edit job info, candidate list with stats |
| `/dashboard/candidates` | Client Component | Customer | All candidates across jobs — search, filter by job, add/edit/delete |
| `/jobs/[id]` | Client Component | Authenticated | Kanban board — drag-and-drop pipeline with candidate notes |

### 4.2 Components

| Component | Type | Purpose |
|---|---|---|
| `AuthGuard` | Client | Wraps entire app; checks auth + role on every navigation; redirects unauthorized |
| `Sidebar` | Client | Left-side navigation; role-aware links; user profile card; logout button |
| `CandidateModal` | Client | Dialog for creating/editing candidates with job assignment and status |
| `ImpersonationBanner` | Client | Floating bottom banner shown when admin impersonates a customer |
| `Button` | UI (shadcn) | Button with variants: default, outline, secondary, ghost, destructive, link |
| `Card` | UI (shadcn) | Card container with Header, Title, Description, Content, Footer, Action |
| `Dialog` | UI (shadcn) | Modal dialog built on Radix UI Dialog primitive |
| `Input` | UI (shadcn) | Styled input field |
| `Label` | UI (shadcn) | Form label |
| `Select` | UI (shadcn) | Select dropdown built on Radix UI Select primitive |

### 4.3 State Management

There is **no global state management library** (no Redux, Zustand, Jotai, etc.). State is managed through:

1. **React Context** — `ImpersonationContext` for impersonation state (persisted in localStorage)
2. **Local Component State** — `useState` for form fields, loading states, data arrays
3. **Supabase Realtime** — Not implemented yet; data is fetched on mount via `useEffect`
4. **URL State** — Route params (`/jobs/[id]`, `/admin/companies/[id]`) for entity context

### 4.4 API Communication

All data operations use the **Supabase JS SDK** directly. There are no REST API routes or tRPC endpoints.

**Pattern for data fetching (Client Components):**
```typescript
const supabase = createClient()  // browser client
const { data } = await supabase.from('jobs').select('*').eq('customer_id', userId)
```

**Pattern for data fetching (Server Components):**
```typescript
const supabase = await createClient()  // server client
const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
```

**Pattern for data mutation:**
```typescript
const { error } = await supabase.from('candidates').insert([{ full_name, email, job_id, ... }])
```

### 4.5 UI Flow

```
Public User → / (Landing) → /login (Sign In)
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              Admin Role               Customer Role
                    │                       │
                    ▼                       ▼
              /admin (Dashboard)      /dashboard (Workspace)
                    │                       │
          ┌─────────┼─────────┐     ┌───────┼───────┐
          ▼         ▼         ▼     ▼       ▼       ▼
     /admin    /admin/    /admin/  /dash/  /dash/  /dash/
     (stats)   customers  companies jobs    jobs/   candidates
                          /[id]           [id]
                                           │
                                           ▼
                                      /jobs/[id]
                                      (Kanban Board)
```

### 4.6 Theme & Styling

- **Dark mode by default** — `<html>` has class `dark`
- **Tailwind CSS v4** with CSS-first configuration
- **oklch color space** for theme variables
- **shadcn/ui "radix-nova" style** for component library
- **Geist font family** (sans + mono)
- **CSS variables** for all design tokens (colors, radii)
- **No `tailwind.config.ts`** — Tailwind v4 uses CSS-first config in `globals.css`

---

## 5. Database Structure

### 5.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   companies  │       │     profiles     │       │       jobs       │
├──────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (UUID) PK │◀─┐    │ id (UUID) PK/FK  │──────▶│ id (UUID) PK     │
│ name         │  │    │ email            │       │ title            │
│ website_url  │  └────│ company_id (FK)  │       │ description      │
│ industry     │       │ full_name        │       │ location         │
│ location     │       │ phone            │       │ job_type         │
│ description  │       │ avatar_url       │       │ salary_range     │
│ company_size │       │ role             │       │ status           │
└──────────────┘       │ updated_at       │       │ customer_id (FK) │
                       └──────────────────┘       │ created_at       │
                              │                   │ updated_at       │
                              │                   └───────┬──────────┘
                              │                           │
                              │                           ▼
                              │              ┌──────────────────────┐
                              │              │     candidates       │
                              │              ├──────────────────────┤
                              │              │ id (UUID) PK         │
                              │              │ full_name            │
                              │              │ email                │
                              │              │ phone                │
                              │              │ summary              │
                              │              │ status               │
                              │              │ stage_order          │
                              │              │ ai_score             │
                              │              │ ai_evaluation_notes  │
                              │              │ resume_url           │
                              │              │ job_id (FK) ─────────┤──▶ jobs.id (CASCADE)
                              │              │ created_at           │
                              │              │ updated_at           │
                              │              └──────────┬───────────┘
                              │                         │
                              │                         ▼
                              │              ┌──────────────────────┐
                              │              │       notes          │
                              │              ├──────────────────────┤
                              │              │ id (UUID) PK         │
                              │              │ candidate_id (FK) ───┤──▶ candidates.id
                              │              │ content              │
                              │              │ created_at           │
                              │              └──────────────────────┘
                              │
                              └─── profiles.id = auth.users.id (Supabase Auth)
```

### 5.2 Table Definitions

#### `companies`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK (auto-generated) | Unique company identifier |
| `name` | TEXT | NOT NULL | Company name |
| `website_url` | TEXT | Nullable | Company website URL |
| `industry` | TEXT | Nullable | Industry sector |
| `location` | TEXT | Nullable | Geographic location |
| `description` | TEXT | Nullable | Company description |
| `company_size` | TEXT | Nullable | Size range: "1-10", "11-50", "51-200", "200+" |

#### `profiles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, FK → auth.users(id) | Same as Supabase Auth user ID |
| `email` | TEXT | NOT NULL | User email address |
| `full_name` | TEXT | Nullable | Display name |
| `company_id` | UUID | FK → companies(id), Nullable | Associated company |
| `phone` | TEXT | Nullable | Phone number |
| `avatar_url` | TEXT | Nullable | Avatar image URL |
| `role` | TEXT | NOT NULL, CHECK IN ('admin','customer') | User role |
| `updated_at` | TIMESTAMPTZ | Default NOW() | Last update timestamp |

**Note:** A Supabase database trigger auto-inserts a `profiles` row when a new user signs up via `auth.users`.

#### `jobs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK (auto-generated) | Unique job identifier |
| `title` | TEXT | NOT NULL | Job title |
| `description` | TEXT | NOT NULL | Full job description |
| `location` | TEXT | Nullable | Job location |
| `job_type` | TEXT | Nullable | "Full-time", "Part-time", "Contract", "Freelance" |
| `salary_range` | TEXT | Nullable | Salary range string |
| `status` | TEXT | NOT NULL | "active" or "closed" |
| `customer_id` | UUID | FK → profiles(id) | Owning customer/recruiter |
| `created_at` | TIMESTAMPTZ | Default NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Default NOW() | Last update timestamp |

#### `candidates`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK (auto-generated) | Unique candidate identifier |
| `full_name` | TEXT | NOT NULL | Candidate full name |
| `email` | TEXT | NOT NULL | Candidate email |
| `phone` | TEXT | Nullable | Phone number |
| `summary` | TEXT | Nullable | Brief summary/internal note |
| `status` | TEXT | NOT NULL, CHECK IN ('applied','screening','interview','offered','rejected') | Pipeline stage |
| `stage_order` | INTEGER | Default 0 | Order within a stage (for manual sorting) |
| `ai_score` | FLOAT | Nullable | AI-generated match score (placeholder, not yet used) |
| `ai_evaluation_notes` | TEXT | Nullable | AI-generated evaluation (placeholder, not yet used) |
| `resume_url` | TEXT | Nullable | Link to resume/LinkedIn |
| `job_id` | UUID | FK → jobs(id) ON DELETE CASCADE | Associated job |
| `created_at` | TIMESTAMPTZ | Default NOW() | Application date |
| `updated_at` | TIMESTAMPTZ | Default NOW() | Last update timestamp |

#### `notes`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK (auto-generated) | Note identifier |
| `candidate_id` | UUID | FK → candidates(id) | Parent candidate |
| `content` | TEXT | NOT NULL | Note text content |
| `created_at` | TIMESTAMPTZ | Default NOW() | When note was created |

### 5.3 Relationships

| Relationship | Type | Description |
|---|---|---|
| `companies` → `profiles` | One-to-Many | A company has many users (via `company_id`) |
| `profiles` → `jobs` | One-to-Many | A customer creates many jobs (via `customer_id`) |
| `jobs` → `candidates` | One-to-Many (CASCADE) | A job has many candidates (via `job_id`) |
| `candidates` → `notes` | One-to-Many | A candidate has many notes (via `candidate_id`) |
| `auth.users` → `profiles` | One-to-One | Supabase Auth user linked to profile (via `id`) |

### 5.4 Row Level Security (RLS)

All tables have RLS **enabled** but policies are **permissive** (allow all operations for authenticated users):

```sql
-- Example from profiles table (same pattern for all tables):
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update profiles" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Users can delete profiles" ON profiles FOR DELETE USING (true);
```

⚠️ **CRITICAL:** RLS policies use `true` for all operations, meaning **any authenticated user can read, create, update, and delete any record in any table**. There is no actual row-level security enforced at the database level.

### 5.5 Database Triggers

- **Auto-profile creation:** When a new user signs up in `auth.users`, a trigger automatically inserts a corresponding row into `profiles`. This is why the `handleCreateUser` function uses `UPDATE` instead of `INSERT` for profiles.

---

## 6. API Documentation

### 6.1 Overview

There are **no traditional REST API endpoints** in this application. All data operations are performed via the **Supabase JS SDK**, which translates to PostgreSQL queries. Below is a comprehensive catalog of every data operation performed.

### 6.2 Authentication Operations

| Operation | SDK Call | Location | Purpose |
|---|---|---|---|
| Login | `supabase.auth.signInWithPassword({ email, password })` | `login/page.tsx` | Authenticate user |
| Get Current User | `supabase.auth.getUser()` | Multiple files | Get authenticated user object |
| Sign Up (Admin creates user) | `tempSupabase.auth.signUp({ email, password, options: { data: { role } } })` | `admin/customers/page.tsx`, `admin/companies/[id]/page.tsx` | Create new auth user via temporary client |
| Sign Out | `supabase.auth.signOut()` | `sidebar.tsx` | End session |

### 6.3 Profile Operations

| Operation | Method | SDK Call | Location |
|---|---|---|---|
| Fetch all profiles | READ | `supabase.from('profiles').select('*, company:companies(*)').order('updated_at')` | `admin/customers/page.tsx` |
| Fetch profile by ID | READ | `supabase.from('profiles').select('*, company:companies(*)').eq('id', userId).single()` | `sidebar.tsx` |
| Fetch role only | READ | `supabase.from('profiles').select('role').eq('id', userId).single()` | `middleware.ts`, `auth-guard.tsx` |
| Count customers | READ | `supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer')` | `admin/page.tsx` |
| Count admins | READ | `supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin')` | `admin/page.tsx` |
| Update profile | UPDATE | `supabase.from('profiles').update({ email, role, full_name, company_id }).eq('id', userId)` | `admin/customers/page.tsx`, `admin/companies/[id]/page.tsx` |
| Delete profile | DELETE | `supabase.from('profiles').delete().eq('id', profileId)` | `admin/customers/page.tsx`, `admin/companies/[id]/page.tsx` |
| Fetch by company | READ | `supabase.from('profiles').select('*').eq('company_id', companyId)` | `admin/companies/[id]/page.tsx` |

### 6.4 Company Operations

| Operation | Method | SDK Call | Location |
|---|---|---|---|
| Fetch all companies | READ | `supabase.from('companies').select('*').order('name')` | `admin/customers/page.tsx` |
| Fetch single company | READ | `supabase.from('companies').select('*').eq('id', companyId).single()` | `admin/companies/[id]/page.tsx` |
| Create company | CREATE | `supabase.from('companies').insert([{ name, website_url, industry, location, description, company_size }])` | `admin/customers/page.tsx` |
| Update company | UPDATE | `supabase.from('companies').update({ name, ... }).eq('id', companyId)` | `admin/customers/page.tsx`, `admin/companies/[id]/page.tsx` |
| Delete company | DELETE | `supabase.from('companies').delete().eq('id', companyId)` | `admin/customers/page.tsx` |

### 6.5 Job Operations

| Operation | Method | SDK Call | Location |
|---|---|---|---|
| Count jobs | READ | `supabase.from('jobs').select('*', { count: 'exact', head: true })` | `admin/page.tsx` |
| Fetch jobs by customer | READ | `supabase.from('jobs').select('*, customer:profiles(*)').eq('customer_id', userId).order('created_at')` | `dashboard/jobs/page.tsx`, `dashboard/page.tsx` |
| Fetch jobs by user IDs | READ | `supabase.from('jobs').select('*').in('customer_id', userIds)` | `admin/companies/[id]/page.tsx` |
| Fetch single job | READ | `supabase.from('jobs').select('*, customer:profiles(*)').eq('id', jobId).single()` | `dashboard/jobs/[id]/page.tsx`, `jobs/[id]/page.tsx` |
| Recent jobs | READ | `supabase.from('jobs').select('*').eq('customer_id', userId).order('created_at').limit(5)` | `dashboard/page.tsx` |
| Job titles only | READ | `supabase.from('jobs').select('id, title').eq('customer_id', userId).order('created_at')` | `candidate-modal.tsx` |
| Create job | CREATE | `supabase.from('jobs').insert([{ title, description, location, job_type, salary_range, customer_id }])` | `dashboard/jobs/page.tsx` |
| Update job | UPDATE | `supabase.from('jobs').update({ title, description, ... }).eq('id', jobId)` | `dashboard/jobs/[id]/page.tsx` |
| Delete job | DELETE | `supabase.from('jobs').delete().eq('id', jobId)` | `dashboard/jobs/page.tsx` |

### 6.6 Candidate Operations

| Operation | Method | SDK Call | Location |
|---|---|---|---|
| Count candidates | READ | `supabase.from('candidates').select('*', { count: 'exact', head: true })` | `admin/page.tsx`, `dashboard/page.tsx` |
| Fetch all candidates | READ | `supabase.from('candidates').select('*').order('created_at')` | `dashboard/candidates/page.tsx` |
| Fetch by job IDs | READ | `supabase.from('candidates').select('*').in('job_id', jobIds)` | `admin/companies/[id]/page.tsx` |
| Fetch by job | READ | `supabase.from('candidates').select('*').eq('job_id', jobId).order('created_at')` | `dashboard/jobs/[id]/page.tsx`, `jobs/[id]/page.tsx` |
| Create candidate | CREATE | `supabase.from('candidates').insert([{ full_name, email, phone, summary, resume_url, status, job_id, stage_order }])` | `candidate-modal.tsx` |
| Update candidate | UPDATE | `supabase.from('candidates').update({ full_name, email, ... }).eq('id', candidateId)` | `candidate-modal.tsx` |
| Update status (drag) | UPDATE | `supabase.from('candidates').update({ status: newStatus }).eq('id', candidateId)` | `jobs/[id]/page.tsx` |
| Delete candidate | DELETE | `supabase.from('candidates').delete().eq('id', candidateId)` | Multiple files |

### 6.7 Notes Operations

| Operation | Method | SDK Call | Location |
|---|---|---|---|
| Fetch notes for candidate | READ | `supabase.from('notes').select('*').eq('candidate_id', candidateId).order('created_at')` | `jobs/[id]/page.tsx` |
| Create note | CREATE | `supabase.from('notes').insert([{ candidate_id, content }])` | `jobs/[id]/page.tsx` |

---

## 7. Authentication & Authorization

### 7.1 How Login Works

1. User navigates to `/login`
2. Enters email and password
3. Client calls `supabase.auth.signInWithPassword({ email, password })`
4. Supabase validates credentials and returns a JWT session
5. Session is stored in HTTP-only cookies (managed by `@supabase/ssr`)
6. Client checks `user.user_metadata.role` for routing:
   - `admin` → redirects to `/admin`
   - `customer` → redirects to `/dashboard`
   - Falls back to querying `profiles` table if metadata missing

### 7.2 Token/Session Handling

- **Session storage:** HTTP-only cookies managed by `@supabase/ssr`
- **Token refresh:** Handled automatically by Supabase middleware integration
- **Middleware:** Refreshes session on every request via `setAll()` on cookies
- **Server components:** Use `createServerClient` with cookie access
- **Client components:** Use `createBrowserClient` with automatic cookie management

### 7.3 Role System

#### Roles

| Role | Access Level | Routes | Description |
|---|---|---|---|
| `admin` | Full platform access | `/admin/*`, `/dashboard/*` (when impersonating), `/jobs/*` | Platform administrator |
| `customer` | Company-scoped access | `/dashboard/*`, `/jobs/*` | Recruiter/hiring manager |

#### Authorization Layers

There are **three layers** of authorization:

1. **Next.js Middleware** (`src/middleware.ts`)
   - Checks if user is authenticated
   - Redirects unauthenticated users to `/login`
   - Redirects authenticated users from `/login` or `/` to their dashboard

2. **Client-side AuthGuard** (`src/components/auth-guard.tsx`)
   - Wraps entire application in root layout
   - Checks role on every navigation
   - Admin routes: only accessible if `role === 'admin'` AND not impersonating
   - Customer routes: accessible if `role === 'customer'` OR `role === 'admin' && impersonating`
   - Shows spinner while checking auth

3. **Server-side Layout Guards** (`admin/layout.tsx`, `dashboard/layout.tsx`, `jobs/layout.tsx`)
   - Server components that check `supabase.auth.getUser()`
   - Redirect to `/login` if not authenticated
   - **Do NOT check roles** — role enforcement is only client-side

#### Impersonation Flow

```
Admin User → Views Company Details → Clicks "Login as" on a user
                    │
                    ▼
    setImpersonation({ userId, userEmail, userName, companyId })
    → Stores in localStorage as 'ats_impersonation'
    → Navigates to /dashboard
                    │
                    ▼
    ImpersonationContext reads localStorage
    → ImpersonationBanner shows at bottom of screen
    → Sidebar shows impersonated user's info
    → getEffectiveUserId() returns impersonated user's ID
    → All data queries use impersonated user's ID
                    │
                    ▼
    Admin clicks "End Session"
    → clearImpersonation() removes localStorage
    → Redirects to /admin/customers
```

---

## 8. Business Logic Explanation

### 8.1 How Candidates Are Created

Candidates can be created from three locations:

1. **Candidate Modal** (`candidate-modal.tsx`) — Reusable dialog used in:
   - `/dashboard/candidates` page (no preselected job)
   - `/dashboard/jobs/[id]` page (preselected job)
   - `/jobs/[id]` Kanban board (preselected job)

2. **Creation flow:**
   - User fills in: full_name (required), email (required), phone, summary, resume_url, job (required), status
   - If no job preselected, dropdown shows all jobs for the effective user
   - Default status is `applied`
   - `stage_order` is set to `0` on creation
   - `updated_at` is manually set to `new Date().toISOString()`

3. **Edit flow:**
   - Pre-fills all fields from existing candidate data
   - Uses Supabase `update` instead of `insert`
   - Can change job assignment and status

### 8.2 How Applications Are Processed

There is **no public application form**. All candidates are manually added by authenticated users (customers or impersonating admins). There is no candidate-facing portal.

### 8.3 Status Flow (Candidate Pipeline)

```
┌─────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐
│ Applied │───▶│ Screening │───▶│ Interview │───▶│  Offered  │    │ Rejected │
│ (Blue)  │    │ (Amber)   │    │ (Purple)  │    │ (Green)   │    │ (Red)    │
└─────────┘    └───────────┘    └───────────┘    └───────────┘    └──────────┘
     │              │                │                │                │
     └──────────────┴────────────────┴────────────────┘                │
                              │                                        │
                              ▼                                        │
                    Any stage can directly                            │
                    jump to any other stage                           │
                    (via drag-and-drop or                            │
                    status dropdown edit)                             │
                                                                       │
                    ◀─────────────── Any stage ───────────────────────┘
```

**Key behaviors:**
- Status can be changed to **any** stage from **any** other stage (no enforced sequential flow)
- Drag-and-drop on Kanban board directly updates `status` in database
- Status can also be changed via the Edit Candidate modal
- Each status has a distinct color and label for visual clarity
- Optimistic UI update on drag — reverts on failure

### 8.4 Job Lifecycle

```
Create Job (active) → Post candidates → [Optional: Close job] → Job (closed)
```

- Jobs are created with status `active` by default
- Jobs can be edited (title, description, location, type, salary, status)
- Jobs can be closed by changing status to `closed`
- Deleting a job cascades to delete all associated candidates

### 8.5 Admin Operations

- **Create Company:** Admin creates company workspace with name, industry, size, location, website, description
- **Create User:** Admin creates auth user via temporary Supabase client (to avoid session overwrite), then updates the auto-created profile with role, full_name, and company_id
- **Impersonate:** Admin can "become" a customer user — all dashboard queries use the impersonated user's ID
- **System Overview:** Admin sees aggregate metrics across the entire platform

### 8.6 Data Scoping

- **Admin views** see ALL data across all companies (no scoping)
- **Customer views** are scoped to their `customer_id` (for jobs) and their jobs' candidates
- **During impersonation**, the effective user ID is swapped, so customer-scoped views show the impersonated user's data

---

## 9. Error Handling System

### 9.1 Global Error Handling

There is **no global error handling layer**. Errors are handled inline at the component level.

### 9.2 Error Patterns Used

**Try-catch with alert (most common):**
```typescript
try {
  await supabase.from('candidates').delete().eq('id', id)
  loadData()
} catch (error) {
  alert(error instanceof Error ? error.message : 'Failed to delete candidate')
}
```

**Try-catch with state error (form operations):**
```typescript
try {
  const { error } = await supabase.from('jobs').insert([...])
  if (error) throw error
  // success
} catch (error) {
  setError(error instanceof Error ? error.message : 'Failed to create job')
}
```

**Supabase error checking:**
```typescript
const { data, error } = await supabase.from('profiles').select('*')
if (error) throw error
```

### 9.3 Validation Rules

Validation is minimal and done inline before Supabase calls:

| Entity | Validation Rules |
|---|---|
| User | Email required, password required, company required for customer role |
| Company | Name required |
| Job | Title required, description required |
| Candidate | Full name required, email required, job assignment required |
| Note | Content must be non-empty |

There is **no schema validation library** (no Zod, Yup, Joi). All validation is manual `if` checks.

### 9.4 Response Format

Since there are no API endpoints, there is no standard response format. UI feedback is handled through:

- **Error state variables** — Displayed as red text below forms
- **`alert()` calls** — For quick error notifications
- **`confirm()` calls** — For delete confirmations
- **Loading states** — Spinner or "Saving..." text on buttons

### 9.5 Edge Cases Not Handled

- Network failures during optimistic updates (partially handled by reverting)
- Duplicate email detection (only for user creation, partially)
- Concurrent edits by multiple users (no locking or conflict resolution)
- Session expiration during an active session (no global interceptor)
- Rate limiting or abuse prevention

---

## 10. External Dependencies

### 10.1 Production Dependencies

| Package | Version | Purpose | Why Used |
|---|---|---|---|
| `next` | 16.2.3 | React framework | App Router, SSR, middleware, file-based routing |
| `react` | 19.2.4 | UI library | Component-based UI rendering |
| `react-dom` | 19.2.4 | React DOM renderer | Browser rendering |
| `@supabase/ssr` | ^0.10.2 | Supabase SSR utilities | Cookie-based auth for server/client components |
| `@supabase/auth-helpers-nextjs` | ^0.15.0 | Supabase auth for Next.js | Auth integration (note: potentially superseded by @supabase/ssr) |
| `@hello-pangea/dnd` | ^18.0.1 | Drag-and-drop library | Kanban board candidate card dragging |
| `radix-ui` | ^1.4.3 | Unstyled accessible primitives | Base for shadcn/ui components |
| `class-variance-authority` | ^0.7.1 | CSS variant utility | Button and component variant definitions |
| `clsx` | ^2.1.1 | Conditional class names | Utility for className composition |
| `tailwind-merge` | ^3.5.0 | Tailwind class merger | Intelligent merging of Tailwind classes |
| `lucide-react` | ^1.8.0 | Icon library | Consistent, tree-shakeable icons |
| `shadcn` | ^4.2.0 | UI component generator | CLI tool for adding components (dev dependency in prod) |
| `tw-animate-css` | ^1.4.0 | Tailwind animation utilities | Animation classes for transitions |

### 10.2 Development Dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5 | Static type checking |
| `@types/node` | ^20 | Node.js type definitions |
| `@types/react` | ^19 | React type definitions |
| `@types/react-dom` | ^19 | React DOM type definitions |
| `tailwindcss` | ^4 | CSS utility framework |
| `@tailwindcss/postcss` | ^4 | PostCSS plugin for Tailwind v4 |
| `eslint` | ^9 | Code linting |
| `eslint-config-next` | 16.2.3 | Next.js-specific ESLint rules |

### 10.3 Potential Improvements

| Current | Suggested Improvement |
|---|---|
| `@supabase/auth-helpers-nextjs` | Remove — superseded by `@supabase/ssr` |
| `shadcn` in dependencies | Move to devDependencies or remove after component generation |
| No validation library | Add `zod` for schema validation |
| No state management | Add `zustand` or `jotai` for complex state |
| No date library | Add `date-fns` or `dayjs` for date formatting |
| No form library | Add `react-hook-form` for complex forms |

---

## 11. Weak Points / Technical Debt

### 11.1 🔴 Critical Security Issues

| Issue | Severity | Location | Description |
|---|---|---|---|
| **RLS policies are permissive** | CRITICAL | Database | All RLS policies use `USING (true)` — any authenticated user can read/write/delete any data |
| **No role checks on server layouts** | HIGH | `admin/layout.tsx`, `dashboard/layout.tsx` | Only checks authentication, not authorization — a customer could potentially access admin routes server-side |
| **Admin user creation uses anon key** | HIGH | `admin/customers/page.tsx` | Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` to create users — should use admin/service key via a secure API route |
| **No CSRF protection** | MEDIUM | All mutations | Supabase cookie-based auth without CSRF tokens |
| **Impersonation stored in localStorage** | MEDIUM | `impersonation-context.tsx` | No server-side validation of impersonation claims — purely client-side trust |
| **No rate limiting** | MEDIUM | All operations | No protection against brute force or abuse |

### 11.2 🟡 Architecture Issues

| Issue | Location | Description |
|---|---|---|
| **No API layer** | All components | Business logic embedded directly in React components — impossible to test independently |
| **No separation of concerns** | All pages | Data fetching, business logic, and UI are mixed in single components |
| **Massive client components** | `admin/customers/page.tsx` (698 lines), `admin/companies/[id]/page.tsx` (556 lines) | Components are too large and do too many things |
| **Duplicate code** | Multiple files | `getStatusBadge()` function is duplicated in 4 different files |
| **Duplicated user creation logic** | `admin/customers/page.tsx`, `admin/companies/[id]/page.tsx` | Same temp-supabase-client workaround for user creation |
| **Inconsistent data types** | `types.ts` vs README | README says status is 'new' but types.ts says 'applied' |
| **Hardcoded dummy data** | `admin/page.tsx` | Trend percentages like "+12%", "+24%", "+8%" are hardcoded strings, not calculated |
| **Mockup placeholders** | `admin/page.tsx` | "System Activity Map" is a placeholder with no actual chart |

### 11.3 🟠 Missing Features / Gaps

| Gap | Description |
|---|---|
| No file upload | Resume URLs are manually entered text fields, not actual file uploads |
| No email notifications | No email service for password reset, welcome emails, or status updates |
| No public job board | No way for candidates to apply publicly |
| No password reset | "Forgot password?" link goes to `#` (nowhere) |
| No audit logging | No tracking of who changed what and when |
| No pagination | All queries fetch all records — will not scale |
| No search on server | Search is client-side filtering after fetching all data |
| No caching layer | Every page load fetches fresh data from Supabase |
| No real-time updates | No Supabase Realtime subscriptions — data only refreshes on manual reload |
| No tests | Zero test files exist in the project |
| No CI/CD | No GitHub Actions, no automated testing or deployment pipeline |

### 11.4 ⚡ Performance Issues

| Issue | Impact | Description |
|---|---|---|
| `n+1` query pattern | Medium | Fetching candidates requires separate job fetch to get titles |
| No pagination | High | All tables fetched completely — will degrade with scale |
| Client-side filtering | Medium | All candidates fetched, then filtered in browser |
| `supabase.auth.getUser()` on every mount | Low | Multiple redundant auth calls across components |
| No React memo/callback optimization | Low | No `useMemo` or `useCallback` for expensive operations |
| Unused dependency | Low | `@supabase/auth-helpers-nextjs` imported but may not be used directly |

### 11.5 🔧 Code Quality Issues

| Issue | Description |
|---|---|
| TypeScript `any` types | `admin/page.tsx` uses `any[]` for recentJobs; error catches use `any` |
| No error boundaries | No React Error Boundaries for graceful error handling |
| Inconsistent navigation | Mix of `router.push()`, `window.location.href`, and `<Link>` |
| `noUnusedLocals: false` | TypeScript config allows unused variables |
| `ignoreBuildErrors: true` | TypeScript errors are ignored during build |
| `ignoreDuringBuilds: true` | ESLint errors are ignored during build |
| `confirm()` for deletes | Uses browser-native `confirm()` instead of custom dialog |
| Manifest not customized | PWA manifest still says "MyWebSite" / "MySite" |

---

## 12. AI Integration Readiness

### 12.1 Current State Assessment

| Criterion | Status | Notes |
|---|---|---|
| Data model prepared for AI | ✅ Ready | `candidates` table has `ai_score` (float) and `ai_evaluation_notes` (text) fields |
| Resume storage infrastructure | ❌ Not ready | `resume_url` is a text field with manually entered URLs; no file upload or storage |
| API layer for AI services | ❌ Not ready | No API routes or backend endpoints to integrate AI services |
| Job requirements structured | ⚠️ Partial | Job descriptions are free text; no structured skills/requirements extraction |
| Candidate data rich enough | ⚠️ Partial | Only name, email, phone, summary, resume_url — no structured skills, experience, education |
| Scoring infrastructure | ❌ Not ready | No mechanism to trigger AI evaluation or store/retrieve scores |
| Background job processing | ❌ Not ready | No queue system or serverless functions for async AI processing |
| Cost management | ❌ Not ready | No rate limiting, token counting, or usage tracking for AI API calls |

### 12.2 Where AI Layer Should Be Added

```
Recommended Architecture for AI Integration:

┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                        │
│                                                               │
│  ┌────────────────────────────────────┐                       │
│  │  NEW: /api/ai/ (API Route Handlers)│                       │
│  │  ├── /api/ai/parse-cv              │ ◀── CV Upload        │
│  │  ├── /api/ai/score-candidate       │ ◀── Score Request    │
│  │  ├── /api/ai/match-job             │ ◀── Match Request    │
│  │  └── /api/ai/webhooks              │ ◀── Async Callbacks  │
│  └──────────────┬─────────────────────┘                       │
│                 │                                              │
│  ┌──────────────▼─────────────────────┐                       │
│  │  NEW: src/lib/ai/                   │                       │
│  │  ├── openai-client.ts              │ ◀── AI Provider SDK  │
│  │  ├── prompts/                      │ ◀── Prompt Templates │
│  │  ├── parsers/                      │ ◀── CV/Resume Parsers│
│  │  └── scoring.ts                    │ ◀── Scoring Logic    │
│  └──────────────┬─────────────────────┘                       │
│                 │                                              │
└─────────────────┼────────────────────────────────────────────┘
                  │
    ┌─────────────▼─────────────────────────────────┐
    │         External AI Services                   │
    │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
    │  │ OpenAI   │  │ Anthropic│  │ Supabase     │ │
    │  │ GPT-4/5  │  │ Claude   │  │ Edge Functions│ │
    │  └──────────┘  └──────────┘  └──────────────┘ │
    └────────────────────────────────────────────────┘
```

### 12.3 How to Extend System for AI Features

#### 12.3.1 CV Parsing

**Current gap:** No file upload, no CV parsing.

**Implementation plan:**

1. **Add Supabase Storage bucket** for resume files
2. **Create Next.js API route** `/api/ai/parse-cv`:
   - Accept PDF/DOCX upload
   - Use AI (GPT-4 vision or specialized parser) to extract structured data
   - Return: name, email, phone, skills, experience, education, summary
3. **Add file upload UI** to `CandidateModal` and candidate creation flow
4. **Auto-populate** candidate fields from parsed CV data
5. **Store raw CV text** in new `resume_text` column for searchability

**Required database changes:**
```sql
ALTER TABLE candidates ADD COLUMN resume_text TEXT;
ALTER TABLE candidates ADD COLUMN parsed_skills JSONB;
ALTER TABLE candidates ADD COLUMN parsed_experience JSONB;
```

#### 12.3.2 Candidate Scoring

**Current state:** `ai_score` and `ai_evaluation_notes` fields exist but are unused.

**Implementation plan:**

1. **Create scoring API route** `/api/ai/score-candidate`:
   - Takes candidate ID and job ID
   - Compares candidate profile + resume against job requirements
   - Returns score (0-100) and evaluation notes
2. **Trigger scoring automatically** when:
   - Candidate is created (if job has requirements)
   - Job requirements are updated (re-score all candidates)
   - Resume is uploaded/parsed
3. **Display score** on candidate cards in Kanban board and candidate list
4. **Use scores** for candidate ranking and recommendations

**Scoring prompt structure:**
```
Given:
- Job: {title, description, requirements, location, type}
- Candidate: {name, resume_text, parsed_skills, experience, education}

Score this candidate's fit for the job on a scale of 0-100.
Provide:
1. Overall score
2. Key strengths (matching qualifications)
3. Potential concerns (missing requirements)
4. Recommended interview focus areas
```

#### 12.3.3 Job Matching

**Implementation plan:**

1. **Create matching API route** `/api/ai/match-job`:
   - Takes job ID
   - Scores all candidates (or top N) against the job
   - Returns ranked list with explanations
2. **Add "AI Recommendations" panel** to job detail page
3. **Add structured requirements** to jobs table:
   ```sql
   ALTER TABLE jobs ADD COLUMN required_skills JSONB;
   ALTER TABLE jobs ADD COLUMN required_experience_years INTEGER;
   ALTER TABLE jobs ADD COLUMN required_education TEXT;
   ```
4. **Create job posting enhancement**: Use AI to suggest structured requirements from free-text description

### 12.4 Recommended AI Stack

| Component | Recommended Tool | Why |
|---|---|---|
| **LLM Provider** | OpenAI GPT-4o / GPT-5 | Best for structured extraction and reasoning |
| **Alternative LLM** | Anthropic Claude | Good for long-context resume analysis |
| **CV Parsing** | OpenAI Assistants API | Can handle PDF/DOCX with file tools |
| **Text Extraction** | `pdf-parse` + `mammoth` | Server-side PDF/DOCX text extraction |
| **Embeddings** | OpenAI `text-embedding-3-small` | For semantic job-candidate matching |
| **Vector Store** | Supabase `pgvector` extension | Store and search candidate embeddings |
| **Background Jobs** | Supabase Edge Functions + `pg_cron` | Async AI processing without blocking UI |
| **Rate Limiting** | Upstash Redis | Token/count-based rate limiting for AI calls |

### 12.5 AI Readiness Score

| Category | Score | Target |
|---|---|---|
| Data Model | 6/10 | Add structured skills, parsed resume text |
| Infrastructure | 2/10 | Need API routes, file storage, background processing |
| Security | 2/10 | Need API key management, rate limiting, input sanitization |
| UI Integration Points | 5/10 | Kanban board, candidate cards are ready for score display |
| Overall | **3.5/10** | Significant infrastructure work needed before AI integration |

---

## 13. Improvement Roadmap

### 13.1 Short Term (1-2 Weeks) — Critical Fixes

| # | Priority | Task | Impact |
|---|---|---|---|
| 1 | 🔴 P0 | **Fix RLS policies** — Implement actual row-level security scoped to user roles and company membership | Security |
| 2 | 🔴 P0 | **Add server-side role checks** — Verify role in admin/dashboard layouts, not just client-side | Security |
| 3 | 🔴 P0 | **Move user creation to API route** — Use Supabase admin client with service role key via secure Next.js API route | Security |
| 4 | 🟡 P1 | **Extract shared utilities** — Create `src/lib/getStatusBadge.tsx` to eliminate duplication (duplicated 4x) | Code Quality |
| 5 | 🟡 P1 | **Extract shared data hooks** — Create custom hooks like `useJobs()`, `useCandidates()` | Maintainability |
| 6 | 🟡 P1 | **Add pagination** — Implement cursor-based or offset pagination for all list queries | Performance |
| 7 | 🟡 P1 | **Fix PWA manifest** — Change "MyWebSite" to "Mini-ATS" | Polish |
| 8 | 🟢 P2 | **Remove unused dependency** — `@supabase/auth-helpers-nextjs` is superseded by `@supabase/ssr` | Cleanup |

### 13.2 Medium Term (1-2 Months) — Architecture Improvements

| # | Task | Description |
|---|---|---|
| 1 | **Introduce API route layer** | Create `/api/*` routes to move all Supabase mutations behind server-side endpoints. This enables: validation, authorization, audit logging, and rate limiting |
| 2 | **Add Zod validation** | Schema validation for all inputs (create job, create candidate, update profile, etc.) |
| 3 | **Implement file uploads** | Use Supabase Storage for resume/cover letter uploads with proper access control |
| 4 | **Add React Hook Form** | Complex forms (job creation, candidate modal) need better validation and UX |
| 5 | **Create custom data hooks** | `useJobs()`, `useCandidates()`, `useProfile()` with built-in caching, error handling, and loading states |
| 6 | **Add Supabase Realtime** | Subscribe to candidate changes for live Kanban board updates across multiple users |
| 7 | **Add email notifications** | Via Supabase Edge Functions + email service (SendGrid/Resend) for: password reset, new candidate, status changes |
| 8 | **Add error boundaries** | React Error Boundaries for graceful error handling in production |
| 9 | **Write tests** | Unit tests for utilities, integration tests for components, E2E tests for critical flows |
| 10 | **Set up CI/CD** | GitHub Actions for lint, test, build, and deploy pipeline |
| 11 | **Fix TypeScript config** | Remove `ignoreBuildErrors`, enable `noUnusedLocals`, fix all type errors |
| 12 | **Add public job board** | Allow candidates to browse and apply to jobs without authentication |

### 13.3 Long Term (3-6 Months) — Architecture Upgrades

| # | Task | Description |
|---|---|---|
| 1 | **AI Integration — Phase 1: CV Parsing** | Implement resume upload → AI parsing → structured candidate data extraction |
| 2 | **AI Integration — Phase 2: Scoring** | Auto-score candidates against job requirements using LLM-based evaluation |
| 3 | **AI Integration — Phase 3: Matching** | Semantic search and job-candidate matching using embeddings + pgvector |
| 4 | **Multi-tenancy** | Proper company-level data isolation with RLS policies that check `company_id` |
| 5 | **Audit logging** | Track all data changes (who, what, when) for compliance and debugging |
| 6 | **Role-based dashboard customization** | Custom fields, workflows, and statuses per company |
| 7 | **Email template builder** | Customizable email templates for candidate communication |
| 8 | **Calendar integration** | Interview scheduling with Google Calendar / Outlook |
| 9 | **Analytics dashboard** | Real hiring metrics: time-to-hire, source tracking, conversion funnels |
| 10 | **Mobile-responsive optimization** | Current UI has some mobile responsiveness but Kanban board is desktop-only |
| 11 | **Webhook system** | Outgoing webhooks for third-party integrations (Slack, Teams, etc.) |
| 12 | **Rate limiting and abuse protection** | Upstash Redis or similar for API rate limiting |

### 13.4 Architecture Evolution Target

```
Current State (MVP):
┌──────────────────────────────────┐
│  Next.js (Monolith)              │
│  ┌─────────────────────────────┐ │
│  │ Components + Business Logic │ │
│  │ Direct Supabase SDK calls   │ │
│  └─────────────────────────────┘ │
└──────────────────────────────────┘

Target State (Production):
┌──────────────────────────────────────────────────────────┐
│  Next.js (Presentation Layer)                             │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐  │
│  │ Pages    │  │ Comp.    │  │ Custom Hooks           │  │
│  └──────────┘  └──────────┘  └────────────────────────┘  │
│        │              │                │                   │
│        ▼              ▼                ▼                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  API Route Layer (/api/*)                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │
│  │  │ Auth     │ │ Jobs     │ │ AI       │            │  │
│  │  │ Routes   │ │ Routes   │ │ Routes   │            │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘            │  │
│  └───────┼────────────┼────────────┼───────────────────┘  │
│          │            │            │                       │
└──────────┼────────────┼────────────┼───────────────────────┘
           │            │            │
     ┌─────▼────┐ ┌─────▼────┐ ┌────▼─────────┐
     │ Supabase │ │ Supabase │ │ AI Services  │
     │ Auth     │ │ Database │ │ (OpenAI, etc)│
     └──────────┘ │ + Storage│ └──────────────┘
                  │ + RLS    │
                  └──────────┘
```

---

## Appendix A: Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (public, safe for browser) |

**Note:** Both variables are prefixed with `NEXT_PUBLIC_`, meaning they are exposed to the browser. This is standard for Supabase as security is handled by RLS policies (which need to be properly implemented).

## Appendix B: Docker Deployment

```yaml
# docker-compose.yml
services:
  ats-app:
    build:
      context: .
      args:
        - NEXT_PUBLIC_SUPABASE_URL
        - NEXT_PUBLIC_SUPABASE_ANON_KEY
    ports:
      - "3070:3000"    # External port 3070 → Internal port 3000
    env_file:
      - .env
    restart: unless-stopped
```

The Dockerfile uses a multi-stage build:
1. **deps** — Install npm dependencies
2. **builder** — Build the Next.js application (with standalone output)
3. **runner** — Production image with minimal footprint (node:20-alpine, non-root user)

## Appendix C: Key File Statistics

| File | Lines | Type | Role |
|---|---|---|---|
| `admin/customers/page.tsx` | 698 | Client Component | Companies & Users CRUD |
| `admin/companies/[id]/page.tsx` | 556 | Client Component | Company Detail + Impersonation |
| `jobs/[id]/page.tsx` | 380 | Client Component | Kanban Board |
| `dashboard/jobs/[id]/page.tsx` | 419 | Client Component | Job Detail + Candidates |
| `dashboard/candidates/page.tsx` | 259 | Client Component | All Candidates |
| `dashboard/jobs/page.tsx` | 256 | Client Component | Job Postings |
| `candidate-modal.tsx` | 217 | Client Component | Candidate Create/Edit Dialog |
| `admin/page.tsx` | 155 | Server Component | Admin Dashboard |
| `sidebar.tsx` | 154 | Client Component | Navigation Sidebar |
| `dashboard/page.tsx` | 191 | Client Component | Customer Dashboard |
| `login/page.tsx` | 169 | Client Component | Login Form |
| `types.ts` | 98 | TypeScript | Type Definitions |
| **Total Source Lines** | **~4,200** | | |

---

*This document represents the single source of truth for the Mini-ATS project architecture and should be updated whenever significant changes are made to the codebase.*

*Last updated: 2026-04-18*