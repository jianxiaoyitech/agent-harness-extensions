import {
  type ArtifactRecord,
  type Harness,
  type SnapshotSourceRecord,
  type SourceDefinition,
  buildTableRows,
  summarizeReport,
  validateSource,
} from "./lib/catalog.ts";

const SITE_URL = "https://jianxiaoyitech.github.io/agent-harness-extensions";

export function selectValidSources({
  sourceEntries,
  harnessIds,
}: {
  sourceEntries: Array<{ source: SourceDefinition }>;
  harnessIds: string[];
}): SourceDefinition[] {
  return sourceEntries
    .filter((entry) => validateSource(entry.source, harnessIds).length === 0)
    .map((entry) => entry.source);
}

export function collectDerivedArtifacts(
  snapshotSources: SnapshotSourceRecord[],
): ArtifactRecord[] {
  return snapshotSources
    .flatMap((source) => source.artifacts || [])
    .filter(
      (artifact): artifact is ArtifactRecord =>
        Boolean(artifact) &&
        typeof artifact === "object" &&
        "id" in artifact &&
        "name" in artifact &&
        "type" in artifact,
    )
    .sort((left, right) => {
      const updatedCompare = String(right.repo_metrics?.updated_at || "").localeCompare(
        String(left.repo_metrics?.updated_at || ""),
      );
      if (updatedCompare !== 0) return updatedCompare;
      return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
    });
}

export function buildDerivedTables({
  artifacts,
  harnesses,
}: {
  artifacts: ArtifactRecord[];
  harnesses: Harness[];
}): Record<"mcp-server" | "skill" | "plugin" | "agent", ReturnType<typeof buildTableRows>> {
  return {
    "mcp-server": buildTableRows(artifacts, harnesses, "mcp-server"),
    skill: buildTableRows(artifacts, harnesses, "skill"),
    plugin: buildTableRows(artifacts, harnesses, "plugin"),
    agent: buildTableRows(artifacts, harnesses, "agent"),
  };
}

export function buildHarnessSummaries({
  artifacts,
  harnesses,
}: {
  artifacts: ArtifactRecord[];
  harnesses: Harness[];
}): Array<{
  id: string;
  name: string;
  total_supported: number;
  reusable_supported: number;
  by_type: Record<"mcp-server" | "skill" | "plugin" | "agent", number>;
}> {
  return harnesses.map((harness) => {
    const supportedArtifacts = artifacts.filter(
      (artifact) => (artifact.compatibility?.[harness.id] || "blank") === "check",
    );
    const byType = {
      "mcp-server": supportedArtifacts.filter((artifact) => artifact.type === "mcp-server").length,
      skill: supportedArtifacts.filter((artifact) => artifact.type === "skill").length,
      plugin: supportedArtifacts.filter((artifact) => artifact.type === "plugin").length,
      agent: supportedArtifacts.filter((artifact) => artifact.type === "agent").length,
    };

    return {
      id: harness.id,
      name: harness.name,
      total_supported: supportedArtifacts.length,
      reusable_supported: supportedArtifacts.filter(
        (artifact) => supportedHarnessCountForArtifact(artifact) >= 2,
      ).length,
      by_type: byType,
    };
  });
}

export function buildRecentUpdates(artifacts: ArtifactRecord[]): Array<{
  id: string;
  name: string;
  type: ArtifactRecord["type"];
  type_label: string;
  repo: string;
  repo_path_url: string;
  source_name: string;
  updated_at: string;
}> {
  return artifacts.slice(0, 12).map((artifact) => ({
    id: artifact.id,
    name: artifact.name,
    type: artifact.type,
    type_label: artifact.type_label,
    repo: artifact.repo,
    repo_path_url: artifact.repo_path_url,
    source_name: artifact.source_name,
    updated_at: artifact.repo_metrics.updated_at,
  }));
}

export interface GrowthHistoryPoint {
  date: string;
  added: number;
  removed: number;
}

export interface GrowthTotalPoint {
  date: string;
  total: number;
}

export interface ExtensionGrowthPoint extends GrowthHistoryPoint {
  net: number;
  total: number;
  rolling_avg_net_7d: number;
}

export function buildExtensionGrowthSeriesFromTotals(history: GrowthTotalPoint[]): {
  series: ExtensionGrowthPoint[];
  summary: {
    start_date: string | null;
    end_date: string | null;
    start_total: number;
    end_total: number;
    peak_total: number;
    total_net_growth: number;
    max_daily_net: number;
    max_daily_net_date: string | null;
  };
} {
  const sortedHistory = [...history].sort((left, right) => left.date.localeCompare(right.date));
  const recentNetValues: number[] = [];
  let previousTotal = 0;
  let peakTotal = 0;
  let maxDailyNet = Number.NEGATIVE_INFINITY;
  let maxDailyNetDate: string | null = null;

  const series = sortedHistory.map((point, index) => {
    const total = Math.max(0, point.total || 0);
    const net = index === 0 ? total : total - previousTotal;
    const added = Math.max(0, net);
    const removed = Math.max(0, -net);

    peakTotal = Math.max(peakTotal, total);
    previousTotal = total;

    recentNetValues.push(net);
    if (recentNetValues.length > 7) {
      recentNetValues.shift();
    }

    const rollingAverage =
      recentNetValues.reduce((sum, value) => sum + value, 0) / recentNetValues.length;

    if (net > maxDailyNet) {
      maxDailyNet = net;
      maxDailyNetDate = point.date;
    }

    return {
      date: point.date,
      added,
      removed,
      net,
      total,
      rolling_avg_net_7d: Number(rollingAverage.toFixed(2)),
    };
  });

  return {
    series,
    summary: {
      start_date: series[0]?.date || null,
      end_date: series.at(-1)?.date || null,
      start_total: series[0]?.total || 0,
      end_total: series.at(-1)?.total || 0,
      peak_total: peakTotal,
      total_net_growth: (series.at(-1)?.total || 0) - (series[0]?.total || 0),
      max_daily_net: Number.isFinite(maxDailyNet) ? maxDailyNet : 0,
      max_daily_net_date: maxDailyNetDate,
    },
  };
}

