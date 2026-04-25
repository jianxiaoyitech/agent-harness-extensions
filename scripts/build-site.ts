import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build as astroBuild } from "astro";
import {
  getSnapshotDirForDate,
  LATEST_SNAPSHOT_DIR,
  ROOT_DIR,
  ensureDir,
  loadHarnessRegistry,
  listSnapshotDateStamps,
  readRepoReadmeSummary,
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
import packageJson from "../package.json" with { type: "json" };

const PUBLIC_DATA_DIR = path.join(ROOT_DIR, "public", "data");
const DATA_DIR = path.join(ROOT_DIR, "data");
const ZERO_GROWTH_COUNTS = {
  total: 0,
  agent: 0,
  skill: 0,
  plugin: 0,
  mcp_server: 0,
};

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

function countArtifactsByType(artifacts: Array<{ type?: string }>) {
  const counts = { ...ZERO_GROWTH_COUNTS };

  for (const artifact of artifacts) {
    counts.total += 1;
    if (artifact?.type === "agent") counts.agent += 1;
    else if (artifact?.type === "skill") counts.skill += 1;
    else if (artifact?.type === "plugin") counts.plugin += 1;
    else if (artifact?.type === "mcp-server") counts.mcp_server += 1;
  }

  return counts;
}

async function readSnapshotCounts(
  snapshotDir: string,
  sourceId: string,
  cache: Map<string, typeof ZERO_GROWTH_COUNTS>,
): Promise<typeof ZERO_GROWTH_COUNTS> {
  const cacheKey = `${snapshotDir}::${sourceId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const filePath = path.join(snapshotDir, `${sourceId}.json`);
  let raw: any;
  try {
    raw = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    const emptyCounts = { ...ZERO_GROWTH_COUNTS };
    cache.set(cacheKey, emptyCounts);
    return emptyCounts;
  }

  if (
    raw &&
    raw.version === 2 &&
    raw.mode === "unchanged" &&
    typeof raw.carry_forward_from === "string"
  ) {
    const carriedCounts = await readSnapshotCounts(
      getSnapshotDirForDate(raw.carry_forward_from),
      sourceId,
      cache,
    );
    cache.set(cacheKey, carriedCounts);
    return carriedCounts;
  }

  const counts = countArtifactsByType(Array.isArray(raw?.artifacts) ? raw.artifacts : []);
  cache.set(cacheKey, counts);
  return counts;
}

async function buildGrowthData(sourceFilter: Set<string>) {
  const dates = await listSnapshotDateStamps();
  const sortedDates = [...dates].sort((left, right) => left.localeCompare(right));
  const sourceIds = new Set<string>();
  const countCache = new Map<string, typeof ZERO_GROWTH_COUNTS>();
  const perDay = new Map<
    string,
    {
      date: string;
      total: number;
      agent: number;
      skill: number;
      plugin: number;
      mcp_server: number;
    }
  >();

  for (const date of sortedDates) {
    const snapshotDir = getSnapshotDirForDate(date);
    const sourceFiles = (await fs.readdir(snapshotDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "manifest.json")
      .map((entry) => entry.name.replace(/\.json$/, ""))
      .filter((sourceId) => (sourceFilter.size > 0 ? sourceFilter.has(sourceId) : true));

    const current = {
      date,
      total: 0,
      agent: 0,
      skill: 0,
      plugin: 0,
      mcp_server: 0,
    };

    for (const sourceId of sourceFiles) {
      sourceIds.add(sourceId);
      const counts = await readSnapshotCounts(snapshotDir, sourceId, countCache);
      current.total += counts.total;
      current.agent += counts.agent;
      current.skill += counts.skill;
      current.plugin += counts.plugin;
      current.mcp_server += counts.mcp_server;
    }

    perDay.set(date, current);
  }

  const history = [...perDay.values()].sort((left, right) => left.date.localeCompare(right.date));
  const growth = buildExtensionGrowthSeriesFromTotals(history);
  const sourceCount = sourceIds.size;
  const latestDate = sortedDates.at(-1) || null;
  const latestTimestamp = latestDate ? new Date(latestDate).getTime() : Number.NaN;
  const baselineTarget = Number.isNaN(latestTimestamp)
    ? Number.NaN
    : latestTimestamp - (30 * 24 * 60 * 60 * 1000);
  const baselineDate = Number.isNaN(baselineTarget)
    ? null
    : [...sortedDates].reverse().find((date) => {
        const timestamp = new Date(date).getTime();
        return !Number.isNaN(timestamp) && timestamp <= baselineTarget;
      }) || sortedDates[0] || null;
  let fastestGrowingSource30d:
    | {
        source_id: string;
        delta: number;
      }
    | null = null;
  const fastestGrowingSources30dByKind: Record<
    "agent" | "skill" | "plugin" | "mcp_server",
    { source_id: string; delta: number } | null
  > = {
    agent: null,
    skill: null,
    plugin: null,
    mcp_server: null,
  };

  if (latestDate && baselineDate) {
    const latestDir = getSnapshotDirForDate(latestDate);
    const baselineDir = getSnapshotDirForDate(baselineDate);

    for (const sourceId of sourceIds) {
      const latestCounts = await readSnapshotCounts(latestDir, sourceId, countCache);
      const baselineCounts = await readSnapshotCounts(baselineDir, sourceId, countCache);
      const delta = latestCounts.total - baselineCounts.total;

      if (!fastestGrowingSource30d || delta > fastestGrowingSource30d.delta) {
        fastestGrowingSource30d = {
          source_id: sourceId,
          delta,
        };
      }

      for (const kind of ["agent", "skill", "plugin", "mcp_server"] as const) {
        const kindDelta = latestCounts[kind] - baselineCounts[kind];
        const currentLeader = fastestGrowingSources30dByKind[kind];

        if (!currentLeader || kindDelta > currentLeader.delta) {
          fastestGrowingSources30dByKind[kind] = {
            source_id: sourceId,
            delta: kindDelta,
          };
        }
      }
    }
  }

  return {
    source_id: sourceFilter.size > 0 ? "filtered-sources" : "all-daily-snapshots",
    source_name: sourceFilter.size > 0 ? "Filtered Sources" : "All Tracked Sources",
    source_count: sourceCount,
    note:
      sourceCount > 0
        ? `Aggregated daily history across ${sourceCount} tracked sources with dated snapshots. Sources without dated history are not included in this chart.`
        : "No dated history is available for the current source selection.",
    fastest_growing_source_30d: fastestGrowingSource30d,
    fastest_growing_sources_30d_by_kind: fastestGrowingSources30dByKind,
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
  const sourceDescriptionEntries = await Promise.all(
    validSources.map(async (source) => [
      source.id,
      (await readRepoReadmeSummary(source)) || source.metadata?.notes || "",
    ] as const),
  );
  const sourceDescriptions = Object.fromEntries(sourceDescriptionEntries);
  const enrichedTables = Object.fromEntries(
    Object.entries(tables).map(([type, rows]) => [
      type,
      rows.map((row) => ({
        ...row,
        source_description: sourceDescriptions[row.source_id] || "",
      })),
    ]),
  ) as typeof tables;
  const report = buildDerivedReport({
    buildVersion: packageJson.version,
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
  await writeJson(path.join(targetRoot, "mcp-server.json"), enrichedTables["mcp-server"]);
  await writeJson(path.join(targetRoot, "skill.json"), enrichedTables.skill);
  await writeJson(path.join(targetRoot, "plugin.json"), enrichedTables.plugin);
  await writeJson(path.join(targetRoot, "agent.json"), enrichedTables.agent);
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
