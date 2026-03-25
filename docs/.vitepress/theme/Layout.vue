<script setup>
import { useData } from "vitepress";
import DefaultTheme from "vitepress/theme";
import BackToList from "./components/BackToList.vue";

const { Layout } = DefaultTheme;
const { page } = useData();

// 判断是否是文章详情页
const isArticlePage = page.value?.relativePath?.startsWith("articles/") && 
                      !page.value?.relativePath?.endsWith("index.md");

// 判断是否是文章列表页
const isListPage = page.value?.relativePath === "articles/index.md" ||
                   page.value?.relativePath === "index.md";
</script>

<template>
  <Layout>
    <!-- 文章详情页顶部显示返回按钮 -->
    <template #doc-before v-if="isArticlePage">
      <BackToList />
    </template>

    <!-- 文章列表页自定义样式 -->
    <template #doc-before v-if="isListPage">
      <div class="list-page-spacer"></div>
    </template>
  </Layout>
</template>

<style>
/* 列表页间距 */
.list-page-spacer {
  height: 0;
}
</style>
