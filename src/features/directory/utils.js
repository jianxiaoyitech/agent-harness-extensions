import { TYPE_LABELS, TYPE_ORDER } from "./constants";

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

export function formatDate(value) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatLongDate(value) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatMonthTick(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  }).format(new Date(value));
}

export function updatedStatus(value) {
  if (!value) {
    return {
      label: "Unknown",
      tone: "text-muted-foreground",
    };
  }

  const then = new Date(value).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));

  if (days <= 30) {
    return {
      label: "Recently updated",
      tone: "text-foreground",
    };
  }

  if (days <= 180) {
    return {
      label: "Active this year",
      tone: "text-muted-foreground",
    };
  }

  return {
    label: "Older update",
    tone: "text-muted-foreground",
  };
}

export function compatibilityGlyph(value) {
  if (value === "check") return "✓";
  if (value === "question") return "?";
  return "";
}

export function compatibilityCount(rows, harnessId, value) {
  return rows.filter((row) => (row.compatibility?.[harnessId] || "blank") === value).length;
}

export function supportedHarnessCount(row) {
  return Object.values(row.compatibility || {}).filter((value) => value === "check").length;
}

export function supportedHarnessNames(row, harnesses) {
  return harnesses
    .filter((harness) => (row.compatibility?.[harness.id] || "blank") === "check")
    .map((harness) => harness.name);
}

export function repoLabel(repoUrl) {
  try {
    const { pathname } = new URL(repoUrl);
    return pathname.replace(/^\/+/, "");
  } catch {
    return repoUrl;
  }
}

export function shortPathLabel(filePath) {
  const segments = String(filePath || "").split("/").filter(Boolean);
  if (segments.length <= 2) return filePath;
  return `${segments.slice(0, 2).join("/")}/...`;
}

export function installHint(row) {
  if (row.type === "skill") {
    return {
      title: "Copy into your skills folder",
      detail: "Review the upstream skill files and place them in your harness skill directory.",
    };
  }

  if (row.type === "mcp-server") {
    return {
      title: "Add as an MCP server",
      detail: "Use the upstream README to wire this server into your MCP config.",
    };
  }

  if (row.type === "plugin") {
    return {
      title: "Install from the plugin manifest",
      detail: "Open the upstream repo and follow its plugin setup instructions.",
    };
  }

  return {
    title: "Reuse or copy the agent prompt",
    detail: "Open the upstream repo and adapt the agent files into your workflow.",
  };
}

function pathParent(filePath) {
  const segments = String(filePath || "").split("/").filter(Boolean);
  if (segments.length <= 1) return "";
  return segments.slice(0, -1).join("/");
}

function quotedPath(value) {
  return value ? `"${value}"` : "<path>";
}

function buildSkillInstallTarget(harnessId) {
  if (harnessId === "codex") {
    return {
      label: "Codex",
      folder: "~/.codex/skills/<skill-name>/",
      reload: "Restart Codex or reload your skills.",
    };
  }

  return {
    label: "Claude Code",
    folder: ".claude/skills/<skill-name>/",
    reload: "Restart Claude Code or start a new session.",
  };
}

function buildSkillInstructions(row, harnessId) {
  const sourceFolder = pathParent(row.path);
  const target = buildSkillInstallTarget(harnessId);

  return {
    title: `Install in ${target.label}`,
    steps: [
      `Open the upstream skill folder: ${sourceFolder || row.path}.`,
      `Copy that folder into ${target.folder}`,
      target.reload,
    ],
    snippet: sourceFolder
      ? `git clone ${row.repo}\ncp -R ${quotedPath(`<repo>/${sourceFolder}`)} ${quotedPath(target.folder)}`
      : null,
  };
}

function buildMcpInstructions(row, harnessId) {
  const harnessLabel = harnessId === "codex" ? "Codex" : "Claude Code";

  return {
    title: `Add to ${harnessLabel}`,
    steps: [
      `Open the upstream README and install the server package or binary.`,
      `Copy the server command, args, and env values from the upstream setup docs.`,
      `Add that server entry to your ${harnessLabel} MCP configuration.`,
    ],
    snippet: `{\n  "mcpServers": {\n    "${row.name}": {\n      "command": "<from upstream README>",\n      "args": ["<args>"]\n    }\n  }\n}`,
  };
}

function buildPluginInstructions(row, harnessId) {
  const harnessLabel = harnessId === "codex" ? "Codex" : "Claude Code";

  return {
    title: `Use with ${harnessLabel}`,
    steps: [
      `Open the plugin manifest in the upstream repo.`,
      `Follow the upstream install steps if this repo supports ${harnessLabel}.`,
      `If not, copy the prompt or config pieces you need into your local workflow.`,
    ],
    snippet: null,
  };
}

function buildAgentInstructions(row, harnessId) {
  const harnessLabel = harnessId === "codex" ? "Codex" : "Claude Code";

  return {
    title: `Reuse in ${harnessLabel}`,
    steps: [
      `Open the upstream markdown prompt or agent file.`,
      `Copy the sections you want into your ${harnessLabel} workflow or local prompt library.`,
      `Adapt any tool names, model assumptions, or file paths before using it.`,
    ],
    snippet: null,
  };
}

export function buildInstallGuide(row, harnessId) {
  if (row.type === "skill") {
    return buildSkillInstructions(row, harnessId);
  }

  if (row.type === "mcp-server") {
    return buildMcpInstructions(row, harnessId);
  }

  if (row.type === "plugin") {
    return buildPluginInstructions(row, harnessId);
  }

  return buildAgentInstructions(row, harnessId);
}

export function buildQuerySummary({
  activeType,
  filteredRows,
  activeCompatibilityFilters,
  harnesses,
  crossHarnessOnly,
}) {
  const typeLabel = TYPE_LABELS[activeType].toLowerCase();
  const harnessNames = activeCompatibilityFilters
    .map(([harnessId]) => harnesses.find((item) => item.id === harnessId)?.name || harnessId)
    .filter(Boolean);

  let scope = "across all tracked harnesses";
  if (harnessNames.length === 1) {
    scope = `that support ${harnessNames[0]}`;
  } else if (harnessNames.length > 1) {
    scope = `that support ${harnessNames.join(" and ")}`;
  }

  if (crossHarnessOnly) {
    scope = `${scope}${harnessNames.length > 0 ? " and " : "that "}work across multiple harnesses`;
  }

  return `${filteredRows.length} ${typeLabel} shown ${scope}.`;
}

export function buildFilteredTypeCounts(tables, compatibilityFilters, crossHarnessOnly) {
  return TYPE_ORDER.map((type) => {
    const rows = tables[type] || [];
    const count = rows.filter((row) => {
      if (crossHarnessOnly && supportedHarnessCount(row) < 2) {
        return false;
      }

      for (const [harnessId, filterValue] of Object.entries(compatibilityFilters)) {
        if (filterValue === "any") continue;
        if ((row.compatibility?.[harnessId] || "blank") !== filterValue) {
          return false;
        }
      }

      return true;
    }).length;

    return {
      type,
      label: TYPE_LABELS[type],
      count,
    };
  });
}

export function compareValues(left, right, numeric = false) {
  if (numeric) return (left ?? 0) - (right ?? 0);
  return String(left ?? "").localeCompare(String(right ?? ""));
}
