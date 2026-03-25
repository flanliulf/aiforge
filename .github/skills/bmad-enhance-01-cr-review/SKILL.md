---
name: bmad-enhance-01-cr-review
description: "Execute cross-LLM code review for a Story and save review summary to a structured result file. Use when user mentions 'CR', 'code review', 'crossllm review', 're-review', 'code review summary', '代码审查', 'CR 审查', '跨模型审查', '代码复审', '代码评审', '审查代码', or wants to review Story code changes. Capable of first-round and subsequent-round code reviews, auto-detecting review history, and generating structured review result documents with round numbering."
allowed-tools: Read, Write, Grep, Glob
---

[技能说明]
    针对指定 Story 执行跨 LLM 代码审查（CR），自动识别首轮或复审场景，输出结构化的审查总结并保存到规范化的结果文件中。支持多轮审查的自动编号和历史记录追踪。

[核心能力]
    - **跨 LLM 代码审查**：对 Story 关联的代码变更进行全面审查，输出结构化的审查总结
    - **自动轮次检测**：自动扫描已有审查结果文件，确定当前轮次编号（n）
    - **首轮/复审自适应**：首轮审查聚焦全量代码，复审聚焦上轮修复点和残留问题
    - **结构化结果保存**：按规范文件名格式自动创建审查结果文件
    - **历史记录感知**：复审时自动参考历次 CR 结果和修复记录，避免重复指出已修复的问题
    - **只读安全保障**：严格禁止修改源码和 Story 文档，仅输出审查总结

[执行流程]
    Step 1：定位 Story 和代码审查目录
        - 接收用户指定的 Story 标识（如 Story 文件路径或 Story ID）
        - 定位 Story 文件所在目录
        - 确定代码审查目录路径：`<story-dir>/<story-id>-code-review/`
        - 从 Story 标识中提取 `<story-id>`（只包含 epic 和 story 的序号，不包括 story name），（如 1-1、1.1、1·1）
        - 生成数据：story-id、story-dir、code-review-dir

    Step 2：检测审查轮次
        - 扫描 code-review-dir 下已有的 `<story-id>-code-review-summary-*-round-*.md` 文件
        - 统计已有的审查轮次数量，确定本轮轮次号 n = 已有轮次 + 1
        - 判断审查类型：
            - n == 1 → 首轮审查
            - n > 1 → 复审（需参考历史记录）
        - 生成数据：round-number（n）、review-type（首轮/复审）

    Step 3：收集审查上下文（复审场景）
        - IF 复审（n > 1）：
            - 读取历次 CR 结果文件：`<story-id>-code-review-summary-*-round-*.md`
            - 读取历次评估文件：`<story-id>-code-review-evaluation-*-round-*.md`
            - 重点关注最新一轮评估文件中的 "## 修复执行记录" 章节
            - 建立"已修复问题清单"，复审时跳过这些问题
        - IF 首轮（n == 1）：
            - 跳过此步骤
        - 生成数据：review-context（历史审查上下文）

    Step 4：执行代码审查
        - 读取 Story 文档，理解功能需求和验收标准（AC）
        - 定位 Story 关联的代码文件
        - 执行审查，关注以下维度：
            - AC 验收标准覆盖情况
            - 代码逻辑正确性
            - 错误处理和边界条件
            - 测试充分性
            - 代码质量和可维护性
            - 安全性和性能隐患
        - IF 复审：重点验证上轮问题的修复质量，同时检查是否引入新问题
        - 生成数据：review-findings（审查发现列表）

    Step 5：生成并保存审查总结
        - 将审查发现整理为结构化总结（只保存总结/结论部分，不保存完整审查过程）
        - 确定今天日期，格式为 YYYYMMDD
        - 创建 code-review-dir 目录（如不存在）
        - 保存到文件：`<story-id>-code-review-summary-<YYYYMMDD>-round-<n>.md`
        - 文件头部必须包含元信息块（位于正文内容之前）：
            ```
            ---
            Story: <story-id>
            Round: <n>
            Date: <YYYY-MM-DD>
            Model Used: <当前执行本次审查的模型名称，如 Claude Opus 4、GPT-4o 等>
            Type: Code Review Summary
            ---
            ```
        - 向用户展示审查总结要点
        - 完成后返回："✅ CR 代码审查完成（第 n 轮），结果已保存"

[注意事项]
    - **绝对禁止**修改任何源码文件
    - **绝对禁止**修改 Story 文档内容
    - **绝对禁止**自行执行修复操作
    - 结果文件中只保存总结/结论部分，禁止保存完整的审查输出过程，避免内容篇幅过大
    - `<story-id>` 只包含 epic 和 story 的序号（如 1-1、1.1、1·1），不包括 story name
    - 始终使用中文输出审查结果
    - 复审时必须标注哪些问题是新发现的、哪些是上轮遗留的
    - 输出文件头部的 `Model Used` 字段必须如实填写当前执行审查的模型名称，便于跨 LLM 追溯和质量归因
    - 如果找不到 Story 文件或关联代码，立即停止并告知用户
