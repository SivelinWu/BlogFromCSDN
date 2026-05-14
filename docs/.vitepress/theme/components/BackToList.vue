<script setup>
import { useRouter } from "vitepress";

const router = useRouter();

function goBack() {
  router.go("/articles/");
}
</script>

<template>
  <nav class="article-nav">
    <button class="back-btn" @click="goBack">
      <svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m15 18-6-6 6-6"></path>
      </svg>
      <span>返回列表</span>
    </button>
  </nav>
</template>

<style scoped>
.article-nav {
  margin-bottom: 28px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 700;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.back-btn:hover {
  color: #0f766e;
  background: #ecfdf5;
  border-color: #99f6e4;
  transform: translateX(-2px);
}

.back-icon {
  width: 18px;
  height: 18px;
}
</style>
