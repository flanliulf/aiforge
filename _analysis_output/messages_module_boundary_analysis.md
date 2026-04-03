# AI-Forge 模块边界设计分析报告

## 执行概览

本报告基于对以下文件的系统分析：
1. `_bmad-output/project-context.md` — AI Agent 主规则文件
2. `_bmad-output/planning-artifacts/architecture/03-core-decisions.md` — 核心技术决策
3. `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md` — 实现模式约束
4. 所有源代码模块的实际导入依赖关系

---

## 1. 模块边界架构规范（官方）

### 1.1 整体架构依赖图

```
index.ts → pipeline.ts → stages/* → services/*
                           │            │
                           └→ core/*  ←─┘
                                │
                           data/* (pure data)
```

**关键规则（project-context.md L76-92）：**

| 模块 | 约束 | 说明 |
|------|------|------|
| `core/` | **ZERO 外部依赖** | 被所有模块引用；无循环依赖；纯接口+类型 |
| `data/` | **ZERO 外部依赖** | 纯常量+工具函数；禁止导入其他 src/ 子目录 |
| `services/` | 仅依赖 `core/` | 不能依赖 `stages/`、`data/`（除非数据常量） |
| `stages/` | 可依赖 `core/`, `data/`, `services/` | 管道各阶段的业务逻辑 |
| `commands/` | 可依赖 `core/`, `services/` | CLI 子命令实现 |

### 1.2 core/ 模块现状

**当前文件列表：**
```
src/core/
  ├── errors.ts       — AiforgeError 类和出错助手
  ├── types.ts        — 管道类型契约（接口/枚举）
  ├── reporter.ts     — Reporter 接口 + 3 种实现
  ├── path-resolver.ts — PathResolver 接口 + Unix 实现
  ├── sanitize.ts     — 脱敏函数集
  └── index.ts        — 空占位符
```

**关键观察：**
- `reporter.ts` 内含 `STATUS_ICONS`、`planStatsLine()`、`resultStatsLine()` 三个原本在 `data/messages.ts` 中定义的内容
- 这三个内容已被**内联到 core/reporter.ts**（L58-78），注释明确说明"以维持零外部依赖"
- core/reporter.ts **不导入任何 data/ 模块**

### 1.3 data/ 模块现状

**当前文件列表：**
```
src/data/
  ├── install-rules.ts  — BUILTIN_RULES + RULE_INDEX
  ├── tool-registry.ts  — TOOL_DEFINITIONS 工具检测表
  ├── excludes.ts       — DEFAULT_EXCLUDES
  ├── messages.ts       — 双语消息 + ICONS 常量
  └── index.ts          — 导出聚合
```

**关键约束（project-context.md L59）：**
> `data/` 模块有零运行时依赖要求，引用 enum 会产生运行时 import，因此 data/ 内使用 `import type` + 字符串字面量断言

**messages.ts 的当前内容：**
- 双语消息映射 `MESSAGES_MAP`（L73-178）
- `msg()` 函数 — 按 dot notation 获取当前语言消息
- 向后兼容导出（L223-261）：
  - `MESSAGES` 常量 — 阶段名集合
  - `ICONS` 常量 — 状态图标
  - `STATS_FORMAT()` 函数 — 结果统计行格式
  - `PLAN_STATS_FORMAT()` 函数 — dry-run 计划统计行格式

---

## 2. messages.ts 的当前引用关系

### 2.1 stages/ 对 messages.ts 的依赖

**直接 import `msg` 函数的阶段：**
```
stages/clone.ts:25           import { msg } from '../data/messages.js'
stages/authenticate.ts:21    import { msg } from '../data/messages.js'
stages/match-rules.ts:27     import { msg } from '../data/messages.js'
stages/resolve-source.ts:24  import { msg } from '../data/messages.js'
stages/execute-install.ts:57 import { msg } from '../data/messages.js'
stages/detect-tools.ts:22    import { msg } from '../data/messages.js'
```

**使用方式：** 所有 6 个管道阶段都调用 `msg('phases.XXX')` 来获取当前语言的阶段名

### 2.2 services/ 对 messages.ts 的依赖

**结果：** services/ 内无任何文件引用 messages.ts

### 2.3 core/ 与 messages.ts 的关系

