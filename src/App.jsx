import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { FEATURED_HARNESS_IDS } from "@/features/directory/constants";
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

function withBase(path) {
  return `${NORMALIZED_BASE_URL}${path.replace(/^\//, "")}`;
}

export default function App({ initialData = null }) {
  const [activeType, setActiveType] = useState("mcp-server");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("supported_harnesses");
  const [sortDirection, setSortDirection] = useState("desc");
  const [compatibilityFilters, setCompatibilityFilters] = useState({});
  const [crossHarnessOnly, setCrossHarnessOnly] = useState(false);
  const [showCompatibility, setShowCompatibility] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [page, setPage] = useState(1);
  const { growth, harnesses, report, tables } = useDirectoryData(initialData);

  const rows = tables[activeType] || [];
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
  const visibleHarnesses = useMemo(() => {
    if (!showCompatibility) {
      return [];
    }

    if (activeCompatibilityFilters.length > 0) {
      return harnesses.filter((harness) =>
        activeCompatibilityFilters.some(([harnessId]) => harnessId === harness.id),
      );
    }

    return featuredHarnesses;
  }, [activeCompatibilityFilters, featuredHarnesses, harnesses, showCompatibility]);

  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) => {
          if (query) {
            const haystack = [
              row.name,
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

  useEffect(() => {
    setPage(1);
    setExpandedRowId(null);
  }, [activeType, query, sortDirection, sortKey, crossHarnessOnly, showCompatibility, compatibilityFilters]);

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
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = useMemo(
    () => filteredRows.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredRows, pageStart],
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[110rem] flex-col px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <section className="border-b border-border py-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end">
            <div className="space-y-3">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Agent Harness Extensions
              </div>
              <div className="max-w-4xl text-2xl leading-tight font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
                Browse extensions by agent harness.
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
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

            <div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-2 text-sm text-muted-foreground lg:justify-end">
              <span>
                <span className="font-semibold text-foreground">
                  {formatNumber(report?.artifact_count)}
                </span>{" "}
                extensions
              </span>
              <span>
                <span className="font-semibold text-foreground">
                  {formatNumber(report?.harness_count)}
                </span>{" "}
                harnesses
              </span>
            </div>
          </div>
        </section>

        <section className="border-b border-border py-4">
          <GrowthChart growth={growth} />
        </section>

        <DirectoryFilters
          activeType={activeType}
          compatibilityFilters={compatibilityFilters}
          crossHarnessOnly={crossHarnessOnly}
          featuredHarnesses={featuredHarnesses}
          filteredTypeCounts={filteredTypeCounts}
          querySummary={querySummary}
          rows={rows}
          search={search}
          setActiveType={setActiveType}
          setCompatibilityFilters={setCompatibilityFilters}
          setCrossHarnessOnly={setCrossHarnessOnly}
          setSearch={setSearch}
          setShowCompatibility={setShowCompatibility}
          showCompatibility={showCompatibility}
          tables={tables}
        />

        <DirectoryTable
          emptyMessage={emptyMessage}
          expandedRowId={expandedRowId}
          filteredRows={visibleRows}
          harnesses={harnesses}
          page={currentPage}
          pageSize={PAGE_SIZE}
          setPage={setPage}
          setExpandedRowId={setExpandedRowId}
          setSortDirection={setSortDirection}
          setSortKey={setSortKey}
          sortDirection={sortDirection}
          sortKey={sortKey}
          totalPages={totalPages}
          totalRows={filteredRows.length}
          visibleHarnesses={visibleHarnesses}
        />
      </div>
    </main>
  );
}
