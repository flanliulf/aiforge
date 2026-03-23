# Epic 1 回顾 — 项目基础设施与核心框架（Foundation Sprint）

**回顾日期：** 2026-03-23
**Epic 状态：** done（5/5 story 完成）
**主持人：** Bob (Scrum Master)
**参与者：** Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev), chunxiao (Project Lead)

---

## Epic 总结

### 交付指标

| 指标 | 数值 |
|------|------|
| 完成 Story | 5/5 (100%) |
| 单元测试 | 206 个，全部通过 |
| 代码审查轮数 | 13 轮（跨 5 个 story） |
| CR 发现修复率 | 100% |
| 技术债务 | 0 项 |
| 阻塞问题 | 0 |
| 生产事故 | 0 |

### Story 完成明细

| Story | 名称 | Agent 模型 | CR 轮数 | 测试数量 |
|-------|------|-----------|---------|---------|
| 1.1 | 项目初始化与工具链配置 | claude-sonnet-4-6 | 1 | 25 |
| 1.2 | 核心类型定义与错误体系 | claude-sonnet-4-6 + opus (CR) | 1 | 81 |
| 1.3 | 输出抽象与路径解析 | claude-sonnet-4-6 | 4 | 37 (累计 124) |
| 1.4 | 数据层配置 | Claude Opus 4.6 | 2 | 54 (累计 178) |
| 1.5 | CLI 入口与管道骨架 | claude-opus-4.6 | 4 | 16 (累计 206) |

### 业务成果

- `npx aiforge --help` 可运行 ✅
- CLI 启动到首次输出 0.43s < 1s（NFR-P4 ✅）
- 管道骨架就绪，7 阶段占位完成
- 16 条安装规则 + 4 工具注册表就绪
- 安全基线建立（sanitizeToken/sanitizeUrl 修复）

---

## 成功与优势

1. **100% 完成率** — 5/5 story done，Foundation Sprint 无拖延
2. **安全审查有效** — CR 拦截了 sanitizeToken 12 字符边界泄漏和 sanitizeUrl 未覆盖 GitLab oauth2 格式的关键安全缺陷
3. **架构基础扎实** — 管道骨架、类型安全链、Reporter/PathResolver 接口设计合理，为 Epic 2~5 提供了稳固基础
4. **`import type` 零运行时依赖模式** — data/ 模块通过 `import type` + 字符串字面量断言解决了类型安全与零依赖的矛盾
5. **依赖注入设计** — `PipelineStages` 接口让管道阶段可独立测试、可替换
6. **测试文化建立** — 从 Story 1.1 就确立了 `src/` ↔ `tests/` 镜像结构，后续 story 自然延续

---

## 挑战与改进空间

1. **集成 Story CR 轮数过多** — Story 1.5 经历 4 轮 CR，问题密度最高（TTY 检测用错 stream、模块边界违规、Report 阶段类型缺失、parse() → parseAsync()）
2. **架构文档 ↔ 实现偏差** — 3 次出现：AiforgeConfig 字段 required vs optional、ExitCode 类型未收窄、AuthMethod 持久化语义未区分
3. **File List 文档更新滞后** — 3/5 story（1.1、1.2、1.5）的 File List 与 git status 不一致
4. **ESM 生态踩坑** — 贯穿 3/5 story（版本号读取、ora mock、parseAsync），每次都是"意外"
5. **AC 措辞歧义** — 1.5 的 "npx aiforge --help" 未区分源码路径 vs 交付物路径

---

## 关键洞察

1. **CR 是真正的质量门禁** — 13 轮审查拦截了安全缺陷、架构偏差、交付物一致性问题；没有 CR 的话 sanitizeToken 边界缺陷会直接上线
2. **ESM 生态需要持续积累** — 不是"一次搞定"的事，每个 story 都可能遇到新的 ESM 特殊处理
3. **集成阶段的验收需要对齐"交付物"而非"源码"** — dist/ 目录的行为才是用户看到的
4. **架构文档是权威** — 实现与架构文档冲突时，以架构文档为准（已在 project-context.md 中记录）

---

## Story 深度分析：审查模式汇总

### 高优先级审查发现

