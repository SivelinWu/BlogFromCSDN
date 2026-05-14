import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readArticleTitle(markdown) {
  // 文件由同步脚本生成，通常第一行是：# {title}
  const firstLine = (markdown.split(/\r?\n/)[0] || "").trim();
  const m = firstLine.match(/^#\s+(.*)$/);
  return m ? m[1].trim() : null;
}

function toPlainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/#+\s/g, " ")
    .replace(/>\s?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readArticleExcerpt(markdown) {
  // 跳过标题、“原文”和同步自 CSDN 的版权声明，取正文前 180 字
  const lines = markdown.split(/\r?\n/);
  const body = [];
  for (const line of lines.slice(1)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith(">") && t.includes("原文:")) continue;
    if (t.includes("原创内容") && t.includes("禁止转载")) continue;
    body.push(t);
    if (body.join(" ").length > 280) break;
  }
  const plain = toPlainText(body.join("\n"));
  return plain.length > 180 ? `${plain.slice(0, 180)}…` : plain;
}

function normalizeArticleTitle(title) {
  return title.replace(/^原创\s*/, "").replace(/^原创(?=\[)/, "").trim();
}

function inferArticleCategory(title) {
  const m = normalizeArticleTitle(title).match(/^\[([^\]]+)]/);
  return m ? m[1].trim() : "随笔";
}

function readArticleRecords() {
  const articlesDir = path.resolve(__dirname, "..", "articles");
  if (!fs.existsSync(articlesDir)) return [];

  const records = fs
    .readdirSync(articlesDir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => f !== "index.md")
    .map((filename) => {
      const fullPath = path.join(articlesDir, filename);
      const md = fs.readFileSync(fullPath, "utf-8");
      const rawTitle = readArticleTitle(md) || filename.replace(/\.md$/, "");
      const title = normalizeArticleTitle(rawTitle);
      const link = `/articles/${filename.replace(/\.md$/, ".html")}`;
      const idMatch = filename.match(/^(\d+)_/);
      const id = idMatch ? Number(idMatch[1]) : 0;
      const sourceRank = /^原创/.test(rawTitle) || filename.includes("_原创") ? 1 : 0;
      return {
        id,
        title,
        rawTitle,
        excerpt: readArticleExcerpt(md),
        link,
        category: inferArticleCategory(rawTitle),
        sourceRank,
      };
    });

  const deduped = new Map();
  for (const record of records) {
    const key = record.id || record.link;
    const existing = deduped.get(key);
    if (!existing || record.sourceRank > existing.sourceRank) {
      deduped.set(key, record);
    }
  }

  return [...deduped.values()].sort((a, b) => b.id - a.id);
}

function buildSidebarItems() {
  const items = readArticleRecords();

  return items.map((x) => ({
    text: x.title,
    link: x.link,
  }));
}

function buildArticlesData() {
  return readArticleRecords().map(({ id, title, excerpt, link, category }) => ({
    id,
    title,
    excerpt,
    link,
    category,
  }));
}

function getLatestArticleLink() {
  const items = buildArticlesData();
  return items.length ? items[0].link : "/";
}

export default {
  title: "我的博客",
  description: "CSDN文章自动同步",
  cleanUrls: true,
  lastUpdated: true,
  appearance: false,
  ignoreDeadLinks: true,
  markdown: {
    theme: "github-light",
  },
  vite: {
    define: {
      __LATEST_ARTICLE_LINK__: JSON.stringify(getLatestArticleLink()),
      __ARTICLES__: JSON.stringify(buildArticlesData()),
    },
  },
  head: [
    ["meta", { name: "theme-color", content: "#f4f8ff" }],
    ["meta", { name: "color-scheme", content: "light" }],
    [
      "link",
      {
        rel: "icon",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%232563eb'/%3E%3Cpath d='M9 9h8.5a5 5 0 0 1 0 10H14v4H9V9Zm5 4v2h3.3a1 1 0 0 0 0-2H14Z' fill='white'/%3E%3C/svg%3E",
      },
    ],
  ],
  themeConfig: {
    siteTitle: "我的博客",
    nav: [
      { text: "首页", link: "/" },
      { text: "全部文章", link: "/articles/" },
      { text: "关于", link: "/about" },
    ],
    sidebar: false,
    outline: {
      label: "本页目录",
      level: [2, 3],
    },
    returnToTopLabel: "返回顶部",
    sidebarMenuLabel: "菜单",
    footer: {
      message: "内容同步自 CSDN，版权归原作者所有。",
      copyright: `Copyright © ${new Date().getFullYear()} 我的博客`,
    },
    socialLinks: [],
    docFooter: {
      prev: false,
      next: false,
    },
  },
};
