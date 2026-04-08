import { describe, expect, it } from "vitest";
import { collectInvalidSources, evaluateVerifyState } from "./verify.ts";

const harnessIds = ["claude-code", "codex"];

describe("collectInvalidSources", () => {
  it("returns only entries that fail validation", () => {
    const invalidSources = collectInvalidSources({
      harnessIds,
      sourceEntries: [
        {
          source: {
            version: 1,
            id: "valid-source",
            name: "Valid Source",
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
            },
          },
        },
        {
          source: {
            version: 1,
            id: "invalid-source",
            discovery: {
              manifests: true,
              conventions: true,
              regex: true,
            },
          },
        },
      ],
    });

    expect(invalidSources).toHaveLength(1);
    expect(invalidSources[0]?.id).toBe("invalid-source");
    expect(invalidSources[0]?.issues.some((issue) => issue.includes("name is required"))).toBe(true);
  });
});

describe("evaluateVerifyState", () => {
  it("fails when any invalid or sync issues are present", () => {
    const result = evaluateVerifyState({
      invalidSources: [{ id: "bad-source", issues: ["repo is required"] }],
      snapshot: {
        invalid_sources: [],
        sync_issues: [],
        artifact_count: 0,
      },
    });

    expect(result.failed).toBe(true);
  });

  it("returns snapshot sync issues directly", () => {
    const result = evaluateVerifyState({
      invalidSources: [],
      snapshot: {
        invalid_sources: [],
        sync_issues: [{ source_id: "current", issues: ["new issue"] }],
        artifact_count: 10,
      },
    });

    expect(result.failed).toBe(true);
    expect(result.reportIssues).toEqual([{ source_id: "current", issues: ["new issue"] }]);
  });

  it("passes clean state without invalid or sync issues", () => {
    const result = evaluateVerifyState({
      invalidSources: [],
      snapshot: {
        invalid_sources: [],
        sync_issues: [],
        artifact_count: 12,
      },
    });

    expect(result.failed).toBe(false);
    expect(result.reportIssues).toEqual([]);
  });
});
