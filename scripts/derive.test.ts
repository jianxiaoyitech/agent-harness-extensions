import { describe, expect, it } from "vitest";
import type { ArtifactRecord, Harness, SnapshotSourceRecord, SourceDefinition } from "./lib/catalog.ts";
import {
  buildExtensionGrowthSeries,
  buildDerivedTables,
  buildHarnessSummaries,
  buildRecentUpdates,
  buildRssFeed,
  collectDerivedArtifacts,
  selectValidSources,
} from "./derive.ts";

const harnessIds = ["claude-code", "codex"];

function makeSource(overrides: Partial<SourceDefinition> = {}): SourceDefinition {
  return {
    version: 1,
    id: "example-source",
    name: "Example Source",
    status: "active",
    repo: "https://github.com/example/repo",
    compatibility: {
      "claude-code": "check",
    },
    allowed_types: ["skill"],
    discovery: {
      manifests: true,
      conventions: true,
      regex: true,
      path_patterns: ["skills/*/SKILL.md"],
      path_regex: [
        {
          pattern: "^skills/[^/]+/SKILL\\.md$",
          type: "skill",
        },
      ],
    },
    artifacts: [],
    exclusions: {
      paths: [],
      artifacts: [],
    },
    metadata: {
      notes: null,
    },
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    id: "example-source::skill::skills-alpha-skill-md",
    source_id: "example-source",
    source_name: "Example Source",
    source_status: "active",
    name: "Alpha Skill",
    type: "skill",
    type_label: "Skill",
    path: "skills/alpha/SKILL.md",
    repo: "https://github.com/example/repo",
    repo_path_url: "https://github.com/example/repo/blob/main/skills/alpha/SKILL.md",
    compatibility: {
      "claude-code": "check",
      codex: "blank",
    },
    repo_metrics: {
      stars: 0,
      forks: 0,
      license: "MIT",
      updated_at: "2026-04-07T00:00:00.000Z",
      archived: false,
    },
    detection: {
      method: "pattern",
      pattern: "skills/*/SKILL.md",
    },
    mismatch: {
      type: false,
      allowed_types: ["skill"],
    },
    last_checked_at: "2026-04-07T00:00:00.000Z",
    ...overrides,
  };
}

function makeSnapshotSource(overrides: Partial<SnapshotSourceRecord> = {}): SnapshotSourceRecord {
  return {
    version: 1,
    source_id: "example-source",
    source_name: "Example Source",
    source_status: "active",
    repo: "https://github.com/example/repo",
    default_branch: "main",
    previous_sha: null,
    current_sha: "abc123",
    mode: "full",
    changed_files: ["skills/alpha/SKILL.md"],
    source_config_hash: "hash",
    detector_version: "2",
    synced_at: "2026-04-07T00:00:00.000Z",
    repo_metrics: {
      stars: 0,
      forks: 0,
      license: "MIT",
      updated_at: "2026-04-07T00:00:00.000Z",
      archived: false,
    },
    artifacts: [],
    issues: [],
    ...overrides,
  };
}

const harnesses: Harness[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    avatar_text: "CC",
    avatar_bg: "#000",
    avatar_fg: "#fff",
  },
  {
    id: "codex",
    name: "Codex",
    avatar_text: "CX",
    avatar_bg: "#111",
    avatar_fg: "#eee",
  },
];

describe("selectValidSources", () => {
  it("keeps only sources that pass validation", () => {
    const validSources = selectValidSources({
      harnessIds,
      sourceEntries: [
        { source: makeSource() },
        { source: makeSource({ id: "broken-source", repo: "" as never }) },
      ],
    });

    expect(validSources).toHaveLength(1);
    expect(validSources[0]?.id).toBe("example-source");
  });
});

describe("collectDerivedArtifacts", () => {
  it("flattens snapshot artifacts and sorts by updated time then name", () => {
    const artifacts = collectDerivedArtifacts([
      makeSnapshotSource({
        source_id: "source-a",
        artifacts: [
          makeArtifact({
            id: "a1",
            name: "Zulu Skill",
            repo_metrics: {
              stars: 0,
              forks: 0,
              license: "MIT",
              updated_at: "2026-04-06T00:00:00.000Z",
              archived: false,
            },
          }),
        ],
      }),
      makeSnapshotSource({
        source_id: "source-b",
        artifacts: [
          makeArtifact({
            id: "b1",
            name: "Alpha Skill",
            repo_metrics: {
              stars: 0,
              forks: 0,
              license: "MIT",
              updated_at: "2026-04-07T00:00:00.000Z",
              archived: false,
            },
          }),
          makeArtifact({
            id: "b2",
            name: "Beta Skill",
            repo_metrics: {
              stars: 0,
              forks: 0,
              license: "MIT",
              updated_at: "2026-04-07T00:00:00.000Z",
              archived: false,
            },
          }),
        ],
      }),
    ]);

    expect(artifacts.map((artifact) => artifact.id)).toEqual(["b1", "b2", "a1"]);
  });
});

