---
name: add-data-and-test
description: Add or update catalog data in this repository and validate it locally. Use when adding a harness entry, creating a new `data/sources` YAML file, updating discovery rules, refreshing snapshot data, or running the required build and test commands after data changes.
license: MIT
compatibility: Requires Node.js, npm, and the repository scripts in scripts/.
metadata:
  author: Jianxiaoyi Technology Co., Ltd.
  version: "1.0"
---

# Add Data And Test

Use this skill when the task is to update repository data and make sure the
change is locally validated.

## What This Repo Treats As Authored Data

- `data/harness.yaml`
  Use for harness metadata such as name, avatar colors, and optional URLs.
- `data/sources/*.yaml`
  Use for upstream source definitions, compatibility overrides, allowed types,
  and discovery rules.

Do not treat `dist/` as authored data. It is local build output.

## Main Workflow

1. Identify what kind of data change is needed.
   - New harness: edit `data/harness.yaml`
   - New source repo: add a file in `data/sources/`
   - Discovery change: update `path_patterns`, `path_regex`, exclusions, or allowed types

2. Make the smallest authored-data change that matches the request.
   - Prefer adding only known compatibility values
   - Omitted compatibility values default to `blank`
   - Keep source YAML repo-first and human-authored

3. Run local validation after the edit.
   - `npm run sync`
   - `npm run build:site`
   - `npm run typecheck`
   - `npm test`
   - `npm run verify`

## Missing Information Workflow

If the user has not provided enough information, guide them step by step instead
of asking for everything at once.

Ask only the next missing item needed to move forward:

1. Ask what kind of change they want.
   - New harness
   - New source repo
   - Update an existing source
   - Update discovery rules

2. If it is a new source repo, ask for the upstream repository URL.

3. Ask which artifact types should be discovered.
   - `mcp-server`
   - `skill`
   - `plugin`
   - `agent`

4. Ask how artifacts are laid out in the upstream repo.
   Examples:
   - `skills/*/SKILL.md`
   - `plugins/*/.claude-plugin/plugin.json`
   - `academic/*.md`

5. Ask only for compatibility values they already know.
   If they do not know, leave the rest as `blank`.

Keep the interaction narrow and progressive. Do not ask a large questionnaire in
one message unless the user explicitly asks for a full checklist.

## Commands

Use these commands from the repository root:

```bash
npm run sync
npm run build:site
npm run typecheck
npm test
npm run verify
```

## Source File Checklist

When adding `data/sources/<name>.yaml`, confirm:

- `version` is `1`
- `id`, `name`, `status`, and `repo` are present
- `allowed_types` only contains supported types:
  - `mcp-server`
  - `skill`
  - `plugin`
  - `agent`
- `discovery.manifests`, `discovery.conventions`, and `discovery.regex` are booleans
- `path_patterns` and `path_regex` fit the actual upstream repo layout
- `exclusions` filters out docs or examples that should not become catalog artifacts

See [references/source-template.md](references/source-template.md) for a starter template.

## Harness Checklist

When editing `data/harness.yaml`, confirm each harness has:

- `id`
- `name`
- `avatar_text`
- `avatar_bg`
- `avatar_fg`

Optional:

- `url`

## Common Pitfalls

- Adding unsupported compatibility keys
- Marking documentation pages as `agent` artifacts by accident
- Forgetting to exclude `README.md`, examples, or integration docs in source discovery
- Assuming sync issues mean the schema is broken when the problem may be an unreachable upstream git remote

## Expected Outcome

A good result includes:

- Authored data updated in `data/`
- Local checks run
- Any failed validation clearly reported
- No unnecessary edits to unrelated files
