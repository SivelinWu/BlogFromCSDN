<script setup>
import { computed, ref } from "vue";

const q = ref("");
const selectedCategory = ref("全部");

const allArticles = computed(() => (Array.isArray(__ARTICLES__) ? __ARTICLES__ : []));

const categories = computed(() => {
  const counts = new Map();
  for (const article of allArticles.value) {
    const category = article.category || "随笔";
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  return [
    { name: "全部", count: allArticles.value.length },
    ...[...counts.entries()].map(([name, count]) => ({ name, count })),
  ];
});

const keywordSeeds = [
  "AI",
  "测试",
  "自动化",
  "自动化测试",
  "AI自动化",
  "Playwright",
  "测试技术",
  "测试工具",
  "安全测试",
  "性能测试",
  "团队管理",
  "接口",
  "接口测试",
  "质量",
  "质量门禁",
  "测试用例",
  "用例",
  "脚本",
  "落地",
  "实战",
  "实践",
  "问题",
  "排查",
  "分析",
  "效率",
  "工具",
  "技术",
  "管理",
  "团队",
  "流程",
  "规范",
  "风险",
  "数据",
  "报告",
  "登录",
  "鉴权",
  "权限",
  "水平权限",
  "漏洞",
  "断言",
  "加密",
  "签名",
  "兼容性",
  "幂等性",
  "回归",
  "冒烟",
  "缺陷",
  "Bug",
  "调优",
  "优化",
  "Mock",
  "Trace",
  "环境",
  "部署",
  "同步",
  "博客",
  "文章",
  "GitHub",
  "Action",
  "VitePress",
  "Node",
  "JavaScript",
  "Java",
  "API",
  "HTTP",
  "JSON",
  "JWT",
  "RSA",
  "AES",
  "H5",
  "JMeter",
  "Jenkins",
  "pytest",
  "Selenium",
  "Postman",
  "Charles",
  "Reqable",
  "Request",
  "Response",
  "Burp Suite",
  "TestSprite",
  "Midscene",
  "Claude Code",
  "Cursor",
  "Trae",
  "RPA",
  "影刀",
  "Redis",
  "MySQL",
  "SQL",
  "慢SQL",
  "Elasticsearch",
  "Vercel",
  "Duplicati",
  "AList",
  "RAID1",
  "NAS",
  "网盘",
  "云盘",
  "备份",
  "挂载",
  "域名",
  "映射",
  "阿里云盘",
  "百度网盘",
  "夸克网盘",
  "Docker",
  "Windows",
  "Linux",
  "Token",
  "Cookie",
  "Markdown",
  "YApi",
  "依赖",
  "命令",
  "服务",
  "失败",
  "性能",
  "安全",
  "渗透",
  "渗透测试",
  "中间件",
  "运维",
  "工具链",
  "零代码",
  "低代码",
  "UI自动化",
  "模型",
  "Harness",
  "驾驭系统",
  "需求",
  "测试点",
  "正交法",
  "反射",
  "学习型组织",
  "OKR",
  "考核",
  "质量团队",
  "个人网站",
  "分支",
  "git项目",
];

const englishStopWords = new Set([
  "and",
  "are",
  "but",
  "can",
  "com",
  "csdn",
  "for",
  "from",
  "html",
  "http",
  "https",
  "img",
  "not",
  "the",
  "this",
  "use",
  "with",
  "www",
  "you",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(source, term) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return 0;

  if (/^[a-z0-9+#.\s-]+$/i.test(normalized)) {
    const pattern = normalized.split(/\s+/).map(escapeRegExp).join("\\s+");
    const matches = source.match(new RegExp(`(^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`, "g"));
    return matches ? matches.length : 0;
  }

  return source.split(normalized).length - 1;
}

function addCloudScore(scores, text, count) {
  if (!text || count <= 0) return;
  const existing = scores.get(text);
  if (existing) {
    existing.count += count;
    return;
  }
  scores.set(text, { text, count });
}

function stableHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const wordCloud = computed(() => {
  const source = allArticles.value
    .map((article) => `${article.category || ""} ${article.title || ""} ${article.excerpt || ""}`)
    .join(" ")
    .toLowerCase();
  const scores = new Map();

  for (const category of categories.value.slice(1)) {
    addCloudScore(scores, category.name, category.count);
  }

  for (const seed of keywordSeeds) {
    const count = countOccurrences(source, seed);
    addCloudScore(scores, seed, count);
  }

  const englishTokens = source.match(/[a-z][a-z0-9+#.-]{2,24}/g) || [];
  for (const token of englishTokens) {
    if (!englishStopWords.has(token) && !/^\d+$/.test(token)) {
      addCloudScore(scores, token.replace(/^[.-]+|[.-]+$/g, ""), 1);
    }
  }

  const items = [...scores.values()]
    .filter((item) => item.text.length > 1)
    .sort((a, b) => b.count - a.count || a.text.length - b.text.length)
    .slice(0, 96);

  const maxCount = Math.max(...items.map((item) => item.count), 1);
  return items
    .map((item) => ({
      ...item,
      order: stableHash(`${item.text}:${item.count}`),
    }))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => {
      const ratio = Math.log(item.count + 1) / Math.log(maxCount + 1);
      const level = Math.max(1, Math.min(5, Math.ceil(ratio * 5)));
      const size = Math.round(9 + Math.pow(ratio, 1.45) * 29);
      const weight = Math.round(620 + ratio * 260);
      const opacity = (0.64 + ratio * 0.36).toFixed(2);
      return {
        ...item,
        level,
        tone: `cloud-tone-${index % 6}`,
        style: {
          "--cloud-size": `${size}px`,
          "--cloud-weight": weight,
          "--cloud-opacity": opacity,
        },
      };
    });
});

const articles = computed(() => {
  const query = q.value.trim().toLowerCase();
  return allArticles.value.filter((a) => {
    if (selectedCategory.value !== "全部" && a.category !== selectedCategory.value) {
      return false;
    }
    if (!query) return true;
    const t = (a.title || "").toLowerCase();
    const e = (a.excerpt || "").toLowerCase();
    return t.includes(query) || e.includes(query);
  });
});

function selectCategory(category) {
  selectedCategory.value = category;
}

function applyCloudKeyword(keyword) {
  const category = categories.value.find((item) => item.name === keyword);
  if (category) {
    selectedCategory.value = keyword;
    q.value = "";
    return;
  }

  selectedCategory.value = "全部";
  q.value = keyword;
}

function categoryTone(category) {
  const tones = {
    测试技术: "tone-blue",
    测试工具: "tone-emerald",
    安全测试: "tone-rose",
    性能测试: "tone-amber",
    团队管理: "tone-violet",
    折腾笔记: "tone-cyan",
  };
  return tones[category] || "tone-slate";
}
</script>

<template>
  <div class="blog-home">
    <header class="blog-header">
      <div class="hero-copy">
        <span class="eyebrow">CSDN Sync Notes</span>
        <h1 class="blog-title">骐骥一跃，不能十步；驽马十驾，功在不舍。</h1>
        <p class="blog-subtitle">记录测试技术、工具实践和团队管理中的真实经验。</p>
      </div>
      <div class="hero-panel">
        <div class="metric">
          <strong>{{ allArticles.length }}</strong>
          <span>篇文章</span>
        </div>
        <div class="metric">
          <strong>{{ categories.length - 1 }}</strong>
          <span>个分类</span>
        </div>
      </div>
    </header>

    <div class="home-layout">
      <aside class="word-cloud-panel" aria-label="关键词云">
        <div class="cloud-heading">
          <span class="cloud-eyebrow">Keyword Cloud</span>
          <h2>关键词云</h2>
        </div>
        <div class="word-cloud">
          <button
            v-for="word in wordCloud"
            :key="word.text"
            class="cloud-word"
            :class="[word.tone, `level-${word.level}`]"
            :style="word.style"
            :title="`${word.text}：${word.count}`"
            type="button"
            @click="applyCloudKeyword(word.text)"
          >
            {{ word.text }}
          </button>
        </div>
      </aside>

      <section class="article-stream">
        <section class="toolbar" aria-label="文章筛选">
          <div class="search-box">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              v-model="q"
              class="search-input"
              placeholder="搜索文章..."
              type="text"
            />
          </div>
          <div class="category-tabs" aria-label="文章分类">
            <button
              v-for="category in categories"
              :key="category.name"
              class="category-tab"
              :class="{ active: selectedCategory === category.name }"
              type="button"
              @click="selectCategory(category.name)"
            >
              <span>{{ category.name }}</span>
              <em>{{ category.count }}</em>
            </button>
          </div>
        </section>

        <main class="articles-waterfall">
          <a
            v-for="article in articles"
            :key="article.link"
            class="article-card"
            :href="article.link"
          >
            <div class="card-content">
              <div class="card-header">
                <span class="category-badge" :class="categoryTone(article.category)">
                  {{ article.category || "随笔" }}
                </span>
                <span v-if="article.id" class="article-id">#{{ article.id }}</span>
              </div>
              <h2 class="article-title">{{ article.title }}</h2>
              <p v-if="article.excerpt" class="article-excerpt">
                {{ article.excerpt }}
              </p>
              <div class="card-footer">
                <span class="read-more">
                  阅读全文
                  <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                  </svg>
                </span>
              </div>
            </div>
          </a>
        </main>

        <div v-if="articles.length === 0" class="empty-state">
          <p>没有找到相关文章</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.blog-home {
  max-width: 100%;
  margin: 0 auto;
}

.blog-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 28px;
  align-items: end;
  margin-bottom: 28px;
  padding: 8px 4px 0;
}

.hero-copy {
  min-width: 0;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  margin-bottom: 12px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.blog-title {
  max-width: 780px;
  font-size: 34px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 10px;
  line-height: 1.34;
}

.blog-subtitle {
  font-size: 16px;
  color: #4b5563;
  margin: 0;
  line-height: 1.8;
}

.hero-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(92px, 1fr));
  gap: 10px;
}

.metric {
  padding: 16px 18px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
}

.metric strong {
  display: block;
  color: #0f172a;
  font-size: 28px;
  line-height: 1;
}

.metric span {
  display: block;
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
}

.home-layout {
  display: grid;
  grid-template-columns: minmax(260px, 30%) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.word-cloud-panel {
  position: relative;
  overflow: hidden;
  min-height: 600px;
  padding: 24px 18px 20px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(240, 249, 255, 0.78)),
    linear-gradient(45deg, rgba(219, 234, 254, 0.8), rgba(220, 252, 231, 0.46) 48%, rgba(254, 243, 199, 0.44));
  box-shadow: 0 20px 56px rgba(15, 23, 42, 0.08);
}

.word-cloud-panel::before {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, rgba(96, 165, 250, 0.14), transparent 34%),
    linear-gradient(300deg, rgba(52, 211, 153, 0.14), transparent 42%),
    linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.46));
  content: "";
  pointer-events: none;
}

