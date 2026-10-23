<p align="center">
  <img src="./public/logo.svg" width="240" alt="Flow Logo" />
</p>

<h1 align="center">Flow — AI-Native Multi-Board Work Todo &amp; Kanban</h1>

<p align="center">
  <strong>An AI-powered, self-hosted multi-dimensional work Todo &amp; Kanban workspace inspired by Linear, Plane, Planka, and Notion.</strong>
</p>

<p align="center">
  <a href="./README.md">简体中文</a> | <strong>English</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v22.13%2B%20%7C%20v24%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/SQLite-Native%20node%3Asqlite-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Vercel%20%2B%20Supabase-Supported-000000?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/PostgreSQL%20%2F%20Supabase-pg%208.23%2B-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Release-v0.3-6366F1" alt="Release v0.3" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue" alt="License GPL-3.0" />
</p>

---

## Key Features

### 1. Built-in AI Assistant (OpenAI-Compatible + Persistent Configuration)
- **Web-Based Visual Configuration & Persistent Storage**: Configure any OpenAI-compatible endpoint directly in the web UI (OpenAI, DeepSeek, SiliconFlow, DashScope, OpenRouter, local Ollama, etc.). The Base URL, Model name, and API Key are permanently persisted in the database. Only Super Admins can open the endpoint settings, and a saved API Key is only ever shown masked.
- **Natural Language Task Decomposition & Database Ingestion**: Send conversational commands or paste raw meeting notes to automatically create, update, or delete projects, team members (primary assignee + collaborators), tasks, due dates (`YYYY-MM-DD`), 4-tier priorities, and structured checklists (`Subtasks`).
- **Interactive Execution Receipts**: Every database action performed by the AI generates an interactive receipt card in the chat stream. Click any task receipt to inspect its detail drawer while all boards synchronize in real time.

### 2. Five Synchronized Multi-Dimensional Boards (Bi-Directional Drag & Drop)
Switch instantaneously between 5 views backed by a single source of truth. Dragging and dropping a task card across columns in any board automatically updates the corresponding underlying attribute:
1. **Status Kanban Board**: Advance tasks across `Backlog -> Todo -> In Progress -> Review / Blocked -> Done`. Dragging across columns updates `status`.
2. **Project Dimension Board**: Group tasks by `Project` with color-coded headers, completion progress bars, and overdue indicators. Supports creating, editing, and deleting projects, while dragging cards across columns migrates `project_id`.
3. **Personnel Workload Board**: Organize work by `Team Member` with real-time weekly capacity saturation bars (`<70% Optimal` / `70~100% Near Capacity` / `>100% Overloaded`). Supports creating, editing, and safely removing members, toggling between "Primary Assignee Only" and "Include Collaborators", and dragging across columns to reassign `assignee_id`.
4. **Due Date Board & Monthly Calendar**: Combine a 5-stage deadline warning board (Overdue / Due Today / Next 3 Days / Upcoming / Unscheduled) with an interactive monthly schedule calendar. Dragging cards across columns or calendar cells updates `due_date`.
5. **Global Analytics & Insights Dashboard**: Monitor overall delivery rate, overdue alerts, logged focus hours, project health comparisons, team workload rankings, and high-priority deadline radars.

### 3. Account Authentication & 5-Tier RBAC System
- **Server-Side Authentication & Strict RBAC Enforcement**: Every `/api` route strictly validates active sessions and verifies role-based permissions on the server, preventing privilege escalation and horizontal authorization bypass. Inaccessible resources return 404 to avoid information disclosure.
- **Session Security & Brute-Force Rate Limiting**: Sessions expire after 30 days by default (customizable via `FLOW_SESSION_TTL_DAYS`). Password changes automatically revoke all other active sessions, and failed login attempts are rate-limited.
- **First-Time Super Admin Setup**: When deployed with an empty user table, Flow automatically launches the **First-Time Super Admin Setup** wizard to initialize the primary `admin` account and optionally create a bound team member profile.
- **Account Management Menu**: Super Admins can access the **Account Management** modal from the bottom of the left sidebar to create, edit, and delete user accounts, reset passwords, and configure permissions.
- **5-Tier Organization Role Hierarchy & Granular Overrides**: Includes 5 built-in role presets with customizable per-account permission toggles and **project visibility scoping (`All Projects` vs. `Selected Projects Only`)**:

