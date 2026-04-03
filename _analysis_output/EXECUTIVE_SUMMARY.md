# AI-Forge 模块边界分析执行总结

## 🎯 结论

**`messages.ts` 应该继续保留在 `src/data/` 目录中。**

当前的设计是正确的，无需移动。

---

## 📊 分析过程

### 第 1 步：查看 src/ 目录结构
```
src/
├── commands/      — CLI 子命令
├── core/          — 接口 + 类型 + 实现（Reporter）
├── data/          — 常量 + 工具函数
├── services/      — Git、Config、Manifest 等工具
├── stages/        — 管道 6 个阶段
├── index.ts       — CLI 入口
└── pipeline.ts    — 管道编排层
```

### 第 2 步：查阅官方规则文档

**project-context.md (L76-92) 明确规定：**
```
core/   has ZERO dependencies on other src dirs
data/   has ZERO dependencies (pure constants)
stages/ may depend on core/, data/, services/
services/ depends ONLY on core/
```

### 第 3 步：检查 messages.ts 的引用关系

| 引用者 | 导入方式 | 内容 |
|-------|---------|------|
| stages/* (×6) | `import { msg }` | 调用 `msg('phases.xxx')` 获取当前语言的阶段名 |
| index.ts | `import { setLanguage }` | 在 Reporter 创建前设置全局语言 |
| core/reporter.ts | ❌ 不导入 | 常量内联（STATUS_ICONS、统计行） |
| services/* | ❌ 不依赖 | 完全独立 |

### 第 4 步：检查 messages.ts 的内容属性

✅ **符合 data/ 的所有要求：**
- 纯常量 + 工具函数（MESSAGES_MAP、msg()、setLanguage()）
- 零运行时外部依赖（仅 `import type` from core/types.js）
- 序列化友好（所有内容都是字符串/对象字面量）
- 不被 core/ 直接依赖（Reporter 通过内联避免了）

### 第 5 步：分析设计意图

**core/reporter.ts 已实施了"内联常量"的策略（L58-78）：**

```typescript
// L73-78
/** 安装结果状态图标映射（内联常量，与 data/messages.ts ICONS 保持一致） */
const STATUS_ICONS: Record<string, string> = {
  new: '✅',
  updated: '🔄',
  skipped: '⏭️',
}

// L60-71 的 planStatsLine() 和 resultStatsLine()
```

🔑 **关键点**：Reporter（属于 core/）**刻意不导入** messages.ts，而是将需要的常量**内联定义**。这说明设计者有意维持"core/ ZERO 外部依赖"的约束。

---

## 📈 三层依赖分析

### 第一层：静态常量（STATUS_ICONS、格式字符串）
```
用处：core/reporter.ts 内联使用
位置：✅ core/reporter.ts (已内联)
     ⚠️ data/messages.ts (重复导出)
```

### 第二层：动态消息查询（msg() 函数）
```
用处：stages/ 调用 msg('phases.xxx')
位置：✅ src/data/messages.ts (正确位置)
理由：需要访问模块级全局状态 currentLanguage
```

### 第三层：语言切换（setLanguage() 函数）
```
用处：index.ts 在 Reporter 创建前调用
位置：✅ src/data/messages.ts (正确位置)
理由：修改模块级全局状态，必须集中管理
```

---

## ❌ 为什么不能移到 core/？

### 理由 1：违反架构规则
- project-context.md L86: "core/ has ZERO dependencies on other src dirs"
- 如果 messages.ts 移到 core/，后续 services 需要引用消息时会被迫导入 core/
- 这会创建 services → core → data 的依赖链，破坏模块隔离

### 理由 2：职责混淆
- core/ 应该只定义**契约**（接口、类型、错误类）
- data/ 应该定义**内容**（常量、消息、规则）
- messages.ts 是业务内容，不是技术契约

### 理由 3：无法处理模块级状态
```typescript
// messages.ts 需要维护模块级全局状态
let currentLanguage: Language = 'zh-CN'

export function setLanguage(lang: string): void {
  if (SUPPORTED_LANGUAGES.includes(lang)) {
    currentLanguage = lang
  }
}