.cloud-heading,
.word-cloud {
  position: relative;
  z-index: 1;
}

.cloud-eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cloud-heading h2 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.25;
}

.word-cloud {
  display: flex;
  min-height: 520px;
  padding: 14px 0 4px;
  align-content: center;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 2px 4px;
}

.cloud-word {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 2px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  font-size: var(--cloud-size);
  font-weight: var(--cloud-weight);
  line-height: 1;
  letter-spacing: 0;
  opacity: var(--cloud-opacity);
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.2s ease, color 0.2s ease, background 0.2s ease, opacity 0.2s ease;
}

.cloud-word:hover,
.cloud-word:focus-visible {
  background: rgba(255, 255, 255, 0.58);
  color: #1d4ed8;
  opacity: 1;
  outline: none;
  transform: translateY(-2px) scale(1.04);
}

.cloud-word.level-5 {
  text-shadow: 0 8px 20px rgba(37, 99, 235, 0.12);
}

.cloud-word.level-1 {
  letter-spacing: 0;
}

.cloud-tone-0 {
  color: #1d4ed8;
}

.cloud-tone-1 {
  color: #047857;
}

.cloud-tone-2 {
  color: #be123c;
}

.cloud-tone-3 {
  color: #92400e;
}

.cloud-tone-4 {
  color: #6d28d9;
}