**core/reporter.ts 的策略：**
- 不导入 `data/messages.ts`
- 将 `ICONS`、统计行格式**内联定义**在 reporter.ts 中（L73-78）
- 注释明确说明："内联于 core/ 以维持零外部依赖（core/ 不得引用 data/）"

**关键代码片段：**
```typescript
// L73 — core/reporter.ts
/** 安装结果状态图标映射（内联常量，与 data/messages.ts ICONS 保持一致） */
const STATUS_ICONS: Record<string, string> = {
  new: '✅',
  updated: '🔄',
  skipped: '⏭️',
}

// L60-62 — planStatsLine() 内联定义
function planStatsLine(totalFiles: number, toolCount: number): string {
  return `计划安装: ${totalFiles} 项 (${toolCount} 个工具)`
}

// L69-71 — resultStatsLine() 内联定义
function resultStatsLine(installed: number, updated: number, skipped: number): string {
  return `安装: ${installed} 项  更新: ${updated} 项  跳过: ${skipped} 项`
}
```

### 2.4 index.ts 对 messages.ts 的依赖

**index.ts:20：**
```typescript
import { setLanguage } from './data/messages.js'
```

**用法：** 在管道启动前调用 `setLanguage(config.language)` 设置全局语言状态

---

## 3. messages.ts 的模块属性分析

### 3.1 当前属于 data/ 的原因

✅ **符合 data/ 定义的全部要求：**

| 要求 | 符合度 | 说明 |
|------|--------|------|
| 纯常量 + 工具函数 | ✅ 100% | `MESSAGES_MAP`, `ICONS`, `STATS_FORMAT()`, `msg()` |
| 零运行时依赖 | ✅ 100% | 仅 `import type` from 'core/types.js'（类型导入） |
| 序列化友好 | ✅ 100% | 双语消息和图标都是字符串/对象字面量 |
| 不被 core/ 依赖 | ✅ 100% | core/reporter.ts 内联而非导入 |
| 被所有模块消费 | ✅ 100% | stages/×6、index.ts、data/index.ts |

### 3.2 messages.ts 不适合移到 core/ 的原因

❌ **如果移到 core/，将违反以下架构规则：**

| 风险 | 解释 |
|------|------|
| **core/ 依赖膨胀** | core/ 将不再是"纯接口+类型"，混入业务数据常量 |
| **模块职责混淆** | core/ 本应只定义**契约**，不定义**内容** |
| **索引圈**（后续） | 当 services/ 需要引用消息时，会被迫导入 core/，形成隐性耦合 |
| **规则一致性破坏** | 违反了 `core/ ZERO 外部依赖` 规则的**镜像**要求 |

---

## 4. 核心设计的关键约束点

### 4.1 "零外部依赖"的真实含义

从 project-context.md 和 implementation-patterns.md 的仔细阅读可知：

**规则 L86-89 (project-context.md)：**
```
- `core/` has ZERO dependencies on other src dirs (referenced by all)
- `data/` has ZERO dependencies (pure constants)
- `stages/` may depend on `core/`, `data/`, `services/`
- `services/` depends ONLY on `core/`
```

**语义解析：**
- `core/` 的"零外部依赖" = 不导入任何其他 src/ 子目录（但可以导入外部 npm 包）
- `data/` 的"零依赖" = 既不导入其他 src/ 子目录，也不导入建立运行时 import（仅 `import type`）

### 4.2 Reporter 与 Messages 的隐性分工

**04-implementation-patterns.md L58-78 注释明确：**
```typescript
/**
 * 内联于 core/ 以维持零外部依赖（core/ 不得引用 data/）
 */
function planStatsLine(totalFiles: number, toolCount: number): string { ... }
```

这个设计决策的背景：
1. Reporter 是 core/ 的一部分，被所有阶段直接引用
2. 如果 Reporter 依赖 data/messages，core/ 就变成了"依赖 data/"
3. 为了维持"core/ → all"的单向箭头，Messages 中的**常量**被内联，**函数**(`msg()`) 则保留在 data/

### 4.3 messages.ts 为何仍在 data/（而不是被完全内联）

**原因链：**