| Story | 发现 | 影响 | 修复 |
|-------|------|------|------|
| 1.2 | sanitizeToken 12 字符边界泄漏（`>=` → `>`） | 安全 — 完整 token 可被逆推 | 修改比较运算符 |
| 1.2 | sanitizeUrl 未覆盖 GitLab oauth2:token@host 格式 | 安全 — token 泄漏到日志 | 扩展正则表达式 |
| 1.5 | `node dist/index.js --help` 输出不完整 | 功能 — 交付物不可用 | 修复构建 + 验证 |
| 1.5 | Report 未作为独立阶段类型签名纳入 | 架构 — 与设计不一致 | 添加 ReportFn 类型 |

### 中优先级审查发现

| 模式 | 频率 | 涉及 Story |
|------|------|-----------|
| 架构文档与实现偏差（类型/字段） | 3 次 | 1.2, 1.5 |
| File List 与 git status 不一致 | 3/5 story | 1.1, 1.2, 1.5 |
| ESM 特殊处理 | 3/5 story | 1.1, 1.3, 1.5 |
| TTY 检测 stream 选择错误 | 1 次 | 1.5 |
| 模块边界违规（index.ts → core/） | 1 次 | 1.5 |

---

## 行动项

### 流程改进

| # | 行动项 | Owner | 成功标准 | 截止时间 |
|---|--------|-------|---------|---------|
| 1 | 建立 ESM Know-How 文档，汇总 Epic 1 中的 ESM 陷阱到 project-context.md | Charlie (Senior Dev) | Epic 2 开发者不再重复踩坑 | Epic 2 开始前 |
| 2 | CR 前执行交付物验证（npm run build + dist/ 行为） | Bob (Scrum Master) | CR Round 1 不再出现"源码通过但 dist/ 不工作" | 立即生效 |
| 3 | File List 实时同步（每个 Task 完成后更新） | Amelia (Dev Agent) | 0 个 story 的 File List 与 git status 不一致 | 立即生效 |
| 4 | AC 措辞精确化（区分源码路径 vs 交付物路径） | Bob (Scrum Master) | CR 不再因 AC 歧义产生争议 | 立即生效 |

### 团队约定

- ESM 项目中，所有 mock 优先使用 `vi.mock()` 顶层模拟，避免 `vi.spyOn` 在 ESM 模块绑定上失败
- 架构文档是权威——实现中发现类型/字段与架构文档不一致时，以架构文档为准
- 集成 Story 的 CR 需要额外关注——跨模块交互是审查重点

---

## Epic 2 准备

### 技术准备

| # | 任务 | Owner | 优先级 |
|---|------|-------|--------|
| 1 | 验证 simple-git ESM 导入和 mock 模式 | Charlie | 关键路径 |
| 2 | 建立文件系统 fixture 测试工具（临时目录创建/清理） | Dana | 重要 |
| 3 | 确认 0o600 文件权限在 CI 环境的测试策略 | Dana | 重要 |

### 知识准备

| # | 任务 | Owner | 优先级 |
|---|------|-------|--------|
| 1 | Git 协议（SSH/HTTPS）和 Token 注入 URL 技术 brief | Charlie | 重要 |

### 关键路径

**开始 Epic 2 之前必须完成：**

1. ✅ ESM Know-How 文档写入 project-context.md — Owner: Charlie
2. ✅ 验证 simple-git ESM mock 可行性 — Owner: Charlie

---

## 重大发现评估

**是否需要更新 Epic 2 规划？否**

Epic 1 的架构决策（管道式、类型安全链、Reporter/PathResolver 抽象）在实现中全部验证通过，没有需要推翻的设计。Epic 2 的计划依然有效。

---

## 就绪评估

| 维度 | 状态 | 说明 |
|------|------|------|
| 测试 & 质量 | ✅ 良好 | 206 测试零回归，13 轮 CR 全部修复 |
| 部署 | ✅ N/A | Foundation Sprint，无需部署 |
| 技术健康 | ✅ 稳固 | 管道骨架、类型体系、接口设计合理 |
| 未解决阻塞 | ✅ 无 | 所有 CR 发现已修复 |
| 技术债务 | ✅ 零 | 无快捷方式，无已知遗留问题 |

---

## 下一步

1. 完成 2 项关键路径准备（ESM 文档 + simple-git mock 验证）
2. 在下次 standup 中审查行动项进度
3. 开始 Epic 2 story 开发（story 已 ready-for-dev）
4. Epic 2 首个 story 创建时自动将 epic-2 状态从 backlog → in-progress

---

**团队表现：** Epic 1 交付了 5 个 story，累计 206 个单元测试，经历 13 轮代码审查全部修复通过。团队在安全审查、架构合规、ESM 生态处理方面积累了宝贵经验。为 Epic 2 奠定了坚实的技术基础。