| Role Tier | Default Project Visibility | Project Create / Edit / Delete | Task Create / Edit / Delete | Manage Team Members | Manage Accounts & RBAC |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin** | All Projects | Create / Edit / Delete | Create / Edit / Delete | Yes | Yes |
| **Boss** | All Projects | Create / Edit / Delete | Create / Edit / Delete | Yes | Configurable by Admin |
| **Director** | All Projects (Scopable) | Create / Edit | Create / Edit / Delete | Yes | No |
| **Team Lead** | All Projects (Scopable) | Edit Only | Create / Edit | No | No |
| **Member** | Assigned Projects | Read Only | Create / Edit | No | No |

- **Two-Way Team Member Binding**: Bind any login account directly to an existing team member name on the board (`member_id`), or auto-create a matching team member profile. Bound accounts automatically post task comments and group chat messages under their bound member identity.

### 4. Custom Project Communication Group Chats
- **Multi-Channel Project Group Chats with Project Theme Color Sync**: Open the **Group Chat** drawer from the top header toolbar (the trigger button, drawer header, channel cards, badges, and send button automatically adopt the bound project's theme color). Create, edit, and delete custom communication channels (either linked to a specific project or configured as a cross-project channel with custom participant lists).
- **Interactive `@Member` & `#TASK-KEY` References**: Quick-insert `@member` mentions and `#TASK-KEY` task badges into messages. Clicking any `#TASK-KEY` chip in the message stream opens that task's detail drawer immediately.
- **Bottom-Right New Message Popup Notifications & Per-Channel Mute**: Incoming group chat messages trigger a project-colored popup notification in the bottom-right corner of the workspace with one-click actions to open the channel or mute it. Users can mute or unmute (`Mute`) any individual group chat from the channel list, active channel header, or notification popup.

### 5. Developer-Grade UI/UX & Productivity Tooling
- **Streamlined Sidebar with Drag-to-Reorder Views, Collapsible Sections, Top-5 View & Pinning**: The 5 Board Views in the left sidebar support **custom drag-and-drop reordering and view pinning**, while both Projects and Team Members sections support **click-to-collapse/expand**, **showing the top 5 items by default with a one-click "Show All" toggle**, and **pinning (`Pin`) individual projects or members** to the top.
- **Right-Aligned Top Action Toolbar**: All workspace utility and action buttons starting from Export (`JSON` / `CSV`), Import, Clear Workspace, Language Toggle (`中 / EN`), Theme Toggle, Group Chat, AI Assistant, and New Task are cleanly right-aligned at the top of the page with zero duplicate menus between sidebar and header (Import and Clear Workspace are shown to Super Admins only).
- **Subtask Completion Timestamps**: Checking off a subtask in the task detail drawer automatically records the completion time (`completed_at`) and displays the formatted timestamp on the right side of the subtask row.
- **Full Lifecycle Management for Projects & Personnel**: Create, edit, and delete projects and team members directly from the sidebar or board column headers. Deleting a member safely unassigns their tasks without data loss.
- **Keyboard-First Navigation**: Press `Ctrl/Cmd + K` for the global Command Palette, `N` for quick task creation, `Ctrl/Cmd + J` to toggle the AI Assistant, and `Esc` to dismiss active drawers or modals.
- **Rich Task Detail Drawer**: Break down tasks into subtasks with progress tracking, assign multiple collaborators, manage custom tags, post team comments, and review automated activity audit logs.
- **Built-in Pomodoro Focus Timer**: Floating 25-minute focus timer that automatically logs completed focus sessions into a task's actual time spent.
- **Dual Theme, Bilingual UI & Full Data Sovereignty**: Switch seamlessly between Crisp Light and Linear Dark themes, toggle the entire workspace UI between **Simplified Chinese (`中文`) and English (`EN`)** with one click, export/import full workspace backups via JSON, or export task reports to CSV.


### 6. Cloud-Native Dual Storage Engines & Data Integrity (SQLite + PostgreSQL / Supabase)
- **Seamless Dual Engine Switching**: Runs out-of-the-box on zero-dependency Node.js native SQLite (`node:sqlite`). Simply setting `DATABASE_URL` seamlessly switches the entire storage backend to PostgreSQL / Supabase.
- **Automated Idempotent Migrations & RLS Hardening**: Idempotently creates 11 relational tables and applies column migrations on first connection. Every table enables Row Level Security (RLS) to prevent credential or data exposure via the Supabase Data API.
- **Atomic Transactions & Concurrency Safety**: JSON workspace imports are pre-validated and executed atomically within a database transaction. Unique task keys use PostgreSQL advisory locks to eliminate race conditions under concurrent creation.
- **Security Audit & Key Masking**: AI API keys are stored safely and masked in responses to prevent SSRF and leakage. Production dependencies have 0 CVE vulnerabilities with an in-depth security audit report [`20261022_code-review.md`](./20261022_code-review.md).

---

## Deployment Guide

**Flow** supports four deployment modes: **Windows One-Click Local Run**, **Docker / Docker Compose**, **Ubuntu / Debian VPS Native Deployment**, and **Vercel + Supabase Serverless Cloud Deployment**.

---

### Option 1: Windows Local Deployment (One-Click Launcher)

#### 1. Prerequisites
Install [Node.js v22.13+ or v24 LTS](https://nodejs.org/) (Node.js v24 is recommended as it includes the built-in native `node:sqlite` engine with zero external database or C++ build tool dependencies; releases before v22.13 only expose `node:sqlite` behind an experimental flag and cannot start Flow as-is).

#### 2. One-Click Start & Auto-Open Browser
Double-click **[`start.bat`](./start.bat)** in the project root:
- Automatically checks and installs `node_modules` dependencies;
- Cleans up stale processes occupying ports `3001` and `5173`;
- Launches both the SQLite backend server and Vite frontend workspace, then automatically opens `http://localhost:5173` in your default browser.

#### 3. Command Line Usage
```powershell
# Install dependencies
npm install

# Start in development mode (Frontend http://localhost:5173 + Backend http://127.0.0.1:3001)
npm run dev

# Build and start in single-port production mode (served on port 3001)
npm run build
npm start
```

---

### Option 2: Docker / Docker Compose (Recommended for Servers & NAS)

The repository includes a multi-stage [`Dockerfile`](./Dockerfile) and [`docker-compose.yml`](./docker-compose.yml). The `/app/data` volume ensures your SQLite database and AI configuration are permanently persisted on disk.

#### Quick Start with Docker Compose
```bash
# 1. Clone the repository
git clone https://github.com/errolleefin/Flow.git
cd Flow

# 2. Build and start the container in detached mode
docker compose up -d --build

# 3. View container logs
docker compose logs -f
```
Once running, open `http://YOUR_SERVER_IP:3001` in your browser.

#### Standalone Docker CLI
```bash
# Build the image
docker build -t flow-workspace:latest .

# Run the container with persistent host volume mounted
docker run -d \
  --name flow-workspace \
  --restart unless-stopped \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  flow-workspace:latest
```

---

### Option 3: Native VPS Deployment (Ubuntu / Debian)

Ideal for bare-metal deployment on Ubuntu 20.04 / 22.04 / 24.04 VPS instances managed with **PM2** and reverse-proxied via **Nginx**.

#### 1. Install Node.js v24
```bash
sudo apt update && sudo apt install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v # Verify version >= v24.0.0
```

#### 2. Clone & Start with `start.sh`
```bash
git clone https://github.com/errolleefin/Flow.git
cd Flow

# Make the startup script executable and run it
chmod +x start.sh
./start.sh
```

#### 3. Run in Background with PM2
```bash
# Install PM2 globally
sudo npm install -g pm2

# Install dependencies and build production assets
npm install && npm run build

# Start Flow with PM2
PORT=3001 HOST=0.0.0.0 pm2 start "node --no-warnings server/index.mjs" --name flow

# Enable startup on boot and save process list
pm2 startup
pm2 save
```

#### 4. Configure Nginx Reverse Proxy (Optional, for Custom Domain & HTTPS)
Create `/etc/nginx/sites-available/flow`:
```nginx
server {
    listen 80;
    server_name flow.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### Option 4: Vercel + Supabase Cloud Deployment (Serverless Architecture)

The repository includes [`vercel.json`](./vercel.json), the Serverless entry point [`api/index.mjs`](./api/index.mjs), and a PostgreSQL storage layer. When the `DATABASE_URL` environment variable is set, the server stores all data in PostgreSQL (Supabase); otherwise it uses local SQLite.

> Vercel functions have an ephemeral file system, so SQLite data would be lost on every cold start (re-opening the first-time admin setup page). On Vercel without `DATABASE_URL`, every `/api` request therefore returns 503.

#### 1. Prepare the Supabase Database
1. Sign in to the [Supabase Dashboard](https://supabase.com/dashboard) and create a **New Project**.
2. Click **Connect** at the top of the project page and copy the **Transaction pooler** connection string (port `6543`, user name like `postgres.<project-ref>`), replacing `[YOUR-PASSWORD]` with your database password. Vercel only supports outbound IPv4, while the direct host `db.<project-ref>.supabase.co` is IPv6-only by default, so use the pooler string.
3. No manual migration is needed: on first connection the server idempotently creates the 11 tables (`projects`, `members`, `tasks`, `subtasks`, `activities`, `ai_settings`, `ai_messages`, `users`, `sessions`, `chat_groups`, and `chat_group_messages`) and applies later column migrations. You can also run [`supabase/schema.sql`](./supabase/schema.sql) in the **SQL Editor**; it matches the automatic schema exactly.
4. Row Level Security is enabled on every table with no policies: Flow connects as the table owner and is not restricted by RLS, while the Supabase Data API (anon / authenticated keys) cannot read these tables, which keeps password hashes, session tokens, and the AI key from leaking through it. Flow does not need `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.

#### 2. Deploy to Vercel
1. Fork or push this repository to your GitHub account.
2. Sign in to [Vercel](https://vercel.com/), click **Add New... -> Project**, and import your `Flow` repository.
3. Select `Vite` as the **Framework Preset**, keep Build Command as `npm run build`, and Output Directory as `dist` (Vercel automatically detects [`vercel.json`](./vercel.json)).
4. Configure the **Environment Variables** (see [`.env.example`](./.env.example)):
   ```env
   DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   # Optional: verify the database server certificate (download it from Supabase Database Settings -> SSL Configuration)
   # FLOW_PG_SSL_CA=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
   ```
   Without `FLOW_PG_SSL_CA` the connection is still encrypted, but the server certificate is not verified and the startup log says so.
5. Click **Deploy**, then open the site right away and complete the **First-Time Super Admin Setup** (until it is done, anyone who can reach the URL can claim the admin account). You can then migrate tasks, projects, and members between local SQLite and cloud deployments with **JSON Export / Import** in the top header (Super Admins only).

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | Port the server listens on |
| `HOST` | `0.0.0.0` | Address the server listens on |
| `FLOW_DB_PATH` | `./data/flow.sqlite` | SQLite database file (used when `DATABASE_URL` is not set) |
| `DATABASE_URL` | not set | PostgreSQL / Supabase connection string; switches storage to PostgreSQL. SSL is off for local hosts and on for all others; add `?sslmode=disable` to turn it off |
| `FLOW_PG_SSL_CA` | not set | CA certificate of the database server (PEM, `\n` allowed for line breaks); enables certificate verification |
| `FLOW_PG_POOL_MAX` | `3` | PostgreSQL connection pool size per server instance |
| `FLOW_SESSION_TTL_DAYS` | `30` | Login session lifetime in days |
| `FLOW_CORS_ORIGIN` | not set | Comma-separated origins allowed to call the API cross-origin. CORS is off by default: Vite proxies `/api` in development and production is same-origin |

---

## Development & Automated Tests

```bash
# Run the full test suite (Database CRUD, permissions, Date Utils, Task Filters, AI Assistant).
# Requires Node.js v22.18+ because the tests import .ts sources directly.
npm test

# Run the same suite against PostgreSQL: needs a role allowed to CREATE DATABASE (PostgreSQL 13+);
# every test creates a temporary flow_test_* database and drops it afterwards
FLOW_TEST_DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/postgres npm test

# TypeScript type-checking and production bundle build
npm run build
```

---

## License

Released under the **[GNU General Public License v3.0 (GPL-3.0)](./LICENSE)**. Contributions, issues, and pull requests are welcome.
