# Source Template

Use this as a starting point for a new `data/source/sources/*.yaml` file:

```yaml
version: 1
id: example-source
name: Example Source
status: active
repo: https://github.com/example/repo
compatibility:
  claude-code: check
  codex: blank
allowed_types:
  - skill
discovery:
  manifests: true
  conventions: true
  regex: true
  path_patterns:
    - "skills/*/SKILL.md"
  path_regex:
    - pattern: "^skills/[^/]+/SKILL\\.md$"
      type: skill
artifacts: []
exclusions:
  paths: []
  artifacts: []
metadata:
  notes: null
```

Adjust the compatibility keys, allowed types, and discovery rules to match the
actual upstream repository layout.
