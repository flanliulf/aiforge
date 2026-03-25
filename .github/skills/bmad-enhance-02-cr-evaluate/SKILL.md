---
name: bmad-enhance-02-cr-evaluate
description: "Evaluate code review results from a cross-LLM review round and generate a structured evaluation document. Use when user mentions 'CR evaluate', 'CR evaluation', 'evaluate CR', 'review assessment', 'code review evaluation', '评估审查结果', '评估 CR', '评估 CR 结果', 'CR 评估', '审查结果评估', 'CR 结果评估', '代码审查评估', or wants to assess code review findings. Capable of reading latest review results, assessing finding validity, and producing evaluation documents with round numbering."
allowed-tools: Read, Write, Grep, Glob
---

[技能说明]
    对跨 LLM 代码审查的结果进行独立评估，判断审查发现的合理性和准确性，生成结构化的评估文档。作为审查工作流的质量把关环节，确保 CR 发现的客观性。

[核心能力]
    - **审查结果评估**：对 CR 代码审查的发现逐条评估其合理性和准确性
    - **自动定位最新结果**：自动扫描并定位最新一轮的《代码审查结果文件》
    - **评估轮次管理**：自动检测已有评估轮次，正确编号新一轮评估
    - **历史参考**：在有明确异议时可参考过往轮次的审查结果
    - **结构化评估输出**：生成规范化的评估文档，包含逐条评估结论
    - **只读安全保障**：严格禁止修改源码、Story 文档和执行修复操作

[执行流程]
    Step 1：定位代码审查目录和文件
        - 确定 Story 的代码审查目录：`<story-dir>/<story-id>-code-review/`
        - 从 Story 标识中提取 `<story-id>`（只包含 epic 和 story 的序号，不包括 story name），（如 1-1、1.1、1·1）
        - 生成数据：story-id、code-review-dir

    Step 2：定位最新一轮审查结果
        - 扫描 code-review-dir 下的 `<story-id>-code-review-summary-*-round-*.md` 文件
        - 找到 round 值（n）最大的文件作为本次评估对象
        - 读取该文件的完整内容
        - 生成数据：latest-review-file、review-round-number

    Step 3：检测评估轮次
        - 扫描 code-review-dir 下已有的 `<story-id>-code-review-evaluation-*-round-*.md` 文件
        - 统计已有的评估轮次数量，确定本轮评估轮次号 m = 已有评估轮次 + 1
        - 生成数据：evaluation-round-number（m）

    Step 4：执行评估
        - 逐条审阅 CR 审查结果中的发现（Findings）
        - 对每条发现进行评估：
            - 问题描述是否准确？
            - 严重性判断是否合理？
            - 修复建议是否可行？
            - 是否存在误报（false positive）？
        - 如有明确异议，可参考过往轮次的《代码审查结果文件》进行交叉验证
        - 给出整体评估结论：
            - 哪些发现需要修复（分优先级）
            - 哪些发现可以忽略（说明理由）
            - 哪些发现需要进一步讨论
        - 生成数据：evaluation-findings（评估结论列表）

    Step 5：保存评估结果
        - 确定今天日期，格式为 YYYYMMDD
        - 保存到文件：`<story-id>-code-review-evaluation-<YYYYMMDD>-round-<m>.md`
        - 文件头部必须包含元信息块（位于正文内容之前）：
            ```
            ---
            Story: <story-id>
            Round: <m>
            Date: <YYYY-MM-DD>
            Model Used: <当前执行本次评估的模型名称，如 Claude Opus 4、GPT-4o 等>
            Review Source: <被评估的审查结果文件名>
            Review Model: <产出被评估审查结果的模型名称（从审查结果文件头部读取）>
            Type: Code Review Evaluation
            ---
            ```
        - 向用户展示评估结论要点
        - 完成后返回："✅ CR 代码审查结果评估完成（第 m 轮），结果已保存"

[注意事项]
    - **绝对禁止**修改任何源码文件
    - **绝对禁止**修改 Story 文档内容
    - **绝对禁止**自行执行修复操作
    - 只对最新一轮（n 值最大）的《代码审查结果文件》进行评估
    - 只有在有明确异议时才允许参考过往轮次的《代码审查结果文件》
    - `<story-id>` 只包含 epic 和 story 的序号（如 1-1、1.1、1·1），不包括 story name
    - 始终使用中文输出评估结果
    - 评估要客观公正，对误报要明确标注并给出理由
    - 输出文件头部的 `Model Used` 字段必须如实填写当前执行评估的模型名称；`Review Model` 字段从被评估的审查结果文件头部读取，便于跨 LLM 追溯
    - 如果找不到审查结果文件，立即停止并告知用户
