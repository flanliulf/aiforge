# `npx aiforge -g -l` 详解

## 参数拆解

```
npx aiforge -g -l
             │  │
             │  └── --link     符号链接模式（替代默认的文件复制模式）
             │
             └───── --global   安装到用户全局目录（替代默认的项目目录）
```

---

## 两种模式对比

### 复制模式（默认，不加 `-l`）

```
npx aiforge -g

执行过程：
                                                   安装完成后
  ┌────────────────┐    git clone    ┌────────┐    立即删除
  │ 远程仓库        │ ──────────────→ │ /tmp/  │ ──────────×
  │ aicoding-base  │                 │ aiforge│
  └────────────────┘                 │ -xxxxx/│
                                     └───┬────┘
                                         │
                                    复制文件（cp）
                                         │
                                         ▼
                                  ~/.copilot/agents/
                                  ~/.copilot/skills/
                                  ~/.claude/skills/
                                  ...

结果：
  /tmp/aiforge-xxxxx/    ← 已删除，不存在了
  ~/.copilot/agents/
    └── api-dev.agent.md          ← 独立文件副本，与仓库无关
  ~/.copilot/skills/
    └── tapd/
        └── skill.md              ← 独立文件副本，与仓库无关
```

**问题：** 仓库更新后，必须重新执行 `npx aiforge -g` 重新复制。文件是「快照」，与源仓库断开了联系。

---

### 符号链接模式（`-l`）

```
npx aiforge -g -l

执行过程：
  ┌────────────────┐    git clone     ┌──────────────────────┐
  │ 远程仓库        │ ──────────────→  │ ~/aicoding-base/     │  ← 持久保留！
  │ aicoding-base  │                  │  ├── agents/          │
  └────────────────┘                  │  │   └── api-dev.agent.md
                                      │  ├── skills/          │
                                      │  │   ├── tapd/        │
                                      │  │   └── git/         │
                                      │  ├── instructions/    │
                                      │  └── mcp-tools/       │
                                      └──────────┬───────────┘
                                                  │
                                          创建符号链接（symlink）
                                                  │
                                                  ▼
                                      ~/.copilot/agents/   → 链接
                                      ~/.copilot/skills/   → 链接
                                      ~/.claude/skills/    → 链接
                                      ...
```

---

## 符号链接在磁盘上的真实样子

```bash
# 执行后查看文件系统

$ ls -la ~/.copilot/

drwxr-xr-x  agents -> ~/aicoding-base/agents      # 符号链接！
drwxr-xr-x  skills -> ~/aicoding-base/skills      # 符号链接！
lrwxr-xr-x  copilot-instructions.md -> ~/aicoding-base/instructions/copilot-instructions.md
lrwxr-xr-x  mcp.json -> ~/aicoding-base/mcp-tools/mcp.json

$ ls -la ~/.claude/

drwxr-xr-x  skills -> ~/aicoding-base/skills      # 符号链接！
```

**符号链接不是文件副本**，它是一个「指针」，指向实际文件所在的位置：

```
┌──────────────────────────────────────────────────────────────┐
│                          磁盘                                 │
│                                                              │
│   ~/aicoding-base/agents/api-dev.agent.md   ← 真实文件       │
│        ▲    ▲                                                │
│        │    │                                                │
│        │    └── ~/.copilot/agents/  (符号链接，指向上面)        │
│        │                                                     │
│        └─── VS Code 读取 ~/.copilot/agents/ 时               │
│             实际读到的是 ~/aicoding-base/agents/ 的内容        │
│                                                              │
│   文件只有一份！链接只是路径别名                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 链接粒度

根据安装规则的不同，符号链接可能是**目录级别**或**文件级别**：

```
~/.copilot/
├── agents/              → ~/aicoding-base/agents/         # 目录链接（整个目录）
├── skills/              → ~/aicoding-base/skills/         # 目录链接（整个目录）
├── copilot-instructions.md → ~/aicoding-base/instructions/copilot-instructions.md  # 文件链接
└── mcp.json             → ~/aicoding-base/mcp-tools/mcp.json                      # 文件链接

~/.claude/
└── skills/              → ~/aicoding-base/skills/         # 目录链接

~/.cursor/rules/
├── tapd.md              → ~/aicoding-base/skills/tapd/skill.md    # 文件链接（flatten 模式）
├── git.md               → ~/aicoding-base/skills/git/skill.md     # 文件链接
└── eslint.md            → ~/aicoding-base/skills/eslint/skill.md  # 文件链接
```

对应的安装规则类型与链接粒度的关系：

| 安装类型 | 链接粒度 | 示例 |
|---------|---------|------|
| `directories` | 子目录 → 子目录 | `skills/tapd/` → `~/.copilot/skills/tapd/` |
| `files` | 文件 → 文件 | `copilot-instructions.md` → `~/.copilot/copilot-instructions.md` |
| `flatten` | 子目录/主文件 → 重命名文件 | `skills/tapd/skill.md` → `~/.cursor/rules/tapd.md` |

---

## 为什么 `-g -l` 组合是推荐方式

### 核心优势：更新自动生效

```
Day 1: 安装
──────────────────────────────────────
npx aiforge -g -l

~/aicoding-base/agents/api-dev.agent.md      ← 文件 v1
        ▲
~/.copilot/agents/ (链接) ─────────────────→ 读到 v1 ✓


Day 30: 团队更新了 aicoding-base
──────────────────────────────────────
npx aiforge update
  → 内部执行: cd ~/aicoding-base && git pull

~/aicoding-base/agents/api-dev.agent.md      ← 文件已变成 v2（git pull 更新的）
        ▲
~/.copilot/agents/ (链接不变) ──────────────→ 自动读到 v2 ✓

