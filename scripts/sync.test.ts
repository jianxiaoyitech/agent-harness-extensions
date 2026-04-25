import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SnapshotSourceRecord, SourceDefinition } from "./lib/catalog.ts";
import {
  buildSyncManifest,
  formatDurationMs,
  partitionSources,
  resolveCachedSourceStartDate,
  resolveRequestedSnapshotDate,
  resolveSyncWorkerCount,
  shouldPruneSnapshotDir,
  summarizeSourceStartDates,
  shouldFailSyncRun,
} from "./sync.ts";

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

describe("partitionSources", () => {
  it("separates valid and invalid source definitions", () => {
    const validFilePath = path.join(process.cwd(), "data/sources/valid.yaml");
    const invalidFilePath = path.join(process.cwd(), "data/sources/invalid.yaml");
    const { validSources, invalidSources } = partitionSources({
      harnessIds,
      sourceEntries: [
        { filePath: validFilePath, source: makeSource() },
        {
          filePath: invalidFilePath,
          source: makeSource({ repo: "" as never }),
        },
      ],
    });

    expect(validSources).toHaveLength(1);
    expect(validSources[0]?.id).toBe("example-source");
    expect(invalidSources).toHaveLength(1);
    expect(invalidSources[0]?.file).toBe(path.relative(process.cwd(), invalidFilePath));
    expect(invalidSources[0]?.issues.some((issue) => issue.includes("repo is required"))).toBe(true);
  });
});

