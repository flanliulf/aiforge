# AI-Forge 模块边界分析 — 文档索引

> 分析日期：2026-04-01  
> 分析主题：messages.ts 模块位置判断  
> 分析深度：Medium Thoroughness（中等详尽度）

---

## 📚 文档导航

### 🎯 1. 快速参考（1-2 分钟）
**文件：`QUICK_SUMMARY.md`**

- ✅ 最终答案：messages.ts 应留在 src/data/
- 🔑 3 点核心依据
- ❌ 为什么不能移到 core/
- 📋 对比分析表

**适合人群：** 开发人员、想快速了解结论的人

---

### 📊 2. 执行总结（5-10 分钟）
**文件：`EXECUTIVE_SUMMARY.md`**

- 📋 完整分析过程（5 步）
- 📈 三层依赖分析
- ❌ 详细的 4 点反驳理由
- 🎨 已知缺陷及改进建议
- ✅ 验证清单（4 条 bash 命令）
- 🚀 建议行动（短期/中期/长期）

**适合人群：** 项目经理、架构师、技术决策者

---

### 🔬 3. 完整分析报告（15-20 分钟）
**文件：`messages_module_boundary_analysis.md`**

- 📋 执行概览
- 🏛️ 完整的架构规范说明
- 🔍 messages.ts 的详细引用关系分析
- 📊 模块属性详细分析
- 🎓 核心设计约束点深度解读
- 📈 五层数据流分析
- 🎨 改进建议（详细）
- ✅ 完整验证清单
- 📚 参考文档位置

**适合人群：** 架构师、资深工程师、想深度理解设计的人

---

## 🎯 快速决策树

```
问：messages.ts 应该放在哪里？
└─ 答：src/data/ ✅

问：为什么不能放在 core/?
├─ 理由1：违反"core/ ZERO 外部依赖"规则
├─ 理由2：破坏职责分层
├─ 理由3：无法处理模块级全局状态
└─ 理由4：会破坏已有的内联设计

问：当前有什么问题吗？
├─ 小问题1：ICONS 定义重复（⚠️ 有意设计）
└─ 小问题2：STATS_FORMAT 重复（⚠️ 有意设计）

问：需要改动代码吗？
└─ 答：不需要 ✅（无需改动）

问：需要改动文档吗？
├─ 短期：不需要
├─ 中期：补充注释说明"为什么 ICONS 内联"
└─ 长期：无需改动（设计已成熟）
```

---

## 🔍 关键发现总结

### 发现 1：messages.ts 完全符合 data/ 定义
- ✓ 纯常量 + 工具函数
- ✓ 零运行时外部依赖
- ✓ 序列化友好
- ✓ 不被 core/ 直接依赖

### 发现 2：Reporter 的"内联常量"策略
```typescript
// core/reporter.ts 明确说明：
// "内联于 core/ 以维持零外部依赖（core/ 不得引用 data/）"

const STATUS_ICONS = { new: '✅', updated: '🔄', skipped: '⏭️' }
function planStatsLine() { /* ... */ }
function resultStatsLine() { /* ... */ }
```

### 发现 3：三层的巧妙分工
```
【第 1 层 - 静态常量】
  ICONS、格式字符串
  ↓ 内联到 core/reporter.ts
  
【第 2 层 - 动态函数】
  msg(key: string)
  ↓ 保留在 data/messages.ts
  
【第 3 层 - 状态管理】
  setLanguage(lang: string)
  ↓ 保留在 data/messages.ts（模块级全局状态）
```

---

## 📋 核心规则回顾

### project-context.md (L76-92)
```
┌──────────────────────────────────────┐
│ Module Boundaries                    │
├──────────────────────────────────────┤
│ core/     → ZERO external deps       │
│ data/     → ZERO external deps       │
│ stages/   → core/, data/, services/  │
│ services/ → core/ ONLY               │
└──────────────────────────────────────┘
```

### 04-implementation-patterns.md (L58-78)
```typescript
/**
 * 内联于 core/ 以维持零外部依赖
 * （core/ 不得引用 data/）
 */
```

---

## ✅ 验证指令

