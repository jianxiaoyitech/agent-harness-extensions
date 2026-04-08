# Agent Harness Extensions

A community-expandable, daily-refreshed directory of MCP servers, skills,
plugins, and agents for agent harnesses.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-D97757?logo=anthropic&logoColor=white)](https://www.anthropic.com/claude-code)
[![Codex](https://img.shields.io/badge/Codex-0F172A?logo=openai&logoColor=white)](https://github.com/openai/codex)
[![Cursor](https://img.shields.io/badge/Cursor-111827?logo=cursor&logoColor=white)](https://cursor.sh/)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-4338CA?logo=googlegemini&logoColor=white)](https://github.com/google-gemini/gemini-cli)
[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-18181B?logo=githubcopilot&logoColor=white)](https://code.visualstudio.com/)
[![OpenClaw](https://img.shields.io/badge/%F0%9F%A6%9E-OpenClaw-7C3AED)](#)
[![Windsurf](https://img.shields.io/badge/Windsurf-0F766E?logo=codeium&logoColor=white)](#)

Browse the live directory: [jianxiaoyitech.github.io/agent-harness-extensions](https://jianxiaoyitech.github.io/agent-harness-extensions)

Follow updates: [RSS feed](https://jianxiaoyitech.github.io/agent-harness-extensions/rss.xml)

Data flow: `data/{harness.yaml,sources/*.yaml}` -> `data/YYYY/MM/DD` -> `data/latest` -> `dist/`

## Quick Start

Install dependencies, build the local site from the current snapshot, and start
the frontend:

```bash
npm install
npm run sync
npm run build:site
npm run dev
```

## Contribution

Add your extension through the repo skill:

- [`skills/add-data-and-test/SKILL.md`](./skills/add-data-and-test/SKILL.md)

This skill guides contributors through:

1. Adding or updating authored data in `data/`
2. Creating or editing `data/sources/*.yaml`
3. Running the required local validation steps

## License

[MIT](./LICENSE)
