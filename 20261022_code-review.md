# Flow 代码审查报告

- 日期：2026-10-22
- 分支：`claude/magical-brahmagupta-stcmc4`
- 范围：`server/`、`api/`、`src/`、`tests/`、`Dockerfile` / `docker-compose.yml` / `vercel.json`、启动脚本、README

## 结论

最严重的问题是权限只在前端生效：服务端几乎所有 API 都不校验登录和权限，而服务默认监听 `0.0.0.0`、CORS 为 `*`，能访问端口的任何人都可以创建管理员、清空工作区、读取 AI API Key。其次：
- 导入接口出错时会把工作区删掉一半。
- 任务编号在删除任务后会重复。
- README 宣称支持 Vercel + Supabase，但代码中没有任何 PostgreSQL 实现，Vercel 实际把数据写在会随冷启动清空的 `/tmp`。

处理情况：
- 已修复：全部严重（C）、高（H）、中（M）级问题，以及大部分低（L）级问题。
- 未实施：剩余问题与优化建议，见第 4 节。

## 1. 提交

| 提交 | 内容 |
| --- | --- |
| `8e276d8` | 存储访问改为异步适配层（行为不变），为 PostgreSQL 做准备 |
| `2b2abc1` | 服务端鉴权与 RBAC、会话加固、AI 接口加固、评论与群聊身份取自会话 |
| `85a0244` | 事务、输入校验、任务编号唯一、REST 与 AI 共用级联删除 |
| `fb53139` | 前端缺陷 |
| `47eac17` | PostgreSQL / Supabase 存储（`DATABASE_URL`） |
| `a69ccc6` | README、`.env.example`、`start.bat` |

## 2. 验证

- **SQLite 测试**：`npm test`，24 通过，1 跳过（跳过的是只在 PostgreSQL 下运行的 RLS 用例）。
- **PostgreSQL 测试**：`FLOW_TEST_DATABASE_URL=… npm test`，在本地 PostgreSQL 16 上 25 个全部通过。
- **构建**：`npm run build`（`tsc -b && vite build`）通过。
- **变异测试**：分别做了以下四处改动，对应测试均会失败。其中去掉 advisory lock 后，PostgreSQL 下的并发用例出现了重复编号。
  - 去掉 401 校验。
  - 放宽 `requirePerm`。
  - 去掉改密码后的会话吊销。
  - 去掉 PostgreSQL advisory lock。
- **复现脚本**（修复前后对比）：
  - 修复前：未登录 `POST /api/users {role:"admin"}` 返回 201，`GET /api/ai/settings` 返回明文 Key。
  - 修复后：两者均返回 401。
- **浏览器验证**（Playwright + Chromium，修复前后对比）：
  - 切换语言触发的鉴权请求：1 次 → 0 次。
  - 从通知打开群聊后点击「频道二」：修复前跳回「频道一」，修复后停留在「频道二」。
  - 番茄钟：修复前 10.5 秒只走了 8 秒，修复后 10 秒走 10 秒。
  - 成员账号：看不到导入、清空和 AI 接口配置，任务详情只读。
  - 其他交互：删除任务前弹出确认；输入法组字时按回车不发送；CSV 导出正确转义。
- **依赖审计**：
  - `npm audit --omit=dev`（生产依赖）：0 个漏洞。
  - 完整 `npm audit`：9 个（3 moderate、6 high），全部来自开发与构建工具链（vite 5、tailwindcss 3 及其间接依赖），不进入生产运行时，见建议 8。
- **未验证**：没有在真实的 Vercel / Supabase 环境部署，PostgreSQL 路径只在本地 PostgreSQL 16 上测试过。

## 3. 发现与处理

状态分为四种：已修复（附提交）、部分修复、仅文档说明、未修复（建议见第 4 节）。表中「位置」均指审查时的代码位置。

### 严重

#### C1 服务端没有鉴权和授权（已修复，`2b2abc1`）
- **位置**：`server/app.mjs`。只有 bootstrap 和 chat-groups 两处读取了登录用户；users、tasks、subtasks、projects、members、`seed/reset`、`import` 和 AI 路由都不做校验。
- **影响**：
  - 未登录即可 `POST /api/users {role:"admin"}` 创建管理员、修改任意账号的密码、清空工作区。
  - 原有测试不带 token 调用这些接口并断言返回 201，等于把这个行为固化了。