### 验证 1：core/ 不依赖 data/
```bash
grep -r "from '\.\./data" src/core/ --include="*.ts"
# 预期结果：无输出 ✓
```

### 验证 2：messages 的实际使用
```bash
grep -r "import.*messages" src/ --include="*.ts"
# 预期结果：
#   stages/×6: msg 函数
#   index.ts: setLanguage 函数
#   core/reporter.ts: 无（内联了）
```

### 验证 3：data/ 的依赖约束
```bash
grep -r "from '\.\./'" src/data/ --include="*.ts" | grep -v "import type"
# 预期结果：仅 install-rules.ts 的 import type
```

### 验证 4：services/ 的约束
```bash
grep -r "from '\.\./data\|from '\.\./stages" src/services/ --include="*.ts"
# 预期结果：无输出 ✓
```

---

## 🚀 后续建议

### 短期（立即）
- ✅ 维持 messages.ts 在 src/data/
- ✅ 无需代码改动

### 中期（下一个审查周期）
- 📝 更新 core/reporter.ts 注释
- 📝 标记 data/messages.ts 的过时函数
- 📝 补充 04-implementation-patterns.md 文档

### 长期（架构演进）
- ✓ 无需行动（设计已成熟）

---

## 📖 参考文档

| 文档名 | 位置 | 关键行号 | 内容 |
|--------|------|---------|------|
| project-context.md | _bmad-output/ | L76-92 | 模块边界规则 |
| project-context.md | _bmad-output/ | L59 | data/ 零依赖说明 |
| 03-core-decisions.md | _bmad-output/planning-artifacts/architecture/ | L119-150 | Reporter 设计决策 |
| 04-implementation-patterns.md | _bmad-output/planning-artifacts/architecture/ | L58-78 | 内联常量设计说明 |

---

## 🎓 架构原则总结

### 1. 职责分层
```
core/  = 契约层（接口、类型、错误）
data/  = 内容层（常量、消息、规则）
stages/ = 业务层（具体流程）
```

### 2. 依赖单向
```
stages/ → core/, data/
services/ → core/
core/ ↔ data/ (禁止！)
```

### 3. 零循环依赖
```
通过"内联常量"策略避免 core → data 依赖
通过"保留函数"策略处理 stages → data 依赖
```

### 4. 扩展友好
```
新增国际化消息 → 直接加入 data/messages.ts
新增工具规则 → 直接加入 data/install-rules.ts
```

---

## 💡 常见问题解答

**Q：为什么不把 messages 全部放到 core/?**
A：因为这会违反"core/ ZERO 外部依赖"的规则，而且 msg() 函数需要访问模块级全局状态 currentLanguage，不适合在 core/ 中维护。

**Q：为什么 ICONS 被定义了两次?**
A：有意设计。core/reporter.ts 内联 ICONS 避免导入 data/，data/messages.ts 导出 ICONS 供其他模块使用。这避免了循环依赖。

**Q：STATS_FORMAT 函数也重复了，是缺陷吗?**
A：同样是有意设计。建议逐步标记为 @deprecated，因为 core/reporter.ts 已有相同的 resultStatsLine() 实现。

**Q：当前需要改动什么吗?**
A：短期无需改动。中期可以补充注释说明设计意图。代码本身无需变更。

---

## 📞 分析联系人

- 分析执行：Claude Code (AI Agent)
- 分析日期：2026-04-01
- 分析方法：Multi-document deep analysis
- 覆盖范围：project-context.md + architecture/*.md + 源代码依赖关系

---

## 📄 文档清单

```
_analysis_output/
├── INDEX.md (本文件)
│   → 导航和快速参考
│
├── QUICK_SUMMARY.md (3.9 KB)
│   → 1-2 分钟快速了解
│
├── EXECUTIVE_SUMMARY.md (7.5 KB)
│   → 5-10 分钟完整了解
│
└── messages_module_boundary_analysis.md (15 KB)
    → 15-20 分钟深度学习
```

---

✨ **最终结论**

**messages.ts 在 src/data/ 是完全正确的位置。** 

当前的模块边界设计精心设计，已完全符合官方规则。无需改动。

😊
