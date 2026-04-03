# CR Rule Extraction Context Summary

## Document Overview

This summary covers the key project documents for the ai-forge project to support CR rule extraction and placement.

---

## 1. PROJECT-CONTEXT.MD (AI Agent Rules File)

**Location:** `_bmad-output/project-context.md`
**Audience:** AI Agents (LLM-optimized)
**Purpose:** Critical implementation rules and patterns

### Document Structure (Table of Contents)

1. Rule Document Registry (lines 17-27)
2. Technology Stack & Versions (lines 31-43)
3. Critical Implementation Rules:
   - TypeScript & ESM Rules (lines 47-59)
   - Architecture Rules — Pipeline (lines 61-74)
   - Architecture Rules — Module Boundaries (lines 76-91)
   - Type Semantic Layers (lines 95-101)
   - Error Handling Rules (lines 103-124)
   - Input Validation Rules (lines 126-130)
   - Output Rules (lines 132-148)
   - **Security Rules (lines 150-163)** ⭐
   - Data Format Rules (lines 165-171)
   - Testing Rules (lines 173-188)
   - CR Workflow Rules (lines 190-195)
   - Install Rules Data Architecture (lines 197-203)
   - Critical Don't-Miss Rules (lines 205-213)
4. Usage Guidelines (lines 217-233)

### Key Sections for CR Extraction

#### Security Rules (Lines 150-163)

```markdown
### Security Rules

- **npm package MUST contain ZERO company info** — no repo URLs, tokens, hostnames
- Token exists in memory ONLY during clone; cleared immediately after
- All logs/errors use `sanitizeToken()` from `core/sanitize.ts`
- config.json file permissions: `0o600` (user-only read/write)
- Token display format: `glpat-ab****mnop` (first 8 + `****` + last 4 chars); 
  short tokens (<= 12 chars): first 4 + `****` (no tail)
- **symlink 感知的文件系统 API 选用规则：** [detailed rules about lstat/stat/access/realpath]
- **路径安全校验必须使用 `realpath()` 双边比较：** [symlink escape prevention]
- **sanitizeToken 边界验证：** token length thresholds at boundary conditions
- **sanitizeUrl 必须处理 `oauth2:token@host` 格式：** GitLab standard format handling
- **脱敏函数必须覆盖边界形态输入：** edge cases for sanitization
- **三种脱敏函数适用场景不可混用：** sanitizeToken vs sanitizeUrl vs sanitizeMessage
- **安全校验必须在最终 I/O 操作路径上执行：** [preflight vs actual path validation]
```

#### Output Rules (Lines 132-148)

```markdown
### Output Rules

- **ALL user-visible output MUST go through Reporter interface** — never `console.log` directly
- **Exceptions (formally allowed):**
  - `aiforge init` 交互式命令：使用 `console.log` + `@inquirer/prompts` 直接输出
  - Reporter 创建前的语言回退提示：允许 `process.stderr.write()`
- Three Reporter implementations: `TtyReporter` (spinner+color), `PlainReporter` (CI/non-TTY), `QuietReporter` (--quiet)
- Progress phase names: verb + object in Chinese
- Result icons: `✅` new, `🔄` updated, `⏭️` skipped
- Stats line: `安装: N 项  更新: N 项  跳过: N 项`
- Output strings centralized in `core/messages.ts`
- **i18n 字符串覆盖完整性：** [detailed completeness checklist]
- **子命令独立语言初始化：** subcommands must independently set language
- **CLI help 文案不做国际化：** use English hardcoding, not msg()
- **进度计数变量的分子/分母必须绑定到同一语义单元：** [progress tracking semantics]
- **输出通道与 TTY 能力判定必须绑定到同一 fd：** [fd consistency requirements]
- **PlainReporter 输出方法内所有行必须遵从同一分隔符契约：** [tab-separator consistency]
```

#### Testing Rules (Lines 173-188)

