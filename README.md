<p align="center">
  <img src="./public/logo.svg" width="240" alt="Flow Logo" />
</p>

<h1 align="center">Flow — AI-Native Multi-Board Work Todo &amp; Kanban</h1>

<p align="center">
  <strong>融合 Linear、Plane、Planka 与 Notion 设计精髓，内置 OpenAI 兼容智能助理的多维工作 Todo 与敏捷看板系统。</strong>
</p>

<p align="center">
  <strong>简体中文</strong> | <a href="./README.en.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v22.13%2B%20%7C%20v24%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/SQLite-Native%20node%3Asqlite-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Vercel%20%2B%20Supabase-Supported-000000?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Release-v0.2-6366F1" alt="Release v0.2" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue" alt="License GPL-3.0" />
</p>

---

## 核心特性

### 1. 内置 AI 智能助理（OpenAI Compatible + 永久化配置）
- **网页端可视化配置与永久保存**：支持在网页内直接配置任意 OpenAI 兼容接口（OpenAI、DeepSeek、硅基流动 SiliconFlow、阿里云百炼 DashScope、OpenRouter、本地 Ollama 等），URL / Model / API Key 永久持久化保存至数据库。接口配置仅超级管理员可见，API Key 保存后只回显脱敏值。
- **自然语言自动拆单与录入数据库**：直接发送口语指令或粘贴会议纪要，AI 自动识别并创建/修改/删除所属项目、团队相关人员（主负责 + 多协作人），自动推算截止日期 (`YYYY-MM-DD`)、判定四级优先级并拆解生成子任务检查清单 (`Subtasks`)。
- **可视化入库回执卡片**：每次对话执行的数据库变更均生成交互式回执卡片，点击即可打开任务详情，且底层看板实时同步刷新。

### 2. 五大维度看板无缝联动（拖拽自动反推并更新属性）
同一套底层数据支持在 5 种视图间秒级切换，且在任意看板跨列拖拽卡片会自动反推并更新对应的维度字段：
1. **状态流转看板（Status Kanban）**：按 `待规划 -> 待处理 -> 进行中 -> 审核/阻塞 -> 已完成` 推进工作流，跨列拖拽自动更新 `status`。
2. **项目维度看板（Project Board）**：按 `项目名` 分列聚合，实时展示项目色标、完成率进度条与逾期告警，支持项目的创建、编辑与删除，跨列拖拽自动迁移任务的 `project_id`。
3. **人员负载看板（Personnel Workload Board）**：按 `相关人员` 分列，动态计算成员周工时容量水位条（`<70% 余量充裕` / `70~100% 负载饱满` / `>100% 超载预警`），支持团队成员的创建、编辑与安全移除，支持切换“仅主负责”或“含协同参与任务”，跨列拖拽直接改派主负责人 `assignee_id`。
4. **截止日期看板 & 月度日历双模视图（Due Date & Calendar）**：提供 5 级死线预警看板（已逾期 / 今日到期 / 未来 3 天 / 远期规划 / 未排期）与交互式月度排期日历，跨列或跨日历日期格拖拽自动更新 `due_date`。
5. **全局效能仪表盘（Analytics & Insights）**：汇总全局交付率、死线预警、专注工时投入、项目健康度对比图、团队负载排行与高优死线雷达表。

### 3. 账户登录与 5 级 RBAC 权限管理体系
- **首次部署超级管理员初始化**：初次启动检测到数据库尚无账户时，自动打开**「首次部署 · 初始化超级管理员」**设置向导，创建首个超级管理员（`admin`）账号并可选同步生成同名团队人员档案。
- **管理员账号管理菜单**：超级管理员登录系统后，可通过左侧导航栏底部的**「账号管理（Account Management）」**按钮新建、编辑或删除团队账号、重置密码并分配权限。
- **5 级组织角色权限模型与细粒度自定义**：支持预设五级角色，并支持按单个账号覆盖任意权限开关及限定**可视项目范围（全部项目可视 / 仅勾选的指定项目可视）**：