- **修复**：
  - `/api` 统一鉴权，只放行 `GET /auth/status` 与 `POST /auth/setup|login|logout`，其余未登录请求返回 401。
  - 按路由检查权限（`requirePerm` / `requireAdmin`），不可见的资源返回 404。
  - 管理员角色和账号管理权限只有超级管理员能授予；非超级管理员不能修改或删除管理员账号。
  - 任何人都不能修改自己的角色，非超级管理员也不能修改自己的权限。
  - 角色取值在服务端校验。
- **测试**：`tests/auth.test.mjs`，覆盖匿名访问、角色权限和提权。

#### C2 未登录时反而能看到全部项目（已修复，`2b2abc1`）
- **位置**：`server/app.mjs` 中可见项目的计算写成 `user ? 可见项目 : 'all'`，bootstrap、chat-groups、AI 三处都是如此。
- **修复**：未登录请求先被 C1 的中间件以 401 拦下；可见范围只按登录用户计算。

#### C3 AI API Key 明文泄露（已修复，`2b2abc1`）
- **位置**：`getAiSettings` 使用 `SELECT *`，`GET /api/ai/settings` 不鉴权；前端设置页对所有角色开放，还能点「显示」查看密钥。
- **修复**：
  - 读取接口需要登录，且只返回 `has_api_key` 和脱敏后的 `api_key_masked`。
  - 修改设置仅管理员可用，设置页也只对管理员显示。
  - Key 输入框留空表示不修改，另设「清除密钥」按钮。

### 高

#### H1 SSRF 与密钥外带（已修复，`2b2abc1`）
- **位置**：`POST /api/ai/models` 的 `base_url` 取自请求体，`api_key` 为空时却回退为已保存的 Key。
- **影响**：传入攻击者控制的地址，服务端就会带着真实 Key 去请求。
- **修复**：
  - 该接口仅管理员可用。
  - 只有 `base_url` 与已保存地址一致时才使用已保存的 Key。
- **测试**：`tests/ai.test.mjs`「stored API key is only sent to the endpoint it was saved for」。

#### H2 评论与群聊可冒充他人（已修复，`2b2abc1`）
- **位置**：
  - 评论信任请求体中的 `member_id`。
  - 群聊消息优先使用请求体中的 `sender_member_id`。
  - 前端提供「以 X 身份」下拉框。
- **修复**：
  - 发送者一律取自当前会话；前端移除身份下拉框。
  - 未绑定成员的账号以 `activities.actor_name` 显示操作者。
- **测试**：`tests/auth.test.mjs`「comments and chat messages are attributed to the signed-in user」。

#### H3 AI 绕过 RBAC 并泄露数据（已修复，`2b2abc1`；删除二次确认属于建议）
- **位置**：
  - `executeAiActions` 不校验权限。
  - 系统提示词包含全部项目和任务。
  - AI 对话历史全局共享。
- **修复**：
  - 每个动作按当前用户的权限检查，越权的动作跳过，并在回复中列出「以下操作未执行」。
  - 提示词只包含该用户可见的项目和任务。
  - 对话历史按用户隔离；旧数据（无 `user_id`）只对管理员可见。
- **剩余**：删除类动作仍可在用户自身权限内直接执行，没有二次确认，见建议 5。
- **测试**：`tests/ai.test.mjs`「AI actions run with the requesting user's permissions…」。

#### H4 群聊越权（已修复，`2b2abc1`）
- **位置**：读取消息不校验项目可见性；任何人都能删除任意群聊和任意消息。
- **修复**：
  - 读取消息前校验项目可见性。
  - 群聊的修改和删除仅限创建者或拥有成员管理权限的用户。
  - 删除消息仅限发送者本人或拥有成员管理权限的用户。
- **剩余**：群成员名单 `member_ids` 不参与访问控制，见建议 7。

#### H5 导入失败会丢数据（已修复，`85a0244`）
- **位置**：`/api/import` 先 `DELETE` 全部数据再逐条插入，既无事务也无校验。
- **影响**：备份中任意一行有问题，工作区就只剩一半。
- **修复**：先完整校验备份（必填字段、ID 唯一、引用关系、颜色格式），再在一个事务里清空并写入；校验失败返回 400，原数据不变。
- **测试**：`tests/integrity.test.mjs`「import validates the backup first…」。

