import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TYPE_LABELS, TYPE_ORDER } from "../constants";
import { compatibilityCount } from "../utils";

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
  setActiveType,
  setCompatibilityFilters,
  setCrossHarnessOnly,
  setPage,
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
          <div className="flex items-center gap-2 pb-3 text-sm text-muted-foreground">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="min-w-20 text-center">
              Page <span className="font-medium text-foreground">{page}</span> / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
