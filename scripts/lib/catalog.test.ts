import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildThinSnapshotSourceRecord,
  buildReusedSnapshotSourceRecord,
  canReusePreviousSnapshotSource,
  detectArtifacts,
  getSnapshotDateStamp,
  getSnapshotDirForDate,
  hashSourceConfig,
  type SnapshotSourceRecord,
  type SourceDefinition,
  validateSource,
} from "./catalog.ts";

const harnessIds = [
  "claude-code",
  "codex",
  "cursor",
  "windsurf",
  "github-copilot",
  "openclaw",
];

function makeSnapshotSource(overrides: Partial<SnapshotSourceRecord> = {}): SnapshotSourceRecord {
  return {
    version: 1,
    source_id: "example-source",
    source_name: "Example Source",
    source_status: "active",
    snapshot_date: "2026-04-07",
    first_commit_date: "2026-01-02",
    repo: "https://github.com/example/repo",
    default_branch: "main",
    previous_sha: null,
    current_sha: "abc123",
    mode: "full",
    changed_files: ["skills/example/SKILL.md"],
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

describe("validateSource", () => {
  it("rejects missing required fields", () => {
    const issues = validateSource(
      {
        version: 1,
        id: "bad-source",
        discovery: {
          manifests: true,
          conventions: true,
          regex: true,
        },
      },
      harnessIds,
    );

    expect(issues.some((issue) => issue.includes("name is required"))).toBe(true);
    expect(issues.some((issue) => issue.includes("repo is required"))).toBe(true);
    expect(issues.some((issue) => issue.includes("allowed_types"))).toBe(true);
  });
});

describe("hashSourceConfig", () => {
  it("changes when source status changes", () => {
    const activeSource = {
      version: 1,
      id: "test-source",
      name: "Test Source",
      status: "active",
      repo: "https://github.com/example/repo",
      compatibility: {
        "claude-code": "blank",
      },
      allowed_types: ["skill"],
      discovery: {
        manifests: true,
        conventions: true,
        regex: true,
      },
      artifacts: [],
      exclusions: {
        paths: [],
        artifacts: [],
      },
    } satisfies SourceDefinition;

    const archivedSource = {
      ...activeSource,
      status: "archived",
    } satisfies SourceDefinition;

    expect(hashSourceConfig(activeSource)).not.toBe(hashSourceConfig(archivedSource));
  });
});

describe("detectArtifacts", () => {
  it("finds pattern, regex, and manual entries with manual precedence", () => {
    const source = {
      version: 1,
      id: "test-source",
      name: "Test Source",
      status: "active",
      repo: "https://github.com/example/repo",
      compatibility: {
        "claude-code": "blank",
      },
      allowed_types: ["skill", "plugin"],
      exclusions: { paths: ["tests/**"], artifacts: [] },
      artifacts: [
        {
          name: "Manual Skill Name",
          type: "skill",
          path: "skills/manual/SKILL.md",
        },
      ],
      discovery: {
        manifests: true,
        conventions: true,
        regex: true,
        path_patterns: ["skills/*/SKILL.md"],
        path_regex: [
          {
            pattern: "^plugins/[^/]+/\\.claude-plugin/plugin\\.json$",
            type: "plugin",
          },
        ],
      },
    } satisfies SourceDefinition;

    const artifacts = detectArtifacts(source, {
      files: [
        "skills/manual/SKILL.md",
        "skills/alpha/SKILL.md",
        "plugins/example/.claude-plugin/plugin.json",
        "tests/ignored/SKILL.md",
      ],
    });

    expect(artifacts).toHaveLength(3);
    expect(artifacts.find((artifact) => artifact.path === "skills/manual/SKILL.md")?.name).toBe(
      "Manual Skill Name",
    );
    expect(
      artifacts.some(
        (artifact) =>
          artifact.path === "plugins/example/.claude-plugin/plugin.json" &&
          artifact.type === "plugin",
      ),
    ).toBe(true);
    expect(artifacts.some((artifact) => artifact.path === "tests/ignored/SKILL.md")).toBe(false);
  });
});

describe("snapshot paths", () => {
  it("builds UTC date-stamped snapshot directories", () => {
    const now = new Date("2026-04-08T13:45:00.000Z");

    expect(getSnapshotDateStamp(now)).toBe("2026-04-08");
    expect(getSnapshotDirForDate(getSnapshotDateStamp(now))).toBe(
      path.join(process.cwd(), "data", "2026", "04", "08"),
    );
  });
});

describe("current-day snapshot reuse", () => {
  it("allows a remote-head fast path for unchanged current-day sources", () => {
    expect(
      canReusePreviousSnapshotSource({
        previousSnapshotSource: makeSnapshotSource(),
        snapshotDate: "2026-04-08",
        sourceConfigHash: "hash",
        now: new Date("2026-04-08T12:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("rejects reuse for historical dates or config changes", () => {
    expect(
      canReusePreviousSnapshotSource({
        previousSnapshotSource: makeSnapshotSource(),
        snapshotDate: "2026-04-07",
        sourceConfigHash: "hash",
        now: new Date("2026-04-08T12:00:00.000Z"),
      }),
    ).toBe(false);

    expect(
      canReusePreviousSnapshotSource({
        previousSnapshotSource: makeSnapshotSource(),
        snapshotDate: "2026-04-08",
        sourceConfigHash: "different-hash",
        now: new Date("2026-04-08T12:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("reuses the previous source record without losing first commit metadata", () => {
    const reused = buildReusedSnapshotSourceRecord({
      previousSnapshotSource: makeSnapshotSource(),
      currentSha: "abc123",
      snapshotDate: "2026-04-08",
      syncedAt: "2026-04-08T00:00:00.000Z",
    });

    expect(reused.mode).toBe("unchanged");
    expect(reused.changed_files).toEqual([]);
    expect(reused.previous_sha).toBe("abc123");
    expect(reused.current_sha).toBe("abc123");
    expect(reused.snapshot_date).toBe("2026-04-08");
    expect(reused.first_commit_date).toBe("2026-01-02");
    expect(reused.synced_at).toBe("2026-04-08T00:00:00.000Z");
  });

  it("builds a thin unchanged snapshot payload with counts and carry-forward metadata", () => {
    const thin = buildThinSnapshotSourceRecord(
      makeSnapshotSource({
        mode: "unchanged",
        changed_files: [],
        artifacts: [
          {
            id: "example-source::skill::skills-example-skill-md",
            source_id: "example-source",
            source_name: "Example Source",
            source_status: "active",
            name: "Example Skill",
            type: "skill",
            type_label: "Skill",
            path: "skills/example/SKILL.md",
            repo: "https://github.com/example/repo",
            repo_path_url: "https://github.com/example/repo/blob/main/skills/example/SKILL.md",
            compatibility: {
              "claude-code": "check",
            },
            repo_metrics: {
              stars: 0,
              forks: 0,
              license: "MIT",
              updated_at: "2026-04-07T00:00:00.000Z",
              archived: false,
            },
            detection: { method: "pattern", pattern: "skills/*/SKILL.md" },
            mismatch: {
              type: false,
              allowed_types: ["skill"],
            },
            last_checked_at: "2026-04-07T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(thin.version).toBe(2);
    expect(thin.artifact_count).toBe(1);
    expect(thin.mismatch_count).toBe(0);
    expect(thin.carry_forward_from).toBe("2026-04-07");
  });
});
