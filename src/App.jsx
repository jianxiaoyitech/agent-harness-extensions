import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FEATURED_HARNESS_IDS,
  TYPE_LABELS,
  TYPE_ORDER,
} from "@/features/directory/constants";
import { DirectoryFilters } from "@/features/directory/components/DirectoryFilters";
import { DirectoryTable } from "@/features/directory/components/DirectoryTable";
import { GrowthChart } from "@/features/directory/components/GrowthChart";
import { useDirectoryData } from "@/features/directory/use-directory-data";
import {
  buildFilteredTypeCounts,
  buildQuerySummary,
  compareValues,
  formatNumber,
  repoLabel,
  supportedHarnessCount,
} from "@/features/directory/utils";

const PAGE_SIZE = 100;
const BASE_URL = import.meta.env.BASE_URL || "/";
const NORMALIZED_BASE_URL = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
const MAX_SEARCH_SUGGESTIONS = 8;

function withBase(path) {
  return `${NORMALIZED_BASE_URL}${path.replace(/^\//, "")}`;
}

function formatRefreshTimestamp(value) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function buildSuggestionScore(row, normalizedQuery) {
  const name = String(row.name || "").toLowerCase();
  const description = String(row.description || "").toLowerCase();
  const sourceDescription = String(row.source_description || "").toLowerCase();
  const sourceName = String(row.source_name || "").toLowerCase();
  const sourceId = String(row.source_id || "").toLowerCase();
  const path = String(row.path || "").toLowerCase();
  const repo = String(repoLabel(row.repo) || "").toLowerCase();

  if (name.startsWith(normalizedQuery)) return 0;
  if (name.includes(normalizedQuery)) return 1;
  if (sourceName.startsWith(normalizedQuery) || sourceId.startsWith(normalizedQuery)) return 2;
  if (sourceName.includes(normalizedQuery) || sourceId.includes(normalizedQuery)) return 3;
  if (repo.startsWith(normalizedQuery)) return 4;
  if (repo.includes(normalizedQuery)) return 5;
  if (sourceDescription.includes(normalizedQuery)) return 6;
  if (description.includes(normalizedQuery)) return 7;
  if (path.includes(normalizedQuery)) return 8;
  return 99;
}

function groupRowsBySource(filteredRows, allRows, query) {
  const totalBySource = new Map();
  for (const row of allRows) {
    totalBySource.set(row.source_id, (totalBySource.get(row.source_id) || 0) + 1);
  }

  const groups = new Map();
  for (const row of filteredRows) {
    const existing = groups.get(row.source_id);
    if (existing) {
      existing.rows.push(row);
      if (!existing.description && row.source_description) {
        existing.description = row.source_description;
      }
      continue;
    }

    groups.set(row.source_id, {
      id: row.source_id,
      source_id: row.source_id,
      source_name: row.source_name,
      name: row.source_name,
      repo: row.repo,
      stars: row.stars,
      updated_at: row.updated_at,
      archived: row.archived,
      compatibility: row.compatibility,
      primaryRow: row,
      rows: [row],
      description: row.source_description || "",
      totalCount: totalBySource.get(row.source_id) || 1,
      matchCount: 1,
      hasQuery: Boolean(query),
    });
  }

  return [...groups.values()].map((group) => ({
    ...group,
    matchCount: group.rows.length,
  }));
}

