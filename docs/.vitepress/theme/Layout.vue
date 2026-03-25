<script setup>
import { computed } from "vue";
import { useData } from "vitepress";
import DefaultTheme from "vitepress/theme";
import BackToList from "./components/BackToList.vue";

const { Layout } = DefaultTheme;
const { page, frontmatter } = useData();

// 使用计算属性确保响应式更新
const isArticlePage = computed(() => {
  const path = page.value?.relativePath || "";
  // 必须是 articles/ 目录下的文件，且不是 index.md
  // 同时排除主页（路径为空或为 index.md）
  return path && 
         path.startsWith("articles/") && 
         !path.endsWith("index.md") &&
         path !== "index.md";
});
</script>

<template>
  <Layout>
    <template #doc-before>
      <BackToList v-show="isArticlePage" />
    </template>
  </Layout>
</template>
