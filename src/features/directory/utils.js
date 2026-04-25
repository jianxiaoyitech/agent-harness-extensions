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

function shellQuote(value) {
  if (!value) return "''";
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function repoDirName(repoUrl) {
  const label = repoLabel(repoUrl);
  const last = label.split("/").filter(Boolean).pop() || "repo";
  return last.replace(/\.git$/i, "");
}

function fileStem(filePath) {
  const name = String(filePath || "").split("/").filter(Boolean).pop() || "artifact";
  return name.replace(/\.[^.]+$/, "");
}

function pluginRoot(filePath) {
  const segments = String(filePath || "").split("/").filter(Boolean);
  const pluginIndex = segments.findIndex(
    (segment) => segment === "plugins" || segment === "external_plugins",
  );

  if (pluginIndex === -1 || !segments[pluginIndex + 1]) return "";
  return `${segments[pluginIndex]}/${segments[pluginIndex + 1]}`;
}

function pluginNameFromPath(filePath) {
  const root = pluginRoot(filePath);
  return root.split("/").pop() || fileStem(filePath);
}

function artifactCopyDir(row) {
  if (row.type === "skill") {
    return pathParent(row.path);
  }

  if (row.type === "plugin" || row.type === "mcp-server") {
    return pluginRoot(row.path) || pathParent(row.path);
  }

  return row.path;
}

function buildCloneSnippet(row, lines) {
  const repoDir = repoDirName(row.repo);
  return [`git clone ${row.repo}`, `cd ${repoDir}`, ...lines].join("\n");
}

function buildGenericSkillTarget(harnessId, row) {
  const folderName = pathParent(row.path).split("/").filter(Boolean).pop() || fileStem(row.path);

  if (harnessId === "codex") {
    return {
      label: "Codex",
      folder: `~/.codex/skills/${folderName}`,
      reload: "Restart Codex so it reloads the new skill.",
    };
  }

  if (harnessId === "openclaw") {
    return {
      label: "OpenClaw",
      folder: `~/.openclaw/skills/${folderName}`,
      reload: "Restart OpenClaw after adding the skill files.",
    };
  }

  return {
    label: "Claude Code",
    folder: `~/.claude/skills/${folderName}`,
    reload: "Restart Claude Code or start a new session.",
  };
}

function isAgencyAgentsFamily(row) {
  return String(row.source_id || "").includes("agency-agents");
}

function buildSourceSpecificGuide(row, harnessId) {
  if (isAgencyAgentsFamily(row)) {
    if (harnessId === "claude-code") {
      return {
        title: "Install in Claude Code",
        steps: [
          "This repo documents a native Claude Code installer.",
          "Clone the repo, then run the installer for the full repo catalog.",
          "Start a new Claude Code session after installation.",
        ],
        snippet: buildCloneSnippet(row, ["./scripts/install.sh --tool claude-code"]),
      };
    }

    if (harnessId === "codex") {
      return {
        title: "Install in Codex",
        steps: [
          "This repo documents a Codex conversion and install flow.",
          "Clone the repo, generate the Codex format, then run the installer for the repo catalog.",
          "Start a fresh Codex session after installation.",
        ],
        snippet: buildCloneSnippet(row, [
          "./scripts/install.sh --tool codex",
        ]),
      };
    }

    if (harnessId === "openclaw") {
      return {
        title: "Install in OpenClaw",
        steps: [
          "This repo documents OpenClaw installation through its conversion and install scripts.",
          "Clone the repo, generate the OpenClaw workspaces, then run the installer.",
          "Restart the OpenClaw gateway if the new agents do not appear immediately.",
        ],
        snippet: buildCloneSnippet(row, [
          "./scripts/convert.sh --tool openclaw",
          "./scripts/install.sh --tool openclaw",
          "openclaw gateway restart",
        ]),
      };
    }
  }

  if (row.source_id === "anthropic-claude-plugins-official" && harnessId === "claude-code") {
    const pluginName = pluginNameFromPath(row.path);

    return {
      title: "Install in Claude Code",
      steps: [
        "This source is Claude Code's plugin marketplace.",
        "Install the parent plugin directly from the marketplace command.",
        "The selected skill, agent, or MCP server ships with that plugin.",
      ],
      snippet: `/plugin install ${pluginName}@claude-plugins-official`,
    };
  }

  if (row.source_id === "feiskyer-codex-settings" && harnessId === "codex") {
    return {
      title: "Install in Codex",
      steps: [
        "This repo is documented as a full Codex home directory setup.",
        "Clone it into ~/.codex to install the included prompts, skills, and config together.",
        "Start a fresh Codex session after cloning.",
      ],
      snippet: [
        "# back up an existing Codex home first if you already have one",
        "mv ~/.codex ~/.codex.bak",
        `git clone ${row.repo} ~/.codex`,
      ].join("\n"),
    };
  }

  if (row.source_id === "openai-skills" && harnessId === "codex" && row.type === "skill") {
    const skillFolder = pathParent(row.path);
    const skillName = skillFolder.split("/").filter(Boolean).pop() || fileStem(row.path);

    return {
      title: "Install in Codex",
      steps: [
        "This source is already structured for Codex skills.",
        "Clone the repo, then copy just the selected skill folder into ~/.codex/skills.",
        "Restart Codex after the copy completes.",
      ],
      snippet: buildCloneSnippet(row, [
        `mkdir -p ~/.codex/skills/${skillName}`,
        `cp -R ${shellQuote(skillFolder)}/. ~/.codex/skills/${skillName}/`,
      ]),
    };
  }

  if (row.source_id === "win4r-openclaw-workspace" && harnessId === "claude-code") {
    return {
      title: "Install in Claude Code",
      steps: [
        "The README documents this repo as a Claude Code skill.",
        "Clone it directly into your Claude Code skills directory.",
        "Start a new Claude Code session so the skill is discovered.",
      ],
      snippet: `git clone ${row.repo} ~/.claude/skills/openclaw-workspace`,
    };
  }

  return null;
}

function buildSkillInstructions(row, harnessId) {
  const sourceFolder = pathParent(row.path);
  const target = buildGenericSkillTarget(harnessId, row);

  return {
    title: `Install in ${target.label}`,
    steps: [
      "Clone the repo so you have the full skill folder locally.",
      `Copy the skill folder you want into ${target.folder}.`,
      target.reload,
    ],
    snippet: buildCloneSnippet(row, [
      `mkdir -p ${target.folder}`,
      `# repeat for each skill folder you want to install`,
      `cp -R ${shellQuote(sourceFolder || row.path)}/. ${target.folder}/`,
    ]),
  };
}

function buildMcpInstructions(row, harnessId) {
  const harnessLabel =
    harnessId === "codex" ? "Codex" : harnessId === "openclaw" ? "OpenClaw" : "Claude Code";
  const sourceDir = artifactCopyDir(row);

  return {
    title: `Add to ${harnessLabel}`,
    steps: [
      "Clone the repo so you can inspect the exact server package and README.",
      `Use the repo README and ${row.path} as your starting point for the command, args, and env in ${harnessLabel}.`,
      `Add the finished server entry to your ${harnessLabel} MCP configuration.`,
    ],
    snippet: buildCloneSnippet(row, [
      `cd ${shellQuote(sourceDir)}`,
      "# open the local README and .mcp.json, then copy the command into your harness config",
    ]),
  };
}

function buildPluginInstructions(row, harnessId) {
  const harnessLabel =
    harnessId === "codex" ? "Codex" : harnessId === "openclaw" ? "OpenClaw" : "Claude Code";
  const sourceDir = artifactCopyDir(row);

  return {
    title: `Use with ${harnessLabel}`,
    steps: [
      "Clone the repo so the full plugin directory is local.",
      `Copy the plugin folder or reuse the parts you want for ${harnessLabel}.`,
      "Restart the harness after adding the new files.",
    ],
    snippet: buildCloneSnippet(row, [
      `mkdir -p ~/tmp/${repoDirName(row.repo)}-install`,
      `cp -R ${shellQuote(sourceDir)} ~/tmp/${repoDirName(row.repo)}-install/`,
    ]),
  };
}

function buildAgentInstructions(row, harnessId) {
  if (harnessId === "openclaw") {
    return {
      title: "Install in OpenClaw",
      steps: [
        "Clone the repo so you have the original prompt files locally.",
        "Copy the agent markdown files you want into your OpenClaw workspace docs or agent prompt directory.",
        "Restart the OpenClaw gateway if the new prompt is not picked up immediately.",
      ],
      snippet: buildCloneSnippet(row, [
        "mkdir -p ~/.openclaw/workspace/docs/agents",
        "# repeat for each agent file you want to add",
        `cp ${shellQuote(row.path)} ~/.openclaw/workspace/docs/agents/`,
        "openclaw gateway restart",
      ]),
    };
  }

  const harnessLabel = harnessId === "codex" ? "Codex" : "Claude Code";
  const targetFolder = harnessId === "codex" ? "~/.codex/prompts" : "~/.claude/agents";

  return {
    title: `Reuse in ${harnessLabel}`,
    steps: [
      "Clone the repo so you can copy the original prompt files directly.",
      `Copy the agent markdown files you want into ${targetFolder}.`,
      `Start a fresh ${harnessLabel} session after adding it.`,
    ],
    snippet: buildCloneSnippet(row, [
      `mkdir -p ${targetFolder}`,
      "# repeat for each agent file you want to add",
      `cp ${shellQuote(row.path)} ${targetFolder}/`,
    ]),
  };
}

export function buildInstallGuide(row, harnessId) {
  const sourceSpecificGuide = buildSourceSpecificGuide(row, harnessId);

  if (sourceSpecificGuide) {
    return sourceSpecificGuide;
  }

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
