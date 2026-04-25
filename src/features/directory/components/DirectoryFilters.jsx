import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TYPE_LABELS, TYPE_ORDER } from "../constants";
import { compatibilityCount } from "../utils";

export function DirectoryFilters({
  activeType,
  compatibilityFilters,
  crossHarnessOnly,
  featuredHarnesses,
  filteredTypeCounts,
  querySummary,
  rows,
  setActiveType,
  setCompatibilityFilters,
  setCrossHarnessOnly,
  setShowCompatibility,
  showCompatibility,
  tables,
}) {
  return (
    <>
      <section className="border-b border-border py-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Start With Your Harness
            </div>
            {featuredHarnesses.map((harness) => {
              const selected = (compatibilityFilters[harness.id] || "any") === "check";
              return (
                <Button
                  key={harness.id}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCompatibilityFilters((current) => ({
                      ...current,
                      [harness.id]: selected ? "any" : "check",
                    }));
                  }}
                  className="gap-2 rounded-full"
                >
                  <span
                    className="inline-flex size-5 items-center justify-center rounded-full text-[0.58rem] font-bold tracking-[0.08em]"
                    style={{
                      backgroundColor: harness.avatar_bg,
                      color: harness.avatar_fg,
                    }}
                  >
                    {harness.avatar_text}
                  </span>
                  <span>{harness.name}</span>
                  <span className="text-[0.72rem] opacity-75">
                    {compatibilityCount(rows, harness.id, "check")}
                  </span>
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
            <Button
              type="button"
              variant={showCompatibility ? "secondary" : "ghost"}
              size="sm"
              className="rounded-full"
              onClick={() => setShowCompatibility((current) => !current)}
            >
              {showCompatibility ? "Hide Compatibility" : "Show Compatibility"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-sm text-muted-foreground">
            <span>{querySummary}</span>
          </div>
          {filteredTypeCounts.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[0.78rem] text-muted-foreground">
              {filteredTypeCounts.map((item) => (
                <span
                  key={item.type}
                  className="inline-flex rounded-full border border-border/70 bg-background/70 px-2.5 py-1"
                >
                  <span className="font-semibold text-foreground">{item.count}</span>
                  <span className="ml-1">{item.label}</span>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-[0.78rem] text-muted-foreground">
            <span>`Supported` means explicitly listed in source data.</span>
            <span>`Not listed` does not necessarily mean incompatible.</span>
            {crossHarnessOnly ? <span>Reusable entries are a good place to start for migration.</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[0.78rem] text-muted-foreground">
            <span>Maintain a project in this ecosystem?</span>
            <a
              href="https://github.com/JianxiaoyiTech/agent-harness-extensions/tree/main/skills/add-data-and-test"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline decoration-border underline-offset-4 transition hover:decoration-foreground"
            >
              Follow the add-data-and-test guide
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
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
                  className="rounded-none border-0 border-b border-transparent px-0 pb-2 pt-0 text-base font-medium text-muted-foreground shadow-none transition hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {TYPE_LABELS[type]} {tables[type]?.length ?? 0}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </section>
    </>
  );
}
