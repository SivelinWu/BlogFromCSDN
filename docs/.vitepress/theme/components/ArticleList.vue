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
</script>

<template>
  <div class="blogList">
    <div class="blogListHeader">
      <div class="blogListTitle">文章</div>
      <div class="blogListSearch">
        <input v-model="q" class="blogListInput" placeholder="搜索标题或摘要…" />
      </div>
    </div>

    <div class="blogListMasonry">
      <a
        v-for="a in articles"
        :key="a.link"
        class="blogCard"
        :href="a.link"
      >
        <div class="blogCardMeta">
          <span v-if="a.id" class="blogCardId">#{{ a.id }}</span>
        </div>
        <div class="blogCardTitle">{{ a.title }}</div>
        <div v-if="a.excerpt" class="blogCardExcerpt">{{ a.excerpt }}</div>
      </a>
    </div>
  </div>
</template>

<style scoped>
.blogListHeader {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 6px 0 16px;
}
.blogListTitle {
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}
.blogListSearch {
  margin-left: auto;
}
.blogListInput {
  width: min(320px, 55vw);
  height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.9);
  outline: none;
}
.blogListInput:focus {
  border-color: rgba(79, 70, 229, 0.35);
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.10);
}

/* Masonry via columns: looks like CSDN waterfall */
.blogListMasonry {
  column-gap: 14px;
  column-count: 2;
}
@media (max-width: 900px) {
  .blogListMasonry {
    column-count: 1;
  }
}

.blogCard {
  display: inline-block;
  width: 100%;
  break-inside: avoid;
  margin: 0 0 14px;
  padding: 14px 14px 13px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(10px);
  box-shadow: var(--vp-shadow-2);
  text-decoration: none;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}
.blogCard:hover {
  transform: translateY(-2px);
  box-shadow: var(--vp-shadow-1);
  border-color: rgba(79, 70, 229, 0.18);
}
.blogCardTitle {
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
  line-height: 1.35;
  margin-top: 2px;
}
.blogCardExcerpt {
  margin-top: 10px;
  color: var(--vp-c-text-2);
  line-height: 1.65;
  font-size: 14px;
}
.blogCardMeta {
  display: flex;
  justify-content: flex-end;
}
.blogCardId {
  font-size: 12px;
  color: var(--vp-c-text-3);
  background: rgba(15, 23, 42, 0.04);
  border: 1px solid rgba(15, 23, 42, 0.08);
  padding: 2px 8px;
  border-radius: 999px;
}
</style>

