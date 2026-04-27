import fs from "node:fs/promises";
import path from "node:path";

type SyncIssue = { source_id: string; issues: string[] };

interface SnapshotManifestLike {
  generated_at?: string;
  sync_issues?: SyncIssue[];
}

function formatSyncIssuesMarkdown(issues: SyncIssue[], opts: { runUrl?: string; generatedAt?: string }): string {
  const headerParts: string[] = [];
  if (opts.generatedAt) headerParts.push(`Generated at: ${opts.generatedAt}`);
  if (opts.runUrl) headerParts.push(`Run: ${opts.runUrl}`);

  const header = headerParts.length > 0 ? `${headerParts.join(" · ")}\n\n` : "";

  const lines: string[] = [];
  lines.push(`## Sync issues (${issues.length})`);
  lines.push("");
  lines.push(header.trimEnd());

  for (const entry of issues) {
    lines.push(`### \`${entry.source_id}\``);
    for (const issue of entry.issues) {
      lines.push(`- ${issue}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

async function appendStepSummary(markdown: string): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  await fs.appendFile(summaryPath, `${markdown}\n`);
}

async function githubRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`GitHub API ${response.status}: ${text || response.statusText}`);
  }
  return (await response.json()) as T;
}

async function findOrCreateTrackingIssue(args: {
  token: string;
  owner: string;
  repo: string;
  title: string;
  label: string;
  body: string;
  closeIfEmpty: boolean;
  hasIssues: boolean;
}): Promise<void> {
  const baseUrl = `https://api.github.com/repos/${args.owner}/${args.repo}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${args.token}`,
    "User-Agent": "agent-harness-extensions-sync",
  };

  type Issue = { number: number; title: string };

  const issues = await githubRequest<Issue[]>(
    `${baseUrl}/issues?state=open&labels=${encodeURIComponent(args.label)}&per_page=100`,
    { headers },
  );
  const tracking = issues.find((issue) => issue.title === args.title) ?? null;

  if (!args.hasIssues) {
    if (args.closeIfEmpty && tracking) {
      await githubRequest(`${baseUrl}/issues/${tracking.number}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ state: "closed" }),
      });
      await githubRequest(`${baseUrl}/issues/${tracking.number}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ body: "✅ Sync issues resolved." }),
      });
    }
    return;
  }

  if (tracking) {
    await githubRequest(`${baseUrl}/issues/${tracking.number}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body: args.body }),
    });
    return;
  }

  await githubRequest(`${baseUrl}/issues`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: args.title,
      body: args.body,
      labels: [args.label],
    }),
  });
}

async function main(): Promise<void> {
  const manifestPath = path.join(process.cwd(), "data", "latest", "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as SnapshotManifestLike;
  const syncIssues = Array.isArray(manifest.sync_issues) ? manifest.sync_issues : [];
  const generatedAt = typeof manifest.generated_at === "string" ? manifest.generated_at : undefined;

  if (syncIssues.length === 0) {
    const message = "## Sync issues\n\n✅ No sync issues detected.\n";
    console.log("[report-sync-issues] No sync issues detected.");
    await appendStepSummary(message);
  } else {
    console.warn(`[report-sync-issues] Found ${syncIssues.length} sync issue(s).`);
    const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined;
    const markdown = formatSyncIssuesMarkdown(syncIssues, { runUrl, generatedAt });
    await appendStepSummary(markdown);
    console.warn(markdown);
  }

  const createIssue =
    process.env.CREATE_SYNC_ISSUE === "true" || process.env.CREATE_SYNC_ISSUE === "1";
  if (!createIssue) return;

  const token = process.env.GITHUB_TOKEN;
  const repoSlug = process.env.GITHUB_REPOSITORY;
  if (!token || !repoSlug) {
    console.warn("[report-sync-issues] Skipping issue creation: missing GITHUB_TOKEN or GITHUB_REPOSITORY.");
    return;
  }

  const [owner, repo] = repoSlug.split("/");
  if (!owner || !repo) {
    console.warn(`[report-sync-issues] Skipping issue creation: invalid GITHUB_REPOSITORY=${repoSlug}`);
    return;
  }

  const title = "Sync issues (auto)";
  const label = "sync-issues";
  const closeIfEmpty = true;

  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${repoSlug}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined;
  const body =
    syncIssues.length === 0
      ? "✅ No sync issues detected."
      : formatSyncIssuesMarkdown(syncIssues, { runUrl, generatedAt });

  try {
    await findOrCreateTrackingIssue({
      token,
      owner,
      repo,
      title,
      label,
      body,
      closeIfEmpty,
      hasIssues: syncIssues.length > 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[report-sync-issues] Unable to create/update tracking issue: ${message}`);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.warn(`[report-sync-issues] Failed: ${message}`);
  // Best-effort: never fail the workflow.
});

