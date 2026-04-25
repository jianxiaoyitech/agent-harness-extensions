import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ExternalLink } from "lucide-react";
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
  buildInstallGuide,
  compatibilityGlyph,
  repoLabel,
  shortPathLabel,
  supportedHarnessCount,
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

function InstallButton({ active, label, supported, onClick }) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="xs"
      className={`rounded-full ${
        supported
          ? ""
          : "border-border/60 bg-transparent text-muted-foreground/65 hover:bg-muted/25"
      }`}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function InstallInlineGuide({ guide, row }) {
  return (
    <div className="mt-2 rounded-lg border border-border/70 bg-muted/35 px-3 py-2">
      <div className="text-[0.72rem] font-semibold text-foreground">
        {guide.title}
      </div>

      <ol className="mt-2 space-y-2 text-[0.78rem] text-foreground">
        {guide.steps.map((step, index) => (
          <li key={step} className="flex gap-2 whitespace-normal leading-snug">
            <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[0.68rem] font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {guide.snippet ? (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-background px-3 py-2 text-[0.72rem] leading-relaxed text-foreground whitespace-pre-wrap">
          <code>{guide.snippet}</code>
        </pre>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={row.repo_path_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-foreground underline decoration-border underline-offset-4 transition hover:decoration-foreground"
        >
          Open source
          <ExternalLink className="size-3" />
        </a>
        <a
          href={row.repo}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[0.72rem] text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground hover:decoration-foreground"
        >
          Open repo
          <ExternalLink className="size-3" />
        </a>
      </div>
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
  visibleHarnesses,
}) {
  const [activeInstallGuide, setActiveInstallGuide] = useState(null);

  return (
    <section className="overflow-hidden">
      <div className="overflow-auto">
        <Table className="min-w-[78rem] border-collapse">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {SORT_COLUMNS.map((column) => (
                <TableHead
                  key={column.key}
                  className="h-12 border-b border-border bg-background px-3 py-0 align-middle"
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
                  className="h-20 border-b border-border bg-background px-2 py-2 text-center align-middle"
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
                const count = supportedHarnessCount(row);
                const isExpanded = expandedRowId === row.id;
                const codexGuide = buildInstallGuide(row, "codex");
                const claudeCodeGuide = buildInstallGuide(row, "claude-code");
                const codexSupported = row.compatibility?.codex === "check";
                const claudeCodeSupported = row.compatibility?.["claude-code"] === "check";
                const installGuideOpen = activeInstallGuide?.rowId === row.id;

                return (
                  <TableRow
                    key={row.id}
                    className={`border-b border-border/80 transition hover:bg-muted/25 ${
                      isExpanded ? "bg-accent/45 ring-1 ring-inset ring-border" : ""
                    }`}
                    onClick={() =>
                      setExpandedRowId((current) => (current === row.id ? null : row.id))
                    }
                  >
                    <TableCell
                      className={`sticky left-0 z-10 px-3 py-3 font-medium ${
                        isExpanded ? "bg-accent/45" : "bg-background"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-foreground">
                          <a
                            href={row.repo}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground hover:decoration-foreground"
                          >
                            {repoLabel(row.repo)}
                          </a>
                          <span className="px-1 text-muted-foreground/65">/</span>
                          <a
                            href={row.repo_path_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="underline decoration-border underline-offset-4 transition hover:decoration-foreground"
                          >
                            {row.name}
                          </a>
                        </div>
                        <div className="inline-flex rounded-full border border-border/80 px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                          {row.type_label}
                        </div>
                        {count >= 2 ? (
                          <div className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[0.68rem] font-medium text-secondary-foreground">
                            Reusable
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="relative px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <InstallButton
                          label="Codex"
                          supported={codexSupported}
                          active={
                            activeInstallGuide?.rowId === row.id &&
                            activeInstallGuide?.target === "codex"
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveInstallGuide((current) =>
                              current?.rowId === row.id && current?.target === "codex"
                                ? null
                                : { rowId: row.id, target: "codex" }
                            );
                          }}
                        />
                        <InstallButton
                          label="Claude Code"
                          supported={claudeCodeSupported}
                          active={
                            activeInstallGuide?.rowId === row.id &&
                            activeInstallGuide?.target === "claude-code"
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveInstallGuide((current) =>
                              current?.rowId === row.id && current?.target === "claude-code"
                                ? null
                                : { rowId: row.id, target: "claude-code" }
                            );
                          }}
                        />
                        {installGuideOpen ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="text-muted-foreground"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveInstallGuide(null);
                            }}
                          >
                            Hide
                            <ChevronDown className="size-3 rotate-180" />
                          </Button>
                        ) : null}
                      </div>
                      {installGuideOpen ? (
                        <div onClick={(event) => event.stopPropagation()}>
                          <InstallInlineGuide
                            row={row}
                            guide={
                              activeInstallGuide.target === "codex"
                                ? codexGuide
                                : claudeCodeGuide
                            }
                          />
                        </div>
                      ) : null}
                    </TableCell>

                    {visibleHarnesses.map((harness) => (
                      <TableCell
                        key={`${row.id}-${harness.id}`}
                        className="px-3 py-3 text-center text-sm"
                      >
                        {compatibilityGlyph(row.compatibility?.[harness.id])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-1 py-3 text-sm text-muted-foreground">
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
    </section>
  );
}
