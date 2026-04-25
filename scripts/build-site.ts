import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build as astroBuild } from "astro";
import {
  LATEST_SNAPSHOT_DIR,
  ROOT_DIR,
  ensureDir,
  loadHarnessRegistry,
  loadSnapshotSourceRecords,
  loadSourceFiles,
  readJsonFile,
} from "./lib/catalog.ts";
import {
  buildExtensionGrowthSeriesFromTotals,
  buildDerivedReport,
  buildDerivedTables,
  buildHarnessSummaries,
  buildRecentUpdates,
  buildRssFeed,
  collectDerivedArtifacts,
  selectValidSources,
} from "./derive.ts";

const PUBLIC_DATA_DIR = path.join(ROOT_DIR, "public", "data");
const DATA_DIR = path.join(ROOT_DIR, "data");

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

async function writeJson(to: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(to));
  await fs.writeFile(to, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function listFilesRecursively(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const resolved = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursively(resolved);
      }
      return [resolved];
    }),
  );

  return files.flat();
}

async function buildGrowthData(sourceFilter: Set<string>) {
  const files = await listFilesRecursively(DATA_DIR);
  const datedHistoryFiles = files
    .map((file) => ({
      file,
      relativePath: path.relative(DATA_DIR, file).split(path.sep).join("/"),
    }))
    .filter(({ relativePath }) =>
      /^\d{4}\/\d{2}\/\d{2}\/[^/]+\.json$/.test(relativePath),
    )
    .filter(({ relativePath }) => {
      if (sourceFilter.size === 0) {
        return true;
      }

      const sourceId = relativePath.split("/").at(-1)?.replace(/\.json$/, "");
      return sourceId ? sourceFilter.has(sourceId) : false;
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  const historyEntries = await Promise.all(
    datedHistoryFiles.map(async ({ file, relativePath }) => {
      const snapshot = await readJsonFile<{
        date?: string;
        source_id?: string;
        artifact_count?: number;
        artifacts?: unknown[];
      }>(file);

      return {
        date: snapshot.date || relativePath.slice(0, 10).replaceAll("/", "-"),
        source_id: snapshot.source_id || relativePath.split("/").at(-1)?.replace(/\.json$/, "") || "unknown",
        total:
          typeof snapshot.artifact_count === "number"
            ? snapshot.artifact_count
            : Array.isArray(snapshot.artifacts)
              ? snapshot.artifacts.length
              : 0,
      };
    }),
  );

  const sourceIds = new Set(historyEntries.map((entry) => entry.source_id));
  const perDay = new Map<string, { date: string; total: number }>();

  for (const entry of historyEntries) {
    const current = perDay.get(entry.date) || {
      date: entry.date,
      total: 0,
    };
    current.total += entry.total;
    perDay.set(entry.date, current);
  }

  const history = [...perDay.values()].sort((left, right) => left.date.localeCompare(right.date));
  const growth = buildExtensionGrowthSeriesFromTotals(history);
  const sourceCount = sourceIds.size;

  return {
    source_id: sourceFilter.size > 0 ? "filtered-sources" : "all-daily-snapshots",
    source_name: sourceFilter.size > 0 ? "Filtered Sources" : "All Tracked Sources",
    source_count: sourceCount,
    note:
      sourceCount > 0
        ? `Aggregated daily history across ${sourceCount} tracked sources with dated snapshots. Sources without dated history are not included in this chart.`
        : "No dated history is available for the current source selection.",
    ...growth,
  };
}

async function buildSiteData(targetRoot: string): Promise<void> {
  const sourceFilter = new Set(parseMultiValueFlag(process.argv.slice(2), "--source"));
  const snapshotDir = LATEST_SNAPSHOT_DIR;
  const harnessRegistry = await loadHarnessRegistry();
  const allHarnessIds = harnessRegistry.harnesses.map((harness) => harness.id);
  const sourceEntries = await loadSourceFiles();
  const manifest = await readJsonFile<{
    generated_at: string;
    invalid_sources: Array<{ file: string; source_id: string | null; issues: string[] }>;
    sync_issues: Array<{ source_id: string; issues: string[] }>;
  }>(path.join(snapshotDir, "manifest.json"));
  const filteredInvalidSources =
    sourceFilter.size > 0
      ? manifest.invalid_sources.filter(
          (entry) => entry.source_id !== null && sourceFilter.has(entry.source_id),
        )
      : manifest.invalid_sources;
  const filteredSyncIssues =
    sourceFilter.size > 0
      ? manifest.sync_issues.filter((entry) => sourceFilter.has(entry.source_id))
      : manifest.sync_issues;
  const snapshotSources = (await loadSnapshotSourceRecords(snapshotDir)).filter((source) =>
    sourceFilter.size > 0 ? sourceFilter.has(source.source_id) : true,
  );
  const validSources = selectValidSources({
    sourceEntries:
      sourceFilter.size > 0
        ? sourceEntries.filter((entry) => sourceFilter.has(entry.source.id))
        : sourceEntries,
    harnessIds: allHarnessIds,
  });
  const artifacts = collectDerivedArtifacts(snapshotSources);
  const tables = buildDerivedTables({
    artifacts,
    harnesses: harnessRegistry.harnesses,
  });
  const report = buildDerivedReport({
    harnesses: harnessRegistry.harnesses,
    validSources,
    invalidSources: filteredInvalidSources,
    syncIssues: filteredSyncIssues,
    snapshotSources,
  });
  const growth = await buildGrowthData(sourceFilter);

  await writeJson(path.join(targetRoot, "harnesses.json"), {
    generated_at: manifest.generated_at,
    harnesses: harnessRegistry.harnesses,
  });
  await writeJson(path.join(targetRoot, "artifacts.json"), artifacts);
  await writeJson(path.join(targetRoot, "report.json"), report);
  await writeJson(path.join(targetRoot, "growth.json"), growth);
  await writeJson(path.join(targetRoot, "summary.json"), {
    generated_at: manifest.generated_at,
    harnesses: buildHarnessSummaries({
      artifacts,
      harnesses: harnessRegistry.harnesses,
    }),
    recent_updates: buildRecentUpdates(artifacts),
  });
  await writeJson(path.join(targetRoot, "mcp-server.json"), tables["mcp-server"]);
  await writeJson(path.join(targetRoot, "skill.json"), tables.skill);
  await writeJson(path.join(targetRoot, "plugin.json"), tables.plugin);
  await writeJson(path.join(targetRoot, "agent.json"), tables.agent);
  await fs.writeFile(
    path.join(path.dirname(targetRoot), "rss.xml"),
    buildRssFeed({
      artifacts,
      harnesses: harnessRegistry.harnesses,
      generatedAt: manifest.generated_at,
    }),
    "utf8",
  );
}

async function main(): Promise<void> {
  await buildSiteData(PUBLIC_DATA_DIR);

  await astroBuild({
    logLevel: "error",
  });
}

const isDirectRun =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
