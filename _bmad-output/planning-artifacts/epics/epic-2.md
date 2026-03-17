## Epic 2: 知识仓库获取与认证

用户可以通过 `aiforge init` 配置认证，从私有 Git 仓库克隆知识内容。认证失败时获得友好的三段式修复建议。

### Story 2.1: 配置管理服务

As a 用户,
I want 系统持久化我的配置和认证信息,
So that 不需要每次运行都重新输入仓库地址和认证方式。

**Acceptance Criteria:**

**Given** `services/config.ts` 已创建
**When** 首次写入配置
**Then** 创建 `~/.aiforge/config.json`，文件权限为 `0o600`（NFR-S4）
**And** 目录 `~/.aiforge/` 不存在时自动创建

**Given** 配置文件已存在
**When** 读取配置
**Then** 正确解析 `AiforgeConfig` 结构：`defaultRepo`、`cloneDir`、`language`、`preferSSH`、`auth`（FR-040）

**Given** 用户配置了多个 Git host 的认证
**When** 读取特定 host 的认证信息
**Then** 返回该 host 对应的 `method` 和 `token`（FR-042）
**And** 不同 host 可以使用不同的认证方式

**Given** 配置文件损坏（非法 JSON）
**When** 读取配置
**Then** 抛出 `AiforgeError`，提示配置文件损坏并建议运行 `aiforge init` 重新配置

**Given** 配置文件不存在
**When** 用户运行主命令（非 init）
**Then** 提示用户先运行 `aiforge init` 完成配置（FR-041）

### Story 2.2: 知识源解析与 Git 服务封装

As a 用户,
I want 通过 Git URL 或默认配置指定知识仓库,
So that 系统知道从哪里获取 AI 编码配置内容。

**Acceptance Criteria:**

**Given** 用户提供了 Git 仓库 URL（如 `https://gitlab.com/org/repo.git`）
**When** 执行知识源解析
**Then** 正确解析出 hostname、仓库路径、协议类型（HTTPS/SSH）
**And** 返回 `ResolvedSource` 对象（FR-001）

**Given** 用户未提供 URL 但 `config.json` 中有 `defaultRepo`
**When** 执行知识源解析
**Then** 使用配置服务读取 `config.json` 中的默认仓库地址（FR-002）

**Given** 用户未提供 URL 且无默认配置
**When** 执行知识源解析
**Then** 抛出 `AiforgeError`（code: 'NO_REPO'，severity: 'fatal'），提示用户提供 URL 或运行 `aiforge init`

**Given** `services/git.ts` 已创建
**When** 检查 GitSourceResolver
**Then** 实现 `SourceResolver` 接口（`canHandle()`、`resolve()`）
**And** 对 simple-git 进行薄封装，隔离外部依赖

**Given** SSH 格式 URL（如 `git@gitlab.com:org/repo.git`）
**When** 执行知识源解析
**Then** 正确识别为 SSH 协议（NFR-I1）

### Story 2.3: 四层认证解析链

As a 用户,
I want 系统自动选择最合适的认证方式,
So that 无论在开发环境、CI 还是新电脑上都能顺利访问私有仓库。

**Acceptance Criteria:**

**Given** 用户通过 `--ssh` CLI 参数指定 SSH
**When** 执行认证解析
**Then** 使用 SSH Key 认证，忽略其他认证源（FR-006，优先级最高）

**Given** 用户通过 `--token <token>` CLI 参数提供 Token
**When** 执行认证解析
**Then** 使用提供的 Token 认证（FR-007，优先级最高）

**Given** 环境变量 `AIFORGE_TOKEN` 或 `GITLAB_TOKEN` 已设置
**When** 执行认证解析且无 CLI 参数
**Then** 使用环境变量中的 Token（FR-008，优先级第二）

**Given** 通过配置服务读取 `config.json` 中有对应 host 的认证配置
**When** 执行认证解析且无 CLI 参数和环境变量
**Then** 使用配置文件中的认证方式（FR-010，优先级第三）

**Given** 无任何显式认证配置
**When** 执行认证解析
**Then** 降级到系统 Git 凭据管理器（FR-009，优先级最低）

**Given** 认证过程中涉及 Token
**When** Token 出现在日志或错误输出中
**Then** 显示为脱敏格式 `glpat-ab****op`（FR-012，NFR-S3）

### Story 2.4: Git 克隆与增量更新

As a 用户,
I want 快速获取知识仓库内容到本地,
So that 首次克隆高效，后续更新只拉取变更。

**Acceptance Criteria:**

**Given** 本地无该仓库的副本
**When** 执行克隆
**Then** 使用浅克隆（`--depth 1`）最小化网络传输（FR-003）
**And** 克隆到持久化位置 `~/.aiforge/repos/{repo-name}/`（FR-005）

**Given** 本地已有该仓库的副本
**When** 执行获取
**Then** 执行 `git pull` 增量更新，而非全量重新克隆（FR-004）

**Given** 用户通过 `--clone-dir <path>` 指定自定义路径
**When** 执行克隆
**Then** 克隆到用户指定的路径

**Given** 克隆过程中网络中断
**When** 克隆失败
**Then** 清理不完整的克隆目录，不留残余文件（NFR-R1）
**And** 抛出 `AiforgeError`（severity: 'fatal'），包含网络错误的修复建议

**Given** Token 被注入到克隆 URL 中
**When** 克隆完成
**Then** Token 从内存中立即清除（NFR-S2）
**And** `.git/config` 中不包含 Token

**Given** 首次克隆 aicoding-base 规模的仓库
**When** 测量总耗时
**Then** < 30 秒（NFR-P1）

**Given** 已有本地仓库执行增量更新
**When** 测量总耗时
**Then** < 15 秒（NFR-P2）

### Story 2.5: aiforge init 交互式配置

As a 新用户,
I want 通过交互式引导完成首次配置,
So that 不需要手动编辑配置文件就能开始使用。

**Acceptance Criteria:**

**Given** 用户运行 `aiforge init`
**When** 交互式引导开始
**Then** 依次询问：默认仓库 URL、认证方式（SSH/Token）、连接验证（FR-033）

**Given** 用户选择 SSH 认证
**When** 执行连接验证
**Then** 尝试 SSH 连接到 Git 服务器
**And** 成功时显示确认信息
**And** 失败时显示三段式错误提示：什么坏了 → 为什么 → 怎么修（含 SSH Key 生成步骤和具体命令）（FR-011）

**Given** 用户选择 Token 认证
**When** 输入 Token 后执行连接验证
**Then** 验证 Token 有效性
**And** Token 存储到 `config.json` 的 `auth[host]` 中（按 host 分层）

**Given** 用户已有 `config.json`
**When** 再次运行 `aiforge init`
**Then** 显示当前配置，允许修改或保持不变

**Given** 非 TTY 环境
**When** 运行 `aiforge init`
**Then** 直接失败并提示需要交互式终端

---
