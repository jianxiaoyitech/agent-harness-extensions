import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  type Harness,
  type SnapshotManifest,
  type SnapshotSourceRecord,
  type SourceDefinition,
  ensureDir,
  getSnapshotDateStamp,
  getSnapshotDirForDate,
  isValidDateStamp,
  loadDaySnapshotSourceRecords,
  loadHarnessRegistry,
  loadLatestSourceRecordBeforeDate,
  loadSnapshotSourceRecords,
  loadSourceFiles,
  pruneSnapshotSources,
  resolveSourceFirstCommitDate,
  summarizeSnapshotManifest,
  updateLatestSnapshot,
  validateSource,
  writeJson,
} from "./lib/catalog.ts";

const execFile = promisify(execFileCallback);

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

function logIssueBlock(title: string, issues: string[]): void {
  console.warn(`[sync] ${title}`);
  for (const issue of issues) {
    console.warn(`  - ${issue}`);
  }
}

function logInvalidSources(
  invalidSources: Array<{ file: string; source_id: string | null; issues: string[] }>,
): void {
  if (invalidSources.length === 0) return;

  console.warn(`[sync] Found ${invalidSources.length} invalid source definition(s)`);
  for (const invalidSource of invalidSources) {
    const sourceLabel = invalidSource.source_id ?? "(missing id)";
    console.warn(`  - ${sourceLabel} in ${invalidSource.file}`);
    for (const issue of invalidSource.issues) {
      console.warn(`    * ${issue}`);
    }
  }
}

function logSyncIssues(syncIssues: Array<{ source_id: string; issues: string[] }>): void {
  if (syncIssues.length === 0) return;

  console.warn(`[sync] Encountered ${syncIssues.length} source sync failure(s)`);
  for (const syncIssue of syncIssues) {
    console.warn(`  - ${syncIssue.source_id}`);
    for (const issue of syncIssue.issues) {
      console.warn(`    * ${issue}`);
    }
  }
}

