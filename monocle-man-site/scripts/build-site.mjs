import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("index.html");
const outputDir = path.resolve("dist");
const outputPath = path.join(outputDir, "index.html");

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing source HTML: ${sourcePath}`);
}

let html = fs.readFileSync(sourcePath, "utf8");

// The supplied video does not expose a reliable max-resolution thumbnail. Use
// the stable SD frame consistently for metadata, the hero, and its fallback.
html = html.replaceAll(
  "https://i.ytimg.com/vi/NBxByrz5BRE/maxresdefault.jpg",
  "https://i.ytimg.com/vi/NBxByrz5BRE/sddefault.jpg"
);

const contrastReplacements = [
  [
    ".section-no{position:absolute;top:2.5rem;right:var(--gutter);font:600 .62rem/1 var(--ui);letter-spacing:.18em;color:var(--muted)}",
    ".section-no{position:absolute;top:2.5rem;right:var(--gutter);font:600 .62rem/1 var(--ui);letter-spacing:.18em;color:#6b6459}"
  ],
  [
    ".rules .section-no{color:rgba(255,255,255,.45)}",
    ".rules .section-no{color:var(--gold2)}"
  ]
];

for (const [before, after] of contrastReplacements) {
  if (!html.includes(before)) {
    throw new Error(`Expected contrast source was not found: ${before}`);
  }
  html = html.replace(before, after);
}

const imageIds = ["hero", "quote-1", "quote-2", "quote-3", "verdict-background"];
let imageIndex = 0;

html = html.replace(/<img\b[^>]*data-remote="[^"]+"[^>]*>/g, tag => {
  const remoteMatch = tag.match(/data-remote="([^"]+)"/);
  if (!remoteMatch) return tag;
  if (imageIndex >= imageIds.length) {
    throw new Error("More benchmark media images were found than expected");
  }

  const remoteUrl = remoteMatch[1].replace("maxresdefault", "sddefault");
  let output = tag
    .replace(/src="[^"]+"/, `src="${remoteUrl}"`)
    .replace(/data-remote="[^"]+"/, `data-remote="${remoteUrl}"`)
    .replace(/\sloading="lazy"/g, "")
    .replace(/\sloading="eager"/g, "")
    .replace(/\sfetchpriority="high"/g, "")
    .replace(/\sdecoding="async"/g, "")
    .replace(/\sdata-benchmark-image="[^"]+"/g, "");

  output = output.slice(0, -1)
    + ` data-benchmark-image="${imageIds[imageIndex]}" loading="eager" decoding="async">`;
  imageIndex += 1;
  return output;
});

if (imageIndex !== imageIds.length) {
  throw new Error(`Expected ${imageIds.length} benchmark images, found ${imageIndex}`);
}
if (html.includes("/.netlify/images?")) {
  throw new Error("Built HTML still contains a Netlify Image CDN transform URL");
}
for (const imageId of imageIds) {
  if (!html.includes(`data-benchmark-image="${imageId}"`)) {
    throw new Error(`Built HTML is missing benchmark image id: ${imageId}`);
  }
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, html);

console.log(JSON.stringify({
  schema: "chatgpt_lab.monocle_man_build.v1",
  source: path.relative(process.cwd(), sourcePath),
  output: path.relative(process.cwd(), outputPath),
  benchmark_images: imageIds,
  netlify_transform_urls: 0
}, null, 2));
