/**
 * 用户可见输出字符串 — 双语支持（zh-CN / en）
 *
 * 来源: Story 5.5a — 国际化语言选择与配置
 * 前置: Story 1.4 预留多语言结构
 *
 * 模块边界: core/ 基础设施层，零外部依赖（纯常量 + 函数）
 * 架构决策: messages.ts 从 data/ 移入 core/，以允许 reporter.ts 等 core/ 模块直接引用
 * （core/ 内部模块互引是已有模式: path-resolver→errors, reporter→types）
 */

// ── 语言类型定义 ────────────────────────────────────────────────

type Language = 'zh-CN' | 'en'

const SUPPORTED_LANGUAGES: Language[] = ['zh-CN', 'en']

// ── 消息结构类型 ────────────────────────────────────────────────

interface MessageSet {
  phases: {
    resolve: string
    auth: string
    clone: string
    detect: string
    match: string
    install: string
    list: string
  }
  icons: {
    new: string
    updated: string
    skipped: string
    failed: string
  }
  stats: {
    template: string
    planTemplate: string
  }
  errors: {
    noRepo: string
    noRepoWhy: string
    argConflict: string
    argConflictWhy: string
    notImplemented: string
    notImplementedWhy: string
    unknownError: string
    unknownErrorWhy: string
    nonTty: string
    nonTtyWhy: string
    fixRunInTerminal: string
    fixManualConfig: string
  }
  init: {
    currentConfig: string
    repoLabel: string
    authLabel: string
    notSet: string
    modifyPrompt: string
    corruptWarning: string
    repoUrlPrompt: string
    authMethodPrompt: string
    sshChoice: string
    tokenChoice: string
    tokenPrompt: string
    sshSuccess: string
    sshFail: string
    sshFailReason: string
    tokenSuccessPrefix: string
    tokenFail: string
    tokenFailReason: string
    fixTitle: string
    inputValidateRepo: string
    inputValidateToken: string
    descInit: string
    fixSshKeygen: string
    fixSshCopyKey: string
    fixSshTest: string
    fixTokenGenerate: string
    fixTokenPermission: string
  }
  reporter: {
    planTitle: string
    scopeGlobal: string
    scopeProject: string
    emptySourceDir: string
    fixMethod: string
    statsInstalled: string
    statsUpdated: string
    statsSkipped: string
    statsFailed: string
    planStats: string
    resultStats: string
    itemCount: string
  }
  config: {
    notFound: string
    notFoundWhy: string
    readFailed: string
    corrupt: string
    corruptWhy: string
    corruptWhyBadAuth: string
    fixInit: string
    fixCheckPerms: string
    fixPermsCmd: string
    fixReinit: string
  }
  git: {
    unsupportedProtocol: string
    unsupportedProtocolWhy: string
    invalidUrl: string
    invalidUrlWhy: string
    missingRepoPath: string
    missingRepoPathWhy: string
  }
  fsUtils: {
    copyFileFailed: string
    copyFileWhy: string
    copyDirFailed: string
    copyDirWhy: string
    symlinkFailed: string
    symlinkWhy: string
    backupFileFailed: string
    backupFileWhy: string
    backupDirFailed: string
    backupDirWhy: string
    ensureDirFailed: string
    ensureDirWhy: string
    fileHashFailed: string
    fileHashWhy: string
    permissionDenied: string
    permissionDeniedWhy: string
    fileNotWritable: string
    fileNotWritableWhy: string
    pathTraversal: string
    pathTraversalWhy: string
    symlinkEscape: string
    symlinkEscapeWhy: string
    brokenSymlink: string
    brokenSymlinkWhy: string
    symlinkToNonDir: string
    symlinkToNonDirWhy: string
    nonDirInPath: string
    nonDirInPathWhy: string
    fixCheckTargetDir: string
    fixCheckSymlink: string
    fixCheckPathConfig: string
    fixChmod: string
    fixSudo: string
    fixChmodFile: string
    fixCheckSourceFile: string
    fixCheckTargetDirWritable: string
    fixCheckSourceDir: string
    fixCheckLinkParentWritable: string
    fixCheckTargetValid: string
    fixCheckDirWritable: string
    fixCheckPathConflict: string
    fixCheckFileExists: string
    fixCheckFileReadable: string
    pathNotDirectory: string
    pathNotDirectoryWhy: string
    fixRemoveFileAndRetry: string
  }
  pipeline: {
    stageNotImplemented: string
    stageNotImplementedWhy: string
    unknownError: string
    unknownErrorWhy: string
  }
  pathResolver: {
    noHome: string
    noHomeWhy: string
    fixHomeEnv: string
    fixHomeExample: string
  }
  resolveSource: {
    noRepo: string
    noRepoWhy: string
  }
  clone: {
    sanitizeRemoteFailed: string
    unknownError: string
    fixRemoteSetUrl: string
    fixCheckGitConfig: string
    scanFailed: string
    fixCheckRepoPerms: string
    authFailed: string
    authFailedWhy: string
    cleanupFailedWarning: string
    cloneFailed: string
    fixCheckNetwork: string
    pullFailed: string
    fixCheckNetworkShort: string
    unknownNetworkError: string
  }
  matchRules: {
    linkProjectRejected: string
    linkProjectRejectedWhy: string
  }
  executeInstall: {
    zeroResultsWarning: string
    diagHeader: string
    diagScannedDirs: string
    diagMatchedRules: string
    diagAllSkipped: string
    suggestHeader: string
    suggestForce: string
    suggestCheckRepo: string
    brokenLink: string
    flattenMissingMainFile: string
  }
  conflictResolver: {
    conflictMessage: string
    backupChoice: string
    overwriteChoice: string
    skipChoice: string
    diffChoice: string
    abortChoice: string
    srcFileInfo: string
    destFileInfo: string
    diffReadError: string
    nonTtyConflict: string
    nonTtyConflictWhy: string
    userAbort: string
    userAbortWhy: string
    fixRunInTerminal: string
    fixUseForce: string
    fixRerun: string
    fixForceConflict: string
  }
  detectTools: {
    noToolsFound: string
    scanPathsHeader: string
    globalFlag: string
    projectFlag: string
    suggestionsHeader: string
    suggestion1: string
    suggestion2: string
    unknownTool: string
    unknownToolWhy: string
    noToolsError: string
    noToolsErrorWhy: string
    fixInstallTools: string
    fixSupportedTools: string
  }
  authenticate: {
    argConflict: string
    argConflictWhy: string
  }
  index: {
    unsupportedLanguage: string
    languageLoadFailed: string
  }
  list: {
    title: string
    empty: string
    dirNotFound: string
    dirNotFoundWhy: string
    fixTryOther: string
    invalidInput: string
    invalidInputWhy: string
    fixUseSimpleName: string
  }
}