#### H6 Vercel + Supabase 只存在于文档（已修复，`47eac17`、`a69ccc6`）
- **位置**：代码中没有任何 PostgreSQL 实现，Vercel 实际使用 `/tmp/flow.sqlite`（`api/index.mjs`）。`supabase/schema.sql` 也没有启用 RLS。
- **影响**：每次冷启动数据清空，并重新开放「初始化超级管理员」页面。
- **修复**：
  - **PostgreSQL 存储**：新增 PostgreSQL 存储层，设置 `DATABASE_URL` 即启用。
    - 启动时在 advisory lock 下幂等地建表和迁移。
    - 11 张表全部启用 RLS，防止 Supabase Data API 用 anon key 读取用户、会话和 AI 配置。
    - 支持通过 `FLOW_PG_SSL_CA` 校验证书。
  - **Vercel 保护**：在 Vercel 上未设置 `DATABASE_URL` 时，`/api` 返回 503。
  - **文档**：README 按实际实现重写，只需 `DATABASE_URL`（transaction pooler）。
- **测试**：
  - `tests/schema.test.mjs`：`supabase/schema.sql` 与启动时执行的 SQL 一致；RLS 已开启；重复初始化幂等。
  - 整套测试可通过 `FLOW_TEST_DATABASE_URL` 在 PostgreSQL 上运行。

### 中

#### M1 任务编号重复（已复现，已修复，`85a0244`）
- **位置**：编号按 `101 + COUNT(*)` 计算（`app.mjs`、`aiService.mjs` 各一份）。
- **影响**：删除一个任务后会再次生成已存在的编号，之后 AI 执行 `delete_task` 删掉的是旧任务。
- **修复**：新增共用的 `nextTaskKey`，取同前缀编号中最大的数字后缀加 1；PostgreSQL 下先取 advisory lock，防止并发撞号。
- **测试**：`tests/integrity.test.mjs`，覆盖删除后编号、不同项目共用前缀、20 个并发创建。

#### M2 AI 的 `update_task` 写入非法值（已复现，已修复，`85a0244`）
- **位置**：`server/aiService.mjs`。
- **影响**：
  - status / priority 不校验，实测写入了 `completed`、`紧急`，这些任务会从状态看板中消失。
  - 提示词让模型用 `title` 改名，代码读的却是 `new_title`。
  - `estimate_hours` 被忽略。
- **修复**：
  - 非法字段一律忽略。
  - 提示词改为说明 `new_title`。
  - 支持 `estimate_hours`。
  - 名称匹配优先精确匹配，模糊匹配只在结果唯一时采用。

#### M3 没有项目时 AI 报错（已复现，已修复，`2b2abc1`、`85a0244`）
- **位置**：`findOrCreateProjectByName` 返回 `undefined`，随后访问 `proj.id` 抛出 TypeError，接口返回 500，而此前已执行的动作不会回滚。
- **修复**：
  - 有建项目权限时自动创建「默认工作项目」，没有权限时跳过并在回复中说明。
  - 同一轮的全部动作放在一个事务里执行。

#### M4 REST 缺少输入校验（已修复，`85a0244`、`fb53139`）
- **位置**：任务、项目接口。
- **影响**：
  - `collaborator_ids: null` 会被存成字符串 `"null"`，前端随后崩溃。
  - 非法 priority 会让 `AnalyticsView` 抛错，由于没有 ErrorBoundary，整页白屏。
- **修复**：
  - 服务端校验 status / priority 枚举、`YYYY-MM-DD` 日期、字符串数组、非负数和 `#RRGGBB` 颜色，非法值返回 400。
  - `AnalyticsView` 遇到未知优先级时回退到默认配置。
- **剩余**：ErrorBoundary 仍未添加，见建议 18。
- **测试**：`tests/integrity.test.mjs`「task, project and chat input is validated」。

#### M5 活动审计记错人（已修复，`2b2abc1`、`85a0244`）
- **位置**：活动的 `member_id` 记录的是任务负责人，而不是实际操作者。
- **修复**：记录当前登录用户（绑定的成员和 `actor_name`）。

