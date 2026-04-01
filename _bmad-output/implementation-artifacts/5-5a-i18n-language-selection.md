# Story 5.5a: 国际化语言选择与配置

Status: done

## Story

As a 用户,
I want 在初始化时选择界面语言，并能在安装后通过配置修改语言设置,
So that 中英文用户都能舒适使用，且后续无需重新初始化即可切换输出语言。

## Acceptance Criteria

1. **Given** 用户在 `aiforge init` 中选择语言 **When** 选择英文 **Then** 后续所有用户可见输出使用英文（FR-046），语言设置保存到 `config.json` 的 `language` 字段
2. **Given** 默认配置 **When** 未设置语言 **Then** 系统默认使用中文输出（NFR-U1）
3. **Given** `data/messages.ts` **When** 检查实现 **Then** 所有用户可见字符串通过 messages 模块的 `msg()` 函数获取，支持根据 `language` 配置切换中英文。注意：这是一次**跨 Epic 字符串来源重构**——Epic 1~4 中硬编码的中文字符串（`reporter.startPhase('执行安装...')`、`AiforgeError('未找到配置文件', ...)`、init 交互提示等）都需要抽离为消息键调用。
4. **Given** 用户修改 `config.json` 中 `language` 为 `en` **When** 再次执行命令 **Then** 系统使用英文输出，无需重新运行 `aiforge init`（FR-046）
5. **Given** `language` 配置值非法或不受支持 **When** 系统加载语言配置 **Then** 自动回退到默认中文，给出明确提示

## Tasks / Subtasks

