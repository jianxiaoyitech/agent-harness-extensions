import fs from "node:fs/promises";
import path from "node:path";

import { getSnapshotDateStamp, getSnapshotDirForDate, LATEST_SNAPSHOT_DIR } from "./lib/catalog.ts";

interface SnapshotManifestLike {
  generated_at?: string;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readLatestGeneratedAt(manifestPath: string): Promise<string | null> {
  if (!(await fileExists(manifestPath))) return null;

  const manifest = JSON.parse(
    await fs.readFile(manifestPath, "utf8"),
  ) as SnapshotManifestLike;

  return typeof manifest.generated_at === "string" ? manifest.generated_at : null;
}

async function writeGithubOutput(values: Record<string, string>): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  await fs.appendFile(outputPath, `${lines.join("\n")}\n`);
}

async function main(): Promise<void> {
  const today = getSnapshotDateStamp();
  const latestManifestPath = path.join(LATEST_SNAPSHOT_DIR, "manifest.json");
  const datedManifestPath = path.join(getSnapshotDirForDate(today), "manifest.json");

  const latestGeneratedAt = await readLatestGeneratedAt(latestManifestPath);
  const latestIsFresh = latestGeneratedAt?.slice(0, 10) === today;
  const datedManifestExists = await fileExists(datedManifestPath);
  const skipSync = latestIsFresh && datedManifestExists;

  const reason = skipSync
    ? `latest manifest already generated on ${today} and dated snapshot exists`
    : latestGeneratedAt
      ? `sync required: latest manifest is ${latestGeneratedAt}, dated manifest present=${datedManifestExists}`
      : "sync required: latest manifest is missing";

  console.log(`[sync:check] Today: ${today}`);
  console.log(`[sync:check] Latest manifest: ${latestManifestPath}`);
  console.log(`[sync:check] Dated manifest: ${datedManifestPath}`);
  console.log(`[sync:check] Latest generated_at: ${latestGeneratedAt ?? "missing"}`);
  console.log(`[sync:check] Dated manifest present: ${datedManifestExists}`);
  console.log(`[sync:check] skip_sync=${skipSync}`);
  console.log(`[sync:check] ${reason}`);

  await writeGithubOutput({
    today,
    latest_generated_at: latestGeneratedAt ?? "",
    dated_manifest_present: String(datedManifestExists),
    skip_sync: String(skipSync),
    reason,
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[sync:check] Failed: ${message}`);
  process.exitCode = 1;
});
