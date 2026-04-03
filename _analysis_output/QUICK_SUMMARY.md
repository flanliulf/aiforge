# messages.ts 模块位置判断 — 快速参考

## 问题陈述
`messages.ts` 应该放在 `src/core/` 还是 `src/data/` 中？

---

## 答案：**KEEP IT IN `src/data/`** ✅

---

## 核心依据（3 点）

### 1️⃣ 规则一致性（project-context.md L76-92）
```
┌─────────────────────────────────────────┐
│ OFFICIAL ARCHITECTURE RULES              │
├─────────────────────────────────────────┤
│ core/  → ZERO external dependencies     │
│ data/  → ZERO external dependencies     │
│         (pure constants + functions)    │
│ stages/→ can depend on core/, data/     │
│ service→ can depend on core/ ONLY       │
└─────────────────────────────────────────┘
```

✅ messages.ts **符合 data/ 的定义**：
- 纯常量 + 工具函数 ✓
- 零运行时依赖 ✓
- 被 stages 消费 ✓

### 2️⃣ 已实施的设计（core/reporter.ts L58-78）
```typescript
// core/reporter.ts 已经在用"内联"的策略：
const STATUS_ICONS = {
  new: '✅',
  updated: '🔄', 
  skipped: '⏭️',
}
// 注释明确说明：
// "内联于 core/ 以维持零外部依赖（core/ 不得引用 data/）"
```

🔑 **关键点**：Reporter（core 模块）不导入 messages.ts，而是将**常量**内联。这说明设计者有意避免 `core/ → data/` 依赖。

### 3️⃣ 实际使用的数据流
```
index.ts 
  ↓ setLanguage() 
src/data/messages.ts  ← 模块级全局状态在此
  ↑ msg() 函数
stages/* 
  ↓ 调用 msg('phases.clone')
core/reporter.ts      ← 消息常量内联在此，独立使用
```

stages 依赖 data/messages → 符合架构
core 不依赖 data/messages → 符合架构

---

## 为什么不能移到 core/？

| 理由 | 解释 |
|------|------|
| 🚫 **核心规则违反** | core/ ZERO 依赖规则明确禁止外部 src/ 导入 |
| 🚫 **职责混淆** | core/ 应只定义**契约**（接口/类型），不定义**内容**（消息） |
| 🚫 **无法处理动态状态** | `msg()` 需要访问模块级 `currentLanguage` 变量，这是运行时状态，不适合在 core/ |
| 🚫 **破坏已有设计** | core/reporter.ts 已经通过内联避免了循环依赖，移动会重新引入 core → data 依赖 |

---

## 双重内联的妙处

messages.ts 的内容被分成了两部分：

```typescript
【静态常量】— 内联到 core/reporter.ts
✓ STATUS_ICONS 
✓ planStatsLine()
✓ resultStatsLine()

【动态函数】— 保留在 src/data/messages.ts
✓ msg(key: string)          // 按语言查询消息
✓ setLanguage(lang: string) // 切换语言（模块级全局状态）
✓ MESSAGES_MAP             // 双语字典
```

这个设计避免了：
- ❌ core/ 依赖 data/ 的循环依赖
- ❌ Reporter 刚创建就要处理国际化状态
- ❌ 重复加载消息数据

---

## 当前的小缺陷（已知）

| 缺陷 | 位置 | 现状 | 建议 |
|------|------|------|------|
| ICONS 重复 | core:74 + data:235 | ⚠️ Duplicate | 保持，但同步更新注释 |
| STATS_FORMAT 重复 | core:69 + data:246 | ⚠️ Duplicate | data/ 逐步弃用这个导出 |

---

## 总结

```
✅ messages.ts IN src/data/     — 符合架构
❌ messages.ts IN src/core/     — 违反规则
⚠️ messages.ts 拆分到多处      — 维护复杂
```

**最终判断：**
🎯 **KEEP CURRENT POSITION** — messages.ts 在 src/data/ 是正确的设计

---

## 参考文档位置

- 📄 完整分析：`_analysis_output/messages_module_boundary_analysis.md`
- 📋 架构规则：`_bmad-output/project-context.md` (L76-92)
- 🏛️ 核心决策：`_bmad-output/planning-artifacts/architecture/03-core-decisions.md` (D4b)
- 📐 实现模式：`_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md` (L58-78)

