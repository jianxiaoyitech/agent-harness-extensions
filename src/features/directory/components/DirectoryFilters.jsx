import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TYPE_LABELS, TYPE_ORDER } from "../constants";
import { compatibilityCount, formatNumber, repoLabel } from "../utils";

export function DirectoryFilters({
  activeType,
  compatibilityFilters,
  crossHarnessOnly,
  expandedRow,
  page,
  pageSize,
  totalPages,
  totalRows,
  featuredHarnesses,
  filteredTypeCounts,
  querySummary,
  rows,
  selectedSourceSummary,
  setActiveType,
  setCompatibilityFilters,
  setCrossHarnessOnly,
  tables,
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <section className="py-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {featuredHarnesses.map((harness) => {
              const selected = (compatibilityFilters[harness.id] || "any") === "check";
              const compatibilityStatus = expandedRow?.compatibility?.[harness.id] || "blank";
              const reflectedValue =
                compatibilityStatus === "check"
                  ? "1"
                  : compatibilityStatus === "question"
                    ? "?"
                    : "0";
              return (
                <Button
                  key={harness.id}
                  type="button"
                  variant={
                    expandedRow
                      ? compatibilityStatus === "check"
                        ? "default"
                        : "outline"
                      : selected
                        ? "default"
                        : "outline"
                  }
                  size="sm"
                  onClick={() => {
                    setCompatibilityFilters((current) => ({
                      ...current,
                      [harness.id]: selected ? "any" : "check",
                    }));
                  }}
                  className={`gap-2 rounded-full ${
                    expandedRow && compatibilityStatus === "blank"
                      ? "border-border/60 bg-transparent text-muted-foreground/65 hover:bg-muted/25"
                      : expandedRow && compatibilityStatus === "question"
                        ? "border-border/70 bg-muted/40 text-muted-foreground"
                        : ""
                  } ${
                    expandedRow && compatibilityStatus !== "check"
                      ? "opacity-85"
                      : ""
                  }`}
                >
                  <span
                    className={`inline-flex size-5 items-center justify-center rounded-full text-[0.58rem] font-bold tracking-[0.08em] ${
                      expandedRow && compatibilityStatus !== "check" ? "grayscale opacity-45" : ""
                    }`}
                    style={{
                      backgroundColor: harness.avatar_bg,
                      color: harness.avatar_fg,
                    }}
                  >
                    {harness.avatar_text}
                  </span>
                  <span>{harness.name}</span>
                  {expandedRow ? (
                    <span className="text-[0.72rem] opacity-75">
                      {reflectedValue}
                    </span>
                  ) : (
                    <span className="text-[0.72rem] opacity-75">
                      {compatibilityCount(rows, harness.id, "check")}
                    </span>
                  )}
                </Button>
              );
            })}
            <Button
              type="button"
              variant={crossHarnessOnly ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setCrossHarnessOnly((current) => !current)}
            >
              Reusable Across Harnesses
            </Button>
          </div>

          {selectedSourceSummary ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-[0.78rem] leading-tight">
              <a
                href={selectedSourceSummary.repo}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline decoration-border underline-offset-4 transition hover:decoration-foreground"
              >
                {selectedSourceSummary.sourceName}
              </a>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{repoLabel(selectedSourceSummary.repo)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {formatNumber(selectedSourceSummary.totalArtifacts)} total
              </span>
              {TYPE_ORDER.map((type) =>
                selectedSourceSummary.countsByType[type] > 0 ? (
                  <span key={type} className="text-muted-foreground">
                    {selectedSourceSummary.countsByType[type]} {TYPE_LABELS[type].toLowerCase()}
                  </span>
                ) : null
              )}
              {selectedSourceSummary.stars > 0 ? (
                <span className="text-muted-foreground">
                  {formatNumber(selectedSourceSummary.stars)} stars
                </span>
              ) : null}
              <span className="text-muted-foreground">
                Updated {selectedSourceSummary.updatedAt}
              </span>
              {selectedSourceSummary.archived ? (
                <span className="rounded-full border border-border/70 px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                  Archived
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="py-2.5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <Tabs
            value={activeType}
            onValueChange={setActiveType}
            className="min-w-0"
          >
            <TabsList className="h-auto gap-5 rounded-none border-0 bg-transparent p-0 shadow-none">
              {TYPE_ORDER.map((type) => (
                <TabsTrigger
                  key={type}
                  value={type}
                  className="rounded-none border-0 border-b border-transparent px-0 py-3 text-base font-medium text-muted-foreground shadow-none transition hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {TYPE_LABELS[type]} {tables[type]?.length ?? 0}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="pb-3 text-sm text-muted-foreground">
            Page{" "}
            <span className="font-medium text-foreground">{page}</span> / {totalPages}
          </div>
        </div>
      </section>
    </div>
  );
}
