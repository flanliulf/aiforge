# Epic 2 Story 审查总结

## 审查范围

- Epic 2 全部 5 个 story：
  - `2-1-config-management-service.md`
  - `2-2-source-resolver-and-git-service.md`
  - `2-3-four-layer-auth-chain.md`
  - `2-4-git-clone-and-incremental-update.md`
  - `2-5-aiforge-init-interactive-setup.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-2.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`
  - `_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-17.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
  - Epic 1 相关 story（特别是 1.2 / 1.3 / 1.5）

## 审查维度

- Story 结构是否完整
- Acceptance Criteria 是否清晰、可测试、可实施
- 依赖关系是否正确、是否存在职责漂移或重复实现
- 与认证、安全、输出、路径、配置等架构约束是否一致
- 是否足以作为开发代理的直接实施依据

## 总体结论

Epic 2 的 5 个 story 整体结构完整、用户价值清晰，依赖链也基本自然，能够支撑“从私有 Git 仓库获取知识内容并完成首次配置”的目标。

结论分级如下：

- 通过：1 个
- 有条件通过：4 个
- 硬阻塞：0 个

总体判断：**Epic 2 可以进入开发准备阶段，但建议先修正认证格式、类型定义、init 命令边界这 3 类关键问题，否则实现阶段容易出现返工或跨 story 偏差。**

## 逐篇审查结论

### Story 2.1: 配置管理服务

**结论：有条件通过**

**优点**

- 结构完整，包含 Story、AC、Tasks、Dev Notes、References。
- 对 config.json 的权限、原子写入、按 host 分层认证等要求写得较明确。
- 与 `project-context.md` 的 `0o600`、camelCase、原子写入要求基本一致。

**关键问题**

1. `HostAuth` 在任务中被直接使用，但在已知类型定义中未看到明确出处。
   - `Task 1.3` 写的是 `getHostAuth(...): HostAuth | undefined`
   - Story 1.2 的核心类型列表中没有显式定义 `HostAuth`
   - 这会让开发者在实现时临时发明类型，削弱类型契约一致性

2. AC #5 的行为边界与本 Story 的职责不完全一致。
   - AC #5 说“用户运行主命令（非 init）时提示先运行 `aiforge init`”
   - 但本 Story 的任务仅实现 `services/config.ts`
   - 真正负责“提示用户”的应该是 CLI / pipeline 调用方，而不是配置服务本身

**建议动作**

- 明确 `HostAuth` 是否应加入 `core/types.ts`，或直接改为内联返回类型。
- 将 AC #5 改写为“配置服务在文件不存在时抛出 `CONFIG_NOT_FOUND`，由调用方负责提示”，以消除职责漂移。

### Story 2.2: 知识源解析与 Git 服务封装

**结论：通过**

**优点**

- Story 范围清晰：Resolve 阶段 + Git URL 封装，边界干净。
- URL 解析规则明确，HTTPS/SSH 两类输入都给出了目标结构。
- 与 `SourceResolver` 抽象、管道第一阶段职责、模块边界要求一致。
- 依赖顺序合理：2.1 提供配置回退，2.2 输出 `ResolvedSource` 供 2.3 使用。

**可优化点**

- 可以补一个“非法 URL / 不支持格式”的明确错误示例，让异常路径更自包含。

### Story 2.3: 四层认证解析链

**结论：有条件通过**

**优点**

- 优先级链主干清楚：CLI > 环境变量 > config > 系统凭据。
- 与 Epic 2 的认证主题直接对齐。
- Token 脱敏、安全清理责任划分也已写出。

**关键问题**

1. **Token 注入 URL 格式与现有架构材料不一致。**
   - 当前 story 写法：`https://${token}@${hostname}/${repoPath}.git`
   - 现有架构/草案材料多处给出的模式是：`https://oauth2:TOKEN@host/path.git`
   - 这会直接影响 GitLab Token 认证是否可用，属于实现级高风险歧义

2. **`--ssh` 与 `--token` 同时传入时的冲突行为未定义。**
   - 当前文档只说二者都属于“最高优先级”
   - 但没有定义互斥校验、报错方式或谁覆盖谁
   - 开发者可能各自做出不同处理

3. **Token 脱敏示例仍与项目上下文不一致。**
   - 当前 story 示例仍为 `glpat-ab****op`
   - `project-context.md` 和 Story 1.2 已明确为“前 8 + `****` + 后 4”

**建议动作**

