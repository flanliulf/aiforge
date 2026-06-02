# Contributing Guide

This guide is for contributors and maintainers who update `aiforge` code, documentation, or release artifacts.

[中文版本](contributing.zh.md)

## Contribution Paths

- Fix or improve user-facing CLI behavior in `src/` and matching `tests/`
- Improve public docs in `README*`, `docs/*.md`, and `CHANGELOG.md`
- Add or update tool support through `src/data/tool-registry.ts`, `src/data/install-rules.ts`, and the related tests

## Development Setup

### Prerequisites

- Node.js `>=18.0.0`
- Git `>=2.20`

### Local Workflow

```bash
npm install
npm run dev -- --help
```

Use the source runner while iterating:

```bash
npm run dev -- --dry-run
```

Build output remains the release artifact:

```bash
npm run build
node dist/index.js --help
```

If you need to test the installed `aiforge` command locally:

```bash
npm run build
npm link
aiforge --help
npm unlink -g aiforge
```

## Validation Checklist

Run the standard validation set before sending a change for review:

```bash
npm run lint:src
npm run build
npm test
```

Use the broader release gate when a change affects published package contents such as `README*`, `docs/*.md`, `CHANGELOG.md`, `package.json`, or `dist/` expectations:

```bash
npm run release:check
```

## Documentation Expectations

### Keep published docs discoverable

- Treat [README](../README.md), [README.zh.md](../README.zh.md), and the pages under `docs/` as the public documentation surface
- Keep English and Chinese user-facing docs aligned when behavior changes
- Put core published docs in `docs/`; keep draft or process-heavy material in `docs/references/`

### Update the right docs when behavior changes

- If a change affects install flow, configuration, migration, or troubleshooting, review the matching public docs page in `docs/`
- If a change is user-visible, add or update the release note in [CHANGELOG.md](../CHANGELOG.md)
- If a change updates implementation rules or engineering conventions, also sync the Rule Document Registry documents listed in `_bmad-output/project-context.md`. This local agent rule file is not included in the npm package.

## Adding Or Updating Tool Support

When you add a tool or adjust an existing tool mapping:

1. Update the data sources in `src/data/`
2. Update tests that cover detection, rule matching, and installation behavior
3. Review the public docs together:
   - [Install Rules Matrix](install-rules-matrix.md)
   - [Getting Started](getting-started.md)
   - [Migration v2](migration-v2.md) when compatibility or naming changes
   - [README](../README.md) and [README.zh.md](../README.zh.md) if the tool list or positioning changes

## Release Maintainers

For package-bound changes:

1. Bump to a new unpublished version
2. Update any version references in `README*` and release notes
3. Run `npm run release:check`
4. Publish with npm using the project's approved workflow
5. Verify the published package and docs links

The step-by-step release runbook is currently maintained in Chinese at [npm Publishing Guide](npm-publishing-guide.zh.md).

## Submitting Changes

- Describe the user-visible effect and the validation you ran
- Include doc updates in the same change when behavior changes
- Keep change scope tight; do not mix unrelated cleanup with a feature or fix
