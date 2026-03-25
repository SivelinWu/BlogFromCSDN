<script setup>
import { computed, ref } from "vue";

const q = ref("");

const articles = computed(() => {
  const list = Array.isArray(__ARTICLES__) ? __ARTICLES__ : [];
  const query = q.value.trim().toLowerCase();
  if (!query) return list;
  return list.filter((a) => {
    const t = (a.title || "").toLowerCase();
    const e = (a.excerpt || "").toLowerCase();
    return t.includes(query) || e.includes(query);
  });
});

// 格式化日期
function formatDateFromId(id) {
  if (!id) return "";
  // CSDN文章ID通常是时间戳格式，尝试解析
  const timestamp = parseInt(id);
  if (isNaN(timestamp) || timestamp < 1000000000) return "";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
</script>

<template>
  <div class="blog-home">
    <!-- 头部区域 -->
    <header class="blog-header">
      <h1 class="blog-title">我的博客</h1>
      <p class="blog-subtitle">记录技术成长，分享学习心得</p>
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
    </header>

    <!-- 瀑布流文章列表 -->
    <main class="articles-waterfall">
      <a
        v-for="article in articles"
        :key="article.link"
        class="article-card"
        :href="article.link"
      >
        <div class="card-content">
          <div class="card-header">
            <span v-if="article.id" class="article-date">
              {{ formatDateFromId(article.id) }}
            </span>
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

    <!-- 空状态 -->
    <div v-if="articles.length === 0" class="empty-state">
      <p>没有找到相关文章</p>
    </div>
  </div>
</template>

<style scoped>
.blog-home {
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 24px;
}

/* 头部区域 */
.blog-header {
  text-align: center;
  margin-bottom: 48px;
  padding: 0 20px;
}

.blog-title {
  font-size: 36px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 12px;
  letter-spacing: -0.5px;
}

.blog-subtitle {
  font-size: 16px;
  color: #6b7280;
  margin: 0 0 28px;
}

.search-box {
  position: relative;
  max-width: 480px;
  margin: 0 auto;
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
  height: 50px;
  padding: 0 20px 0 48px;
  font-size: 15px;
  border: 2px solid #e5e7eb;
  border-radius: 25px;
  background: #ffffff;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
}

.search-input::placeholder {
  color: #9ca3af;
}

/* 单列布局 */
.articles-waterfall {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 800px;
  margin: 0 auto;
}

@media (max-width: 480px) {
  .articles-waterfall {
    gap: 16px;
  }
  
  .blog-home {
    padding: 24px 16px;
  }
  
  .blog-title {
    font-size: 28px;
  }
}

/* 文章卡片 */
.article-card {
  display: block;
  text-decoration: none;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  transition: all 0.25s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.article-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
  border-color: #d1d5db;
}

.card-content {
  padding: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.article-date {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.article-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  line-height: 1.5;
  margin: 0 0 12px;
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
  color: #6b7280;
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
  font-weight: 500;
  color: #6366f1;
  transition: all 0.2s ease;
}

.article-card:hover .read-more {
  color: #4f46e5;
}

.arrow-icon {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}

.article-card:hover .arrow-icon {
  transform: translateX(3px);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
  font-size: 16px;
}
</style>
