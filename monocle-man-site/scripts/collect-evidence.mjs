import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const evidenceDir = process.env.BENCHMARK_EVIDENCE_DIR || "benchmark-evidence";
const artifactName = process.env.BENCHMARK_ARTIFACT_NAME || "monocle-man-benchmark-evidence";
const generatedAt = new Date().toISOString();
const candidateSha = process.env.CANDIDATE_SHA || process.env.GITHUB_SHA || null;
const candidateBranch = process.env.CANDIDATE_BRANCH || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "preview-monocle-man-netlify";
const playwrightExitCode = Number(process.env.PLAYWRIGHT_EXIT_CODE || "0");

const requiredJson = [
  "run-metadata.json",
  "source-metadata.json",
  "test-results.json",
  "console-errors.json",
  "network-errors.json",
  "accessibility.json",
  "interactions.json",
  "image-status.json",
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
  "image-status.json",
  "deployment-metadata.json",
  "source/index.html",
  "screenshots/desktop.png",
  "screenshots/mobile.png",
  "screenshots/desktop-hero.png",
  "screenshots/mobile-hero.png",
  "screenshots/desktop-full.png",
  "screenshots/mobile-full.png",
  "screenshots/desktop-lines.png",
  "screenshots/mobile-lines.png",
  "screenshots/desktop-modal.png",
  "screenshots/mobile-menu.png",
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

function pngDimensions(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".png") return null;
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
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
ensureDir("source");
if (fs.existsSync("index.html")) {
  fs.copyFileSync("index.html", path.join(evidenceDir, "source/index.html"));
}

const runMetadata = {
  schema: "chatgpt_lab.github_actions_run.v1",
  repository: process.env.GITHUB_REPOSITORY || "grahama1970/snippets",
  workflow: process.env.GITHUB_WORKFLOW || "monocle-man-benchmark",
  run_id: process.env.GITHUB_RUN_ID || null,
  run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
  event_name: process.env.GITHUB_EVENT_NAME || null,
  actions_sha: process.env.GITHUB_SHA || null,
  head_sha: candidateSha,
  branch: candidateBranch,
  artifact_name: artifactName,
  generated_at: generatedAt
};
writeJson("run-metadata.json", runMetadata);

const sourceMetadata = {
  schema: "chatgpt_lab.benchmark_source.v1",
  repository: "grahama1970/snippets",
  branch: candidateBranch,
  path: "monocle-man-site/",
  commit: candidateSha,
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

const placeholderShape = {
  "test-results.json": { errors: ["test-results.json was not produced before evidence collection"] },
  "console-errors.json": { errors: [{ text: "console-errors.json was not produced before evidence collection" }] },
  "network-errors.json": { errors: [{ severity: "error", url: "network-errors.json was not produced before evidence collection" }] },
  "accessibility.json": { scans: [], errors: ["accessibility.json was not produced before evidence collection"] },
  "interactions.json": { interactions: [], errors: ["interactions.json was not produced before evidence collection"] },
  "image-status.json": { images: [], errors: ["image-status.json was not produced before evidence collection"] }
};

for (const [relativePath, shape] of Object.entries(placeholderShape)) {
  if (!exists(relativePath)) {
    writeJson(relativePath, {
      schema: `chatgpt_lab.${relativePath.replace(".json", "").replaceAll("-", "_")}.v1`,
      generated_at: generatedAt,
      missing: true,
      ...shape
    });
  }
}

const consoleReport = readJson("console-errors.json", { errors: [{ text: "console-errors.json unreadable" }] });
const networkReport = readJson("network-errors.json", { errors: [{ severity: "error", url: "network-errors.json unreadable" }] });
const accessibilityReport = readJson("accessibility.json", { scans: [] });
const interactionReport = readJson("interactions.json", { interactions: [] });
const imageReport = readJson("image-status.json", { images: [] });
const testResults = readJson("test-results.json", { stats: { unexpected: 1 } });
const deployment = readJson("deployment-metadata.json", { status: "NOT_ESTABLISHED" });

const requiredArtifactsBeforeVerdict = requiredArtifacts.filter(relativePath => !["artifact-manifest.json", "verdict.json"].includes(relativePath));
const missingArtifacts = requiredArtifactsBeforeVerdict.filter(relativePath => !exists(relativePath) || fs.statSync(path.join(evidenceDir, relativePath)).size === 0);
const unexpectedConsoleErrors = Array.isArray(consoleReport.errors)
  ? consoleReport.errors.filter(error => !isExpectedStaticServeConsoleMiss(error))
  : [{ text: "console-errors.json errors field is invalid" }];
const blockingNetworkErrors = Array.isArray(networkReport.errors)
  ? networkReport.errors.filter(error => error.severity === "error")
  : [{ severity: "error", url: "network-errors.json errors field is invalid" }];
const failedInteractions = Array.isArray(interactionReport.interactions)
  ? interactionReport.interactions.filter(entry => entry.verdict === "FAIL" || entry.ok === false)
  : [{ id: "interactions-field-invalid" }];
const failedImages = Array.isArray(imageReport.images)
  ? imageReport.images.filter(entry => entry.verdict !== "PASS")
  : [{ id: "images-field-invalid" }];
const blockingA11yViolations = Array.isArray(accessibilityReport.scans)
  ? accessibilityReport.scans.flatMap(scan => scan?.result?.violations || [])
    .filter(violation => violation.impact === "critical" || violation.impact === "serious")
  : [{ id: "accessibility-scans-invalid", impact: "critical" }];

const blockingErrors = [];
if (playwrightExitCode !== 0) blockingErrors.push(`playwright_exit_code=${playwrightExitCode}`);
if (!candidateSha) blockingErrors.push("candidate_commit_missing");
if (unexpectedConsoleErrors.length > 0) blockingErrors.push(`unexpected_console_errors=${unexpectedConsoleErrors.length}`);
if (blockingNetworkErrors.length > 0) blockingErrors.push(`same_origin_network_errors=${blockingNetworkErrors.length}`);
if (failedInteractions.length > 0) blockingErrors.push(`failed_interactions=${failedInteractions.length}`);
if (failedImages.length > 0) blockingErrors.push(`failed_images=${failedImages.length}`);
if (blockingA11yViolations.length > 0) blockingErrors.push(`blocking_accessibility_violations=${blockingA11yViolations.length}`);
if (missingArtifacts.length > 0) blockingErrors.push(`missing_required_artifacts=${missingArtifacts.join(",")}`);
if (runMetadata.head_sha !== sourceMetadata.commit) blockingErrors.push("run_head_sha_does_not_match_source_commit");

const warnings = [];
if (deployment.status !== "PROVEN") warnings.push("deployment_not_established_no_live_site_claim");
if (!runMetadata.run_id) warnings.push("github_run_id_missing_local_or_non_actions_execution");
const expectedTransformMisses = Array.isArray(consoleReport.errors)
  ? consoleReport.errors.filter(isExpectedStaticServeConsoleMiss).length
  : 0;
if (expectedTransformMisses > 0) warnings.push(`expected_static_netlify_transform_misses=${expectedTransformMisses}`);

const playwrightStatus = Number(testResults?.stats?.unexpected || 0) === 0 && playwrightExitCode === 0 ? "passed" : "failed";
const verdict = {
  schema: "chatgpt_lab.benchmark_verdict.v1",
  generated_at: generatedAt,
  scope: "benchmark_ci_only",
  live_site_claim: false,
  verdict: blockingErrors.length === 0 ? "PASS" : "NEEDS_CHANGES",
  blocking_errors: blockingErrors,
  warnings,
  required_artifacts_present: missingArtifacts.length === 0,
  head_sha_matches_candidate: Boolean(runMetadata.head_sha && sourceMetadata.commit && runMetadata.head_sha === sourceMetadata.commit),
  playwright_exit_code: playwrightExitCode,
  playwright_status: playwrightStatus,
  metrics: {
    unexpected_console_errors: unexpectedConsoleErrors.length,
    expected_static_transform_misses: expectedTransformMisses,
    blocking_network_errors: blockingNetworkErrors.length,
    failed_interactions: failedInteractions.length,
    failed_images: failedImages.length,
    blocking_accessibility_violations: blockingA11yViolations.length
  }
};
writeJson("verdict.json", verdict);

const files = walk(evidenceDir)
  .filter(filePath => path.basename(filePath) !== "artifact-manifest.json")
  .sort()
  .map(filePath => {
    const stat = fs.statSync(filePath);
    const dimensions = pngDimensions(filePath);
    return {
      path: path.relative(evidenceDir, filePath).replaceAll(path.sep, "/"),
      size: stat.size,
      sha256: fileSha256(filePath),
      ...(dimensions || {})
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
if (blockingErrors.length > 0) {
  console.error(`Benchmark evidence blockers: ${blockingErrors.join(", ")}`);
  process.exitCode = 1;
}
