export const TYPE_ORDER = ["mcp-server", "skill", "plugin", "agent"];

export const TYPE_LABELS = {
  "mcp-server": "MCP Servers",
  skill: "Skills",
  plugin: "Plugins",
  agent: "Agents",
};

export const SORT_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "supported_harnesses", label: "Works With", numeric: true },
  { key: "repo", label: "Repo" },
  { key: "updated_at", label: "Updated" },
];

export const FEATURED_HARNESS_IDS = [
  "claude-code",
  "codex",
  "cursor",
  "windsurf",
  "openclaw",
];