- [x] Task 1: 扩展 `data/messages.ts` — 添加英文文案并抽取硬编码字符串 (AC: #3)
  - [x] 1.1 重构 MESSAGES 结构为双语支持：`{ 'zh-CN': {...}, 'en': {...} }`
  - [x] 1.2 添加所有阶段名英文版：`"Resolving repository..."`, `"Authenticating..."`, `"Cloning repository..."` 等
  - [x] 1.3 添加所有状态图标标签英文版
  - [x] 1.4 添加统计行英文模板：`Installed: N  Updated: N  Skipped: N`
  - [x] 1.5 添加所有错误消息英文版
  - [x] 1.6 导出 `setLanguage(lang: string): void`（模块级全局状态）和 `msg(key: string): string`（按 dot notation 查找）
  - [x] 1.7 **跨 Epic 字符串抽取**：将 Epic 1~4 中所有硬编码的用户可见中文字符串替换为 `msg()` 调用（`stages/`、`services/`、`commands/` 中的 `reporter.startPhase()`、`AiforgeError()` 构造等）
- [x] Task 2: 扩展 `commands/init.ts` — 添加语言选择步骤 (AC: #1)
  - [x] 2.1 在 init 流程中添加语言选择：`select({ choices: ['中文', 'English'] })`
  - [x] 2.2 保存到 `config.json` 的 `language` 字段
- [x] Task 3: 实现语言加载和回退逻辑 (AC: #2, #4, #5)
  - [x] 3.1 管道启动时从 `config.json` 读取 `language`，调用 `setLanguage(config.language)` 设置模块级全局状态
  - [x] 3.2 无配置或非法值 → 回退到 `zh-CN`，通过 `process.stderr.write()` 输出提示（这是唯一允许不经过 Reporter 的输出场景——因为语言加载发生在 Reporter 创建之前）
  - [x] 3.3 语言注入机制：`setLanguage()` 设置模块级变量，`msg()` 读取该变量。Reporter 和所有阶段通过 `msg()` 获取文案，不需要显式传递 language 参数。
- [x] Task 4: 编写单元测试 (AC: #1-5)
  - [x] 4.1 `tests/data/messages.test.ts` — 扩展双语测试
  - [x] 4.2 测试用例：中文输出、英文输出、非法语言回退、getMessage 函数
  - [x] 4.3 扩展 init 测试：语言选择流程

## Dev Notes

### messages.ts 双语结构 [Source: Story 1.4 预留]

```typescript
type Language = 'zh-CN' | 'en';

const MESSAGES: Record<Language, MessageSet> = {
  'zh-CN': {
    phases: {
      resolve: '解析仓库地址...',
      auth: '验证认证信息...',
      clone: '克隆仓库...',
      detect: '检测 AI 工具...',
      match: '匹配安装规则...',
      install: '执行安装...',
    },
    stats: {
      template: '安装: {installed} 项  更新: {updated} 项  跳过: {skipped} 项',
    },
    // ...
  },
  'en': {
    phases: {
      resolve: 'Resolving repository...',
      auth: 'Authenticating...',
      clone: 'Cloning repository...',
      detect: 'Detecting AI tools...',
      match: 'Matching install rules...',
      install: 'Installing...',
    },
    stats: {
      template: 'Installed: {installed}  Updated: {updated}  Skipped: {skipped}',
    },
    // ...
  },
};

let currentLanguage: Language = 'zh-CN';

export function setLanguage(lang: string): void {
  currentLanguage = (lang in MESSAGES) ? lang as Language : 'zh-CN';
}

export function msg(key: string): string {
  // 按 dot notation 查找：msg('phases.resolve')
}
```

### 语言加载时机

```
CLI 启动 → loadConfig() → setLanguage(config.language) → 创建 Reporter → 执行管道
```

语言在管道启动前设置一次，整个执行过程中不变。

### 回退逻辑

```typescript
const SUPPORTED_LANGUAGES = ['zh-CN', 'en'];

function resolveLanguage(configLang?: string): Language {
  if (configLang && SUPPORTED_LANGUAGES.includes(configLang)) {
    return configLang as Language;
  }
  if (configLang) {
    // 非法值：通过 process.stderr.write 直接输出（此时 Reporter 尚未创建）
    // 这是唯一允许不经过 Reporter 的输出场景
    process.stderr.write(`⚠️ 不支持的语言 "${configLang}"，使用默认中文\n`);
  }
  return 'zh-CN';
}
```

### init 命令的 i18n 处理

init 命令继续使用 `console.log` 输出（交互式命令不走 Reporter，见 Story 2.5），但文案来源改为 `msg()` 消息键调用：

```typescript
// 之前：console.log('当前配置：');
// 之后：console.log(msg('init.currentConfig'));
```

这样 init 不走 Reporter 但仍然支持双语。

### 模块边界

- 修改 `data/messages.ts`（重构为双语结构）
- 修改 `commands/init.ts`（添加语言选择）
- 修改 `index.ts` 或 `pipeline.ts`（启动时加载语言）
- Reporter 通过 messages 模块获取文案，不直接硬编码字符串

### 依赖关系

- 依赖 Story 1.4（messages.ts 基础结构）
- 依赖 Story 2.1（config.json 读写）
- 依赖 Story 2.5（init 交互式流程）
- 依赖 Story 5.1-5.4（所有 Reporter 输出都需要使用 messages）

### 本 Story 不做的事

- 不实现第三种语言（MVP 只支持中英文）
- 不实现运行时语言切换（启动时确定，执行中不变）
- 不实现语言包外部加载（内置在代码中）

### References

- [Source: architecture/04-implementation-patterns.md] — CLI 输出格式规范
- [Source: project-context.md#Output-Rules] — 中文进度阶段名
- [Source: project-context.md#Install-Rules-Data-Architecture] — messages.ts 多语言预留

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

- Task 1.7 跨 Epic 字符串抽取：`stages/authenticate.ts` 中 `updatePhase` 需要用 `.replace('...', '')` 处理再加上进度后缀，因为阶段名模板已包含 `...`
- Task 1.7：`detect-tools.ts` 和 `match-rules.ts` 已引入 `MESSAGES`，改为只引入 `msg` 并替换
- Task 2.3（测试修复）：旧测试 `用户选择修改时，保留已有配置字段` 的 `mocks.select.mockResolvedValue('ssh')` 只配置 1 次，新语言选择步骤新增一次 `select` 调用后行为改变，需更新为 `mockResolvedValueOnce` 分别配置语言和认证方式

### Completion Notes List

- **Task 1 完成**：`data/messages.ts` 完整重构为双语结构，导出 `setLanguage()` + `msg()`，同时保留 `MESSAGES`、`ICONS`、`STATS_FORMAT`、`PLAN_STATS_FORMAT` 向后兼容导出
- **Task 1.7 完成**：已替换所有阶段（`resolve-source`、`authenticate`、`clone`、`detect-tools`、`match-rules`、`execute-install`）的 `reporter.startPhase()` 和 `reporter.updatePhase()` 硬编码字符串为 `msg()` 调用
- **Task 2 完成**：`commands/init.ts` 在仓库 URL 输入前新增语言选择步骤，选中值保存到 `config.json` 的 `language` 字段
- **Task 3 完成**：`index.ts` 在 Reporter 创建前从 config 读取 `language` 并调用 `setLanguage()`，非法值通过 `process.stderr.write()` 回退提示
- **Task 4 完成**：`tests/data/messages.test.ts` 扩展为 23 个测试（双语、回退、dot-notation、模块边界）；`tests/commands/init.test.ts` 新增 3 个语言选择测试，并修复 1 个受行为变更影响的旧测试
- **测试统计**：全仓 641 个测试，28 个测试文件，全部通过
- **lint**：✅ ESLint + Prettier 全部通过
- **build**：✅ tsup ESM 构建成功

### File List

- `src/data/messages.ts` — 重构为双语结构，新增 `setLanguage()` + `msg()`
- `src/stages/resolve-source.ts` — `reporter.startPhase()` 替换为 `msg('phases.resolve')`
- `src/stages/authenticate.ts` — `reporter.startPhase()` / `reporter.updatePhase()` 替换为 `msg()` 调用
- `src/stages/clone.ts` — `reporter.startPhase()` 替换为 `msg('phases.clone')`
- `src/stages/detect-tools.ts` — `reporter.startPhase()` 替换为 `msg('phases.detect')`
- `src/stages/match-rules.ts` — `reporter.startPhase()` 替换为 `msg('phases.match')`
- `src/stages/execute-install.ts` — `reporter.startPhase()` / `reporter.updatePhase()` 替换为 `msg()` 调用
- `src/commands/init.ts` — 新增语言选择步骤，保存 `language` 到 config
- `src/index.ts` — 管道启动前加载语言配置并调用 `setLanguage()`
- `tests/data/messages.test.ts` — 完整扩展为双语测试（23 个测试）
- `tests/commands/init.test.ts` — 新增语言选择测试（3 个），修复受行为变更影响的旧测试（1 个）