1. **双语动态切换的需求** → `msg()` 函数需要维护模块级全局状态 `currentLanguage`
2. **stages 需要动态获取当前语言的消息** → 不能预先内联到 core/reporter.ts
3. **core/ 不能导入 data/** → 避免循环依赖和职责混淆
4. **解决方案** → index.ts 在 Reporter 创建**前**调用 `setLanguage()`，stages 在执行时调用 `msg()`

这形成了一个**依赖倒转**模式：
```
index.ts (main)
  → calls setLanguage() (from data/)
  → creates Reporter (from core/)
  → creates stages (from stages/)
  → stages call msg() (from data/)
```

---

## 5. 数据流分析

### 5.1 messages.ts 中的数据分类

```typescript
// 【静态常量】— 可以内联到 core/
✅ ICONS = { new: '✅', updated: '🔄', skipped: '⏭️' }
✅ resultStatsLine() — 已内联到 core/reporter.ts

// 【动态消息】— 必须留在 data/
❌ MESSAGES_MAP[currentLanguage] — 依赖运行时语言状态
❌ msg() 函数 — 需要访问模块级 currentLanguage 变量
❌ setLanguage() — 修改模块级全局状态

// 【向后兼容导出】— 保留在 data/，但逐步弃用
⚠️  MESSAGES — deprecated，建议用 msg('phases.*')
⚠️  STATS_FORMAT() — 已被 core/reporter.ts 的 resultStatsLine() 取代
```

### 5.2 为什么要 import type + 字符串字面量断言

在 data/install-rules.ts 中的模式：

```typescript
// ✅ 避免运行时依赖 core/ 的做法
import type { InstallType } from '../core/types.js'  // ← 仅类型导入

const Files: InstallType = 'Files' as InstallType    // ← 字符串字面量 + 类型断言
const Flatten: InstallType = 'Flatten' as InstallType
```

**为什么 messages.ts 不能这样做：**
- messages.ts 需要导出 `msg()` 函数，该函数**必须在运行时执行**
- `msg()` 访问 `MESSAGES_MAP[currentLanguage]`，需要运行时读取模块状态
- 无法用"字符串字面量断言"来模拟运行时字典查询

---

## 6. 最终判断：messages.ts 应该放在哪里？

### 6.1 选项对比

| 选项 | 当前 | pros | cons | 评分 |
|------|------|------|------|------|
| **保持在 data/** | ✅ | 符合原有设计意图，纯常量+函数 | — | ⭐⭐⭐⭐⭐ |
| **全部移到 core/** | ❌ | 统一输出相关逻辑 | 违反"core ZERO 依赖"规则，破坏职责分层 | ⭐ |
| **拆分（常量→core, 函数→data）** | ⚠️  | 精细化控制 | 维护复杂度高，Duplicate `ICONS` 定义已存在于 core/reporter.ts | ⭐⭐ |
| **新建 output/ 模块** | ✗ | 明确命名 | 增加新模块，违反"最小化模块数"原则 | ⭐⭐⭐ |

### 6.2 最终结论

**messages.ts 应该继续位于 src/data/** 

**理由：**

1. ✅ **架构一致性** — 符合 project-context.md 的明确定义
2. ✅ **职责清晰** — data/ = 常量+工具，core/ = 接口+实现
3. ✅ **依赖简洁** — stages 直接依赖 data/messages，不必在 core/ 中转
4. ✅ **已实施模式** — core/reporter.ts 已经通过内联的方式避免了循环依赖
5. ✅ **扩展友好** — 未来若需增加更多国际化内容，data/ 是天然的聚合地

---

## 7. 改进建议

### 7.1 当前的潜在问题

**问题 1：ICONS 被定义了两次**
- `data/messages.ts:235-240` — ICONS 导出
- `core/reporter.ts:74-78` — STATUS_ICONS 内联定义

**改进方案：**
```typescript
// core/reporter.ts 中保持现状（内联 STATUS_ICONS），但更新注释：
/** 
 * 安装结果状态图标映射
 * 注：与 data/messages.ts ICONS 保持一致。core/reporter.ts 内联此常量以避免 core/ → data/ 依赖。
 * 两处修改时需同步更新。
 */
const STATUS_ICONS: Record<string, string> = {
  new: '✅',
  updated: '🔄',
  skipped: '⏭️',
}

