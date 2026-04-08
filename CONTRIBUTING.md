# Contributing

Thanks for helping improve Agent Harness Extensions.

## What Contributions Fit This Repo

- Add a new tracked source in `data/sources/*.yaml`
- Update an existing source definition
- Improve harness metadata in `data/harness.yaml`
- Fix sync, derive, verify, or site generation logic
- Improve the directory UI or contribution workflow

## Data Contribution Workflow

The preferred path for adding a new extension source is the repo skill:

- [`skills/add-data-and-test/SKILL.md`](./skills/add-data-and-test/SKILL.md)

Useful reference:

- [`skills/add-data-and-test/references/source-template.md`](./skills/add-data-and-test/references/source-template.md)

## Common Commands

```bash
npm install
```

Sync the latest snapshots:

```bash
npm run sync
```

Build the site and regenerate public data:

```bash
npm run build:site
```

Verify the generated snapshot state:

```bash
npm run verify
```

Run tests:

```bash
npm test
```

Run a typecheck:

```bash
npm run typecheck
```

Start local development:

```bash
npm run dev
```

## Pull Request Expectations

- Keep changes focused on one problem or contribution path
- Include updated generated outputs when the change affects site data
- Run the relevant verification steps before opening a PR
- Explain what changed and why
- Link related issues when applicable

## Notes

- Generated files under `public/data/` are build outputs
- Snapshot history lives under `data/YYYY/MM/DD`
- Avoid unrelated formatting-only churn in large generated or historical files
