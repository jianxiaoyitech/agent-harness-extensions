import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectArtifacts,
  getSnapshotDateStamp,
  getSnapshotDirForDate,
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