```markdown
### Testing Rules

- Test files mirror src: `src/stages/clone.ts` → `tests/stages/clone.test.ts`
- `describe` uses module name, `it` uses behavior description
- External deps (simple-git, fs) → vitest mock
- Internal modules → prefer real implementation, mock only when necessary
- PathResolver → inject mock with fixed paths in tests
- Unit tests: each pipeline stage independently, mock external deps
- Integration tests: end-to-end pipeline with temp dirs and fixture repos
- **标记为集成测试的文件必须至少覆盖一条真实闭包/工厂函数路径：** [no all-mock integration tests]
- **Mock 断言必须验证被测函数的实际调用链：** [verify actual production paths, not mock behavior]
- **测试断言必须基于 Story 契约而非当前实现行为：** [contract-first testing]
- **CR 修复改变行为后必须同步更新所有与"旧行为"绑定的测试断言：** [update all affected assertions]
- **Story Dev Notes 的 UI/格式代码示例是实现契约：** [format examples are requirements]
- **i18n 测试必须验证"实际输出内容切换"：** [verify actual output, not config persistence]
- **禁止通过选择性测试路径绕行已知缺陷：** [fix or explicitly skip, don't hide bugs]
```

---

## 2. 04-IMPLEMENTATION-PATTERNS.MD (Human-Readable Patterns)

**Location:** `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`
**Audience:** Humans (implementation guides)
**Purpose:** Detailed implementation patterns and consistency rules

### Document Structure (Table of Contents)

1. Potential Conflict Points (intro)
2. Naming Patterns (lines 9-37)
3. Structure Patterns (lines 38-65)
4. Pipeline Stage Patterns (lines 67-115)
5. Type Semantic Layers (lines 117-124)
6. Data Format Patterns (lines 126-140)
7. Error Handling Patterns (lines 142-330)
   - Key sections:
     - catch 块必须区分错误类型 (lines 150-167)
     - catch 降级必须逐码白名单 (lines 169-193)
     - fs 存在性检查 ENOENT/ENOTDIR 白名单降级 (lines 195-220)
     - 复用函数接入新类型时必须审查内部所有分支 (lines 280-307)
     - 跨层共享字段禁止语义扩展 (lines 309-323)
     - CR 修复变更类型定义或函数签名时必须全仓 grep (lines 325-342)
8. CLI Output Patterns (lines 405-547)
9. Input Validation Patterns (lines 550-595)
10. Security Patterns (lines 597-723)
    - Token脱敏规则 (lines 599-603)
    - URL脱敏规则 (lines 605-608)
    - 脱敏函数必须覆盖边界形态输入 (lines 610-613)
    - 三种脱敏函数适用场景 (lines 628-650)
    - symlink感知的文件系统API (lines 652-678)
    - 路径安全校验必须使用realpath()双边比较 (lines 680-699)
    - 安全校验必须在最终I/O操作路径上执行 (lines 701-723)
11. Testing Patterns (lines 725-930)
12. CR Workflow Patterns (lines 931-1014)
13. Enforcement Guidelines (lines 1016-1027)

### Key Security Sections (Lines 597-723)

#### Token Deobfuscation Rules (Lines 599-603)
- Token length > 12: `first 8 + **** + last 4`
- Token length <= 12: `first 4 + ****` (no tail)
- Boundary verification required at threshold edges

#### URL Deobfuscation Rules (Lines 605-608)
- GitLab standard format: `https://oauth2:${token}@host/repo.git`
- Only deobfuscate credential part after colon, preserve `oauth2:` prefix

#### Edge Case Coverage (Lines 610-613)
- Regex/matching must handle boundary forms (incomplete URLs, missing host, truncated tokens)
- Any AiforgeError `why` field containing user input must be sanitized
- No omissions allowed ("漏调")

#### Three Deobfuscation Function Matrix (Lines 628-650)

| Function | Use Case | Implementation |
|----------|----------|-----------------|
| `sanitizeToken()` | Independent token string | Length-based truncation + masking |
| `sanitizeUrl()` | Pure URL string | Regex with `^` anchor (matches pure URL format only) |
| `sanitizeMessage()` | Arbitrary strings (git error messages) | Global replacement regex, no anchor (handles embedded token URLs) |

**Critical Rule:** When writing exception `error.message` to `AiforgeError.why`, **MUST use `sanitizeMessage()` not `sanitizeUrl()`** because git error messages can embed URLs anywhere.

#### Symlink-Aware Filesystem API Selection (Lines 652-678)

| API | Symlink Behavior | Use Case |
|-----|------------------|----------|
| `lstat()` | **Does NOT follow** symlink | Identify symlink itself |
| `stat()` | **Follows** symlink | Get final target type |
| `access()` | **Follows** symlink | Returns ENOENT for broken symlinks (not permission error) |
| `realpath()` | **Resolves** symlink | Path security validation |

