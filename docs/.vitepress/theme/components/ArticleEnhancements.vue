<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vitepress";

const route = useRoute();
const progress = ref(0);
const lightbox = ref(null);

const allArticles = computed(() => (Array.isArray(__ARTICLES__) ? __ARTICLES__ : []));

let imageCleanups = [];
let routeStop = null;

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePath(value) {
  const path = safeDecode(String(value || "").split(/[?#]/)[0])
    .replace(/\.html$/, "")
    .replace(/\/$/, "");
  return path.startsWith("/") ? path : `/${path}`;
}

const currentIndex = computed(() => {
  const current = normalizePath(route.path);
  return allArticles.value.findIndex((article) => normalizePath(article.link) === current);
});

const currentArticle = computed(() =>
  currentIndex.value >= 0 ? allArticles.value[currentIndex.value] : null,
);

const previousArticle = computed(() =>
  currentIndex.value > 0 ? allArticles.value[currentIndex.value - 1] : null,
);

const nextArticle = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < allArticles.value.length - 1
    ? allArticles.value[currentIndex.value + 1]
    : null,
);

const relatedArticles = computed(() => {
  const current = currentArticle.value;
  if (!current) return [];
  return allArticles.value
    .filter((article) => article.link !== current.link && article.category === current.category)
    .slice(0, 3);
});

function updateProgress() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) {
    progress.value = 0;
    return;
  }
  progress.value = Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100));
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function setupCodeCopy() {
  document.querySelectorAll(".vp-doc pre").forEach((pre) => {
    let block = pre.closest("div[class*='language-']");
    if (!block) {
      block = pre.parentElement?.classList.contains("enhanced-code-wrapper")
        ? pre.parentElement
        : null;
    }
    if (!block) {
      block = document.createElement("div");
      block.className = "enhanced-code-wrapper";
      pre.before(block);
      block.appendChild(pre);
    }
    if (block.querySelector(":scope > .code-copy-button")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy-button";
    button.setAttribute("aria-label", "复制代码");
    button.textContent = "复制";

    button.addEventListener("click", async () => {
      try {
        await copyText(pre.innerText.replace(/\n$/, ""));
        button.textContent = "已复制";
        button.classList.add("copied");
        window.setTimeout(() => {
          button.textContent = "复制";
          button.classList.remove("copied");
        }, 1400);
      } catch {
        button.textContent = "复制失败";
        window.setTimeout(() => {
          button.textContent = "复制";
        }, 1400);
      }
    });

    block.appendChild(button);
  });
}

function cleanupImagePreview() {
  for (const cleanup of imageCleanups) cleanup();
  imageCleanups = [];
}

function setupImagePreview() {
  cleanupImagePreview();
  document.querySelectorAll(".vp-doc img").forEach((image) => {
    if (image.closest("a")) return;

    image.classList.add("article-zoomable-image");
    const handler = () => {
      lightbox.value = {
        src: image.currentSrc || image.src,
        alt: image.alt || "文章图片",
      };
    };
    image.addEventListener("click", handler);
    imageCleanups.push(() => {
      image.removeEventListener("click", handler);
      image.classList.remove("article-zoomable-image");
    });
  });
}

function refreshEnhancements() {
  nextTick(() => {
    window.requestAnimationFrame(() => {
      setupCodeCopy();
      setupImagePreview();
      updateProgress();
    });
  });
}

function closeLightbox() {
  lightbox.value = null;
}

function onKeydown(event) {
  if (event.key === "Escape") closeLightbox();
}

onMounted(() => {
  routeStop = watch(() => route.path, refreshEnhancements, { immediate: true });
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  routeStop?.();
  cleanupImagePreview();
  window.removeEventListener("scroll", updateProgress);
  window.removeEventListener("resize", updateProgress);
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div class="reading-progress" aria-hidden="true">
    <span :style="{ width: `${progress}%` }"></span>
  </div>

  <section class="article-afterword" aria-label="文章导航与相关推荐">
    <div v-if="previousArticle || nextArticle" class="article-neighbor-grid">
      <a v-if="previousArticle" class="article-neighbor" :href="previousArticle.link">
        <span>上一篇</span>
        <strong>{{ previousArticle.title }}</strong>
      </a>
      <a v-if="nextArticle" class="article-neighbor" :href="nextArticle.link">
        <span>下一篇</span>
        <strong>{{ nextArticle.title }}</strong>
      </a>
    </div>

    <div v-if="relatedArticles.length" class="related-articles">
      <div class="related-heading">
        <span>{{ currentArticle?.category || "相关" }}</span>
        <h2>相关文章</h2>
      </div>
      <div class="related-list">
        <a
          v-for="article in relatedArticles"
          :key="article.link"
          class="related-link"
          :href="article.link"
        >
          <strong>{{ article.title }}</strong>
          <span>{{ article.excerpt }}</span>
        </a>
      </div>
    </div>
  </section>

  <div
    v-if="lightbox"
    class="image-lightbox"
    role="dialog"
    aria-modal="true"
    aria-label="图片预览"
    @click.self="closeLightbox"
  >
    <button class="image-lightbox-close" type="button" aria-label="关闭图片预览" @click="closeLightbox">
      ×
    </button>
    <img :src="lightbox.src" :alt="lightbox.alt" />
  </div>
</template>

<style scoped>
.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100;
  width: 100%;
  height: 3px;
  background: rgba(219, 234, 254, 0.42);
}

.reading-progress span {
  display: block;
  width: 0;
  height: 100%;
  background: linear-gradient(90deg, #2563eb, #14b8a6, #f59e0b);
  box-shadow: 0 0 18px rgba(37, 99, 235, 0.28);
  transition: width 0.12s linear;
}

.article-afterword {
  display: grid;
  gap: 24px;
  max-width: 780px;
  margin: 46px 0 0;
  padding-top: 28px;
  border-top: 1px solid rgba(203, 213, 225, 0.82);
}

.article-neighbor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.article-neighbor,
.related-link {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
  text-decoration: none;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.article-neighbor:hover,
.related-link:hover {
  transform: translateY(-2px);
  border-color: rgba(96, 165, 250, 0.58);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.1);
}

.article-neighbor span,
.related-heading span {
  color: #2563eb;
  font-size: 13px;
  font-weight: 800;
}

.article-neighbor strong,
.related-link strong {
  color: #0f172a;
  font-size: 15px;
  line-height: 1.55;
}

.related-heading {
  margin-bottom: 14px;
}

.related-heading h2 {
  margin: 4px 0 0;
  color: #0f172a;
  font-size: 22px;
  line-height: 1.35;
}

.related-list {
  display: grid;
  gap: 12px;
}

.related-link span {
  display: -webkit-box;
  overflow: hidden;
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 48px 24px;
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(10px);
}

.image-lightbox img {
  max-width: min(1080px, 94vw);
  max-height: 86vh;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.36);
}

.image-lightbox-close {
  position: fixed;
  top: 22px;
  right: 26px;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.74);
  color: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
}

:global(.vp-doc div[class*="language-"]) {
  position: relative;
}

:global(.vp-doc .enhanced-code-wrapper) {
  position: relative;
  overflow: hidden;
  margin: 24px 0;
}

:global(.vp-doc .enhanced-code-wrapper > pre) {
  margin: 0;
}

:global(.code-copy-button) {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(148, 163, 184, 0.38);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

:global(.vp-doc div[class*="language-"]:hover .code-copy-button),
:global(.vp-doc .enhanced-code-wrapper:hover .code-copy-button),
:global(.code-copy-button:focus-visible),
:global(.code-copy-button.copied) {
  opacity: 1;
}

:global(.code-copy-button:hover),
:global(.code-copy-button.copied) {
  color: #2563eb;
  border-color: rgba(96, 165, 250, 0.72);
}

:global(.article-zoomable-image) {
  cursor: zoom-in;
}

@media (max-width: 768px) {
  .article-afterword {
    margin-top: 36px;
  }

  .article-neighbor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
