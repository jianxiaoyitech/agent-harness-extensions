import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SORT_COLUMNS } from "../constants";
import {
  compatibilityGlyph,
  formatDate,
  repoLabel,
  shortPathLabel,
  supportedHarnessCount,
  supportedHarnessNames,
  updatedStatus,
} from "../utils";

function SortIcon({ direction, active }) {
  if (!active) return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
  return direction === "asc" ? (
    <ArrowUp className="size-3.5 text-foreground" />
  ) : (
    <ArrowDown className="size-3.5 text-foreground" />
  );
}

function HarnessHeader({ harness }) {
  const content = (
    <>
      <div
        aria-label={`${harness.name} avatar`}
        title={harness.name}
        className="flex size-8 items-center justify-center rounded-md border border-border/80 text-[0.65rem] font-bold tracking-[0.12em]"
        style={{
          backgroundColor: harness.avatar_bg,
          color: harness.avatar_fg,
        }}
      >
        {harness.avatar_text}
      </div>
      <span className="text-center text-[0.72rem] font-semibold leading-tight text-foreground">
        {harness.name}
      </span>
    </>
  );

  return (
    <div className="flex min-w-[6rem] flex-col items-center gap-2 py-1">
      {harness.url ? (
        <a
          href={harness.url}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-2 rounded-md outline-none transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

export function DirectoryTable({
  emptyMessage,
  expandedRowId,
  filteredRows,
  harnesses,
  page,
  pageSize,
  setPage,
  setExpandedRowId,
  setSortDirection,
  setSortKey,
  sortDirection,
  sortKey,
  totalPages,
  totalRows,
  visibleHarnesses,
}) {
  return (
    <section className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-1 py-3 text-sm text-muted-foreground">
        <div>
          Showing{" "}
          <span className="font-medium text-foreground">
            {totalRows === 0 ? 0 : (page - 1) * pageSize + 1}
          </span>
          {" "}-{" "}
          <span className="font-medium text-foreground">
            {Math.min(page * pageSize, totalRows)}
          </span>
          {" "}of{" "}
          <span className="font-medium text-foreground">{totalRows}</span>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="overflow-auto">
        <Table className="min-w-[78rem] border-collapse">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {SORT_COLUMNS.map((column) => (
                <TableHead
                  key={column.key}
                  className="sticky top-0 z-20 h-12 border-b border-border bg-background px-3 py-0 align-middle first:left-0 first:z-30 first:bg-background"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey === column.key) {
                        setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
                        return;
                      }

                      setSortKey(column.key);
                      setSortDirection(column.numeric ? "desc" : "asc");
                    }}
                    className="flex w-full items-center justify-between gap-2 text-left text-[0.78rem] font-semibold text-foreground"
                  >
                    <span>{column.label}</span>
                    <SortIcon
                      active={sortKey === column.key}
                      direction={sortDirection}
                    />
                  </button>
                </TableHead>
              ))}

              {visibleHarnesses.map((harness) => (
                <TableHead
                  key={harness.id}
                  className="sticky top-0 z-20 h-20 border-b border-border bg-background px-2 py-2 text-center align-middle"
                >
                  <HarnessHeader harness={harness} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={SORT_COLUMNS.length + visibleHarnesses.length}
                  className="h-28 px-3 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.flatMap((row) => {
                const names = supportedHarnessNames(row, harnesses);
                const count = supportedHarnessCount(row);
                const isExpanded = expandedRowId === row.id;

                return [
                  <TableRow key={row.id} className="border-b border-border/80">
                    <TableCell className="sticky left-0 z-10 bg-background px-3 py-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-foreground">{row.name}</div>
                        <div className="inline-flex rounded-full border border-border/80 px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                          {row.type_label}
                        </div>
                        {count >= 2 ? (
                          <div className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[0.68rem] font-medium text-secondary-foreground">
                            Reusable
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[0.72rem] text-muted-foreground/85">
                        <a
                          href={row.repo_path_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-border underline-offset-4 transition hover:decoration-foreground"
                        >
                          {shortPathLabel(row.path)}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <div className="font-medium text-foreground">
                        {count} harnesses
                      </div>
                      <div
                        className="text-xs text-muted-foreground"
                        title={names.length > 0 ? names.join(", ") : "No explicit support listed"}
                      >
                        {names.length === 0
                          ? "Not listed yet"
                          : names.length <= 2
                            ? names.join(", ")
                            : `${names.slice(0, 2).join(", ")} +${names.length - 2}`}
                      </div>
                      <button
                        type="button"
                        className="mt-1 text-[0.68rem] font-medium text-foreground/80 underline decoration-border underline-offset-4 transition hover:decoration-foreground"
                        onClick={() =>
                          setExpandedRowId((current) => (current === row.id ? null : row.id))
                        }
                      >
                        {isExpanded ? "Hide details" : "Show details"}
                      </button>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <div className="font-medium text-foreground">
                        <a
                          href={row.repo}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-border underline-offset-4 transition hover:decoration-foreground"
                        >
                          {repoLabel(row.repo)}
                        </a>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.source_name}
                      </div>
                      <div className="mt-1 text-[0.72rem] text-muted-foreground/85">
                        Open upstream repository
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-muted-foreground">
                      <div className={`font-medium ${updatedStatus(row.updated_at).tone}`}>
                        {updatedStatus(row.updated_at).label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(row.updated_at)}
                      </div>
                    </TableCell>

                    {visibleHarnesses.map((harness) => (
                      <TableCell
                        key={`${row.id}-${harness.id}`}
                        className="px-3 py-3 text-center text-sm"
                      >
                        {compatibilityGlyph(row.compatibility?.[harness.id])}
                      </TableCell>
                    ))}
                  </TableRow>,
                  ...(isExpanded
                    ? [
                        <TableRow key={`${row.id}-details`} className="border-b border-border/60 bg-card/35">
                          <TableCell
                            colSpan={SORT_COLUMNS.length + visibleHarnesses.length}
                            className="px-3 py-3"
                          >
                            <div className="grid gap-3 text-sm text-muted-foreground lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                              <div>
                                <div className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  Explicitly Supported Harnesses
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {names.length > 0 ? (
                                    names.map((name) => (
                                      <span
                                        key={`${row.id}-${name}`}
                                        className="inline-flex rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[0.78rem] text-foreground"
                                      >
                                        {name}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[0.85rem]">
                                      No harnesses are explicitly listed for this entry yet.
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  Quick Notes
                                </div>
                                <div className="space-y-1 text-[0.85rem]">
                                  <div>Source: {row.source_name}</div>
                                  <div>Path: {row.path}</div>
                                  <div>Last update: {formatDate(row.updated_at)}</div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>,
                      ]
                    : []),
                ];
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
