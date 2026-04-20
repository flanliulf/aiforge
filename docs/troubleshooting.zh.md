# 故障排除

## 理解错误提示

aiforge 使用**三段式错误格式**：

```
❌ 发生了什么                ← What went wrong
   为什么                    ← Why it happened
   怎么修：                  ← How to fix
     → npx aiforge --ssh     ← 可复制的修复命令
```

仔细阅读每一部分 — "怎么修" 通常包含解决问题的确切命令。

---

## 常见错误

### AUTH_FAILED — 认证失败

**症状：**
```
❌ Cannot access repository
   Git server returned 401 (authentication failed)
   → npx aiforge --ssh
   → npx aiforge --token <your-access-token>
   → npx aiforge init
```

**解决方案：**

1. **检查凭据：**
   ```bash
   # 测试 SSH 访问
   ssh -T git@your-git-host.com

   # 测试 Token 访问
   git ls-remote https://your-git-host.com/team/repo.git
   ```

2. **尝试不同的认证方式：**
   ```bash
   # 强制使用 SSH
   npx aiforge --ssh

   # 使用显式 Token
   npx aiforge --token <your-access-token>
   ```

3. **重新运行 init 进行配置：**
   ```bash
   npx aiforge init
   ```

4. **CI/CD 环境使用环境变量：**
   ```bash
   export GIT_TOKEN=<your-access-token>
   npx aiforge
   ```

---

### CLONE_FAILED — 仓库克隆失败

**症状：**
```
❌ Failed to clone repository
   ...
```

**解决方案：**

1. **验证仓库 URL 是否正确：**
   ```bash
   git ls-remote https://your-git-host.com/team/repo.git
   ```

2. **检查网络连接：**
   ```bash
   ping your-git-host.com
   ```

3. **如果使用公司代理：**
   ```bash
   git config --global http.proxy http://proxy:port
   ```

4. **清除缓存克隆并重试：**
   ```bash
   rm -rf ~/.aiforge/repos/<repo-name>
   npx aiforge
   ```

---

### PATH_NOT_DIRECTORY — 目标路径是文件而非目录

**症状：**
```
❌ Target path is not a directory: /path/to/target
```

**原因：** aiforge 期望目录的位置存在一个文件。

**解决方案：**
```bash
# 删除冲突的文件
rm /path/to/target

# 重新安装
npx aiforge
```

---

### PERMISSION_DENIED — 文件权限错误

**症状：**
```
❌ Permission denied: /path/to/target
```

**解决方案：**

1. **检查目录权限：**
   ```bash
   ls -la ~/.copilot/
   ```

2. **修复所有权（如需要）：**
   ```bash
   sudo chown -R $(whoami) ~/.copilot/
   ```

---

### NO_TOOLS — 未检测到 AI 工具

**症状：**
```
❌ No AI tools detected in your environment
```

**原因：** aiforge 扫描工具特定的目录（如 `~/.copilot`、`~/.claude`）但未找到任何目录。

**解决方案：**

1. **先安装至少一个 AI 工具**，然后重新运行 aiforge。

2. **手动指定工具：**
   ```bash
   npx aiforge -t copilot claude
   ```

3. **对于项目级检测**，确保你在包含工具配置目录（如 `.github/`、`.claude/`）的项目目录中。

---

### LIST_DIR_NOT_FOUND — 仓库中未找到目录

**症状：**
```
❌ 仓库中未找到目录 'xxx'
```

**原因：** 传递给 `--list` 的目录名在知识仓库中不存在。

**解决方案：**

1. **查看可用的顶层目录** — 错误消息中包含有效目录名列表。

2. **使用简单目录名**（不含路径分隔符）：
   ```bash
   # 正确
   npx aiforge --list skills

   # 错误
   npx aiforge --list skills/code-review
   ```

---

### LIST_INVALID_INPUT — 无效的列举输入

**症状：**
```
❌ 无效的目录名：'...'
```

**原因：** `--list` 的值包含路径分隔符（`/`、`\`）、以 `.` 开头或为空/空白字符。

**解决方案：** 提供简单的顶层目录名：
```bash
npx aiforge --list skills
```

---

### FILTER_NO_MATCH — 无匹配的子目录

**症状：**
```
❌ 无匹配筛选模式 '...' 的子目录
```

**原因：** 传递给 `--filter` 的 glob 模式不匹配任何可安装的子目录。

**解决方案：**

1. **先浏览可用的子目录：**
   ```bash
   npx aiforge --list skills
   ```

2. **检查 glob 模式** — 支持的通配符：`*`（任意字符串）、`?`（单个字符）：
   ```bash
   npx aiforge --filter "skills/code*"
   ```

---

## 常见问题

### 问：aiforge 会覆盖我的自定义配置吗？

**答：** 默认情况下，aiforge 通过内容哈希检测文件冲突，在覆盖前会请求确认。使用 `--dry-run` 先预览变更。仅在你明确想覆盖所有文件时使用 `--force`。

### 问：多次运行 aiforge 会怎样？

**答：** aiforge 通过 `manifest.json` 跟踪已安装的文件。后续运行时：
- **未变更的文件** → 跳过（哈希匹配）
- **已更新的文件** → 覆盖（除非使用 `--force`，否则会备份）
- **新文件** → 正常安装

### 问：能在 CI/CD 中使用 aiforge 吗？

**答：** 可以！推荐配置：

```bash
export GIT_TOKEN=<your-access-token>
npx aiforge --quiet
```

CI/CD 关键参数：
- `--quiet` — 极简输出，无 Spinner
- `--force` — 跳过交互式确认
- 非 TTY 环境自动使用纯文本输出

### 问：如何切换中英文输出？

**答：** 编辑 `~/.aiforge/config.json`：

```jsonc
{
  "language": "en"  // 或 "zh-CN"
}
```

或重新运行 `npx aiforge init` 选择语言。

### 问：符号链接和复制模式有什么区别？

| 方面 | 复制模式 | 符号链接模式（`-l`） |
|------|---------|---------------------|
| 文件独立性 | 文件为独立副本 | 链接指向克隆仓库 |
| 更新方式 | 重新运行 `npx aiforge` | `git pull` 或 `npx aiforge update` |
| 适用范围 | 全局 + 项目 | **仅限全局** |
| 磁盘占用 | 文件重复存储 | 单一来源，多处链接 |
| 适合场景 | 项目级配置 | 长期全局配置 |

### 问：为什么符号链接模式只支持全局？

**答：** 项目级配置应作为独立文件提交到项目仓库。符号链接会创建对特定本地克隆路径的依赖，破坏跨机器和团队成员的可移植性。

---

## 获取帮助

如果你的问题不在上面的列表中：

1. 使用 `--dry-run` 查看安装计划
2. 检查 `~/.aiforge/config.json` 排查配置问题
3. 检查 `~/.aiforge/manifest.json` 排查跟踪状态
4. 查看三段式错误提示 — "怎么修" 部分是最好的入手点