#### Path Security Validation (Lines 680-699)
- MUST use `realpath()` for both the path being checked and the safe root
- MUST compare physical paths, not string prefixes
- NEVER use `resolve()` for security checks (pure string operation, doesn't follow symlinks)
- For non-existent paths, find deepest existing ancestor, `realpath()` it, then append non-existent tail

#### Security Check Placement (Lines 701-723)
- Preflight checks (targetPath directory level) are NOT sufficient
- MUST validate final operation paths (e.g., `destPath = join(targetPath, basename(srcPath))`)
- Symlinks in allowed directories can point outside boundaries
- Pattern: preflight checks directory → operation-level checks final path

---

## 3. 03-CORE-DECISIONS.MD (Architectural Decisions)

**Location:** `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
**Audience:** Humans (architecture documentation)
**Purpose:** Rationale and design details for core architectural decisions

### Document Structure (Table of Contents)

1. Decision Priority Analysis (lines 3-19)
   - 10 Critical Decisions (block implementation)
2. Decision Details (lines 23-277)
   - D1: Knowledge Source Abstraction — SourceResolver
   - D2: Install Rules Data Architecture
   - D3: State Management (config.json + manifest.json)
   - D4: Error Handling & Output Strategy
   - D5: Tool Detection & Platform Abstraction
   - D6: Pipeline Orchestration
3. Deferred Decisions (Post-MVP) (lines 249-256)
4. Decision Impact Analysis (lines 258-276)

### Key Security Decision Details (D4 Section, Lines 100-167)

#### Error Type Strategy (Lines 102-117)

```typescript
class AiforgeError extends Error {
  code: string;                // Error identifier
  exitCode: number;            // 0=success, 1=install failure, 2=auth failure, 3=arg error
  severity: 'fatal';           // Always 'fatal' (Install fail-fast, no partial)
  why: string;                 // Why it happened (short reason)
  fix: string[];               // How to fix (copyable commands)
}
```

- Pipeline coordinator: `fatal` → stop immediately and report
- Install stage I/O errors throw `AiforgeError(severity: 'fatal')` → pipeline terminates
- `InstallResult` has only 3 states: `'new'` | `'updated'` | `'skipped'` (NO `'failed'`)
- Reporter renders three-part message: `❌ ${message}` → `${why}` → `${fix.join('\n')}`

#### stdout/stderr Division Rules (Lines 139-151)

| Method | Output Stream | Reason |
|--------|---------------|--------|
| `reportResult()` | stdout | Installation results can be piped (`npx aiforge \| grep copilot`) |
| `reportPlan()` | stdout | dry-run plan also supports scripting |
| `startPhase()` | stderr | Progress is diagnostic, shouldn't pollute pipe data |
| `updatePhase()` | stderr | Same as above |
| `completePhase()` | stderr | Same as above |
| `reportError()` | stderr | Standard CLI convention for errors |
| `warn()` | stderr | Non-fatal warnings (broken links, missing mainFile) |

**Pattern:** `npx aiforge --dry-run 2>/dev/null` outputs pure install plan for `grep`/`awk`/`jq` parsing.

#### Deobfuscation Functions (Lines 165-167)

Three scenario-specific functions (cannot be mixed):

1. `sanitizeToken()` — independent token strings
2. `sanitizeUrl()` — pure URLs (with `^` anchor regex)
3. `sanitizeMessage()` — arbitrary strings with embedded token URLs (global regex, no anchor)

**Source:** Story 5-4 CR Round 1 — `CLONE_FAILED`/`PULL_FAILED` `why` fields directly passed `error.message`, exposing complete clone URL with token. Fixed by adding `sanitizeMessage()` for this scenario.

---

## 4. CLAUDE.MD (Project Instructions)

**Location:** `CLAUDE.md` (project root)
**Content:** Rule Document Registry synchronization rules and constraints

### Key Sections

1. **Rule Document Registry Synchronization Rules** (lines 3-19)
   - After running `generate-project-context` workflow to generate `project-context.md`
   - Must include **Rule Document Registry** section with three documents table
   - If missing, manually add the registry section

2. **规则变更同步约束** (lines 21-23)
   - Any story execution, code review, or temporary decisions that modify/add/confirm rules
   - Must synchronize updates to ALL documents in Rule Document Registry in same operation
   - No omissions allowed

---

## 5. NPM PACKAGE & VERIFICATION GUIDELINES

### npm package Security (from project-context.md lines 152-156, 04-implementation-patterns.md lines 599-650)

**Critical Security Rule:**
- **npm package MUST contain ZERO company info** — no repo URLs, tokens, hostnames
- Token exists in memory ONLY during clone; cleared immediately after
- All logs/errors use deobfuscation functions
- config.json file permissions: `0o600` (user-only read/write)

### Verification Methods (from 04-implementation-patterns.md Testing Patterns section, lines 725-930)

Key testing verification standards:

1. **Test Structure:**
   - Test files mirror src structure: `src/stages/X.ts` → `tests/stages/X.test.ts`
   - Describe uses module name, it uses behavior description
   - External deps (simple-git, fs) → vitest mock
   - Internal modules → prefer real implementation

2. **Integration Testing (Critical):**
   - Must use real factory functions (createProductionStages)
   - Cannot be all-mock (all-mock only verifies call order, not logic)
   - If pure orchestration needed, explicitly label as `(orchestration-only)`

3. **Mock Assertions:**
   - Must verify actual production call chains
   - For security-critical behavior (token deobfuscation), cannot just call mock directly
   - Must trigger mock through tested function entry point

4. **Assertion Standards:**
   - Based on Story contract, not current implementation
   - Must update assertions when CR fixes change behavior
   - Story format examples are requirements, not suggestions

5. **i18n Testing:**
   - Verify actual output content switching (not just config persistence)
   - Check Reporter statistics, error messages, fix arrays
   - Check Reporter quantity words (e.g., `${n} 项` vs `${n} items`)

6. **Bug Handling:**
   - Cannot hide known defects through selective test paths
   - Must either: (1) fix defect, (2) explicitly skip with `it.skip(...)`, or (3) mark as blocking
   - Test green ≠ feature works if bugs hidden

---

## 6. SECTION HEADINGS - COMPLETE REFERENCE

### project-context.md
- Rule Document Registry
- Technology Stack & Versions
- Critical Implementation Rules
  - TypeScript & ESM Rules
  - Architecture Rules — Pipeline
  - Architecture Rules — Module Boundaries
  - Type Semantic Layers
  - Error Handling Rules
  - Input Validation Rules
  - Output Rules
  - **Security Rules** ⭐
  - Data Format Rules
  - Testing Rules
  - CR Workflow Rules
  - Install Rules Data Architecture
  - Critical Don't-Miss Rules
- Usage Guidelines

### 04-implementation-patterns.md
- Naming Patterns
- Structure Patterns
- Pipeline Stage Patterns
- Type Semantic Layers
- Data Format Patterns
- Error Handling Patterns
- CLI Output Patterns
- Input Validation Patterns
- **Security Patterns** ⭐
- Testing Patterns
- CR Workflow Patterns
- Enforcement Guidelines

### 03-core-decisions.md
- Decision Priority Analysis
- Decision Details
  - D1: Knowledge Source Abstraction
  - D2: Install Rules Data Architecture
  - D3: State Management
  - D4: Error Handling & Output Strategy ⭐
  - D5: Tool Detection & Platform Abstraction
  - D6: Pipeline Orchestration
- Deferred Decisions
- Decision Impact Analysis

---

## 7. RECOMMENDED PLACEMENT FOR NEW CR RULES

Based on document purposes and existing structure:

### For Security-Related Rules:
- **project-context.md (lines 150-163):** Concise, LLM-optimized rules
- **04-implementation-patterns.md (lines 597-723):** Detailed implementation patterns with examples
- **03-core-decisions.md (D4 section, lines 100-167):** Architectural rationale and context

### For npm Package / Verification Rules:
- **04-implementation-patterns.md (Testing Patterns section, lines 725-930):** Detailed verification requirements with code examples
- **project-context.md (Testing Rules section, lines 173-188):** Concise verification checklist
- **03-core-decisions.md (D4 section):** If related to output/error handling architecture

### For Output/CLI Rules:
- **project-context.md (Output Rules, lines 132-148):** Rules list
- **04-implementation-patterns.md (CLI Output Patterns, lines 405-547):** Detailed patterns with examples
- **03-core-decisions.md (D4 Output Strategy section):** Architectural reasoning

### Rule Synchronization Requirement:
- ANY rule added/modified must be synchronized across all three documents
- project-context.md = rules for AI agents (concise)
- 04-implementation-patterns.md = patterns for humans (detailed with examples)
- 03-core-decisions.md = decisions with rationale (architecture focus)