export function msg(key: string): string {
  // 必须访问 currentLanguage
  let current = MESSAGES_MAP[currentLanguage]
  // ...
}
```

如果 msg() 在 core/ 中，那么：
- core 模块会包含"配置状态"，违反"纯接口"的原则
- Reporter 创建时还没有语言状态，会导致时序问题

### 理由 4：已有设计已经妥善处理
- core/reporter.ts 通过**内联常量**完美避免了 core → data 依赖
- 这是经过深思熟虑的设计，移动会破坏这个平衡

---

## 🎨 已知的小缺陷（可选改进）

### 缺陷 1：ICONS 定义重复
```
core/reporter.ts:74-78   — STATUS_ICONS（内联）
data/messages.ts:235-240 — ICONS（导出）
```

**现状**：两处需要同步更新
**建议**：保持现状，但在注释中明确说明"这是有意设计，避免 core → data 依赖"

### 缺陷 2：STATS_FORMAT 函数重复
```
core/reporter.ts:69-71   — resultStatsLine()（内联）
data/messages.ts:246-261 — STATS_FORMAT()（导出）
```

**现状**：两个函数逻辑相同
**建议**：data/messages.ts 中逐步弃用这个导出（标记 @deprecated）

---

## ✅ 验证清单

为确保架构一致性，可运行以下命令：

```bash
# 1. 验证 core/ 不依赖任何其他 src/ 子目录
grep -r "from '\.\./data\|from '\.\./stages\|from '\.\./services" src/core/ --include="*.ts"
# 预期：无输出 ✓

# 2. 验证 data/ 不建立运行时依赖（仅允许 import type）
grep -r "from '\.\./'" src/data/ --include="*.ts" | grep -v "import type"
# 预期：仅 install-rules.ts 的 `import type { InstallType }`

# 3. 验证 stages/ 只使用 msg() 函数，不直接导入常量
grep -r "ICONS\|STATS_FORMAT\|PLAN_STATS" src/stages --include="*.ts"
# 预期：无输出 ✓

# 4. 验证 services/ 仅依赖 core/
grep -r "from '\.\./data\|from '\.\./stages" src/services/ --include="*.ts"
# 预期：无输出 ✓
```

---

## 📚 参考文档

| 文档 | 行号 | 内容 |
|------|------|------|
| project-context.md | L76-92 | 官方模块边界规则 |
| 03-core-decisions.md | D4b (L119-150) | 错误类型 + Reporter 接口决策 |
| 04-implementation-patterns.md | L58-78 | Reporter 生命周期 + 内联常量设计 |
| project-context.md | L59 | data/ 零依赖约束说明 |

---

## 🎓 关键学习点

1. **"零外部依赖"的含义**
   - core/ 不导入其他 src/ 子目录，但可导入 npm 包
   - data/ 既不导入 src/ 也不建立运行时 import（仅 `import type`）

2. **Reporter 与 Messages 的隐性分工**
   - 消息**常量**被内联到 core/reporter.ts（避免 core → data）
   - 消息**函数**保留在 data/messages.ts（需要动态状态）
   - 这是依赖倒转模式的应用

3. **Duplicate 常量是有意设计**
   - ICONS 在两处定义不是缺陷，而是为了避免循环依赖
   - 修改时需同步更新，可通过注释明确意图

4. **模块级全局状态的位置**
   - currentLanguage 必须在 data/ 中维护
   - 不能迁移到 core/，因为这违反了"纯接口"的原则

---

## 🚀 建议行动

### 短期（立即）
- ✅ 维持 messages.ts 在 data/ 目录
- ✅ 无需代码变更

### 中期（下一个审查周期）
- 📝 更新 core/reporter.ts 的注释，明确说明"为什么 ICONS 内联到此处"
- 📝 更新 data/messages.ts，标记 STATS_FORMAT 和 PLAN_STATS_FORMAT 为 @deprecated
- 📝 在 04-implementation-patterns.md 中补充"Module Boundary Enforcement"章节

### 长期（架构演进）
- 无需行动（设计已成熟）

---

## 结论

**当前的模块设计是精心设计的，messages.ts 在 src/data/ 是完全正确的位置。**

整个架构体现了以下原则：
- ✅ 职责清晰（core=契约, data=内容, stages=业务）
- ✅ 依赖单向（→ all from core, → core,data from stages）
- ✅ 零循环依赖（通过内联常量避免）
- ✅ 扩展友好（新增国际化内容可直接加入 messages.ts）

**不需要移动，无需改动。** 😊