- 统一 Token URL 构造格式，并在 AC 与 Dev Notes 中只保留一种写法。
- 明确 `--ssh` 与 `--token` 互斥：推荐直接抛 `AiforgeError(code: 'ARG_CONFLICT')`。
- 将所有脱敏示例统一到当前项目规则。

### Story 2.4: Git 克隆与增量更新

**结论：有条件通过**

**优点**

- 首次浅克隆、已有仓库 pull、失败清理、Token 清理、源文件扫描都已覆盖。
- 与 Epic 2 的 FR-003~005、NFR-S2、NFR-R1 对齐较好。
- “克隆后恢复无 Token remote URL”的安全要求写得清楚。

**关注点**

1. **“Token 从内存中立即清除”的验收口径不够可验证。**
   - Story 里给了“将 `source.cloneUrl` 置空”之类的实现暗示
   - 但这既不是稳定的类型契约，也很难在 JS 运行时证明“立即清除”
   - 更适合表述为“克隆完成后不再保留可访问的 token-bearing URL 引用，并确保 `.git/config` 不含 Token”

2. **性能 AC 缺少测量边界。**
   - `首次克隆 < 30 秒`、`增量更新 < 15 秒` 是合理目标
   - 但未说明测试网络环境、仓库规模基线、是否属于实验室基准还是 CI 门禁
   - 容易导致验收时口径不统一

**建议动作**

- 将内存清理 AC 改写为可观察、可测试的行为描述。
- 为性能 AC 补一句“作为基准目标/人工验证项”或明确测量条件。

### Story 2.5: aiforge init 交互式配置

**结论：有条件通过**

**优点**

- 用户价值明确，是 Epic 2 的关键整合 Story。
- 交互步骤、SSH/Token 验证、已有配置修改、非 TTY 拒绝都覆盖到了。
- 任务拆解合理，测试范围也相对完整。

**关键问题**

1. **示例中使用了 `reporter.info()`，但 Reporter 接口并未定义该方法。**
   - Story 1.3 的 Reporter 只有 `startPhase` / `updatePhase` / `completePhase` / `reportResult` / `reportPlan` / `reportError`
   - 这会导致 init 命令的输出接口无从落地，属于跨 story 契约不一致

2. **已有 URL 解析能力，但本 Story 仍准备重复手写 hostname 提取。**
   - Dev Notes 中使用 `new URL(repoUrl).hostname` 或手工解析 SSH URL
   - 而 Story 2.2 已定义知识源解析逻辑
   - 这会造成 init 命令与 Resolve 阶段对 URL 规则的双份实现，后续易漂移

3. **已有配置读取的示例用了宽泛 `catch {}`，会吞掉“配置损坏”错误。**
   - Story 2.1 明确要求损坏 JSON 时抛出 `CONFIG_CORRUPT`
   - 但 2.5 当前示例会把“配置损坏”和“配置不存在”都当成“无配置，继续流程”
   - 这会破坏错误语义一致性

**建议动作**

- 明确 init 命令的输出策略：
  - 要么扩展 Reporter 接口支持通用信息输出；
  - 要么在 Story 2.5 中明确 init 使用 prompts + 专用展示函数，不复用 Reporter。
- 复用 Story 2.2 的 URL 解析能力，不要在 init 中重复实现 hostname 提取。
- 只对 `CONFIG_NOT_FOUND` 做首次配置回退；`CONFIG_CORRUPT` 应显式提示用户修复或重建配置。

## 关键问题汇总

### 需要优先修正

1. **Story 2.3 Token URL 构造格式不一致**
2. **Story 2.5 使用了未定义的 `reporter.info()`**
3. **Story 2.1 的 `HostAuth` 类型未收口**
4. **Story 2.5 会吞掉 `CONFIG_CORRUPT` 错误**

### 建议补充澄清

1. `--ssh` 与 `--token` 同时传入时的处理方式
2. Story 2.4 的性能 AC 计量口径
3. Story 2.4 的“内存清理”验收表述

## 最终判定

Epic 2 当前 story 集合**具备较强的开发准备度**，主流程和交付目标已经成形。

但从 Story Preparation 质量标准看，以下原则还需进一步收口：

- 跨 story 的接口契约必须一致
- 同一能力不要在多个 story 中重复定义实现规则
- 安全与认证规则必须只有一种解释

**建议：优先修订 Story 2.1、2.3、2.5，再将 Epic 2 正式移交开发。**