export function formatDurationMs(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs}ms`;

  const totalSeconds = Math.round(durationMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

export function summarizeSourceStartDates(
  sourceStartDates: Map<string, string>,
): { earliestStartDate: string | null; latestStartDate: string | null; sourceCount: number } {
  const sortedDates = [...sourceStartDates.values()].sort();
  return {
    earliestStartDate: sortedDates.at(0) ?? null,
    latestStartDate: sortedDates.at(-1) ?? null,
    sourceCount: sourceStartDates.size,
  };
}

export function resolveCachedSourceStartDate(
  previousSnapshotSource: SnapshotSourceRecord | null | undefined,
): string | null {
  return previousSnapshotSource?.first_commit_date ?? null;
}

export function partitionSources({
  harnessIds,
  sourceEntries,
}: {
  harnessIds: string[];
  sourceEntries: Array<{ filePath: string; source: SourceDefinition }>;
}): {
  invalidSources: Array<{ file: string; source_id: string | null; issues: string[] }>;
  validSources: SourceDefinition[];
} {
  const invalidSources: Array<{ file: string; source_id: string | null; issues: string[] }> = [];
  const validSources = [];

  for (const entry of sourceEntries) {
    const issues = validateSource(entry.source, harnessIds);
    if (issues.length > 0) {
      invalidSources.push({
        file: path.relative(process.cwd(), entry.filePath),
        source_id: entry.source?.id ?? null,
        issues,
      });
      continue;
    }
    validSources.push(entry.source);
  }

  return { invalidSources, validSources };
}

export function shouldFailSyncRun({
  harnessIssues,
  invalidSources,
  syncIssues,
}: {
  harnessIssues: string[];
  invalidSources: Array<{ file: string; source_id: string | null; issues: string[] }>;
  syncIssues: Array<{ source_id: string; issues: string[] }>;
}): boolean {
  return harnessIssues.length > 0 || invalidSources.length > 0 || syncIssues.length > 0;
}

export function buildSyncManifest(args: {
  harnesses: Harness[];
  validSources: SourceDefinition[];
  invalidSources: Array<{ file: string; source_id: string | null; issues: string[] }>;
  syncIssues: Array<{ source_id: string; issues: string[] }>;
  snapshotSources: SnapshotSourceRecord[];
}): SnapshotManifest {
  return summarizeSnapshotManifest(args);
}

export function resolveRequestedSnapshotDate(
  argv: string[],
  now: Date = new Date(),
): string {
  const defaultDate = getSnapshotDateStamp(now);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--date") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --date. Use YYYY-MM-DD.");
      }
      if (!isValidDateStamp(value)) {
        throw new Error(`Invalid --date value "${value}". Use YYYY-MM-DD.`);
      }
      if (value > defaultDate) {
        throw new Error(
          `Invalid --date value "${value}". Future snapshot dates after ${defaultDate} are not supported.`,
        );
      }
      return value;
    }

    if (arg.startsWith("--date=")) {
      const value = arg.slice("--date=".length);
      if (!isValidDateStamp(value)) {
        throw new Error(`Invalid --date value "${value}". Use YYYY-MM-DD.`);
      }
      if (value > defaultDate) {
        throw new Error(
          `Invalid --date value "${value}". Future snapshot dates after ${defaultDate} are not supported.`,
        );
      }
      return value;
    }
  }

  return defaultDate;
}

export function resolveSyncWorkerCount(
  env: NodeJS.ProcessEnv = process.env,
  parallelism: number = os.availableParallelism(),
): number {
  const rawValue = env.SYNC_WORKERS;
  if (rawValue) {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return parsed;
    }
  }

  return Math.max(1, Math.min(4, parallelism));
}

export function shouldPruneSnapshotDir(sourceFilter: Set<string>): boolean {
  return sourceFilter.size === 0;
}

interface SourceWorkerResult {
  artifact_count: number;
  changed_file_count: number;
  generated_day_count: number;
  mode: SnapshotSourceRecord["mode"];
  skipped_day_count: number;
  source_id: string;
}

async function runSourceWorker(args: {
  endDate?: string;
  startDate?: string;
  source: SourceDefinition;
  snapshotDate?: string;
  snapshotDir: string;
  previousSnapshotDir?: string;
}): Promise<SourceWorkerResult> {
  const workerArgs = ["scripts/sync-source.ts", "--source-id", args.source.id];
  if (args.endDate) {
    workerArgs.push("--end-date", args.endDate);
    if (args.startDate) {
      workerArgs.push("--start-date", args.startDate);
    }
  } else {
    workerArgs.push(
      "--snapshot-dir",
      args.snapshotDir,
      "--previous-snapshot-dir",
      args.previousSnapshotDir!,
    );
    if (args.snapshotDate) {
      workerArgs.push("--snapshot-date", args.snapshotDate);
    }
  }

  const { stdout } = await execFile("tsx", workerArgs, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });

  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error(`Worker for ${args.source.id} returned no result.`);
  }

  return JSON.parse(trimmed) as SourceWorkerResult;
}

async function deleteSnapshotSourceFile(snapshotDir: string, sourceId: string): Promise<void> {
  try {
    await fs.unlink(path.join(snapshotDir, `${sourceId}.json`));
  } catch {
    // Ignore missing files so cleanup can be best-effort.
  }
}

async function main(): Promise<void> {
  const syncStartedAt = Date.now();
  const sourceFilter = new Set(parseMultiValueFlag(process.argv.slice(2), "--source"));
  const todayDateStamp = getSnapshotDateStamp();
  const snapshotDateStamp = resolveRequestedSnapshotDate(process.argv.slice(2));
  const snapshotDir = getSnapshotDirForDate(snapshotDateStamp);

  console.log("[sync] Starting snapshot sync");
  console.log(`[sync] Snapshot date: ${snapshotDateStamp}`);
  if (snapshotDateStamp !== todayDateStamp) {
    console.log(
      `[sync] Historical mode: syncing repositories as they existed on ${snapshotDateStamp} UTC`,
    );
  }

  const harnessRegistry = await loadHarnessRegistry();
  console.log(
    `[sync] Loaded ${harnessRegistry.harnesses.length} harness(es) from ${path.relative(
      process.cwd(),
      harnessRegistry.filePath,
    )}`,
  );
  if (harnessRegistry.issues.length > 0) {
    logIssueBlock(
      `Found ${harnessRegistry.issues.length} harness registry issue(s)`,
      harnessRegistry.issues,
    );
  }

  const harnessIds = harnessRegistry.harnesses.map((harness) => harness.id);
  const sourceEntries = await loadSourceFiles();
  console.log(`[sync] Loaded ${sourceEntries.length} source definition file(s)`);
  const allPartitionedSources = partitionSources({
    harnessIds,
    sourceEntries,
  });
  const filteredSourceEntries = sourceEntries.filter((entry) => {
    return sourceFilter.size > 0 ? sourceFilter.has(entry.source.id) : true;
  });
  const { invalidSources, validSources } = partitionSources({
    harnessIds,
    sourceEntries: filteredSourceEntries,
  });
  if (sourceFilter.size > 0) {
    console.log(`[sync] Source filter: ${[...sourceFilter].sort().join(", ")}`);
  }
  console.log(
    `[sync] Validation complete: ${validSources.length} valid, ${invalidSources.length} invalid`,
  );
  logInvalidSources(invalidSources);

  await ensureDir(snapshotDir);
  console.log(
    `[sync] Writing dated snapshot output to ${path.relative(process.cwd(), snapshotDir)}`,
  );
  const workerCount = Math.min(resolveSyncWorkerCount(), Math.max(1, validSources.length));
  console.log(`[sync] Worker count: ${workerCount}`);

  const syncIssues: Array<{ source_id: string; issues: string[] }> = [];
  const sourceStartDates = new Map<string, string>();
  const activeSources = new Set<string>();
  let completedSources = 0;
  const previousSourceRecords = new Map<string, SnapshotSourceRecord | null>(
    await Promise.all(
      validSources.map(async (source) => [
        source.id,
        await loadLatestSourceRecordBeforeDate(source.id, snapshotDateStamp),
      ] as const),
    ),
  );
  await Promise.all(
    validSources.map(async (source) => {
      const previous = previousSourceRecords.get(source.id);
      const cachedStartDate = resolveCachedSourceStartDate(previous);
      const startDate = cachedStartDate ?? (await resolveSourceFirstCommitDate(source));
      sourceStartDates.set(source.id, startDate);
    }),
  );
  const startDateSummary = summarizeSourceStartDates(sourceStartDates);
  const earliestStartDate = startDateSummary.earliestStartDate ?? snapshotDateStamp;
  console.log(
    `[sync] Resolved first commit dates for ${startDateSummary.sourceCount} source(s): ${startDateSummary.earliestStartDate ?? snapshotDateStamp} through ${startDateSummary.latestStartDate ?? snapshotDateStamp}`,
  );
  console.log(
    `[sync] Historical default: backfilling missing days from ${earliestStartDate} through ${snapshotDateStamp}`,
  );
  let nextIndex = 0;
  const heartbeatTimer = setInterval(() => {
    const activeList = [...activeSources].sort().slice(0, 5);
    const activeSummary = activeList.length > 0 ? ` active=${activeList.join(", ")}` : "";
    const activeExtra =
      activeSources.size > activeList.length ? ` (+${activeSources.size - activeList.length} more)` : "";
    console.log(
      `[sync] Heartbeat: completed ${completedSources}/${validSources.length}.${activeSummary}${activeExtra}`,
    );
  }, 30_000);
  const runWorkerLoop = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= validSources.length) return;

      const source = validSources[index];
      console.log(
        `[sync] [${index + 1}/${validSources.length}] Syncing ${source.id} from ${source.repo}`,
      );
      activeSources.add(source.id);

      try {
        const result = await runSourceWorker({
          endDate: snapshotDateStamp,
          startDate: sourceStartDates.get(source.id),
          source,
          snapshotDir,
        });
        console.log(
          `[sync] [${index + 1}/${validSources.length}] Updated ${result.source_id} (${result.mode}, ${result.artifact_count} artifact(s), ${result.changed_file_count} changed file(s), ${result.generated_day_count} generated day(s), ${result.skipped_day_count} reused day(s))`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        syncIssues.push({
          source_id: source.id,
          issues: [message],
        });
        await deleteSnapshotSourceFile(snapshotDir, source.id);
        console.warn(
          `[sync] [${index + 1}/${validSources.length}] Failed to sync ${source.id}: ${message}`,
        );
      } finally {
        activeSources.delete(source.id);
        completedSources += 1;
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: workerCount }, () => runWorkerLoop()));
  } finally {
    clearInterval(heartbeatTimer);
  }

  if (shouldPruneSnapshotDir(sourceFilter)) {
    await pruneSnapshotSources(
      validSources.map((source) => source.id),
      snapshotDir,
    );
    console.log("[sync] Pruned stale snapshot files from dated snapshot");
  } else {
    console.log("[sync] Skipped dated snapshot pruning because --source was used");
  }

  const snapshotSources = await loadDaySnapshotSourceRecords(snapshotDir);

  const manifest = buildSyncManifest({
    harnesses: harnessRegistry.harnesses,
    validSources,
    invalidSources,
    syncIssues,
    snapshotSources,
  });

  await writeJson(path.join(snapshotDir, "manifest.json"), manifest);
  console.log(
    `[sync] Wrote manifest with ${manifest.source_count} source(s), ${manifest.artifact_count} artifact(s), ${manifest.mismatch_count} mismatch(es)`,
  );
  console.log(
    `[sync] Synthesizing data/latest from historical data through ${snapshotDateStamp}`,
  );
  const latestSnapshotSources = await loadSnapshotSourceRecords(snapshotDir);
  const latestManifest = buildSyncManifest({
    harnesses: harnessRegistry.harnesses,
    validSources: allPartitionedSources.validSources,
    invalidSources: allPartitionedSources.invalidSources,
    syncIssues,
    snapshotSources: latestSnapshotSources,
  });
  await updateLatestSnapshot(snapshotDir, latestManifest);
  console.log(
    `[sync] Updated materialized latest snapshot at data/latest (${latestSnapshotSources.length} cumulative source(s), ${latestManifest.artifact_count} artifact(s), ${latestManifest.sync_issues.length} sync issue(s))`,
  );
  if (sourceFilter.size > 0) {
    console.log(
      `[sync] Source filter affected worker execution only; latest was synthesized from the full historical dataset`,
    );
  }

  logSyncIssues(syncIssues);

  if (
    shouldFailSyncRun({
      harnessIssues: harnessRegistry.issues,
      invalidSources,
      syncIssues,
    })
  ) {
    console.error("[sync] Sync completed with issues");
    process.exitCode = 1;
    return;
  }

  console.log(
    `[sync] Sync completed successfully in ${formatDurationMs(Date.now() - syncStartedAt)}`,
  );
}

const isDirectRun =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error("[sync] Unhandled error");
    console.error(error);
    process.exitCode = 1;
  });
}
