import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  LATEST_SNAPSHOT_DIR,
  loadHarnessRegistry,
  loadSourceFiles,
  loadSnapshotSourceRecords,
  readJsonFile,
  validateSource,
} from "./lib/catalog.ts";

interface SnapshotManifestLike {
  invalid_sources: Array<{ file: string; source_id: string | null; issues: string[] }>;
  sync_issues: Array<{ source_id: string; issues: string[] }>;
  artifact_count: number;
}

function parseMultiValueFlag(argv: string[], flag: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === flag) {
      const next = argv[index + 1];
      if (next) {
        values.push(next);
        index += 1;
      }
      continue;
    }

    if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
    }
  }

  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function collectInvalidSources({
  sourceEntries,
  harnessIds,
}: {
  sourceEntries: Array<{ source?: unknown }>;
  harnessIds: string[];
}): Array<{ id: string; issues: string[] }> {
  return sourceEntries
    .map((entry) => ({
      id: (entry.source as { id?: string } | undefined)?.id ?? "unknown",
      issues: validateSource(entry.source, harnessIds),
    }))
    .filter((entry) => entry.issues.length > 0);
}

export function evaluateVerifyState({
  invalidSources,
  snapshot,
}: {
  invalidSources: Array<{ id: string; issues: string[] }>;
  snapshot: SnapshotManifestLike;
}): {
  failed: boolean;
  reportIssues: Array<{ source_id: string; issues: string[] }>;
} {
  const reportIssues = snapshot.sync_issues;
  const failed =
    invalidSources.length > 0 ||
    snapshot.invalid_sources.length > 0 ||
    snapshot.sync_issues.length > 0 ||
    reportIssues.length > 0;

  return { failed, reportIssues };
}

async function main(): Promise<void> {
  const sourceFilter = new Set(parseMultiValueFlag(process.argv.slice(2), "--source"));
  const snapshotDir = LATEST_SNAPSHOT_DIR;
  const harnessRegistry = await loadHarnessRegistry();
  const allHarnessIds = harnessRegistry.harnesses.map((harness) => harness.id);
  const sourceEntries = await loadSourceFiles();
  const snapshot = await readJsonFile<SnapshotManifestLike>(path.join(snapshotDir, "manifest.json"));
  let snapshotSources = await loadSnapshotSourceRecords(snapshotDir);
  if (sourceFilter.size > 0) {
    snapshotSources = snapshotSources.filter((source) => sourceFilter.has(source.source_id));
    console.log(`[verify] Source filter: ${[...sourceFilter].sort().join(", ")}`);
  }
  const invalidSources = collectInvalidSources({
    sourceEntries,
    harnessIds: allHarnessIds,
  });
  const filteredSnapshotInvalidSources =
    sourceFilter.size > 0
      ? snapshot.invalid_sources.filter(
          (entry) => entry.source_id !== null && sourceFilter.has(entry.source_id),
        )
      : snapshot.invalid_sources;
  const filteredSnapshotSyncIssues =
    sourceFilter.size > 0
      ? snapshot.sync_issues.filter((entry) => sourceFilter.has(entry.source_id))
      : snapshot.sync_issues;

  if (invalidSources.length > 0) {
    console.error("Invalid source files detected:");
    console.error(JSON.stringify(invalidSources, null, 2));
    process.exitCode = 1;
  }

  if (filteredSnapshotInvalidSources.length > 0) {
    console.error("Snapshot includes invalid source records:");
    console.error(JSON.stringify(filteredSnapshotInvalidSources, null, 2));
    process.exitCode = 1;
  }

  if (filteredSnapshotSyncIssues.length > 0) {
    console.error("Snapshot sync issues detected:");
    console.error(JSON.stringify(filteredSnapshotSyncIssues, null, 2));
    process.exitCode = 1;
  }

  const { reportIssues } = evaluateVerifyState({
    invalidSources,
    snapshot: {
      ...snapshot,
      invalid_sources: filteredSnapshotInvalidSources,
      sync_issues: filteredSnapshotSyncIssues,
    },
  });
  if (reportIssues.length > 0) {
    console.error("Snapshot sync issues detected:");
    console.error(JSON.stringify(reportIssues, null, 2));
    process.exitCode = 1;
  }

  const mismatchCount = snapshotSources.reduce(
    (sum, source) => sum + source.artifacts.filter((artifact) => artifact.mismatch.type).length,
    0,
  );
  if (mismatchCount > 0) {
    console.warn(`Mismatch count: ${mismatchCount}`);
  }
}

const isDirectRun =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
