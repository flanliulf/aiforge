# Troubleshooting | 故障排除

## Understanding Error Messages | 理解错误提示

aiforge uses a **three-part error format**:

```
❌ What went wrong            ← 发生了什么
   Why it happened            ← 为什么
   How to fix:                ← 怎么修
     → npx @fancyliu/aiforge --ssh      ← 可复制的修复命令
```

Read each part carefully — the "How to fix" section usually contains the exact command to resolve the issue.

---

## Common Errors | 常见错误

### AUTH_FAILED — Authentication Failed | 认证失败

**Symptoms:**
```
❌ Cannot access repository
   Git server returned 401 (authentication failed)
   → npx @fancyliu/aiforge --ssh
   → npx @fancyliu/aiforge --token <your-access-token>
   → npx @fancyliu/aiforge init
```

**Solutions:**

1. **Check your credentials:**
   ```bash
   # Test SSH access
   ssh -T git@your-git-host.com

   # Test token access
   git ls-remote https://your-git-host.com/team/repo.git
   ```

2. **Try a different auth method:**
   ```bash
   # Force SSH
   npx @fancyliu/aiforge --ssh

   # Use explicit token
   npx @fancyliu/aiforge --token <your-access-token>
   ```

3. **Re-run init to reconfigure:**
   ```bash
   npx @fancyliu/aiforge init
   ```

4. **For CI/CD, use environment variable:**
   ```bash
   export GIT_TOKEN=<your-access-token>
   npx @fancyliu/aiforge
   ```

---

### CLONE_FAILED — Repository Clone Failed | 仓库克隆失败

**Symptoms:**
```
❌ Failed to clone repository
   ...
```

**Solutions:**

1. **Verify the repository URL is correct:**
   ```bash
   git ls-remote https://your-git-host.com/team/repo.git
   ```

2. **Check network connectivity:**
   ```bash
   ping your-git-host.com
   ```

3. **If using a corporate proxy:**
   ```bash
   git config --global http.proxy http://proxy:port
   ```

4. **Clear cached clone and retry:**
   ```bash
   rm -rf ~/.aiforge/repos/<repo-name>
   npx @fancyliu/aiforge
   ```

---

### PATH_NOT_DIRECTORY — Target Path Is a File | 目标路径是文件而非目录

**Symptoms:**
```
❌ Target path is not a directory: /path/to/target
```

**Cause:** A file exists where aiforge expects a directory.

**Solution:**
```bash
# Remove the conflicting file
rm /path/to/target

# Retry installation
npx @fancyliu/aiforge
```

---

### PERMISSION_DENIED — File Permission Error | 文件权限错误

**Symptoms:**
```
❌ Permission denied: /path/to/target
```

**Solutions:**

1. **Check directory permissions:**
   ```bash
   ls -la ~/.copilot/
   ```

2. **Fix ownership if needed:**
   ```bash
   sudo chown -R $(whoami) ~/.copilot/
   ```

---

### NO_TOOLS — No AI Tools Detected | 未检测到 AI 工具

**Symptoms:**
```
❌ No AI tools detected in your environment
```

**Cause:** aiforge scans for tool-specific directories (e.g., `~/.copilot`, `~/.claude`) but found none.

**Solutions:**

1. **Install at least one AI tool first**, then re-run aiforge.

2. **Manually specify tools:**
   ```bash
   npx @fancyliu/aiforge -t copilot claude
   ```

3. **For project-level detection**, make sure you're in a project directory that has tool config directories (e.g., `.github/`, `.claude/`).

---

### LIST_DIR_NOT_FOUND — Directory Not Found in Repository | 仓库中未找到目录

**Symptoms:**
```
❌ Directory 'xxx' not found in repository
```

**Cause:** The directory name passed to `--list` does not exist in the knowledge repository.

**Solutions:**

1. **Check the available top-level directories** — the error message includes a list of valid directory names.

2. **Use a simple directory name** (no path separators):
   ```bash
   # Correct
   npx @fancyliu/aiforge --list skills

   # Wrong
   npx @fancyliu/aiforge --list skills/code-review
   ```

---

### LIST_INVALID_INPUT — Invalid List Input | 无效的列举输入

**Symptoms:**
```
❌ Invalid directory name: '...'
```

**Cause:** The `--list` value contains path separators (`/`, `\`), starts with `.`, or is empty/whitespace.

**Solution:** Provide a simple top-level directory name:
```bash
npx @fancyliu/aiforge --list skills
```

---

### FILTER_NO_MATCH — No Subdirectories Match Filter | 无匹配的子目录

**Symptoms:**
```
❌ No subdirectories match filter pattern '...'
```

**Cause:** The glob pattern passed to `--filter` doesn't match any installable subdirectory.

**Solutions:**

1. **Browse available subdirectories first:**
   ```bash
   npx @fancyliu/aiforge --list skills
   ```

2. **Check your glob pattern** — supported wildcards: `*` (any string), `?` (single char):
   ```bash
   npx @fancyliu/aiforge --filter "skills/code*"
   ```

---

## FAQ | 常见问题

### Q: Will aiforge overwrite my custom configurations? | aiforge 会覆盖我的自定义配置吗？

**A:** By default, aiforge detects file conflicts (using content hashing) and asks for confirmation before overwriting. Use `--dry-run` to preview changes first. Use `--force` only when you explicitly want to overwrite everything.

### Q: What happens if I run aiforge multiple times? | 多次运行 aiforge 会怎样？

**A:** aiforge tracks installed files via `manifest.json`. On subsequent runs:
- **Unchanged files** → Skipped (hash match)
- **Updated files** → Overwritten (with backup unless `--force`)
- **New files** → Installed normally

### Q: Can I use aiforge in a CI/CD pipeline? | 能在 CI/CD 中使用 aiforge 吗？

**A:** Yes! Recommended setup:

```bash
export GIT_TOKEN=<your-access-token>
npx @fancyliu/aiforge --quiet
```

Key flags for CI/CD:
- `--quiet` — Minimal output, no spinner
- `--force` — Skip interactive prompts
- Non-TTY environments automatically use plain text output

### Q: How do I switch between Chinese and English output? | 如何切换中英文输出？

**A:** Edit `~/.aiforge/config.json`:

```jsonc
{
  "language": "en"  // or "zh-CN"
}
```

Or re-run `npx @fancyliu/aiforge init` and select your preferred language.

### Q: What's the difference between symlink and copy mode? | 符号链接和复制模式有什么区别？

| Aspect | Copy Mode | Symlink Mode (`-l`) |
|--------|-----------|---------------------|
| File independence | Files are independent copies | Links point to cloned repo |
| Updates | Re-run `npx @fancyliu/aiforge` | `git pull` or re-run `npx @fancyliu/aiforge -g -l` |
| Scope | Global + Project | **Global only** |
| Disk usage | Duplicated files | Single source, multiple links |
| Best for | Project-level configs | Long-term global setup |

### Q: Why is symlink mode global-only? | 为什么符号链接模式只支持全局？

**A:** Project-level configs should be committed to the project repository as independent files. Symlinks would create a dependency on a specific local clone path, breaking portability across different machines and team members.

---

## Getting Help | 获取帮助

If your issue isn't listed above:

1. Run with `--dry-run` to see the installation plan
2. Check `~/.aiforge/config.json` for configuration issues
3. Check `~/.aiforge/manifest.json` for tracking state
4. Look at the three-part error message — the "how to fix" section is your best starting point