export function buildExtensionGrowthSeries(history: GrowthHistoryPoint[]): {
  series: ExtensionGrowthPoint[];
  summary: {
    start_date: string | null;
    end_date: string | null;
    start_total: number;
    end_total: number;
    peak_total: number;
    total_net_growth: number;
    max_daily_net: number;
    max_daily_net_date: string | null;
  };
} {
  const sortedHistory = [...history].sort((left, right) => left.date.localeCompare(right.date));
  const recentNetValues: number[] = [];
  let total = 0;
  let peakTotal = 0;
  let maxDailyNet = Number.NEGATIVE_INFINITY;
  let maxDailyNetDate: string | null = null;

  const series = sortedHistory.map((point) => {
    const added = Math.max(0, point.added || 0);
    const removed = Math.max(0, point.removed || 0);
    const net = added - removed;
    total = Math.max(0, total + net);
    peakTotal = Math.max(peakTotal, total);

    recentNetValues.push(net);
    if (recentNetValues.length > 7) {
      recentNetValues.shift();
    }

    const rollingAverage =
      recentNetValues.reduce((sum, value) => sum + value, 0) / recentNetValues.length;

    if (net > maxDailyNet) {
      maxDailyNet = net;
      maxDailyNetDate = point.date;
    }

    return {
      date: point.date,
      added,
      removed,
      net,
      total,
      rolling_avg_net_7d: Number(rollingAverage.toFixed(2)),
    };
  });

  return {
    series,
    summary: {
      start_date: series[0]?.date || null,
      end_date: series.at(-1)?.date || null,
      start_total: series[0]?.total || 0,
      end_total: series.at(-1)?.total || 0,
      peak_total: peakTotal,
      total_net_growth: (series.at(-1)?.total || 0) - (series[0]?.total || 0),
      max_daily_net: Number.isFinite(maxDailyNet) ? maxDailyNet : 0,
      max_daily_net_date: maxDailyNetDate,
    },
  };
}

function supportedHarnessCountForArtifact(artifact: ArtifactRecord): number {
  return Object.values(artifact.compatibility || {}).filter((value) => value === "check").length;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function supportedHarnessNamesForArtifact(artifact: ArtifactRecord, harnesses: Harness[]): string[] {
  return harnesses
    .filter((harness) => (artifact.compatibility?.[harness.id] || "blank") === "check")
    .map((harness) => harness.name);
}

export function buildRssFeed({
  artifacts,
  harnesses,
  generatedAt,
  siteUrl = SITE_URL,
}: {
  artifacts: ArtifactRecord[];
  harnesses: Harness[];
  generatedAt: string;
  siteUrl?: string;
}): string {
  const items = artifacts.slice(0, 50).map((artifact) => {
    const supportedHarnesses = supportedHarnessNamesForArtifact(artifact, harnesses);
    const supportText =
      supportedHarnesses.length > 0
        ? `Supports ${supportedHarnesses.join(", ")}.`
        : "No explicit harness support listed yet.";

    return `<item>
  <title>${xmlEscape(`${artifact.name} (${artifact.type_label})`)}</title>
  <link>${xmlEscape(artifact.repo_path_url)}</link>
  <guid>${xmlEscape(artifact.id)}</guid>
  <pubDate>${new Date(artifact.repo_metrics.updated_at || generatedAt).toUTCString()}</pubDate>
  <description>${xmlEscape(
    `${artifact.source_name}. ${supportText} Source path: ${artifact.path}`,
  )}</description>
</item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Agent Harness Extensions</title>
  <link>${xmlEscape(siteUrl)}</link>
  <description>${xmlEscape(
    "Latest extensions from Agent Harness Extensions.",
  )}</description>
  <lastBuildDate>${new Date(generatedAt).toUTCString()}</lastBuildDate>
  ${items.join("\n  ")}
</channel>
</rss>
`;
}

export function buildDerivedReport(args: {
  harnesses: Harness[];
  validSources: SourceDefinition[];
  invalidSources: Array<{ file: string; source_id: string | null; issues: string[] }>;
  syncIssues: Array<{ source_id: string; issues: string[] }>;
  snapshotSources: SnapshotSourceRecord[];
}) {
  const artifacts = collectDerivedArtifacts(args.snapshotSources);

  return summarizeReport({
    harnesses: args.harnesses,
    sources: args.validSources,
    invalidSources: args.invalidSources,
    syncIssues: args.syncIssues,
    artifacts,
  });
}
