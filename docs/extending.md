# Extending aiforge | 扩展指南

This guide explains how to add support for new AI tools to aiforge.

## Architecture Overview

aiforge uses a **data-driven** approach: adding a new AI tool requires only modifying two data files — no engine code changes needed.

```
Tool Detection (tool-registry.ts)    Install Rules (install-rules.ts)
┌──────────────────────────┐        ┌──────────────────────────┐
│ ToolDefinition[]         │        │ InstallRule[]            │
│ - id: 'newtool'          │        │ - tool: 'newtool'        │
│ - detect.global: [...]   │        │ - scope: 'global'        │
│ - detect.project: [...]  │        │ - sourceDir: 'skills'    │
│                          │        │ - type: Flatten           │
│                          │        │ - targetDir: '~/.newtool/'│
└──────────────────────────┘        └──────────────────────────┘
```

## Step 1: Register the Tool

Add a `ToolDefinition` entry in `src/data/tool-registry.ts`:

```typescript
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ...existing tools...
  {
    id: 'newtool',           // Unique identifier, used in CLI (-t newtool)
    name: 'New AI Tool',     // Human-readable display name
    detect: {
      global: ['~/.newtool'],         // Paths that indicate global install
      project: ['.newtool'],          // Paths that indicate project-level usage
    },
  },
]
```

**Detection logic:** aiforge checks if any of the listed paths exist. If at least one path exists, the tool is considered "detected" for that scope.

## Step 2: Add Install Rules

Add `InstallRule` entries in `src/data/install-rules.ts`:

```typescript
const Files: InstallType = 'Files' as InstallType
const Directories: InstallType = 'Directories' as InstallType
const Flatten: InstallType = 'Flatten' as InstallType

export const BUILTIN_RULES: InstallRule[] = [
  // ...existing rules...

  // New Tool: global rules
  {
    tool: 'newtool',
    scope: 'global',
    sourceDir: 'skills',           // Source directory in knowledge repo
    type: Flatten,                 // Install type
    targetDir: '~/.newtool/rules/',  // Target directory
  },
  {
    tool: 'newtool',
    scope: 'global',
    sourceDir: 'agents',
    type: Files,
    targetDir: '~/.newtool/agents/',
  },

  // New Tool: project rules
  {
    tool: 'newtool',
    scope: 'project',
    sourceDir: 'skills',
    type: Flatten,
    targetDir: '.newtool/rules/',
  },
]
```

## Install Types Explained

| Type | Behavior | Example |
|------|----------|---------|
| `Files` | Copy each file individually | `agents/*.md` → `target/*.md` |
| `Directories` | Copy entire subdirectories | `skills/code-review/` → `target/code-review/` |
| `Flatten` | Extract main file from each subdirectory and rename | `skills/code-review/skill.md` → `target/code-review.md` |

### When to Use Each Type

- **Files** — When the target tool expects individual files in a flat directory (e.g., Copilot agents)
- **Directories** — When the target tool expects complete directory structures (e.g., Copilot skills with sub-files)
- **Flatten** — When the target tool expects flat files named after concepts (e.g., Cursor rules)

## Step 3: Test Your Changes

After adding the tool and rules:

```bash
# Run the test suite
npm test

# Verify detection works
npx @fancyliu/aiforge --list skills

# Preview installation without writing
npx @fancyliu/aiforge -t newtool --dry-run
```

## Type Definitions Reference

### ToolDefinition

```typescript
interface ToolDefinition {
  id: string              // Tool identifier (used in CLI --tools flag)
  name: string            // Human-readable display name
  detect: {
    global: string[]      // Paths to check for global detection
    project: string[]     // Paths to check for project detection
  }
}
```

### InstallRule

```typescript
interface InstallRule {
  tool: string            // Tool ID (must match ToolDefinition.id)
  scope: 'global' | 'project'
  sourceDir: string       // Source directory name in knowledge repo
  type: InstallType       // Files | Directories | Flatten
  targetDir: string       // Target directory (~ expanded at runtime)
}
```

## Module Architecture

```
src/
├── data/
│   ├── tool-registry.ts    ← ADD tool definition here
│   └── install-rules.ts    ← ADD install rules here
├── stages/
│   ├── detect-tools.ts     # Reads TOOL_DEFINITIONS, no changes needed
│   ├── match-rules.ts      # Reads BUILTIN_RULES, no changes needed
│   └── execute-install.ts  # Generic installer, no changes needed
└── pipeline.ts             # Orchestrator, no changes needed
```

**Key design principle:** The detection engine, rule matcher, and installer are all generic — they operate on the data arrays without hardcoded tool knowledge. This is why adding a new tool is purely a data change.

## Universal Directory Rules

In addition to `BUILTIN_RULES`, aiforge has a separate `UNIVERSAL_RULES` array in `install-rules.ts` that installs to tool-agnostic directories (`.agents/` and `.agent/`).

```typescript
// These rules are NOT added to RULE_INDEX (not matched via tool detection).
// Instead, the Match stage appends them separately after tool-specific matching.
export const UNIVERSAL_RULES: InstallRule[] = [
  { tool: 'universal', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.agents/skills/' },
  { tool: 'universal', scope: 'project', sourceDir: 'agents', type: Files,       targetDir: '.agents/agents/' },
  { tool: 'universal', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.agent/skills/' },
  { tool: 'universal', scope: 'project', sourceDir: 'agents', type: Files,       targetDir: '.agent/agents/' },
]
```

**Key points:**
- `tool: 'universal'` is a virtual tool ID — it's not registered in `TOOL_DEFINITIONS` and won't be auto-detected
- Universal rules are controlled by the `universalDirs` config flag and `--no-universal` CLI option
- They run in parallel with tool-specific rules, not instead of them