.cloud-tone-5 {
  color: #0e7490;
}

.article-stream {
  min-width: 0;
}

.toolbar {
  display: grid;
  gap: 16px;
  margin-bottom: 24px;
  padding: 18px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.07);
}

.search-box {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: #9ca3af;
}

.search-input {
  width: 100%;
  height: 48px;
  padding: 0 20px 0 48px;
  font-size: 15px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #ffffff;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.16);
}

.search-input::placeholder {
  color: #9ca3af;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.category-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #ffffff;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.category-tab em {
  color: #94a3b8;
  font-size: 12px;
  font-style: normal;
}

.category-tab:hover,
.category-tab.active {
  color: #1d4ed8;
  border-color: #93c5fd;
  box-shadow: 0 8px 22px rgba(37, 99, 235, 0.12);
}

.articles-waterfall {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 18px;
  max-width: 100%;
  margin: 0 auto;
}

.article-card {
  position: relative;
  display: block;
  text-decoration: none !important;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 255, 0.96));
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  overflow: hidden;
  transition: all 0.25s ease;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.07);
}

.article-card::before {
  content: "";
  display: block;
  height: 4px;
  background: linear-gradient(90deg, #60a5fa, #34d399 45%, #fbbf24);
  opacity: 0.82;
}

.article-card:hover,
.article-card:focus,
.article-card:active {
  transform: translateY(-3px);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
  border-color: rgba(96, 165, 250, 0.55);
  text-decoration: none !important;
}

.article-card * {
  text-decoration: none !important;
}

.card-content {
  padding: 24px 26px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.category-badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.tone-blue {
  color: #1d4ed8;
  background: #dbeafe;
}

.tone-emerald {
  color: #047857;
  background: #d1fae5;
}

.tone-rose {
  color: #be123c;
  background: #ffe4e6;
}

.tone-amber {
  color: #92400e;
  background: #fef3c7;
}

.tone-violet {
  color: #6d28d9;
  background: #ede9fe;
}

.tone-cyan {
  color: #0e7490;
  background: #cffafe;
}

.tone-slate {
  color: #475569;
  background: #f1f5f9;
}

.article-id {
  font-size: 13px;
  color: #94a3b8;
  font-weight: 500;
}

.article-card .article-title {
  font-size: 18px;
  font-weight: 750;
  color: #0f172a;
  line-height: 1.5;
  margin: 0 0 12px;
  padding: 0;
  border: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-decoration: none !important;
}

.article-card:hover .article-title {
  text-decoration: none !important;
}

.article-excerpt {
  font-size: 14px;
  color: #475569;
  line-height: 1.7;
  margin: 0 0 20px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.read-more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #2563eb;
  transition: all 0.2s ease;
}

.article-card:hover .read-more {
  color: #0f766e;
}

.arrow-icon {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}

.article-card:hover .arrow-icon {
  transform: translateX(3px);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
  font-size: 16px;
}

  @media (max-width: 980px) {
  .home-layout {
    grid-template-columns: 1fr;
  }

  .word-cloud-panel {
    min-height: 0;
  }

  .word-cloud {
    min-height: 300px;
    padding-top: 14px;
  }
}

@media (max-width: 760px) {
  .blog-header {
    grid-template-columns: 1fr;
    gap: 18px;
    padding-top: 0;
  }

  .hero-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .blog-title {
    font-size: 26px;
    line-height: 1.38;
  }

  .toolbar {
    padding: 14px;
  }

  .home-layout {
    gap: 18px;
  }

  .category-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .category-tab {
    flex: 0 0 auto;
  }

  .card-content {
    padding: 20px;
  }

  .cloud-heading h2 {
    font-size: 21px;
  }

  .cloud-word {
    font-size: min(var(--cloud-size), 22px);
  }

  .article-card .article-title {
    font-size: 18px;
    line-height: 1.45;
    -webkit-line-clamp: 3;
  }
}
</style>
