<script setup>
import { useRouter } from "vitepress";

const router = useRouter();

function goBack() {
  router.go("/articles/");
}
</script>

<template>
  <div class="backToList">
    <button class="backToListBtn" @click="goBack">
      ← 返回文章列表
    </button>
  </div>
</template>

<style scoped>
.backToList {
  margin: 0 0 20px;
}
.backToListBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.08);
  border: 1px solid rgba(79, 70, 229, 0.25);
  border-radius: 10px;
  cursor: pointer;
  transition: all 160ms ease;
}
.backToListBtn:hover {
  background: rgba(79, 70, 229, 0.14);
  border-color: rgba(79, 70, 229, 0.4);
  transform: translateX(-2px);
}
</style>
