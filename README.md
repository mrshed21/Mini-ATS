<div align="center">

# 🎯 Mini-ATS

**Streamline Your Recruitment Process with Modern Technology**

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?style=flat-square&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Latest-3ecf8e?style=flat-square&logo=supabase)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

**A production-ready MVP recruitment management system built with cutting-edge technologies.** Simplify hiring, manage candidates efficiently, and track your recruitment pipeline with an intuitive, modern interface.

[Features](#-features) • [Quick Start](#-quick-start) • [Usage](#-usage) • [Tech Stack](#-tech-stack)

</div>

---

## 🌟 Overview

Mini-ATS is a comprehensive Applicant Tracking System designed for modern HR teams and recruitment agencies. Built with a focus on user experience and efficiency, it provides everything you need to manage your hiring process from job posting to candidate placement.

### Why Mini-ATS?

- **🚀 Fast & Modern** - Built with Next.js 16 and React 19 for lightning-fast performance
- **🎨 Beautiful UI** - Clean, minimal design inspired by industry leaders like Linear and Vercel
- **🔒 Secure** - Role-based authentication with Supabase Auth and Row Level Security
- **📊 Intuitive** - Kanban-style workflow management that makes tracking candidates effortless
- **⚡ Real-time** - Instant updates and seamless user experience

---

## ✨ Features

### 🔐 Authentication & Access Control

- **Role-Based Access Control (RBAC)** - Separate dashboards for Admins and Customers
- **Secure Authentication** - Powered by Supabase Auth with session management
- **Protected Routes** - Automatic redirects based on user roles
- **Easy User Management** - Admins can create and manage customer accounts

### 👨‍💼 Admin Dashboard

- **System Overview** - Real-time statistics and metrics across the entire platform
- **User Management** - Create and manage admin and customer accounts
- **Insights** - Track system-wide performance and usage patterns

### 👥 Customer Dashboard

- **Job Management** - Create, edit, and manage job postings effortlessly
- **Candidate Overview** - View and track all candidates across all jobs
- **Smart Filtering** - Filter candidates by job, status, or search by name/email
- **Visual Kanban Board** - Drag-and-drop candidate tracking through 5 stages

### 📋 Kanban Board System

Transform your recruitment workflow with a visual, stage-based pipeline:

```
┌─────────┬───────────┬───────────┬───────────┬───────────┐
│   New   │ Screening │ Interview │  Offered  │ Rejected  │
├─────────┼───────────┼───────────┼───────────┼───────────┤
│         │           │           │           │           │
│ 🔵      │ 🟡        │ 🟠        │ 🟢        │ 🔴        │
│         │           │           │           │           │
└─────────┴───────────┴───────────┴───────────┴───────────┘
```

- **5-Stage Workflow** - New → Screening → Interview → Offered → Rejected
- **Easy Status Updates** - Update candidate status with a simple dropdown
- **Search Functionality** - Quickly find candidates by name or email
- **Add/Delete Candidates** - Manage your talent pool with ease

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or higher ([Download](https://nodejs.org/))
- **Supabase** account ([Sign up free](https://supabase.com/))
- **npm** or **yarn** package manager

### Installation

1. **Navigate to the project directory**
   ```bash
   cd z:/LIA/Mini-ATS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase database**

   Run the following SQL scripts in your Supabase SQL Editor to create the necessary tables:

   **Profiles Table:**
   ```sql
   CREATE TABLE profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id),
     email TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Enable Row Level Security
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   
   -- Create security policies
   CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
   CREATE POLICY "Users can insert profiles" ON profiles FOR INSERT WITH CHECK (true);
   CREATE POLICY "Users can update profiles" ON profiles FOR UPDATE USING (true);
   CREATE POLICY "Users can delete profiles" ON profiles FOR DELETE USING (true);
   ```

   **Jobs Table:**
   ```sql
   CREATE TABLE jobs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     title TEXT NOT NULL,
     description TEXT NOT NULL,
     company_name TEXT,
     customer_id UUID REFERENCES profiles(id),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can view all jobs" ON jobs FOR SELECT USING (true);
   CREATE POLICY "Users can insert jobs" ON jobs FOR INSERT WITH CHECK (true);
   CREATE POLICY "Users can update jobs" ON jobs FOR UPDATE USING (true);
   CREATE POLICY "Users can delete jobs" ON jobs FOR DELETE USING (true);
   ```

   **Candidates Table:**
   ```sql
   CREATE TABLE candidates (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     email TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('new', 'screening', 'interview', 'offered', 'rejected')),
     job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can view all candidates" ON candidates FOR SELECT USING (true);
   CREATE POLICY "Users can insert candidates" ON candidates FOR INSERT WITH CHECK (true);
   CREATE POLICY "Users can update candidates" ON candidates FOR UPDATE USING (true);
   CREATE POLICY "Users can delete candidates" ON candidates FOR DELETE USING (true);
   ```

4. **Configure environment variables**

   Ensure your `.env.local` file contains your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

5. **Start the development server**
   ```bash
   npm run dev -- --webpack
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application in action!

---

## 📖 Usage

### Getting Started

#### 1. Create an Admin Account

- Go to your [Supabase Dashboard](https://supabase.com/dashboard/auth/users)
- Create a new user manually in the Authentication section
- Add the user to the `profiles` table with role set to `admin`

#### 2. Login as Admin

- Visit [http://localhost:3000/login](http://localhost:3000/login)
- Enter your admin credentials
- You'll be automatically redirected to the Admin Dashboard at `/admin`

#### 3. Create Customer Accounts

- Navigate to **Admin Dashboard** → **Manage Users**
- Click **"Create New User"**
- Enter email, password, and select role as **"customer"**
- The customer can now login and access their dedicated dashboard

### Managing Recruitment

#### For Customers

1. **Post Jobs** - Create and manage job postings in **Dashboard** → **Job Postings**
2. **Add Candidates** - Add candidates to jobs via the **"View Candidates"** button
3. **Track Progress** - Manage candidate status using the intuitive Kanban board
4. **Search & Filter** - Quickly find candidates by name, email, or filter by status

#### For Admins

1. **View Analytics** - Monitor system-wide statistics and metrics
2. **Manage Users** - Create and manage customer and admin accounts
3. **Platform Overview** - Get insights into recruitment activities across all customers

---

## 🛠 Tech Stack

<details>
<summary><strong>Click to view complete tech stack</strong></summary>

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.2.3 | React framework with App Router |
| **React** | 19.2.4 | UI library |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Node.js** | 18+ | Runtime environment |

### Styling & UI

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | 4.0 | Utility-first CSS framework |
| **shadcn/ui** | Latest | Beautiful, accessible UI components |
| **Lucide React** | 1.8.0 | Icon library |
| **Radix UI** | 1.4.3 | Unstyled, accessible components |

### Backend & Database

| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend-as-a-Service (Auth + Database) |
| **PostgreSQL** | Primary database (via Supabase) |

### Development Tools

| Technology | Purpose |
|------------|---------|
| **ESLint** | Code linting |
| **TypeScript** | Static type checking |

</details>

---

## 📁 Project Structure

```
mini-ats/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── admin/                # Admin dashboard routes
│   │   │   ├── customers/        # Customer management
│   │   │   └── companies/        # Company management
│   │   ├── dashboard/            # Customer dashboard routes
│   │   │   ├── candidates/       # Candidate management
│   │   │   └── jobs/             # Job posting management
│   │   ├── jobs/[id]/            # Kanban board for specific job
│   │   ├── login/                # Authentication page
│   │   ├── layout.tsx            # Root layout component
│   │   └── page.tsx              # Home page
│   ├── components/               # Reusable React components
│   │   ├── ui/                   # shadcn/ui components
│   │   └── sidebar.tsx           # Shared navigation sidebar
│   ├── lib/                      # Utility functions and configurations
│   │   ├── supabase/             # Supabase client setup
│   │   └── types.ts              # TypeScript type definitions
│   └── middleware.ts             # Authentication middleware
├── public/                       # Static assets (images, icons)
├── .env.local                    # Environment variables (not in git)
├── package.json                  # Project dependencies
├── tsconfig.json                 # TypeScript configuration
├── next.config.ts                # Next.js configuration
└── tailwind.config.ts            # Tailwind CSS configuration
```

---

## 🎨 Design Philosophy

Mini-ATS follows a modern, minimal design approach inspired by industry-leading applications like **Linear** and **Vercel**:

- **🎯 Clarity First** - Information hierarchy that makes sense
- **🎨 Minimal Color Palette** - Gray tones with purposeful accent colors
- **📦 Card-Based Layout** - Organized, scannable content presentation
- **✨ Consistent Spacing** - Uniform padding and margins throughout
- **🔤 Readable Typography** - Clear, legible fonts at all sizes
- **🧭 Intuitive Navigation** - Simple, predictable user flows

---

## 🛠 Development

### Available Scripts

```bash
# Start development server with Webpack
npm run dev -- --webpack

# Build for production
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

### Adding New Features

1. **Create a new route** under `src/app/`
2. **Browser components** - Use `createClient()` for Supabase client
3. **Server components** - Use `await createClient()` for server-side operations
4. **Follow existing patterns** - Maintain consistency with current code structure
5. **Use shadcn/ui components** - Leverage the existing component library

### Code Style

- Use **TypeScript** for type safety
- Follow **ESLint** rules
- Use **Tailwind CSS** classes for styling
- Keep components **small and focused**
- Write **clear, descriptive** function and variable names

---

## 📊 Database Schema

<details>
<summary><strong>View detailed database schema</strong></summary>

### Profiles Table
```sql
profiles (
  id        UUID    PRIMARY KEY,
  email     TEXT    NOT NULL,
  role      TEXT    NOT NULL (admin/customer),
  created_at TIMESTAMP
)
```

### Jobs Table
```sql
jobs (
  id           UUID    PRIMARY KEY,
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  company_name TEXT,
  customer_id  UUID    REFERENCES profiles(id),
  created_at   TIMESTAMP
)
```

### Candidates Table
```sql
candidates (
  id         UUID    PRIMARY KEY,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  status     TEXT    NOT NULL (new/screening/interview/offered/rejected),
  job_id     UUID    REFERENCES jobs(id),
  created_at TIMESTAMP
)
```

</details>

---

## 🔒 Security

- **Row Level Security (RLS)** enabled on all tables
- **Protected routes** with role-based access control
- **Secure authentication** via Supabase Auth
- **Session management** with automatic token refresh
- **Input validation** throughout the application

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📚 Resources & Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Backend powered by [Supabase](https://supabase.com/)
- Icons by [Lucide](https://lucide.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

<div align="center">

**Made with ❤️ using modern web technologies**

[⬆ Back to Top](#-mini-ats)

</div>