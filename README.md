# Agent Harness Extensions

A community-expandable, daily-refreshed directory of MCP servers, skills,
plugins, and agents for agent harnesses.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Deploy Pages](https://github.com/jianxiaoyitech/agent-harness-extensions/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/jianxiaoyitech/agent-harness-extensions/actions/workflows/deploy-pages.yml)
[![Live Directory](https://img.shields.io/badge/Live%20Directory-Open-0F766E)](https://jianxiaoyitech.github.io/agent-harness-extensions)
[![RSS](https://img.shields.io/badge/RSS-Subscribe-F59E0B)](https://jianxiaoyitech.github.io/agent-harness-extensions/rss.xml)
[![Data](https://img.shields.io/badge/Data-Daily%20Refreshed-2563EB)](https://jianxiaoyitech.github.io/agent-harness-extensions)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-D97757?logo=anthropic&logoColor=white)](https://www.anthropic.com/claude-code)
[![Codex](https://img.shields.io/badge/Codex-0F172A?logo=openai&logoColor=white)](https://github.com/openai/codex)
[![Cursor](https://img.shields.io/badge/Cursor-111827?logo=cursor&logoColor=white)](https://cursor.sh/)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-4338CA?logo=googlegemini&logoColor=white)](https://github.com/google-gemini/gemini-cli)
[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-18181B?logo=githubcopilot&logoColor=white)](https://code.visualstudio.com/)
[![OpenClaw](https://img.shields.io/badge/%F0%9F%A6%9E-OpenClaw-7C3AED)](#)
[![Windsurf](https://img.shields.io/badge/Windsurf-0F766E?logo=codeium&logoColor=white)](#)

Agent Harness Extensions is a curated, daily-refreshed directory for extension ecosystems around agent harnesses. It aggregates MCP servers, skills, plugins, and agents into one searchable site so contributors can publish entries consistently and users can discover what works across tools.

Browse the live directory: [jianxiaoyitech.github.io/agent-harness-extensions](https://jianxiaoyitech.github.io/agent-harness-extensions)

Follow updates: [RSS feed](https://jianxiaoyitech.github.io/agent-harness-extensions/rss.xml)

## What You Can Do

- Discover extensions by harness compatibility, type, repository, and update recency.
- Contribute new sources and data definitions through the repo workflow.
- Rebuild snapshots locally and verify the generated directory before opening a PR.
- Subscribe to RSS updates for newly tracked artifacts.

## Quick Start

Install dependencies, build the local site from the current snapshot, and start
the frontend:

```bash
npm install
npm run sync
npm run build:site
npm run dev
```

## Contributing Data

Start with [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Add your extension through the repo skill:

- [`skills/add-data-and-test/SKILL.md`](./skills/add-data-and-test/SKILL.md)

This skill guides contributors through:

1. Adding or updating authored data in `data/`
2. Creating or editing `data/sources/*.yaml`
3. Running the required local validation steps

## Support

Need help or want to request a source?

- Open a bug report or source request in [GitHub Issues](https://github.com/jianxiaoyitech/agent-harness-extensions/issues)
- Read [`SUPPORT.md`](./SUPPORT.md) for issue routing guidance

## License

[MIT](./LICENSE)