| 角色等级 | 默认可视项目范围 | 项目新建 / 编辑 / 删除 | 任务新建 / 编辑 / 删除 | 管理团队人员 | 管理账号与权限 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **管理员 (Admin)** | 全部项目 | 新建 / 编辑 / 删除 | 新建 / 编辑 / 删除 | 支持 | 支持 |
| **老板 (Boss)** | 全部项目 | 新建 / 编辑 / 删除 | 新建 / 编辑 / 删除 | 支持 | 仅管理员可配置 |
| **项目主管 (Director)** | 全部项目（可按项目限定） | 新建 / 编辑 | 新建 / 编辑 / 删除 | 支持 | 不支持 |
| **组长 (Lead)** | 全部项目（可按项目限定） | 仅编辑 | 新建 / 编辑 | 不支持 | 不支持 |
| **成员 (Member)** | 可指定关联项目 | 只读 | 新建 / 编辑 | 不支持 | 不支持 |

- **账号与已有团队人员双向绑定**：新建或编辑账号时，可直接下拉绑定到目前已创建的团队人员名称上（`member_id`），或一键自动创建同名团队成员；绑定后在任务评论与项目群聊中将自动关联该成员身份。

### 4. 自定义项目沟通群聊（Project Group Chats）
- **多频道项目沟通群与项目主题色联动**：通过页面顶部工具栏的**「项目群聊」**按钮打开抽屉（按钮与抽屉全局主题色、频道卡片、徽标及发送按钮均自动与当前关联项目的色标保持一致），支持自由创建、编辑、删除自定义沟通群聊（可绑定到特定项目，或设为跨项目公共沟通频道，并自定义群参与人员）。
- **人员提及与任务编号联动**：群聊输入框提供 `@成员` 快捷提及与 `#TASK-KEY` 任务引用按钮；消息流中的 `#任务编号` 自动渲染为可点击高亮标签，点击即可直接唤起对应任务的右侧详情抽屉。
- **右下角新消息弹窗提醒与单群静音免打扰（Mute）**：当群聊收到新消息时，页面右下角会自动弹出带有对应项目主题色的实时消息卡片（支持一键直达该群聊或快速静音）；用户可在频道列表、聊天顶部栏或弹窗上随时静音（Mute）/ 恢复任意群聊。

### 5. 极客级 UI/UX 与效率赋能
- **极简左侧导航与拖拽排序/折叠/置顶能力**：左侧「视图导航」支持**自定义上下拖拽调整顺序与单个视图置顶**；「项目列表」与「相关人员」均支持**点击标题折叠/展开**、**默认展示前 5 项并支持一键展开全部**，以及**单个项目或人员的永久置顶（Pin）**。
- **顶部右对齐全局操作栏**：导出（JSON / CSV）、导入、清空工作区、中英双语切换、明暗主题切换、项目群聊、AI 智能助理与新建任务按钮统一集成在页面顶部右侧对齐，消除左右菜单功能重复（导入与清空工作区仅超级管理员可见）。
- **子任务完成时间自动记录与展示**：在任务详情抽屉中点击完成任意子任务时，数据库自动记录完成时间戳（`completed_at`），并在该子任务右侧实时显示完成时间。
- **项目与人员全生命周期管理**：左侧导航栏与看板列头均支持一键新建、编辑、删除项目和相关人员；删除人员时自动将关联任务平顺解绑为未指派，保障任务数据安全。
- **键盘流快捷键**：`Ctrl/Cmd + K` 唤起全局命令面板、`N` 键单键速建任务、`Ctrl/Cmd + J` 唤起 AI 智能助理、`Esc` 关闭抽屉。
- **富任务详情抽屉**：支持子任务拆解与进度条、多选协同相关人员、自定义标签、团队评论与系统自动审计日志。
- **专注番茄钟（Pomodoro Timer）**：25 分钟悬浮倒计时，结算后自动累加至任务实际投入时长。
- **双主题、中英双语切换与数据主权**：支持明亮浅色 / Linear Dark 暗黑模式一键切换，内置**简体中文 / English 双语界面实时切换**，支持 JSON 完整备份导入导出与 CSV 报表导出。

---

## 全平台部署指南

**Flow** 支持 **Windows 桌面一键运行**、**Docker 容器化部署**、**Ubuntu VPS 本地部署** 以及 **Vercel + Supabase 云端部署** 四种模式。

---