describe("buildDerivedTables", () => {
  it("groups artifacts into per-type tables", () => {
    const tables = buildDerivedTables({
      harnesses,
      artifacts: [
        makeArtifact({
          id: "skill-1",
          type: "skill",
          type_label: "Skill",
        }),
        makeArtifact({
          id: "agent-1",
          type: "agent",
          type_label: "Agent",
          path: "agents/example.md",
          detection: {
            method: "regex",
            pattern: "^agents/.+\\.md$",
          },
        }),
      ],
    });

    expect(tables.skill).toHaveLength(1);
    expect(tables.agent).toHaveLength(1);
    expect(tables.plugin).toHaveLength(0);
    expect(tables["mcp-server"]).toHaveLength(0);
    expect(tables.agent[0]?.type).toBe("agent");
  });

  it("keeps total row count aligned with flattened artifacts across all type tables", () => {
    const artifacts = [
      makeArtifact({
        id: "skill-1",
        type: "skill",
        type_label: "Skill",
      }),
      makeArtifact({
        id: "plugin-1",
        name: "Example Plugin",
        type: "plugin",
        type_label: "Plugin",
        path: "plugins/example/.codex-plugin/plugin.json",
        repo_path_url:
          "https://github.com/example/repo/blob/main/plugins/example/.codex-plugin/plugin.json",
        detection: {
          method: "manifest",
        },
      }),
      makeArtifact({
        id: "mcp-1",
        name: "Example MCP Server",
        type: "mcp-server",
        type_label: "MCP Server",
        path: "servers/example/.mcp.json",
        repo_path_url: "https://github.com/example/repo/blob/main/servers/example/.mcp.json",
        detection: {
          method: "manifest",
        },
      }),
      makeArtifact({
        id: "agent-1",
        name: "Example Agent",
        type: "agent",
        type_label: "Agent",
        path: "agents/example.md",
        repo_path_url: "https://github.com/example/repo/blob/main/agents/example.md",
        detection: {
          method: "regex",
          pattern: "^agents/.+\\.md$",
        },
      }),
    ];

    const tables = buildDerivedTables({
      harnesses,
      artifacts,
    });

    const totalRows =
      tables["mcp-server"].length + tables.skill.length + tables.plugin.length + tables.agent.length;

    expect(totalRows).toBe(artifacts.length);
    expect(tables.skill.every((row) => row.type === "skill")).toBe(true);
    expect(tables.plugin.every((row) => row.type === "plugin")).toBe(true);
    expect(tables["mcp-server"].every((row) => row.type === "mcp-server")).toBe(true);
    expect(tables.agent.every((row) => row.type === "agent")).toBe(true);
  });
});

describe("buildExtensionGrowthSeries", () => {
  it("builds cumulative totals and rolling growth averages from dated history points", () => {
    const growth = buildExtensionGrowthSeries([
      { date: "2026-01-03", added: 1, removed: 0 },
      { date: "2026-01-01", added: 4, removed: 0 },
      { date: "2026-01-02", added: 3, removed: 1 },
    ]);

    expect(growth.series).toEqual([
      {
        date: "2026-01-01",
        added: 4,
        removed: 0,
        net: 4,
        total: 4,
        rolling_avg_net_7d: 4,
      },
      {
        date: "2026-01-02",
        added: 3,
        removed: 1,
        net: 2,
        total: 6,
        rolling_avg_net_7d: 3,
      },
      {
        date: "2026-01-03",
        added: 1,
        removed: 0,
        net: 1,
        total: 7,
        rolling_avg_net_7d: 2.33,
      },
    ]);
    expect(growth.summary).toEqual({
      start_date: "2026-01-01",
      end_date: "2026-01-03",
      start_total: 4,
      end_total: 7,
      peak_total: 7,
      total_net_growth: 3,
      max_daily_net: 4,
      max_daily_net_date: "2026-01-01",
    });
  });
});

describe("buildRssFeed", () => {
  it("generates an RSS feed with extension items and escaped content", () => {
    const xml = buildRssFeed({
      generatedAt: "2026-04-07T00:00:00.000Z",
      harnesses,
      artifacts: [
        makeArtifact({
          name: "Alpha <Skill>",
          path: "skills/alpha/SKILL.md",
          compatibility: {
            "claude-code": "check",
            codex: "check",
          },
        }),
      ],
      siteUrl: "https://example.com/directory",
    });

    expect(xml).toContain("<rss version=\"2.0\">");
    expect(xml).toContain("<title>Agent Harness Extensions</title>");
    expect(xml).toContain("Alpha &lt;Skill&gt; (Skill)");
    expect(xml).toContain("Supports Claude Code, Codex.");
    expect(xml).toContain("<link>https://example.com/directory</link>");
  });
});

describe("buildHarnessSummaries", () => {
  it("summarizes total and reusable support per harness", () => {
    const summaries = buildHarnessSummaries({
      harnesses,
      artifacts: [
        makeArtifact({
          compatibility: {
            "claude-code": "check",
            codex: "check",
          },
        }),
        makeArtifact({
          id: "skill-2",
          compatibility: {
            "claude-code": "check",
            codex: "blank",
          },
        }),
      ],
    });

    expect(summaries[0]).toMatchObject({
      id: "claude-code",
      total_supported: 2,
      reusable_supported: 1,
    });
    expect(summaries[1]).toMatchObject({
      id: "codex",
      total_supported: 1,
      reusable_supported: 1,
    });
  });
});

describe("buildRecentUpdates", () => {
  it("returns a compact recent-updates list", () => {
    const updates = buildRecentUpdates([
      makeArtifact({
        id: "skill-1",
        name: "Alpha Skill",
      }),
    ]);

    expect(updates).toEqual([
      expect.objectContaining({
        id: "skill-1",
        name: "Alpha Skill",
        type_label: "Skill",
      }),
    ]);
  });
});
