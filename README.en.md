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
  <img src="https://img.shields.io/badge/Node.js-v22.5%2B%20%7C%20v24%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/SQLite-Native%20node%3Asqlite-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Vercel%20%2B%20Supabase-Supported-000000?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/License-MIT-emerald" alt="License" />
</p>

---

## Key Features

### 1. Built-in AI Assistant (OpenAI-Compatible + Persistent Configuration)
- **Web-Based Visual Configuration & Persistent Storage**: Configure any OpenAI-compatible endpoint directly in the web UI (OpenAI, DeepSeek, SiliconFlow, DashScope, OpenRouter, local Ollama, etc.). The Base URL, Model name, and API Key are permanently persisted in the database.
- **Natural Language Task Decomposition & Database Ingestion**: Send conversational commands or paste raw meeting notes to automatically create, update, or delete projects, team members (primary assignee + collaborators), tasks, due dates (`YYYY-MM-DD`), 4-tier priorities, and structured checklists (`Subtasks`).
- **Interactive Execution Receipts**: Every database action performed by the AI generates an interactive receipt card in the chat stream. Click any task receipt to inspect its detail drawer while all boards synchronize in real time.

### 2. Five Synchronized Multi-Dimensional Boards (Bi-Directional Drag & Drop)
Switch instantaneously between 5 views backed by a single source of truth. Dragging and dropping a task card across columns in any board automatically updates the corresponding underlying attribute:
1. **Status Kanban Board**: Advance tasks across `Backlog -> Todo -> In Progress -> Review / Blocked -> Done`. Dragging across columns updates `status`.
2. **Project Dimension Board**: Group tasks by `Project` with color-coded headers, completion progress bars, and overdue indicators. Supports creating, editing, and deleting projects, while dragging cards across columns migrates `project_id`.
3. **Personnel Workload Board**: Organize work by `Team Member` with real-time weekly capacity saturation bars (`<70% Optimal` / `70~100% Near Capacity` / `>100% Overloaded`). Supports creating, editing, and safely removing members, toggling between "Primary Assignee Only" and "Include Collaborators", and dragging across columns to reassign `assignee_id`.
4. **Due Date Board & Monthly Calendar**: Combine a 5-stage deadline warning board (Overdue / Due Today / Next 3 Days / Upcoming / Unscheduled) with an interactive monthly schedule calendar. Dragging cards across columns or calendar cells updates `due_date`.
5. **Global Analytics & Insights Dashboard**: Monitor overall delivery rate, overdue alerts, logged focus hours, project health comparisons, team workload rankings, and high-priority deadline radars.

### 3. Developer-Grade UI/UX & Productivity Tooling
- **Full Lifecycle Management for Projects & Personnel**: Create, edit, and delete projects and team members directly from the sidebar or board column headers. Deleting a member safely unassigns their tasks without data loss.
- **Keyboard-First Navigation**: Press `Ctrl/Cmd + K` for the global Command Palette, `N` for quick task creation, `Ctrl/Cmd + J` to toggle the AI Assistant, and `Esc` to dismiss active drawers or modals.
- **Rich Task Detail Drawer**: Break down tasks into subtasks with progress tracking, assign multiple collaborators, manage custom tags, post team comments, and review automated activity audit logs.
- **Built-in Pomodoro Focus Timer**: Floating 25-minute focus timer that automatically logs completed focus sessions into a task's actual time spent.
- **Dual Theme & Full Data Sovereignty**: Switch seamlessly between Crisp Light and Linear Dark themes, export/import full workspace backups via JSON, or export task reports to CSV.

---

## Deployment Guide

**Flow** supports four deployment modes: **Windows One-Click Local Run**, **Docker / Docker Compose**, **Ubuntu / Debian VPS Native Deployment**, and **Vercel + Supabase Serverless Cloud Deployment**.

---

### Option 1: Windows Local Deployment (One-Click Launcher)

#### 1. Prerequisites
Install [Node.js v22.5+ or v24 LTS](https://nodejs.org/) (Node.js v24 is recommended as it includes the built-in native `node:sqlite` engine with zero external database or C++ build tool dependencies).

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

The repository includes [`vercel.json`](./vercel.json), the Serverless entry point [`api/index.mjs`](./api/index.mjs), and the Supabase PostgreSQL schema migration script [`supabase/schema.sql`](./supabase/schema.sql).

#### 1. Initialize Supabase Database
1. Sign in to the [Supabase Dashboard](https://supabase.com/dashboard) and create a **New Project**.
2. Open **SQL Editor** -> **New Query** in the left sidebar.
3. Copy the entire contents of [`supabase/schema.sql`](./supabase/schema.sql), paste it into the editor, and click **Run** to create the 7 required tables (`projects`, `members`, `tasks`, `subtasks`, `activities`, `ai_settings`, and `ai_messages`).
4. Retrieve your credentials from **Project Settings -> API / Database**:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (Transaction/Session Pooler connection string)

#### 2. Deploy to Vercel
1. Fork or push this repository to your GitHub account.
2. Sign in to [Vercel](https://vercel.com/), click **Add New... -> Project**, and import your `Flow` repository.
3. Select `Vite` as the **Framework Preset**, keep Build Command as `npm run build`, and Output Directory as `dist` (Vercel automatically detects [`vercel.json`](./vercel.json)).
4. Configure the **Environment Variables** (see [`.env.example`](./.env.example)):
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-project-id.supabase.co:5432/postgres
   ```
5. Click **Deploy**. You can also migrate all your tasks, projects, and members between local SQLite and cloud deployments at any time using the **JSON Export / Import** menu in the top header.

---

## Development & Automated Tests

```bash
# Run the full unit & integration test suite (Database CRUD, Date Utils, Task Filters, AI Assistant)
npm test

# TypeScript type-checking and production bundle build
npm run build
```

---

## License

Released under the **MIT License**. Contributions, issues, and pull requests are welcome.
