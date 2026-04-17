# Story 6-2 第 2 轮复审上下文

## 轮次信息
- Story: 6-2
- 当前轮次: Round 2
- 审查类型: 复审
- 基线: Round 1 summary + Round 1 evaluation

## 上轮发现处理状态

### 已修复（来自 Round 1 evaluation 的修复执行记录）
1. Round 1 / Finding #1 — 无前缀零匹配恢复枚举不可命中的候选，并在用户选择后静默返回空计划
   - 修复位置: src/stages/match-rules.ts
   - 修复方式: 零匹配候选改为按 rule.type 收集真实安装项；无前缀候选使用 sourceDir/itemName；TTY 重试后增加二次零匹配检查。

2. Round 1 / Finding #2 — Files 类型的零匹配恢复只扫描目录，agents/instructions 场景拿不到可重试候选
   - 修复位置: src/stages/match-rules.ts
   - 修复方式: 零匹配候选按 rule.type 分流，Files 类型枚举文件 basename/qualified name，不再复用目录专用扫描逻辑。

3. Round 1 / Finding #3 — 空 sourceFiles 守卫被提升为通用行为，回归未使用 --filter 的既有计划/预览语义
   - 修复位置: src/stages/match-rules.ts, tests/stages/match-rules.test.ts
   - 修复方式: empty-item guard 限定到 args.filter 路径；恢复非 filter 场景空 item 测试作为回归保护。

### 仍为非阻塞待办
1. Round 1 / Finding #4 — 不可命中的 filter 语法没有被前置拒绝，而是延后到零匹配流程中暴露
   - 评估结论: P2 / 建议纳入 CR TODO 跟踪
   - 当前状态: 本轮不要求阻塞修复，但若引入新的参数验证问题，可作为新发现指出。

## 本轮复审重点
- 验证 Round 1 Findings #1-#3 的修复是否真实生效，且没有引入新的回归。
- 重点关注 src/stages/match-rules.ts 中零匹配恢复逻辑的候选收集、TTY/非 TTY 分支、一致性与错误处理。
- 重点关注 tests/stages/match-rules.test.ts 中新增回归测试是否覆盖了修复目标，是否遗漏关键路径。
- 避免重复报告已修复且已通过验证的问题。
