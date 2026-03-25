<script setup>
import { useData } from "vitepress";
import DefaultTheme from "vitepress/theme";
import BackToList from "./components/BackToList.vue";

const { Layout } = DefaultTheme;
const { frontmatter, page } = useData();

// 判断是否是文章详情页（路径包含 /articles/ 且不是列表页）
const isArticlePage = page.value?.relativePath?.startsWith("articles/") && 
                      !page.value?.relativePath?.endsWith("index.md");
</script>

<template>
  <Layout>
    <template #doc-before>
      <BackToList v-if="isArticlePage" />
    </template>
  </Layout>
</template>