describe("buildSyncManifest", () => {
  it("summarizes artifact and change counts from snapshot sources", () => {
    const manifest = buildSyncManifest({
      harnesses: [
        {
          id: "claude-code",
          name: "Claude Code",
          avatar_text: "CC",
          avatar_bg: "#000",
          avatar_fg: "#fff",
        },
      ],
      validSources: [makeSource()],
      invalidSources: [],
      syncIssues: [],
      snapshotSources: [
        makeSnapshotSource({
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
      ],
    });

    expect(manifest.source_count).toBe(1);
    expect(manifest.artifact_count).toBe(1);
    expect(manifest.sources[0]?.changed_file_count).toBe(1);
    expect(manifest.sources[0]?.mode).toBe("full");
  });

  it("can represent a full latest manifest synthesized from cumulative history", () => {
    const manifest = buildSyncManifest({
      harnesses: [
        {
          id: "claude-code",
          name: "Claude Code",
          avatar_text: "CC",
          avatar_bg: "#000",
          avatar_fg: "#fff",
        },
      ],
      validSources: [
        makeSource(),
        makeSource({
          id: "second-source",
          name: "Second Source",
          repo: "https://github.com/example/second",
        }),
      ],
      invalidSources: [],
      syncIssues: [],
      snapshotSources: [
        makeSnapshotSource(),
        makeSnapshotSource({
          source_id: "second-source",
          source_name: "Second Source",
          repo: "https://github.com/example/second",
          current_sha: "def456",
          changed_files: [],
        }),
      ],
    });

    expect(manifest.source_count).toBe(2);
    expect(manifest.sources).toHaveLength(2);
    expect(manifest.sources.map((source) => source.source_id)).toEqual([
      "example-source",
      "second-source",
    ]);
  });
});

describe("shouldFailSyncRun", () => {
  it("returns true when harness, source, or sync issues exist", () => {
    expect(
      shouldFailSyncRun({
        harnessIssues: ["duplicate harness"],
        invalidSources: [],
        syncIssues: [],
      }),
    ).toBe(true);

    expect(
      shouldFailSyncRun({
        harnessIssues: [],
        invalidSources: [{ file: "x", source_id: "y", issues: ["bad"] }],
        syncIssues: [],
      }),
    ).toBe(true);

    expect(
      shouldFailSyncRun({
        harnessIssues: [],
        invalidSources: [],
        syncIssues: [{ source_id: "z", issues: ["fetch failed"] }],
      }),
    ).toBe(true);

    expect(
      shouldFailSyncRun({
        harnessIssues: [],
        invalidSources: [],
        syncIssues: [],
      }),
    ).toBe(false);
  });
});

describe("resolveCachedSourceStartDate", () => {
  it("uses cached first commit metadata when available", () => {
    expect(
      resolveCachedSourceStartDate(
        makeSnapshotSource({
          first_commit_date: "2025-01-10",
        }),
      ),
    ).toBe("2025-01-10");
  });

  it("returns null when no cached metadata exists yet", () => {
    expect(
      resolveCachedSourceStartDate(
        makeSnapshotSource({
          first_commit_date: undefined,
        }),
      ),
    ).toBeNull();
  });
});

describe("resolveRequestedSnapshotDate", () => {
  it("defaults to the current UTC date when no CLI date is provided", () => {
    expect(resolveRequestedSnapshotDate([], new Date("2026-04-08T12:00:00.000Z"))).toBe(
      "2026-04-08",
    );
  });

  it("accepts explicit --date values", () => {
    expect(
      resolveRequestedSnapshotDate(["--date", "2026-04-07"], new Date("2026-04-08T12:00:00.000Z")),
    ).toBe("2026-04-07");
    expect(
      resolveRequestedSnapshotDate(
        ["--date=2026-04-06"],
        new Date("2026-04-08T12:00:00.000Z"),
      ),
    ).toBe("2026-04-06");
  });

  it("rejects invalid or future dates", () => {
    expect(() =>
      resolveRequestedSnapshotDate(["--date", "2026-04"], new Date("2026-04-08T12:00:00.000Z")),
    ).toThrow('Invalid --date value "2026-04". Use YYYY-MM-DD.');

    expect(() =>
      resolveRequestedSnapshotDate(
        ["--date", "2026-04-09"],
        new Date("2026-04-08T12:00:00.000Z"),
      ),
    ).toThrow(
      'Invalid --date value "2026-04-09". Future snapshot dates after 2026-04-08 are not supported.',
    );
  });
});

describe("resolveSyncWorkerCount", () => {
  it("uses a capped default worker count", () => {
    expect(resolveSyncWorkerCount({}, 1)).toBe(1);
    expect(resolveSyncWorkerCount({}, 3)).toBe(3);
    expect(resolveSyncWorkerCount({}, 12)).toBe(4);
  });

  it("allows an explicit SYNC_WORKERS override", () => {
    expect(resolveSyncWorkerCount({ SYNC_WORKERS: "6" }, 2)).toBe(6);
    expect(resolveSyncWorkerCount({ SYNC_WORKERS: "0" }, 8)).toBe(4);
  });
});

describe("shouldPruneSnapshotDir", () => {
  it("prunes only for full sync runs", () => {
    expect(shouldPruneSnapshotDir(new Set())).toBe(true);
    expect(shouldPruneSnapshotDir(new Set(["example-source"]))).toBe(false);
  });
});

describe("formatDurationMs", () => {
  it("renders compact durations for logs", () => {
    expect(formatDurationMs(450)).toBe("450ms");
    expect(formatDurationMs(4_000)).toBe("4s");
    expect(formatDurationMs(65_000)).toBe("1m 5s");
    expect(formatDurationMs(3_661_000)).toBe("1h 1m 1s");
  });
});

describe("summarizeSourceStartDates", () => {
  it("summarizes source date ranges for sync logging", () => {
    const summary = summarizeSourceStartDates(
      new Map([
        ["source-b", "2025-01-15"],
        ["source-a", "2023-05-19"],
        ["source-c", "2026-01-01"],
      ]),
    );

    expect(summary).toEqual({
      earliestStartDate: "2023-05-19",
      latestStartDate: "2026-01-01",
      sourceCount: 3,
    });
  });

  it("returns null bounds for an empty source set", () => {
    expect(summarizeSourceStartDates(new Map())).toEqual({
      earliestStartDate: null,
      latestStartDate: null,
      sourceCount: 0,
    });
  });
});