### 方式一：Windows 本地部署（一键启动）

#### 1. 环境准备
安装 [Node.js v22.13+ 或 v24 LTS](https://nodejs.org/)（推荐使用 Node.js v24，内置原生 `node:sqlite` 引擎，无需配置任何外部数据库或 C++ 编译工具；v22.13 之前的版本需要实验参数才能使用 `node:sqlite`，无法直接启动）。

#### 2. 一键启动并自动打开网页
直接双击项目根目录下的 **[`start.bat`](./start.bat)** 脚本：
- 自动检查并安装 `node_modules` 依赖；
- 自动清理残留端口占用（`3001` 与 `5173`）；
- 同时启动后端 SQLite API 与前端工作台，并在 3 秒后自动调用默认浏览器打开 `http://localhost:5173`。

#### 3. 命令行方式启动
```powershell
# 安装依赖
npm install

# 开发模式启动（前端 http://localhost:5173 + 后端 http://127.0.0.1:3001）
npm run dev

# 生产模式单端口启动（编译前端后由 3001 端口统一托管）
npm run build
npm start
```

---

### 方式二：Docker / Docker Compose 部署（推荐服务器与 NAS）

项目已内置多阶段构建的 [`Dockerfile`](./Dockerfile) 与 [`docker-compose.yml`](./docker-compose.yml)，通过数据卷 `/app/data` 实现 SQLite 数据库与 AI 配置的永久化落盘保存。

#### 使用 Docker Compose 一键启动（推荐）
```bash
# 1. 克隆仓库
git clone https://github.com/errolleefin/Flow.git
cd Flow

# 2. 构建并后台启动容器
docker compose up -d --build

# 3. 查看运行日志
docker compose logs -f
```
启动后直接在浏览器访问：`http://你的服务器IP:3001`

#### 使用 Docker CLI 独立运行
```bash
# 构建镜像
docker build -t flow-workspace:latest .

# 运行容器并挂载本地 data 目录持久化数据库
docker run -d \
  --name flow-workspace \
  --restart unless-stopped \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  flow-workspace:latest
```

---

### 方式三：VPS 本地部署（Ubuntu / Debian）

适用于在 Ubuntu 20.04 / 22.04 / 24.04 VPS 上直接裸机部署，并通过 **PM2** 进程守护与 **Nginx** 绑定域名。

#### 1. 安装 Node.js v24 环境
```bash
sudo apt update && sudo apt install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v # 确认版本 >= v24.0.0
```

#### 2. 克隆项目并一键启动
```bash
git clone https://github.com/errolleefin/Flow.git
cd Flow

# 赋予启动脚本执行权限并运行（自动安装依赖、编译前端并启动 3001 端口）
chmod +x start.sh
./start.sh
```

#### 3. 使用 PM2 后台常驻与开机自启
```bash
# 全局安装 PM2
sudo npm install -g pm2

# 编译前端静态资源
npm install && npm run build

# 使用 PM2 启动 Flow 服务
PORT=3001 HOST=0.0.0.0 pm2 start "node --no-warnings server/index.mjs" --name flow

# 设置开机自启并保存进程列表
pm2 startup
pm2 save
```

#### 4. 配置 Nginx 反向代理（可选，支持域名与 HTTPS）
编辑 `/etc/nginx/sites-available/flow`：
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

### 方式四：Vercel + Supabase 云端部署（Serverless 架构）

项目已内置 [`vercel.json`](./vercel.json)、Serverless 路由入口 [`api/index.mjs`](./api/index.mjs) 与 PostgreSQL 存储层。设置环境变量 `DATABASE_URL` 后，服务端改用 PostgreSQL（Supabase）保存全部数据；未设置时使用本地 SQLite。

> Vercel 函数的文件系统是临时的，SQLite 数据会随冷启动丢失（并重新开放「初始化超级管理员」页面），因此在 Vercel 上未配置 `DATABASE_URL` 时，所有 `/api` 请求都会返回 503。

#### 1. 准备 Supabase 数据库
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard) 并创建一个新项目（New Project）。
2. 点击项目页顶部的 **Connect**，复制 **Transaction pooler** 连接串（端口 `6543`，用户名形如 `postgres.<project-ref>`），并将 `[YOUR-PASSWORD]` 替换为数据库密码。Vercel 只支持 IPv4 出站，而直连地址 `db.<project-ref>.supabase.co` 默认只提供 IPv6，因此请使用 pooler 连接串。
3. 无需手动建表：服务首次连接时会自动、幂等地创建 `projects`、`members`、`tasks`、`subtasks`、`activities`、`ai_settings`、`ai_messages`、`users`、`sessions`、`chat_groups` 与 `chat_group_messages` 共 11 张数据表，并执行后续版本的列迁移。也可以在 **SQL Editor** 中手动运行 [`supabase/schema.sql`](./supabase/schema.sql)，其内容与自动建表一致。
4. 所有表都会开启行级安全（RLS）且不添加任何策略：Flow 以表所有者身份连接，不受 RLS 限制；Supabase Data API（anon / authenticated key）则无法读取这些表，避免密码哈希、会话 token 与 AI Key 经由 Data API 泄露。Flow 不需要 `SUPABASE_URL` 或 `SUPABASE_SERVICE_ROLE_KEY`。