#### M6 会话安全薄弱（已修复，`2b2abc1`；局限见建议 2、3）
- **影响**：
  - 会话永不过期，改密码后旧 token 依然有效。
  - 登录不限速。
  - 用户名不存在时跳过 scrypt，可借响应时间枚举用户名。
- **修复**：
  - 会话默认 30 天过期，可用 `FLOW_SESSION_TTL_DAYS` 配置。
  - 改密码后吊销该用户的其他会话。
  - 同一 IP 加同一用户名在 15 分钟内失败 10 次后返回 429。
  - 用户名不存在时也计算一次哈希。
  - CORS 只在设置了 `FLOW_CORS_ORIGIN` 时启用。
- **测试**：`tests/auth.test.mjs`，覆盖改密码、限速和会话过期。

#### M7 切换语言导致全页重新鉴权（已修复，`fb53139`）
- **位置**：`loadBootstrap` 依赖 `tr`，而鉴权 effect 又依赖 `loadBootstrap`（`App.tsx`）。
- **修复**：鉴权 effect 只在挂载时运行，通过 ref 调用 `loadBootstrap`。

#### M8 番茄钟走慢或停走（已修复，`fb53139`）
- **位置**：`onLogMinutes` 是内联函数，App 每次重渲染都会重建 interval；群聊每 3.5 秒轮询一次，必然触发重渲染。计时基于 tick 计数，后台标签页被节流后误差更大。
- **修复**：根据结束时间戳计算剩余时间，回调存入 ref。

#### M9 中文输入法回车误发（已修复，`fb53139`）
- **位置**：`AIAssistantDrawer.tsx`。
- **修复**：组字状态下（`isComposing` 或 `keyCode === 229`）按回车不发送。

#### M10 群聊抽屉无法切换频道（已修复，`fb53139`）
- **位置**：`ProjectChatDrawer.tsx` 中选择初始频道的 effect 依赖 `activeGroupId`，从通知打开后点击其他频道会立即跳回原频道。
- **修复**：初始频道只在抽屉打开或初始频道变化时设置。

#### M11 前端权限控制不一致（已修复，`fb53139`；服务端由 C1 兜底）
- **位置**：
  - 导入、清空按钮对所有人可见。
  - `canEditTask` 只控制子任务。
  - 弹窗中的删除按钮、命令面板、拖拽和置顶都不检查权限。
- **修复**：
  - 导入、清空仅管理员可见。
  - 没有 `can_edit_task` 时，任务详情中的字段、协作人、标签和子任务都只读（评论不受影响）。
  - 删除按钮、命令面板「新建」、拖拽更新、置顶按钮均按权限控制。

#### M12 删除任务无确认（已修复，`fb53139`）
- **位置**：`TaskDetailDrawer.tsx`。
- **修复**：删除前弹出确认框。

#### M13 Node 版本说明错误（已修复，`a69ccc6`）
- **位置**：README 写 v22.5+。实际上 `node:sqlite` 需要 ≥22.13，测试直接导入 `.ts` 需要 ≥22.18。
- **修复**：更新 README 与徽章。服务端已不再导入 `src/` 下的 `.ts` 文件（见 M14），运行时只要求 ≥22.13。

#### M14 AI 的「今天」按服务器时区计算（已修复，`85a0244`）
- **位置**：Docker / Vercel 默认使用 UTC。北京时间 0–8 点之间，AI 把「明天」解析成的日期会差一天。
- **修复**：
  - 前端随请求发送 `client_today`，服务端校验后使用，未提供时退回服务器日期。
  - 服务端因此不再导入 `src/utils/dateUtils.ts`，Dockerfile 中两行 `COPY src/...` 已删除。

### 低

#### L1 退出登录后 token 仍留在 localStorage（已修复，`2b2abc1`）
- **修复**：在 `finally` 中清除 token。任何 401 响应也会清除 token 并回到登录页。

#### L2 CSV 导出可被注入（已修复，`fb53139`）
- **影响**：名称中的引号和逗号未转义；以 `= + - @` 开头的内容会被表格软件当作公式执行。
- **修复**：新增 `csvCell` 统一转义，并在公式前缀前加 `'`。

