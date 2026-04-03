# Quick Reference: Document Navigation for CR Rule Extraction

## Fast Navigation Guide

### 📍 Where to Find Specific Rule Categories

#### Security Rules
- **Quick lookup:** `project-context.md` lines 150-163
- **Detailed patterns:** `04-implementation-patterns.md` lines 597-723
- **Architectural context:** `03-core-decisions.md` D4 section (lines 100-167)

**Key Topics:**
- ✅ npm package zero-disclosure (lines 152)
- ✅ Token deobfuscation (lines 155-156, impl-patterns 599-603)
- ✅ symlink-aware APIs (impl-patterns 652-678)
- ✅ realpath() validation (impl-patterns 680-699)
- ✅ I/O operation path security (impl-patterns 701-723)

#### Testing & Verification Rules
- **Quick lookup:** `project-context.md` lines 173-188
- **Detailed patterns:** `04-implementation-patterns.md` lines 725-930
- **File location:** `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`

**Key Topics:**
- ✅ Test file mirroring (line 175)
- ✅ No all-mock integration tests (impl-patterns 747-769)
- ✅ Mock assertion verification (impl-patterns 773-797)
- ✅ Contract-first assertions (impl-patterns 799-813)
- ✅ i18n testing requirements (impl-patterns 861-895)

#### Output & CLI Rules
- **Quick lookup:** `project-context.md` lines 132-148
- **Detailed patterns:** `04-implementation-patterns.md` lines 405-547
- **Architecture decisions:** `03-core-decisions.md` D4 Output Strategy (lines 119-151)

**Key Topics:**
- ✅ Reporter interface requirement (line 134)
- ✅ stdout vs stderr allocation (03-core-decisions 139-151)
- ✅ i18n completeness (impl-patterns 439-465)
- ✅ CLI help hardcoding (impl-patterns 428-437)

---

## Document Purpose Matrix

| Document | Audience | Use For | Don't Use For |
|----------|----------|---------|---------------|
| **project-context.md** | AI Agents | Quick lookup, rule conciseness | Detailed examples, architectural rationale |
| **04-implementation-patterns.md** | Humans | Code examples, detailed patterns, implementation guides | Strategic decisions, high-level architecture |
| **03-core-decisions.md** | Humans | Architectural rationale, why decisions, impact analysis | Implementation details, code patterns |

---

## Rule Extraction Task Checklist

When extracting rules from CR reviews:

### 1. Identify Rule Category
- [ ] Security rule?
- [ ] Testing/verification rule?
- [ ] Output/CLI rule?
- [ ] Error handling rule?
- [ ] Data format rule?
- [ ] Module/architecture rule?

### 2. Check Existing Coverage
- [ ] Search project-context.md for similar rules
- [ ] Search 04-implementation-patterns.md for patterns
- [ ] Search 03-core-decisions.md for architectural context
- [ ] Look for existing examples in relevant section

### 3. Determine Placement Strategy
- [ ] Is this a new rule area or enhancement to existing rules?
- [ ] Which document(s) need updating?
  - [ ] project-context.md (concise)
  - [ ] 04-implementation-patterns.md (detailed)
  - [ ] 03-core-decisions.md (architecture)
- [ ] What is the correct section heading?

### 4. Synchronization Requirements
- [ ] Update project-context.md with concise rule
- [ ] Update 04-implementation-patterns.md with detailed pattern + example
- [ ] Update 03-core-decisions.md if architectural decision involved
- [ ] Note in CLAUDE.md that Rule Document Registry changed
- [ ] Update Story File List to include all modified rule documents

### 5. Quality Checks
- [ ] Rule clearly distinguishes correct ✅ from incorrect ❌ behavior
- [ ] Code examples included for implementation-patterns.md
- [ ] Source/origin documented (which story CR)
- [ ] Related rules cross-referenced
- [ ] Edge cases covered (if applicable)

---

## Common CR Rule Patterns (Based on Existing Examples)

### Pattern 1: Boundary Validation
**Example:** Token deobfuscation at length thresholds

**Three-document approach:**
1. **project-context.md:** State the rule concisely with threshold values
2. **impl-patterns.md:** Provide code examples for both boundary cases
3. **core-decisions.md:** Explain why boundary validation matters (security consequence)

### Pattern 2: Function Signature/Type Changes
**Example:** InstallResult field changes

**Three-document approach:**
1. **project-context.md:** State which fields are required
2. **impl-patterns.md:** Full pattern with grep search evidence requirement
3. **core-decisions.md:** Type semantic layer explanation

### Pattern 3: Asymmetric Responsibilities
**Example:** symlink-aware APIs

**Three-document approach:**
1. **project-context.md:** Concise rule about API selection
2. **impl-patterns.md:** Truth table (API vs behavior) with code examples
3. **core-decisions.md:** Why centralized (Design Pattern D5b PathResolver)

### Pattern 4: Multi-Stage Validation
**Example:** Preflight checks + operation-path checks

**Three-document approach:**
1. **project-context.md:** State both validation levels required
2. **impl-patterns.md:** Code pattern showing both checks in sequence
3. **core-decisions.md:** Part of D6 Pipeline orchestration

### Pattern 5: Test-Code Connection
**Example:** Mock assertions must verify production calls

**Three-document approach:**
1. **project-context.md:** Testing Rules section - state the requirement
2. **impl-patterns.md:** Full pattern with ✅/❌ examples
3. **core-decisions.md:** Not typically here (unless architectural)

---

## Quick Copy-Paste Locations

### Security Rules Section
**From:** `project-context.md` line 150
**Template:** Copy the "### Security Rules" heading and add new bullet points

### Implementation Patterns - Security
**From:** `04-implementation-patterns.md` line 597
**Template:** Copy the "### Security Patterns" structure with detailed examples

### Testing Patterns
**From:** `04-implementation-patterns.md` line 725
**Template:** Copy the "### Testing Patterns" structure with ✅/❌ code examples

### Error Handling Patterns
**From:** `04-implementation-patterns.md` line 142
**Template:** Copy error pattern examples showing catch blocks, error propagation

---

## File Paths for Quick Reference

```
# Main rule documents
/Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge/_bmad-output/project-context.md
/Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge/_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md
/Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge/_bmad-output/planning-artifacts/architecture/03-core-decisions.md

# Project instructions
/Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge/CLAUDE.md

# Context summary (this session)
/Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge/_bmad-output/CR_RULE_EXTRACTION_CONTEXT.md
```