// data/index.ts 中移除过时导出：
// ✅ export { msg, setLanguage } from './messages.js'
// ❌ 逐步弃用 ICONS（推荐 core/reporter.ts 的 STATUS_ICONS 或使用 msg()）
```

### 7.2 当前的缺陷

**缺陷 1：STATS_FORMAT 和 PLAN_STATS_FORMAT 的重复定义**
- `data/messages.ts:246-261` — 导出函数
- `core/reporter.ts:60-71` — 内联函数

**改进方案：**
```typescript
// 方案 A：保持现状，统一注释
// 方案 B：data/messages.ts 中移除这两个函数，仅导出 msg()

export { msg, setLanguage } from './messages.js'
// ❌ export STATS_FORMAT
// ❌ export PLAN_STATS_FORMAT
// 理由：这两个函数已在 core/reporter.ts 内联，保留导出会导致未使用代码
```

### 7.3 规则文档同步

**需更新的文档：**
1. ✅ `project-context.md` — 已正确描述（L76-92）
2. ✅ `03-core-decisions.md` — D4b 部分准确（L119-150）
3. ⚠️ `04-implementation-patterns.md` — L58-78 注释清晰，建议补充"为什么不能在 core/ 中导入 data/"

**建议补充的条款：**
```markdown
### Module Boundary Enforcement

当架构规则与实现细节冲突时，优先遵循规则原意：

1. **"core/ ZERO 外部依赖"的含义**
   - 不导入其他 src/ 子目录（npm 包可以）
   - 不被 data/ 反向依赖
   - 不建立 core ↔ data 的双向依赖

2. **为什么 messages 在 data 而不是 core**
   - Reporter 需要消息内容，但不能依赖 data/
   - 解决方案：消息常量内联到 core/reporter.ts，msg() 函数保留在 data/messages.ts
   - 调用方（stages）依赖 data/messages，而非 core/reporter 代理

3. **Duplicate 常量的可接受性**
   - ICONS 在 core/reporter.ts 和 data/messages.ts 重复定义
   - 这是为了避免依赖倒转，是**有意设计**，非缺陷
   - 修改时需同步更新两处
```

---

## 8. 验证清单

为确保当前模块边界的正确性，可以执行以下验证：

```bash
# 1. 检查 core/ 的所有 imports（应不出现 from '../data' 或 from '../stages'）
grep -r "from '\.\./data\|from '\.\./stages\|from '\.\./services\|from '\.\./commands" src/core/ --include="*.ts"
# 预期结果：无输出（无违反项）

# 2. 检查 data/ 的所有 imports（除了 import type 和外部包，不应有 from '../'）
grep -r "from '\.\./'" src/data/ --include="*.ts" | grep -v "import type"
# 预期结果：仅 install-rules.ts 的 import type { InstallType } from '../core/types.js'

# 3. 检查 stages/ 对 messages 的依赖（应都是 msg 函数调用，不是常量）
grep -r "ICONS\|STATS_FORMAT\|PLAN_STATS" src/stages --include="*.ts"
# 预期结果：无输出（不应直接导入这些常量）

# 4. 检查 services/ 是否依赖了 data/ 或 stages/
grep -r "from '\.\./data\|from '\.\./stages" src/services/ --include="*.ts"
# 预期结果：无输出（services/ 仅依赖 core/）
```

---

## 9. 总结

**messages.ts 所在的位置是完全正确的。**

### 关键要点：

1. **消息模块设计是精心设计的**
   - 一部分消息常量（ICONS、格式字符串）被有意内联到 core/reporter.ts
   - 另一部分动态消息函数（msg、setLanguage）保留在 data/messages.ts
   - 这避免了 core/ 导入 data/ 的循环依赖

2. **三个原因不能把 messages 全部搬到 core/**
   - 违反"core ZERO 外部依赖"的架构规则
   - 破坏职责分层（core 应只定义契约，不包含业务数据）
   - 无法解决 msg() 的模块级语言状态问题

3. **三个原因不能把 messages 分拆到多处**
   - 维护成本高（Duplicate 常量已存在）
   - 实现模式已经清晰（内联 vs 函数引用）
   - 规则文档已经明确（project-context.md L58-59）

**建议：** 维持现状，仅在改进文档中补充"为什么不能移动"的详细说明，防止未来重复的架构讨论。