#### L3 编辑账号时的密码与用户名问题（已修复，`2b2abc1`）
- **影响**：
  - 少于 4 位的新密码被静默忽略。
  - 编辑时会 trim 密码，登录时不会，两边不一致。
  - 重复用户名返回 500。
- **修复**：
  - 密码过短返回 400。
  - 不再 trim 密码。
  - 重复用户名返回 400 和明确提示。

#### L4 群聊消息竞态（部分修复，`fb53139`）
- **已修复**：
  - 切换频道后，旧频道的请求结果不再覆盖新频道。
  - 发送按钮在请求期间加锁，防止重复提交。
- **未修复**：删除最新一条消息后，上一条消息会被当作新消息再次弹出通知，见建议 9。

#### L5 项目颜色可注入 CSS（已修复，`85a0244`）
- **位置**：颜色值被拼进 `style`，可以写入 `url(...)` 发起外部请求。
- **修复**：项目的新建、编辑、导入以及 AI 动作只接受 `#RRGGBB`。

#### L6 AI 请求没有超时（已修复，`2b2abc1`）
- **修复**：对话请求 90 秒超时，获取模型列表 15 秒超时。

#### L7 AI 与 REST 的级联删除不一致（已修复，`85a0244`）
- **修复**：删除成员和删除项目都改用共用的 `deleteMemberCascade` / `deleteProjectCascade`，会一并解绑账号、清理协作人和群聊成员。
- **测试**：`tests/integrity.test.mjs`、`tests/ai.test.mjs`。

#### L8 `start.bat` 的问题（部分修复，`a69ccc6`）
- **已修复**：中文被双重编码，显示为乱码（Git 历史中从未有过正确版本）。现已恢复为 UTF-8，其余内容按字节保持不变。
- **未修复**：脚本会强杀所有占用 3001 / 5173 端口的进程，见建议 21。

#### L9 其他（未修复，见建议）
- 首次初始化时，谁先访问谁就能注册为管理员（建议 1）。两个请求并发初始化、产生两个管理员的问题已用事务和锁修复（`2b2abc1`）。
- 500 错误直接回显内部异常信息（建议 6）。
- 新建表单可重复提交，失败后弹窗关闭、输入丢失（建议 10）。
- Docker 以 root 运行（建议 22）。

## 4. 未实施的建议

按优先级从高到低排列。

### 安全

1. **首次初始化可被抢注**：空库时任何能访问站点的人都可以完成初始化。
   - 建议支持 `FLOW_SETUP_TOKEN`，设置后初始化必须提供该令牌；或者只允许本机访问初始化接口。
   - README 已提示部署后立即完成初始化。
2. **登录限速的局限**：限速状态保存在进程内存中，按 `req.ip + 用户名` 计数。
   - 多实例部署（如 Vercel）时，每个实例各自计数。
   - 部署在 Nginx 等反向代理之后时，`req.ip` 是代理地址，攻击者连续输错 10 次就能让某个用户名 15 分钟内无法登录。
   - 建议：增加可配置的 `trust proxy`；把限速状态存入数据库；或者用逐步加长的延迟代替硬锁定。
3. **密码策略偏弱**：最短只要 4 位，建议提高到 8 位以上，并拦截常见弱密码。
4. **会话 token 明文存库**：数据库一旦泄露，攻击者可以直接冒用会话。建议只存储 token 的 SHA-256。
5. **AI 删除缺少二次确认**：AI 已按用户权限执行，但模型或会议纪要中的提示词注入仍可在用户权限范围内直接删除任务、项目和成员。
   - 建议删除类动作改为两阶段：先返回待确认的操作卡片，用户确认后再执行。
6. **500 错误回显内部异常**：`res.status(500).json({ error: err.message })` 可能暴露 SQL、表结构或主机名。
   - 建议记录日志、返回通用提示。数据库初始化失败时的 503 已经这样处理。
7. **群聊成员名单不参与访问控制**：可见性只按项目判断，跨项目频道对所有登录用户可见，`member_ids` 只用于展示。
   - 如果需要「仅群成员可见」，应在服务端按 `member_ids` 过滤。