// ── 双语消息集 ──────────────────────────────────────────────────

const MESSAGES_MAP: Record<Language, MessageSet> = {
  'zh-CN': {
    phases: {
      resolve: '解析仓库地址...',
      auth: '验证认证信息...',
      clone: '克隆仓库...',
      detect: '检测 AI 工具...',
      match: '匹配安装规则...',
      install: '执行安装...',
      list: '列出子目录...',
    },
    icons: {
      new: '✅',
      updated: '🔄',
      skipped: '⏭️',
      failed: '❌',
    },
    stats: {
      template: '安装: {installed} 项  更新: {updated} 项  跳过: {skipped} 项  失败: {failed} 项',
      planTemplate: '计划安装: {total} 项 ({tools} 个工具)',
    },
    errors: {
      noRepo: '未指定知识仓库地址',
      noRepoWhy: '未通过命令行参数提供仓库 URL，且配置文件中无 defaultRepo',
      argConflict: '--ssh 和 --token 不能同时使用',
      argConflictWhy: '两种认证方式互斥，请只选择其中一种',
      notImplemented: '阶段未实现',
      notImplementedWhy: '该阶段尚未实现',
      unknownError: '发生未预期的错误',
      unknownErrorWhy: '发生未预期的错误',
      nonTty: 'aiforge init 需要交互式终端',
      nonTtyWhy: '当前环境不支持交互式输入（如 CI/CD 管道）',
      fixRunInTerminal: '在本地终端运行 aiforge init',
      fixManualConfig: '或手动创建 ~/.aiforge/config.json',
    },
    init: {
      currentConfig: '当前配置：',
      repoLabel: '  仓库: ',
      authLabel: '  认证: ',
      notSet: '（未设置）',
      modifyPrompt: '是否修改当前配置？',
      corruptWarning: '⚠️ 配置文件损坏，将重新配置。',
      repoUrlPrompt: '默认知识仓库 URL:',
      authMethodPrompt: '认证方式:',
      sshChoice: 'SSH Key（推荐）',
      tokenChoice: 'Personal Access Token',
      tokenPrompt: 'Personal Access Token:',
      sshSuccess: '✅ SSH 连接成功',
      sshFail: '❌ SSH 连接失败',
      sshFailReason: 'Git 服务器拒绝了 SSH 连接',
      tokenSuccessPrefix: '✅ Token 验证成功',
      tokenFail: '❌ Token 验证失败',
      tokenFailReason: 'Token 无效或权限不足',
      fixTitle: '修复建议：',
      inputValidateRepo: '请输入仓库 URL',
      inputValidateToken: '请输入 Token',
      descInit: '初始化 aiforge 配置',
      fixSshKeygen: '  ssh-keygen -t ed25519 -C "your-email@example.com"',
      fixSshCopyKey: '  cat ~/.ssh/id_ed25519.pub  # copy public key to GitLab Settings > SSH Keys',
      fixSshTest: '  ssh -T git@<hostname>  # test connection',
      fixTokenGenerate: '  Visit GitLab Settings > Access Tokens to generate a new token',
      fixTokenPermission: '  Ensure the token has read_repository permission',
    },
    reporter: {
      planTitle: '📋 安装计划预览 (dry-run)',
      scopeGlobal: '全局',
      scopeProject: '项目',
      emptySourceDir: '(源目录为空: {dir})',
      fixMethod: '修复方法：',
      statsInstalled: '安装: {n} 项',
      statsUpdated: '更新: {n} 项',
      statsSkipped: '跳过: {n} 项',
      statsFailed: '失败: {n} 项',
      planStats: '计划安装: {total} 项 ({tools} 个工具)',
      resultStats: '安装: {installed} 项  更新: {updated} 项  跳过: {skipped} 项',
      itemCount: '{count} 项',
    },
    config: {
      notFound: '未找到配置文件',
      notFoundWhy: '尚未运行初始化配置',
      readFailed: '配置文件读取失败',
      corrupt: '配置文件损坏',
      corruptWhy: 'config.json 不是有效的 JSON 格式',
      corruptWhyBadAuth: 'config.json 缺少必要的 auth 字段或 auth 不是有效的对象',
      fixInit: 'npx aiforge init  # 首次配置',
      fixCheckPerms: 'ls -la ~/.aiforge/config.json  # 检查文件权限',
      fixPermsCmd: 'chmod 600 ~/.aiforge/config.json  # 修复权限',
      fixReinit: 'npx aiforge init  # 重新配置',
    },
    git: {
      unsupportedProtocol: '不支持的仓库协议',
      unsupportedProtocolWhy: '不支持的协议: {protocol}，仅支持 HTTPS 和 SSH',
      invalidUrl: '仓库地址格式非法',
      invalidUrlWhy: '无法解析仓库地址: {url}',
      missingRepoPath: '仓库地址缺少仓库路径',
      missingRepoPathWhy: '仓库地址缺少仓库路径: {url}',
    },
    fsUtils: {
      copyFileFailed: '无法复制文件: {src} → {dest}',
      copyFileWhy: '复制文件时出错: {err}',
      copyDirFailed: '无法复制目录: {src} → {dest}',
      copyDirWhy: '复制目录时出错: {err}',
      symlinkFailed: '无法创建符号链接: {target} → {linkPath}',
      symlinkWhy: '创建符号链接时出错: {err}',
      backupFileFailed: '无法备份文件: {filePath}',
      backupFileWhy: '备份文件时出错: {err}',
      backupDirFailed: '无法备份目录: {dirPath}',
      backupDirWhy: '备份目录时出错: {err}',
      ensureDirFailed: '无法创建目录: {dirPath}',
      ensureDirWhy: '创建目录时出错: {err}',
      fileHashFailed: '无法计算文件 hash: {filePath}',
      fileHashWhy: '计算 SHA256 hash 时出错: {err}',
      permissionDenied: '目标路径父目录不可写: {dir}',
      permissionDeniedWhy: '无法在 {dir} 中创建文件，权限不足',
      fileNotWritable: '目标文件不可写: {filePath}',
      fileNotWritableWhy: '无法写入文件 {filePath}，权限不足',
      pathTraversal: '检测到路径遍历攻击',
      pathTraversalWhy: '目标路径 {target} 超出允许范围 {root}',
      symlinkEscape: '检测到 symlink 逃逸路径遍历攻击',
      symlinkEscapeWhy:
        '目标路径祖先 {ancestor} 经 symlink 解析后真实路径 {real} 超出允许范围 {root}（真实根：{realRoot}）',
      brokenSymlink: '路径链中存在损坏的符号链接: {path}',
      brokenSymlinkWhy: '{path} 是损坏的符号链接（目标不存在），无法在其下创建子路径',
      symlinkToNonDir: '路径链中存在指向非目录的符号链接: {path}',
      symlinkToNonDirWhy: '{path} 是符号链接但目标不是目录，无法在其下创建子路径',
      nonDirInPath: '路径链中存在非目录条目: {path}',
      nonDirInPathWhy: '{path} 存在但不是目录，无法在其下创建子路径',
      fixCheckTargetDir: '检查安装规则中的 targetDir 配置',
      fixCheckSymlink: '检查路径链中是否存在指向 allowedRoot 之外的符号链接',
      fixCheckPathConfig: '检查路径配置，确保安装目标路径的父级均为目录',
      fixChmod: 'chmod 755 {dir}',
      fixSudo: 'sudo npx aiforge -g',
      fixChmodFile: 'chmod 755 {filePath}',
      fixCheckSourceFile: '检查源文件是否存在: {path}',
      fixCheckTargetDirWritable: '检查目标目录是否可写: {dir}',
      fixCheckSourceDir: '检查源目录是否存在: {path}',
      fixCheckLinkParentWritable: '检查 linkPath 的父目录是否可写',
      fixCheckTargetValid: '检查 target 路径是否有效: {path}',
      fixCheckDirWritable: '检查目录是否可写: {dir}',
      fixCheckPathConflict: '检查路径是否与已存在的文件冲突',
      fixCheckFileExists: '检查文件是否存在: {path}',
      fixCheckFileReadable: '检查文件是否可读',
      pathNotDirectory: '目标路径不是目录: {path}',
      pathNotDirectoryWhy: '安装目标路径 {path} 是普通文件，无法作为安装目录',
      fixRemoveFileAndRetry: '请先删除该文件，再重试: rm {path}',
    },
    pipeline: {
      stageNotImplemented: '阶段 "{stage}" 未实现',
      stageNotImplementedWhy: '该阶段尚未实现',
      unknownError: '发生未预期的错误',
      unknownErrorWhy: '发生未预期的错误',
    },
    pathResolver: {
      noHome: 'HOME 环境变量未设置',
      noHomeWhy: 'os.homedir() 返回空值，HOME 环境变量可能未设置',
      fixHomeEnv: '请确保 HOME 环境变量已正确设置',
      fixHomeExample: '例如: export HOME=/home/youruser',
    },
    resolveSource: {
      noRepo: '未指定知识仓库地址',
      noRepoWhy: '未通过命令行参数提供仓库 URL，且配置文件中无 defaultRepo',
    },
    clone: {
      sanitizeRemoteFailed: 'Token 清理失败：remote URL 重写出错',
      unknownError: '未知错误',
      fixRemoteSetUrl: 'git remote set-url origin <clean-url>',
      fixCheckGitConfig: '检查 .git/config 中的 remote origin 配置',
      scanFailed: '扫描仓库文件失败',
      fixCheckRepoPerms: '检查仓库目录权限',
      authFailed: '无法访问仓库',
      authFailedWhy: 'Git 服务器返回 401（认证失败）',
      cleanupFailedWarning: '⚠️ 清理未完成目录也失败: {msg}，请手动删除: rm -rf {dir}',
      cloneFailed: '克隆仓库失败',
      fixCheckNetwork: '检查网络连接和防火墙设置',
      pullFailed: '增量更新失败',
      fixCheckNetworkShort: '检查网络连接',
      unknownNetworkError: '未知网络错误',
    },
    matchRules: {
      linkProjectRejected: '符号链接模式不支持项目级安装',
      linkProjectRejectedWhy: '-l/--link 仅支持全局安装模式（-g）',
    },
    executeInstall: {
      zeroResultsWarning: '⚠️ 未安装任何文件',
      diagHeader: '诊断信息：',
      diagScannedDirs: '  扫描目录: {dirs}',
      diagMatchedRules: '  匹配规则: {rules} ({count} 条)',
      diagAllSkipped: '  所有文件已是最新或被跳过',
      suggestHeader: '建议：',
      suggestForce: '  1. 使用 --force 强制重新安装',
      suggestCheckRepo: '  2. 检查知识仓库是否有新内容',
      brokenLink: '⚠️ 断链: {targetPath} → 目标文件不存在',
      flattenMissingMainFile: '⚠️ flatten: {srcDir}/ 中未找到 {mainFile}，跳过',
    },
    conflictResolver: {
      conflictMessage: '⚠️ 文件冲突: {target} 已存在（用户手写文件）',
      backupChoice: '备份后覆盖（推荐）',
      overwriteChoice: '直接覆盖',
      skipChoice: '跳过此文件',
      diffChoice: '查看差异',
      abortChoice: '中止安装',
      srcFileInfo: '  📄 源文件:   {name} ({size} 字节, 修改时间: {mtime})',
      destFileInfo: '  📄 目标文件: {name} ({size} 字节, 修改时间: {mtime})',
      diffReadError: '  ⚠️ 无法读取文件信息进行对比',
      nonTtyConflict: '文件冲突需要交互式终端',
      nonTtyConflictWhy: '目标文件 {target} 已存在且为用户手写文件，非 TTY 环境无法交互式确认',
      userAbort: '用户中止安装',
      userAbortWhy: '用户在冲突解决中选择了中止安装',
      fixRunInTerminal: '在终端中运行此命令',
      fixUseForce: '使用 --force 跳过交互式确认',
      fixRerun: '重新运行安装命令',
      fixForceConflict: '使用 --force 跳过冲突确认',
    },
    detectTools: {
      noToolsFound: '❌ 未检测到任何 AI 编码工具',
      scanPathsHeader: '扫描路径：',
      globalFlag: '  全局: {path} (不存在)',
      projectFlag: '  项目: {path} (不存在)',
      suggestionsHeader: '建议：',
      suggestion1: '  1. 安装 GitHub Copilot、Claude Code、Cursor 或 VS Code',
      suggestion2: '  2. 使用 --tools {tools} 手动指定工具',
      unknownTool: '未知的工具 ID: {id}',
      unknownToolWhy: '工具 ID "{id}" 在注册表中不存在',
      noToolsError: '未检测到任何 AI 编码工具',
      noToolsErrorWhy: '在全局目录和项目目录中均未找到支持工具的标志文件',
      fixInstallTools: '安装 GitHub Copilot、Claude Code、Cursor 或 VS Code',
      fixSupportedTools: '支持的工具: {tools}',
    },
    authenticate: {
      argConflict: '--ssh 和 --token 不能同时使用',
      argConflictWhy: '两种认证方式互斥，请只选择其中一种',
    },
    index: {
      unsupportedLanguage: '⚠️ 不支持的语言 "{lang}"，使用默认中文',
      languageLoadFailed: '⚠️ 读取语言配置失败，使用默认中文: {err}',
    },
    list: {
      title: '📂 {dir}/ 下的可安装子目录：',
      empty: '该目录下暂无可安装的子目录',
      dirNotFound: '目录 {dir} 在仓库中不存在',
      dirNotFoundWhy: '仓库中没有名为 {dir} 的顶层目录',
      fixTryOther: '尝试 --list 搭配以下可用目录: {dirs}',
      invalidInput: '--list 参数 "{dir}" 不是有效的顶层目录名',
      invalidInputWhy: '顶层目录名不能包含路径分隔符（/、\\）或以点号（.）开头',
      fixUseSimpleName: '请使用简单的目录名，例如：skills、agents、prompts',
    },
  },
  en: {
    phases: {
      resolve: 'Resolving repository...',
      auth: 'Authenticating...',
      clone: 'Cloning repository...',
      detect: 'Detecting AI tools...',
      match: 'Matching install rules...',
      install: 'Installing...',
      list: 'Listing subdirectories...',
    },
    icons: {
      new: '✅',
      updated: '🔄',
      skipped: '⏭️',
      failed: '❌',
    },
    stats: {
      template: 'Installed: {installed}  Updated: {updated}  Skipped: {skipped}  Failed: {failed}',
      planTemplate: 'Plan: {total} items ({tools} tools)',
    },
    errors: {
      noRepo: 'No knowledge repository specified',
      noRepoWhy: 'No repository URL provided via CLI, and no defaultRepo in config',
      argConflict: '--ssh and --token cannot be used together',
      argConflictWhy: 'These auth methods are mutually exclusive, please choose one',
      notImplemented: 'Stage not implemented',
      notImplementedWhy: 'This pipeline stage has not been implemented yet',
      unknownError: 'An unexpected error occurred',
      unknownErrorWhy: 'An unexpected error occurred',
      nonTty: 'aiforge init requires an interactive terminal',
      nonTtyWhy: 'Current environment does not support interactive input (e.g. CI/CD)',
      fixRunInTerminal: 'Run aiforge init in a local terminal',
      fixManualConfig: 'Or manually create ~/.aiforge/config.json',
    },
    init: {
      currentConfig: 'Current configuration:',
      repoLabel: '  Repo: ',
      authLabel: '  Auth: ',
      notSet: '(not set)',
      modifyPrompt: 'Modify current configuration?',
      corruptWarning: '⚠️ Config file corrupted, re-configuring.',
      repoUrlPrompt: 'Default knowledge repository URL:',
      authMethodPrompt: 'Authentication method:',
      sshChoice: 'SSH Key (Recommended)',
      tokenChoice: 'Personal Access Token',
      tokenPrompt: 'Personal Access Token:',
      sshSuccess: '✅ SSH connection successful',
      sshFail: '❌ SSH connection failed',
      sshFailReason: 'Git server rejected the SSH connection',
      tokenSuccessPrefix: '✅ Token verified',
      tokenFail: '❌ Token verification failed',
      tokenFailReason: 'Token is invalid or lacks permissions',
      fixTitle: 'Fix suggestions:',
      inputValidateRepo: 'Please enter a repository URL',
      inputValidateToken: 'Please enter a token',
      descInit: 'Initialize aiforge configuration',
      fixSshKeygen: '  ssh-keygen -t ed25519 -C "your-email@example.com"',
      fixSshCopyKey: '  cat ~/.ssh/id_ed25519.pub  # copy public key to GitLab Settings > SSH Keys',
      fixSshTest: '  ssh -T git@<hostname>  # test connection',
      fixTokenGenerate: '  Visit GitLab Settings > Access Tokens to generate a new token',
      fixTokenPermission: '  Ensure the token has read_repository permission',
    },
    reporter: {
      planTitle: '📋 Install plan preview (dry-run)',
      scopeGlobal: 'global',
      scopeProject: 'project',
      emptySourceDir: '(source directory is empty: {dir})',
      fixMethod: 'Fix:',
      statsInstalled: 'Installed: {n}',
      statsUpdated: 'Updated: {n}',
      statsSkipped: 'Skipped: {n}',
      statsFailed: 'Failed: {n}',
      planStats: 'Plan: {total} items ({tools} tools)',
      resultStats: 'Installed: {installed}  Updated: {updated}  Skipped: {skipped}',
      itemCount: '{count} items',
    },
    config: {
      notFound: 'Config file not found',
      notFoundWhy: 'aiforge has not been initialized yet',
      readFailed: 'Failed to read config file',
      corrupt: 'Config file is corrupted',
      corruptWhy: 'config.json is not valid JSON',
      corruptWhyBadAuth: 'config.json is missing required auth field or auth is not a valid object',
      fixInit: 'npx aiforge init  # initial setup',
      fixCheckPerms: 'ls -la ~/.aiforge/config.json  # check file permissions',
      fixPermsCmd: 'chmod 600 ~/.aiforge/config.json  # fix permissions',
      fixReinit: 'npx aiforge init  # re-configure',
    },
    git: {
      unsupportedProtocol: 'Unsupported repository protocol',
      unsupportedProtocolWhy: 'Unsupported protocol: {protocol}, only HTTPS and SSH are supported',
      invalidUrl: 'Invalid repository URL format',
      invalidUrlWhy: 'Cannot parse repository URL: {url}',
      missingRepoPath: 'Repository URL is missing a repository path',
      missingRepoPathWhy: 'Repository URL is missing a repository path: {url}',
    },
    fsUtils: {
      copyFileFailed: 'Cannot copy file: {src} → {dest}',
      copyFileWhy: 'Error copying file: {err}',
      copyDirFailed: 'Cannot copy directory: {src} → {dest}',
      copyDirWhy: 'Error copying directory: {err}',
      symlinkFailed: 'Cannot create symlink: {target} → {linkPath}',
      symlinkWhy: 'Error creating symlink: {err}',
      backupFileFailed: 'Cannot backup file: {filePath}',
      backupFileWhy: 'Error backing up file: {err}',
      backupDirFailed: 'Cannot backup directory: {dirPath}',
      backupDirWhy: 'Error backing up directory: {err}',
      ensureDirFailed: 'Cannot create directory: {dirPath}',
      ensureDirWhy: 'Error creating directory: {err}',
      fileHashFailed: 'Cannot compute file hash: {filePath}',
      fileHashWhy: 'Error computing SHA256 hash: {err}',
      permissionDenied: 'Target parent directory is not writable: {dir}',
      permissionDeniedWhy: 'Cannot create files in {dir}, insufficient permissions',
      fileNotWritable: 'Target file is not writable: {filePath}',
      fileNotWritableWhy: 'Cannot write to file {filePath}, insufficient permissions',
      pathTraversal: 'Path traversal attack detected',
      pathTraversalWhy: 'Target path {target} is outside allowed root {root}',
      symlinkEscape: 'Symlink escape path traversal attack detected',
      symlinkEscapeWhy:
        'Target path ancestor {ancestor} resolves via symlink to {real} which is outside allowed root {root} (real root: {realRoot})',
      brokenSymlink: 'Broken symlink in path chain: {path}',
      brokenSymlinkWhy:
        '{path} is a broken symlink (target does not exist), cannot create sub-paths beneath it',
      symlinkToNonDir: 'Symlink pointing to non-directory in path chain: {path}',
      symlinkToNonDirWhy:
        '{path} is a symlink but its target is not a directory, cannot create sub-paths beneath it',
      nonDirInPath: 'Non-directory entry in path chain: {path}',
      nonDirInPathWhy: '{path} exists but is not a directory, cannot create sub-paths beneath it',
      fixCheckTargetDir: 'Check the targetDir configuration in install rules',
      fixCheckSymlink: 'Check if there are symlinks in the path chain pointing outside allowedRoot',
      fixCheckPathConfig:
        'Check path configuration to ensure all parent directories of install targets are directories',
      fixChmod: 'chmod 755 {dir}',
      fixSudo: 'sudo npx aiforge -g',
      fixChmodFile: 'chmod 755 {filePath}',
      fixCheckSourceFile: 'Check if source file exists: {path}',
      fixCheckTargetDirWritable: 'Check if target directory is writable: {dir}',
      fixCheckSourceDir: 'Check if source directory exists: {path}',
      fixCheckLinkParentWritable: 'Check if the parent directory of linkPath is writable',
      fixCheckTargetValid: 'Check if target path is valid: {path}',
      fixCheckDirWritable: 'Check if directory is writable: {dir}',
      fixCheckPathConflict: 'Check if path conflicts with an existing file',
      fixCheckFileExists: 'Check if file exists: {path}',
      fixCheckFileReadable: 'Check if file is readable',
      pathNotDirectory: 'Target path is not a directory: {path}',
      pathNotDirectoryWhy:
        'Install target path {path} is a plain file, cannot be used as an install directory',
      fixRemoveFileAndRetry: 'Remove the file and retry: rm {path}',
    },
    pipeline: {
      stageNotImplemented: 'Stage "{stage}" not implemented',
      stageNotImplementedWhy: 'This pipeline stage has not been implemented yet',
      unknownError: 'An unexpected error occurred',
      unknownErrorWhy: 'An unexpected error occurred',
    },
    pathResolver: {
      noHome: 'HOME environment variable is not set',
      noHomeWhy: 'os.homedir() returned empty, HOME environment variable may not be set',
      fixHomeEnv: 'Ensure the HOME environment variable is set correctly',
      fixHomeExample: 'e.g.: export HOME=/home/youruser',
    },
    resolveSource: {
      noRepo: 'No knowledge repository specified',
      noRepoWhy: 'No repository URL provided via CLI, and no defaultRepo in config',
    },
    clone: {
      sanitizeRemoteFailed: 'Failed to sanitize token: remote URL rewrite failed',
      unknownError: 'Unknown error',
      fixRemoteSetUrl: 'git remote set-url origin <clean-url>',
      fixCheckGitConfig: 'Check remote origin configuration in .git/config',
      scanFailed: 'Failed to scan repository files',
      fixCheckRepoPerms: 'Check repository directory permissions',
      authFailed: 'Cannot access repository',
      authFailedWhy: 'Git server returned 401 (authentication failed)',
      cleanupFailedWarning:
        '⚠️ Cleanup of incomplete directory also failed: {msg}, please delete manually: rm -rf {dir}',
      cloneFailed: 'Failed to clone repository',
      fixCheckNetwork: 'Check network connection and firewall settings',
      pullFailed: 'Incremental update failed',
      fixCheckNetworkShort: 'Check network connection',
      unknownNetworkError: 'Unknown network error',
    },
    matchRules: {
      linkProjectRejected: 'Symlink mode does not support project-scope installation',
      linkProjectRejectedWhy: '-l/--link only supports global installation mode (-g)',
    },
    executeInstall: {
      zeroResultsWarning: '⚠️ No files were installed',
      diagHeader: 'Diagnostics:',
      diagScannedDirs: '  Scanned directories: {dirs}',
      diagMatchedRules: '  Matched rules: {rules} ({count} rules)',
      diagAllSkipped: '  All files are up-to-date or skipped',
      suggestHeader: 'Suggestions:',
      suggestForce: '  1. Use --force to force reinstall',
      suggestCheckRepo: '  2. Check if the knowledge repository has new content',
      brokenLink: '⚠️ Broken link: {targetPath} → target file does not exist',
      flattenMissingMainFile: '⚠️ flatten: {mainFile} not found in {srcDir}/, skipping',
    },
    conflictResolver: {
      conflictMessage: '⚠️ File conflict: {target} already exists (user-written file)',
      backupChoice: 'Backup and overwrite (Recommended)',
      overwriteChoice: 'Overwrite directly',
      skipChoice: 'Skip this file',
      diffChoice: 'View diff',
      abortChoice: 'Abort installation',
      srcFileInfo: '  📄 Source:      {name} ({size} bytes, modified: {mtime})',
      destFileInfo: '  📄 Destination: {name} ({size} bytes, modified: {mtime})',
      diffReadError: '  ⚠️ Unable to read file info for comparison',
      nonTtyConflict: 'File conflict requires an interactive terminal',
      nonTtyConflictWhy:
        'Target file {target} already exists as a user-written file, cannot prompt in non-TTY environment',
      userAbort: 'User aborted installation',
      userAbortWhy: 'User chose to abort during conflict resolution',
      fixRunInTerminal: 'Run this command in a terminal',
      fixUseForce: 'Use --force to skip interactive confirmation',
      fixRerun: 'Re-run the install command',
      fixForceConflict: 'Use --force to skip conflict confirmation',
    },
    detectTools: {
      noToolsFound: '❌ No AI coding tools detected',
      scanPathsHeader: 'Scanned paths:',
      globalFlag: '  global: {path} (not found)',
      projectFlag: '  project: {path} (not found)',
      suggestionsHeader: 'Suggestions:',
      suggestion1: '  1. Install GitHub Copilot, Claude Code, Cursor, or VS Code',
      suggestion2: '  2. Use --tools {tools} to specify tools manually',
      unknownTool: 'Unknown tool ID: {id}',
      unknownToolWhy: 'Tool ID "{id}" does not exist in the registry',
      noToolsError: 'No AI coding tools detected',
      noToolsErrorWhy: 'No tool marker files found in global or project directories',
      fixInstallTools: 'Install GitHub Copilot, Claude Code, Cursor, or VS Code',
      fixSupportedTools: 'Supported tools: {tools}',
    },
    authenticate: {
      argConflict: '--ssh and --token cannot be used together',
      argConflictWhy: 'These auth methods are mutually exclusive, please choose one',
    },
    index: {
      unsupportedLanguage: '⚠️ Unsupported language "{lang}", falling back to zh-CN',
      languageLoadFailed: '⚠️ Failed to load language config, falling back to zh-CN: {err}',
    },
    list: {
      title: '📂 Installable subdirectories under {dir}/:',
      empty: 'No installable subdirectories found',
      dirNotFound: 'Directory {dir} does not exist in the repository',
      dirNotFoundWhy: 'The repository has no top-level directory named {dir}',
      fixTryOther: 'Try --list with one of these available directories: {dirs}',
      invalidInput: '--list argument "{dir}" is not a valid top-level directory name',
      invalidInputWhy:
        'A top-level directory name must not contain path separators (/, \\) or start with a dot (.)',
      fixUseSimpleName: 'Use a simple directory name such as: skills, agents, prompts',
    },
  },
}

// ── 模块级语言状态 ───────────────────────────────────────────────

let currentLanguage: Language = 'zh-CN'

/**
 * 设置当前语言
 *
 * 不支持的语言值自动回退到 'zh-CN'（AC: #5）
 * 回退提示由调用方负责（通过 process.stderr.write，因 Reporter 可能尚未创建）
 */
export function setLanguage(lang: string): void {
  if (lang && (SUPPORTED_LANGUAGES as string[]).includes(lang)) {
    currentLanguage = lang as Language
  } else {
    // 不支持的语言 → 回退到 zh-CN（AC #5）
    currentLanguage = 'zh-CN'
  }
}

/**
 * 按 dot notation 获取当前语言的消息字符串
 *
 * @param key - dot notation 路径，如 'phases.resolve'、'errors.noRepo'
 * @returns 消息字符串，找不到时返回空字符串
 */
export function msg(key: string): string {
  const parts = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = MESSAGES_MAP[currentLanguage]
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return ''
    current = current[part]
  }
  return typeof current === 'string' ? current : ''
}
