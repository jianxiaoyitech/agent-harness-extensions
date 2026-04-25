import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";

const execFile = promisify(execFileCallback);

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const HARNESS_FILE = path.join(DATA_DIR, "harness.yaml");
export const SOURCES_DIR = path.join(DATA_DIR, "sources");
export const SNAPSHOT_ROOT_DIR = DATA_DIR;
export const LATEST_SNAPSHOT_DIR = path.join(DATA_DIR, "latest");
export const CACHE_DIR = path.join(ROOT_DIR, ".cache");
export const CACHE_REPOS_DIR = path.join(CACHE_DIR, "repos");
export const CACHE_GITHUB_METADATA_DIR = path.join(CACHE_DIR, "github-repo-metadata");
export const DETECTOR_VERSION = "2";

export function getSnapshotDateStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getSnapshotDirForDate(dateStamp: string = getSnapshotDateStamp()): string {
  const [year, month, day] = dateStamp.split("-");
  return path.join(SNAPSHOT_ROOT_DIR, year, month, day);
}

export function isValidDateStamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function listDateStampsInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function isMonthlyCheckpointDate(dateStamp: string, firstDate: string): boolean {
  return dateStamp === firstDate || dateStamp.endsWith("-01");
}

export const ARTIFACT_TYPES = new Set(["mcp-server", "skill", "plugin", "agent"] as const);
export const COMPATIBILITY_VALUES = new Set(["check", "question", "blank"] as const);
export const SOURCE_STATUSES = new Set(["active", "archived"] as const);

export type ArtifactType = "mcp-server" | "skill" | "plugin" | "agent";
export type CompatibilityValue = "check" | "question" | "blank";
export type SourceStatus = "active" | "archived";
export type DetectionMethod = "convention" | "manifest" | "pattern" | "regex" | "manual";
export type SyncMode = "full" | "delta" | "unchanged";

export interface Harness {
  id: string;
  name: string;
  avatar_text: string;
  avatar_bg: string;
  avatar_fg: string;
  url?: string;
}

export interface DiscoveryRegex {
  pattern: string;
  type: ArtifactType;
}

export interface ManualArtifact {
  name: string;
  type: ArtifactType;
  path: string;
}

export interface SourceDefinition {
  version: 1;
  id: string;
  name: string;
  status: SourceStatus;
  repo: string;
  compatibility: Record<string, CompatibilityValue>;
  allowed_types: ArtifactType[];
  discovery: {
    manifests: boolean;
    conventions: boolean;
    regex: boolean;
    path_patterns?: string[];
    path_regex?: DiscoveryRegex[];
  };
  artifacts?: ManualArtifact[];
  exclusions?: {
    paths: string[];
    artifacts: string[];
  };
  metadata?: {
    notes?: string | null;
  };
}

export interface RepoSnapshot {
  defaultBranch: string;
  repoUrl: string;
  stars: number;
  forks: number;
  license: string;
  updatedAt: string;
  archived: boolean;
  files: string[];
}

interface GithubRepoMetadataCacheRecord {
  fetched_at: string;
  forks: number;
  stars: number;
}

interface GithubRepoApiResponse {
  forks_count?: number;
  stargazers_count?: number;
}

interface Detector {
  type: ArtifactType;
  method: Exclude<DetectionMethod, "pattern" | "regex" | "manual">;
  regex: RegExp;
}

export interface DetectedArtifact {
  name: string;
  type: ArtifactType;
  path: string;
  detection:
    | { method: "pattern"; pattern: string }
    | { method: "regex"; pattern: string }
    | { method: "manual" }
    | { method: "convention" | "manifest" };
}

export interface ArtifactRecord {
  id: string;
  source_id: string;
  source_name: string;
  source_status: SourceStatus;
  name: string;
  description?: string;
  color?: string;
  type: ArtifactType;
  type_label: string;
  path: string;
  repo: string;
  repo_path_url: string;
  compatibility: Record<string, CompatibilityValue>;
  repo_metrics: {
    stars: number;
    forks: number;
    license: string;
    updated_at: string;
    archived: boolean;
  };
  detection: DetectedArtifact["detection"];
  mismatch: {
    type: boolean;
    allowed_types: ArtifactType[];
  };
  last_checked_at: string;
}

export interface TableRow {
  id: string;
  name: string;
  description?: string;
  source_description?: string;
  color?: string;
  type: ArtifactType;
  type_label: string;
  source_id: string;
  source_name: string;
  repo: string;
  repo_path_url: string;
  path: string;
  stars: number;
  forks: number;
  updated_at: string;
  license: string;
  archived: boolean;
  compatibility: Record<string, CompatibilityValue>;
}

export interface SnapshotSourceRecord {
  version: 1;
  source_id: string;
  source_name: string;
  source_status: SourceStatus;
  snapshot_date?: string;
  first_commit_date?: string;
  carry_forward_from?: string;
  repo: string;
  default_branch: string;
  previous_sha: string | null;
  current_sha: string;
  mode: SyncMode;
  changed_files: string[];
  source_config_hash: string;
  detector_version: string;
  synced_at: string;
  repo_metrics: {
    stars: number;
    forks: number;
    license: string;
    updated_at: string;
    archived: boolean;
  };
  artifacts: ArtifactRecord[];
  issues: string[];
}

interface ThinSnapshotSourceRecord {
  version: 2;
  source_id: string;
  source_name: string;
  source_status: SourceStatus;
  snapshot_date: string;
  first_commit_date?: string;
  repo: string;
  default_branch: string;
  previous_sha: string | null;
  current_sha: string;
  mode: "unchanged";
  changed_files: [];
  source_config_hash: string;
  detector_version: string;
  synced_at: string;
  repo_metrics: SnapshotSourceRecord["repo_metrics"];
  artifact_count: number;
  mismatch_count: number;
  carry_forward_from: string;
  issues: string[];
}

type OnDiskSnapshotSourceRecord = SnapshotSourceRecord | ThinSnapshotSourceRecord;

export interface SnapshotManifest {
  version: 1;
  generated_at: string;
  harness_count: number;
  source_count: number;
  invalid_sources: Array<{ file: string; source_id: string | null; issues: string[] }>;
  sync_issues: Array<{ source_id: string; issues: string[] }>;
  artifact_count: number;
  mismatch_count: number;
  sources: Array<{
    source_id: string;
    current_sha: string;
    previous_sha: string | null;
    mode: SyncMode;
    artifact_count: number;
    changed_file_count: number;
  }>;
}

