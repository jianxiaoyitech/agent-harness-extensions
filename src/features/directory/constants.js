export const TYPE_ORDER = ["agent", "skill", "plugin", "mcp-server"];

export const TYPE_LABELS = {
  "mcp-server": "MCP Servers",
  skill: "Skills",
  plugin: "Plugins",
  agent: "Agents",
};

export const SORT_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "stars", label: "Stars", numeric: true },
  { key: "repo", label: "Install" },
];

export const FEATURED_HARNESS_IDS = [
  "claude-code",
  "codex",
  "cursor",
  "windsurf",
  "openclaw",
];