function daysSince(value) {
  if (!value) return Number.POSITIVE_INFINITY;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;

  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

export default function App({ initialData = null }) {
  const [activeView, setActiveView] = useState("directory");
  const [activeType, setActiveType] = useState("agent");
  const [search, setSearch] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [sortKey, setSortKey] = useState("stars");
  const [sortDirection, setSortDirection] = useState("desc");
  const [compatibilityFilters, setCompatibilityFilters] = useState({});
  const [crossHarnessOnly, setCrossHarnessOnly] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [pendingFocusRowId, setPendingFocusRowId] = useState(null);
  const [page, setPage] = useState(1);
  const { growth, harnesses, report, tables } = useDirectoryData(initialData);
  const searchBlurTimeoutRef = useRef(null);
  const preserveExpandedRowRef = useRef(false);
  const searchInputRef = useRef(null);

  const rows = tables[activeType] || [];
  const allRows = useMemo(
    () => TYPE_ORDER.flatMap((type) => tables[type] || []),
    [tables],
  );
  const deferredSearch = useDeferredValue(search);
  const query = deferredSearch.trim().toLowerCase();
  const activeCompatibilityFilters = useMemo(
    () =>
      Object.entries(compatibilityFilters).filter(
        ([, value]) => value && value !== "any",
      ),
    [compatibilityFilters],
  );
  const featuredHarnesses = useMemo(
    () => harnesses.filter((harness) => FEATURED_HARNESS_IDS.includes(harness.id)),
    [harnesses],
  );
  const visibleHarnesses = [];

  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) => {
          if (query) {
            const haystack = [
              row.name,
              row.description,
              row.source_description,
              row.source_name,
              row.source_id,
              row.path,
              row.repo,
              repoLabel(row.repo),
            ]
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(query)) return false;
          }

          if (crossHarnessOnly && supportedHarnessCount(row) < 2) {
            return false;
          }

          for (const [harnessId, filterValue] of Object.entries(compatibilityFilters)) {
            if (filterValue === "any") continue;
            if ((row.compatibility?.[harnessId] || "blank") !== filterValue) {
              return false;
            }
          }

          return true;
        })
        .sort((left, right) => {
          const column = sortKey === "supported_harnesses"
            ? { numeric: true }
            : undefined;
          const leftValue =
            sortKey === "supported_harnesses" ? supportedHarnessCount(left) : left[sortKey];
          const rightValue =
            sortKey === "supported_harnesses" ? supportedHarnessCount(right) : right[sortKey];
          const comparison = compareValues(leftValue, rightValue, column?.numeric);

          if (comparison !== 0) {
            return sortDirection === "asc" ? comparison : -comparison;
          }

          return left.name.localeCompare(right.name);
        }),
    [compatibilityFilters, crossHarnessOnly, query, rows, sortDirection, sortKey],
  );
  const groupedRows = useMemo(() => {
    const grouped = groupRowsBySource(filteredRows, rows, query);

    return grouped.sort((left, right) => {
      const leftValue =
        sortKey === "name"
          ? left.source_name
          : sortKey === "repo"
            ? repoLabel(left.repo)
            : left[sortKey];
      const rightValue =
        sortKey === "name"
          ? right.source_name
          : sortKey === "repo"
            ? repoLabel(right.repo)
            : right[sortKey];
      const comparison = compareValues(leftValue, rightValue, sortKey === "stars");

      if (comparison !== 0) {
        return sortDirection === "asc" ? comparison : -comparison;
      }

      return left.source_name.localeCompare(right.source_name);
    });
  }, [filteredRows, query, rows, sortDirection, sortKey]);
  const overviewGroups = useMemo(
    () => groupRowsBySource(allRows, allRows, ""),
    [allRows],
  );
  const overviewStats = useMemo(() => {
    const recentlyUpdatedRepos = overviewGroups.filter(
      (group) => daysSince(group.updated_at) <= 30,
    );
    const archivedRepos = overviewGroups.filter((group) => Boolean(group.archived));
    const fastestGrowingByKind = growth?.fastest_growing_sources_30d_by_kind || {};

    function fastestRepoStat(kind, label) {
      const fastestSource = fastestGrowingByKind?.[kind] || null;
      const fastestGroup = fastestSource
        ? overviewGroups.find((group) => group.source_id === fastestSource.source_id) || null
        : null;

      return {
        label,
        value: fastestGroup ? fastestGroup.source_name : "No data",
        detail: fastestSource && fastestGroup
          ? `+${formatNumber(Math.max(0, fastestSource.delta))} in the last 30 days`
          : "Growth history not available",
      };
    }

    return [
      {
        label: "Recently Updated",
        value: `${formatNumber(recentlyUpdatedRepos.length)} / ${formatNumber(overviewGroups.length)}`,
        detail: "Repos updated in the last 30 days",
      },
      fastestRepoStat("agent", "Fastest Growing Agent Repo"),
      fastestRepoStat("skill", "Fastest Growing Skill Repo"),
      fastestRepoStat("plugin", "Fastest Growing Plugin Repo"),
      fastestRepoStat("mcp_server", "Fastest Growing MCP Repo"),
      {
        label: "Archived Repos",
        value: `${formatNumber(archivedRepos.length)} / ${formatNumber(overviewGroups.length)}`,
        detail: "Still listed, but upstream is read-only",
      },
    ];
  }, [growth, overviewGroups]);

  useEffect(() => {
    if (preserveExpandedRowRef.current) {
      preserveExpandedRowRef.current = false;
      return;
    }

    setPage(1);
    setExpandedRowId(null);
  }, [activeType, query, sortDirection, sortKey, crossHarnessOnly, compatibilityFilters]);

  const emptyMessage =
    rows.length === 0 && report?.fetch_issues?.length
      ? "No rows yet. Sync has not produced table data for this view."
      : "No artifacts match the current workflow filters.";
  const querySummary = useMemo(
    () =>
      buildQuerySummary({
        activeType,
        filteredRows,
        activeCompatibilityFilters,
        harnesses,
        crossHarnessOnly,
      }),
    [activeCompatibilityFilters, activeType, crossHarnessOnly, filteredRows, harnesses],
  );
  const filteredTypeCounts = useMemo(
    () =>
      activeCompatibilityFilters.length > 0 || crossHarnessOnly
        ? buildFilteredTypeCounts(tables, compatibilityFilters, crossHarnessOnly)
        : [],
    [activeCompatibilityFilters.length, compatibilityFilters, crossHarnessOnly, tables],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const groupedTotalPages = Math.max(1, Math.ceil(groupedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const currentGroupedPage = Math.min(page, groupedTotalPages);
  const pageStart = (currentGroupedPage - 1) * PAGE_SIZE;
  const visibleRows = useMemo(
    () => groupedRows.slice(pageStart, pageStart + PAGE_SIZE),
    [groupedRows, pageStart],
  );

  useEffect(() => {
    if (!expandedRowId) return;

    const rowIndex = groupedRows.findIndex((row) => row.id === expandedRowId);
    if (rowIndex === -1) return;

    const targetPage = Math.floor(rowIndex / PAGE_SIZE) + 1;
    if (page !== targetPage) {
      setPage(targetPage);
    }
  }, [expandedRowId, groupedRows, page]);

  useEffect(() => {
    if (!pendingFocusRowId) return;
    if (!visibleRows.some((row) => row.id === pendingFocusRowId)) return;

    const frameId = window.requestAnimationFrame(() => {
      const element = document.querySelector(`[data-source-row-id="${pendingFocusRowId}"]`);
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      setPendingFocusRowId(null);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [pendingFocusRowId, visibleRows]);
  const pluginCount = tables.plugin?.length ?? 0;
  const skillCount = tables.skill?.length ?? 0;
  const mcpServerCount = tables["mcp-server"]?.length ?? 0;
  const agentCount = tables.agent?.length ?? 0;
  const refreshedAt = formatRefreshTimestamp(report?.generated_at);
  const expandedRow = useMemo(
    () => groupedRows.find((row) => row.id === expandedRowId) || null,
    [expandedRowId, groupedRows],
  );
  const searchSuggestions = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    if (normalizedQuery.length < 2) {
      return [];
    }

    return TYPE_ORDER.flatMap((type) =>
      (tables[type] || []).map((row) => ({
        ...row,
        artifactType: type,
        score: buildSuggestionScore(row, normalizedQuery),
      }))
    )
      .filter((row) => row.score < 99)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }

        const leftName = String(left.name || "");
        const rightName = String(right.name || "");
        const nameCompare = leftName.localeCompare(rightName, "en", { sensitivity: "base" });
        if (nameCompare !== 0) {
          return nameCompare;
        }

        return String(left.source_name || "").localeCompare(String(right.source_name || ""), "en", {
          sensitivity: "base",
        });
      })
      .slice(0, MAX_SEARCH_SUGGESTIONS);
  }, [search, tables]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [searchSuggestions]);

  function clearSearchBlurTimeout() {
    if (searchBlurTimeoutRef.current) {
      window.clearTimeout(searchBlurTimeoutRef.current);
      searchBlurTimeoutRef.current = null;
    }
  }

  function selectSuggestion(suggestion) {
    clearSearchBlurTimeout();
    preserveExpandedRowRef.current = true;
    setActiveType(suggestion.artifactType);
    setSearch(suggestion.name);
    setCompatibilityFilters({});
    setCrossHarnessOnly(false);
    setExpandedRowId(suggestion.source_id);
    setPendingFocusRowId(suggestion.source_id);
    setPage(1);
    setShowSearchSuggestions(false);

    window.requestAnimationFrame(() => {
      if (searchInputRef.current instanceof HTMLInputElement) {
        searchInputRef.current.focus();
      }
    });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[110rem] flex-col px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <section>
          <div className="space-y-2.5">
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Agent Harness Extensions
            </div>
            <div className="max-w-4xl text-2xl leading-tight font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
              Browse extensions by agent harness.
            </div>
            <div className="flex flex-col gap-2.5 pt-0.5 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-[1.4] max-w-3xl">
                <label className="sr-only" htmlFor="directory-search">
                  Search extensions
                </label>
                <div
                  className="relative z-50"
                  onBlur={() => {
                    clearSearchBlurTimeout();
                    searchBlurTimeoutRef.current = window.setTimeout(() => {
                      setShowSearchSuggestions(false);
                    }, 120);
                  }}
                >
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    id="directory-search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setShowSearchSuggestions(true);
                    }}
                    onFocus={() => {
                      clearSearchBlurTimeout();
                      setShowSearchSuggestions(true);
                    }}
                    onKeyDown={(event) => {
                      if (searchSuggestions.length === 0) {
                        return;
                      }

                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setShowSearchSuggestions(true);
                        setActiveSuggestionIndex((current) =>
                          Math.min(current + 1, searchSuggestions.length - 1)
                        );
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActiveSuggestionIndex((current) => Math.max(current - 1, 0));
                      } else if (event.key === "Enter") {
                        const suggestion = searchSuggestions[activeSuggestionIndex];
                        if (suggestion) {
                          event.preventDefault();
                          selectSuggestion(suggestion);
                        }
                      } else if (event.key === "Escape") {
                        setShowSearchSuggestions(false);
                      }
                    }}
                    placeholder={`Search ${agentCount.toLocaleString()} agents, ${skillCount.toLocaleString()} skills, ${pluginCount.toLocaleString()} plugins, ${mcpServerCount.toLocaleString()} MCP servers, repos, or paths`}
                    className="h-11 rounded-md border-border/90 bg-background/90 pl-10 pr-3 text-left shadow-none focus-visible:border-foreground focus-visible:ring-0"
                    autoComplete="off"
                  />
                  {showSearchSuggestions && searchSuggestions.length > 0 ? (
                    <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[70] overflow-hidden rounded-xl border border-border/80 bg-background shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
                      <div className="border-b border-border/70 px-3 py-2 text-[0.72rem] font-medium text-muted-foreground">
                        Matching extensions
                      </div>
                      <div className="max-h-[24rem] overflow-y-auto py-1">
                        {searchSuggestions.map((suggestion, index) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition ${
                              index === activeSuggestionIndex ? "bg-muted/75" : "hover:bg-muted/50"
                            }`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectSuggestion(suggestion);
                            }}
                            onMouseEnter={() => setActiveSuggestionIndex(index)}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-foreground">{suggestion.name}</span>
                                <span className="inline-flex rounded-full border border-border/80 px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                                  {TYPE_LABELS[suggestion.artifactType].replace(/s$/, "")}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {suggestion.source_name} · {repoLabel(suggestion.repo)}
                              </div>
                              <div className="mt-1 truncate text-[0.72rem] text-muted-foreground/85">
                                {suggestion.path}
                              </div>
                            </div>
                            <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
                <a
                  href="https://github.com/JianxiaoyiTech/agent-harness-extensions/tree/main/skills/add-data-and-test"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-border/80 bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Add your extension
                </a>
                <a
                  href={withBase("/rss.xml")}
                  className="inline-flex items-center rounded-full border border-border/80 px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Subscribe via RSS
                </a>
              </div>
            </div>
          </div>
        </section>

        <Tabs
          value={activeView}
          onValueChange={setActiveView}
          className="pt-3"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <TabsList
              variant="line"
              className="h-auto gap-5 rounded-none bg-transparent p-0 pb-0 shadow-none"
            >
              <TabsTrigger
                value="directory"
                className="rounded-none border-0 border-b border-transparent px-0 py-3 text-base font-medium text-muted-foreground shadow-none transition hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Directory
              </TabsTrigger>
              <TabsTrigger
                value="growth"
                className="rounded-none border-0 border-b border-transparent px-0 py-3 text-base font-medium text-muted-foreground shadow-none transition hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Stats & Growth
              </TabsTrigger>
            </TabsList>
            {refreshedAt ? (
              <div className="pb-3 text-sm text-muted-foreground">
                Updated {refreshedAt}
              </div>
            ) : null}
          </div>

          <TabsContent value="directory" className="mt-0">
            <DirectoryFilters
              activeType={activeType}
              compatibilityFilters={compatibilityFilters}
              crossHarnessOnly={crossHarnessOnly}
              expandedRow={expandedRow}
              page={currentGroupedPage}
              pageSize={PAGE_SIZE}
              totalPages={groupedTotalPages}
              totalRows={groupedRows.length}
              featuredHarnesses={harnesses}
              filteredTypeCounts={filteredTypeCounts}
              querySummary={querySummary}
              rows={rows}
              setActiveType={setActiveType}
              setCompatibilityFilters={setCompatibilityFilters}
              setCrossHarnessOnly={setCrossHarnessOnly}
              setPage={setPage}
              tables={tables}
            />

            <DirectoryTable
              emptyMessage={emptyMessage}
              expandedRowId={expandedRowId}
              filteredRows={visibleRows}
              harnesses={harnesses}
              page={currentGroupedPage}
              pageSize={PAGE_SIZE}
              setPage={setPage}
              setExpandedRowId={setExpandedRowId}
              setSortDirection={setSortDirection}
              setSortKey={setSortKey}
              sortDirection={sortDirection}
              sortKey={sortKey}
              totalPages={groupedTotalPages}
              visibleHarnesses={visibleHarnesses}
            />
          </TabsContent>

          <TabsContent value="growth" className="mt-0 border-b border-border py-3">
            <div className="grid gap-2 pb-3 sm:grid-cols-2 xl:grid-cols-3">
              {overviewStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border/70 bg-card/40 px-4 py-3"
                >
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {stat.label}
                  </div>
                  <div className="pt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">
                    {stat.value}
                  </div>
                  <div className="pt-1 text-sm leading-snug text-muted-foreground">
                    {stat.detail}
                  </div>
                </div>
              ))}
            </div>
            <GrowthChart growth={growth} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
