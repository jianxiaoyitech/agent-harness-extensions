import { pathToFileURL } from "node:url";
import {
  buildSnapshotSourceRecord,
  ensureDir,
  getSnapshotDirForDate,
  listDateStampsInRange,
  loadLatestSourceRecordBeforeDate,
  loadHarnessRegistry,
  loadSourceFiles,
  loadSnapshotSourceRecordFromDir,
  resolveSourceFirstCommitDate,
  type SourceDefinition,
  writeSnapshotSourceRecord,
} from "./lib/catalog.ts";

interface WorkerArgs {
  endDate?: string;
  previousSnapshotDir?: string;
  snapshotDate?: string;
  snapshotDir?: string;
  sourceId: string;
  startDate?: string;
}

function parseOptionalPositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function addUtcDays(dateStamp: string, deltaDays: number): string {
  const base = new Date(`${dateStamp}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return dateStamp;
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

function readArgValue(argv: string[], flag: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === flag) {
      return argv[index + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }

  return undefined;
}

function parseWorkerArgs(argv: string[]): WorkerArgs {
  const sourceId = readArgValue(argv, "--source-id");
  const snapshotDir = readArgValue(argv, "--snapshot-dir");
  const previousSnapshotDir = readArgValue(argv, "--previous-snapshot-dir");
  const snapshotDate = readArgValue(argv, "--snapshot-date");
  const startDate = readArgValue(argv, "--start-date");
  const endDate = readArgValue(argv, "--end-date");

  if (!sourceId) {
    throw new Error("Missing --source-id for sync worker.");
  }
  if (!snapshotDate && !endDate) {
    if (!snapshotDir) {
      throw new Error("Missing --snapshot-dir for sync worker.");
    }
    if (!previousSnapshotDir) {
      throw new Error("Missing --previous-snapshot-dir for sync worker.");
    }
  }

  return {
    endDate,
    previousSnapshotDir,
    snapshotDate,
    snapshotDir,
    sourceId,
    startDate,
  };
}

async function loadSourceById(sourceId: string): Promise<SourceDefinition> {
  const sourceEntries = await loadSourceFiles();
  const entry = sourceEntries.find((candidate) => candidate.source.id === sourceId);
  if (!entry) {
    throw new Error(`Source definition not found for ${sourceId}.`);
  }

  return entry.source;
}

async function main(): Promise<void> {
  const args = parseWorkerArgs(process.argv.slice(2));
  const harnessRegistry = await loadHarnessRegistry();
  const source = await loadSourceById(args.sourceId);

  if (args.endDate) {
    const firstDate = args.startDate ?? (await resolveSourceFirstCommitDate(source));
    const maxDays = parseOptionalPositiveInt(process.env.SYNC_MAX_DAYS);
    const lastSynced = await loadLatestSourceRecordBeforeDate(source.id, args.endDate);
    const baselineStartDate = lastSynced?.snapshot_date
      ? addUtcDays(lastSynced.snapshot_date, 1)
      : firstDate;
    const effectiveStartDate =
      maxDays && maxDays >= 1 && lastSynced?.snapshot_date
        ? addUtcDays(args.endDate, -(maxDays - 1))
        : baselineStartDate;
    const startDate = effectiveStartDate > baselineStartDate ? effectiveStartDate : baselineStartDate;
    const dates = listDateStampsInRange(startDate, args.endDate);
    let previous = await loadLatestSourceRecordBeforeDate(source.id, startDate);
    let generatedCount = 0;
    let skippedCount = 0;
    let latestSnapshotSource = previous;

    for (const date of dates) {
      const snapshotDir = getSnapshotDirForDate(date);
      const existing = await loadSnapshotSourceRecordFromDir(snapshotDir, source.id);
      if (existing && date !== args.endDate) {
        previous = existing;
        latestSnapshotSource = existing;
        skippedCount += 1;
        continue;
      }

      await ensureDir(snapshotDir);
      const snapshotSource = await buildSnapshotSourceRecord(source, harnessRegistry.harnesses, {
        firstCommitDate: firstDate,
        previousSnapshotSource: previous,
        snapshotDate: date,
      });
      await writeSnapshotSourceRecord(snapshotDir, snapshotSource);
      previous = snapshotSource;
      latestSnapshotSource = snapshotSource;
      generatedCount += 1;
    }

    if (!latestSnapshotSource) {
      throw new Error(`No snapshot generated or loaded for ${source.id}.`);
    }

    process.stdout.write(
      `${JSON.stringify({
        artifact_count: latestSnapshotSource.artifacts.length,
        changed_file_count: latestSnapshotSource.changed_files.length,
        generated_day_count: generatedCount,
        mode: latestSnapshotSource.mode,
        skipped_day_count: skippedCount,
        source_id: latestSnapshotSource.source_id,
      })}\n`,
    );
    return;
  }

  const previous = await loadSnapshotSourceRecordFromDir(args.previousSnapshotDir!, source.id);
  const snapshotSource = await buildSnapshotSourceRecord(source, harnessRegistry.harnesses, {
    previousSnapshotSource: previous,
    snapshotDate: args.snapshotDate,
  });

  await writeSnapshotSourceRecord(args.snapshotDir!, snapshotSource);
  process.stdout.write(
    `${JSON.stringify({
      artifact_count: snapshotSource.artifacts.length,
      changed_file_count: snapshotSource.changed_files.length,
      generated_day_count: 1,
      mode: snapshotSource.mode,
      skipped_day_count: 0,
      source_id: snapshotSource.source_id,
    })}\n`,
  );
}

const isDirectRun =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
