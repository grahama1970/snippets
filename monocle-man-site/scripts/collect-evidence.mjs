import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const evidenceDir = process.env.BENCHMARK_EVIDENCE_DIR || "benchmark-evidence";
const artifactName = process.env.BENCHMARK_ARTIFACT_NAME || "monocle-man-benchmark-evidence";
const generatedAt = new Date().toISOString();

const requiredJson = [
  "run-metadata.json",
  "source-metadata.json",
  "test-results.json",
  "console-errors.json",
  "network-errors.json",
  "accessibility.json",
  "interactions.json",
  "deployment-metadata.json",
  "artifact-manifest.json",
  "verdict.json"
];

const requiredArtifacts = [
  "run-metadata.json",
  "source-metadata.json",
  "test-results.json",
  "console-errors.json",
  "network-errors.json",
  "accessibility.json",
  "interactions.json",
  "deployment-metadata.json",
  "screenshots/desktop.png",
  "screenshots/mobile.png",
  "artifact-manifest.json",
  "verdict.json"
];

function ensureDir(relativePath = "") {
  fs.mkdirSync(path.join(evidenceDir, relativePath), { recursive: true });
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(evidenceDir, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(relativePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(evidenceDir, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(evidenceDir, relativePath));
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      entries.push(...walk(fullPath));
    } else {
      entries.push(fullPath);
    }
  }
  return entries;
}

function isExpectedStaticServeConsoleMiss(error) {
  return typeof error?.text === "string"
    && error.text.includes("Failed to load resource")
    && typeof error?.location?.url === "string"
    && error.location.url.includes("/.netlify/images?");
}

ensureDir("screenshots");

const runMetadata = {
  schema: "chatgpt_lab.github_actions_run.v1",
  repository: process.env.GITHUB_REPOSITORY || "grahama1970/snippets",
  workflow: process.env.GITHUB_WORKFLOW || "monocle-man-benchmark",
  run_id: process.env.GITHUB_RUN_ID || null,
  run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
  head_sha: process.env.GITHUB_SHA || null,
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "preview-monocle-man-netlify",
  artifact_name: artifactName,
  generated_at: generatedAt
};
writeJson("run-metadata.json", runMetadata);

const sourceMetadata = {
  schema: "chatgpt_lab.benchmark_source.v1",
  repository: "grahama1970/snippets",
  branch: "preview-monocle-man-netlify",
  path: "monocle-man-site/",
  commit: process.env.GITHUB_SHA || null,
  generated_at: generatedAt
};
writeJson("source-metadata.json", sourceMetadata);

if (!exists("deployment-metadata.json")) {
  writeJson("deployment-metadata.json", {
    schema: "chatgpt_lab.deployment_proof.v1",
    provider: "netlify",
    deployment_id: null,
    url: null,
    commit: null,
    branch: sourceMetadata.branch,
    status: "NOT_ESTABLISHED",
    generated_at: generatedAt
  });
}

for (const relativePath of [
  "test-results.json",
  "console-errors.json",
  "network-errors.json",
  "accessibility.json",
  "interactions.json"
]) {
  if (!exists(relativePath)) {
    writeJson(relativePath, {
      schema: `chatgpt_lab.${relativePath.replace(".json", "").replaceAll("-", "_")}.v1`,
      generated_at: generatedAt,
      missing: true,
      errors: [`${relativePath} was not produced before evidence collection`]
    });
  }
}

const consoleReport = readJson("console-errors.json", { errors: [{ text: "console-errors.json unreadable" }] });
const networkReport = readJson("network-errors.json", { errors: [{ severity: "error", url: "network-errors.json unreadable" }] });
const testResults = readJson("test-results.json", { status: "unknown" });
const deployment = readJson("deployment-metadata.json", { status: "NOT_ESTABLISHED" });

const requiredArtifactsBeforeVerdict = requiredArtifacts.filter(relativePath => !["artifact-manifest.json", "verdict.json"].includes(relativePath));
const missingArtifacts = requiredArtifactsBeforeVerdict.filter(relativePath => !exists(relativePath) || fs.statSync(path.join(evidenceDir, relativePath)).size === 0);

const blockingErrors = [];
if (Number(process.env.PLAYWRIGHT_EXIT_CODE || "0") !== 0) {
  blockingErrors.push(`playwright_exit_code=${process.env.PLAYWRIGHT_EXIT_CODE}`);
}
if (Array.isArray(consoleReport.errors) && consoleReport.errors.filter(error => !isExpectedStaticServeConsoleMiss(error)).length > 0) {
  blockingErrors.push("console_errors_present");
}
if (Array.isArray(networkReport.errors) && networkReport.errors.some(error => error.severity === "error")) {
  blockingErrors.push("same_origin_network_errors_present");
}
if (missingArtifacts.length > 0) {
  blockingErrors.push(`missing_required_artifacts=${missingArtifacts.join(",")}`);
}
if (runMetadata.head_sha && sourceMetadata.commit && runMetadata.head_sha !== sourceMetadata.commit) {
  blockingErrors.push("run_head_sha_does_not_match_source_commit");
}

const warnings = [];
if (deployment.status !== "PROVEN") {
  warnings.push("deployment_not_established_no_live_site_claim");
}
if (!runMetadata.run_id) {
  warnings.push("github_run_id_missing_local_or_non_actions_execution");
}

const verdict = {
  schema: "chatgpt_lab.benchmark_verdict.v1",
  generated_at: generatedAt,
  scope: "benchmark_ci_only",
  live_site_claim: false,
  verdict: blockingErrors.length === 0 ? "PASS" : "NEEDS_CHANGES",
  blocking_errors: blockingErrors,
  warnings,
  required_artifacts_present: missingArtifacts.length === 0,
  head_sha_matches_candidate: !runMetadata.head_sha || !sourceMetadata.commit || runMetadata.head_sha === sourceMetadata.commit,
  playwright_exit_code: Number(process.env.PLAYWRIGHT_EXIT_CODE || "0"),
  playwright_status: testResults.status || null
};
writeJson("verdict.json", verdict);

const files = walk(evidenceDir)
  .filter(filePath => path.basename(filePath) !== "artifact-manifest.json")
  .sort()
  .map(filePath => {
    const stat = fs.statSync(filePath);
    return {
      path: path.relative(evidenceDir, filePath).replaceAll(path.sep, "/"),
      size: stat.size,
      sha256: fileSha256(filePath)
    };
  });

writeJson("artifact-manifest.json", {
  schema: "chatgpt_lab.artifact_manifest.v1",
  generated_at: generatedAt,
  artifact_name: artifactName,
  files
});

const unreadable = requiredJson.filter(relativePath => {
  try {
    JSON.parse(fs.readFileSync(path.join(evidenceDir, relativePath), "utf8"));
    return false;
  } catch {
    return true;
  }
});

if (unreadable.length > 0) {
  console.error(`Unparseable JSON artifacts: ${unreadable.join(", ")}`);
  process.exitCode = 1;
}