const DEFAULT_DETECTORS: Detector[] = [
  {
    type: "skill",
    method: "convention",
    regex: /^\.codex\/skills\/[^/]+\/SKILL\.md$/,
  },
  {
    type: "skill",
    method: "convention",
    regex: /^skills\/[^/]+\/SKILL\.md$/,
  },
  {
    type: "plugin",
    method: "manifest",
    regex: /^\.claude-plugin\/plugin\.json$/,
  },
  {
    type: "plugin",
    method: "manifest",
    regex: /^\.codex-plugin\/plugin\.json$/,
  },
  {
    type: "plugin",
    method: "manifest",
    regex: /(^|\/)\.claude-plugin\/plugin\.json$/,
  },
  {
    type: "plugin",
    method: "manifest",
    regex: /(^|\/)\.codex-plugin\/plugin\.json$/,
  },
  {
    type: "mcp-server",
    method: "manifest",
    regex: /^\.mcp\.json$/,
  },
  {
    type: "mcp-server",
    method: "manifest",
    regex: /(^|\/)\.mcp\.json$/,
  },
  {
    type: "agent",
    method: "convention",
    regex:
      /^(?:academic|design|engineering|game-development|marketing|paid-media|product|project-management|sales|spatial-computing|specialized|strategy|support|testing)\/(?:[^/]+\/)?[^/]+\.md$/,
  },
];

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value: string): string {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function artifactTypeLabel(type: ArtifactType): string {
  if (type === "mcp-server") return "MCP Server";
  if (type === "skill") return "Skill";
  if (type === "plugin") return "Plugin";
  return "Agent";
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function readYamlFile<T = unknown>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return parseYaml(raw) as T;
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function extractGithubRepoPath(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(repoUrl);
    if (parsed.hostname !== "github.com") return null;
    const segments = parsed.pathname
      .replace(/^\//, "")
      .replace(/\.git$/, "")
      .split("/")
      .filter(Boolean);
    if (segments.length < 2) return null;
    return {
      owner: segments[0]!,
      repo: segments[1]!,
    };
  } catch {
    return null;
  }
}

function githubMetadataCachePath(repoUrl: string): string | null {
  const repoPath = extractGithubRepoPath(repoUrl);
  if (!repoPath) return null;
  return path.join(CACHE_GITHUB_METADATA_DIR, `${repoPath.owner}-${repoPath.repo}.json`);
}

async function readGithubRepoMetadataCache(
  repoUrl: string,
  now: Date = new Date(),
): Promise<{ forks: number; stars: number } | null> {
  const cachePath = githubMetadataCachePath(repoUrl);
  if (!cachePath || !(await fileExists(cachePath))) return null;

  try {
    const cached = await readJsonFile<GithubRepoMetadataCacheRecord>(cachePath);
    if (cached.fetched_at.slice(0, 10) !== getSnapshotDateStamp(now)) {
      return null;
    }

    return {
      forks: cached.forks ?? 0,
      stars: cached.stars ?? 0,
    };
  } catch {
    return null;
  }
}

async function writeGithubRepoMetadataCache(
  repoUrl: string,
  metadata: { forks: number; stars: number },
): Promise<void> {
  const cachePath = githubMetadataCachePath(repoUrl);
  if (!cachePath) return;
  await ensureDir(CACHE_GITHUB_METADATA_DIR);
  await writeJson(cachePath, {
    fetched_at: new Date().toISOString(),
    forks: metadata.forks,
    stars: metadata.stars,
  } satisfies GithubRepoMetadataCacheRecord);
}

async function fetchGithubRepoMetadata(
  repoUrl: string,
): Promise<{ forks: number; stars: number } | null> {
  const repoPath = extractGithubRepoPath(repoUrl);
  if (!repoPath) return null;

  const cached = await readGithubRepoMetadataCache(repoUrl);
  if (cached) {
    return cached;
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "agent-harness-extensions-sync",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoPath.owner}/${repoPath.repo}`,
      { headers },
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as GithubRepoApiResponse;
    const metadata = {
      forks: data.forks_count ?? 0,
      stars: data.stargazers_count ?? 0,
    };
    await writeGithubRepoMetadataCache(repoUrl, metadata);
    return metadata;
  } catch {
    return null;
  }
}

export async function loadHarnessRegistry(): Promise<{
  harnesses: Harness[];
  issues: string[];
  filePath: string;
}> {
  const filePath = HARNESS_FILE;
  const parsed = await readYamlFile<{ harnesses?: Harness[] }>(filePath);
  const harnesses = Array.isArray(parsed?.harnesses) ? parsed.harnesses : [];
  const ids = new Set<string>();
  const issues: string[] = [];

  for (const harness of harnesses) {
    if (!harness?.id || !harness?.name) {
      issues.push(`Harness entries must include id and name: ${JSON.stringify(harness)}`);
      continue;
    }
    if (!harness.avatar_text || !harness.avatar_bg || !harness.avatar_fg) {
      issues.push(
        `Harness entries must include avatar_text, avatar_bg, and avatar_fg: ${JSON.stringify(harness)}`,
      );
      continue;
    }
    if (ids.has(harness.id)) {
      issues.push(`Duplicate harness id: ${harness.id}`);
      continue;
    }
    ids.add(harness.id);
  }

  const sortedHarnesses = [...harnesses].sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );

  return { harnesses: sortedHarnesses, issues, filePath };
}

export async function loadSourceFiles(): Promise<Array<{ filePath: string; source: SourceDefinition }>> {
  const entries = await fs.readdir(SOURCES_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => path.join(SOURCES_DIR, entry.name))
    .sort();

  return Promise.all(
    files.map(async (filePath) => ({
      filePath,
      source: await readYamlFile<SourceDefinition>(filePath),
    })),
  );
}

export function validateSource(source: unknown, harnessIds: string[]): string[] {
  const issues: string[] = [];

  if (!source || typeof source !== "object") {
    return ["Source file did not parse into an object."];
  }

  const typedSource = source as Partial<SourceDefinition>;

  if (typedSource.version !== 1) issues.push("version must be 1");
  if (!typedSource.id || typeof typedSource.id !== "string") issues.push("id is required");
  if (!typedSource.name || typeof typedSource.name !== "string") issues.push("name is required");
  if (!typedSource.status || !SOURCE_STATUSES.has(typedSource.status)) {
    issues.push("status must be one of: active, archived");
  }
  if (!typedSource.repo || typeof typedSource.repo !== "string") issues.push("repo is required");

  if (!Array.isArray(typedSource.allowed_types) || typedSource.allowed_types.length === 0) {
    issues.push("allowed_types must include at least one artifact type");
  } else {
    for (const value of typedSource.allowed_types) {
      if (!ARTIFACT_TYPES.has(value)) {
        issues.push(`allowed_types contains invalid type: ${value}`);
      }
    }
  }

  if (!typedSource.compatibility || typeof typedSource.compatibility !== "object") {
    issues.push("compatibility is required");
  } else {
    for (const [key, value] of Object.entries(typedSource.compatibility)) {
      if (!harnessIds.includes(key)) {
        issues.push(`compatibility contains unknown harness key: ${key}`);
      }
      if (!COMPATIBILITY_VALUES.has(value as CompatibilityValue)) {
        issues.push(`compatibility.${key} must be one of check, question, blank`);
      }
    }
  }

  if (!typedSource.discovery || typeof typedSource.discovery !== "object") {
    issues.push("discovery is required");
  } else {
    for (const field of ["manifests", "conventions", "regex"] as const) {
      if (typeof typedSource.discovery[field] !== "boolean") {
        issues.push(`discovery.${field} must be a boolean`);
      }
    }

    if (
      typedSource.discovery.path_patterns &&
      !Array.isArray(typedSource.discovery.path_patterns)
    ) {
      issues.push("discovery.path_patterns must be an array");
    }

    if (typedSource.discovery.path_regex) {
      if (!Array.isArray(typedSource.discovery.path_regex)) {
        issues.push("discovery.path_regex must be an array");
      } else {
        for (const item of typedSource.discovery.path_regex) {
          if (!item?.pattern || !item?.type) {
            issues.push("discovery.path_regex entries require pattern and type");
            continue;
          }
          if (!ARTIFACT_TYPES.has(item.type)) {
            issues.push(`discovery.path_regex entry has invalid type: ${item.type}`);
          }
          try {
            new RegExp(item.pattern);
          } catch {
            issues.push(`Invalid regex pattern: ${item.pattern}`);
          }
        }
      }
    }
  }

  if (typedSource.artifacts) {
    if (!Array.isArray(typedSource.artifacts)) {
      issues.push("artifacts must be an array");
    } else {
      for (const artifact of typedSource.artifacts) {
        if (!artifact?.name || !artifact?.type || !artifact?.path) {
          issues.push("manual artifacts require name, type, and path");
          continue;
        }
        if (!ARTIFACT_TYPES.has(artifact.type)) {
          issues.push(`manual artifact has invalid type: ${artifact.type}`);
        }
      }
    }
  }

  if (typedSource.exclusions) {
    if (!Array.isArray(typedSource.exclusions.paths)) {
      issues.push("exclusions.paths must be an array");
    }
    if (!Array.isArray(typedSource.exclusions.artifacts)) {
      issues.push("exclusions.artifacts must be an array");
    }
  }

  return issues;
}

function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

export function globToRegex(pattern: string): RegExp {
  let regex = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      regex += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      regex += "[^/]*";
      continue;
    }
    regex += escapeRegex(char);
  }
  regex += "$";
  return new RegExp(regex);
}

function inferArtifactName(type: ArtifactType, filePath: string): string {
  const segments = filePath.split("/");
  if (type === "skill") {
    return titleCase(segments.at(-2) || segments.at(-1) || "Unknown Skill");
  }
  if (type === "plugin") {
    const pluginIndex = segments.lastIndexOf(".claude-plugin");
    const codexIndex = segments.lastIndexOf(".codex-plugin");
    const index = pluginIndex >= 1 ? pluginIndex : codexIndex;
    if (index > 0) return titleCase(segments[index - 1]);
    return titleCase(segments.at(-3) || "Unknown Plugin");
  }
  if (type === "agent") {
    const fileName = segments.at(-1) || "unknown-agent.md";
    return titleCase(fileName.replace(/\.md$/i, ""));
  }
  return titleCase(segments.at(-2) || segments.at(-1) || "Unknown MCP Server");
}

function normalizeRepoUrl(repoUrl: string): string {
  return repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
}

function buildPathUrl(repoUrl: string, defaultBranch: string, filePath: string): string {
  return `${normalizeRepoUrl(repoUrl)}/blob/${defaultBranch}/${filePath}`;
}

function buildArtifactId(sourceId: string, type: ArtifactType, filePath: string): string {
  return `${sourceId}::${type}::${slugify(filePath)}`;
}

interface ArtifactContentMetadata {
  color?: string;
  description?: string;
  name?: string;
}

function parseMarkdownFrontmatter(content: string): ArtifactContentMetadata {
  if (!content.startsWith("---\n")) {
    return {};
  }

  const endIndex = content.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return {};
  }

  try {
    const frontmatter = parseYaml(content.slice(4, endIndex)) as Record<string, unknown>;
    return {
      name: typeof frontmatter.name === "string" ? frontmatter.name.trim() : undefined,
      description:
        typeof frontmatter.description === "string" ? frontmatter.description.trim() : undefined,
      color: typeof frontmatter.color === "string" ? frontmatter.color.trim() : undefined,
    };
  } catch {
    return {};
  }
}

function parseJsonArtifactMetadata(content: string): ArtifactContentMetadata {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      name: typeof parsed.name === "string" ? parsed.name.trim() : undefined,
      description:
        typeof parsed.description === "string" ? parsed.description.trim() : undefined,
      color: typeof parsed.color === "string" ? parsed.color.trim() : undefined,
    };
  } catch {
    return {};
  }
}

async function extractArtifactMetadataFromGit(args: {
  gitDir: string;
  gitRef: string;
  path: string;
  type: ArtifactType;
}): Promise<ArtifactContentMetadata> {
  const extension = path.extname(args.path).toLowerCase();

  try {
    const content = await runGit(args.gitDir, ["show", `${args.gitRef}:${args.path}`]);
    if (extension === ".md") {
      return parseMarkdownFrontmatter(content);
    }
    if (extension === ".json") {
      return parseJsonArtifactMetadata(content);
    }
  } catch {
    return {};
  }

  return {};
}

function addDetectedArtifact(map: Map<string, DetectedArtifact>, artifact: DetectedArtifact): void {
  const existing = map.get(artifact.path);
  if (!existing) {
    map.set(artifact.path, artifact);
    return;
  }

  if (existing.detection.method === "manual") {
    return;
  }

  if (artifact.detection.method === "manual") {
    map.set(artifact.path, artifact);
  }
}

function isExcludedPath(source: SourceDefinition, filePath: string): boolean {
  const exclusions = source.exclusions?.paths || [];
  return exclusions.some((pattern) => globToRegex(pattern).test(filePath));
}

export function detectArtifacts(
  source: SourceDefinition,
  repoSnapshot: Pick<RepoSnapshot, "files">,
): DetectedArtifact[] {
  const artifactMap = new Map<string, DetectedArtifact>();
  const files = repoSnapshot.files || [];

  if (source.discovery.manifests || source.discovery.conventions) {
    for (const filePath of files) {
      if (isExcludedPath(source, filePath)) continue;
      for (const detector of DEFAULT_DETECTORS) {
        if (detector.regex.test(filePath)) {
          addDetectedArtifact(artifactMap, {
            name: inferArtifactName(detector.type, filePath),
            type: detector.type,
            path: filePath,
            detection: { method: detector.method },
          });
        }
      }
    }
  }

  for (const pattern of source.discovery.path_patterns || []) {
    const regex = globToRegex(pattern);
    for (const filePath of files) {
      if (isExcludedPath(source, filePath)) continue;
      if (regex.test(filePath)) {
        const type = inferTypeFromPath(filePath);
        addDetectedArtifact(artifactMap, {
          name: inferArtifactName(type, filePath),
          type,
          path: filePath,
          detection: { method: "pattern", pattern },
        });
      }
    }
  }

  if (source.discovery.regex) {
    for (const matcher of source.discovery.path_regex || []) {
      const regex = new RegExp(matcher.pattern);
      for (const filePath of files) {
        if (isExcludedPath(source, filePath)) continue;
        if (regex.test(filePath)) {
          addDetectedArtifact(artifactMap, {
            name: inferArtifactName(matcher.type, filePath),
            type: matcher.type,
            path: filePath,
            detection: { method: "regex", pattern: matcher.pattern },
          });
        }
      }
    }
  }

  for (const artifact of source.artifacts || []) {
    if (isExcludedPath(source, artifact.path)) continue;
    if (files.includes(artifact.path)) {
      addDetectedArtifact(artifactMap, {
        name: artifact.name,
        type: artifact.type,
        path: artifact.path,
        detection: { method: "manual" },
      });
    }
  }

  const excludedArtifacts = new Set(source.exclusions?.artifacts || []);
  return [...artifactMap.values()].filter((artifact) => !excludedArtifacts.has(artifact.path));
}

function inferTypeFromPath(filePath: string): ArtifactType {
  if (filePath.endsWith("SKILL.md")) return "skill";
  if (filePath.endsWith(".mcp.json") || filePath.endsWith("/mcp.json")) return "mcp-server";
  if (filePath.endsWith(".md")) return "agent";
  return "plugin";
}

export function buildArtifactRecords(
  source: SourceDefinition,
  repoSnapshot: RepoSnapshot,
  harnesses: Harness[],
  metadataByPath: Map<string, ArtifactContentMetadata> = new Map(),
): ArtifactRecord[] {
  const allowedTypes = new Set(source.allowed_types);
  const detectedArtifacts = detectArtifacts(source, repoSnapshot);

  return detectedArtifacts.map((artifact) => {
    const mismatch = !allowedTypes.has(artifact.type);
    const metadata = metadataByPath.get(artifact.path) || {};
    return {
      id: buildArtifactId(source.id, artifact.type, artifact.path),
      source_id: source.id,
      source_name: source.name,
      source_status: source.status,
      name: metadata.name || artifact.name,
      description: metadata.description,
      color: metadata.color,
      type: artifact.type,
      type_label: artifactTypeLabel(artifact.type),
      path: artifact.path,
      repo: source.repo,
      repo_path_url: buildPathUrl(repoSnapshot.repoUrl, repoSnapshot.defaultBranch, artifact.path),
      compatibility: Object.fromEntries(
        harnesses.map((harness) => [harness.id, source.compatibility[harness.id] ?? "blank"]),
      ) as Record<string, CompatibilityValue>,
      repo_metrics: {
        stars: repoSnapshot.stars,
        forks: repoSnapshot.forks,
        license: repoSnapshot.license,
        updated_at: repoSnapshot.updatedAt,
        archived: repoSnapshot.archived,
      },
      detection: artifact.detection,
      mismatch: {
        type: mismatch,
        allowed_types: source.allowed_types,
      },
      last_checked_at: new Date().toISOString(),
    };
  });
}

export function buildTableRows(
  artifacts: ArtifactRecord[],
  harnesses: Harness[],
  type: ArtifactType,
): TableRow[] {
  const filtered = artifacts.filter((artifact) => artifact.type === type);
  return filtered.map((artifact) => ({
    id: artifact.id,
    name: artifact.name,
    description: artifact.description,
    source_description: undefined,
    color: artifact.color,
    type: artifact.type,
    type_label: artifact.type_label,
    source_id: artifact.source_id,
    source_name: artifact.source_name,
    repo: artifact.repo,
    repo_path_url: artifact.repo_path_url,
    path: artifact.path,
    stars: artifact.repo_metrics.stars,
    forks: artifact.repo_metrics.forks,
    updated_at: artifact.repo_metrics.updated_at,
    license: artifact.repo_metrics.license,
    archived: artifact.repo_metrics.archived,
    compatibility: Object.fromEntries(
      harnesses.map((harness) => [harness.id, artifact.compatibility[harness.id] ?? "blank"]),
    ) as Record<string, CompatibilityValue>,
  }));
}

export function summarizeReport({
  buildVersion,
  harnesses,
  sources,
  invalidSources,
  syncIssues,
  artifacts,
}: {
  buildVersion: string;
  harnesses: Harness[];
  sources: SourceDefinition[];
  invalidSources: Array<{ file: string; source_id: string | null; issues: string[] }>;
  syncIssues: Array<{ source_id: string; issues: string[] }>;
  artifacts: ArtifactRecord[];
}): {
  build_version: string;
  generated_at: string;
  harness_count: number;
  source_count: number;
  invalid_sources: Array<{ file: string; source_id: string | null; issues: string[] }>;
  fetch_issues: Array<{ source_id: string; issues: string[] }>;
  sync_issues: Array<{ source_id: string; issues: string[] }>;
  artifact_count: number;
  mismatch_count: number;
  mismatches: Array<{ source_id: string; type: ArtifactType; path: string; allowed_types: ArtifactType[] }>;
} {
  const mismatches = artifacts.filter((artifact) => artifact?.mismatch?.type);
  return {
    build_version: buildVersion,
    generated_at: new Date().toISOString(),
    harness_count: harnesses.length,
    source_count: sources.length,
    invalid_sources: invalidSources,
    fetch_issues: syncIssues,
    sync_issues: syncIssues,
    artifact_count: artifacts.length,
    mismatch_count: mismatches.length,
    mismatches: mismatches.map((artifact) => ({
      source_id: artifact.source_id,
      type: artifact.type,
      path: artifact.path,
      allowed_types: artifact.mismatch.allowed_types,
    })),
  };
}

export function hashSourceConfig(source: SourceDefinition): string {
  const config = {
    status: source.status,
    repo: source.repo,
    allowed_types: source.allowed_types,
    compatibility: source.compatibility,
    discovery: source.discovery,
    artifacts: source.artifacts || [],
    exclusions: source.exclusions || { paths: [], artifacts: [] },
  };

  return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}

function stripMarkdownInline(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReadmeSummary(content: string): string | null {
  let withoutFrontmatter = content;
  if (content.startsWith("---\n")) {
    const endIndex = content.indexOf("\n---\n", 4);
    if (endIndex !== -1) {
      withoutFrontmatter = content.slice(endIndex + 5);
    }
  }
  const lines = withoutFrontmatter.split("\n");
  const paragraphs: string[] = [];
  let buffer: string[] = [];
  let inCodeFence = false;

  function flushBuffer(): void {
    if (buffer.length === 0) return;
    const paragraph = stripMarkdownInline(buffer.join(" ").trim());
    buffer = [];
    if (!paragraph) return;
    if (/^(#+|\||-\s|[*+]\s|\d+\.\s)/.test(paragraph)) return;
    if (/^(License|Quick Start|Installation|Install|Usage|Contributing)\b/i.test(paragraph)) return;
    if (paragraph.length < 40) return;
    paragraphs.push(paragraph);
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;
    if (!line) {
      flushBuffer();
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flushBuffer();
      continue;
    }
    if (/^(?:!\[.*\]\(.*\)|<img\b|<p\b|<div\b|<table\b|<tr\b|<td\b|<a\b)/i.test(line)) {
      continue;
    }
    if (/^\[!\[/.test(line) || /^\[.*badge/i.test(line)) {
      continue;
    }
    if (/^[-*_]{3,}$/.test(line)) {
      flushBuffer();
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      continue;
    }

    buffer.push(line.replace(/^>\s?/, ""));
  }

  flushBuffer();
  return paragraphs[0] || null;
}

export async function readRepoReadmeSummary(source: Pick<SourceDefinition, "id">): Promise<string | null> {
  const gitDir = path.join(CACHE_REPOS_DIR, `${source.id}.git`);
  if (!(await fileExists(gitDir))) return null;

  try {
    const readmeCandidates = (
      await runGit(gitDir, ["ls-tree", "-r", "--name-only", "HEAD"])
    )
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((filePath) => /^README(?:\.[^/]+)?(?:\.md)?$/i.test(path.basename(filePath)))
      .sort((left, right) => left.length - right.length);

    const readmePath = readmeCandidates[0];
    if (!readmePath) return null;

    const content = await runGit(gitDir, ["show", `HEAD:${readmePath}`]);
    return extractReadmeSummary(content);
  } catch {
    return null;
  }
}

async function runGit(gitDir: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", [`--git-dir=${gitDir}`, ...args], {
    cwd: ROOT_DIR,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout.trim();
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeIfExists(filePath: string): Promise<void> {
  try {
    await fs.rm(filePath, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup only.
  }
}

async function withRepoLock<T>(gitDir: string, action: () => Promise<T>): Promise<T> {
  const lockDir = `${gitDir}.sync-lock`;
  const maxAttempts = 120;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await fs.mkdir(lockDir);
      try {
        return await action();
      } finally {
        await removeIfExists(lockDir);
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code !== "EEXIST") {
        throw error;
      }

      const stats = await fs.stat(lockDir).catch(() => null);
      if (stats) {
        const ageMs = Date.now() - stats.mtimeMs;
        if (ageMs > 10 * 60 * 1000) {
          await removeIfExists(lockDir);
          continue;
        }
      }

      await sleep(250);
    }
  }

  throw new Error(`Timed out waiting for repository lock: ${gitDir}`);
}

async function configureMirrorRemote(gitDir: string, source: SourceDefinition): Promise<void> {
  const remoteUrl = await runGit(gitDir, ["remote", "get-url", "origin"]).catch(() => "");
  if (remoteUrl !== source.repo) {
    const configLockPath = path.join(gitDir, "config.lock");
    if (await fileExists(configLockPath)) {
      await removeIfExists(configLockPath);
    }
    await runGit(gitDir, ["remote", "set-url", "origin", source.repo]);
  }

  await runGit(gitDir, ["config", "--unset-all", "remote.origin.fetch"]).catch(() => "");
  await runGit(gitDir, [
    "config",
    "--add",
    "remote.origin.fetch",
    "+refs/heads/*:refs/heads/*",
  ]);
  await runGit(gitDir, [
    "config",
    "--add",
    "remote.origin.fetch",
    "+refs/tags/*:refs/tags/*",
  ]);
}

async function pruneMirrorAuxiliaryRefs(gitDir: string): Promise<void> {
  const pullRefs = await runGit(gitDir, [
    "for-each-ref",
    "--format=%(refname)",
    "refs/pull",
  ]).catch(() => "");
  const refs = pullRefs.split("\n").map((ref) => ref.trim()).filter(Boolean);
  await Promise.all(refs.map((ref) => runGit(gitDir, ["update-ref", "-d", ref]).catch(() => "")));
}

async function syncRepoMirror(source: SourceDefinition): Promise<string> {
  const gitDir = path.join(CACHE_REPOS_DIR, `${source.id}.git`);
  await ensureDir(CACHE_REPOS_DIR);

  await withRepoLock(gitDir, async () => {
    if (!(await fileExists(gitDir))) {
      await execFile("git", ["clone", "--mirror", source.repo, gitDir], {
        cwd: ROOT_DIR,
        maxBuffer: 16 * 1024 * 1024,
      });
    }

    await configureMirrorRemote(gitDir, source);
    await pruneMirrorAuxiliaryRefs(gitDir);
    await runGit(gitDir, ["fetch", "--prune", "--prune-tags", "origin"]);
  });

  return gitDir;
}

async function resolveRemoteHeadSha(repoUrl: string): Promise<string | null> {
  try {
    const { stdout } = await execFile("git", ["ls-remote", repoUrl, "HEAD"], {
      cwd: ROOT_DIR,
      maxBuffer: 1024 * 1024,
    });
    const line = stdout.split("\n").find(Boolean)?.trim();
    if (!line) return null;
    const [sha] = line.split(/\s+/);
    return sha || null;
  } catch {
    return null;
  }
}

async function readMirrorDefaultBranch(gitDir: string): Promise<string> {
  try {
    const ref = await runGit(gitDir, ["symbolic-ref", "HEAD"]);
    return ref.replace(/^refs\/heads\//, "");
  } catch {
    const ref = await runGit(gitDir, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
    return ref.split("\n").find(Boolean) || "HEAD";
  }
}

async function detectLicense(gitDir: string, files: string[]): Promise<string> {
  const licenseCandidates = files.filter((filePath) =>
    /(^|\/)(LICENSE|COPYING|UNLICENSE)(\.[^/]+)?$/i.test(filePath),
  );

  if (licenseCandidates.length === 0) return "Unknown";

  try {
    const content = (
      await runGit(gitDir, ["show", `HEAD:${licenseCandidates[0]}`])
    ).slice(0, 16000).toLowerCase();

    if (content.includes("mit license")) return "MIT";
    if (content.includes("apache license") && content.includes("version 2.0")) return "Apache-2.0";
    if (content.includes("bsd 3-clause")) return "BSD-3-Clause";
    if (content.includes("bsd 2-clause")) return "BSD-2-Clause";
    if (content.includes("gnu general public license") && content.includes("version 3")) {
      return "GPL-3.0";
    }
    if (content.includes("gnu affero general public license")) return "AGPL-3.0";
    if (content.includes("mozilla public license")) return "MPL-2.0";
    if (content.includes("isc license")) return "ISC";
    if (content.includes("the unlicense")) return "Unlicense";
  } catch {
    return "Unknown";
  }

  return path.basename(licenseCandidates[0]);
}

async function detectLicenseAtRef(gitDir: string, files: string[], gitRef: string): Promise<string> {
  const licenseCandidates = files.filter((filePath) =>
    /(^|\/)(LICENSE|COPYING|UNLICENSE)(\.[^/]+)?$/i.test(filePath),
  );

  if (licenseCandidates.length === 0) return "Unknown";

  try {
    const content = (
      await runGit(gitDir, ["show", `${gitRef}:${licenseCandidates[0]}`])
    ).slice(0, 16000).toLowerCase();

    if (content.includes("mit license")) return "MIT";
    if (content.includes("apache license") && content.includes("version 2.0")) return "Apache-2.0";
    if (content.includes("bsd 3-clause")) return "BSD-3-Clause";
    if (content.includes("bsd 2-clause")) return "BSD-2-Clause";
    if (content.includes("gnu general public license") && content.includes("version 3")) {
      return "GPL-3.0";
    }
    if (content.includes("gnu affero general public license")) return "AGPL-3.0";
    if (content.includes("mozilla public license")) return "MPL-2.0";
    if (content.includes("isc license")) return "ISC";
    if (content.includes("the unlicense")) return "Unlicense";
  } catch {
    return "Unknown";
  }

  return path.basename(licenseCandidates[0]);
}

export async function listSnapshotDateStamps(): Promise<string[]> {
  if (!(await fileExists(SNAPSHOT_ROOT_DIR))) return [];

  const yearEntries = await fs.readdir(SNAPSHOT_ROOT_DIR, { withFileTypes: true });
  const dates: string[] = [];

  for (const yearEntry of yearEntries) {
    if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) continue;
    const yearDir = path.join(SNAPSHOT_ROOT_DIR, yearEntry.name);
    const monthEntries = await fs.readdir(yearDir, { withFileTypes: true });

    for (const monthEntry of monthEntries) {
      if (!monthEntry.isDirectory() || !/^\d{2}$/.test(monthEntry.name)) continue;
      const monthDir = path.join(yearDir, monthEntry.name);
      const dayEntries = await fs.readdir(monthDir, { withFileTypes: true });

      for (const dayEntry of dayEntries) {
        if (!dayEntry.isDirectory() || !/^\d{2}$/.test(dayEntry.name)) continue;
        const dateStamp = `${yearEntry.name}-${monthEntry.name}-${dayEntry.name}`;
        if (isValidDateStamp(dateStamp)) {
          dates.push(dateStamp);
        }
      }
    }
  }

  return dates.sort();
}

export async function updateLatestSnapshot(
  snapshotDir: string,
  manifestOverride?: SnapshotManifest,
): Promise<void> {
  const manifest =
    manifestOverride ??
    (await readJsonFile<SnapshotManifest>(path.join(snapshotDir, "manifest.json")));
  const snapshotSources = await loadSnapshotSourceRecords(snapshotDir);

  await fs.rm(LATEST_SNAPSHOT_DIR, { recursive: true, force: true });
  await ensureDir(LATEST_SNAPSHOT_DIR);
  await writeJson(path.join(LATEST_SNAPSHOT_DIR, "manifest.json"), manifest);

  await Promise.all(
    snapshotSources.map((source) =>
      writeJson(path.join(LATEST_SNAPSHOT_DIR, `${source.source_id}.json`), source),
    ),
  );
}

export async function loadSnapshotSourceRecordFromDir(
  snapshotDir: string,
  sourceId: string,
): Promise<SnapshotSourceRecord | null> {
  const filePath = path.join(snapshotDir, `${sourceId}.json`);
  if (!(await fileExists(filePath))) return null;
  const record = await readJsonFile<OnDiskSnapshotSourceRecord>(filePath);
  return hydrateSnapshotSourceRecord(record);
}

export async function listSourceHistoryDates(sourceId: string): Promise<string[]> {
  const dates = await listSnapshotDateStamps();
  const result: string[] = [];

  for (const date of dates) {
    const snapshotDir = getSnapshotDirForDate(date);
    if (await loadSnapshotSourceRecordFromDir(snapshotDir, sourceId)) {
      result.push(date);
    }
  }

  return result;
}

export async function loadLatestSourceRecordBeforeDate(
  sourceId: string,
  dateStamp: string,
): Promise<SnapshotSourceRecord | null> {
  const dates = await listSnapshotDateStamps();

  for (let index = dates.length - 1; index >= 0; index -= 1) {
    const candidateDate = dates[index];
    if (candidateDate >= dateStamp) continue;
    const snapshotDir = getSnapshotDirForDate(candidateDate);
    const loaded = await loadSnapshotSourceRecordFromDir(snapshotDir, sourceId);
    if (loaded) return loaded;
  }

  return null;
}

async function resolveSnapshotGitRef(
  gitDir: string,
  snapshotDate: string | undefined,
): Promise<{ gitRef: string; currentSha: string; defaultBranch: string; historical: boolean }> {
  const defaultBranch = await readMirrorDefaultBranch(gitDir);
  const branchRef = `refs/heads/${defaultBranch}`;

  if (!snapshotDate) {
    const currentSha = await runGit(gitDir, ["rev-parse", "HEAD"]);
    return { gitRef: "HEAD", currentSha, defaultBranch, historical: false };
  }

  const revList = await runGit(gitDir, [
    "rev-list",
    "-1",
    `--before=${snapshotDate}T23:59:59Z`,
    branchRef,
  ]);

  if (!revList) {
    throw new Error(`No commit found on or before ${snapshotDate} for ${defaultBranch}`);
  }

  return {
    gitRef: revList,
    currentSha: revList,
    defaultBranch,
    historical: true,
  };
}

export async function resolveSourceFirstCommitDate(source: SourceDefinition): Promise<string> {
  const gitDir = await syncRepoMirror(source);
  const defaultBranch = await readMirrorDefaultBranch(gitDir);
  const branchRef = `refs/heads/${defaultBranch}`;
  const rootsOutput = await runGit(gitDir, ["rev-list", "--max-parents=0", branchRef]);
  const rootCommit = rootsOutput.split("\n").find(Boolean);
  if (!rootCommit) {
    throw new Error(`Unable to determine first commit for ${source.id}`);
  }

  const committedAt = await runGit(gitDir, ["show", "-s", "--format=%cI", rootCommit]);
  return new Date(committedAt).toISOString().slice(0, 10);
}

export function canReusePreviousSnapshotSource(args: {
  previousSnapshotSource?: SnapshotSourceRecord | null;
  snapshotDate?: string;
  sourceConfigHash: string;
  now?: Date;
}): boolean {
  const previous = args.previousSnapshotSource;
  if (!previous) return false;
  if (args.snapshotDate !== getSnapshotDateStamp(args.now)) return false;
  return (
    previous.source_config_hash === args.sourceConfigHash &&
    previous.detector_version === DETECTOR_VERSION
  );
}

export function buildReusedSnapshotSourceRecord(args: {
  previousSnapshotSource: SnapshotSourceRecord;
  currentSha: string;
  repoMetrics?: SnapshotSourceRecord["repo_metrics"];
  snapshotDate?: string;
  syncedAt?: string;
}): SnapshotSourceRecord {
  const previous = args.previousSnapshotSource;
  const repoMetrics = args.repoMetrics ?? previous.repo_metrics;

  return {
    ...previous,
    snapshot_date: args.snapshotDate ?? previous.snapshot_date,
    first_commit_date: previous.first_commit_date,
    carry_forward_from: previous.carry_forward_from ?? previous.snapshot_date,
    previous_sha: previous.current_sha,
    current_sha: args.currentSha,
    mode: "unchanged",
    changed_files: [],
    synced_at: args.syncedAt ?? new Date().toISOString(),
    repo_metrics: repoMetrics,
    artifacts: previous.artifacts.map((artifact) => ({
      ...artifact,
      repo_metrics: {
        ...artifact.repo_metrics,
        stars: repoMetrics.stars,
        forks: repoMetrics.forks,
        license: repoMetrics.license,
        updated_at: repoMetrics.updated_at,
        archived: repoMetrics.archived,
      },
      last_checked_at: args.syncedAt ?? new Date().toISOString(),
    })),
    issues: [],
  };
}

export function buildThinSnapshotSourceRecord(
  snapshotSource: SnapshotSourceRecord,
): ThinSnapshotSourceRecord {
  if (!snapshotSource.snapshot_date) {
    throw new Error(`Cannot build thin snapshot for ${snapshotSource.source_id} without snapshot_date.`);
  }
  const carryForwardFrom = snapshotSource.carry_forward_from ?? snapshotSource.snapshot_date;

  return {
    version: 2,
    source_id: snapshotSource.source_id,
    source_name: snapshotSource.source_name,
    source_status: snapshotSource.source_status,
    snapshot_date: snapshotSource.snapshot_date,
    first_commit_date: snapshotSource.first_commit_date,
    repo: snapshotSource.repo,
    default_branch: snapshotSource.default_branch,
    previous_sha: snapshotSource.previous_sha,
    current_sha: snapshotSource.current_sha,
    mode: "unchanged",
    changed_files: [],
    source_config_hash: snapshotSource.source_config_hash,
    detector_version: snapshotSource.detector_version,
    synced_at: snapshotSource.synced_at,
    repo_metrics: snapshotSource.repo_metrics,
    artifact_count: snapshotSource.artifacts.length,
    mismatch_count: snapshotSource.artifacts.filter((artifact) => artifact.mismatch.type).length,
    carry_forward_from: carryForwardFrom,
    issues: snapshotSource.issues,
  };
}

function isThinSnapshotSourceRecord(record: unknown): record is ThinSnapshotSourceRecord {
  return (
    Boolean(record) &&
    typeof record === "object" &&
    (record as { version?: number }).version === 2 &&
    (record as { mode?: string }).mode === "unchanged" &&
    typeof (record as { carry_forward_from?: string }).carry_forward_from === "string"
  );
}

export async function pruneSnapshotSources(
  activeSourceIds: string[],
  snapshotDir: string,
): Promise<void> {
  if (!(await fileExists(snapshotDir))) return;

  const allowed = new Set(activeSourceIds.map((sourceId) => `${sourceId}.json`));
  allowed.add("manifest.json");
  const entries = await fs.readdir(snapshotDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !allowed.has(entry.name))
      .map((entry) => fs.unlink(path.join(snapshotDir, entry.name))),
  );
}

async function hydrateSnapshotSourceRecord(
  record: OnDiskSnapshotSourceRecord,
): Promise<SnapshotSourceRecord> {
  if (!isThinSnapshotSourceRecord(record)) {
    return record;
  }

  const baseSnapshotDir = getSnapshotDirForDate(record.carry_forward_from);
  const baseRecord = await loadSnapshotSourceRecordFromDir(baseSnapshotDir, record.source_id);
  if (!baseRecord) {
    throw new Error(
      `Unable to hydrate thin snapshot for ${record.source_id}: base snapshot ${record.carry_forward_from} is missing.`,
    );
  }

  return {
    ...baseRecord,
    source_name: record.source_name,
    source_status: record.source_status,
    snapshot_date: record.snapshot_date,
    first_commit_date: record.first_commit_date ?? baseRecord.first_commit_date,
    carry_forward_from: record.carry_forward_from,
    repo: record.repo,
    default_branch: record.default_branch,
    previous_sha: record.previous_sha,
    current_sha: record.current_sha,
    mode: "unchanged",
    changed_files: [],
    source_config_hash: record.source_config_hash,
    detector_version: record.detector_version,
    synced_at: record.synced_at,
    repo_metrics: record.repo_metrics,
    issues: record.issues,
  };
}

export async function writeSnapshotSourceRecord(
  snapshotDir: string,
  snapshotSource: SnapshotSourceRecord,
): Promise<void> {
  const targetDate = path.relative(SNAPSHOT_ROOT_DIR, snapshotDir).split(path.sep).join("-");
  const filePath = path.join(snapshotDir, `${snapshotSource.source_id}.json`);

  if (isValidDateStamp(targetDate) && snapshotSource.mode === "unchanged") {
    await writeJson(filePath, buildThinSnapshotSourceRecord(snapshotSource));
    return;
  }

  await writeJson(filePath, snapshotSource);
}

export async function buildSnapshotSourceRecord(
  source: SourceDefinition,
  harnesses: Harness[],
  options: {
    firstCommitDate?: string;
    previousSnapshotSource?: SnapshotSourceRecord | null;
    snapshotDate?: string;
  },
): Promise<SnapshotSourceRecord> {
  const previous = options.previousSnapshotSource ?? null;
  const sourceConfigHash = hashSourceConfig(source);
  if (
    canReusePreviousSnapshotSource({
      previousSnapshotSource: previous,
      snapshotDate: options.snapshotDate,
      sourceConfigHash,
    })
  ) {
    const remoteHeadSha = await resolveRemoteHeadSha(source.repo);
    if (previous && remoteHeadSha && remoteHeadSha === previous.current_sha) {
      const githubMetadata = await fetchGithubRepoMetadata(source.repo);
      return buildReusedSnapshotSourceRecord({
        previousSnapshotSource: previous,
        currentSha: remoteHeadSha,
        repoMetrics: {
          ...previous.repo_metrics,
          stars: githubMetadata?.stars ?? previous.repo_metrics.stars,
          forks: githubMetadata?.forks ?? previous.repo_metrics.forks,
        },
        snapshotDate: options.snapshotDate,
      });
    }
  }

  const gitDir = await syncRepoMirror(source);
  const { gitRef, currentSha, defaultBranch, historical } = await resolveSnapshotGitRef(
    gitDir,
    options.snapshotDate,
  );
  const filesOutput = await runGit(gitDir, ["ls-tree", "-r", "--name-only", gitRef]);
  const files = filesOutput ? filesOutput.split("\n").filter(Boolean).sort() : [];
  const updatedAt = await runGit(gitDir, ["log", "-1", "--format=%cI", gitRef]);
  const license = historical
    ? await detectLicenseAtRef(gitDir, files, gitRef)
    : await detectLicense(gitDir, files);
  const githubMetadata = await fetchGithubRepoMetadata(source.repo);
  const firstCommitDate =
    previous?.first_commit_date ?? options.firstCommitDate ?? (await resolveSourceFirstCommitDate(source));

  let mode: SyncMode = "full";
  if (
    previous &&
    previous.current_sha === currentSha &&
    previous.source_config_hash === sourceConfigHash &&
    previous.detector_version === DETECTOR_VERSION
  ) {
    mode = "unchanged";
  } else if (
    previous &&
    previous.current_sha &&
    previous.source_config_hash === sourceConfigHash &&
    previous.detector_version === DETECTOR_VERSION
  ) {
    mode = "delta";
  }

  let changedFiles = files;
  if (mode === "unchanged") {
    changedFiles = [];
  } else if (mode === "delta" && previous?.current_sha) {
    const diffOutput = await runGit(gitDir, [
      "diff",
      "--name-only",
      previous.current_sha,
      currentSha,
    ]);
    changedFiles = diffOutput ? diffOutput.split("\n").filter(Boolean).sort() : [];
  }

  const repoSnapshot: RepoSnapshot = {
    defaultBranch,
    repoUrl: source.repo,
    stars: githubMetadata?.stars ?? 0,
    forks: githubMetadata?.forks ?? 0,
    license,
    updatedAt,
    archived: source.status === "archived",
    files,
  };

  const detectedArtifacts = detectArtifacts(source, repoSnapshot);
  const metadataByPath = new Map<string, ArtifactContentMetadata>(
    await Promise.all(
      detectedArtifacts.map(async (artifact) => [
        artifact.path,
        await extractArtifactMetadataFromGit({
          gitDir,
          gitRef,
          path: artifact.path,
          type: artifact.type,
        }),
      ] as const),
    ),
  );

  const artifacts = buildArtifactRecords(source, repoSnapshot, harnesses, metadataByPath).sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );

  return {
    version: 1,
    source_id: source.id,
    source_name: source.name,
    source_status: source.status,
    snapshot_date: options.snapshotDate,
    first_commit_date: firstCommitDate,
    carry_forward_from:
      mode === "unchanged" ? previous?.carry_forward_from ?? previous?.snapshot_date : undefined,
    repo: source.repo,
    default_branch: defaultBranch,
    previous_sha: previous?.current_sha ?? null,
    current_sha: currentSha,
    mode,
    changed_files: changedFiles,
    source_config_hash: sourceConfigHash,
    detector_version: DETECTOR_VERSION,
    synced_at: new Date().toISOString(),
    repo_metrics: {
      stars: githubMetadata?.stars ?? 0,
      forks: githubMetadata?.forks ?? 0,
      license,
      updated_at: updatedAt,
      archived: source.status === "archived",
    },
    artifacts,
    issues: [],
  };
}

export async function loadDaySnapshotSourceRecords(
  snapshotDir: string,
): Promise<SnapshotSourceRecord[]> {
  if (!(await fileExists(snapshotDir))) return [];

  const entries = await fs.readdir(snapshotDir, { withFileTypes: true });
  const files = entries
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "manifest.json",
    )
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    files.map(async (fileName) => {
      const record = await readJsonFile<OnDiskSnapshotSourceRecord>(path.join(snapshotDir, fileName));
      return hydrateSnapshotSourceRecord(record);
    }),
  );
}

export async function loadSnapshotSourceRecords(
  snapshotDir: string,
): Promise<SnapshotSourceRecord[]> {
  const targetDate = path.relative(SNAPSHOT_ROOT_DIR, snapshotDir).split(path.sep).join("-");
  if (!isValidDateStamp(targetDate)) {
    return loadDaySnapshotSourceRecords(snapshotDir);
  }

  const dates = (await listSnapshotDateStamps()).filter((date) => date <= targetDate);
  const records = new Map<string, SnapshotSourceRecord>();

  for (const date of dates) {
    const dayEntries = await loadDaySnapshotSourceRecords(getSnapshotDirForDate(date));
    for (const entry of dayEntries) {
      records.set(entry.source_id, entry);
    }
  }

  return [...records.values()].sort((left, right) =>
    left.source_id.localeCompare(right.source_id, "en", { sensitivity: "base" }),
  );
}

export function summarizeSnapshotManifest({
  harnesses,
  validSources,
  invalidSources,
  syncIssues,
  snapshotSources,
}: {
  harnesses: Harness[];
  validSources: SourceDefinition[];
  invalidSources: Array<{ file: string; source_id: string | null; issues: string[] }>;
  syncIssues: Array<{ source_id: string; issues: string[] }>;
  snapshotSources: SnapshotSourceRecord[];
}): SnapshotManifest {
  const artifactCount = snapshotSources.reduce((sum, source) => sum + source.artifacts.length, 0);
  const mismatchCount = snapshotSources.reduce(
    (sum, source) => sum + source.artifacts.filter((artifact) => artifact.mismatch.type).length,
    0,
  );

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    harness_count: harnesses.length,
    source_count: validSources.length,
    invalid_sources: invalidSources,
    sync_issues: syncIssues,
    artifact_count: artifactCount,
    mismatch_count: mismatchCount,
    sources: snapshotSources.map((source) => ({
      source_id: source.source_id,
      current_sha: source.current_sha,
      previous_sha: source.previous_sha,
      mode: source.mode,
      artifact_count: source.artifacts.length,
      changed_file_count: source.changed_files.length,
    })),
  };
}
