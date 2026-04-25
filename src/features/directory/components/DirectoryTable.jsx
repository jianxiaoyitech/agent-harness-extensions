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
import { SORT_COLUMNS, TYPE_LABELS } from "../constants";
import {
  buildInstallGuide,
  compatibilityGlyph,
  formatNumber,
  formatDate,
  repoLabel,
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
      disabled={!supported}
      className={`rounded-full ${
        supported
          ? ""
          : "border-border/60 bg-transparent text-muted-foreground/65 hover:bg-transparent"
      }`}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function InstallInlineGuide({ guide, row }) {
  return (
    <div className="mt-2 rounded-lg border border-border/80 bg-background shadow-sm px-3 py-2">
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

function singularLabel(type) {
  return TYPE_LABELS[type]?.replace(/s$/, "") || "Item";
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
        <Table className="min-w-[78rem] table-fixed border-collapse">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {SORT_COLUMNS.map((column) => (
                <TableHead
                  key={column.key}
                  className={`h-12 border-b border-border bg-background px-3 py-0 align-middle ${
                    column.key === "name"
                      ? "w-[72%]"
                      : column.key === "stars"
                        ? "w-[10rem]"
                        : "w-[18rem]"
                  }`}
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
                const isExpanded = expandedRowId === row.id;
                const installTargetRow = row.primaryRow;
                const codexGuide = buildInstallGuide(installTargetRow, "codex");
                const claudeCodeGuide = buildInstallGuide(installTargetRow, "claude-code");
                const openclawGuide = buildInstallGuide(installTargetRow, "openclaw");
                const codexSupported = row.compatibility?.codex === "check";
                const claudeCodeSupported = row.compatibility?.["claude-code"] === "check";
                const openclawSupported = row.compatibility?.openclaw === "check";
                const installGuideOpen = activeInstallGuide?.rowId === row.id;
                const itemLabel = singularLabel(installTargetRow?.type);
                const countLabel =
                  row.hasQuery && row.matchCount !== row.totalCount
                    ? `${row.matchCount} of ${row.totalCount} ${TYPE_LABELS[installTargetRow?.type].toLowerCase()}`
                    : `${row.totalCount} ${TYPE_LABELS[installTargetRow?.type].toLowerCase()}`;

                return [
                  <TableRow
                    key={row.id}
                    data-source-row-id={row.id}
                    className={`border-b border-border/80 transition hover:bg-muted/25 ${
                      isExpanded ? "bg-accent/45" : ""
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
                        <a
                          href={row.repo}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-foreground underline decoration-border underline-offset-4 transition hover:decoration-foreground"
                        >
                          {row.source_name}
                        </a>
                        <span className="text-[0.78rem] text-muted-foreground">
                          {repoLabel(row.repo)}
                        </span>
                        <span className="rounded-full border border-border/80 px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                          {countLabel}
                        </span>
                        {row.archived ? (
                          <span className="rounded-full border border-border/80 px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                            Archived
                          </span>
                        ) : null}
                      </div>
                      {row.description ? (
                        <div className="mt-1 max-w-4xl text-[0.78rem] leading-relaxed text-muted-foreground whitespace-normal">
                          {row.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="w-[10rem] px-3 py-3 text-sm text-muted-foreground">
                      {row.stars > 0 ? formatNumber(row.stars) : "-"}
                    </TableCell>
                    <TableCell className="w-[18rem] px-3 py-3">
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
                            setExpandedRowId(row.id);
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
                            setExpandedRowId(row.id);
                            setActiveInstallGuide((current) =>
                              current?.rowId === row.id && current?.target === "claude-code"
                                ? null
                                : { rowId: row.id, target: "claude-code" }
                            );
                          }}
                        />
                        <InstallButton
                          label="OpenClaw"
                          supported={openclawSupported}
                          active={
                            activeInstallGuide?.rowId === row.id &&
                            activeInstallGuide?.target === "openclaw"
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedRowId(row.id);
                            setActiveInstallGuide((current) =>
                              current?.rowId === row.id && current?.target === "openclaw"
                                ? null
                                : { rowId: row.id, target: "openclaw" }
                            );
                          }}
                        />
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
                  isExpanded ? (
                    <TableRow key={`${row.id}-details`} className="border-b border-border/80 bg-muted/20">
                      <TableCell
                        colSpan={SORT_COLUMNS.length + visibleHarnesses.length}
                        className="px-3 py-3"
                      >
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
                          <div className="min-w-0">
                            <div className="grid gap-2">
                              {row.rows.map((artifact) => (
                                <a
                                  key={artifact.id}
                                  href={artifact.repo_path_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="rounded-lg border border-border/70 bg-background px-3 py-2 transition hover:border-border hover:bg-muted/30"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium break-words text-foreground">
                                      {artifact.name}
                                    </span>
                                    {artifact.color ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-border/80 px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                                        <span
                                          className="inline-flex size-2 rounded-full"
                                          style={{ backgroundColor: artifact.color }}
                                        />
                                        {artifact.color}
                                      </span>
                                    ) : null}
                                  </div>
                                  {artifact.description ? (
                                    <div className="mt-1 break-words text-[0.76rem] leading-relaxed text-muted-foreground whitespace-normal">
                                      {artifact.description}
                                    </div>
                                  ) : null}
                                </a>
                              ))}
                            </div>
                          </div>
                          <div className="min-w-0">
                            {installGuideOpen ? (
                              <div onClick={(event) => event.stopPropagation()}>
                                <InstallInlineGuide
                                  row={installTargetRow}
                                  guide={
                                    activeInstallGuide.target === "codex"
                                      ? codexGuide
                                      : activeInstallGuide.target === "openclaw"
                                        ? openclawGuide
                                        : claudeCodeGuide
                                  }
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null,
                ];
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
