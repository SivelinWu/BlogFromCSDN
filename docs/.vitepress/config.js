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
    .replace(/#+\s/g, " ")
    .replace(/>\s?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readArticleExcerpt(markdown) {
  // 跳过标题与“原文”引用，取正文前 180 字
  const lines = markdown.split(/\r?\n/);
  const body = [];
  for (const line of lines.slice(1)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith(">") && t.includes("原文:")) continue;
    body.push(t);
    if (body.join(" ").length > 280) break;
  }
  const plain = toPlainText(body.join("\n"));
  return plain.length > 180 ? `${plain.slice(0, 180)}…` : plain;
}

function buildSidebarItems() {
  const articlesDir = path.resolve(__dirname, "..", "articles");
  if (!fs.existsSync(articlesDir)) return [];

  const files = fs
    .readdirSync(articlesDir)
    .filter((f) => f.endsWith(".md"));

  const items = files
    .map((filename) => {
      const fullPath = path.join(articlesDir, filename);
      const md = fs.readFileSync(fullPath, "utf-8");
      const title = readArticleTitle(md) || filename.replace(/\.md$/, "");
      const link = `/articles/${filename.replace(/\.md$/, ".html")}`;
      // filename 通常以：{articleId}_{title}.md 开头，这里用数字 id 作为排序依据
      const idMatch = filename.match(/^(\d+)_/);
      const id = idMatch ? Number(idMatch[1]) : 0;
      return { title, link, id };
    })
    .sort((a, b) => b.id - a.id);

  return items.map((x) => ({
    text: x.title,
    link: x.link,
  }));
}

function buildArticlesData() {
  const articlesDir = path.resolve(__dirname, "..", "articles");
  if (!fs.existsSync(articlesDir)) return [];

  return fs
    .readdirSync(articlesDir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => f !== "index.md")
    .map((filename) => {
      const fullPath = path.join(articlesDir, filename);
      const md = fs.readFileSync(fullPath, "utf-8");
      const title = readArticleTitle(md) || filename.replace(/\.md$/, "");
      const excerpt = readArticleExcerpt(md);
      const idMatch = filename.match(/^(\d+)_/);
      const id = idMatch ? Number(idMatch[1]) : 0;
      const link = `/articles/${filename.replace(/\.md$/, ".html")}`;
      return { id, title, excerpt, link };
    })
    .sort((a, b) => b.id - a.id);
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
    ["meta", { name: "theme-color", content: "#ffffff" }],
    ["meta", { name: "color-scheme", content: "light" }],
  ],
  themeConfig: {
    siteTitle: "我的博客",
    nav: [],
    sidebar: false,
    footer: {
      message: "内容同步自 CSDN，版权归原作者所有。",
      copyright: `Copyright © ${new Date().getFullYear()} 我的博客`,
    },
    outline: false,
    socialLinks: [],
    docFooter: {
      prev: false,
      next: false,
    },
  },
};