无需重新安装！链接还是那个链接，但它指向的文件内容已经更新了。
```

**对比复制模式：**

```
Day 30: 复制模式的痛苦
──────────────────────────────────────
~/.copilot/agents/api-dev.agent.md   ← 还是 Day 1 复制的 v1 ！
                                       必须重新执行 npx aiforge -g 才能更新
```

### 完整优劣对比

```
                    复制模式 (默认)          符号链接模式 (-l)
                    ──────────────         ────────────────
磁盘占用             N 份副本               1 份 + N 个链接指针
更新方式             重运行命令覆盖           git pull 自动生效
离线可用             ✅ 文件已在本地          ✅ 文件已在本地
删除仓库后           ✅ 不受影响             ❌ 链接断裂（dangling symlink）
适合场景             项目独立快照            全局长期使用
Git 可追踪           ✅ 普通文件             ⚠️ 符号链接需要配置
Windows 兼容性       ✅ 无限制              ⚠️ 需要管理员权限或开发者模式
```

---

## 完整执行时序

```
用户执行: npx aiforge -g -l
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. 读取 ~/.aiforge/config.json                               │
│    → defaultRepo: https://gitlab.wshmi.com/.../aicoding-base │
│    → preferSSH: true                                         │
│    → cloneDir: ~/aicoding-base                               │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 检查 ~/aicoding-base/ 是否已存在                           │
│                                                             │
│    已存在 .git? ──→ YES: git pull（更新）                     │
│         │                                                   │
│         └──→ NO: git clone 到 ~/aicoding-base/（首次）        │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 自动检测全局 AI 工具                                       │
│                                                             │
│    扫描:                                                     │
│      ~/.copilot/       存在? ✅ → 加入目标列表                 │
│      ~/.claude/        存在? ✅ → 加入目标列表                 │
│      ~/.cursor/        存在? ❌ → 跳过                        │
│      VS Code settings  存在? ✅ → 加入目标列表                 │
│                                                             │
│    结果: [copilot, claude, vscode]                            │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. 筛选安装规则                                               │
│                                                             │
│    条件: scope=global AND tool IN [copilot, claude, vscode]  │
│                                                             │
│    匹配到的规则:                                               │
│    ┌──────────┬────────────────┬──────────────┬───────────┐  │
│    │ tool     │ sourceDir      │ type         │ targetDir │  │
│    ├──────────┼────────────────┼──────────────┼───────────┤  │
│    │ copilot  │ agents         │ files        │ ~/.cop... │  │
│    │ copilot  │ skills         │ directories  │ ~/.cop... │  │
│    │ copilot  │ instructions   │ files        │ ~/.cop... │  │
│    │ copilot  │ mcp-tools      │ files        │ ~/.cop... │  │
│    │ claude   │ skills         │ directories  │ ~/.cla... │  │
│    │ vscode   │ mcp-tools      │ files        │ ~/Lib/... │  │
│    └──────────┴────────────────┴──────────────┴───────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. 逐条执行规则 — 创建符号链接                                  │
│                                                             │
│  规则: copilot / agents / files                              │
│    扫描 ~/aicoding-base/agents/*.agent.md                    │
│    → ln -s ~/aicoding-base/agents/api-dev.agent.md          │
│            ~/.copilot/agents/api-dev.agent.md                │
│    → ln -s ~/aicoding-base/agents/pm.agent.md               │
│            ~/.copilot/agents/pm.agent.md                     │
│                                                             │
│  规则: copilot / skills / directories                        │
│    扫描 ~/aicoding-base/skills/ 下的子目录                    │
│    → ln -s ~/aicoding-base/skills/tapd                      │
│            ~/.copilot/skills/tapd                             │
│    → ln -s ~/aicoding-base/skills/git                       │
│            ~/.copilot/skills/git                              │
│                                                             │
│  规则: copilot / instructions / files                        │
│    → ln -s ~/aicoding-base/instructions/copilot-instr...    │
│            ~/.copilot/copilot-instructions.md                 │
│                                                             │
│  ... 其他规则类似 ...                                         │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. 输出结果汇总                                               │
│                                                             │
│  🔧 aiforge 安装完成                                          │
│                                                             │
│  📦 仓库: ~/aicoding-base (持久化，符号链接模式)                 │
│                                                             │
│  ┌ GitHub Copilot (全局)                                     │
│  │  ✅ agents/api-dev.agent.md  → ~/.copilot/agents/         │
│  │  ✅ agents/pm.agent.md       → ~/.copilot/agents/         │
│  │  ✅ skills/tapd/             → ~/.copilot/skills/tapd/    │
│  │  ✅ skills/git/              → ~/.copilot/skills/git/     │
│  │  ✅ copilot-instructions.md  → ~/.copilot/                │
│  │  ✅ mcp.json                 → ~/.copilot/                │
│  └                                                          │
│  ┌ Claude Code (全局)                                        │
│  │  ✅ skills/tapd/             → ~/.claude/skills/tapd/     │
│  │  ✅ skills/git/              → ~/.claude/skills/git/      │
│  └                                                          │
│  ┌ VS Code (全局)                                            │
│  │  ✅ mcp.json                 → ~/Library/.../Code/User/   │
│  └                                                          │
│                                                             │
│  安装: 11 项  跳过: 0 项  失败: 0 项                           │
│                                                             │
│  💡 更新配置: npx aiforge update                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 一句话总结

> **`-g` 决定装到哪（全局目录 vs 项目目录），`-l` 决定怎么装（符号链接 vs 文件复制）。两者组合的效果是：在本地持久保留一份仓库克隆，然后在各 AI 工具的全局配置目录中创建符号链接指向它，后续 `git pull` 更新仓库内容即可自动生效。**