#### 2. 一键部署至 Vercel
1. 将本仓库 Fork 或推送到你的 GitHub 账号下。
2. 登录 [Vercel](https://vercel.com/)，点击 **Add New... -> Project**，导入你的 `Flow` 仓库。
3. **Framework Preset** 选择 `Vite`，Build Command 保持 `npm run build`，Output Directory 保持 `dist`（Vercel 会自动识别根目录下的 [`vercel.json`](./vercel.json)）。
4. 在 **Environment Variables** 中添加环境变量（参考 [`.env.example`](./.env.example)）：
   ```env
   DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   # 可选：校验数据库服务器证书（证书在 Supabase 的 Database Settings -> SSL Configuration 下载）
   # FLOW_PG_SSL_CA=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
   ```
   未设置 `FLOW_PG_SSL_CA` 时连接仍会加密，但不校验服务器证书，启动日志中会给出提示。
5. 点击 **Deploy** 完成部署，然后尽快访问站点完成「初始化超级管理员」（初始化完成前，任何能访问该地址的人都可以抢先注册管理员）。之后可通过顶部导航栏的「JSON 导出 / 导入」（仅超级管理员可见），在本地 SQLite 版本与云端版本之间迁移任务、项目与人员数据。

---

## 环境变量

| 变量 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `PORT` | `3001` | 服务监听端口 |
| `HOST` | `0.0.0.0` | 服务监听地址 |
| `FLOW_DB_PATH` | `./data/flow.sqlite` | SQLite 数据库文件路径（未设置 `DATABASE_URL` 时使用） |
| `DATABASE_URL` | 未设置 | PostgreSQL / Supabase 连接串，设置后改用 PostgreSQL。本机地址默认不启用 SSL，其他地址默认启用，可通过 `?sslmode=disable` 关闭 |
| `FLOW_PG_SSL_CA` | 未设置 | 数据库服务器的 CA 证书（PEM，可用 `\n` 表示换行），设置后校验服务器证书 |
| `FLOW_PG_POOL_MAX` | `3` | 每个服务实例的 PostgreSQL 连接池大小 |
| `FLOW_SESSION_TTL_DAYS` | `30` | 登录会话有效天数 |
| `FLOW_CORS_ORIGIN` | 未设置 | 允许跨域调用 API 的来源（逗号分隔）。默认不开启 CORS：开发时由 Vite 代理 `/api`，生产环境同源访问 |

---

## 开发与自动化测试

```bash
# 运行后端数据库、权限、日期算法、过滤器与 AI 助理全套测试（需要 Node.js v22.18+，测试会直接导入 .ts 源文件）
npm test

# 使用 PostgreSQL 运行同一套测试：需要有 CREATE DATABASE 权限的账号（PostgreSQL 13+），
# 每个用例会新建一个 flow_test_* 临时库并在结束后删除
FLOW_TEST_DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/postgres npm test

# TypeScript 类型检查与生产包构建
npm run build
```

---

## 开源协议

本项目基于 **[GNU General Public License v3.0 (GPL-3.0)](./LICENSE)** 开源，欢迎自由使用、修改与提交 Pull Request。