8. **开发工具链存在已知漏洞**：完整 `npm audit` 报告 9 个漏洞（3 moderate、6 high）。
   - 涉及的包：
     - vite 5.4.21：开发服务器路径穿越；`server.fs.deny` 在 Windows 上可被绕过。
     - esbuild 0.21.5：任意网站都能向开发服务器发请求并读取响应（该问题针对 esbuild 自带的 serve 功能）。
     - tailwindcss 3 的间接依赖：braces、micromatch、postcss-selector-parser 存在拒绝服务问题。
   - 生产运行时不受影响（生产依赖 0 漏洞），但 `npm run dev` 以 `vite --host` 启动，开发服务器监听所有网卡。`start.bat` 走的正是这条路径，局域网内的其他设备也能访问这个受影响的开发服务器。
   - 建议：
     - 升级 vite 到已修复的版本（npm audit 建议 8.x），并同步升级 `@vitejs/plugin-react`。
     - 评估 tailwindcss 3 → 4 的大版本迁移。
     - 升级之前，先把 `--host` 改为按需开启。

### 正确性

9. **删除消息后误弹通知**：轮询只比较 `last_message_id`，删除最新消息后，上一条会被当作新消息弹出。
   - 建议改为比较消息时间，只在 `created_at` 晚于已读时间时提醒。
10. **新建表单可重复提交**：`CreateTaskModal` 在 `await onCreateTask()` 之后无条件 `onClose()`，而 `handleCreateTask` 会吞掉错误；提交期间按钮也不会禁用。
   - 建议让创建函数返回是否成功，失败时保留弹窗，并在提交期间禁用按钮。
11. **工时累加在前端计算**：番茄钟结束时，前端按 `logged_minutes + 分钟数` 写回，两个窗口同时结算会互相覆盖。
    - 建议增加服务端原子累加：`UPDATE … SET logged_minutes = logged_minutes + ?`。

### 性能与可维护性

12. **轮询引起整页重渲染**：群聊每 3.5 秒轮询一次，并且无条件调用 `setChatGroups`，即使数据没变也会让 App 和所有看板重渲染（这也是 M8 的诱因）。
    - 建议先比较再 `setState`，看板组件使用 `React.memo`，或改为增量拉取 / SSE。
13. **SQLite 缺少索引**：PostgreSQL 的表结构为 `tasks` 的 `project_id` / `status` / `due_date`，以及 `subtasks.task_id`、`activities.task_id`、`chat_group_messages.group_id` 建了索引，SQLite 一个都没有。数据量大时 bootstrap 和级联删除都会全表扫描。
    - 建议在 SQLite 中补上同样的索引。
14. **REST 与 AI 各有一套写入逻辑**：任务的增删改在 `app.mjs` 和 `aiService.mjs` 中各实现了一遍。M1、M2、L7 都源于两边不一致；本次只抽出了编号、校验和级联删除。
    - 建议继续收敛为共用的 service 层。
15. **`App.tsx` 过大**：1,462 行，状态、轮询、通知和权限判断混在一起。建议按领域拆分为 hooks，例如认证、数据加载、群聊通知。
16. **角色默认权限定义了两份**：`server/db.mjs` 的 `DEFAULT_ROLE_PERMISSIONS` 与 `AccountManagementModal.tsx` 的 `ROLE_META` 各有一份，容易不同步。
    - 建议由服务端下发，或放进前后端共享的模块。
17. **缺少安全响应头**：没有设置 CSP、`X-Content-Type-Options` 等。建议在生产环境使用 `helmet` 或手动设置。
18. **没有 ErrorBoundary**：任何渲染异常都会让整页白屏（M4 就是一例）。建议在顶层加一个 ErrorBoundary。
19. **缺少 CI 与静态检查**：仓库没有 CI、ESLint，也不做依赖审计。
    - 建议在 CI 中运行 `npm test`（SQLite 一次，再用 PostgreSQL 服务容器跑一次）、`npm run build`、ESLint 和 `npm audit`。

### 其他

20. **版本号不一致**：`AuthScreen.tsx` 显示 v0.1，`package.json` 与 README 为 0.2。
21. **`start.bat` 强杀端口进程**：任何占用 3001 / 5173 端口的进程都会被结束，包括与 Flow 无关的程序。
    - 建议只提示端口被占用，或者只结束由本脚本启动的进程。
22. **Docker 以 root 运行**：建议在镜像中加上 `USER node`，并确保 `/app/data` 对该用户可写。
