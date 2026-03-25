import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const ARTICLES_DIR = path.join(DOCS_DIR, "articles");
const CDN_DIR = path.join(DOCS_DIR, "public", "cdn");

const MAX_DOWNLOADS = Number(process.env.MAX_CDN_DOWNLOADS || "300");
const CANDIDATE_PREFIXES = [
  "https://i-blog.csdnimg.cn/direct/",
  "https://i-blog.csdnimg.cn/img_convert/",
];

function walkMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function unique(arr) {
  return [...new Set(arr)];
}

async function fetchToFile(url, outPath) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      Referer: "https://blog.csdn.net/",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, buf);
}

async function main() {
  ensureDir(CDN_DIR);
  const files = walkMarkdownFiles(ARTICLES_DIR);
  const re = /\((\/cdn\/(\d+)\/([^)\s]+))\)/g;

  let refs = [];
  for (const file of files) {
    const md = fs.readFileSync(file, "utf-8");
    let m;
    while ((m = re.exec(md))) {
      refs.push({ full: m[1], id: m[2], filename: m[3] });
    }
  }
  refs = unique(refs.map((r) => `${r.id}/${r.filename}`)).map((s) => {
    const [id, filename] = s.split("/");
    return { id, filename };
  });

  let downloaded = 0;
  let skipped = 0;

  for (const { id, filename } of refs) {
    const local = path.join(CDN_DIR, id, filename);
    if (fs.existsSync(local)) {
      skipped += 1;
      continue;
    }
    if (downloaded >= MAX_DOWNLOADS) break;

    let ok = false;
    for (const prefix of CANDIDATE_PREFIXES) {
      try {
        await fetchToFile(prefix + filename, local);
        ok = true;
        downloaded += 1;
        break;
      } catch {
        // try next prefix
      }
    }
    if (!ok) {
      // don't fail build; keep link as-is (may still work remotely)
      continue;
    }
  }

  console.log(
    `[ensure_cdn_images] refs=${refs.length} downloaded=${downloaded} skipped=${skipped} (max=${MAX_DOWNLOADS})`
  );
}

await main();

