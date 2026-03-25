---
name: bmad-enhance-04-cr-extract-rules
description: "Analyze historical code review, evaluation, and fix records to extract reusable development guidelines and best practices for project-level documentation. Use when user mentions 'extract CR rules', 'CR summary', 'extract CR guidelines', 'CR best practices', 'code review lessons', '提炼 CR 规则', 'CR 总结', '提取 CR 最佳实践', 'CR 经验总结', '代码审查规则提炼', '总结 CR 经验', or wants to distill patterns from CR history. Capable of analyzing multi-round CR findings, identifying recurring issues, and proposing updates to global project documents like project-context.md and architect.md."
allowed-tools: Read, Write, Grep, Glob
---

[技能说明]
    从指定 Story 的历史代码审查、评估及修正记录中提炼共性问题和最佳实践，判断是否可以补充到项目全局文档中，避免同类问题在后续 Story 开发中重复出现。

[核心能力]
    - **CR 历史分析**：系统性阅读和分析 Story 的全部 CR 审查、评估及修正记录
    - **共性问题识别**：从多轮 CR 发现中识别重复出现的模式和共性问题
    - **规则提炼**：将共性问题转化为可操作的开发规约、指导原则或最佳实践
    - **全局文档建议**：评估提炼的规则是否适合补充到 project-context.md、architect.md 等全局文档
    - **结构化输出**：以清晰的结构输出分析结果和建议，供用户确认

[执行流程]
    Step 1：收集 CR 历史记录
        - 接收用户指定的 Story 标识
        - 定位 Story 的代码审查目录：`<story-dir>/<story-id>-code-review/`
        - 读取该目录下所有文件：
            - CR 代码审查结果：`<story-id>-code-review-summary-*-round-*.md`
            - CR 评估结果：`<story-id>-code-review-evaluation-*-round-*.md`（含 "## 修复执行记录" 章节）
        - 生成数据：all-cr-records（全部 CR 历史记录）

    Step 2：梳理各轮次模型信息
        - 从每个 CR 文件的头部元信息中提取 `Model Used` 字段
        - 构建模型使用时间线：哪一轮审查/评估/修复分别由哪个模型执行
        - 生成数据：model-timeline（模型使用记录）

    Step 3：分析 Findings 情况
        - 系统性分析所有 CR 发现（Findings），分类统计：
            - AC 验收标准审核摘要中的问题
            - 测试充分性相关问题
            - 质量门禁相关问题
            - 代码逻辑和设计问题
            - 安全性和性能问题
        - 标记哪些问题在多轮 CR 中重复出现
        - 标记哪些问题的修复引入了新问题
        - 生成数据：findings-analysis（发现分析报告）

    Step 4：提炼共性规则
        - 从分析结果中提炼出 Story 开发过程中容易重复出现的共性问题
        - 将共性问题转化为以下形式：
            - **规避指南**：明确告诉开发者应避免什么
            - **指导原则**：描述推荐的做法和原因
            - **最佳实践**：提供可直接参照的代码模式或流程
            - **豁免说明**：记录合理的例外情况和豁免理由
        - 生成数据：extracted-rules（提炼的规则列表）

    Step 5：评估全局文档更新建议
        - 扫描项目中的全局文档（包括但不限于）：
            - `project-context.md`
            - `architect.md` 或 `architect/` 目录下的文档
            - `CLAUDE.md` 等开发指南文档
        - 对每条提炼的规则，评估：
            - 是否具有跨 Story 的普适性？
            - 适合补充到哪个全局文档？
            - 建议放在文档的哪个章节？
        - 生成数据：update-suggestions（文档更新建议列表）

    Step 6：输出总结供用户确认
        - 将分析结果、提炼的规则和文档更新建议整理为结构化总结
        - 包含以下部分：
            - 模型使用时间线（各轮次使用的模型及其角色）
            - CR Findings 概况统计
            - 识别的共性问题（含出现频次）
            - 提炼的规则/指南/最佳实践
            - 全局文档更新建议（含具体文档和章节）
        - 向用户展示总结，等待确认后再执行实际的文档更新
        - 完成后返回："✅ CR 历史分析和规则提炼完成，请确认是否需要更新全局文档"

[注意事项]
    - 本 Skill 只输出分析结果和建议，不自动修改全局文档，需等待用户确认
    - `<story-id>` 只包含 epic 和 story 的序号（如 1-1、1.1、1·1），不包括 story name
    - 始终使用中文输出
    - 提炼的规则要具体可操作，避免过于抽象的描述（如 "注意代码质量"）
    - 如果某条规则只在特定技术栈或场景下适用，需要明确标注适用范围
    - 如果 CR 历史记录较少（只有 1 轮），可能不足以提炼共性规则，需如实告知用户
    - 避免将仅适用于当前 Story 的特殊情况泛化为全局规则
