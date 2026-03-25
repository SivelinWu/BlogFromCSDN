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
  margin-bottom: 24px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  color: #374151;
  background: #f9fafb;
  border-color: #d1d5db;
  transform: translateX(-2px);
}

.back-icon {
  width: 18px;
  height: 18px;
}
</style>
