import { describe, expect, it } from "vitest";
import type {
  ArtifactRecord,
  Harness,
  SnapshotSourceRecord,
  SourceDefinition,
} from "./lib/catalog.ts";
import { summarizeReport } from "./lib/catalog.ts";
import { collectDerivedArtifacts } from "./derive.ts";
import { buildSyncManifest } from "./sync.ts";
import { evaluateVerifyState } from "./verify.ts";

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
    allowed_types: ["skill", "agent"],
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
    metadata: {
      notes: null,
    },
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
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
    detection: {
      method: "pattern",
      pattern: "skills/*/SKILL.md",
    },
    mismatch: {
      type: false,
      allowed_types: ["skill", "agent"],
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

const harnesses: Harness[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    avatar_text: "CC",
    avatar_bg: "#000",
    avatar_fg: "#fff",
  },
];

describe("pipeline integration", () => {
  it("keeps sync, derive, and verify counts aligned for a clean snapshot", () => {
    const validSources = [makeSource()];
    const snapshotSources = [
      makeSnapshotSource({
        artifacts: [
          makeArtifact(),
          makeArtifact({
            id: "example-source::agent::agents-example-md",
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
        ],
      }),
    ];

    const manifest = buildSyncManifest({
      harnesses,
      validSources,
      invalidSources: [],
      syncIssues: [],
      snapshotSources,
    });
    const artifacts = collectDerivedArtifacts(snapshotSources);
    const report = summarizeReport({
      buildVersion: "1.2.3",
      harnesses,
      sources: validSources,
      invalidSources: manifest.invalid_sources,
      syncIssues: manifest.sync_issues,
      artifacts,
    });
    const verifyState = evaluateVerifyState({
      invalidSources: [],
      snapshot: {
        invalid_sources: manifest.invalid_sources,
        sync_issues: manifest.sync_issues,
        artifact_count: manifest.artifact_count,
      },
    });

    expect(manifest.artifact_count).toBe(2);
    expect(report.build_version).toBe("1.2.3");
    expect(report.artifact_count).toBe(2);
    expect(manifest.source_count).toBe(report.source_count);
    expect(report.sync_issues).toEqual([]);
    expect(verifyState.failed).toBe(false);
  });

  it("surfaces sync issues from snapshot through derive into verify", () => {
    const validSources = [makeSource()];
    const snapshotSources = [makeSnapshotSource()];
    const syncIssues = [{ source_id: "example-source", issues: ["git fetch failed"] }];

    const manifest = buildSyncManifest({
      harnesses,
      validSources,
      invalidSources: [],
      syncIssues,
      snapshotSources,
    });
    const artifacts = collectDerivedArtifacts(snapshotSources);
    const report = summarizeReport({
      buildVersion: "1.2.3",
      harnesses,
      sources: validSources,
      invalidSources: manifest.invalid_sources,
      syncIssues: manifest.sync_issues,
      artifacts,
    });
    const verifyState = evaluateVerifyState({
      invalidSources: [],
      snapshot: {
        invalid_sources: manifest.invalid_sources,
        sync_issues: manifest.sync_issues,
        artifact_count: manifest.artifact_count,
      },
    });

    expect(report.sync_issues).toEqual(syncIssues);
    expect(verifyState.reportIssues).toEqual(syncIssues);
    expect(verifyState.failed).toBe(true);
  });
});
