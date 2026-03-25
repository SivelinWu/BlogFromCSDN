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

export default {
  title: "我的博客",
  description: "CSDN文章自动同步",
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
  },
  head: [
    ["meta", { name: "theme-color", content: "#0b1220" }],
    ["meta", { name: "color-scheme", content: "dark light" }],
  ],
  themeConfig: {
    siteTitle: "我的博客",
    nav: [
      { text: "首页", link: "/" },
      { text: "全部文章", link: "/articles/" },
    ],
    sidebar: [
      {
        text: "所有文章",
        items: buildSidebarItems(),
      },
    ],
    footer: {
      message: "内容同步自 CSDN，版权归原作者所有。",
      copyright: `Copyright © ${new Date().getFullYear()} 我的博客`,
    },
    outline: [2, 3],
    socialLinks: [{ icon: "github", link: "https://github.com/SivelinWu/BlogFromCSDN" }],
  },
};
